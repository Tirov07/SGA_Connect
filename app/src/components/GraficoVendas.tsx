import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { theme } from "../theme";
import { useTema } from "../tema";
import { moeda } from "../format";
import { VendaDia } from "../api";

const COR_PECA = theme.grafico.peca; // ambar
const COR_SERVICO = theme.grafico.servico; // teal

const ALTURA = 180; // altura da area das barras
const LARGURA_BARRA = 26;
const GAP = 12;
const PAD_TOPO = 8;

/** Formata "AAAA-MM-DD" -> "13/08" */
function diaMes(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/**
 * Grafico de barras EMPILHADAS (ambar = peca, teal = servico) dos dias com movimento.
 * Pressionar/arrastar sobre uma coluna destaca ela e mostra um tooltip com o total do dia
 * e a quebra peca/servico. As demais colunas ficam esmaecidas enquanto se interage.
 */
export function GraficoVendas({ dias }: { dias: VendaDia[] }) {
  const { cores } = useTema();
  const [sel, setSel] = useState<number | null>(null);

  const maxTotal = useMemo(() => Math.max(1, ...dias.map((d) => d.total)), [dias]);
  const larguraConteudo = dias.length * (LARGURA_BARRA + GAP) + GAP;

  // Gesto: toque longo + arraste; calcula a coluna sob o dedo pela posicao X.
  const pan = Gesture.Pan()
    .activateAfterLongPress(120)
    .onBegin((e) => {
      const i = Math.floor((e.x - GAP) / (LARGURA_BARRA + GAP));
      runOnJS(setSel)(Math.max(0, Math.min(dias.length - 1, i)));
    })
    .onUpdate((e) => {
      const i = Math.floor((e.x - GAP) / (LARGURA_BARRA + GAP));
      runOnJS(setSel)(Math.max(0, Math.min(dias.length - 1, i)));
    })
    .onFinalize(() => runOnJS(setSel)(null));

  const selecionado = sel != null ? dias[sel] : null;

  return (
    <View>
      {/* Area do tooltip: reserva altura fixa (sem texto de dica) para o layout nao pular */}
      <View style={estilos.tipArea}>
        {selecionado ? (
          <View style={[estilos.tip, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
            <Text style={[estilos.tipData, { color: cores.textoFraco }]}>{diaMes(selecionado.data)}</Text>
            <Text style={[estilos.tipTotal, { color: cores.texto }]}>{moeda(selecionado.total)}</Text>
            <View style={estilos.tipLinha}>
              <View style={[estilos.bolinha, { backgroundColor: COR_PECA }]} />
              <Text style={[estilos.tipLabel, { color: cores.textoFraco }]}>Peça</Text>
              <Text style={[estilos.tipValor, { color: cores.texto }]}>{moeda(selecionado.peca)}</Text>
            </View>
            <View style={estilos.tipLinha}>
              <View style={[estilos.bolinha, { backgroundColor: COR_SERVICO }]} />
              <Text style={[estilos.tipLabel, { color: cores.textoFraco }]}>Serviço</Text>
              <Text style={[estilos.tipValor, { color: cores.texto }]}>{moeda(selecionado.servico)}</Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Legenda */}
      <View style={estilos.legenda}>
        <View style={estilos.legItem}>
          <View style={[estilos.bolinha, { backgroundColor: COR_PECA }]} />
          <Text style={[estilos.legTxt, { color: cores.textoFraco }]}>Peça</Text>
        </View>
        <View style={estilos.legItem}>
          <View style={[estilos.bolinha, { backgroundColor: COR_SERVICO }]} />
          <Text style={[estilos.legTxt, { color: cores.textoFraco }]}>Serviço</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <GestureDetector gesture={pan}>
          <View>
            <Svg width={larguraConteudo} height={ALTURA}>
              {dias.map((d, i) => {
                const x = GAP + i * (LARGURA_BARRA + GAP);
                const hServico = (d.servico / maxTotal) * (ALTURA - PAD_TOPO);
                const hPeca = (d.peca / maxTotal) * (ALTURA - PAD_TOPO);
                const yServico = ALTURA - hServico;
                const yPeca = yServico - hPeca;
                const apagado = sel != null && sel !== i;
                const op = apagado ? 0.3 : 1;
                return (
                  <React.Fragment key={d.data}>
                    {/* servico (teal) embaixo */}
                    <Rect x={x} y={yServico} width={LARGURA_BARRA} height={Math.max(0, hServico)} rx={3} fill={COR_SERVICO} opacity={op} />
                    {/* peca (ambar) em cima */}
                    <Rect x={x} y={yPeca} width={LARGURA_BARRA} height={Math.max(0, hPeca)} rx={3} fill={COR_PECA} opacity={op} />
                  </React.Fragment>
                );
              })}
            </Svg>
            {/* rotulos de data sob as barras */}
            <View style={{ width: larguraConteudo, flexDirection: "row" }}>
              {dias.map((d, i) => (
                <Text
                  key={d.data}
                  style={[
                    estilos.rotulo,
                    {
                      width: LARGURA_BARRA + GAP,
                      marginLeft: i === 0 ? GAP - GAP / 2 : 0,
                      color: sel === i ? cores.texto : cores.textoApagado,
                    },
                  ]}
                >
                  {diaMes(d.data)}
                </Text>
              ))}
            </View>
          </View>
        </GestureDetector>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tipArea: { minHeight: 92, justifyContent: "center" },
  tip: {
    borderRadius: theme.raio.md,
    borderWidth: 1,
    padding: theme.espaco(1.5),
    alignSelf: "flex-start",
    minWidth: 180,
  },
  tipData: { fontSize: theme.fonte.pequeno, fontFamily: theme.familia.bold },
  tipTotal: { fontSize: theme.fonte.secao, fontFamily: theme.familia.extrabold, marginVertical: 2 },
  tipLinha: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  tipLabel: { fontSize: theme.fonte.pequeno, flex: 1, marginLeft: 6 },
  tipValor: { fontSize: theme.fonte.pequeno, fontFamily: theme.familia.bold },
  legenda: { flexDirection: "row", gap: theme.espaco(2), marginBottom: theme.espaco(1) },
  legItem: { flexDirection: "row", alignItems: "center" },
  legTxt: { fontSize: theme.fonte.pequeno, marginLeft: 6 },
  bolinha: { width: 10, height: 10, borderRadius: 5 },
  rotulo: { fontSize: 10, textAlign: "center", marginTop: 6 },
});
