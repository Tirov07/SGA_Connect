using Microsoft.Extensions.Options;
using SgaConnect.Api.Config;
using SgaConnect.Api.Models;

namespace SgaConnect.Api.Sga;

/// <summary>
/// Descobre as empresas varrendo a pasta raiz do SGA (ex.: C:\sga), procurando
/// subpastas SGA_&lt;EMPRESA&gt; que contenham bd\DADOSTAB.accdb.
///
/// Importante para a seguranca: nenhum caminho de banco vem do app. A API so
/// trabalha com empresas encontradas aqui e resolvidas pela CHAVE (ex.: "FULLTAC").
/// </summary>
public sealed class DescobridorEmpresas
{
    private readonly SgaOptions _opcoes;
    private readonly ILogger<DescobridorEmpresas> _log;

    public DescobridorEmpresas(IOptions<SgaOptions> opcoes, ILogger<DescobridorEmpresas> log)
    {
        _opcoes = opcoes.Value;
        _log = log;
    }

    /// <summary>
    /// Lista todas as empresas encontradas na pasta raiz. Reconsulta o disco a cada
    /// chamada, entao adicionar uma empresa nova no servidor nao exige reiniciar a API.
    /// </summary>
    public IReadOnlyList<EmpresaInfo> Listar()
    {
        var raiz = _opcoes.PastaRaiz;
        if (string.IsNullOrWhiteSpace(raiz) || !Directory.Exists(raiz))
        {
            _log.LogWarning("Pasta raiz do SGA nao encontrada: {Raiz}", raiz);
            return Array.Empty<EmpresaInfo>();
        }

        var prefixo = _opcoes.PrefixoPastaEmpresa;
        var lista = new List<EmpresaInfo>();

        foreach (var pasta in Directory.EnumerateDirectories(raiz))
        {
            var nomePasta = Path.GetFileName(pasta);
            if (string.IsNullOrEmpty(nomePasta)) continue;
            if (!nomePasta.StartsWith(prefixo, StringComparison.OrdinalIgnoreCase)) continue;

            var caminhoBanco = Path.Combine(pasta, _opcoes.CaminhoRelativoBanco);
            var existe = File.Exists(caminhoBanco);

            lista.Add(new EmpresaInfo
            {
                Chave = nomePasta[prefixo.Length..].Trim(),
                NomePasta = nomePasta,
                CaminhoBanco = caminhoBanco,
                BancoExiste = existe
            });

            if (!existe)
                _log.LogWarning("Empresa {Pasta}: DADOSTAB.accdb nao encontrado em {Caminho}", nomePasta, caminhoBanco);
        }

        return lista
            .OrderBy(e => e.Chave, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    /// <summary>
    /// Resolve uma empresa pela chave (ex.: "FULLTAC"). Retorna null se nao existir
    /// ou se o banco nao estiver presente. Case-insensitive.
    /// </summary>
    public EmpresaInfo? Resolver(string chave)
    {
        if (string.IsNullOrWhiteSpace(chave)) return null;
        return Listar().FirstOrDefault(e =>
            e.BancoExiste &&
            string.Equals(e.Chave, chave.Trim(), StringComparison.OrdinalIgnoreCase));
    }
}
