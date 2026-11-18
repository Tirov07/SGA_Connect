import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { theme } from "../../src/theme";

/**
 * Tab bar inferior com 5 itens; o item central ("Menu") e destacado num circulo,
 * elevado sobre a barra (estilo apps financeiros). Ordem: OSv, Financeiro, Menu,
 * Estoque, Dep. Tecnico.
 */
type IconeNome = React.ComponentProps<typeof Feather>["name"];

const ABAS: { nome: string; rotulo: string; icone: IconeNome; central?: boolean }[] = [
  { nome: "osv", rotulo: "OSv", icone: "clipboard" },
  { nome: "financeiro", rotulo: "Financeiro", icone: "dollar-sign" },
  { nome: "home", rotulo: "Menu", icone: "grid", central: true },
  { nome: "estoque", rotulo: "Estoque", icone: "box" },
  { nome: "tecnico", rotulo: "Técnico", icone: "tool" },
];

function BarraCustom({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[estilos.barra, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {ABAS.map((aba, i) => {
        const rota = state.routes.find((r: any) => r.name === aba.nome);
        const foco = rota ? state.index === state.routes.indexOf(rota) : false;
        const ir = () => rota && navigation.navigate(aba.nome);

        if (aba.central) {
          return (
            <TouchableOpacity
              key={aba.nome}
              style={estilos.itemCentral}
              onPress={ir}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={aba.rotulo}
            >
              <View style={[estilos.circuloCentral, foco && estilos.circuloCentralAtivo]}>
                <Feather name={aba.icone} size={24} color="#fff" />
              </View>
              <Text style={[estilos.rotulo, foco && estilos.rotuloAtivo]}>{aba.rotulo}</Text>
            </TouchableOpacity>
          );
        }

        const cor = foco ? theme.cores.texto : theme.cores.textoApagado;
        return (
          <TouchableOpacity
            key={aba.nome}
            style={estilos.item}
            onPress={ir}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={aba.rotulo}
          >
            <Feather name={aba.icone} size={22} color={cor} />
            <Text style={[estilos.rotulo, { color: cor }]}>{aba.rotulo}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AppLayout() {
  return (
    <Tabs
      tabBar={(props) => <BarraCustom {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.cores.fundo },
      }}
    >
      {/* A ordem aqui nao importa para a barra (a barra usa a lista ABAS). */}
      <Tabs.Screen name="osv" />
      <Tabs.Screen name="financeiro" />
      <Tabs.Screen name="home" />
      <Tabs.Screen name="estoque" />
      <Tabs.Screen name="tecnico" />
    </Tabs>
  );
}

const estilos = StyleSheet.create({
  barra: {
    flexDirection: "row",
    backgroundColor: theme.cores.superficie,
    borderTopWidth: 1,
    borderTopColor: theme.cores.borda,
    paddingTop: theme.espaco(1),
    alignItems: "flex-end",
  },
  item: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 3, paddingBottom: 2 },
  itemCentral: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 3 },
  circuloCentral: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.cores.primaria,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -22, // eleva o circulo acima da barra
    ...theme.sombra.card,
  },
  circuloCentralAtivo: { backgroundColor: theme.cores.primariaEscura },
  rotulo: {
    fontSize: 10,
    color: theme.cores.textoApagado,
    fontFamily: theme.familia.semibold,
  },
  rotuloAtivo: { color: theme.cores.texto },
});
