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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { useTema } from "../../src/tema";
import { api, Resumo, Vencidos } from "../../src/api";
import { theme } from "../../src/theme";
import { moeda } from "../../src/format";
import { Card } from "../../src/components/Card";
import { StatCard } from "../../src/components/StatCard";

export default function Financeiro() {
  const { sessao } = useAuth();
  const { cores } = useTema();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [vencidos, setVencidos] = useState<Vencidos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!sessao) return;
    setErro(null);
    try {
      const [r, v] = await Promise.all([api.resumo(sessao.token), api.vencidos(sessao.token)]);
      setResumo(r);
      setVencidos(v);
    } catch {
      setErro("Não consegui carregar o financeiro.");
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [sessao]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      contentContainerStyle={{
        paddingTop: insets.top + theme.espaco(2),
        paddingBottom: insets.bottom + theme.espaco(12),
        paddingHorizontal: theme.espaco(2.5),
      }}
      refreshControl={
        <RefreshControl
          refreshing={atualizando}
          onRefresh={() => {
            setAtualizando(true);
            carregar();
          }}
          tintColor={cores.primaria}
        />
      }
    >
      <Text style={[estilos.titulo, { color: cores.texto }]}>Financeiro</Text>

      {carregando ? (
        <ActivityIndicator color={cores.primaria} size="large" style={{ marginTop: theme.espaco(8) }} />
      ) : (
        <>
          {erro ? <Text style={[estilos.erro, { color: cores.primaria }]}>{erro}</Text> : null}

          {/* Cards do mes */}
          <View style={estilos.linha}>
            <StatCard rotulo="A receber (mês)" valor={moeda(resumo?.totalAReceberMes ?? 0)} cor={cores.positivo} />
            <StatCard rotulo="A pagar (mês)" valor={moeda(resumo?.totalAPagarMes ?? 0)} cor={cores.negativo} />
          </View>

          {/* Card de vencidos */}
          <Card style={{ marginBottom: theme.espaco(1.5) }}>
            <Text style={[estilos.cardTitulo, { color: cores.texto }]}>Vencidos</Text>
            <View style={estilos.vencLinha}>
              <View style={estilos.vencItem}>
                <Text style={[estilos.vencLabel, { color: cores.textoFraco }]}>A receber</Text>
                <Text style={[estilos.vencValor, { color: cores.positivo }]}>
                  {moeda(vencidos?.totalReceber ?? 0)}
                </Text>
                <Text style={[estilos.vencQtd, { color: cores.textoApagado }]}>
                  {vencidos?.qtdReceber ?? 0} título(s)
                </Text>
              </View>
              <View style={[estilos.divisor, { backgroundColor: cores.borda }]} />
              <View style={estilos.vencItem}>
                <Text style={[estilos.vencLabel, { color: cores.textoFraco }]}>A pagar</Text>
                <Text style={[estilos.vencValor, { color: cores.negativo }]}>
                  {moeda(vencidos?.totalPagar ?? 0)}
                </Text>
                <Text style={[estilos.vencQtd, { color: cores.textoApagado }]}>
                  {vencidos?.qtdPagar ?? 0} título(s)
                </Text>
              </View>
            </View>
          </Card>

          {/* Botoes para as listas */}
          <BotaoLista
            icone="arrow-down-circle"
            cor={cores.positivo}
            texto="Recebimentos em aberto"
            onPress={() =>
              router.push({ pathname: "/(app)/financeiro-titulos", params: { tipo: "receber" } })
            }
          />
          <BotaoLista
            icone="arrow-up-circle"
            cor={cores.negativo}
            texto="Pagamentos em aberto"
            onPress={() =>
              router.push({ pathname: "/(app)/financeiro-titulos", params: { tipo: "pagar" } })
            }
          />
        </>
      )}
    </ScrollView>
  );
}

function BotaoLista({
  icone,
  cor,
  texto,
  onPress,
}: {
  icone: React.ComponentProps<typeof Feather>["name"];
  cor: string;
  texto: string;
  onPress: () => void;
}) {
  const { cores } = useTema();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[estilos.botao, { backgroundColor: cores.superficie, borderColor: cores.borda, ...cores.sombraCard }]}
    >
      <Feather name={icone} size={22} color={cor} />
      <Text style={[estilos.botaoTxt, { color: cores.texto }]}>{texto}</Text>
      <Feather name="chevron-right" size={20} color={cores.textoApagado} />
    </TouchableOpacity>
  );
}

const estilos = StyleSheet.create({
  titulo: { fontSize: theme.fonte.titulo, fontFamily: theme.familia.extrabold, marginBottom: theme.espaco(2) },
  erro: { marginBottom: theme.espaco(1.5) },
  linha: { flexDirection: "row", gap: theme.espaco(1.5), marginBottom: theme.espaco(1.5) },
  cardTitulo: { fontSize: theme.fonte.corpo, fontFamily: theme.familia.bold, marginBottom: theme.espaco(1.5) },
  vencLinha: { flexDirection: "row", alignItems: "center" },
  vencItem: { flex: 1, alignItems: "center" },
  divisor: { width: 1, alignSelf: "stretch", marginVertical: 4 },
  vencLabel: { fontSize: theme.fonte.pequeno, fontFamily: theme.familia.semibold },
  vencValor: { fontSize: theme.fonte.secao, fontFamily: theme.familia.extrabold, marginTop: 4 },
  vencQtd: { fontSize: theme.fonte.pequeno, marginTop: 2 },
  botao: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.espaco(1.5),
    borderRadius: theme.raio.md,
    borderWidth: 1,
    paddingVertical: theme.espaco(2),
    paddingHorizontal: theme.espaco(2),
    marginBottom: theme.espaco(1.5),
  },
  botaoTxt: { flex: 1, fontSize: theme.fonte.corpo, fontFamily: theme.familia.bold },
});
