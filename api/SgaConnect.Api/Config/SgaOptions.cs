namespace SgaConnect.Api.Config;

/// <summary>
/// Configuracao de onde ficam os bancos do SGA no servidor.
/// A API varre <see cref="PastaRaiz"/> procurando subpastas que comecam com
/// <see cref="PrefixoPastaEmpresa"/> e, em cada uma, o arquivo <see cref="CaminhoRelativoBanco"/>.
/// </summary>
public sealed class SgaOptions
{
    public const string Secao = "Sga";

    /// <summary>Pasta raiz onde ficam as pastas SGA_&lt;EMPRESA&gt;. Ex.: C:\sga</summary>
    public string PastaRaiz { get; set; } = @"C:\sga";

    /// <summary>
    /// Prefixo das pastas de empresa (OPCIONAL). Ex.: "SGA_" para SGA_FULLTAC.
    /// Se vazio, toda subpasta da raiz e considerada uma empresa (ex.: "fulltac", "ideal").
    /// </summary>
    public string PrefixoPastaEmpresa { get; set; } = "SGA_";

    /// <summary>Caminho do banco dentro da pasta da empresa. Ex.: bd\DADOSTAB.accdb</summary>
    public string CaminhoRelativoBanco { get; set; } = @"bd\DADOSTAB.accdb";
}
