import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTema } from "../tema";
import { theme } from "../theme";

/** Botao so com icone (Lua no claro -> vai para escuro; Sol no escuro -> vai para claro). */
export function BotaoTema() {
  const { nome, cores, alternar } = useTema();
  const icone = nome === "claro" ? "moon" : "sun";
  return (
    <TouchableOpacity
      onPress={alternar}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={nome === "claro" ? "Ativar tema escuro" : "Ativar tema claro"}
      style={[
        estilos.botao,
        { backgroundColor: cores.superficie, borderColor: cores.borda },
      ]}
    >
      <Feather name={icone} size={18} color={cores.texto} />
    </TouchableOpacity>
  );
}

const estilos = StyleSheet.create({
  botao: {
    width: 40,
    height: 40,
    borderRadius: theme.raio.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
