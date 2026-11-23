import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../theme";
import { useTema } from "../tema";

type Tom = "neutro" | "positivo" | "negativo";

/** Mistura uma cor com o fundo (hex #RRGGBB) para um tom suave de card. */
function suave(hex: string, fundoClaro: boolean): string {
  // alpha baixo sobre fundo; aqui usamos uma versao translucida simples.
  const a = fundoClaro ? "1A" : "26"; // ~10% claro / ~15% escuro
  return `${hex}${a}`;
}

/**
 * Card de total destacado (estilo extrato/resumo): rotulo + valor grande, com fundo
 * sutilmente colorido conforme o tom. Aceita linhas auxiliares (ex.: peca/servico).
 */
export function CardTotal({
  rotulo,
  valor,
  tom = "neutro",
  sub,
}: {
  rotulo: string;
  valor: string;
  tom?: Tom;
  sub?: string;
}) {
  const { cores, nome } = useTema();
  const claro = nome === "claro";

  const corTexto =
    tom === "positivo" ? cores.positivo : tom === "negativo" ? cores.negativo : cores.texto;
  const base =
    tom === "positivo" ? cores.positivo : tom === "negativo" ? cores.negativo : cores.primaria;

  return (
    <View style={[estilos.card, { backgroundColor: suave(base, claro), borderColor: cores.borda }]}>
      <Text style={[estilos.rotulo, { color: cores.textoFraco }]}>{rotulo}</Text>
      <Text style={[estilos.valor, { color: corTexto }]} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      {sub ? <Text style={[estilos.sub, { color: cores.textoApagado }]}>{sub}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  card: {
    borderRadius: theme.raio.lg,
    borderWidth: 1,
    paddingVertical: theme.espaco(1.75),
    paddingHorizontal: theme.espaco(2),
    alignItems: "center",
  },
  rotulo: { fontSize: theme.fonte.pequeno, fontFamily: theme.familia.semibold, letterSpacing: theme.tracking.rotulo, textTransform: "uppercase" },
  valor: { fontSize: theme.fonte.titulo, fontFamily: theme.familia.extrabold, letterSpacing: theme.tracking.numero, marginTop: 4 },
  sub: { fontSize: theme.fonte.pequeno, marginTop: 4 },
});
