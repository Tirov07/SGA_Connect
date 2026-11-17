import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth";
import { api, Resumo } from "../../src/api";
import { theme } from "../../src/theme";
import { moeda, horaCurta } from "../../src/format";
import { StatCard } from "../../src/components/StatCard";
import { Card } from "../../src/components/Card";
import { BarrasFinanceiro } from "../../src/components/BarrasFinanceiro";

export default function Home() {
  const { sessao, sair } = useAuth();
  const insets = useSafeAreaInsets();

  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!sessao) return;
    setErro(null);
    try {
      setResumo(await api.resumo(sessao.token));
    } catch {
      setErro("Nao consegui atualizar os dados.");
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [sessao]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const primeiroNome = sessao?.nome?.split(" ")[0] ?? "";

  const barras = resumo
    ? [
        {
          rotulo: "A receber",
          valor: resumo.totalAReceberMes,
          cores: ["#35C759", "#1F7A3A"] as [string, string],
        },
        {
          rotulo: "A pagar",
          valor: resumo.totalAPagarMes,
          cores: ["#E11D2A", "#8E1119"] as [string, string],
        },
      ]
    : [];

  return (
    <ScrollView
      style={estilos.container}
      contentContainerStyle={{
        paddingTop: insets.top + theme.espaco(2),
        paddingBottom: insets.bottom + theme.espaco(4),
        paddingHorizontal: theme.espaco(2.5),
      }}
      refreshControl={
        <RefreshControl
          refreshing={atualizando}
          onRefresh={() => {
            setAtualizando(true);
            carregar();
          }}
          tintColor={theme.cores.primaria}
        />
      }
    >
      <View style={estilos.topo}>
        <View>
          <Text style={estilos.ola}>Ola, {primeiroNome}</Text>
          <Text style={estilos.empresa}>{sessao?.empresa?.toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={estilos.sair} onPress={sair}>
          <Text style={estilos.sairTxt}>Sair</Text>
        </TouchableOpacity>
      </View>

      {carregando ? (
        <ActivityIndicator color={theme.cores.primaria} size="large" style={{ marginTop: theme.espaco(8) }} />
      ) : (
        <>
          {erro ? <Text style={estilos.erro}>{erro}</Text> : null}

          <View style={estilos.linha}>
            <StatCard
              rotulo="OS abertas"
              valor={String(resumo?.ordensServicoAbertas ?? 0)}
            />
            <StatCard
              rotulo="Fechadas (7 dias)"
              valor={String(resumo?.ordensServicoFechadas7Dias ?? 0)}
            />
          </View>

          <View style={estilos.linha}>
            <StatCard
              rotulo="A receber (mes)"
              valor={moeda(resumo?.totalAReceberMes ?? 0)}
              cor={theme.cores.positivo}
            />
            <StatCard
              rotulo="A pagar (mes)"
              valor={moeda(resumo?.totalAPagarMes ?? 0)}
              cor={theme.cores.negativo}
            />
          </View>

          <Card style={estilos.graficoCard}>
            <Text style={estilos.graficoTitulo}>Financeiro do mes</Text>
            <BarrasFinanceiro barras={barras} />
          </Card>

          {resumo ? (
            <Text style={estilos.atualizado}>
              Atualizado as {horaCurta(resumo.geradoEm)}
            </Text>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.cores.fundo },
  topo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.espaco(3),
  },
  ola: { color: theme.cores.texto, fontSize: theme.fonte.titulo, fontWeight: "800" },
  empresa: {
    color: theme.cores.primaria,
    fontSize: theme.fonte.pequeno,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 2,
  },
  sair: {
    paddingVertical: theme.espaco(1),
    paddingHorizontal: theme.espaco(2),
    borderRadius: theme.raio.pill,
    borderWidth: 1,
    borderColor: theme.cores.borda,
    backgroundColor: theme.cores.superficie,
  },
  sairTxt: { color: theme.cores.textoFraco, fontWeight: "700", fontSize: theme.fonte.pequeno },
  linha: { flexDirection: "row", gap: theme.espaco(1.5), marginBottom: theme.espaco(1.5) },
  graficoCard: { marginTop: theme.espaco(1.5), alignItems: "center" },
  graficoTitulo: {
    alignSelf: "flex-start",
    color: theme.cores.texto,
    fontSize: theme.fonte.secao,
    fontWeight: "700",
    marginBottom: theme.espaco(2),
  },
  erro: { color: theme.cores.primaria, marginBottom: theme.espaco(1.5) },
  atualizado: {
    color: theme.cores.textoApagado,
    fontSize: theme.fonte.pequeno,
    textAlign: "center",
    marginTop: theme.espaco(2),
  },
});
