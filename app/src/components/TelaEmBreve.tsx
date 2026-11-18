import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { theme } from "../theme";

/** Tela provisoria para as abas ainda sem conteudo (OSv, Estoque, etc). */
export function TelaEmBreve({
  titulo,
  icone,
  descricao,
}: {
  titulo: string;
  icone: React.ComponentProps<typeof Feather>["name"];
  descricao?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[estilos.container, { paddingTop: insets.top + theme.espaco(3) }]}>
      <Text style={estilos.titulo}>{titulo}</Text>
      <View style={estilos.centro}>
        <View style={estilos.circulo}>
          <Feather name={icone} size={34} color={theme.cores.textoFraco} />
        </View>
        <Text style={estilos.emBreve}>Em breve</Text>
        <Text style={estilos.desc}>{descricao ?? "Esta área está em construção."}</Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.cores.fundo, paddingHorizontal: theme.espaco(2.5) },
  titulo: {
    color: theme.cores.texto,
    fontSize: theme.fonte.titulo,
    fontFamily: theme.familia.extrabold,
  },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: theme.espaco(1.5) },
  circulo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: theme.cores.superficie,
    borderWidth: 1,
    borderColor: theme.cores.borda,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.espaco(1),
  },
  emBreve: { color: theme.cores.texto, fontSize: theme.fonte.secao, fontFamily: theme.familia.bold },
  desc: {
    color: theme.cores.textoFraco,
    fontSize: theme.fonte.corpo,
    textAlign: "center",
    maxWidth: 260,
    fontFamily: theme.familia.regular,
  },
});
