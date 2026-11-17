import React from "react";
import { View, StyleSheet, ViewProps } from "react-native";
import { theme } from "../theme";

export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[estilos.card, style]} {...rest}>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  card: {
    backgroundColor: theme.cores.superficie,
    borderRadius: theme.raio.lg,
    borderWidth: 1,
    borderColor: theme.cores.borda,
    padding: theme.espaco(2),
    ...theme.sombra.card,
  },
});
