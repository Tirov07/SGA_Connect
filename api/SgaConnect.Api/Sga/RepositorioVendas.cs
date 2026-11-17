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
///       RQM.NumRequisic = RMXEMPXEST.NumRequisic
///       SUM(RMXEMPXEST.Quantidade * RMXEMPXEST.ValorUnit), filtra CodEmpresa em RMXEMPXEST.
///
/// OBS de nomes (confirmar no banco real): a chave da OSv na tabela OS e NumOs; na
/// ITENSSERVOSV e NumOsv; na RQM e NumOs. Se a OS usar NumOsv, trocar OS_CHAVE abaixo.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class RepositorioVendas
{
    private readonly LeitorSga _leitor;

    public RepositorioVendas(LeitorSga leitor) => _leitor = leitor;

    public sealed record VendaDia(int Dia, decimal Peca, decimal Servico);

    /// <summary>
    /// Faturamento por dia de um mes (1..ultimoDia), das OSv fechadas no dia.
    /// Retorna um item por dia que teve movimento; dias sem OSv fechada nao aparecem
    /// (o app completa com zero ao montar o grafico).
    /// </summary>
    public List<VendaDia> VendasDiarias(int codEmpresa, int ano, int mes)
    {
        var inicio = new DateTime(ano, mes, 1);
        var fim = inicio.AddMonths(1);

        // SERVICO por dia: soma de ValorMaoObra*Quantidade das OSv fechadas no dia.
        const string sqlServico = """
            SELECT DAY(o.DataFechamento) AS Dia,
                   SUM(i.ValorMaoObra * i.Quantidade) AS Total
            FROM OS AS o
            INNER JOIN ITENSSERVOSV AS i ON o.NumOs = i.NumOs
            WHERE o.CodEmpresa = ?
              AND o.DataFechamento >= ? AND o.DataFechamento < ?
              AND (o.Cancelada IS NULL OR o.Cancelada = 0)
            GROUP BY DAY(o.DataFechamento)
            """;

        // PECA por dia: OS -> RQM (por NumOs) -> RMXEMPXEST (por NumRequisic).
        // RMXEMPXEST filtra CodEmpresa; RQM nao tem CodEmpresa.
        const string sqlPeca = """
            SELECT DAY(o.DataFechamento) AS Dia,
                   SUM(x.Quantidade * x.ValorUnit) AS Total
            FROM ((OS AS o
                  INNER JOIN RQM AS q ON o.NumOs = q.NumOs)
                  INNER JOIN RMXEMPXEST AS x ON q.NumRequisic = x.NumRequisic)
            WHERE o.CodEmpresa = ?
              AND x.CodEmpresa = ?
              AND o.DataFechamento >= ? AND o.DataFechamento < ?
              AND (o.Cancelada IS NULL OR o.Cancelada = 0)
            GROUP BY DAY(o.DataFechamento)
            """;

        var porDia = new Dictionary<int, (decimal peca, decimal servico)>();

        foreach (var r in _leitor.Consultar(sqlServico,
                     reader => (dia: Convert.ToInt32(reader["Dia"]), total: ToDec(reader["Total"])),
                     codEmpresa, inicio, fim))
        {
            var atual = porDia.GetValueOrDefault(r.dia);
            porDia[r.dia] = (atual.peca, atual.servico + r.total);
        }

        foreach (var r in _leitor.Consultar(sqlPeca,
                     reader => (dia: Convert.ToInt32(reader["Dia"]), total: ToDec(reader["Total"])),
                     codEmpresa, codEmpresa, inicio, fim))
        {
            var atual = porDia.GetValueOrDefault(r.dia);
            porDia[r.dia] = (atual.peca + r.total, atual.servico);
        }

        return porDia
            .OrderBy(kv => kv.Key)
            .Select(kv => new VendaDia(kv.Key, kv.Value.peca, kv.Value.servico))
            .ToList();
    }

    private static decimal ToDec(object? v) => v is null or DBNull ? 0m : Convert.ToDecimal(v);
}
