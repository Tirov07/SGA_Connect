using System.Data.OleDb;
using System.Runtime.Versioning;

namespace SgaConnect.Api.Sga;

/// <summary>
/// Executa consultas SOMENTE LEITURA e parametrizadas no DADOSTAB.accdb de uma empresa.
///
/// Regras de seguranca:
/// - Toda query usa parametros OleDb (sem concatenar valor na string SQL).
/// - O SQL e sempre fixo no servidor; o app nunca envia SQL nem caminho de arquivo.
/// - A conexao e aberta em modo leitura (ver AcessoBancoSga).
///
/// OBS OleDb/Access: os parametros sao POSICIONAIS (o nome nao importa), entao a ORDEM
/// dos valores passados deve bater com a ordem dos '?' no SQL.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class LeitorSga
{
    private readonly string _caminhoAccdb;

    public LeitorSga(string caminhoAccdb) => _caminhoAccdb = caminhoAccdb;

    /// <summary>Executa um SELECT e projeta cada linha com <paramref name="mapear"/>.</summary>
    public List<T> Consultar<T>(string sql, Func<OleDbDataReader, T> mapear, params object?[] parametros)
    {
        using var conexao = AcessoBancoSga.AbrirSomenteLeitura(_caminhoAccdb);
        using var cmd = NovoComando(conexao, sql, parametros);
        using var reader = cmd.ExecuteReader();
        var lista = new List<T>();
        while (reader.Read())
            lista.Add(mapear(reader));
        return lista;
    }

    /// <summary>Executa um SELECT que devolve um unico escalar (ex.: COUNT/SUM).</summary>
    public decimal EscalarDecimal(string sql, params object?[] parametros)
    {
        using var conexao = AcessoBancoSga.AbrirSomenteLeitura(_caminhoAccdb);
        using var cmd = NovoComando(conexao, sql, parametros);
        var valor = cmd.ExecuteScalar();
        return valor is null or DBNull ? 0m : Convert.ToDecimal(valor);
    }

    public int EscalarInt(string sql, params object?[] parametros)
        => (int)EscalarDecimal(sql, parametros);

    private static OleDbCommand NovoComando(OleDbConnection conexao, string sql, object?[] parametros)
    {
        var cmd = conexao.CreateCommand();
        cmd.CommandText = sql;
        foreach (var p in parametros)
            cmd.Parameters.AddWithValue("?", p ?? DBNull.Value);
        return cmd;
    }
}
