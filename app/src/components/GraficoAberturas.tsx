import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { theme } from "../theme";
import { useTema } from "../tema";
import { diaMes } from "../format";
import { OsAberturaDia } from "../api";

const ALTURA = 150;
const PAD_TOPO = 10;

/** Só o dia "AAAA-MM-DD" -> "13" (rótulo sob a barra). */
function soDia(iso: string): string {
  return iso.split("-")[2];
}

/**
 * Grafico de barras EMPILHADAS das OSv abertas por dia:
 *   base = COM LAUDO (primaria), topo = SEM LAUDO (atencao/ambar).
 * Pressionar/arrastar numa coluna destaca ela e dispara onSelecionar(dia) para a tela
 * mostrar a quebra com/sem laudo daquele dia. Solta -> onSelecionar(null).
 */
export function GraficoAberturas({
  dias,
  onSelecionar,
}: {
  dias: OsAberturaDia[];
  onSelecionar?: (dia: OsAberturaDia | null) => void;
}) {
  const { cores } = useTema();
  const [sel, setSel] = useState<number | null>(null);
  const [largura, setLargura] = useState(0);

  const corCom = theme.grafico.laudo;
  const corSem = theme.grafico.semLaudo;

  const maxTotal = useMemo(() => Math.max(1, ...dias.map((d) => d.total)), [dias]);

  const n = dias.length;
  const gap = n > 1 ? Math.max(6, Math.min(16, largura * 0.03)) : 0;
  const larguraBarra = n > 0 ? Math.max(6, (largura - gap * (n - 1)) / n) : 0;
  const passo = larguraBarra + gap;

  function selecionar(i: number | null) {
    setSel(i);
    onSelecionar?.(i == null ? null : dias[i]);
  }

  const pan = Gesture.Pan()
    .activateAfterLongPress(120)
    .onBegin((e) => {
      const i = Math.floor(e.x / passo);
      runOnJS(selecionar)(Math.max(0, Math.min(n - 1, i)));
    })
    .onUpdate((e) => {
      const i = Math.floor(e.x / passo);
      runOnJS(selecionar)(Math.max(0, Math.min(n - 1, i)));
    })
    .onFinalize(() => runOnJS(selecionar)(null));

  const selecionado = sel != null ? dias[sel] : null;

  function medir(e: LayoutChangeEvent) {
    setLargura(e.nativeEvent.layout.width);
  }

  return (
    <View>
      {/* Legenda */}
      <View style={estilos.legenda}>
        <View style={estilos.legItem}>
          <View style={[estilos.bolinha, { backgroundColor: corCom }]} />
          <Text style={[estilos.legTxt, { color: cores.textoFraco }]}>Com laudo</Text>
        </View>
        <View style={estilos.legItem}>
          <View style={[estilos.bolinha, { backgroundColor: corSem }]} />
          <Text style={[estilos.legTxt, { color: cores.textoFraco }]}>Sem laudo</Text>
        </View>
      </View>

      <GestureDetector gesture={pan}>
        <View onLayout={medir}>
          {/* Tooltip sobreposto */}
          {selecionado ? (
            <View
              style={[estilos.tip, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}
              pointerEvents="none"
            >
              <Text style={[estilos.tipData, { color: cores.textoFraco }]}>{diaMes(selecionado.data)}</Text>
              <Text style={[estilos.tipTotal, { color: cores.texto }]}>{selecionado.total} OS</Text>
              <View style={estilos.tipLinha}>
                <View style={[estilos.bolinha, { backgroundColor: corCom }]} />
                <Text style={[estilos.tipLabel, { color: cores.textoFraco }]}>Com laudo</Text>
                <Text style={[estilos.tipValor, { color: cores.texto }]}>{selecionado.comLaudo}</Text>
              </View>
              <View style={estilos.tipLinha}>
                <View style={[estilos.bolinha, { backgroundColor: corSem }]} />
                <Text style={[estilos.tipLabel, { color: cores.textoFraco }]}>Sem laudo</Text>
                <Text style={[estilos.tipValor, { color: cores.texto }]}>{selecionado.semLaudo}</Text>
              </View>
            </View>
          ) : null}

          {largura > 0 && (
            <>
              <Svg width={largura} height={ALTURA}>
                {dias.map((d, i) => {
                  const x = i * passo;
                  const hCom = (d.comLaudo / maxTotal) * (ALTURA - PAD_TOPO);
                  const hSem = (d.semLaudo / maxTotal) * (ALTURA - PAD_TOPO);
                  const yCom = ALTURA - hCom;
                  const ySem = yCom - hSem;
                  const apagado = sel != null && sel !== i;
                  const op = apagado ? 0.3 : 1;
                  return (
                    <React.Fragment key={d.data}>
                      <Rect x={x} y={yCom} width={larguraBarra} height={Math.max(0, hCom)} rx={3} fill={corCom} opacity={op} />
                      <Rect x={x} y={ySem} width={larguraBarra} height={Math.max(0, hSem)} rx={3} fill={corSem} opacity={op} />
                    </React.Fragment>
                  );
                })}
              </Svg>
              <View style={{ flexDirection: "row" }}>
                {dias.map((d, i) => (
                  <Text
                    key={d.data}
                    style={[
                      estilos.rotulo,
                      {
                        width: larguraBarra,
                        marginRight: i < n - 1 ? gap : 0,
                        color: sel === i ? cores.texto : cores.textoApagado,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {soDia(d.data)}
                  </Text>
                ))}
              </View>
            </>
          )}
        </View>
      </GestureDetector>
    </View>
  );
}

const estilos = StyleSheet.create({
  tip: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 10,
    borderRadius: theme.raio.md,
    borderWidth: 1,
    padding: theme.espaco(1.5),
    minWidth: 150,
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
  rotulo: { fontSize: 9, textAlign: "center", marginTop: 6 },
});
