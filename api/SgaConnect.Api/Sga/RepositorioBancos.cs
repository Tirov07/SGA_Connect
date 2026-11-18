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
    public sealed record Lancamento(
        DateTime Data,
        string Descricao,
        string Nome,
        string Numero,
        string Observacao,
        decimal Valor,
        bool Entrada);

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

        // ENTRADAS (recebimentos): nome do CLIENTE (CLI.RazaoSocial), numero (NotaOsCupon), obs (Observacoes).
        var entradas = _leitor.Consultar($"""
            SELECT g.DataPagto AS D, g.ValorPago AS V, g.NotaOsCupon AS Num,
                   g.Observacoes AS Obs, cl.RazaoSocial AS Nome
            FROM PGCTREC AS g
            LEFT JOIN CLI AS cl ON g.CodigoCliente = cl.CodigoCliente
            WHERE g.CodEmpresa = ? AND g.Carteira IN ({inList})
              AND g.DataPagto >= ? AND g.DataPagto < ?
            """, r => new Lancamento(
                Convert.ToDateTime(r["D"]), "Recebimento",
                Txt(r["Nome"]), Txt(r["Num"]), Txt(r["Obs"]), Dec(r["V"]), true),
            codEmpresa, inicio, fimExclusivo);

        // SAIDAS (pagamentos): nome do FORNECEDOR (FOR.RazaoSocial), numero (NotaFiscal), obs (OBSERVACAO).
        var saidas = _leitor.Consultar($"""
            SELECT l.DataPagto AS D, l.ValorPago AS V, l.NotaFiscal AS Num,
                   l.OBSERVACAO AS Obs, f.RazaoSocial AS Nome
            FROM LIQCTPAG AS l
            LEFT JOIN [FOR] AS f ON l.CodigoFornecedor = f.CodigoFornecedor
            WHERE l.CodigoEmpresa = ? AND l.Carteira IN ({inList})
              AND l.DataPagto >= ? AND l.DataPagto < ?
            """, r => new Lancamento(
                Convert.ToDateTime(r["D"]), "Pagamento",
                Txt(r["Nome"]), Txt(r["Num"]), Txt(r["Obs"]), Dec(r["V"]), false),
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
        var porDia = new Dictionary<DateTime, decimal>();
        foreach (var l in Extrato(codEmpresa, new[] { numeroBanco }, inicio, fimExclusivo))
        {
            var dia = l.Data.Date;
            porDia.TryGetValue(dia, out var atual);
            porDia[dia] = atual + (l.Entrada ? l.Valor : -l.Valor);
        }

        // 3) Serie CONTINUA: um ponto por dia do periodo. Nos dias sem movimento, a linha
        //    permanece no mesmo saldo do dia anterior (patamar), ate ter novo movimento.
        var serie = new List<PontoSaldo>();
        var saldo = saldoBase;
        for (var dia = inicio.Date; dia < fimExclusivo.Date; dia = dia.AddDays(1))
        {
            if (porDia.TryGetValue(dia, out var mov)) saldo += mov;
            serie.Add(new PontoSaldo(dia, saldo));
        }
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
    private static string Txt(object? v) => v is null or DBNull ? "" : v.ToString()!.Trim();
}
