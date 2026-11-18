using System.Runtime.Versioning;

namespace SgaConnect.Api.Sga;

/// <summary>
/// Bancos e movimentacao bancaria (Bloco B do Financeiro). SOMENTE LEITURA.
///
/// Ligacao confirmada pelo cliente:
///   - BCO: cadastro dos bancos (CodigoBanco, RazaoSocial, NumeroBanco, CodEmpresa, Inativo).
///   - ENTRADAS: PGCTREC  (recebimentos)  -> PGCTREC.Carteira = BCO.NumeroBanco
///   - SAIDAS:   LIQCTPAG (pagamentos)    -> LIQCTPAG.Carteira = BCO.NumeroBanco
///   - Valor = ValorPago; data = DataPagto.
///   - Empresa: PGCTREC.CodEmpresa / LIQCTPAG.CodigoEmpresa.
///
/// Saldo NAO e salvo no SGA: e calculado por (entradas - saidas) acumuladas.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class RepositorioBancos
{
    private readonly LeitorSga _leitor;

    public RepositorioBancos(LeitorSga leitor) => _leitor = leitor;

    public sealed record Banco(int NumeroBanco, string Nome);

    /// <summary>Um lancamento do extrato (entrada ou saida).</summary>
    public sealed record Lancamento(DateTime Data, string Descricao, decimal Valor, bool Entrada);

    /// <summary>Um ponto da serie de saldo (saldo acumulado ao fim do dia).</summary>
    public sealed record PontoSaldo(DateTime Data, decimal Saldo);

    /// <summary>Bancos ATIVOS da empresa (para o seletor).</summary>
    public List<Banco> Listar(int codEmpresa)
    {
        const string sql = """
            SELECT NumeroBanco, RazaoSocial
            FROM BCO
            WHERE CodEmpresa = ? AND (Inativo IS NULL OR Inativo = 0) AND NumeroBanco IS NOT NULL
            ORDER BY RazaoSocial
            """;
        return _leitor.Consultar(sql, r => new Banco(
            NumeroBanco: Convert.ToInt32(r["NumeroBanco"]),
            Nome: r["RazaoSocial"]?.ToString()?.Trim() ?? ""
        ), codEmpresa);
    }

    /// <summary>
    /// Extrato consolidado de um ou mais bancos num periodo [inicio, fim]:
    /// entradas (PGCTREC) + saidas (LIQCTPAG), ordenado por data.
    /// </summary>
    public List<Lancamento> Extrato(int codEmpresa, IReadOnlyList<int> numerosBanco, DateTime inicio, DateTime fimExclusivo)
    {
        if (numerosBanco.Count == 0) return new();
        var inList = string.Join(",", numerosBanco); // numeros inteiros, seguro (sem texto do usuario)

        var entradas = _leitor.Consultar($"""
            SELECT DataPagto AS D, ValorPago AS V
            FROM PGCTREC
            WHERE CodEmpresa = ? AND Carteira IN ({inList})
              AND DataPagto >= ? AND DataPagto < ?
            """, r => new Lancamento(Convert.ToDateTime(r["D"]), "Recebimento", Dec(r["V"]), true),
            codEmpresa, inicio, fimExclusivo);

        var saidas = _leitor.Consultar($"""
            SELECT DataPagto AS D, ValorPago AS V
            FROM LIQCTPAG
            WHERE CodigoEmpresa = ? AND Carteira IN ({inList})
              AND DataPagto >= ? AND DataPagto < ?
            """, r => new Lancamento(Convert.ToDateTime(r["D"]), "Pagamento", Dec(r["V"]), false),
            codEmpresa, inicio, fimExclusivo);

        return entradas.Concat(saidas).OrderBy(l => l.Data).ToList();
    }

    /// <summary>
    /// Saldo acumulado de UM banco por dia, no periodo [inicio, fim].
    /// O ponto de partida inclui TODO o historico anterior a 'inicio' (saldo real),
    /// depois evolui dia a dia com entradas - saidas.
    /// </summary>
    public List<PontoSaldo> SerieSaldo(int codEmpresa, int numeroBanco, DateTime inicio, DateTime fimExclusivo)
    {
        // 1) Saldo acumulado ate ANTES do inicio (toda a historia previa).
        decimal saldoBase =
            SomaEntradasAte(codEmpresa, numeroBanco, inicio) - SomaSaidasAte(codEmpresa, numeroBanco, inicio);

        // 2) Movimento liquido por dia DENTRO do periodo.
        var porDia = new SortedDictionary<DateTime, decimal>();
        foreach (var l in Extrato(codEmpresa, new[] { numeroBanco }, inicio, fimExclusivo))
        {
            var dia = l.Data.Date;
            porDia.TryGetValue(dia, out var atual);
            porDia[dia] = atual + (l.Entrada ? l.Valor : -l.Valor);
        }

        // 3) Serie: saldo do fim de cada dia que teve movimento.
        var serie = new List<PontoSaldo>();
        var saldo = saldoBase;
        foreach (var kv in porDia)
        {
            saldo += kv.Value;
            serie.Add(new PontoSaldo(kv.Key, saldo));
        }

        // Se nao houve movimento no periodo, devolve ao menos o saldo base no inicio.
        if (serie.Count == 0)
            serie.Add(new PontoSaldo(inicio.Date, saldoBase));

        return serie;
    }

    private decimal SomaEntradasAte(int codEmpresa, int numeroBanco, DateTime limite) =>
        _leitor.EscalarDecimal(
            "SELECT SUM(ValorPago) FROM PGCTREC WHERE CodEmpresa = ? AND Carteira = ? AND DataPagto < ?",
            codEmpresa, numeroBanco, limite);

    private decimal SomaSaidasAte(int codEmpresa, int numeroBanco, DateTime limite) =>
        _leitor.EscalarDecimal(
            "SELECT SUM(ValorPago) FROM LIQCTPAG WHERE CodigoEmpresa = ? AND Carteira = ? AND DataPagto < ?",
            codEmpresa, numeroBanco, limite);

    private static decimal Dec(object? v) => v is null or DBNull ? 0m : Convert.ToDecimal(v);
}
