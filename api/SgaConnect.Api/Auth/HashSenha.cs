using System.Security.Cryptography;
using Microsoft.AspNetCore.Cryptography.KeyDerivation;

namespace SgaConnect.Api.Auth;

/// <summary>
/// Hash de senha com PBKDF2 (mesma familia do ASP.NET Identity).
/// Formato guardado: {iteracoes}.{saltBase64}.{hashBase64}
/// Nunca guardamos a senha em texto puro.
/// </summary>
public static class HashSenha
{
    private const int Iteracoes = 100_000;
    private const int TamanhoSaltBytes = 16;
    private const int TamanhoHashBytes = 32;

    public static string Gerar(string senha)
    {
        var salt = RandomNumberGenerator.GetBytes(TamanhoSaltBytes);
        var hash = KeyDerivation.Pbkdf2(senha, salt, KeyDerivationPrf.HMACSHA256, Iteracoes, TamanhoHashBytes);
        return $"{Iteracoes}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public static bool Conferir(string senha, string hashGuardado)
    {
        if (string.IsNullOrEmpty(hashGuardado)) return false;
        var partes = hashGuardado.Split('.');
        if (partes.Length != 3) return false;

        if (!int.TryParse(partes[0], out var iteracoes)) return false;
        byte[] salt, esperado;
        try
        {
            salt = Convert.FromBase64String(partes[1]);
            esperado = Convert.FromBase64String(partes[2]);
        }
        catch (FormatException) { return false; }

        var calculado = KeyDerivation.Pbkdf2(senha, salt, KeyDerivationPrf.HMACSHA256, iteracoes, esperado.Length);
        return CryptographicOperations.FixedTimeEquals(calculado, esperado);
    }
}
