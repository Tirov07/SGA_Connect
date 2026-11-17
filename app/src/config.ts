import Constants from "expo-constants";

/**
 * Endereco da API. Ordem de prioridade:
 *   1) variavel de ambiente EXPO_PUBLIC_API_URL (vem do arquivo .env, que NAO vai pro git);
 *   2) app.json > expo.extra.apiUrl (fallback versionado);
 *   3) http://10.0.2.2:5443 (padrao do emulador Android).
 *
 * Recomendado: crie um arquivo .env na pasta app/ com a sua URL, assim o IP fica so na
 * sua maquina e o git pull nunca mais da conflito no app.json. Exemplo de .env:
 *   EXPO_PUBLIC_API_URL=http://192.168.0.10:5443
 *
 * Dicas de endereco:
 *   - iPhone (Expo Go): IP da sua maquina na Wi-Fi (ex. http://192.168.0.10:5443).
 *   - Emulador Android: http://10.0.2.2:5443.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };

const bruta =
  process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? "http://10.0.2.2:5443";

export const API_URL = bruta.replace(/\/+$/, "");

export const APP_NOME = "SGA Connect";
