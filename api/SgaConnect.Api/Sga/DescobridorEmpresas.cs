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

        // Prefixo OPCIONAL: se vazio, toda subpasta e candidata (util em teste, onde as
        // pastas sao "fulltac"/"ideal"); em producao, "SGA_" filtra so as pastas do SGA.
        var prefixo = _opcoes.PrefixoPastaEmpresa ?? "";
        var lista = new List<EmpresaInfo>();

        foreach (var pasta in Directory.EnumerateDirectories(raiz))
        {
            var nomePasta = Path.GetFileName(pasta);
            if (string.IsNullOrEmpty(nomePasta)) continue;
            if (prefixo.Length > 0 && !nomePasta.StartsWith(prefixo, StringComparison.OrdinalIgnoreCase))
                continue;

            var caminhoBanco = ResolverCaminhoBanco(pasta);
            var existe = caminhoBanco is not null;

            // Chave = nome da pasta sem o prefixo (quando ha prefixo). Ex.: SGA_FULLTAC -> FULLTAC; fulltac -> fulltac.
            var chave = prefixo.Length > 0 && nomePasta.StartsWith(prefixo, StringComparison.OrdinalIgnoreCase)
                ? nomePasta[prefixo.Length..].Trim()
                : nomePasta.Trim();

            lista.Add(new EmpresaInfo
            {
                Chave = chave,
                NomePasta = nomePasta,
                CaminhoBanco = caminhoBanco ?? Path.Combine(pasta, _opcoes.CaminhoRelativoBanco),
                BancoExiste = existe
            });

            if (!existe)
                _log.LogWarning("Empresa {Pasta}: DADOSTAB.accdb nao encontrado em {Pasta}", nomePasta, pasta);
        }

        return lista
            .OrderBy(e => e.Chave, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    /// <summary>
    /// Acha o DADOSTAB.accdb de uma pasta de empresa, tolerante ao layout:
    ///   1) o caminho relativo configurado (ex.: bd\DADOSTAB.accdb);
    ///   2) o arquivo solto na raiz da pasta (ex.: fulltac\DADOSTAB.accdb);
    ///   3) qualquer DADOSTAB.accdb ate 2 niveis abaixo (fallback).
    /// Retorna null se nao encontrar.
    /// </summary>
    private string? ResolverCaminhoBanco(string pastaEmpresa)
    {
        var relativo = Path.Combine(pastaEmpresa, _opcoes.CaminhoRelativoBanco);
        if (File.Exists(relativo)) return relativo;

        var naRaiz = Path.Combine(pastaEmpresa, "DADOSTAB.accdb");
        if (File.Exists(naRaiz)) return naRaiz;

        try
        {
            foreach (var achado in Directory.EnumerateFiles(pastaEmpresa, "DADOSTAB.accdb", SearchOption.AllDirectories))
                return achado; // primeiro encontrado
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Falha ao varrer {Pasta} por DADOSTAB.accdb", pastaEmpresa);
        }
        return null;
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
