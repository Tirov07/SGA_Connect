import React from "react";
import { Text, StyleSheet, TouchableOpacity } from "react-native";
import { theme } from "../theme";

/** Botao do menu principal (OSv, Financeiro, Estoque, Dep. Tecnico). */
export function BotaoMenu({
  rotulo,
  icone,
  onPress,
}: {
  rotulo: string;
  icone: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={estilos.botao} onPress={onPress} activeOpacity={0.8}>
      <Text style={estilos.icone}>{icone}</Text>
      <Text style={estilos.rotulo} numberOfLines={2}>
        {rotulo}
      </Text>
    </TouchableOpacity>
  );
}

const estilos = StyleSheet.create({
  botao: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: theme.cores.superficie,
    borderRadius: theme.raio.md,
    borderWidth: 1,
    borderColor: theme.cores.borda,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.espaco(1),
  },
  icone: { fontSize: 24, marginBottom: 6 },
  rotulo: {
    color: theme.cores.texto,
    fontSize: theme.fonte.pequeno,
    fontWeight: "700",
    textAlign: "center",
  },
});
