namespace SgaConnect.Api.Models;

/// <summary>
/// Login: o app envia so CPF + senha. A empresa e opcional — vem preenchida apenas na
/// 2a chamada, quando o CPF existe em varias empresas e o usuario ja escolheu uma.
/// </summary>
public sealed record LoginRequest(string Login, string Senha, string? Empresa = null);

/// <summary>Uma empresa onde o CPF+senha foram aceitos (para o usuario escolher).</summary>
public sealed record EmpresaDoUsuario(string Empresa, string Nome, int CodEmpresa);

/// <summary>
/// Resposta do login. Dois formatos, nunca os dois ao mesmo tempo:
///  - sucesso: Token preenchido (login resolvido numa unica empresa);
///  - escolha: PrecisaEscolherEmpresa=true + Empresas (CPF existe em varias).
/// </summary>
public sealed record LoginResponse(
    string? Token,
    DateTime? ExpiraEm,
    string? Nome,
    string? Empresa,
    int? CodEmpresa,
    bool PrecisaEscolherEmpresa,
    IReadOnlyList<EmpresaDoUsuario>? Empresas);

/// <summary>Resumo da home do app — primeiros numeros que o cliente ve.</summary>
public sealed record ResumoResponse(
    string Empresa,
    DateTime GeradoEm,
    int OrdensServicoAbertas,
    int OrdensServicoFechadas7Dias,
    decimal TotalAReceberMes,
    decimal TotalAPagarMes);

public sealed record EmpresaResumo(string Chave, string NomePasta, bool BancoExiste);

/// <summary>Faturamento de um dia (grafico-resumo da home).</summary>
public sealed record VendaDiaDto(string Data, decimal Peca, decimal Servico, decimal Total);

/// <summary>Resposta do grafico-resumo: ultimos N dias com movimento.</summary>
public sealed record VendasResumoResponse(
    int DiasRetornados,
    decimal TotalPeca,
    decimal TotalServico,
    IReadOnlyList<VendaDiaDto> Dias);
