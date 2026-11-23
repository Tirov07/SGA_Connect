import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../theme";
import { useTema } from "../tema";

/**
 * Estado vazio padrao: icone grande em circulo suave + titulo + subtitulo opcional.
 * Usado quando uma lista/consulta nao tem dados (em vez de so um texto solto).
 */
export function EstadoVazio({
  icone = "inbox",
  titulo,
  subtitulo,
}: {
  icone?: React.ComponentProps<typeof Feather>["name"];
  titulo: string;
  subtitulo?: string;
}) {
  const { cores } = useTema();
  return (
    <View style={estilos.wrap}>
      <View style={[estilos.circulo, { backgroundColor: cores.superficie2 }]}>
        <Feather name={icone} size={30} color={cores.textoApagado} />
      </View>
      <Text style={[estilos.titulo, { color: cores.textoFraco }]}>{titulo}</Text>
      {subtitulo ? <Text style={[estilos.sub, { color: cores.textoApagado }]}>{subtitulo}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", paddingVertical: theme.espaco(6), paddingHorizontal: theme.espaco(4) },
  circulo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.espaco(2),
  },
  titulo: { fontSize: theme.fonte.corpo, fontFamily: theme.familia.bold, textAlign: "center" },
  sub: { fontSize: theme.fonte.pequeno, textAlign: "center", marginTop: theme.espaco(0.75) },
});
