namespace SgaConnect.Api.Models;

/// <summary>
/// Uma empresa descoberta na varredura da pasta raiz do SGA.
/// </summary>
public sealed class EmpresaInfo
{
    /// <summary>Chave da empresa derivada do nome da pasta. Ex.: pasta "SGA_FULLTAC" => "FULLTAC".</summary>
    public required string Chave { get; init; }

    /// <summary>Nome da pasta. Ex.: "SGA_FULLTAC".</summary>
    public required string NomePasta { get; init; }

    /// <summary>Caminho completo do DADOSTAB.accdb. NUNCA e exposto ao app.</summary>
    public required string CaminhoBanco { get; init; }

    /// <summary>True se o arquivo DADOSTAB.accdb existe no caminho esperado.</summary>
    public bool BancoExiste { get; init; }
}
