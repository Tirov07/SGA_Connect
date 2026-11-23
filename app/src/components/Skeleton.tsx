import React, { useEffect } from "react";
import { View, StyleSheet, DimensionValue } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { theme } from "../theme";
import { useTema } from "../tema";
import { Card } from "./Card";

/** Bloco cinza com pulso de opacidade (placeholder de carregamento). */
export function SkeletonBloco({
  largura = "100%",
  altura = 14,
  raio = 6,
  estilo,
}: {
  largura?: DimensionValue;
  altura?: number;
  raio?: number;
  estilo?: any;
}) {
  const { cores } = useTema();
  const op = useSharedValue(0.5);

  useEffect(() => {
    op.value = withRepeat(withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [op]);

  const anim = useAnimatedStyle(() => ({ opacity: op.value }));

  return (
    <Animated.View
      style={[{ width: largura, height: altura, borderRadius: raio, backgroundColor: cores.superficie2 }, anim, estilo]}
    />
  );
}

/** Alguns cards "fantasma" imitando itens de lista enquanto os dados carregam. */
export function SkeletonLista({ linhas = 4 }: { linhas?: number }) {
  return (
    <View style={{ paddingHorizontal: theme.espaco(2.5) }}>
      {Array.from({ length: linhas }).map((_, i) => (
        <Card key={i} style={estilos.card}>
          <View style={estilos.linhaTopo}>
            <SkeletonBloco largura="55%" altura={15} />
            <SkeletonBloco largura={72} altura={15} />
          </View>
          <SkeletonBloco largura="40%" altura={12} estilo={{ marginTop: theme.espaco(1.25) }} />
          <SkeletonBloco largura="80%" altura={10} estilo={{ marginTop: theme.espaco(1) }} />
        </Card>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  card: { padding: theme.espaco(1.75), marginBottom: theme.espaco(1.25) },
  linhaTopo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
