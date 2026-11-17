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

// Vendas diarias do mes (grafico da home): por dia, peca e servico das OSv fechadas.
// Parametro opcional ?mes=AAAA-MM (default: mes atual). Empresa vem do token.
app.MapGet("/vendas-diarias", (HttpContext ctx, DescobridorEmpresas descobridor, string? mes) =>
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

    // mes = "AAAA-MM"; se ausente/invalido, usa o mes atual.
    int ano = DateTime.Today.Year, mesNum = DateTime.Today.Month;
    if (!string.IsNullOrWhiteSpace(mes))
    {
        var partes = mes.Split('-');
        if (partes.Length != 2 || !int.TryParse(partes[0], out ano) || !int.TryParse(partes[1], out mesNum)
            || mesNum < 1 || mesNum > 12)
            return Results.BadRequest(new { erro = "Parametro 'mes' invalido. Use AAAA-MM." });
    }

    var repo = new RepositorioVendas(new LeitorSga(empresa.CaminhoBanco));
    var dias = repo.VendasDiarias(codEmpresa, ano, mesNum)
        .Select(d => new VendaDiaDto(d.Dia, d.Peca, d.Servico))
        .ToList();

    return Results.Ok(new VendasDiariasResponse(
        Ano: ano,
        Mes: mesNum,
        DiasNoMes: DateTime.DaysInMonth(ano, mesNum),
        TotalPeca: dias.Sum(d => d.Peca),
        TotalServico: dias.Sum(d => d.Servico),
        Dias: dias));
}).RequireAuthorization();

app.Run();
