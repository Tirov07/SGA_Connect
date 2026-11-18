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
import { useTema } from "../src/tema";
import { EmpresaDoUsuario, ApiError } from "../src/api";
import { theme } from "../src/theme";
import { APP_NOME } from "../src/config";

export default function Login() {
  const { entrar } = useAuth();
  const { cores } = useTema();
  const insets = useSafeAreaInsets();

  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
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
      if (r.tipo === "escolher") setEmpresas(r.empresas);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Falha ao entrar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const escolhendo = empresas !== null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[estilos.scroll, { paddingTop: insets.top + theme.espaco(7) }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={estilos.marca}>
          <View style={[estilos.logo, { backgroundColor: cores.primaria, ...cores.sombraCard }]}>
            <Text style={estilos.logoTxt}>SGA</Text>
          </View>
          <Text style={[estilos.titulo, { color: cores.texto }]}>{APP_NOME}</Text>
          <Text style={[estilos.subtitulo, { color: cores.textoFraco }]}>
            Acompanhe seu negócio em tempo real
          </Text>
        </View>

        {!escolhendo ? (
          <View style={estilos.form}>
            <Text style={[estilos.label, { color: cores.textoFraco }]}>CPF</Text>
            <TextInput
              style={[estilos.input, { backgroundColor: cores.superficie2, borderColor: cores.borda, color: cores.texto }]}
              value={cpf}
              onChangeText={setCpf}
              placeholder="Somente números"
              placeholderTextColor={cores.textoApagado}
              keyboardType="number-pad"
              autoCapitalize="none"
              editable={!enviando}
            />

            <Text style={[estilos.label, { color: cores.textoFraco }]}>Senha</Text>
            <TextInput
              style={[estilos.input, { backgroundColor: cores.superficie2, borderColor: cores.borda, color: cores.texto }]}
              value={senha}
              onChangeText={setSenha}
              placeholder="Sua senha"
              placeholderTextColor={cores.textoApagado}
              secureTextEntry
              editable={!enviando}
              onSubmitEditing={() => tentar()}
            />

            {erro ? <Text style={[estilos.erro, { color: cores.primaria }]}>{erro}</Text> : null}

            <TouchableOpacity
              style={[estilos.botao, { backgroundColor: cores.primaria, ...cores.sombraCard }, enviando && { opacity: 0.6 }]}
              onPress={() => tentar()}
              disabled={enviando}
            >
              {enviando ? <ActivityIndicator color="#fff" /> : <Text style={estilos.botaoTxt}>Entrar</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={estilos.form}>
            <Text style={[estilos.escolhaTitulo, { color: cores.texto }]}>Escolha a empresa</Text>
            <Text style={[estilos.escolhaSub, { color: cores.textoFraco }]}>
              Seu acesso está vinculado a mais de uma empresa.
            </Text>

            {empresas!.map((e) => (
              <TouchableOpacity
                key={e.empresa}
                style={[estilos.empresaItem, { backgroundColor: cores.superficie, borderColor: cores.borda }]}
                onPress={() => tentar(e.empresa)}
                disabled={enviando}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[estilos.empresaNome, { color: cores.texto }]}>{e.empresa.toUpperCase()}</Text>
                  <Text style={[estilos.empresaDono, { color: cores.textoFraco }]}>{e.nome}</Text>
                </View>
                <Text style={[estilos.empresaSeta, { color: cores.primaria }]}>›</Text>
              </TouchableOpacity>
            ))}

            {enviando ? (
              <ActivityIndicator color={cores.primaria} style={{ marginTop: theme.espaco(2) }} />
            ) : null}
            {erro ? <Text style={[estilos.erro, { color: cores.primaria }]}>{erro}</Text> : null}

            <TouchableOpacity
              style={estilos.voltar}
              onPress={() => {
                setEmpresas(null);
                setErro(null);
              }}
              disabled={enviando}
            >
              <Text style={[estilos.voltarTxt, { color: cores.textoFraco }]}>Voltar</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  scroll: { paddingHorizontal: theme.espaco(3), paddingBottom: theme.espaco(6) },
  marca: { alignItems: "center", marginBottom: theme.espaco(5) },
  logo: {
    width: 76,
    height: 76,
    borderRadius: theme.raio.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.espaco(2),
  },
  logoTxt: { color: "#fff", fontSize: 28, fontFamily: theme.familia.extrabold, letterSpacing: 1 },
  titulo: { fontSize: theme.fonte.titulo, fontFamily: theme.familia.extrabold },
  subtitulo: { fontSize: theme.fonte.corpo, marginTop: 4, fontFamily: theme.familia.regular },
  form: { gap: theme.espaco(1) },
  label: {
    fontSize: theme.fonte.pequeno,
    fontFamily: theme.familia.semibold,
    marginTop: theme.espaco(2),
    marginBottom: theme.espaco(0.5),
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: theme.raio.md,
    paddingHorizontal: theme.espaco(2),
    paddingVertical: theme.espaco(1.75),
    fontSize: theme.fonte.corpo,
    fontFamily: theme.familia.regular,
  },
  erro: { fontSize: theme.fonte.corpo, marginTop: theme.espaco(1), fontFamily: theme.familia.medio },
  botao: {
    borderRadius: theme.raio.md,
    paddingVertical: theme.espaco(2),
    alignItems: "center",
    marginTop: theme.espaco(3),
  },
  botaoTxt: { color: "#fff", fontSize: theme.fonte.corpo, fontFamily: theme.familia.extrabold },
  escolhaTitulo: { fontSize: theme.fonte.secao, fontFamily: theme.familia.extrabold, marginBottom: theme.espaco(0.5) },
  escolhaSub: { fontSize: theme.fonte.corpo, marginBottom: theme.espaco(2), fontFamily: theme.familia.regular },
  empresaItem: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: theme.raio.md,
    paddingVertical: theme.espaco(2),
    paddingHorizontal: theme.espaco(2),
    marginBottom: theme.espaco(1.5),
  },
  empresaNome: { fontSize: theme.fonte.corpo, fontFamily: theme.familia.extrabold },
  empresaDono: { fontSize: theme.fonte.pequeno, marginTop: 2, fontFamily: theme.familia.regular },
  empresaSeta: { fontSize: 28, fontFamily: theme.familia.extrabold },
  voltar: { alignItems: "center", marginTop: theme.espaco(2) },
  voltarTxt: { fontSize: theme.fonte.corpo, fontFamily: theme.familia.semibold },
});
