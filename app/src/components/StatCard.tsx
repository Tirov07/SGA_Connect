import React from "react";
import { Text, StyleSheet } from "react-native";
import { Card } from "./Card";
import { theme } from "../theme";
import { useTema } from "../tema";

type Props = {
  rotulo: string;
  valor: string;
  cor?: string;
  legenda?: string;
};

/** Card de indicador (numero grande + rotulo), cara de dashboard. */
export function StatCard({ rotulo, valor, cor, legenda }: Props) {
  const { cores } = useTema();
  return (
    <Card style={estilos.card}>
      <Text style={[estilos.rotulo, { color: cores.textoFraco }]} numberOfLines={1}>
        {rotulo}
      </Text>
      <Text
        style={[estilos.valor, { color: cor ?? cores.texto }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {valor}
      </Text>
      {legenda ? <Text style={[estilos.legenda, { color: cores.textoApagado }]}>{legenda}</Text> : null}
    </Card>
  );
}

const estilos = StyleSheet.create({
  card: { flex: 1, minHeight: 112, justifyContent: "space-between" },
  rotulo: {
    fontSize: theme.fonte.pequeno,
    fontFamily: theme.familia.semibold,
    textTransform: "uppercase",
    letterSpacing: theme.tracking.rotulo,
  },
  valor: {
    fontSize: theme.fonte.numeroCard,
    fontFamily: theme.familia.extrabold,
    marginTop: theme.espaco(1),
    letterSpacing: theme.tracking.numero,
  },
  legenda: { fontSize: theme.fonte.pequeno, marginTop: theme.espaco(0.5) },
});
