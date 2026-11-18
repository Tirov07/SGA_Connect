using System.Runtime.Versioning;

namespace SgaConnect.Api.Sga;

/// <summary>
/// Financeiro (Bloco A): titulos a RECEBER (CTREC/PGCTREC) e a PAGAR (CTPAG/LIQCTPAG),
/// com o saldo em aberto (Valor - pago). SOMENTE LEITURA.
///
/// Nomes confirmados pelo cliente:
///   CTREC: NroConta, NotaOsCupon, CodigoCliente, DataVencimento, Valor, Observacoes, CodEmpresa
///          pago = SUM(PGCTREC.ValorPago) por PGCTREC.NroConta_CTREC = CTREC.NroConta
///   CTPAG: NotaFiscal, CodigoFornecedor, Vencimento, Valor, Observacao, CodigoEmpresa
///          pago = SUM(LIQCTPAG.ValorPago) por (NotaFiscal+CodigoFornecedor+CodigoEmpresa+DataVencimento)
///   Nome do cliente: CLI.RazaoSocial (join por CodigoCliente)
///   Nome do fornecedor: FOR.RazaoSocial (join por CodigoFornecedor)
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class RepositorioFinanceiro
{
    private readonly LeitorSga _leitor;

    public RepositorioFinanceiro(LeitorSga leitor) => _leitor = leitor;

    /// <summary>Um titulo em aberto (a receber ou a pagar).</summary>
    public sealed record Titulo(
        string Nome,
        string Numero,
        DateTime? Vencimento,
        decimal Saldo,
        string Observacao);

    /// <summary>Resumo de vencidos (em aberto com vencimento anterior a hoje).</summary>
    public sealed record ResumoVencidos(
        int QtdReceber, decimal TotalReceber,
        int QtdPagar, decimal TotalPagar);

    // ---------- A RECEBER (CTREC) ----------

    /// <summary>Titulos a receber em aberto (saldo &gt; 0) com vencimento no mes informado.</summary>
    public List<Titulo> ReceberEmAbertoDoMes(int codEmpresa, int ano, int mes)
    {
        var inicio = new DateTime(ano, mes, 1);
        var fim = inicio.AddMonths(1);
        return ReceberEmAberto(codEmpresa, inicio, fim);
    }

    private List<Titulo> ReceberEmAberto(int codEmpresa, DateTime inicio, DateTime fim)
    {
        const string sql = """
            SELECT c.NotaOsCupon AS Numero,
                   c.DataVencimento AS Venc,
                   c.Valor - IIF(IsNull((SELECT SUM(g.ValorPago) FROM PGCTREC g WHERE g.NroConta_CTREC = c.NroConta)),0,
                                 (SELECT SUM(g.ValorPago) FROM PGCTREC g WHERE g.NroConta_CTREC = c.NroConta)) AS Saldo,
                   c.Observacoes AS Obs,
                   cl.RazaoSocial AS Nome
            FROM CTREC AS c
            LEFT JOIN CLI AS cl ON c.CodigoCliente = cl.CodigoCliente
            WHERE c.CodEmpresa = ?
              AND c.DataVencimento >= ? AND c.DataVencimento < ?
            """;
        var itens = _leitor.Consultar(sql, r => new Titulo(
            Nome: Txt(r["Nome"]),
            Numero: Txt(r["Numero"]),
            Vencimento: Data(r["Venc"]),
            Saldo: Dec(r["Saldo"]),
            Observacao: Txt(r["Obs"])
        ), codEmpresa, inicio, fim);
        return itens.Where(t => t.Saldo > 0).OrderBy(t => t.Vencimento).ToList();
    }

    // ---------- A PAGAR (CTPAG) ----------

    public List<Titulo> PagarEmAbertoDoMes(int codEmpresa, int ano, int mes)
    {
        var inicio = new DateTime(ano, mes, 1);
        var fim = inicio.AddMonths(1);
        return PagarEmAberto(codEmpresa, inicio, fim);
    }

    private List<Titulo> PagarEmAberto(int codEmpresa, DateTime inicio, DateTime fim)
    {
        const string sql = """
            SELECT p.NotaFiscal AS Numero,
                   p.Vencimento AS Venc,
                   p.Valor - IIF(IsNull((SELECT SUM(l.ValorPago) FROM LIQCTPAG l
                                         WHERE l.NotaFiscal = p.NotaFiscal AND l.CodigoFornecedor = p.CodigoFornecedor
                                           AND l.CodigoEmpresa = p.CodigoEmpresa AND l.DataVencimento = p.Vencimento)),0,
                                 (SELECT SUM(l.ValorPago) FROM LIQCTPAG l
                                  WHERE l.NotaFiscal = p.NotaFiscal AND l.CodigoFornecedor = p.CodigoFornecedor
                                    AND l.CodigoEmpresa = p.CodigoEmpresa AND l.DataVencimento = p.Vencimento)) AS Saldo,
                   p.Observacao AS Obs,
                   f.RazaoSocial AS Nome
            FROM CTPAG AS p
            LEFT JOIN [FOR] AS f ON p.CodigoFornecedor = f.CodigoFornecedor
            WHERE p.CodigoEmpresa = ?
              AND p.Vencimento >= ? AND p.Vencimento < ?
            """;
        var itens = _leitor.Consultar(sql, r => new Titulo(
            Nome: Txt(r["Nome"]),
            Numero: Txt(r["Numero"]),
            Vencimento: Data(r["Venc"]),
            Saldo: Dec(r["Saldo"]),
            Observacao: Txt(r["Obs"])
        ), codEmpresa, inicio, fim);
        return itens.Where(t => t.Saldo > 0).OrderBy(t => t.Vencimento).ToList();
    }

    // ---------- VENCIDOS ----------

    /// <summary>
    /// Vencidos = em aberto (saldo &gt; 0) com vencimento anterior a hoje.
    /// Usa agregacao por GRUPO (LEFT JOIN + GROUP BY), que no Access e MUITO mais rapido
    /// que subconsulta correlacionada por linha (importante em banco grande).
    /// </summary>
    public ResumoVencidos Vencidos(int codEmpresa, int meses = 12)
    {
        var hoje = DateTime.Today;
        // Janela: vencidos nos ultimos N meses (vencimento entre [hoje-N meses, hoje)).
        var desde = hoje.AddMonths(-meses);

        // A RECEBER vencido: por titulo (NroConta), Valor - SUM(pago) via LEFT JOIN PGCTREC.
        const string sqlReceber = """
            SELECT c.Valor - IIF(IsNull(SUM(g.ValorPago)),0,SUM(g.ValorPago)) AS Saldo
            FROM CTREC AS c
            LEFT JOIN PGCTREC AS g ON g.NroConta_CTREC = c.NroConta
            WHERE c.CodEmpresa = ? AND c.DataVencimento >= ? AND c.DataVencimento < ?
            GROUP BY c.NroConta, c.Valor
            """;
        var receber = _leitor.Consultar(sqlReceber, r => Dec(r["Saldo"]), codEmpresa, desde, hoje)
            .Where(s => s > 0).ToList();

        // A PAGAR vencido: por titulo (chave composta), Valor - SUM(pago) via LEFT JOIN LIQCTPAG.
        const string sqlPagar = """
            SELECT p.Valor - IIF(IsNull(SUM(l.ValorPago)),0,SUM(l.ValorPago)) AS Saldo
            FROM CTPAG AS p
            LEFT JOIN LIQCTPAG AS l
              ON l.NotaFiscal = p.NotaFiscal AND l.CodigoFornecedor = p.CodigoFornecedor
             AND l.CodigoEmpresa = p.CodigoEmpresa AND l.DataVencimento = p.Vencimento
            WHERE p.CodigoEmpresa = ? AND p.Vencimento >= ? AND p.Vencimento < ?
            GROUP BY p.NotaFiscal, p.CodigoFornecedor, p.CodigoEmpresa, p.Vencimento, p.Valor
            """;
        var pagar = _leitor.Consultar(sqlPagar, r => Dec(r["Saldo"]), codEmpresa, desde, hoje)
            .Where(s => s > 0).ToList();

        return new ResumoVencidos(
            QtdReceber: receber.Count,
            TotalReceber: receber.Sum(),
            QtdPagar: pagar.Count,
            TotalPagar: pagar.Sum());
    }

    private static string Txt(object? v) => v is null or DBNull ? "" : v.ToString()!.Trim();
    private static decimal Dec(object? v) => v is null or DBNull ? 0m : Convert.ToDecimal(v);
    private static DateTime? Data(object? v) => v is null or DBNull ? null : Convert.ToDateTime(v);
}
