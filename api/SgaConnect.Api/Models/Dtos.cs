namespace SgaConnect.Api.Models;

/// <summary>
/// Login: o app envia so CPF + senha. A empresa e opcional — vem preenchida apenas na
/// 2a chamada, quando o CPF existe em varias empresas e o usuario ja escolheu uma.
/// </summary>
public sealed record LoginRequest(string Login, string Senha, string? Empresa = null);

/// <summary>Uma empresa onde o CPF+senha foram aceitos (para o usuario escolher).</summary>
public sealed record EmpresaDoUsuario(string Empresa, string Nome, int CodEmpresa);

/// <summary>Troca de empresa (sem senha): empresa de destino do mesmo CPF.</summary>
public sealed record TrocarEmpresaRequest(string Empresa);

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

// ---------------- Financeiro (Bloco A) ----------------

/// <summary>Titulo em aberto (a receber ou a pagar).</summary>
public sealed record TituloDto(
    string Nome,
    string Numero,
    string? Vencimento, // "AAAA-MM-DD"
    decimal Saldo,
    string Observacao);

/// <summary>Lista de titulos em aberto de um mes + total.</summary>
public sealed record TitulosResponse(
    int Ano,
    int Mes,
    int Quantidade,
    decimal Total,
    IReadOnlyList<TituloDto> Titulos);

/// <summary>Card de vencidos: quantidade e total, a receber e a pagar.</summary>
public sealed record VencidosResponse(
    int QtdReceber,
    decimal TotalReceber,
    int QtdPagar,
    decimal TotalPagar);

// ---------------- Bancos / extrato (Bloco B) ----------------

public sealed record BancoDto(int NumeroBanco, string Nome);

public sealed record LancamentoDto(string Data, string Descricao, decimal Valor, bool Entrada);

/// <summary>Extrato consolidado de 1+ bancos num periodo.</summary>
public sealed record ExtratoResponse(
    string Inicio,
    string Fim,
    decimal TotalEntradas,
    decimal TotalSaidas,
    decimal Resultado,
    IReadOnlyList<LancamentoDto> Lancamentos);

public sealed record PontoSaldoDto(string Data, decimal Saldo);

/// <summary>Serie de saldo acumulado de um banco (grafico estilo bolsa).</summary>
public sealed record SaldoSerieResponse(
    int NumeroBanco,
    string Inicio,
    string Fim,
    decimal SaldoAtual,
    IReadOnlyList<PontoSaldoDto> Pontos);
