using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SgaConnect.Api.Config;

namespace SgaConnect.Api.Auth;

public sealed class ServicoJwt
{
    private readonly JwtOptions _opcoes;

    public ServicoJwt(IOptions<JwtOptions> opcoes) => _opcoes = opcoes.Value;

    /// <summary>
    /// Gera o JWT. A empresa (chave da pasta) e o CodEmpresa (numero do SGA) viajam no
    /// token e sao sempre resolvidos no servidor — o app NUNCA informa empresa nem caminho,
    /// o que garante o isolamento entre clientes.
    /// </summary>
    /// <param name="codEmpresa">CodEmpresa do SGA; 0 quando a origem e o banco do app.</param>
    public (string token, DateTime expiraEm) Gerar(string login, string nome, string empresaChave, int codEmpresa)
    {
        var chave = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opcoes.Key));
        var credenciais = new SigningCredentials(chave, SecurityAlgorithms.HmacSha256);
        var expiraEm = DateTime.UtcNow.AddMinutes(_opcoes.ExpiracaoMinutos);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, login),
            new("login", login),
            new("empresa", empresaChave),
            new("codEmpresa", codEmpresa.ToString()),
            new("nome", nome),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _opcoes.Issuer,
            audience: _opcoes.Audience,
            claims: claims,
            expires: expiraEm,
            signingCredentials: credenciais);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiraEm);
    }
}
