using System.Runtime.Versioning;

namespace SgaConnect.Api.Sga;

/// <summary>
/// Consultas do resumo (home do app) no DADOSTAB de uma empresa, SOMENTE LEITURA.
/// Todas filtram por empresa (multi-empresa no mesmo banco) via parametro.
///
/// ATENCAO aos nomes de coluna, que diferem entre as tabelas:
///   - CTREC  (a receber): empresa = CodEmpresa    ; vencimento = DataVencimento
///   - CTPAG  (a pagar)   : empresa = CodigoEmpresa ; vencimento = Vencimento
///
/// Regras confirmadas pelo cliente:
///   - OS aberta = DataFechamento vazia; fechada = DataFechamento preenchida.
///   - Ignorar OS canceladas nas contagens.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class RepositorioResumo
{
    private readonly LeitorSga _leitor;

    public RepositorioResumo(LeitorSga leitor) => _leitor = leitor;

    /// <summary>OS em aberto = sem DataFechamento e nao cancelada.</summary>
    public int OrdensServicoAbertas(int codEmpresa)
    {
        const string sql = """
            SELECT COUNT(*) FROM OS
            WHERE CodEmpresa = ?
              AND DataFechamento IS NULL
              AND (Cancelada IS NULL OR Cancelada = 0)
            """;
        return _leitor.EscalarInt(sql, codEmpresa);
    }

    /// <summary>OS fechadas nos ultimos N dias (default 7), pela DataFechamento.</summary>
    public int OrdensServicoFechadasUltimosDias(int codEmpresa, int dias = 7)
    {
        var limite = DateTime.Today.AddDays(-dias);
        const string sql = """
            SELECT COUNT(*) FROM OS
            WHERE CodEmpresa = ?
              AND DataFechamento IS NOT NULL
              AND DataFechamento >= ?
              AND (Cancelada IS NULL OR Cancelada = 0)
            """;
        return _leitor.EscalarInt(sql, codEmpresa, limite);
    }

    /// <summary>
    /// Total a RECEBER no mes corrente, mesma logica do a pagar: para cada titulo da CTREC
    /// com vencimento no mes, saldo = Valor - (soma de ValorPago na PGCTREC do titulo).
    /// A PGCTREC liga pela coluna NroConta_CTREC = CTREC.NroConta (vinculo direto).
    /// </summary>
    public decimal TotalAReceberMes(int codEmpresa)
    {
        var (inicio, fim) = MesCorrente();
        const string sql = """
            SELECT SUM(saldo) FROM (
                SELECT r.Valor - (
                    SELECT IIF(IsNull(SUM(g.ValorPago)), 0, SUM(g.ValorPago))
                    FROM PGCTREC AS g
                    WHERE g.NroConta_CTREC = r.NroConta
                ) AS saldo
                FROM CTREC AS r
                WHERE r.CodEmpresa = ?
                  AND r.DataVencimento >= ? AND r.DataVencimento < ?
            ) AS t
            WHERE saldo > 0
            """;
        return _leitor.EscalarDecimal(sql, codEmpresa, inicio, fim);
    }

    /// <summary>
    /// Total a PAGAR no mes corrente, igual ao SGA: para cada titulo da CTPAG com
    /// vencimento no mes, o saldo = Valor - (soma de ValorPago na LIQCTPAG do mesmo titulo).
    /// Soma so os saldos positivos (titulos ainda em aberto, inclusive parciais).
    ///
    /// Chave do titulo CTPAG x LIQCTPAG (confirmada pelo cliente):
    ///   NotaFiscal + CodigoFornecedor + CodigoEmpresa + Vencimento.
    ///   Atencao: na LIQCTPAG o vencimento chama DataVencimento (na CTPAG, Vencimento).
    /// </summary>
    public decimal TotalAPagarMes(int codEmpresa)
    {
        var (inicio, fim) = MesCorrente();
        // Subconsulta correlacionada soma os pagamentos (parciais) de cada titulo.
        // O saldo por titulo e Valor - pago; somamos so onde o saldo e > 0.
        const string sql = """
            SELECT SUM(saldo) FROM (
                SELECT p.Valor - (
                    SELECT IIF(IsNull(SUM(l.ValorPago)), 0, SUM(l.ValorPago))
                    FROM LIQCTPAG AS l
                    WHERE l.NotaFiscal = p.NotaFiscal
                      AND l.CodigoFornecedor = p.CodigoFornecedor
                      AND l.CodigoEmpresa = p.CodigoEmpresa
                      AND l.DataVencimento = p.Vencimento
                ) AS saldo
                FROM CTPAG AS p
                WHERE p.CodigoEmpresa = ?
                  AND p.Vencimento >= ? AND p.Vencimento < ?
            ) AS t
            WHERE saldo > 0
            """;
        return _leitor.EscalarDecimal(sql, codEmpresa, inicio, fim);
    }

    /// <summary>
    /// Diagnostico TEMPORARIO da CTPAG: ajuda a calibrar o criterio de "a pagar do mes".
    /// Mostra, para a empresa, no mes corrente, varias somas/contagens para comparar com o SGA.
    /// </summary>
    public object DiagnosticoContasPagar(int codEmpresa)
    {
        var (inicio, fim) = MesCorrente();

        int QtdTodos = _leitor.EscalarInt(
            "SELECT COUNT(*) FROM CTPAG WHERE CodigoEmpresa = ? AND Vencimento >= ? AND Vencimento < ?",
            codEmpresa, inicio, fim);

        int QtdEmAbertoNaoZero = _leitor.EscalarInt(
            "SELECT COUNT(*) FROM CTPAG WHERE CodigoEmpresa = ? AND EmAberto <> 0 AND Vencimento >= ? AND Vencimento < ?",
            codEmpresa, inicio, fim);

        int QtdEmAbertoMenos1 = _leitor.EscalarInt(
            "SELECT COUNT(*) FROM CTPAG WHERE CodigoEmpresa = ? AND EmAberto = -1 AND Vencimento >= ? AND Vencimento < ?",
            codEmpresa, inicio, fim);

        int QtdEmAberto1 = _leitor.EscalarInt(
            "SELECT COUNT(*) FROM CTPAG WHERE CodigoEmpresa = ? AND EmAberto = 1 AND Vencimento >= ? AND Vencimento < ?",
            codEmpresa, inicio, fim);

        decimal SomaValorTodos = _leitor.EscalarDecimal(
            "SELECT SUM(Valor) FROM CTPAG WHERE CodigoEmpresa = ? AND Vencimento >= ? AND Vencimento < ?",
            codEmpresa, inicio, fim);

        decimal SomaValorEmAbertoNaoZero = _leitor.EscalarDecimal(
            "SELECT SUM(Valor) FROM CTPAG WHERE CodigoEmpresa = ? AND EmAberto <> 0 AND Vencimento >= ? AND Vencimento < ?",
            codEmpresa, inicio, fim);

        decimal SomaValorEmAbertoMenos1 = _leitor.EscalarDecimal(
            "SELECT SUM(Valor) FROM CTPAG WHERE CodigoEmpresa = ? AND EmAberto = -1 AND Vencimento >= ? AND Vencimento < ?",
            codEmpresa, inicio, fim);

        decimal SomaSaldoEmAbertoNaoZero = _leitor.EscalarDecimal(
            "SELECT SUM(Valor - IIF(IsNull(TotalPago),0,TotalPago)) FROM CTPAG WHERE CodigoEmpresa = ? AND EmAberto <> 0 AND Vencimento >= ? AND Vencimento < ?",
            codEmpresa, inicio, fim);

        decimal SomaSaldoTodos = _leitor.EscalarDecimal(
            "SELECT SUM(Valor - IIF(IsNull(TotalPago),0,TotalPago)) FROM CTPAG WHERE CodigoEmpresa = ? AND Vencimento >= ? AND Vencimento < ?",
            codEmpresa, inicio, fim);

        return new
        {
            mesInicio = inicio,
            mesFim = fim,
            contagens = new { QtdTodos, QtdEmAbertoNaoZero, QtdEmAbertoMenos1, QtdEmAberto1 },
            somas_Valor = new { SomaValorTodos, SomaValorEmAbertoNaoZero, SomaValorEmAbertoMenos1 },
            somas_Saldo_ValorMenosTotalPago = new { SomaSaldoEmAbertoNaoZero, SomaSaldoTodos }
        };
    }

    private static (DateTime inicio, DateTime fim) MesCorrente()
    {
        var hoje = DateTime.Today;
        var inicio = new DateTime(hoje.Year, hoje.Month, 1);
        return (inicio, inicio.AddMonths(1));
    }
}
