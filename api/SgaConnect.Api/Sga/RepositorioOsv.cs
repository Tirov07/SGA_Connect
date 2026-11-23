using System.Runtime.Versioning;

namespace SgaConnect.Api.Sga;

/// <summary>
/// Tela OSv: listas de OS (abertas / fechadas nos ultimos dias), grafico de OSv abertas
/// por dia (com quebra entre COM LAUDO x SEM LAUDO) e resumo financeiro por data de
/// fechamento. SOMENTE LEITURA.
///
/// Nomes/regras confirmados pelo cliente:
///   - OS: NumOs, CodigoCliente, DataAbertura, DataFechamento, Cancelada, CodEmpresa,
///         PlacaVeiculo, CodigoPagto, EmitirLaudo.
///   - OS aberta    = DataFechamento IS NULL (e nao cancelada).
///   - OS fechada   = DataFechamento preenchida (filtra por periodo em DataFechamento).
///   - Operacao     = CONDPAGTO.Descricao, ligada por OS.CodigoPagto = CONDPAGTO.CodigoPagto.
///   - Com laudo    = OS.EmitirLaudo = True; sem laudo = False.
///   - Cliente      = CLI.RazaoSocial (join por CodigoCliente).
///   - SERVICO (valor) = SUM(ITENSSERVOSV.ValorMaoObra * Quantidade) por NumOs.
///   - PECA (valor)    = SUM(RMXEMPXEST.Quantidade * ValorUnit) via RQM:
///                       OS.NumOs = RQM.NumOs ; RQM.NumRequisicao = RMXEMPXEST.NumRequisicao
///                       (RMXEMPXEST tem CodEmpresa; RQM nao). Mesma logica do grafico da home.
///
/// Para nao repetir a subconsulta de peca/servico em cada query, o valor de peca e de
/// servico de um conjunto de OS e calculado em lote (um SELECT com GROUP BY NumOs) e
/// depois casado em memoria com as OS. Isso evita subconsulta correlacionada por linha,
/// que e lenta no Access em banco grande.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class RepositorioOsv
{
    private readonly LeitorSga _leitor;

    public RepositorioOsv(LeitorSga leitor) => _leitor = leitor;

    /// <summary>Uma OS na lista (aberta ou fechada).</summary>
    public sealed record OsItem(
        int NumOs,
        string Cliente,
        string Placa,
        string Operacao,
        bool ComLaudo,
        DateTime? Abertura,
        DateTime? Fechamento,
        decimal Peca,
        decimal Servico)
    {
        public decimal Total => Peca + Servico;
    }

    /// <summary>Um dia do grafico de OSv abertas: total do dia + quebra com/sem laudo.</summary>
    public sealed record AberturaDia(DateTime Data, int ComLaudo, int SemLaudo)
    {
        public int Total => ComLaudo + SemLaudo;
    }

    /// <summary>Uma linha do resumo financeiro (por data de fechamento).</summary>
    public sealed record ResumoLinha(
        int NumOs,
        string Cliente,
        string NotaPeca,
        string NotaServico,
        DateTime? Fechamento,
        decimal Peca,
        decimal Servico)
    {
        public decimal Total => Peca + Servico;
    }

    // ---------------- Parte 1: listas de OS ----------------

    /// <summary>OS em aberto (sem fechamento, nao canceladas).</summary>
    public List<OsItem> Abertas(int codEmpresa)
    {
        const string sql = """
            SELECT o.NumOs AS NumOs, o.PlacaVeiculo AS Placa, o.EmitirLaudo AS Laudo,
                   o.DataAbertura AS Abertura, o.DataFechamento AS Fechamento,
                   cl.RazaoSocial AS Cliente, cp.Descricao AS Operacao
            FROM ((OS AS o
                  LEFT JOIN CLI AS cl ON o.CodigoCliente = cl.CodigoCliente)
                  LEFT JOIN CONDPAGTO AS cp ON o.CodigoPagto = cp.CodigoPagto)
            WHERE o.CodEmpresa = ?
              AND o.DataFechamento IS NULL
              AND (o.Cancelada IS NULL OR o.Cancelada = 0)
            """;
        return MontarLista(sql, codEmpresa);
    }

    /// <summary>OS fechadas nos ultimos N dias (por DataFechamento), nao canceladas.</summary>
    public List<OsItem> FechadasUltimosDias(int codEmpresa, int dias)
    {
        var inicio = DateTime.Today.AddDays(-dias);
        var fim = DateTime.Today.AddDays(1);
        const string sql = """
            SELECT o.NumOs AS NumOs, o.PlacaVeiculo AS Placa, o.EmitirLaudo AS Laudo,
                   o.DataAbertura AS Abertura, o.DataFechamento AS Fechamento,
                   cl.RazaoSocial AS Cliente, cp.Descricao AS Operacao
            FROM ((OS AS o
                  LEFT JOIN CLI AS cl ON o.CodigoCliente = cl.CodigoCliente)
                  LEFT JOIN CONDPAGTO AS cp ON o.CodigoPagto = cp.CodigoPagto)
            WHERE o.CodEmpresa = ?
              AND o.DataFechamento IS NOT NULL
              AND o.DataFechamento >= ? AND o.DataFechamento < ?
              AND (o.Cancelada IS NULL OR o.Cancelada = 0)
            """;
        return MontarLista(sql, codEmpresa, inicio, fim);
    }

    private List<OsItem> MontarLista(string sql, params object?[] parametros)
    {
        // Linha base da OS (sem valores ainda).
        var brutas = _leitor.Consultar(sql, r => new
        {
            NumOs = Convert.ToInt32(r["NumOs"]),
            Placa = Txt(r["Placa"]),
            Cliente = Txt(r["Cliente"]),
            Operacao = Txt(r["Operacao"]),
            Laudo = Bool(r["Laudo"]),
            Abertura = Data(r["Abertura"]),
            Fechamento = Data(r["Fechamento"])
        }, parametros);

        if (brutas.Count == 0) return new List<OsItem>();

        var codEmpresa = Convert.ToInt32(parametros[0]);
        var pecas = PecaPorOs(codEmpresa);
        var servicos = ServicoPorOs(codEmpresa);

        return brutas
            .Select(b => new OsItem(
                NumOs: b.NumOs,
                Cliente: b.Cliente,
                Placa: b.Placa,
                Operacao: b.Operacao,
                ComLaudo: b.Laudo,
                Abertura: b.Abertura,
                Fechamento: b.Fechamento,
                Peca: pecas.GetValueOrDefault(b.NumOs),
                Servico: servicos.GetValueOrDefault(b.NumOs)))
            .OrderByDescending(o => o.NumOs)
            .ToList();
    }

    // ---------------- Parte 2: grafico de OSv abertas por dia ----------------

    /// <summary>
    /// Para os ultimos N dias COM movimento de ABERTURA, conta quantas OSv foram abertas
    /// naquele dia, separando COM LAUDO (EmitirLaudo=True) de SEM LAUDO. A "abertura" usa
    /// DataAbertura. Devolve em ordem cronologica.
    /// </summary>
    public List<AberturaDia> AberturasPorDia(int codEmpresa, int n)
    {
        var inicio = DateTime.Today.AddYears(-1);
        var fim = DateTime.Today.AddDays(1);
        // EmitirLaudo no SGA e TEXTO ('S'/'N'), nao booleano: nao da para usar IIF() no SQL
        // (qualquer string nao-vazia e "verdade" no Access). Agrupamos por dia + valor cru
        // do campo e classificamos com/sem laudo em C# via Bool().
        const string sql = """
            SELECT DateValue(o.DataAbertura) AS D,
                   o.EmitirLaudo AS Laudo,
                   COUNT(*) AS Qtd
            FROM OS AS o
            WHERE o.CodEmpresa = ?
              AND o.DataAbertura IS NOT NULL
              AND o.DataAbertura >= ? AND o.DataAbertura < ?
              AND (o.Cancelada IS NULL OR o.Cancelada = 0)
            GROUP BY DateValue(o.DataAbertura), o.EmitirLaudo
            """;

        var porData = new Dictionary<DateTime, (int com, int sem)>();
        foreach (var r in _leitor.Consultar(sql, r => (
                     data: Convert.ToDateTime(r["D"]).Date,
                     laudo: Bool(r["Laudo"]),
                     qtd: Convert.ToInt32(r["Qtd"])), codEmpresa, inicio, fim))
        {
            var a = porData.GetValueOrDefault(r.data);
            porData[r.data] = r.laudo ? (a.com + r.qtd, a.sem) : (a.com, a.sem + r.qtd);
        }

        return porData
            .OrderByDescending(kv => kv.Key)
            .Take(n)
            .OrderBy(kv => kv.Key)
            .Select(kv => new AberturaDia(kv.Key, kv.Value.com, kv.Value.sem))
            .ToList();
    }

    // ---------------- Parte 3: resumo financeiro por fechamento ----------------

    /// <summary>
    /// OS fechadas no periodo (por DataFechamento) com: numero da OS, cliente, numero da
    /// nota de peca e de servico (ultima de cada tipo, se houver), valor de peca e de
    /// servico (mesma regra das outras telas). <paramref name="porMes"/> apenas define o
    /// periodo (mes inteiro) vs. um unico dia; a granularidade de exibicao e do app.
    /// </summary>
    public List<ResumoLinha> ResumoPorFechamento(int codEmpresa, DateTime inicio, DateTime fim)
    {
        const string sql = """
            SELECT o.NumOs AS NumOs, o.DataFechamento AS Fechamento, cl.RazaoSocial AS Cliente
            FROM OS AS o
            LEFT JOIN CLI AS cl ON o.CodigoCliente = cl.CodigoCliente
            WHERE o.CodEmpresa = ?
              AND o.DataFechamento IS NOT NULL
              AND o.DataFechamento >= ? AND o.DataFechamento < ?
              AND (o.Cancelada IS NULL OR o.Cancelada = 0)
            """;
        var brutas = _leitor.Consultar(sql, r => new
        {
            NumOs = Convert.ToInt32(r["NumOs"]),
            Fechamento = Data(r["Fechamento"]),
            Cliente = Txt(r["Cliente"])
        }, codEmpresa, inicio, fim);

        if (brutas.Count == 0) return new List<ResumoLinha>();

        var pecas = PecaPorOs(codEmpresa);
        var servicos = ServicoPorOs(codEmpresa);
        var notasPeca = NotaPorOs(codEmpresa, servico: false);
        var notasServico = NotaPorOs(codEmpresa, servico: true);

        return brutas
            .Select(b => new ResumoLinha(
                NumOs: b.NumOs,
                Cliente: b.Cliente,
                NotaPeca: notasPeca.GetValueOrDefault(b.NumOs, ""),
                NotaServico: notasServico.GetValueOrDefault(b.NumOs, ""),
                Fechamento: b.Fechamento,
                Peca: pecas.GetValueOrDefault(b.NumOs),
                Servico: servicos.GetValueOrDefault(b.NumOs)))
            .OrderByDescending(l => l.Fechamento)
            .ThenByDescending(l => l.NumOs)
            .ToList();
    }

    // ---------------- Valores (peca / servico) por OS ----------------

    /// <summary>SUM(ValorMaoObra * Quantidade) por NumOs (servico), em lote.</summary>
    private Dictionary<int, decimal> ServicoPorOs(int codEmpresa)
    {
        // ITENSSERVOSV nao tem CodEmpresa proprio garantido; filtramos pela OS da empresa
        // via INNER JOIN com OS (que tem CodEmpresa).
        const string sql = """
            SELECT i.NumOs AS NumOs, SUM(i.ValorMaoObra * i.Quantidade) AS Total
            FROM OS AS o INNER JOIN ITENSSERVOSV AS i ON o.NumOs = i.NumOs
            WHERE o.CodEmpresa = ?
            GROUP BY i.NumOs
            """;
        return _leitor.Consultar(sql, r => (
            num: Convert.ToInt32(r["NumOs"]), total: Dec(r["Total"])), codEmpresa)
            .ToDictionary(x => x.num, x => x.total);
    }

    /// <summary>SUM(Quantidade * ValorUnit) por NumOs (peca), via RQM -> RMXEMPXEST, em lote.</summary>
    private Dictionary<int, decimal> PecaPorOs(int codEmpresa)
    {
        const string sql = """
            SELECT q.NumOs AS NumOs, SUM(x.Quantidade * x.ValorUnit) AS Total
            FROM (RQM AS q INNER JOIN RMXEMPXEST AS x ON q.NumRequisicao = x.NumRequisicao)
            WHERE x.CodEmpresa = ?
            GROUP BY q.NumOs
            """;
        return _leitor.Consultar(sql, r => (
            num: Convert.ToInt32(r["NumOs"]), total: Dec(r["Total"])), codEmpresa)
            .ToDictionary(x => x.num, x => x.total);
    }

    // ---------------- Nota fiscal por OS (Parte 3) ----------------

    /// <summary>
    /// Para cada OS, o NroNotaFiscal da ULTIMA nota (maior NroSeq) de peca ou de servico.
    /// Caminho: ITENS(EST|SERV)NOTAFISCAL(NumOs, NroSeq) -> NOTAFISCAL(NroSeq) -> NroNotaFiscal.
    /// </summary>
    private Dictionary<int, string> NotaPorOs(int codEmpresa, bool servico)
    {
        var tabelaItens = servico ? "ITENSSERVNOTAFISCAL" : "ITENSESTNOTAFISCAL";
        // Para cada NumOs, pega a nota de maior NroSeq (a "ultima"). Trazemos NumOs, NroSeq e
        // NroNotaFiscal e resolvemos a "ultima por OS" em memoria.
        var sql = $"""
            SELECT it.NumOs AS NumOs, nf.NroSeq AS NroSeq, nf.NroNotaFiscal AS Nota
            FROM {tabelaItens} AS it INNER JOIN NOTAFISCAL AS nf ON it.NroSeq = nf.NroSeq
            WHERE nf.CodEmpresa = ?
            """;

        var linhas = _leitor.Consultar(sql, r => (
            num: Convert.ToInt32(r["NumOs"]),
            seq: r["NroSeq"] is null or DBNull ? 0L : Convert.ToInt64(r["NroSeq"]),
            nota: Txt(r["Nota"])), codEmpresa);

        // Ultima nota por OS = a de maior NroSeq.
        return linhas
            .Where(l => l.num > 0)
            .GroupBy(l => l.num)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(l => l.seq).First().nota);
    }

    private static string Txt(object? v) => v is null or DBNull ? "" : v.ToString()!.Trim();
    private static decimal Dec(object? v) => v is null or DBNull ? 0m : Convert.ToDecimal(v);
    private static DateTime? Data(object? v) => v is null or DBNull ? null : Convert.ToDateTime(v);

    /// <summary>
    /// Interpreta "verdade" tolerando os formatos que o SGA usa no mesmo campo:
    ///  - texto 'S'/'N' (Sim/Nao) ou 'T'/'F' (True/False) — o caso do OS.EmitirLaudo;
    ///  - booleano real (True/False);
    ///  - numero (-1/0 do Access, ou 1/0).
    /// </summary>
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
