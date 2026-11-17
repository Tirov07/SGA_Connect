import Constants from "expo-constants";

/**
 * Endereco da API. Em desenvolvimento, localhost NAO funciona no celular/emulador:
 *   - iPhone (Expo Go): use o IP da sua maquina na rede (ex.: https://192.168.0.10:7443).
 *   - Emulador Android: use http://10.0.2.2:5443 (alias do host no emulador).
 *
 * Deixe a URL em app.json > expo.extra.apiUrl, ou defina aqui no fallback.
 * Ex. de app.json:
 *   "extra": { "apiUrl": "http://10.0.2.2:5443" }
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };

export const API_URL =
  extra.apiUrl?.replace(/\/+$/, "") ?? "http://10.0.2.2:5443";

export const APP_NOME = "SGA Connect";
