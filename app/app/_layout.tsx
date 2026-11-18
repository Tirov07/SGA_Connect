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
import { theme } from "../src/theme";

/** Aplica Manrope como fonte padrao de todo <Text> do app (sem repetir em cada estilo). */
function aplicarFontePadrao() {
  const TextQualquer = Text as unknown as { defaultProps?: { style?: unknown } };
  TextQualquer.defaultProps = TextQualquer.defaultProps ?? {};
  TextQualquer.defaultProps.style = [{ fontFamily: theme.familia.regular }];
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

  if (carregando) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={theme.cores.primaria} size="large" />
      </View>
    );
  }
  return <>{children}</>;
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

  if (!fonteCarregada) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={theme.cores.primaria} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Guardiao>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.cores.fundo },
                animation: "fade",
              }}
            />
          </Guardiao>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const estilos = StyleSheet.create({
  centro: {
    flex: 1,
    backgroundColor: theme.cores.fundo,
    alignItems: "center",
    justifyContent: "center",
  },
});
