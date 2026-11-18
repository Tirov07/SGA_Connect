import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { useTema } from "../../src/tema";
import { api, Titulo } from "../../src/api";
import { theme } from "../../src/theme";
import { moeda, dataBr, rotuloMes, somarMes, chaveMes } from "../../src/format";
import { Card } from "../../src/components/Card";

export default function FinanceiroTitulos() {
  const { tipo } = useLocalSearchParams<{ tipo: "receber" | "pagar" }>();
  const ehReceber = tipo !== "pagar";
  const { sessao } = useAuth();
  const { cores } = useTema();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [itens, setItens] = useState<Titulo[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const corValor = ehReceber ? cores.positivo : cores.negativo;

  const carregar = useCallback(async () => {
    if (!sessao) return;
    setCarregando(true);
    setErro(null);
    try {
      const r = await api.titulos(sessao.token, ehReceber ? "receber" : "pagar", chaveMes(ano, mes));
      setItens(r.titulos);
      setTotal(r.total);
    } catch {
      setErro("Não consegui carregar os títulos.");
    } finally {
      setCarregando(false);
    }
  }, [sessao, ehReceber, ano, mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function mudarMes(delta: number) {
    const m = somarMes(ano, mes, delta);
    setAno(m.ano);
    setMes(m.mes);
  }

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo, paddingTop: insets.top + theme.espaco(1) }}>
      {/* Cabecalho com voltar */}
      <View style={estilos.topo}>
        <TouchableOpacity onPress={() => router.back()} style={estilos.voltar} accessibilityLabel="Voltar">
          <Feather name="chevron-left" size={26} color={cores.texto} />
        </TouchableOpacity>
        <Text style={[estilos.titulo, { color: cores.texto }]}>
          {ehReceber ? "Recebimentos" : "Pagamentos"}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Seletor de mes */}
      <View style={estilos.mesBar}>
        <TouchableOpacity onPress={() => mudarMes(-1)} accessibilityLabel="Mês anterior">
          <Feather name="chevron-left" size={22} color={cores.textoFraco} />
        </TouchableOpacity>
        <Text style={[estilos.mesTxt, { color: cores.texto }]}>{rotuloMes(ano, mes)}</Text>
        <TouchableOpacity onPress={() => mudarMes(1)} accessibilityLabel="Próximo mês">
          <Feather name="chevron-right" size={22} color={cores.textoFraco} />
        </TouchableOpacity>
      </View>

      {/* Total do mes */}
      <View style={estilos.totalBar}>
        <Text style={[estilos.totalLabel, { color: cores.textoFraco }]}>Total em aberto</Text>
        <Text style={[estilos.totalValor, { color: corValor }]}>{moeda(total)}</Text>
      </View>

      {carregando ? (
        <ActivityIndicator color={cores.primaria} size="large" style={{ marginTop: theme.espaco(6) }} />
      ) : erro ? (
        <Text style={[estilos.erro, { color: cores.primaria }]}>{erro}</Text>
      ) : itens.length === 0 ? (
        <Text style={[estilos.vazio, { color: cores.textoApagado }]}>
          Nenhum título em aberto neste mês.
        </Text>
      ) : (
        <FlatList
          data={itens}
          keyExtractor={(t, i) => `${t.numero}-${i}`}
          contentContainerStyle={{
            paddingHorizontal: theme.espaco(2.5),
            paddingBottom: insets.bottom + theme.espaco(12),
          }}
          renderItem={({ item }) => (
            <Card style={estilos.item}>
              <View style={estilos.itemTopo}>
                <Text style={[estilos.nome, { color: cores.texto }]} numberOfLines={1}>
                  {item.nome || "—"}
                </Text>
                <Text style={[estilos.valor, { color: corValor }]}>{moeda(item.saldo)}</Text>
              </View>
              <View style={estilos.itemMeta}>
                <Text style={[estilos.meta, { color: cores.textoFraco }]}>
                  Nº {item.numero || "—"}
                </Text>
                <Text style={[estilos.meta, { color: cores.textoFraco }]}>
                  Venc. {dataBr(item.vencimento)}
                </Text>
              </View>
              {item.observacao ? (
                <Text style={[estilos.obs, { color: cores.textoApagado }]} numberOfLines={2}>
                  {item.observacao}
                </Text>
              ) : null}
            </Card>
          )}
          ItemSeparatorComponent={() => <View style={{ height: theme.espaco(1.25) }} />}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  topo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.espaco(2),
    marginBottom: theme.espaco(1),
  },
  voltar: { padding: 4 },
  titulo: { fontSize: theme.fonte.secao, fontFamily: theme.familia.extrabold },
  mesBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.espaco(3),
    paddingVertical: theme.espaco(1),
  },
  mesTxt: { fontSize: theme.fonte.corpo, fontFamily: theme.familia.bold, minWidth: 150, textAlign: "center" },
  totalBar: { alignItems: "center", marginBottom: theme.espaco(1.5) },
  totalLabel: { fontSize: theme.fonte.pequeno, fontFamily: theme.familia.semibold },
  totalValor: { fontSize: theme.fonte.titulo, fontFamily: theme.familia.extrabold, marginTop: 2 },
  erro: { textAlign: "center", marginTop: theme.espaco(4) },
  vazio: { textAlign: "center", marginTop: theme.espaco(4), fontSize: theme.fonte.corpo },
  item: { padding: theme.espaco(1.75) },
  itemTopo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.espaco(1) },
  nome: { flex: 1, fontSize: theme.fonte.corpo, fontFamily: theme.familia.bold },
  valor: { fontSize: theme.fonte.corpo, fontFamily: theme.familia.extrabold },
  itemMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  meta: { fontSize: theme.fonte.pequeno },
  obs: { fontSize: theme.fonte.pequeno, marginTop: 6, fontStyle: "italic" },
});
