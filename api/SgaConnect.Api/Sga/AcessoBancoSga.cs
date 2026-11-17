using System.Data.OleDb;
using System.Runtime.Versioning;

namespace SgaConnect.Api.Sga;

/// <summary>
/// Abre conexoes OLEDB (driver ACE) com o DADOSTAB.accdb de uma empresa,
/// SEMPRE em modo somente leitura. Nunca escreve no banco do SGA.
///
/// O driver ACE so existe no Windows: por isso os metodos sao anotados com
/// [SupportedOSPlatform("windows")] e ha uma checagem explicita em runtime.
/// No sandbox Linux o projeto compila/valida; a leitura real roda no Windows.
/// </summary>
public static class AcessoBancoSga
{
    /// <summary>
    /// Monta a connection string do ACE em modo leitura.
    /// Mode=Read e Share Deny None garantem que nao travamos o banco de ninguem
    /// e que nunca gravamos (o SGA pode estar aberto por outro usuario ao mesmo tempo).
    /// </summary>
    [SupportedOSPlatform("windows")]
    public static string MontarConnectionString(string caminhoAccdb)
    {
        // Monta tudo pelo builder (nada de concatenar na mao, que quebrava o formato OLE DB).
        // Mode=Read abre somente leitura; Share Deny None nao trava o banco para outros
        // usuarios (o SGA pode estar aberto ao mesmo tempo).
        var builder = new OleDbConnectionStringBuilder
        {
            Provider = "Microsoft.ACE.OLEDB.12.0",
            DataSource = caminhoAccdb
        };
        builder["Mode"] = "Read";
        return builder.ConnectionString;
    }

    /// <summary>
    /// Abre uma conexao somente leitura ao banco informado. Lanca se nao for Windows.
    /// </summary>
    [SupportedOSPlatform("windows")]
    public static OleDbConnection AbrirSomenteLeitura(string caminhoAccdb)
    {
        GarantirWindows();

        if (!File.Exists(caminhoAccdb))
            throw new FileNotFoundException("Banco DADOSTAB.accdb nao encontrado.", caminhoAccdb);

        var conexao = new OleDbConnection(MontarConnectionString(caminhoAccdb));
        conexao.Open();
        return conexao;
    }

    /// <summary>
    /// Verifica se a API consegue abrir o banco (usado no /health e diagnostico).
    /// Nao lanca: retorna false e a mensagem do erro.
    /// </summary>
    public static (bool ok, string mensagem) TestarConexao(string caminhoAccdb)
    {
        if (!OperatingSystem.IsWindows())
            return (false, "Leitura do Access so e possivel no Windows (driver ACE ausente neste host).");

        try
        {
            using var c = AbrirSomenteLeitura(caminhoAccdb);
            return (true, "Conexao OK (somente leitura).");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    private static void GarantirWindows()
    {
        if (!OperatingSystem.IsWindows())
            throw new PlatformNotSupportedException(
                "A leitura do Access (ACE/OLEDB) so funciona no Windows. " +
                "Instale o Microsoft Access Database Engine (x64) no servidor.");
    }
}
