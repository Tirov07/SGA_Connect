using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SgaConnect.Api.Auth;
using SgaConnect.Api.Config;
using SgaConnect.Api.Models;
using SgaConnect.Api.Sga;

var builder = WebApplication.CreateBuilder(args);

// ---- Config local (segredos) fora do git + variaveis de ambiente ----
builder.Configuration
    .AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables("SGACONNECT_");

// ---- Opcoes tipadas ----
builder.Services.Configure<SgaOptions>(builder.Configuration.GetSection(SgaOptions.Secao));
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.Secao));

// ---- Chave JWT: appsettings.Local.json > env SGACONNECT_Jwt__Key > temporaria (so dev) ----
var jwtSection = builder.Configuration.GetSection(JwtOptions.Secao);
var jwtKey = jwtSection["Key"];
if (string.IsNullOrWhiteSpace(jwtKey))
{
    jwtKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    jwtSection["Key"] = jwtKey;
    Console.WriteLine("[AVISO] Jwt:Key nao definida. Gerando chave TEMPORARIA so para esta execucao. " +
                      "Defina Jwt:Key em appsettings.Local.json ou SGACONNECT_Jwt__Key em producao.");
}
var jwtOpts = jwtSection.Get<JwtOptions>()!;

// ---- Servicos ----
builder.Services.AddSingleton<DescobridorEmpresas>();
builder.Services.AddSingleton<ServicoJwt>();

// ---- Autenticacao JWT ----
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOpts.Issuer,
            ValidAudience = jwtOpts.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });
builder.Services.AddAuthorization();

// ---- Rate limiting: protege o login contra forca bruta ----
builder.Services.AddRateLimiter(opt =>
{
    opt.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    opt.AddPolicy("login", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ctx.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 8,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin())); // ajustar origem na etapa do app

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    // Botao "Authorize" no Swagger: cole o token (sem a palavra "Bearer", o Swagger adiciona).
    var esquema = new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Cole aqui o token recebido no /auth/login (so o token, sem 'Bearer ')."
    };
    c.AddSecurityDefinition("Bearer", esquema);
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        [new Microsoft.OpenApi.Models.OpenApiSecurityScheme
        {
            Reference = new Microsoft.OpenApi.Models.OpenApiReference
            {
                Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                Id = "Bearer"
            }
        }] = Array.Empty<string>()
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRateLimiter();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// ---------------- Endpoints ----------------

// Saude da API + visao geral das empresas encontradas (sem expor caminhos completos).
app.MapGet("/health", (DescobridorEmpresas descobridor) =>
{
    var empresas = descobridor.Listar();
    return Results.Ok(new
    {
        status = "ok",
        windows = OperatingSystem.IsWindows(),
        empresasEncontradas = empresas.Count,
        empresas = empresas.Select(e => new EmpresaResumo(e.Chave, e.NomePasta, e.BancoExiste))
    });
});

// Diagnostico: testa se a API consegue abrir o DADOSTAB de cada empresa (somente leitura).
// Util na primeira configuracao no servidor. Nao exige login de proposito (so em dev);
// em producao sera protegido/removido.
app.MapGet("/diagnostico/conexoes", (DescobridorEmpresas descobridor) =>
{
    var resultado = descobridor.Listar().Select(e =>
    {
        var (ok, msg) = AcessoBancoSga.TestarConexao(e.CaminhoBanco);
        return new { empresa = e.Chave, bancoExiste = e.BancoExiste, conexaoOk = ok, mensagem = msg };
    });
    return Results.Ok(resultado);
});

// Diagnostico TEMPORARIO: calibra o criterio de "a pagar do mes" comparando varias
// somas/contagens da CTPAG com o valor que o SGA mostra. Usa a empresa do token.
app.MapGet("/diagnostico/contas-pagar", (HttpContext ctx, DescobridorEmpresas descobridor) =>
{
    var empresaChave = ctx.User.FindFirst("empresa")?.Value;
    var codEmpresaStr = ctx.User.FindFirst("codEmpresa")?.Value;
    if (string.IsNullOrWhiteSpace(empresaChave) || !int.TryParse(codEmpresaStr, out var codEmpresa))
        return Results.Unauthorized();

    var empresa = descobridor.Resolver(empresaChave);
    if (empresa is null) return Results.NotFound(new { erro = "Empresa nao encontrada." });
    if (!OperatingSystem.IsWindows())
        return Results.Json(new { erro = "Access so no Windows." }, statusCode: 503);

    var repo = new RepositorioResumo(new LeitorSga(empresa.CaminhoBanco));
    return Results.Ok(repo.DiagnosticoContasPagar(codEmpresa));
}).RequireAuthorization();

// Diagnostico CRU: mostra o que a API enxerga no disco (pasta raiz, subpastas e arquivos).
// Serve para entender por que um banco nao e achado. So em Development.
app.MapGet("/diagnostico/pastas", (IOptions<SgaOptions> opt) =>
{
    var o = opt.Value;
    var raiz = o.PastaRaiz;
    if (string.IsNullOrWhiteSpace(raiz) || !Directory.Exists(raiz))
        return Results.Ok(new { pastaRaiz = raiz, raizExiste = false, prefixo = o.PrefixoPastaEmpresa, subpastas = Array.Empty<object>() });

    var sub = Directory.EnumerateDirectories(raiz).Select(p =>
    {
        string[] arquivos;
        try { arquivos = Directory.GetFiles(p, "*", SearchOption.AllDirectories).Select(Path.GetFileName).OfType<string>().ToArray(); }
        catch (Exception ex) { arquivos = new[] { "ERRO: " + ex.Message }; }
        return new { pasta = Path.GetFileName(p), arquivos };
    });

    return Results.Ok(new
    {
        pastaRaiz = raiz,
        raizExiste = true,
        prefixo = o.PrefixoPastaEmpresa,
        caminhoRelativoBanco = o.CaminhoRelativoBanco,
        subpastas = sub
    });
});

// Diagnostico: lista as colunas reais de uma tabela do SGA (confirma grafia dos campos).
// Ex.: /diagnostico/campos?tabela=ITENSSERVOSV  (empresa vem do token).
app.MapGet("/diagnostico/campos", (HttpContext ctx, DescobridorEmpresas descobridor, string tabela) =>
{
    var empresaChave = ctx.User.FindFirst("empresa")?.Value;
    if (string.IsNullOrWhiteSpace(empresaChave)) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(tabela)) return Results.BadRequest(new { erro = "Informe ?tabela=NOME" });

    var empresa = descobridor.Resolver(empresaChave);
    if (empresa is null) return Results.NotFound(new { erro = "Empresa nao encontrada." });
    if (!OperatingSystem.IsWindows())
        return Results.Json(new { erro = "Access so no Windows." }, statusCode: 503);

    try
    {
        var colunas = new LeitorSga(empresa.CaminhoBanco).ListarColunas(tabela);
        return Results.Ok(new { tabela, colunas });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { tabela, erro = ex.Message });
    }
}).RequireAuthorization();

// Lista as empresas disponiveis para a tela de login escolher (so chave + nome da pasta).
// Login: o app envia so CPF + senha. A API varre os bancos das empresas e acha onde o
// CPF+senha batem (somente leitura). Se achar em 1 empresa, ja devolve o token. Se achar
// em varias, devolve a lista SO dessas empresas para o usuario escolher; o app chama de
// novo com o campo Empresa preenchido. A empresa escolhida e "selada" no JWT.
app.MapPost("/auth/login", (LoginRequest req, DescobridorEmpresas descobridor, ServicoJwt jwt) =>
{
    if (string.IsNullOrWhiteSpace(req.Login) || string.IsNullOrWhiteSpace(req.Senha))
        return Results.BadRequest(new { erro = "Informe CPF e senha." });

    if (!OperatingSystem.IsWindows())
        return Results.Json(new { erro = "Leitura do SGA (Access) so no Windows." }, statusCode: StatusCodes.Status503ServiceUnavailable);

    var repoLogin = new RepositorioLoginSga();

    // Autentica em cada empresa com banco valido; coleta onde o CPF+senha batem.
    var matches = new List<(EmpresaInfo empresa, RepositorioLoginSga.UsuarioSga usuario)>();
    foreach (var e in descobridor.Listar().Where(e => e.BancoExiste))
    {
        try
        {
            var u = repoLogin.Autenticar(new LeitorSga(e.CaminhoBanco), req.Login, req.Senha);
            if (u is not null) matches.Add((e, u));
        }
        catch (Exception ex)
        {
            app.Logger.LogWarning(ex, "Falha ao autenticar na empresa {Empresa}", e.Chave);
        }
    }

    if (matches.Count == 0)
        return Results.Json(new { erro = "CPF ou senha invalidos." }, statusCode: StatusCodes.Status401Unauthorized);

    (EmpresaInfo empresa, RepositorioLoginSga.UsuarioSga usuario)? escolhido = null;

    if (!string.IsNullOrWhiteSpace(req.Empresa))
    {
        // 2a chamada: o usuario ja escolheu. So aceita se a empresa esta entre as dele.
        escolhido = matches.FirstOrDefault(m =>
            string.Equals(m.empresa.Chave, req.Empresa.Trim(), StringComparison.OrdinalIgnoreCase));
        if (escolhido is null || escolhido.Value.empresa is null)
            return Results.Json(new { erro = "CPF ou senha invalidos." }, statusCode: StatusCodes.Status401Unauthorized);
    }
    else if (matches.Count == 1)
    {
        escolhido = matches[0];
    }
    else
    {
        // CPF em varias empresas: devolve so as dele para escolher (nao emite token ainda).
        var opcoes = matches
            .Select(m => new EmpresaDoUsuario(m.empresa.Chave, m.usuario.Nome, m.usuario.CodEmpresa))
            .ToList();
        return Results.Ok(new LoginResponse(
            Token: null, ExpiraEm: null, Nome: null, Empresa: null, CodEmpresa: null,
            PrecisaEscolherEmpresa: true, Empresas: opcoes));
    }

    var (emp, usr) = escolhido!.Value;
    var (token, expira) = jwt.Gerar(usr.Cpf, usr.Nome, emp.Chave, usr.CodEmpresa);
    return Results.Ok(new LoginResponse(
        Token: token, ExpiraEm: expira, Nome: usr.Nome, Empresa: emp.Chave, CodEmpresa: usr.CodEmpresa,
        PrecisaEscolherEmpresa: false, Empresas: null));
}).RequireRateLimiting("login");

// Lista as empresas do usuario LOGADO (mesmo CPF do token, ativo em cada banco).
// Usado para o botao "Trocar empresa". Nao precisa de senha (identidade ja provada pelo JWT).
app.MapGet("/auth/empresas-do-usuario", (HttpContext ctx, DescobridorEmpresas descobridor) =>
{
    var cpf = ctx.User.FindFirst("login")?.Value;
    if (string.IsNullOrWhiteSpace(cpf)) return Results.Unauthorized();
    if (!OperatingSystem.IsWindows())
        return Results.Json(new { erro = "Leitura do SGA (Access) so no Windows." }, statusCode: StatusCodes.Status503ServiceUnavailable);

    var repoLogin = new RepositorioLoginSga();
    var lista = new List<EmpresaDoUsuario>();
    foreach (var e in descobridor.Listar().Where(e => e.BancoExiste))
    {
        try
        {
            var u = repoLogin.BuscarPorCpf(new LeitorSga(e.CaminhoBanco), cpf);
            if (u is not null) lista.Add(new EmpresaDoUsuario(e.Chave, u.Nome, u.CodEmpresa));
        }
        catch (Exception ex)
        {
            app.Logger.LogWarning(ex, "empresas-do-usuario: falha em {Empresa}", e.Chave);
        }
    }
    return Results.Ok(lista);
}).RequireAuthorization();

// Troca de empresa SEM senha: emite um token novo para outra empresa do MESMO CPF.
// Seguranca: o CPF vem do token atual; a API confirma que o CPF existe e esta ATIVO
// na empresa de destino antes de emitir o novo token.
app.MapPost("/auth/trocar-empresa", (TrocarEmpresaRequest req, HttpContext ctx, DescobridorEmpresas descobridor, ServicoJwt jwt) =>
{
    var cpf = ctx.User.FindFirst("login")?.Value;
    if (string.IsNullOrWhiteSpace(cpf)) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(req.Empresa))
        return Results.BadRequest(new { erro = "Informe a empresa de destino." });
    if (!OperatingSystem.IsWindows())
        return Results.Json(new { erro = "Leitura do SGA (Access) so no Windows." }, statusCode: StatusCodes.Status503ServiceUnavailable);

    var empresa = descobridor.Resolver(req.Empresa);
    if (empresa is null)
        return Results.Json(new { erro = "Empresa invalida." }, statusCode: StatusCodes.Status403Forbidden);

    var usuario = new RepositorioLoginSga().BuscarPorCpf(new LeitorSga(empresa.CaminhoBanco), cpf);
    if (usuario is null)
        return Results.Json(new { erro = "Voce nao tem acesso a essa empresa." }, statusCode: StatusCodes.Status403Forbidden);

    var (token, expira) = jwt.Gerar(usuario.Cpf, usuario.Nome, empresa.Chave, usuario.CodEmpresa);
    return Results.Ok(new LoginResponse(
        Token: token, ExpiraEm: expira, Nome: usuario.Nome, Empresa: empresa.Chave, CodEmpresa: usuario.CodEmpresa,
        PrecisaEscolherEmpresa: false, Empresas: null));
}).RequireAuthorization();

// Resumo da home — le OS + financeiro do DADOSTAB (somente leitura). A empresa e o
// CodEmpresa vem do token, nunca do app.
app.MapGet("/resumo", (HttpContext ctx, DescobridorEmpresas descobridor) =>
{
    var empresaChave = ctx.User.FindFirst("empresa")?.Value;
    var codEmpresaStr = ctx.User.FindFirst("codEmpresa")?.Value;
    if (string.IsNullOrWhiteSpace(empresaChave) || !int.TryParse(codEmpresaStr, out var codEmpresa))
        return Results.Unauthorized();

    var empresa = descobridor.Resolver(empresaChave);
    if (empresa is null)
        return Results.NotFound(new { erro = $"Empresa '{empresaChave}' nao encontrada ou banco ausente no servidor." });

    if (!OperatingSystem.IsWindows())
        return Results.Json(new { erro = "Leitura do SGA (Access) so no Windows." }, statusCode: StatusCodes.Status503ServiceUnavailable);

    var repo = new RepositorioResumo(new LeitorSga(empresa.CaminhoBanco));
    var resumo = new ResumoResponse(
        Empresa: empresa.Chave,
        GeradoEm: DateTime.Now,
        OrdensServicoAbertas: repo.OrdensServicoAbertas(codEmpresa),
        OrdensServicoFechadas7Dias: repo.OrdensServicoFechadasUltimosDias(codEmpresa, 7),
        TotalAReceberMes: repo.TotalAReceberMes(codEmpresa),
        TotalAPagarMes: repo.TotalAPagarMes(codEmpresa));

    return Results.Ok(resumo);
}).RequireAuthorization();

// Grafico-resumo da home: os ultimos N dias COM MOVIMENTO (default 20), peca x servico
// das OSv fechadas. Empresa vem do token. ?dias=20
app.MapGet("/vendas-resumo", (HttpContext ctx, DescobridorEmpresas descobridor, int? dias) =>
{
    var empresaChave = ctx.User.FindFirst("empresa")?.Value;
    var codEmpresaStr = ctx.User.FindFirst("codEmpresa")?.Value;
    if (string.IsNullOrWhiteSpace(empresaChave) || !int.TryParse(codEmpresaStr, out var codEmpresa))
        return Results.Unauthorized();

    var empresa = descobridor.Resolver(empresaChave);
    if (empresa is null)
        return Results.NotFound(new { erro = $"Empresa '{empresaChave}' nao encontrada." });

    if (!OperatingSystem.IsWindows())
        return Results.Json(new { erro = "Leitura do SGA (Access) so no Windows." }, statusCode: StatusCodes.Status503ServiceUnavailable);

    var n = Math.Clamp(dias ?? 20, 1, 60);
    var repo = new RepositorioVendas(new LeitorSga(empresa.CaminhoBanco));
    var lista = repo.UltimosDiasComMovimento(codEmpresa, n)
        .Select(d => new VendaDiaDto(
            Data: d.Data.ToString("yyyy-MM-dd"),
            Peca: d.Peca,
            Servico: d.Servico,
            Total: d.Peca + d.Servico))
        .ToList();

    return Results.Ok(new VendasResumoResponse(
        DiasRetornados: lista.Count,
        TotalPeca: lista.Sum(d => d.Peca),
        TotalServico: lista.Sum(d => d.Servico),
        Dias: lista));
}).RequireAuthorization();

// ---------------- Financeiro (Bloco A) ----------------

// Helper local: resolve (empresa, codEmpresa) a partir do token; devolve erro pronto se falhar.
IResult? ResolverContexto(HttpContext ctx, DescobridorEmpresas descobridor,
    out SgaConnect.Api.Models.EmpresaInfo? empresa, out int codEmpresa)
{
    empresa = null; codEmpresa = 0;
    var empresaChave = ctx.User.FindFirst("empresa")?.Value;
    var codStr = ctx.User.FindFirst("codEmpresa")?.Value;
    if (string.IsNullOrWhiteSpace(empresaChave) || !int.TryParse(codStr, out codEmpresa))
        return Results.Unauthorized();
    empresa = descobridor.Resolver(empresaChave);
    if (empresa is null) return Results.NotFound(new { erro = "Empresa nao encontrada." });
    if (!OperatingSystem.IsWindows())
        return Results.Json(new { erro = "Leitura do SGA (Access) so no Windows." }, statusCode: 503);
    return null;
}

// Mes a partir de ?mes=AAAA-MM; default mes atual. Retorna (ano, mes) ou null se invalido.
(int ano, int mes)? ParseMes(string? mes)
{
    if (string.IsNullOrWhiteSpace(mes)) return (DateTime.Today.Year, DateTime.Today.Month);
    var p = mes.Split('-');
    if (p.Length == 2 && int.TryParse(p[0], out var a) && int.TryParse(p[1], out var m) && m is >= 1 and <= 12)
        return (a, m);
    return null;
}

// Titulos a RECEBER em aberto de um mes (?mes=AAAA-MM).
app.MapGet("/financeiro/receber", (HttpContext ctx, DescobridorEmpresas descobridor, string? mes) =>
{
    var erro = ResolverContexto(ctx, descobridor, out var empresa, out var codEmpresa);
    if (erro is not null) return erro;
    var mm = ParseMes(mes);
    if (mm is null) return Results.BadRequest(new { erro = "Parametro 'mes' invalido. Use AAAA-MM." });

    var repo = new RepositorioFinanceiro(new LeitorSga(empresa!.CaminhoBanco));
    var itens = repo.ReceberEmAbertoDoMes(codEmpresa, mm.Value.ano, mm.Value.mes)
        .Select(t => new TituloDto(t.Nome, t.Numero, t.Vencimento?.ToString("yyyy-MM-dd"), t.Saldo, t.Observacao))
        .ToList();
    return Results.Ok(new TitulosResponse(mm.Value.ano, mm.Value.mes, itens.Count, itens.Sum(i => i.Saldo), itens));
}).RequireAuthorization();

// Titulos a PAGAR em aberto de um mes (?mes=AAAA-MM).
app.MapGet("/financeiro/pagar", (HttpContext ctx, DescobridorEmpresas descobridor, string? mes) =>
{
    var erro = ResolverContexto(ctx, descobridor, out var empresa, out var codEmpresa);
    if (erro is not null) return erro;
    var mm = ParseMes(mes);
    if (mm is null) return Results.BadRequest(new { erro = "Parametro 'mes' invalido. Use AAAA-MM." });

    var repo = new RepositorioFinanceiro(new LeitorSga(empresa!.CaminhoBanco));
    var itens = repo.PagarEmAbertoDoMes(codEmpresa, mm.Value.ano, mm.Value.mes)
        .Select(t => new TituloDto(t.Nome, t.Numero, t.Vencimento?.ToString("yyyy-MM-dd"), t.Saldo, t.Observacao))
        .ToList();
    return Results.Ok(new TitulosResponse(mm.Value.ano, mm.Value.mes, itens.Count, itens.Sum(i => i.Saldo), itens));
}).RequireAuthorization();

// Card de vencidos (em aberto, vencidos nos ultimos N meses): a receber e a pagar. ?meses=12
app.MapGet("/financeiro/vencidos", (HttpContext ctx, DescobridorEmpresas descobridor, int? meses) =>
{
    var erro = ResolverContexto(ctx, descobridor, out var empresa, out var codEmpresa);
    if (erro is not null) return erro;

    var janela = Math.Clamp(meses ?? 12, 1, 120);
    var repo = new RepositorioFinanceiro(new LeitorSga(empresa!.CaminhoBanco));
    var v = repo.Vencidos(codEmpresa, janela);
    return Results.Ok(new VencidosResponse(v.QtdReceber, v.TotalReceber, v.QtdPagar, v.TotalPagar));
}).RequireAuthorization();

// Bancos ativos da empresa (seletor do extrato/grafico de saldo).
app.MapGet("/financeiro/bancos", (HttpContext ctx, DescobridorEmpresas descobridor) =>
{
    var erro = ResolverContexto(ctx, descobridor, out var empresa, out var codEmpresa);
    if (erro is not null) return erro;
    var repo = new RepositorioBancos(new LeitorSga(empresa!.CaminhoBanco));
    var lista = repo.Listar(codEmpresa).Select(b => new BancoDto(b.NumeroBanco, b.Nome)).ToList();
    return Results.Ok(lista);
}).RequireAuthorization();

// Extrato consolidado de 1+ bancos. ?bancos=1,2,3 &dias=90 (default 90).
app.MapGet("/financeiro/extrato", (HttpContext ctx, DescobridorEmpresas descobridor, string? bancos, int? dias) =>
{
    var erro = ResolverContexto(ctx, descobridor, out var empresa, out var codEmpresa);
    if (erro is not null) return erro;

    var nums = (bancos ?? "")
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Where(s => int.TryParse(s, out _)).Select(int.Parse).Distinct().ToList();
    if (nums.Count == 0) return Results.BadRequest(new { erro = "Informe ?bancos=NUM[,NUM...]" });

    var n = Math.Clamp(dias ?? 90, 1, 730);
    var fim = DateTime.Today.AddDays(1);
    var inicio = DateTime.Today.AddDays(-n);

    var repo = new RepositorioBancos(new LeitorSga(empresa!.CaminhoBanco));
    var lanc = repo.Extrato(codEmpresa, nums, inicio, fim);
    var entradas = lanc.Where(l => l.Entrada).Sum(l => l.Valor);
    var saidas = lanc.Where(l => !l.Entrada).Sum(l => l.Valor);

    return Results.Ok(new ExtratoResponse(
        Inicio: inicio.ToString("yyyy-MM-dd"),
        Fim: DateTime.Today.ToString("yyyy-MM-dd"),
        TotalEntradas: entradas,
        TotalSaidas: saidas,
        Resultado: entradas - saidas,
        Lancamentos: lanc
            .OrderByDescending(l => l.Data) // mais recentes primeiro na lista
            .Select(l => new LancamentoDto(
                l.Data.ToString("yyyy-MM-dd"), l.Descricao, l.Nome, l.Numero, l.Observacao, l.Valor, l.Entrada))
            .ToList()));
}).RequireAuthorization();

// Serie de saldo acumulado de UM banco (grafico estilo bolsa). ?banco=1 &dias=90.
app.MapGet("/financeiro/saldo", (HttpContext ctx, DescobridorEmpresas descobridor, int? banco, int? dias) =>
{
    var erro = ResolverContexto(ctx, descobridor, out var empresa, out var codEmpresa);
    if (erro is not null) return erro;
    if (banco is null) return Results.BadRequest(new { erro = "Informe ?banco=NUMERO" });

    var n = Math.Clamp(dias ?? 90, 7, 730);
    var fim = DateTime.Today.AddDays(1);
    var inicio = DateTime.Today.AddDays(-n);

    var repo = new RepositorioBancos(new LeitorSga(empresa!.CaminhoBanco));
    var pontos = repo.SerieSaldo(codEmpresa, banco.Value, inicio, fim);

    return Results.Ok(new SaldoSerieResponse(
        NumeroBanco: banco.Value,
        Inicio: inicio.ToString("yyyy-MM-dd"),
        Fim: DateTime.Today.ToString("yyyy-MM-dd"),
        SaldoAtual: pontos.Count > 0 ? pontos[^1].Saldo : 0m,
        Pontos: pontos.Select(p => new PontoSaldoDto(p.Data.ToString("yyyy-MM-dd"), p.Saldo)).ToList()));
}).RequireAuthorization();

// ---------------- OSv ----------------

// Helper: monta a resposta de lista de OS a partir dos itens do repositorio.
OsListaResponse MontarOsLista(IReadOnlyList<RepositorioOsv.OsItem> itens)
{
    var dtos = itens.Select(o => new OsItemDto(
        o.NumOs, o.Cliente, o.Placa, o.Operacao, o.ComLaudo,
        o.Abertura?.ToString("yyyy-MM-dd"), o.Fechamento?.ToString("yyyy-MM-dd"),
        o.Peca, o.Servico, o.Total)).ToList();
    return new OsListaResponse(
        dtos.Count, dtos.Sum(d => d.Peca), dtos.Sum(d => d.Servico), dtos.Sum(d => d.Total), dtos);
}

// Parte 1a: OS em aberto (DataFechamento vazia, nao cancelada).
app.MapGet("/osv/abertas", (HttpContext ctx, DescobridorEmpresas descobridor) =>
{
    var erro = ResolverContexto(ctx, descobridor, out var empresa, out var codEmpresa);
    if (erro is not null) return erro;
    var repo = new RepositorioOsv(new LeitorSga(empresa!.CaminhoBanco));
    return Results.Ok(MontarOsLista(repo.Abertas(codEmpresa)));
}).RequireAuthorization();

// Parte 1b: OS fechadas nos ultimos N dias (default 7), por DataFechamento. ?dias=7
app.MapGet("/osv/fechadas", (HttpContext ctx, DescobridorEmpresas descobridor, int? dias) =>
{
    var erro = ResolverContexto(ctx, descobridor, out var empresa, out var codEmpresa);
    if (erro is not null) return erro;
    var n = Math.Clamp(dias ?? 7, 1, 180);
    var repo = new RepositorioOsv(new LeitorSga(empresa!.CaminhoBanco));
    return Results.Ok(MontarOsLista(repo.FechadasUltimosDias(codEmpresa, n)));
}).RequireAuthorization();

// Parte 2: grafico de OSv ABERTAS por dia, com quebra com/sem laudo ao tocar. ?dias=10
app.MapGet("/osv/aberturas", (HttpContext ctx, DescobridorEmpresas descobridor, int? dias) =>
{
    var erro = ResolverContexto(ctx, descobridor, out var empresa, out var codEmpresa);
    if (erro is not null) return erro;
    var n = Math.Clamp(dias ?? 10, 1, 60);
    var repo = new RepositorioOsv(new LeitorSga(empresa!.CaminhoBanco));
    var lista = repo.AberturasPorDia(codEmpresa, n)
        .Select(d => new OsAberturaDiaDto(d.Data.ToString("yyyy-MM-dd"), d.ComLaudo, d.SemLaudo, d.Total))
        .ToList();
    return Results.Ok(new OsAberturasResponse(
        lista.Count, lista.Sum(d => d.ComLaudo), lista.Sum(d => d.SemLaudo), lista));
}).RequireAuthorization();

// Parte 3: resumo financeiro por data de FECHAMENTO.
//   ?periodo=dia&data=AAAA-MM-DD   -> um unico dia
//   ?periodo=mes&mes=AAAA-MM       -> um mes inteiro (default: mes atual)
app.MapGet("/osv/resumo", (HttpContext ctx, DescobridorEmpresas descobridor, string? periodo, string? data, string? mes) =>
{
    var erro = ResolverContexto(ctx, descobridor, out var empresa, out var codEmpresa);
    if (erro is not null) return erro;

    DateTime inicio, fim;
    if (string.Equals(periodo, "dia", StringComparison.OrdinalIgnoreCase))
    {
        if (!DateTime.TryParse(data, out var d))
            return Results.BadRequest(new { erro = "Informe ?data=AAAA-MM-DD para periodo=dia." });
        inicio = d.Date;
        fim = inicio.AddDays(1);
    }
    else
    {
        var mm = ParseMes(mes);
        if (mm is null) return Results.BadRequest(new { erro = "Parametro 'mes' invalido. Use AAAA-MM." });
        inicio = new DateTime(mm.Value.ano, mm.Value.mes, 1);
        fim = inicio.AddMonths(1);
    }

    var repo = new RepositorioOsv(new LeitorSga(empresa!.CaminhoBanco));
    var linhas = repo.ResumoPorFechamento(codEmpresa, inicio, fim)
        .Select(l => new OsResumoLinhaDto(
            l.NumOs, l.Cliente, l.NotaPeca, l.NotaServico,
            l.Fechamento?.ToString("yyyy-MM-dd"), l.Peca, l.Servico, l.Total))
        .ToList();

    return Results.Ok(new OsResumoResponse(
        Inicio: inicio.ToString("yyyy-MM-dd"),
        Fim: fim.AddDays(-1).ToString("yyyy-MM-dd"),
        Quantidade: linhas.Count,
        TotalPeca: linhas.Sum(l => l.Peca),
        TotalServico: linhas.Sum(l => l.Servico),
        TotalGeral: linhas.Sum(l => l.Total),
        Linhas: linhas));
}).RequireAuthorization();

// ---------------- Estoque ----------------

static ItemEstoqueDto MapItem(RepositorioEstoque.ItemEstoque i) =>
    new(i.CodItem, i.Descricao, i.CodigoFabricante, i.CodigoInterno, i.Referencia, i.PrecoVenda, i.Minimo, i.Saldo);

// Parte 1: lista de itens ativos com saldo calculado.
app.MapGet("/estoque/itens", (HttpContext ctx, DescobridorEmpresas descobridor) =>
{
    var erro = ResolverContexto(ctx, descobridor, out var empresa, out var codEmpresa);
    if (erro is not null) return erro;
    var repo = new RepositorioEstoque(new LeitorSga(empresa!.CaminhoBanco));
    var itens = repo.ListarItens(codEmpresa).Select(MapItem).ToList();
    return Results.Ok(new ItensEstoqueResponse(itens.Count, itens));
}).RequireAuthorization();

// Parte 3: itens em ponto de pedido (Minimo > 0 e saldo <= Minimo).
app.MapGet("/estoque/ponto-pedido", (HttpContext ctx, DescobridorEmpresas descobridor) =>
{
    var erro = ResolverContexto(ctx, descobridor, out var empresa, out var codEmpresa);
    if (erro is not null) return erro;
    var repo = new RepositorioEstoque(new LeitorSga(empresa!.CaminhoBanco));
    var itens = repo.PontoDePedido(codEmpresa).Select(MapItem).ToList();
    return Results.Ok(new ItensEstoqueResponse(itens.Count, itens));
}).RequireAuthorization();

// Parte 2: movimentacao (itens vendidos no periodo por quantidade).
//   ?periodo=dia&data=AAAA-MM-DD   ou   ?periodo=mes&mes=AAAA-MM (default mes atual)
app.MapGet("/estoque/movimentacao", (HttpContext ctx, DescobridorEmpresas descobridor, string? periodo, string? data, string? mes) =>
{
    var erro = ResolverContexto(ctx, descobridor, out var empresa, out var codEmpresa);
    if (erro is not null) return erro;

    DateTime inicio, fim;
    if (string.Equals(periodo, "dia", StringComparison.OrdinalIgnoreCase))
    {
        if (!DateTime.TryParse(data, out var d))
            return Results.BadRequest(new { erro = "Informe ?data=AAAA-MM-DD para periodo=dia." });
        inicio = d.Date;
        fim = inicio.AddDays(1);
    }
    else
    {
        var mm = ParseMes(mes);
        if (mm is null) return Results.BadRequest(new { erro = "Parametro 'mes' invalido. Use AAAA-MM." });
        inicio = new DateTime(mm.Value.ano, mm.Value.mes, 1);
        fim = inicio.AddMonths(1);
    }

    var repo = new RepositorioEstoque(new LeitorSga(empresa!.CaminhoBanco));
    var itens = repo.ItensVendidos(codEmpresa, inicio, fim)
        .Select(v => new ItemVendidoDto(
            v.CodItem, v.Descricao, v.CodigoFabricante, v.CodigoInterno, v.Referencia, v.Quantidade, v.ValorTotal))
        .ToList();

    return Results.Ok(new MovimentacaoResponse(
        Inicio: inicio.ToString("yyyy-MM-dd"),
        Fim: fim.AddDays(-1).ToString("yyyy-MM-dd"),
        Quantidade: itens.Count,
        TotalQuantidade: itens.Sum(i => i.Quantidade),
        TotalValor: itens.Sum(i => i.ValorTotal),
        Itens: itens));
}).RequireAuthorization();

app.Run();
