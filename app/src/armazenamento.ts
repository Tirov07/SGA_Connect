import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/**
 * Armazenamento da sessao a prova de falha.
 *
 * Preferimos o expo-secure-store (token no Keychain/Keystore, mais seguro). Mas no
 * Expo Go do iOS a chamada NATIVA pode falhar; por isso cada chamada e protegida com
 * try/catch e, se falhar, caimos no AsyncStorage. Assim o app NUNCA crasha por storage.
 */
export const armazenamento = {
  async guardar(chave: string, valor: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(chave, valor);
      return;
    } catch {
      /* cai no AsyncStorage */
    }
    await AsyncStorage.setItem(chave, valor);
  },

  async ler(chave: string): Promise<string | null> {
    try {
      const v = await SecureStore.getItemAsync(chave);
      if (v != null) return v;
    } catch {
      /* cai no AsyncStorage */
    }
    try {
      return await AsyncStorage.getItem(chave);
    } catch {
      return null;
    }
  },

  async apagar(chave: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(chave);
    } catch {
      /* ignora */
    }
    try {
      await AsyncStorage.removeItem(chave);
    } catch {
      /* ignora */
    }
  },
};
