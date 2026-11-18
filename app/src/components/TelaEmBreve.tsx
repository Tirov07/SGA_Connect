import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { theme } from "../theme";
import { useTema } from "../tema";

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
  const { cores } = useTema();
  return (
    <View
      style={[
        estilos.container,
        { backgroundColor: cores.fundo, paddingTop: insets.top + theme.espaco(3) },
      ]}
    >
      <Text style={[estilos.titulo, { color: cores.texto }]}>{titulo}</Text>
      <View style={estilos.centro}>
        <View style={[estilos.circulo, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
          <Feather name={icone} size={34} color={cores.textoFraco} />
        </View>
        <Text style={[estilos.emBreve, { color: cores.texto }]}>Em breve</Text>
        <Text style={[estilos.desc, { color: cores.textoFraco }]}>
          {descricao ?? "Esta área está em construção."}
        </Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: theme.espaco(2.5) },
  titulo: { fontSize: theme.fonte.titulo, fontFamily: theme.familia.extrabold },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: theme.espaco(1.5) },
  circulo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.espaco(1),
  },
  emBreve: { fontSize: theme.fonte.secao, fontFamily: theme.familia.bold },
  desc: {
    fontSize: theme.fonte.corpo,
    textAlign: "center",
    maxWidth: 260,
    fontFamily: theme.familia.regular,
  },
});
