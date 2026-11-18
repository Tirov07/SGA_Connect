import React from "react";
import { View, StyleSheet, ViewProps } from "react-native";
import { theme } from "../theme";
import { useTema } from "../tema";

export function Card({ style, children, ...rest }: ViewProps) {
  const { cores } = useTema();
  return (
    <View
      style={[
        estilos.card,
        { backgroundColor: cores.superficie, borderColor: cores.borda, ...cores.sombraCard },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  card: {
    borderRadius: theme.raio.lg,
    borderWidth: 1,
    padding: theme.espaco(2),
  },
});
