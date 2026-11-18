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
import { useTema } from "../../src/tema";
import { api, Resumo, VendasResumo } from "../../src/api";
import { theme } from "../../src/theme";
import { moeda, horaCurta } from "../../src/format";
import { StatCard } from "../../src/components/StatCard";
import { Card } from "../../src/components/Card";
import { GraficoVendas } from "../../src/components/GraficoVendas";
import { BotaoTema } from "../../src/components/BotaoTema";

export default function Home() {
  const { sessao, sair } = useAuth();
  const { cores } = useTema();
  const insets = useSafeAreaInsets();

  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [vendas, setVendas] = useState<VendasResumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!sessao) return;
    setErro(null);
    try {
      const [r, v] = await Promise.all([
        api.resumo(sessao.token),
        api.vendasResumo(sessao.token, 10),
      ]);
      setResumo(r);
      setVendas(v);
    } catch {
      setErro("Não consegui atualizar os dados.");
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [sessao]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const primeiroNome = sessao?.nome?.split(" ")[0] ?? "";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      contentContainerStyle={{
        paddingTop: insets.top + theme.espaco(2),
        paddingBottom: insets.bottom + theme.espaco(12), // espaco para a tab bar
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
      <View style={estilos.topo}>
        <View>
          <Text style={[estilos.ola, { color: cores.texto }]}>Olá, {primeiroNome}</Text>
          <Text style={[estilos.empresa, { color: cores.primaria }]}>
            {sessao?.empresa?.toUpperCase()}
          </Text>
        </View>
        <View style={estilos.acoes}>
          <BotaoTema />
          <TouchableOpacity
            style={[estilos.sair, { borderColor: cores.borda, backgroundColor: cores.superficie }]}
            onPress={sair}
          >
            <Text style={[estilos.sairTxt, { color: cores.textoFraco }]}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      {carregando ? (
        <ActivityIndicator color={cores.primaria} size="large" style={{ marginTop: theme.espaco(8) }} />
      ) : (
        <>
          {erro ? <Text style={[estilos.erro, { color: cores.primaria }]}>{erro}</Text> : null}

          {/* Grafico de vendas e servicos */}
          <Card style={estilos.graficoCard}>
            <Text style={[estilos.secaoTitulo, { color: cores.texto }]}>Vendas e serviços</Text>
            <Text style={[estilos.secaoSub, { color: cores.textoFraco }]}>Últimos dias com movimento</Text>
            {vendas && vendas.dias.length > 0 ? (
              <GraficoVendas dias={vendas.dias} />
            ) : (
              <Text style={[estilos.vazio, { color: cores.textoApagado }]}>Sem movimento no período.</Text>
            )}
          </Card>

          {/* Resumo */}
          <View style={estilos.linha}>
            <StatCard rotulo="OS abertas" valor={String(resumo?.ordensServicoAbertas ?? 0)} />
            <StatCard rotulo="Fechadas (7 dias)" valor={String(resumo?.ordensServicoFechadas7Dias ?? 0)} />
          </View>
          <View style={estilos.linha}>
            <StatCard rotulo="A receber (mês)" valor={moeda(resumo?.totalAReceberMes ?? 0)} cor={cores.positivo} />
            <StatCard rotulo="A pagar (mês)" valor={moeda(resumo?.totalAPagarMes ?? 0)} cor={cores.negativo} />
          </View>

          {resumo ? (
            <Text style={[estilos.atualizado, { color: cores.textoApagado }]}>
              Atualizado às {horaCurta(resumo.geradoEm)}
            </Text>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  topo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.espaco(2),
  },
  ola: { fontSize: theme.fonte.titulo, fontFamily: theme.familia.extrabold },
  empresa: {
    fontSize: theme.fonte.pequeno,
    fontFamily: theme.familia.bold,
    letterSpacing: 1,
    marginTop: 2,
  },
  acoes: { flexDirection: "row", alignItems: "center", gap: theme.espaco(1) },
  sair: {
    paddingVertical: theme.espaco(1),
    paddingHorizontal: theme.espaco(2),
    borderRadius: theme.raio.pill,
    borderWidth: 1,
  },
  sairTxt: { fontFamily: theme.familia.bold, fontSize: theme.fonte.pequeno },
  graficoCard: { marginBottom: theme.espaco(2) },
  secaoTitulo: { fontSize: theme.fonte.secao, fontFamily: theme.familia.extrabold },
  secaoSub: { fontSize: theme.fonte.pequeno, marginBottom: theme.espaco(1.5) },
  vazio: { fontSize: theme.fonte.corpo, paddingVertical: theme.espaco(3) },
  linha: { flexDirection: "row", gap: theme.espaco(1.5), marginBottom: theme.espaco(1.5) },
  erro: { marginBottom: theme.espaco(1.5) },
  atualizado: { fontSize: theme.fonte.pequeno, textAlign: "center", marginTop: theme.espaco(1) },
});
