import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import Svg, { Polyline, Line, Circle } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { theme } from "../theme";
import { useTema } from "../tema";
import { moeda, dataBr } from "../format";
import { PontoSaldo } from "../api";

const ALTURA = 170;
const PAD = 10; // respiro vertical

/**
 * Grafico de LINHA estilo bolsa: saldo acumulado ao longo do tempo.
 * Pressionar/arrastar mostra uma linha vertical + o saldo e a data naquele ponto.
 * Verde se o saldo final e >= 0, vermelho se negativo.
 */
export function GraficoSaldo({ pontos }: { pontos: PontoSaldo[] }) {
  const { cores } = useTema();
  const [sel, setSel] = useState<number | null>(null);
  const [largura, setLargura] = useState(0);

  const { min, max } = useMemo(() => {
    const vals = pontos.map((p) => p.saldo);
    return { min: Math.min(0, ...vals), max: Math.max(0, ...vals) };
  }, [pontos]);

  const n = pontos.length;
  const corLinha = (pontos[n - 1]?.saldo ?? 0) >= 0 ? theme.grafico.servico : cores.primaria;

  // Mapeia indice -> x, saldo -> y.
  const x = (i: number) => (n <= 1 ? largura / 2 : (i / (n - 1)) * largura);
  const faixa = max - min || 1;
  const y = (v: number) => PAD + (1 - (v - min) / faixa) * (ALTURA - PAD * 2);

  const pontosStr = useMemo(
    () => pontos.map((p, i) => `${x(i)},${y(p.saldo)}`).join(" "),
    [pontos, largura, min, max]
  );

  const pan = Gesture.Pan()
    .onBegin((e) => {
      if (n === 0) return;
      const i = Math.round((e.x / largura) * (n - 1));
      runOnJS(setSel)(Math.max(0, Math.min(n - 1, i)));
    })
    .onUpdate((e) => {
      if (n === 0) return;
      const i = Math.round((e.x / largura) * (n - 1));
      runOnJS(setSel)(Math.max(0, Math.min(n - 1, i)));
    })
    .onFinalize(() => runOnJS(setSel)(null));

  const p = sel != null ? pontos[sel] : null;

  function medir(e: LayoutChangeEvent) {
    setLargura(e.nativeEvent.layout.width);
  }

  return (
    <View>
      {/* Cabecalho: saldo do ponto selecionado, ou o saldo atual */}
      <View style={estilos.cabecalho}>
        <Text style={[estilos.valor, { color: corLinha }]}>
          {moeda(p ? p.saldo : pontos[n - 1]?.saldo ?? 0)}
        </Text>
        <Text style={[estilos.data, { color: cores.textoFraco }]}>
          {p ? dataBr(p.data) : "Saldo atual"}
        </Text>
      </View>

      <GestureDetector gesture={pan}>
        <View onLayout={medir}>
          {largura > 0 && n > 0 && (
            <Svg width={largura} height={ALTURA}>
              {/* linha de base no zero */}
              <Line x1={0} y1={y(0)} x2={largura} y2={y(0)} stroke={cores.borda} strokeWidth={1} strokeDasharray="4 4" />
              {/* a linha do saldo */}
              <Polyline points={pontosStr} fill="none" stroke={corLinha} strokeWidth={2.5} strokeLinejoin="round" />
              {/* indicador do ponto selecionado */}
              {p != null && sel != null && (
                <>
                  <Line x1={x(sel)} y1={0} x2={x(sel)} y2={ALTURA} stroke={cores.textoApagado} strokeWidth={1} />
                  <Circle cx={x(sel)} cy={y(p.saldo)} r={5} fill={corLinha} stroke={cores.fundo} strokeWidth={2} />
                </>
              )}
            </Svg>
          )}
        </View>
      </GestureDetector>

      {n === 0 ? (
        <Text style={[estilos.vazio, { color: cores.textoApagado }]}>Sem movimento no período.</Text>
      ) : (
        <Text style={[estilos.dica, { color: cores.textoApagado }]}>
          Segure no gráfico para ver o saldo em cada data
        </Text>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { marginBottom: theme.espaco(1) },
  valor: { fontSize: theme.fonte.titulo, fontFamily: theme.familia.extrabold },
  data: { fontSize: theme.fonte.pequeno, marginTop: 2 },
  vazio: { fontSize: theme.fonte.corpo, textAlign: "center", paddingVertical: theme.espaco(3) },
  dica: { fontSize: theme.fonte.pequeno, textAlign: "center", marginTop: theme.espaco(1), fontStyle: "italic" },
});
