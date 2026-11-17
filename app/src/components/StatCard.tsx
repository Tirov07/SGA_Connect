import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Card } from "./Card";
import { theme } from "../theme";

type Props = {
  rotulo: string;
  valor: string;
  cor?: string;
  legenda?: string;
};

/** Card de indicador (numero grande + rotulo), cara de dashboard. */
export function StatCard({ rotulo, valor, cor, legenda }: Props) {
  return (
    <Card style={estilos.card}>
      <Text style={estilos.rotulo} numberOfLines={1}>
        {rotulo}
      </Text>
      <Text style={[estilos.valor, cor ? { color: cor } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      {legenda ? <Text style={estilos.legenda}>{legenda}</Text> : null}
    </Card>
  );
}

const estilos = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 112,
    justifyContent: "space-between",
  },
  rotulo: {
    color: theme.cores.textoFraco,
    fontSize: theme.fonte.pequeno,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  valor: {
    color: theme.cores.texto,
    fontSize: theme.fonte.numeroCard,
    fontWeight: "800",
    marginTop: theme.espaco(1),
  },
  legenda: {
    color: theme.cores.textoApagado,
    fontSize: theme.fonte.pequeno,
    marginTop: theme.espaco(0.5),
  },
});
