import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { useTema } from "../../src/tema";
import { api, Resumo, Vencidos, Titulo } from "../../src/api";
import { theme } from "../../src/theme";
import { moeda, dataBr, rotuloMes, somarMes, chaveMes } from "../../src/format";
import { Card } from "../../src/components/Card";
import { StatCard } from "../../src/components/StatCard";

type Vista = "painel" | "receber" | "pagar";

export default function Financeiro() {
  const { sessao } = useAuth();
  const { cores } = useTema();
  const insets = useSafeAreaInsets();

  const [vista, setVista] = useState<Vista>("painel");

  if (vista === "painel") {
    return (
      <Painel
        onAbrir={(v) => setVista(v)}
        topo={insets.top}
        base={insets.bottom}
        cores={cores}
        sessaoToken={sessao?.token}
      />
    );
  }
  return (
    <ListaTitulos
      tipo={vista}
      onVoltar={() => setVista("painel")}
      topo={insets.top}
      base={insets.bottom}
      cores={cores}
      sessaoToken={sessao?.token}
    />
  );
}

// -------------------- Painel (cards + vencidos + botoes) --------------------

function Painel({
  onAbrir,
  topo,
  base,
  cores,
  sessaoToken,
}: {
  onAbrir: (v: "receber" | "pagar") => void;
  topo: number;
  base: number;
  cores: any;
  sessaoToken?: string;
}) {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [vencidos, setVencidos] = useState<Vencidos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [carregandoVenc, setCarregandoVenc] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!sessaoToken) return;
    setErro(null);
    // Cards (rapido) e vencidos (pode ser lento) carregam INDEPENDENTES, para a tela
    // nao ficar travada esperando o vencidos num banco grande.
    setCarregando(true);
    api
      .resumo(sessaoToken)
      .then(setResumo)
      .catch(() => setErro("Não consegui carregar os totais."))
      .finally(() => {
        setCarregando(false);
        setAtualizando(false);
      });

    setCarregandoVenc(true);
    api
      .vencidos(sessaoToken)
      .then(setVencidos)
      .catch(() => setVencidos(null))
      .finally(() => setCarregandoVenc(false));
  }, [sessaoToken]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      contentContainerStyle={{
        paddingTop: topo + theme.espaco(2),
        paddingBottom: base + theme.espaco(12),
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

      {erro ? <Text style={[estilos.erro, { color: cores.primaria }]}>{erro}</Text> : null}

      {/* Cards do mes */}
      {carregando ? (
        <ActivityIndicator color={cores.primaria} style={{ marginVertical: theme.espaco(3) }} />
      ) : (
        <View style={estilos.linha}>
          <StatCard rotulo="A receber (mês)" valor={moeda(resumo?.totalAReceberMes ?? 0)} cor={cores.positivo} />
          <StatCard rotulo="A pagar (mês)" valor={moeda(resumo?.totalAPagarMes ?? 0)} cor={cores.negativo} />
        </View>
      )}

      {/* Card de vencidos */}
      <Card style={{ marginBottom: theme.espaco(1.5) }}>
        <Text style={[estilos.cardTitulo, { color: cores.texto }]}>Vencidos (12 meses)</Text>
        {carregandoVenc ? (
          <ActivityIndicator color={cores.primaria} style={{ marginVertical: theme.espaco(1) }} />
        ) : (
          <View style={estilos.vencLinha}>
            <View style={estilos.vencItem}>
              <Text style={[estilos.vencLabel, { color: cores.textoFraco }]}>A receber</Text>
              <Text style={[estilos.vencValor, { color: cores.positivo }]}>{moeda(vencidos?.totalReceber ?? 0)}</Text>
              <Text style={[estilos.vencQtd, { color: cores.textoApagado }]}>{vencidos?.qtdReceber ?? 0} título(s)</Text>
            </View>
            <View style={[estilos.divisor, { backgroundColor: cores.borda }]} />
            <View style={estilos.vencItem}>
              <Text style={[estilos.vencLabel, { color: cores.textoFraco }]}>A pagar</Text>
              <Text style={[estilos.vencValor, { color: cores.negativo }]}>{moeda(vencidos?.totalPagar ?? 0)}</Text>
              <Text style={[estilos.vencQtd, { color: cores.textoApagado }]}>{vencidos?.qtdPagar ?? 0} título(s)</Text>
            </View>
          </View>
        )}
      </Card>

      <BotaoLista icone="arrow-down-circle" cor={cores.positivo} texto="Recebimentos em aberto" cores={cores} onPress={() => onAbrir("receber")} />
      <BotaoLista icone="arrow-up-circle" cor={cores.negativo} texto="Pagamentos em aberto" cores={cores} onPress={() => onAbrir("pagar")} />
    </ScrollView>
  );
}

// -------------------- Lista de titulos (com seletor de mes) --------------------

function ListaTitulos({
  tipo,
  onVoltar,
  topo,
  base,
  cores,
  sessaoToken,
}: {
  tipo: "receber" | "pagar";
  onVoltar: () => void;
  topo: number;
  base: number;
  cores: any;
  sessaoToken?: string;
}) {
  const ehReceber = tipo === "receber";
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [itens, setItens] = useState<Titulo[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const corValor = ehReceber ? cores.positivo : cores.negativo;

  const carregar = useCallback(async () => {
    if (!sessaoToken) return;
    setCarregando(true);
    setErro(null);
    try {
      const r = await api.titulos(sessaoToken, tipo, chaveMes(ano, mes));
      setItens(r.titulos);
      setTotal(r.total);
    } catch {
      setErro("Não consegui carregar os títulos.");
    } finally {
      setCarregando(false);
    }
  }, [sessaoToken, tipo, ano, mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function mudarMes(delta: number) {
    const m = somarMes(ano, mes, delta);
    setAno(m.ano);
    setMes(m.mes);
  }

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo, paddingTop: topo + theme.espaco(1) }}>
      <View style={estilos.topoLista}>
        <TouchableOpacity onPress={onVoltar} style={{ padding: 4 }} accessibilityLabel="Voltar">
          <Feather name="chevron-left" size={26} color={cores.texto} />
        </TouchableOpacity>
        <Text style={[estilos.tituloLista, { color: cores.texto }]}>
          {ehReceber ? "Recebimentos" : "Pagamentos"}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={estilos.mesBar}>
        <TouchableOpacity onPress={() => mudarMes(-1)} accessibilityLabel="Mês anterior">
          <Feather name="chevron-left" size={22} color={cores.textoFraco} />
        </TouchableOpacity>
        <Text style={[estilos.mesTxt, { color: cores.texto }]}>{rotuloMes(ano, mes)}</Text>
        <TouchableOpacity onPress={() => mudarMes(1)} accessibilityLabel="Próximo mês">
          <Feather name="chevron-right" size={22} color={cores.textoFraco} />
        </TouchableOpacity>
      </View>

      <View style={{ alignItems: "center", marginBottom: theme.espaco(1.5) }}>
        <Text style={[estilos.totalLabel, { color: cores.textoFraco }]}>Total em aberto</Text>
        <Text style={[estilos.totalValor, { color: corValor }]}>{moeda(total)}</Text>
      </View>

      {carregando ? (
        <ActivityIndicator color={cores.primaria} size="large" style={{ marginTop: theme.espaco(6) }} />
      ) : erro ? (
        <Text style={[estilos.centroTxt, { color: cores.primaria }]}>{erro}</Text>
      ) : itens.length === 0 ? (
        <Text style={[estilos.centroTxt, { color: cores.textoApagado }]}>Nenhum título em aberto neste mês.</Text>
      ) : (
        <FlatList
          data={itens}
          keyExtractor={(t, i) => `${t.numero}-${i}`}
          contentContainerStyle={{ paddingHorizontal: theme.espaco(2.5), paddingBottom: base + theme.espaco(12) }}
          ItemSeparatorComponent={() => <View style={{ height: theme.espaco(1.25) }} />}
          renderItem={({ item }) => (
            <Card style={{ padding: theme.espaco(1.75) }}>
              <View style={estilos.itemTopo}>
                <Text style={[estilos.nome, { color: cores.texto }]} numberOfLines={1}>{item.nome || "—"}</Text>
                <Text style={[estilos.valor, { color: corValor }]}>{moeda(item.saldo)}</Text>
              </View>
              <View style={estilos.itemMeta}>
                <Text style={[estilos.meta, { color: cores.textoFraco }]}>Nº {item.numero || "—"}</Text>
                <Text style={[estilos.meta, { color: cores.textoFraco }]}>Venc. {dataBr(item.vencimento)}</Text>
              </View>
              {item.observacao ? (
                <Text style={[estilos.obs, { color: cores.textoApagado }]} numberOfLines={2}>{item.observacao}</Text>
              ) : null}
            </Card>
          )}
        />
      )}
    </View>
  );
}

function BotaoLista({
  icone,
  cor,
  texto,
  cores,
  onPress,
}: {
  icone: React.ComponentProps<typeof Feather>["name"];
  cor: string;
  texto: string;
  cores: any;
  onPress: () => void;
}) {
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
  topoLista: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.espaco(2),
    marginBottom: theme.espaco(1),
  },
  tituloLista: { fontSize: theme.fonte.secao, fontFamily: theme.familia.extrabold },
  mesBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.espaco(3),
    paddingVertical: theme.espaco(1),
  },
  mesTxt: { fontSize: theme.fonte.corpo, fontFamily: theme.familia.bold, minWidth: 150, textAlign: "center" },
  totalLabel: { fontSize: theme.fonte.pequeno, fontFamily: theme.familia.semibold },
  totalValor: { fontSize: theme.fonte.titulo, fontFamily: theme.familia.extrabold, marginTop: 2 },
  centroTxt: { textAlign: "center", marginTop: theme.espaco(4), fontSize: theme.fonte.corpo },
  itemTopo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.espaco(1) },
  nome: { flex: 1, fontSize: theme.fonte.corpo, fontFamily: theme.familia.bold },
  valor: { fontSize: theme.fonte.corpo, fontFamily: theme.familia.extrabold },
  itemMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  meta: { fontSize: theme.fonte.pequeno },
  obs: { fontSize: theme.fonte.pequeno, marginTop: 6, fontStyle: "italic" },
});
