import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../theme";
import { useTema } from "../tema";

/**
 * Cabecalho padrao das vistas internas: botao voltar (opcional) + titulo centralizado.
 * Mantem o titulo no centro reservando a mesma largura dos dois lados.
 */
export function TelaHeader({
  titulo,
  onVoltar,
  direita,
}: {
  titulo: string;
  onVoltar?: () => void;
  direita?: React.ReactNode;
}) {
  const { cores } = useTema();
  return (
    <View style={estilos.topo}>
      <View style={estilos.lado}>
        {onVoltar ? (
          <TouchableOpacity onPress={onVoltar} style={estilos.btnVoltar} accessibilityLabel="Voltar">
            <Feather name="chevron-left" size={26} color={cores.texto} />
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={[estilos.titulo, { color: cores.texto }]} numberOfLines={1}>
        {titulo}
      </Text>
      <View style={[estilos.lado, { alignItems: "flex-end" }]}>{direita}</View>
    </View>
  );
}

const estilos = StyleSheet.create({
  topo: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.espaco(2),
    marginBottom: theme.espaco(1),
  },
  lado: { width: 40, justifyContent: "center" },
  btnVoltar: { padding: 4, alignSelf: "flex-start" },
  titulo: {
    flex: 1,
    textAlign: "center",
    fontSize: theme.fonte.secao,
    fontFamily: theme.familia.extrabold,
    letterSpacing: theme.tracking.titulo,
  },
});
