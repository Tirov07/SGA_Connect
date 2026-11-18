using System.Runtime.Versioning;

namespace SgaConnect.Api.Sga;

/// <summary>
/// Valida o login direto contra a tabela EmpresaxUsuariosConn do SGA (somente leitura).
///
/// Estrutura confirmada (Modo Design):
///   CodEmpresa (Numero), CPF (Texto), Nome (Texto), Password_Usu (Texto),
///   Celular (Texto), Email (Texto), Ativo (Numero).
///
/// Confirmado pelo cliente: o login e o CPF e a Password_Usu e texto puro.
///
/// Seguranca: a senha nunca sai da API; comparamos no servidor e nunca a retornamos.
/// </summary>
[SupportedOSPlatform("windows")]
public sealed class RepositorioLoginSga
{
    public sealed record UsuarioSga(int CodEmpresa, string Cpf, string Nome);

    /// <summary>
    /// Procura um usuario ATIVO cujo CPF e senha batem. Retorna null se nao achar.
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

    /// <summary>
    /// Verifica, SEM senha, se o CPF e um usuario ATIVO naquele banco (empresa).
    /// Usado na troca de empresa: a identidade ja foi provada pelo JWT; aqui so
    /// confirmamos que o CPF existe e esta ativo na empresa de destino.
    /// </summary>
    public UsuarioSga? BuscarPorCpf(LeitorSga leitor, string cpf)
    {
        const string sql = """
            SELECT TOP 1 CodEmpresa, CPF, Nome
            FROM EmpresaxUsuariosConn
            WHERE CPF = ? AND Ativo <> 0
            """;
        return leitor.Consultar(sql, r => new UsuarioSga(
            CodEmpresa: Convert.ToInt32(r["CodEmpresa"]),
            Cpf: r["CPF"]?.ToString() ?? "",
            Nome: r["Nome"]?.ToString() ?? ""
        ), cpf.Trim()).FirstOrDefault();
    }
}
