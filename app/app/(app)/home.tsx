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
import { api, Resumo, VendasResumo } from "../../src/api";
import { theme } from "../../src/theme";
import { moeda, horaCurta } from "../../src/format";
import { StatCard } from "../../src/components/StatCard";
import { Card } from "../../src/components/Card";
import { BotaoMenu } from "../../src/components/BotaoMenu";
import { GraficoVendas } from "../../src/components/GraficoVendas";

const MENU = [
  { chave: "osv", rotulo: "OSv", icone: "🔧" },
  { chave: "financeiro", rotulo: "Financeiro", icone: "💰" },
  { chave: "estoque", rotulo: "Estoque", icone: "📦" },
  { chave: "tecnico", rotulo: "Dep. Técnico", icone: "🛠️" },
];

export default function Home() {
  const { sessao, sair } = useAuth();
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
        api.vendasResumo(sessao.token, 20),
      ]);
      setResumo(r);
      setVendas(v);
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

      {/* Menu principal */}
      <View style={estilos.menu}>
        {MENU.map((m) => (
          <BotaoMenu key={m.chave} rotulo={m.rotulo} icone={m.icone} />
        ))}
      </View>

      {carregando ? (
        <ActivityIndicator color={theme.cores.primaria} size="large" style={{ marginTop: theme.espaco(8) }} />
      ) : (
        <>
          {erro ? <Text style={estilos.erro}>{erro}</Text> : null}

          {/* Grafico de vendas e servicos */}
          <Card style={estilos.graficoCard}>
            <Text style={estilos.secaoTitulo}>Vendas e serviços</Text>
            <Text style={estilos.secaoSub}>Últimos dias com movimento</Text>
            {vendas && vendas.dias.length > 0 ? (
              <GraficoVendas dias={vendas.dias} />
            ) : (
              <Text style={estilos.vazio}>Sem movimento no período.</Text>
            )}
          </Card>

          {/* Resumo */}
          <View style={estilos.linha}>
            <StatCard rotulo="OS abertas" valor={String(resumo?.ordensServicoAbertas ?? 0)} />
            <StatCard rotulo="Fechadas (7 dias)" valor={String(resumo?.ordensServicoFechadas7Dias ?? 0)} />
          </View>
          <View style={estilos.linha}>
            <StatCard
              rotulo="A receber (mês)"
              valor={moeda(resumo?.totalAReceberMes ?? 0)}
              cor={theme.cores.positivo}
            />
            <StatCard
              rotulo="A pagar (mês)"
              valor={moeda(resumo?.totalAPagarMes ?? 0)}
              cor={theme.cores.negativo}
            />
          </View>

          {resumo ? (
            <Text style={estilos.atualizado}>Atualizado as {horaCurta(resumo.geradoEm)}</Text>
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
    marginBottom: theme.espaco(2),
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
  menu: { flexDirection: "row", gap: theme.espaco(1.5), marginBottom: theme.espaco(2.5) },
  graficoCard: { marginBottom: theme.espaco(2) },
  secaoTitulo: { color: theme.cores.texto, fontSize: theme.fonte.secao, fontWeight: "800" },
  secaoSub: {
    color: theme.cores.textoFraco,
    fontSize: theme.fonte.pequeno,
    marginBottom: theme.espaco(1.5),
  },
  vazio: { color: theme.cores.textoApagado, fontSize: theme.fonte.corpo, paddingVertical: theme.espaco(3) },
  linha: { flexDirection: "row", gap: theme.espaco(1.5), marginBottom: theme.espaco(1.5) },
  erro: { color: theme.cores.primaria, marginBottom: theme.espaco(1.5) },
  atualizado: {
    color: theme.cores.textoApagado,
    fontSize: theme.fonte.pequeno,
    textAlign: "center",
    marginTop: theme.espaco(1),
  },
});
