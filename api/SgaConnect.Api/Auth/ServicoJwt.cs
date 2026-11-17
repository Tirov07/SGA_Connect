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

    public (string token, DateTime expiraEm) Gerar(UsuarioApp usuario)
    {
        var chave = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opcoes.Key));
        var credenciais = new SigningCredentials(chave, SecurityAlgorithms.HmacSha256);
        var expiraEm = DateTime.UtcNow.AddMinutes(_opcoes.ExpiracaoMinutos);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, usuario.Id.ToString()),
            new("login", usuario.Login),
            // A empresa do usuario viaja no token. O app NUNCA informa a empresa;
            // ela e sempre lida daqui no servidor, garantindo o isolamento entre clientes.
            new("empresa", usuario.EmpresaChave),
            new("nome", usuario.Nome),
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
