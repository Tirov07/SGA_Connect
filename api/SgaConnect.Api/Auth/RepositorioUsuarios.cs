using Microsoft.Data.Sqlite;

namespace SgaConnect.Api.Auth;

/// <summary>
/// Banco proprio do app (SQLite) com os usuarios de acesso ao mobile.
/// Fica separado do SGA — assim controlamos quem tem acesso ao app sem depender
/// do formato de senha do SGA, e nunca escrevemos no banco do cliente.
/// </summary>
public sealed class RepositorioUsuarios
{
    private readonly string _connectionString;

    public RepositorioUsuarios(string caminhoDb)
    {
        _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = caminhoDb,
            Mode = SqliteOpenMode.ReadWriteCreate
        }.ConnectionString;
    }

    public void GarantirEsquema()
    {
        using var c = Abrir();
        using var cmd = c.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS usuario_app (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                login         TEXT NOT NULL UNIQUE COLLATE NOCASE,
                hash_senha    TEXT NOT NULL,
                empresa_chave TEXT NOT NULL,
                nome          TEXT NOT NULL DEFAULT '',
                ativo         INTEGER NOT NULL DEFAULT 1
            );
            """;
        cmd.ExecuteNonQuery();
    }

    public UsuarioApp? BuscarPorLogin(string login)
    {
        using var c = Abrir();
        using var cmd = c.CreateCommand();
        cmd.CommandText = """
            SELECT id, login, hash_senha, empresa_chave, nome, ativo
            FROM usuario_app WHERE login = $login COLLATE NOCASE LIMIT 1;
            """;
        cmd.Parameters.AddWithValue("$login", login);
        using var r = cmd.ExecuteReader();
        if (!r.Read()) return null;
        return new UsuarioApp
        {
            Id = r.GetInt64(0),
            Login = r.GetString(1),
            HashSenha = r.GetString(2),
            EmpresaChave = r.GetString(3),
            Nome = r.GetString(4),
            Ativo = r.GetInt64(5) != 0
        };
    }

    /// <summary>Cria ou atualiza um usuario (upsert pelo login). Usado no seed/admin.</summary>
    public void Salvar(string login, string senhaEmTexto, string empresaChave, string nome, bool ativo = true)
    {
        using var c = Abrir();
        using var cmd = c.CreateCommand();
        cmd.CommandText = """
            INSERT INTO usuario_app (login, hash_senha, empresa_chave, nome, ativo)
            VALUES ($login, $hash, $empresa, $nome, $ativo)
            ON CONFLICT(login) DO UPDATE SET
                hash_senha = excluded.hash_senha,
                empresa_chave = excluded.empresa_chave,
                nome = excluded.nome,
                ativo = excluded.ativo;
            """;
        cmd.Parameters.AddWithValue("$login", login);
        cmd.Parameters.AddWithValue("$hash", HashSenha.Gerar(senhaEmTexto));
        cmd.Parameters.AddWithValue("$empresa", empresaChave);
        cmd.Parameters.AddWithValue("$nome", nome);
        cmd.Parameters.AddWithValue("$ativo", ativo ? 1 : 0);
        cmd.ExecuteNonQuery();
    }

    public int Contar()
    {
        using var c = Abrir();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM usuario_app;";
        return Convert.ToInt32(cmd.ExecuteScalar());
    }

    private SqliteConnection Abrir()
    {
        var c = new SqliteConnection(_connectionString);
        c.Open();
        return c;
    }
}
