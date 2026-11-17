using System.Runtime.Versioning;

namespace SgaConnect.Api.Sga;

/// <summary>
/// Vendas diarias (para o grafico da home): por dia do mes, o faturamento das OSv
/// FECHADAS naquele dia, separado em Peca e Servico. SOMENTE LEITURA.
///
/// Fonte confirmada pelo cliente:
///   - OSv fechada: tabela OS, data = DataFechamento, chave da OSv = NumOs, filtra CodEmpresa.
///   - SERVICO: ITENSSERVOSV ligada por NumOs -> SUM(ValorMaoObra * Quantidade).
///   - PECA (cadeia de 3 tabelas):
///       OS.NumOs = RQM.NumOs  (RQM nao tem CodEmpresa)
///       RQM.NumRequisicao = RMXEMPXEST.NumRequisicao
///       SUM(RMXEMPXEST.Quantidade * RMXEMPXEST.ValorUnit), filtra CodEmpresa em RMXEMPXEST.
/// OBS: RMXEMPXEST tambem tem um campo Numos proprio (caminho direto possivel), mas
/// seguimos o caminho via RQM que o cliente validou conhecendo o sistema.
///
/// Nomes confirmados via /diagnostico/campos: OS.NumOs, ITENSSERVOSV.NumOs,
/// RQM.NumOs + RQM.NumRequisicao, RMXEMPXEST.NumRequisicao.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class RepositorioVendas
{
    private readonly LeitorSga _leitor;

    public RepositorioVendas(LeitorSga leitor) => _leitor = leitor;

    /// <summary>Faturamento de uma data: a data (fechamento), peca e servico.</summary>
    public sealed record VendaData(DateTime Data, decimal Peca, decimal Servico);

    /// <summary>
    /// Os N dias COM MOVIMENTO mais recentes (OSv fechadas), do mais antigo para o mais
    /// recente na lista final. Busca num periodo amplo para tras a partir de hoje e pega
    /// os ultimos N dias que tiveram peca ou servico. Usado no grafico-resumo da home.
    /// </summary>
    public List<VendaData> UltimosDiasComMovimento(int codEmpresa, int n)
    {
        // Janela ampla para tras (ex.: 1 ano); se a empresa vende esporadico, ainda achamos N dias.
        var fim = DateTime.Today.AddDays(1);          // inclui hoje
        var inicio = DateTime.Today.AddYears(-1);

        var porData = ConsultarPorData(codEmpresa, inicio, fim);

        return porData
            .OrderByDescending(kv => kv.Key)           // mais recentes primeiro
            .Take(n)                                    // ultimos N dias com movimento
            .OrderBy(kv => kv.Key)                      // devolve em ordem cronologica
            .Select(kv => new VendaData(kv.Key, kv.Value.peca, kv.Value.servico))
            .ToList();
    }

    /// <summary>Faturamento por data (dia) das OSv fechadas num intervalo [inicio, fim).</summary>
    private Dictionary<DateTime, (decimal peca, decimal servico)> ConsultarPorData(
        int codEmpresa, DateTime inicio, DateTime fim)
    {
        // Agrupa pela DATA (sem hora): no Access, DateValue() zera a hora.
        const string sqlServico = """
            SELECT DateValue(o.DataFechamento) AS D,
                   SUM(i.ValorMaoObra * i.Quantidade) AS Total
            FROM OS AS o
            INNER JOIN ITENSSERVOSV AS i ON o.NumOs = i.NumOs
            WHERE o.CodEmpresa = ?
              AND o.DataFechamento >= ? AND o.DataFechamento < ?
              AND (o.Cancelada IS NULL OR o.Cancelada = 0)
            GROUP BY DateValue(o.DataFechamento)
            """;

        const string sqlPeca = """
            SELECT DateValue(o.DataFechamento) AS D,
                   SUM(x.Quantidade * x.ValorUnit) AS Total
            FROM ((OS AS o
                  INNER JOIN RQM AS q ON o.NumOs = q.NumOs)
                  INNER JOIN RMXEMPXEST AS x ON q.NumRequisicao = x.NumRequisicao)
            WHERE o.CodEmpresa = ?
              AND x.CodEmpresa = ?
              AND o.DataFechamento >= ? AND o.DataFechamento < ?
              AND (o.Cancelada IS NULL OR o.Cancelada = 0)
            GROUP BY DateValue(o.DataFechamento)
            """;

        var porData = new Dictionary<DateTime, (decimal peca, decimal servico)>();

        foreach (var r in _leitor.Consultar(sqlServico,
                     reader => (data: Convert.ToDateTime(reader["D"]).Date, total: ToDec(reader["Total"])),
                     codEmpresa, inicio, fim))
        {
            var a = porData.GetValueOrDefault(r.data);
            porData[r.data] = (a.peca, a.servico + r.total);
        }

        foreach (var r in _leitor.Consultar(sqlPeca,
                     reader => (data: Convert.ToDateTime(reader["D"]).Date, total: ToDec(reader["Total"])),
                     codEmpresa, codEmpresa, inicio, fim))
        {
            var a = porData.GetValueOrDefault(r.data);
            porData[r.data] = (a.peca + r.total, a.servico);
        }

        return porData;
    }

    private static decimal ToDec(object? v) => v is null or DBNull ? 0m : Convert.ToDecimal(v);
}
