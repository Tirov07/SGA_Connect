using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
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
builder.Services.AddSingleton(_ =>
{
    var caminho = builder.Configuration["AppDb:Caminho"] ?? "sgaconnect_app.db";
    var repo = new RepositorioUsuarios(caminho);
    repo.GarantirEsquema();
    return repo;
});

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

// Semente de dev: se nao ha nenhum usuario, cria um de teste (so em Development).
if (app.Environment.IsDevelopment())
{
    var repo = app.Services.GetRequiredService<RepositorioUsuarios>();
    if (repo.Contar() == 0)
    {
        repo.Salvar("teste", "teste123", empresaChave: "FULLTAC", nome: "Usuario Teste");
        app.Logger.LogInformation("Usuario de teste criado: login='teste' senha='teste123' empresa='FULLTAC' (apenas Development).");
    }
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

// Login: valida no banco proprio do app e devolve JWT. A empresa vai no token.
app.MapPost("/auth/login", (LoginRequest req, RepositorioUsuarios repo, ServicoJwt jwt) =>
{
    if (string.IsNullOrWhiteSpace(req.Login) || string.IsNullOrWhiteSpace(req.Senha))
        return Results.BadRequest(new { erro = "Informe login e senha." });

    var usuario = repo.BuscarPorLogin(req.Login);
    // Mesma resposta para usuario inexistente e senha errada (nao revela qual falhou).
    if (usuario is null || !usuario.Ativo || !HashSenha.Conferir(req.Senha, usuario.HashSenha))
        return Results.Json(new { erro = "Login ou senha invalidos." }, statusCode: StatusCodes.Status401Unauthorized);

    var (token, expira) = jwt.Gerar(usuario);
    return Results.Ok(new LoginResponse(token, expira, usuario.Nome, usuario.EmpresaChave));
}).RequireRateLimiting("login");

// Resumo da home — ESQUELETO. A empresa vem do token (claim "empresa"), nunca do app.
// As consultas reais ao SGA entram na proxima etapa, quando mapearmos as tabelas.
app.MapGet("/resumo", (HttpContext ctx, DescobridorEmpresas descobridor) =>
{
    var empresaChave = ctx.User.FindFirst("empresa")?.Value;
    if (string.IsNullOrWhiteSpace(empresaChave))
        return Results.Unauthorized();

    var empresa = descobridor.Resolver(empresaChave);
    if (empresa is null)
        return Results.NotFound(new { erro = $"Empresa '{empresaChave}' nao encontrada ou banco ausente no servidor." });

    // TODO(proxima etapa): ler OS/financeiro do DADOSTAB via AcessoBancoSga (somente leitura).
    var resumo = new ResumoResponse(
        Empresa: empresa.Chave,
        GeradoEm: DateTime.Now,
        OrdensServicoAbertas: 0,
        OrdensServicoFechadas7Dias: 0,
        TotalAReceberMes: 0m,
        TotalAPagarMes: 0m);

    return Results.Ok(resumo);
}).RequireAuthorization();

app.Run();
