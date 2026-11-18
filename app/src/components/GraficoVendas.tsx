import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { theme } from "../theme";
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
 * Grafico de barras EMPILHADAS (azul = peca, vermelho = servico) dos dias com movimento.
 * Pressionar/arrastar sobre uma coluna destaca ela e mostra um tooltip com o total do dia
 * e a quebra peca/servico. As demais colunas ficam esmaecidas enquanto se interage.
 */
export function GraficoVendas({ dias }: { dias: VendaDia[] }) {
  const [sel, setSel] = useState<number | null>(null);

  const maxTotal = useMemo(
    () => Math.max(1, ...dias.map((d) => d.total)),
    [dias]
  );

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
      {/* Tooltip (aparece ao segurar numa coluna) */}
      <View style={estilos.tipArea}>
        {selecionado ? (
          <View style={estilos.tip}>
            <Text style={estilos.tipData}>{diaMes(selecionado.data)}</Text>
            <Text style={estilos.tipTotal}>{moeda(selecionado.total)}</Text>
            <View style={estilos.tipLinha}>
              <View style={[estilos.bolinha, { backgroundColor: COR_PECA }]} />
              <Text style={estilos.tipLabel}>Peça</Text>
              <Text style={estilos.tipValor}>{moeda(selecionado.peca)}</Text>
            </View>
            <View style={estilos.tipLinha}>
              <View style={[estilos.bolinha, { backgroundColor: COR_SERVICO }]} />
              <Text style={estilos.tipLabel}>Serviço</Text>
              <Text style={estilos.tipValor}>{moeda(selecionado.servico)}</Text>
            </View>
          </View>
        ) : (
          <Text style={estilos.dica}>Segure numa barra para ver o detalhe do dia</Text>
        )}
      </View>

      {/* Legenda */}
      <View style={estilos.legenda}>
        <View style={estilos.legItem}>
          <View style={[estilos.bolinha, { backgroundColor: COR_PECA }]} />
          <Text style={estilos.legTxt}>Peça</Text>
        </View>
        <View style={estilos.legItem}>
          <View style={[estilos.bolinha, { backgroundColor: COR_SERVICO }]} />
          <Text style={estilos.legTxt}>Serviço</Text>
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
                    {/* servico (vermelho) embaixo */}
                    <Rect
                      x={x}
                      y={yServico}
                      width={LARGURA_BARRA}
                      height={Math.max(0, hServico)}
                      rx={3}
                      fill={COR_SERVICO}
                      opacity={op}
                    />
                    {/* peca (azul) em cima */}
                    <Rect
                      x={x}
                      y={yPeca}
                      width={LARGURA_BARRA}
                      height={Math.max(0, hPeca)}
                      rx={3}
                      fill={COR_PECA}
                      opacity={op}
                    />
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
                      color: sel === i ? theme.cores.texto : theme.cores.textoApagado,
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
    backgroundColor: theme.cores.superficie2,
    borderRadius: theme.raio.md,
    borderWidth: 1,
    borderColor: theme.cores.borda,
    padding: theme.espaco(1.5),
    alignSelf: "flex-start",
    minWidth: 180,
  },
  tipData: { color: theme.cores.textoFraco, fontSize: theme.fonte.pequeno, fontFamily: theme.familia.bold },
  tipTotal: {
    color: theme.cores.texto,
    fontSize: theme.fonte.secao,
    fontFamily: theme.familia.extrabold,
    marginVertical: 2,
  },
  tipLinha: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  tipLabel: { color: theme.cores.textoFraco, fontSize: theme.fonte.pequeno, flex: 1, marginLeft: 6 },
  tipValor: { color: theme.cores.texto, fontSize: theme.fonte.pequeno, fontFamily: theme.familia.bold },
  dica: { color: theme.cores.textoApagado, fontSize: theme.fonte.pequeno, fontStyle: "italic" },
  legenda: { flexDirection: "row", gap: theme.espaco(2), marginBottom: theme.espaco(1) },
  legItem: { flexDirection: "row", alignItems: "center" },
  legTxt: { color: theme.cores.textoFraco, fontSize: theme.fonte.pequeno, marginLeft: 6 },
  bolinha: { width: 10, height: 10, borderRadius: 5 },
  rotulo: { fontSize: 10, textAlign: "center", marginTop: 6 },
});
