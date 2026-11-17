namespace SgaConnect.Api.Auth;

/// <summary>
/// Usuario de acesso ao app, guardado no banco proprio da API (SQLite),
/// separado do SGA. O vinculo com a empresa e feito pela <see cref="EmpresaChave"/>,
/// que casa com a chave descoberta pelo DescobridorEmpresas (ex.: "FULLTAC").
///
/// Mais adiante este cadastro pode ser alimentado a partir da tabela de usuarios
/// do SGA (a confirmar: EmpresaxUsuariosConn) — por ora e o repositorio de acesso.
/// </summary>
public sealed class UsuarioApp
{
    public long Id { get; set; }
    public string Login { get; set; } = "";
    public string HashSenha { get; set; } = "";
    public string EmpresaChave { get; set; } = "";
    public string Nome { get; set; } = "";
    public bool Ativo { get; set; } = true;
}
