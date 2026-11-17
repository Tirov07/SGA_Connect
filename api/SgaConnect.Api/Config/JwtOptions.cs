namespace SgaConnect.Api.Config;

public sealed class JwtOptions
{
    public const string Secao = "Jwt";

    public string Issuer { get; set; } = "SgaConnect";
    public string Audience { get; set; } = "SgaConnectApp";

    /// <summary>
    /// Chave de assinatura do JWT. NAO deve vir do appsettings.json comitado:
    /// use appsettings.Local.json (fora do git) ou a variavel de ambiente SGACONNECT_JWT_KEY.
    /// </summary>
    public string Key { get; set; } = "";

    public int ExpiracaoMinutos { get; set; } = 480;
}
