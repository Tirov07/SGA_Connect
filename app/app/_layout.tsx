import React, { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { AuthProvider, useAuth } from "../src/auth";
import { TemaProvider, useTema } from "../src/tema";
import { theme } from "../src/theme";

/** Aplica Manrope como fonte padrao de todo <Text> do app (sem repetir em cada estilo). */
function aplicarFontePadrao() {
  const TextQualquer = Text as unknown as { defaultProps?: { style?: unknown } };
  TextQualquer.defaultProps = TextQualquer.defaultProps ?? {};
  TextQualquer.defaultProps.style = [{ fontFamily: theme.familia.regular }];
}

function Centro() {
  const { cores } = useTema();
  return (
    <View style={[estilos.centro, { backgroundColor: cores.fundo }]}>
      <ActivityIndicator color={cores.primaria} size="large" />
    </View>
  );
}

function Guardiao({ children }: { children: React.ReactNode }) {
  const { sessao, carregando } = useAuth();
  const segmentos = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (carregando) return;
    const naAreaLogada = segmentos[0] === "(app)";
    if (!sessao && naAreaLogada) router.replace("/login");
    else if (sessao && !naAreaLogada) router.replace("/(app)/home");
  }, [sessao, carregando, segmentos]);

  if (carregando) return <Centro />;
  return <>{children}</>;
}

/** Casca com acesso ao tema: define cor da barra de status e fundo das telas. */
function Casca() {
  const { nome, cores } = useTema();
  return (
    <>
      <StatusBar style={nome === "claro" ? "dark" : "light"} />
      <Guardiao>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: cores.fundo },
            animation: "fade",
          }}
        />
      </Guardiao>
    </>
  );
}

export default function RootLayout() {
  const [fonteCarregada] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  if (fonteCarregada) aplicarFontePadrao();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TemaProvider>
          <AuthProvider>
            {!fonteCarregada ? <Centro /> : <Casca />}
          </AuthProvider>
        </TemaProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
});
