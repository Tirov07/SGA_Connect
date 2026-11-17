import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme";
import { moeda } from "../format";

type Barra = { rotulo: string; valor: number; cores: [string, string] };

/**
 * Grafico de barras feito com Views + expo-linear-gradient (sem libs nativas "bare",
 * que crasham no Expo Go). Barras proporcionais ao maior valor.
 */
export function BarrasFinanceiro({ barras }: { barras: Barra[] }) {
  const maximo = Math.max(1, ...barras.map((b) => b.valor));
  const alturaMax = 150;

  return (
    <View style={estilos.area}>
      {barras.map((b) => {
        const altura = Math.max(8, (b.valor / maximo) * alturaMax);
        return (
          <View key={b.rotulo} style={estilos.coluna}>
            <Text style={estilos.valor} numberOfLines={1}>
              {moeda(b.valor)}
            </Text>
            <LinearGradient
              colors={b.cores}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[estilos.barra, { height: altura }]}
            />
            <Text style={estilos.rotulo}>{b.rotulo}</Text>
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  area: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    width: "100%",
    paddingTop: theme.espaco(1),
  },
  coluna: { alignItems: "center", flex: 1 },
  barra: {
    width: 56,
    borderRadius: theme.raio.sm,
    marginTop: theme.espaco(1),
  },
  valor: {
    color: theme.cores.texto,
    fontSize: theme.fonte.pequeno,
    fontWeight: "700",
  },
  rotulo: {
    color: theme.cores.textoFraco,
    fontSize: theme.fonte.pequeno,
    marginTop: theme.espaco(1),
  },
});
