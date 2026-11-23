using System.Runtime.Versioning;

namespace SgaConnect.Api.Sga;

/// <summary>
/// Tela Estoque: (1) lista de itens ativos com saldo calculado, (2) movimentacao (itens
/// vendidos no periodo por quantidade) e (3) ponto de pedido. SOMENTE LEITURA.
///
/// Regras confirmadas pelo cliente:
///   - Produto: EST (CodItem, Descricao, CodigoFabricante, CodigoInterno, REFORIG).
///   - Por empresa: EMPXEST (CodigoItem = EST.CodItem, CodigoEmpresa, PrecoVenda, Minimo, Ativo).
///     Lista mostra SO itens com EMPXEST.Ativo = Sim.
///   - SALDO calculado = ENTRADAS - SAIDAS por item:
///       entradas = SUM(DETENTRADAS.Quantidade)                 (TODAS as entradas)
///       saidas   = SUM(RMXEMPXEST.Quantidade) das OS cuja CONDPAGTO.GeraEstoque = Sim,
///                  tratando Devolucao como ENTRADA (volta pro estoque).
///   - "Vendas que movimentam estoque" = RMXEMPXEST ligada a OS (RMXEMPXEST.Numos = OS.NumOs),
///      cuja OS.CodigoPagto aponta para uma CONDPAGTO com GeraEstoque = Sim.
///   - Ponto de pedido = itens ativos com Minimo > 0 e saldo &lt;= Minimo.
///
/// GeraEstoque e campo TEXTO ('S'/'N') no SGA (como OS.EmitirLaudo), por isso NAO da para
/// filtrar com IIF no SQL (qualquer string nao-vazia e "verdade" no Access). Resolvemos
/// descobrindo em C# o conjunto de CodigoPagto que geram estoque e filtrando por ele.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class RepositorioEstoque
{
    private readonly LeitorSga _leitor;

    public RepositorioEstoque(LeitorSga leitor) => _leitor = leitor;

    public sealed record ItemEstoque(
        int CodItem,
        string Descricao,
        string CodigoFabricante,
        string CodigoInterno,
        string Referencia,
        decimal PrecoVenda,
        decimal Minimo,
        decimal Saldo);

    public sealed record ItemVendido(
        int CodItem,
        string Descricao,
        string CodigoFabricante,
        string CodigoInterno,
        string Referencia,
        decimal Quantidade,
        decimal ValorTotal);

    // ---------------- Parte 1: lista de itens ativos com saldo ----------------

    public List<ItemEstoque> ListarItens(int codEmpresa)
    {
        var baseItens = ItensAtivos(codEmpresa);
        if (baseItens.Count == 0) return new List<ItemEstoque>();

        var saldos = SaldoPorItem(codEmpresa);

        return baseItens
            .Select(i => i with { Saldo = saldos.GetValueOrDefault(i.CodItem) })
            .OrderBy(i => i.Descricao)
            .ToList();
    }

    // ---------------- Parte 3: ponto de pedido ----------------

    /// <summary>Itens ativos com Minimo &gt; 0 e saldo &lt;= Minimo (do mais critico ao menos).</summary>
    public List<ItemEstoque> PontoDePedido(int codEmpresa)
    {
        return ListarItens(codEmpresa)
            .Where(i => i.Minimo > 0 && i.Saldo <= i.Minimo)
            .OrderBy(i => i.Saldo - i.Minimo) // mais negativo (mais critico) primeiro
            .ToList();
    }

    // ---------------- Parte 2: itens vendidos no periodo ----------------

    /// <summary>
    /// Itens vendidos (saidas que geram estoque) com DataFechamento da OS no periodo,
    /// agrupados por item, ordenados pela quantidade vendida (desc). Devolucoes nao sao
    /// venda: ficam de fora.
    /// </summary>
    public List<ItemVendido> ItensVendidos(int codEmpresa, DateTime inicio, DateTime fim)
    {
        var pagtosGeram = CodigosPagtoQueGeramEstoque(codEmpresa);
        if (pagtosGeram.Count == 0) return new List<ItemVendido>();

        // Saidas (nao devolucao) ligadas a OS fechada no periodo. Trazemos o CodigoPagto da
        // OS para filtrar GeraEstoque em memoria.
        const string sql = """
            SELECT x.CodItem AS CodItem, x.Quantidade AS Qtd, x.ValorUnit AS ValorUnit,
                   o.CodigoPagto AS CodigoPagto
            FROM RMXEMPXEST AS x INNER JOIN OS AS o ON x.Numos = o.NumOs
            WHERE x.CodEmpresa = ?
              AND o.DataFechamento IS NOT NULL
              AND o.DataFechamento >= ? AND o.DataFechamento < ?
              AND (x.Devolucao IS NULL OR x.Devolucao = 0)
              AND (o.Cancelada IS NULL OR o.Cancelada = 0)
            """;

        var agregado = new Dictionary<int, (decimal qtd, decimal valor)>();
        foreach (var r in _leitor.Consultar(sql, r => (
                     cod: Convert.ToInt32(r["CodItem"]),
                     qtd: Dec(r["Qtd"]),
                     valor: Dec(r["Qtd"]) * Dec(r["ValorUnit"]),
                     pagto: r["CodigoPagto"] is null or DBNull ? -1 : Convert.ToInt32(r["CodigoPagto"])),
                     codEmpresa, inicio, fim))
        {
            if (!pagtosGeram.Contains(r.pagto)) continue; // so operacoes que geram estoque
            var a = agregado.GetValueOrDefault(r.cod);
            agregado[r.cod] = (a.qtd + r.qtd, a.valor + r.valor);
        }

        if (agregado.Count == 0) return new List<ItemVendido>();

        var info = InfoItens(agregado.Keys);
        return agregado
            .Select(kv =>
            {
                var i = info.GetValueOrDefault(kv.Key);
                return new ItemVendido(
                    CodItem: kv.Key,
                    Descricao: i?.Descricao ?? "",
                    CodigoFabricante: i?.CodigoFabricante ?? "",
                    CodigoInterno: i?.CodigoInterno ?? "",
                    Referencia: i?.Referencia ?? "",
                    Quantidade: kv.Value.qtd,
                    ValorTotal: kv.Value.valor);
            })
            .OrderByDescending(v => v.Quantidade)
            .ToList();
    }

    // ---------------- Blocos auxiliares ----------------

    /// <summary>Itens ATIVOS da empresa (EMPXEST.Ativo) com seus dados de EST. Saldo = 0 (preenchido depois).</summary>
    private List<ItemEstoque> ItensAtivos(int codEmpresa)
    {
        // Nome do produto = EST.Codinome (confirmado pelo cliente), nao Descricao.
        const string sql = """
            SELECT e.CodItem AS CodItem, e.Codinome AS Descricao,
                   e.CodigoFabricante AS Fab, e.CodigoInterno AS Interno, e.REFORIG AS Ref,
                   m.PrecoVenda AS PrecoVenda, m.Minimo AS Minimo, m.Ativo AS Ativo
            FROM EMPXEST AS m INNER JOIN EST AS e ON m.CodigoItem = e.CodItem
            WHERE m.CodigoEmpresa = ?
            """;
        return _leitor.Consultar(sql, r => new
        {
            item = new ItemEstoque(
                CodItem: Convert.ToInt32(r["CodItem"]),
                Descricao: Txt(r["Descricao"]),
                CodigoFabricante: Txt(r["Fab"]),
                CodigoInterno: Txt(r["Interno"]),
                Referencia: Txt(r["Ref"]),
                PrecoVenda: Dec(r["PrecoVenda"]),
                Minimo: Dec(r["Minimo"]),
                Saldo: 0m),
            ativo = Bool(r["Ativo"])
        }, codEmpresa)
        .Where(x => x.ativo)
        .Select(x => x.item)
        .ToList();
    }

    /// <summary>Saldo por item = entradas (todas) - saidas (so GeraEstoque=Sim; devolucao soma).</summary>
    private Dictionary<int, decimal> SaldoPorItem(int codEmpresa)
    {
        var saldo = new Dictionary<int, decimal>();

        // Entradas: TODAS as DETENTRADAS da empresa.
        const string sqlEntradas = """
            SELECT CodItem AS CodItem, SUM(Quantidade) AS Qtd
            FROM DETENTRADAS WHERE CodEmpresa = ? GROUP BY CodItem
            """;
        foreach (var r in _leitor.Consultar(sqlEntradas, r => (
                     cod: Convert.ToInt32(r["CodItem"]), qtd: Dec(r["Qtd"])), codEmpresa))
            saldo[r.cod] = saldo.GetValueOrDefault(r.cod) + r.qtd;

        // Saidas: RMXEMPXEST ligada a OS com CONDPAGTO.GeraEstoque = Sim.
        // Devolucao VOLTA pro estoque (soma em vez de subtrair).
        var pagtosGeram = CodigosPagtoQueGeramEstoque(codEmpresa);
        if (pagtosGeram.Count > 0)
        {
            const string sqlSaidas = """
                SELECT x.CodItem AS CodItem, x.Quantidade AS Qtd,
                       x.Devolucao AS Dev, o.CodigoPagto AS CodigoPagto
                FROM RMXEMPXEST AS x INNER JOIN OS AS o ON x.Numos = o.NumOs
                WHERE x.CodEmpresa = ?
                  AND (o.Cancelada IS NULL OR o.Cancelada = 0)
                """;
            foreach (var r in _leitor.Consultar(sqlSaidas, r => (
                         cod: Convert.ToInt32(r["CodItem"]),
                         qtd: Dec(r["Qtd"]),
                         dev: Bool(r["Dev"]),
                         pagto: r["CodigoPagto"] is null or DBNull ? -1 : Convert.ToInt32(r["CodigoPagto"])),
                         codEmpresa))
            {
                if (!pagtosGeram.Contains(r.pagto)) continue;
                // saida normal subtrai; devolucao soma de volta.
                var delta = r.dev ? r.qtd : -r.qtd;
                saldo[r.cod] = saldo.GetValueOrDefault(r.cod) + delta;
            }
        }

        return saldo;
    }

    /// <summary>Conjunto de CodigoPagto cuja CONDPAGTO tem GeraEstoque = Sim (lido em C#).</summary>
    private HashSet<int> CodigosPagtoQueGeramEstoque(int codEmpresa)
    {
        const string sql = """
            SELECT CodigoPagto AS CodigoPagto, GeraEstoque AS Gera
            FROM CONDPAGTO WHERE CodEmpresa = ?
            """;
        var set = new HashSet<int>();
        foreach (var r in _leitor.Consultar(sql, r => (
                     cod: r["CodigoPagto"] is null or DBNull ? -1 : Convert.ToInt32(r["CodigoPagto"]),
                     gera: Bool(r["Gera"])), codEmpresa))
            if (r.gera && r.cod >= 0) set.Add(r.cod);
        return set;
    }

    private sealed record InfoItem(string Descricao, string CodigoFabricante, string CodigoInterno, string Referencia);

    /// <summary>Dados de exibicao (EST) de um conjunto de CodItem, em lote.</summary>
    private Dictionary<int, InfoItem> InfoItens(IEnumerable<int> cods)
    {
        var alvo = cods.ToHashSet();
        // Traz todos e filtra em memoria (evita IN dinamico no OLEDB).
        const string sql = """
            SELECT CodItem AS CodItem, Codinome AS Descricao,
                   CodigoFabricante AS Fab, CodigoInterno AS Interno, REFORIG AS Ref
            FROM EST
            """;
        var dict = new Dictionary<int, InfoItem>();
        foreach (var r in _leitor.Consultar(sql, r => (
                     cod: Convert.ToInt32(r["CodItem"]),
                     info: new InfoItem(Txt(r["Descricao"]), Txt(r["Fab"]), Txt(r["Interno"]), Txt(r["Ref"])))))
            if (alvo.Contains(r.cod)) dict[r.cod] = r.info;
        return dict;
    }

    private static string Txt(object? v) => v is null or DBNull ? "" : v.ToString()!.Trim();
    private static decimal Dec(object? v) => v is null or DBNull ? 0m : Convert.ToDecimal(v);

    /// <summary>Verdade tolerante: 'S'/'T'/'V'/'1'/'-1'/true = verdadeiro (campos texto S/N do SGA).</summary>
    private static bool Bool(object? v)
    {
        if (v is null or DBNull) return false;
        if (v is bool b) return b;
        if (v is string s)
        {
            s = s.Trim();
            return s.Length > 0 && (s[0] is 'S' or 's' or 'T' or 't' or '1' or 'V' or 'v' || s == "-1");
        }
        try { return Convert.ToDouble(v) != 0; } catch { return false; }
    }
}
