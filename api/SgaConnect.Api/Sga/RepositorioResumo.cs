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
    /// Total a RECEBER no mes corrente: titulos da CTREC em aberto com vencimento no mes.
    /// EmAberto no SGA e Sim/Nao -> no Access TRUE = -1 (por isso EmAberto &lt;&gt; 0).
    /// </summary>
    public decimal TotalAReceberMes(int codEmpresa)
    {
        var (inicio, fim) = MesCorrente();
        const string sql = """
            SELECT SUM(Valor) FROM CTREC
            WHERE CodEmpresa = ?
              AND EmAberto <> 0
              AND DataVencimento >= ? AND DataVencimento < ?
            """;
        return _leitor.EscalarDecimal(sql, codEmpresa, inicio, fim);
    }

    /// <summary>
    /// Total a PAGAR no mes corrente: titulos da CTPAG em aberto com vencimento no mes.
    /// Nomes proprios da CTPAG: empresa = CodigoEmpresa, vencimento = Vencimento.
    /// </summary>
    public decimal TotalAPagarMes(int codEmpresa)
    {
        var (inicio, fim) = MesCorrente();
        const string sql = """
            SELECT SUM(Valor) FROM CTPAG
            WHERE CodigoEmpresa = ?
              AND EmAberto <> 0
              AND Vencimento >= ? AND Vencimento < ?
            """;
        return _leitor.EscalarDecimal(sql, codEmpresa, inicio, fim);
    }

    private static (DateTime inicio, DateTime fim) MesCorrente()
    {
        var hoje = DateTime.Today;
        var inicio = new DateTime(hoje.Year, hoje.Month, 1);
        return (inicio, inicio.AddMonths(1));
    }
}
