import React, { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/auth";
import { theme } from "../src/theme";

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
  return (
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
