namespace SgaConnect.Api.Models;

public sealed record LoginRequest(string Login, string Senha);

public sealed record LoginResponse(string Token, DateTime ExpiraEm, string Nome, string Empresa);

/// <summary>Resumo da home do app — primeiros numeros que o cliente ve.</summary>
public sealed record ResumoResponse(
    string Empresa,
    DateTime GeradoEm,
    int OrdensServicoAbertas,
    int OrdensServicoFechadas7Dias,
    decimal TotalAReceberMes,
    decimal TotalAPagarMes);

public sealed record EmpresaResumo(string Chave, string NomePasta, bool BancoExiste);
