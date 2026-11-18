import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import Svg, { Line, Circle, Text as SvgText } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { theme } from "../theme";
import { useTema } from "../tema";
import { moeda, dataBr } from "../format";
import { PontoSaldo } from "../api";

const ALTURA = 170; // area do desenho (linha)
const PAD_V = 12; // respiro vertical
const EIXO_Y = 52; // largura reservada p/ os rotulos de valor (esquerda)
const EIXO_X = 18; // altura reservada p/ as datas (base)

const VERDE = theme.grafico.servico; // teal (positivo)

/** "AAAA-MM-DD" -> "13/08" */
function diaMes(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Valor curto para o eixo Y: 1.2k / 980 / -3.4k */
function curto(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(1).replace(".0", "")}k`;
  return String(Math.round(v));
}

/**
 * Grafico de saldo estilo bolsa, com eixos rotulados (R$ no Y, datas no X).
 * A linha e BICOLOR por trecho: vermelha onde o saldo e negativo, verde onde positivo.
 * Toque-e-segura mostra o saldo + data do ponto (vermelho se negativo).
 */
export function GraficoSaldo({ pontos }: { pontos: PontoSaldo[] }) {
  const { cores } = useTema();
  const [sel, setSel] = useState<number | null>(null);
  const [largura, setLargura] = useState(0);

  const n = pontos.length;
  const { min, max } = useMemo(() => {
    const vals = pontos.map((p) => p.saldo);
    return { min: Math.min(0, ...vals), max: Math.max(0, ...vals) };
  }, [pontos]);
  const faixa = max - min || 1;

  const larguraPlot = Math.max(0, largura - EIXO_Y);
  const alturaPlot = ALTURA - EIXO_X;

  const px = (i: number) => EIXO_Y + (n <= 1 ? larguraPlot / 2 : (i / (n - 1)) * larguraPlot);
  const py = (v: number) => PAD_V + (1 - (v - min) / faixa) * (alturaPlot - PAD_V * 2);
  const cor = (v: number) => (v < 0 ? cores.primaria : VERDE);

  // Segmentos da linha, divididos no cruzamento do zero para trocar a cor exatamente ali.
  const segmentos = useMemo(() => {
    const segs: { x1: number; y1: number; x2: number; y2: number; cor: string }[] = [];
    for (let i = 0; i < n - 1; i++) {
      const a = pontos[i].saldo;
      const b = pontos[i + 1].saldo;
      const xa = px(i), xb = px(i + 1);
      if ((a < 0) === (b < 0) || a === 0 || b === 0) {
        segs.push({ x1: xa, y1: py(a), x2: xb, y2: py(b), cor: cor(a < 0 || b < 0 ? Math.min(a, b) : a) });
      } else {
        // cruza o zero: ponto de cruzamento por interpolacao linear
        const t = Math.abs(a) / (Math.abs(a) + Math.abs(b));
        const xc = xa + (xb - xa) * t;
        const yc = py(0);
        segs.push({ x1: xa, y1: py(a), x2: xc, y2: yc, cor: cor(a) });
        segs.push({ x1: xc, y1: yc, x2: xb, y2: py(b), cor: cor(b) });
      }
    }
    return segs;
  }, [pontos, largura, min, max, cores]);

  // Rotulos do eixo Y (4 niveis: max, 2 intermediarios, min).
  const niveisY = useMemo(() => {
    const vals: number[] = [];
    for (let k = 0; k <= 3; k++) vals.push(max - (faixa * k) / 3);
    return vals;
  }, [min, max]);

  const pan = Gesture.Pan()
    .onBegin((e) => {
      if (n === 0) return;
      const i = Math.round(((e.x - EIXO_Y) / larguraPlot) * (n - 1));
      runOnJS(setSel)(Math.max(0, Math.min(n - 1, i)));
    })
    .onUpdate((e) => {
      if (n === 0) return;
      const i = Math.round(((e.x - EIXO_Y) / larguraPlot) * (n - 1));
      runOnJS(setSel)(Math.max(0, Math.min(n - 1, i)));
    })
    .onFinalize(() => runOnJS(setSel)(null));

  const p = sel != null ? pontos[sel] : null;
  const saldoMostrado = p ? p.saldo : pontos[n - 1]?.saldo ?? 0;

  function medir(e: LayoutChangeEvent) {
    setLargura(e.nativeEvent.layout.width);
  }

  return (
    <View>
      <View style={estilos.cabecalho}>
        <Text style={[estilos.valor, { color: cor(saldoMostrado) }]}>{moeda(saldoMostrado)}</Text>
        <Text style={[estilos.data, { color: cores.textoFraco }]}>{p ? dataBr(p.data) : "Saldo atual"}</Text>
      </View>

      <GestureDetector gesture={pan}>
        <View onLayout={medir}>
          {largura > 0 && n > 0 && (
            <Svg width={largura} height={ALTURA}>
              {/* grade + rotulos do eixo Y */}
              {niveisY.map((v, k) => (
                <React.Fragment key={k}>
                  <Line x1={EIXO_Y} y1={py(v)} x2={largura} y2={py(v)} stroke={cores.borda} strokeWidth={1} strokeDasharray="3 5" opacity={0.6} />
                  <SvgText x={EIXO_Y - 6} y={py(v) + 3} fill={cores.textoApagado} fontSize={9} textAnchor="end">
                    {curto(v)}
                  </SvgText>
                </React.Fragment>
              ))}

              {/* linha do zero (se dentro da faixa) mais marcada */}
              {min < 0 && max > 0 && (
                <Line x1={EIXO_Y} y1={py(0)} x2={largura} y2={py(0)} stroke={cores.textoApagado} strokeWidth={1} />
              )}

              {/* a linha do saldo (bicolor por trecho) */}
              {segmentos.map((s, i) => (
                <Line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.cor} strokeWidth={2.5} strokeLinecap="round" />
              ))}

              {/* rotulos do eixo X (datas) — mostra algumas para nao poluir */}
              {pontos.map((pt, i) => {
                const mostrar = n <= 8 || i === 0 || i === n - 1 || i % Math.ceil(n / 6) === 0;
                if (!mostrar) return null;
                return (
                  <SvgText key={i} x={px(i)} y={ALTURA - 4} fill={cores.textoApagado} fontSize={9} textAnchor="middle">
                    {diaMes(pt.data)}
                  </SvgText>
                );
              })}

              {/* indicador do ponto selecionado */}
              {p != null && sel != null && (
                <>
                  <Line x1={px(sel)} y1={0} x2={px(sel)} y2={alturaPlot} stroke={cores.textoApagado} strokeWidth={1} />
                  <Circle cx={px(sel)} cy={py(p.saldo)} r={5} fill={cor(p.saldo)} stroke={cores.fundo} strokeWidth={2} />
                </>
              )}
            </Svg>
          )}
        </View>
      </GestureDetector>

      {n === 0 ? (
        <Text style={[estilos.vazio, { color: cores.textoApagado }]}>Sem movimento no período.</Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { marginBottom: theme.espaco(1) },
  valor: { fontSize: theme.fonte.titulo, fontFamily: theme.familia.extrabold },
  data: { fontSize: theme.fonte.pequeno, marginTop: 2 },
  vazio: { fontSize: theme.fonte.corpo, textAlign: "center", paddingVertical: theme.espaco(3) },
});
