import React, { useState } from "react";
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
import { EmpresaDoUsuario, ApiError } from "../src/api";
import { theme } from "../src/theme";
import { APP_NOME } from "../src/config";

export default function Login() {
  const { entrar } = useAuth();
  const insets = useSafeAreaInsets();

  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Quando o CPF existe em varias empresas, guardamos a lista para o usuario escolher.
  const [empresas, setEmpresas] = useState<EmpresaDoUsuario[] | null>(null);

  async function tentar(empresa?: string) {
    setErro(null);
    if (!cpf.trim() || !senha) {
      setErro("Informe CPF e senha.");
      return;
    }
    setEnviando(true);
    try {
      const r = await entrar(cpf.trim(), senha, empresa);
      if (r.tipo === "escolher") {
        setEmpresas(r.empresas); // mostra o seletor de empresa (so as do usuario)
      }
      // se tipo === "ok", o Guardiao redireciona para a home automaticamente
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Falha ao entrar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const escolhendo = empresas !== null;

  return (
    <KeyboardAvoidingView
      style={estilos.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[estilos.scroll, { paddingTop: insets.top + theme.espaco(7) }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={estilos.marca}>
          <View style={estilos.logo}>
            <Text style={estilos.logoTxt}>SGA</Text>
          </View>
          <Text style={estilos.titulo}>{APP_NOME}</Text>
          <Text style={estilos.subtitulo}>Acompanhe seu negocio em tempo real</Text>
        </View>

        {!escolhendo ? (
          <View style={estilos.form}>
            <Text style={estilos.label}>CPF</Text>
            <TextInput
              style={estilos.input}
              value={cpf}
              onChangeText={setCpf}
              placeholder="Somente numeros"
              placeholderTextColor={theme.cores.textoApagado}
              keyboardType="number-pad"
              autoCapitalize="none"
              editable={!enviando}
            />

            <Text style={estilos.label}>Senha</Text>
            <TextInput
              style={estilos.input}
              value={senha}
              onChangeText={setSenha}
              placeholder="Sua senha"
              placeholderTextColor={theme.cores.textoApagado}
              secureTextEntry
              editable={!enviando}
              onSubmitEditing={() => tentar()}
            />

            {erro ? <Text style={estilos.erro}>{erro}</Text> : null}

            <TouchableOpacity
              style={[estilos.botao, enviando && { opacity: 0.6 }]}
              onPress={() => tentar()}
              disabled={enviando}
            >
              {enviando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={estilos.botaoTxt}>Entrar</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={estilos.form}>
            <Text style={estilos.escolhaTitulo}>Escolha a empresa</Text>
            <Text style={estilos.escolhaSub}>
              Seu acesso esta vinculado a mais de uma empresa.
            </Text>

            {empresas!.map((e) => (
              <TouchableOpacity
                key={e.empresa}
                style={estilos.empresaItem}
                onPress={() => tentar(e.empresa)}
                disabled={enviando}
              >
                <View style={{ flex: 1 }}>
                  <Text style={estilos.empresaNome}>{e.empresa.toUpperCase()}</Text>
                  <Text style={estilos.empresaDono}>{e.nome}</Text>
                </View>
                <Text style={estilos.empresaSeta}>›</Text>
              </TouchableOpacity>
            ))}

            {enviando ? (
              <ActivityIndicator color={theme.cores.primaria} style={{ marginTop: theme.espaco(2) }} />
            ) : null}
            {erro ? <Text style={estilos.erro}>{erro}</Text> : null}

            <TouchableOpacity
              style={estilos.voltar}
              onPress={() => {
                setEmpresas(null);
                setErro(null);
              }}
              disabled={enviando}
            >
              <Text style={estilos.voltarTxt}>Voltar</Text>
            </TouchableOpacity>
          </View>
        )}
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
  escolhaTitulo: {
    color: theme.cores.texto,
    fontSize: theme.fonte.secao,
    fontWeight: "800",
    marginBottom: theme.espaco(0.5),
  },
  escolhaSub: {
    color: theme.cores.textoFraco,
    fontSize: theme.fonte.corpo,
    marginBottom: theme.espaco(2),
  },
  empresaItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.cores.superficie,
    borderWidth: 1,
    borderColor: theme.cores.borda,
    borderRadius: theme.raio.md,
    paddingVertical: theme.espaco(2),
    paddingHorizontal: theme.espaco(2),
    marginBottom: theme.espaco(1.5),
  },
  empresaNome: { color: theme.cores.texto, fontSize: theme.fonte.corpo, fontWeight: "800" },
  empresaDono: { color: theme.cores.textoFraco, fontSize: theme.fonte.pequeno, marginTop: 2 },
  empresaSeta: { color: theme.cores.primaria, fontSize: 28, fontWeight: "800" },
  voltar: { alignItems: "center", marginTop: theme.espaco(2) },
  voltarTxt: { color: theme.cores.textoFraco, fontSize: theme.fonte.corpo, fontWeight: "600" },
});
