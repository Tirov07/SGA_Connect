using System.Runtime.Versioning;

namespace SgaConnect.Api.Sga;

/// <summary>
/// Valida o login direto contra a tabela EmpresaxUsuariosConn do SGA (somente leitura).
///
/// Estrutura confirmada (Modo Design):
///   CodEmpresa (Numero), CPF (Texto), Nome (Texto), Password_Usu (Texto),
///   Celular (Texto), Email (Texto), Ativo (Numero).
///
/// A CONFIRMAR com o cliente:
///   - Campo de login que o cliente digita: CPF (hipotese) ou Nome?
///   - Password_Usu em texto puro (hipotese)?
///
/// Seguranca: a senha nunca sai da API; comparamos no servidor e nunca a retornamos.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class RepositorioLoginSga
{
    public sealed record UsuarioSga(int CodEmpresa, string Cpf, string Nome);

    /// <summary>
    /// Procura um usuario ATIVO cujo login e senha batem. Retorna null se nao achar.
    /// O login e comparado contra CPF (hipotese atual).
    /// </summary>
    public UsuarioSga? Autenticar(LeitorSga leitor, string login, string senha)
    {
        const string sql = """
            SELECT TOP 1 CodEmpresa, CPF, Nome
            FROM EmpresaxUsuariosConn
            WHERE CPF = ? AND Password_Usu = ? AND Ativo <> 0
            """;

        var achados = leitor.Consultar(sql, r => new UsuarioSga(
            CodEmpresa: Convert.ToInt32(r["CodEmpresa"]),
            Cpf: r["CPF"]?.ToString() ?? "",
            Nome: r["Nome"]?.ToString() ?? ""
        ), login.Trim(), senha);

        return achados.FirstOrDefault();
    }
}
