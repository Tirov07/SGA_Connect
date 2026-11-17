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
builder.Services.AddSwaggerGen();

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
app.MapGet("/auth/empresas", (DescobridorEmpresas descobridor) =>
    Results.Ok(descobridor.Listar()
        .Where(e => e.BancoExiste)
        .Select(e => new EmpresaResumo(e.Chave, e.NomePasta, e.BancoExiste))));

// Login: o usuario informa login + senha + a empresa (chave da pasta). Validamos a senha
// contra a EmpresaxUsuariosConn daquele DADOSTAB (somente leitura). A empresa escolhida e
// "selada" no JWT; dai em diante o app nunca mais informa empresa nos requests de dados.
app.MapPost("/auth/login", (LoginRequestEmpresa req, DescobridorEmpresas descobridor, ServicoJwt jwt) =>
{
    if (string.IsNullOrWhiteSpace(req.Login) || string.IsNullOrWhiteSpace(req.Senha) || string.IsNullOrWhiteSpace(req.Empresa))
        return Results.BadRequest(new { erro = "Informe empresa, login e senha." });

    if (!OperatingSystem.IsWindows())
        return Results.Json(new { erro = "Leitura do SGA (Access) so no Windows." }, statusCode: StatusCodes.Status503ServiceUnavailable);

    var empresa = descobridor.Resolver(req.Empresa);
    if (empresa is null)
        return Results.Json(new { erro = "Login ou senha invalidos." }, statusCode: StatusCodes.Status401Unauthorized);

    var leitor = new LeitorSga(empresa.CaminhoBanco);
    var usuario = new RepositorioLoginSga().Autenticar(leitor, req.Login, req.Senha);
    // Mesma resposta para usuario inexistente e senha errada (nao revela qual falhou).
    if (usuario is null)
        return Results.Json(new { erro = "Login ou senha invalidos." }, statusCode: StatusCodes.Status401Unauthorized);

    var (token, expira) = jwt.Gerar(usuario.Cpf, usuario.Nome, empresa.Chave, usuario.CodEmpresa);
    return Results.Ok(new LoginResponse(token, expira, usuario.Nome, empresa.Chave, usuario.CodEmpresa));
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

app.Run();
