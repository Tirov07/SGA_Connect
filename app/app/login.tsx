import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../src/auth";
import { api, Empresa, ApiError } from "../src/api";
import { theme } from "../src/theme";
import { APP_NOME } from "../src/config";

export default function Login() {
  const { entrar } = useAuth();
  const insets = useSafeAreaInsets();

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresa, setEmpresa] = useState<string>("");
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const lista = await api.listarEmpresas();
        setEmpresas(lista);
        if (lista.length === 1) setEmpresa(lista[0].chave);
      } catch {
        setErro("Nao consegui falar com o servidor. Confira a conexao.");
      } finally {
        setCarregandoEmpresas(false);
      }
    })();
  }, []);

  async function aoEntrar() {
    setErro(null);
    if (!empresa) return setErro("Selecione a empresa.");
    if (!cpf.trim() || !senha) return setErro("Informe CPF e senha.");
    setEnviando(true);
    try {
      await entrar(cpf.trim(), senha, empresa);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Falha ao entrar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[estilos.scroll, { paddingTop: insets.top + theme.espaco(6) }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={estilos.marca}>
          <View style={estilos.logo}>
            <Text style={estilos.logoTxt}>SGA</Text>
          </View>
          <Text style={estilos.titulo}>{APP_NOME}</Text>
          <Text style={estilos.subtitulo}>Acompanhe seu negocio em tempo real</Text>
        </View>

        <View style={estilos.form}>
          <Text style={estilos.label}>Empresa</Text>
          {carregandoEmpresas ? (
            <ActivityIndicator color={theme.cores.primaria} style={{ alignSelf: "flex-start" }} />
          ) : (
            <View style={estilos.chips}>
              {empresas.map((e) => {
                const ativa = e.chave === empresa;
                return (
                  <TouchableOpacity
                    key={e.chave}
                    style={[estilos.chip, ativa && estilos.chipAtivo]}
                    onPress={() => setEmpresa(e.chave)}
                  >
                    <Text style={[estilos.chipTxt, ativa && estilos.chipTxtAtivo]}>
                      {e.chave.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {empresas.length === 0 && (
                <Text style={estilos.semEmpresa}>Nenhuma empresa disponivel.</Text>
              )}
            </View>
          )}

          <Text style={estilos.label}>CPF</Text>
          <TextInput
            style={estilos.input}
            value={cpf}
            onChangeText={setCpf}
            placeholder="Somente numeros"
            placeholderTextColor={theme.cores.textoApagado}
            keyboardType="number-pad"
            autoCapitalize="none"
          />

          <Text style={estilos.label}>Senha</Text>
          <TextInput
            style={estilos.input}
            value={senha}
            onChangeText={setSenha}
            placeholder="Sua senha"
            placeholderTextColor={theme.cores.textoApagado}
            secureTextEntry
          />

          {erro ? <Text style={estilos.erro}>{erro}</Text> : null}

          <TouchableOpacity
            style={[estilos.botao, enviando && { opacity: 0.6 }]}
            onPress={aoEntrar}
            disabled={enviando}
          >
            {enviando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={estilos.botaoTxt}>Entrar</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.cores.fundo },
  scroll: { paddingHorizontal: theme.espaco(3), paddingBottom: theme.espaco(6) },
  marca: { alignItems: "center", marginBottom: theme.espaco(5) },
  logo: {
    width: 76,
    height: 76,
    borderRadius: theme.raio.lg,
    backgroundColor: theme.cores.primaria,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.espaco(2),
    ...theme.sombra.card,
  },
  logoTxt: { color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: 1 },
  titulo: { color: theme.cores.texto, fontSize: theme.fonte.titulo, fontWeight: "800" },
  subtitulo: { color: theme.cores.textoFraco, fontSize: theme.fonte.corpo, marginTop: 4 },
  form: { gap: theme.espaco(1) },
  label: {
    color: theme.cores.textoFraco,
    fontSize: theme.fonte.pequeno,
    fontWeight: "600",
    marginTop: theme.espaco(2),
    marginBottom: theme.espaco(0.5),
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.espaco(1) },
  chip: {
    paddingVertical: theme.espaco(1),
    paddingHorizontal: theme.espaco(2),
    borderRadius: theme.raio.pill,
    backgroundColor: theme.cores.superficie2,
    borderWidth: 1,
    borderColor: theme.cores.borda,
  },
  chipAtivo: { backgroundColor: theme.cores.primaria, borderColor: theme.cores.primaria },
  chipTxt: { color: theme.cores.textoFraco, fontWeight: "700", fontSize: theme.fonte.pequeno },
  chipTxtAtivo: { color: "#fff" },
  semEmpresa: { color: theme.cores.textoApagado, fontSize: theme.fonte.corpo },
  input: {
    backgroundColor: theme.cores.superficie2,
    borderWidth: 1,
    borderColor: theme.cores.borda,
    borderRadius: theme.raio.md,
    paddingHorizontal: theme.espaco(2),
    paddingVertical: theme.espaco(1.75),
    color: theme.cores.texto,
    fontSize: theme.fonte.corpo,
  },
  erro: { color: theme.cores.primaria, fontSize: theme.fonte.corpo, marginTop: theme.espaco(1) },
  botao: {
    backgroundColor: theme.cores.primaria,
    borderRadius: theme.raio.md,
    paddingVertical: theme.espaco(2),
    alignItems: "center",
    marginTop: theme.espaco(3),
    ...theme.sombra.card,
  },
  botaoTxt: { color: "#fff", fontSize: theme.fonte.corpo, fontWeight: "800" },
});
