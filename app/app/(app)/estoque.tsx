import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { useTema } from "../../src/tema";
import {
  api,
  ItensEstoque,
  ItemEstoque,
  Movimentacao,
  ItemVendido,
} from "../../src/api";
import { theme } from "../../src/theme";
import { moeda, rotuloMes, somarMes, chaveMes, chaveDia, dataBr } from "../../src/format";
import { Card } from "../../src/components/Card";
import { TelaHeader } from "../../src/components/TelaHeader";
import { EstadoVazio } from "../../src/components/EstadoVazio";
import { SkeletonLista } from "../../src/components/Skeleton";
import { CardTotal } from "../../src/components/CardTotal";

type Vista = "painel" | "itens" | "movimentacao" | "pedido";

export default function Estoque() {
  const { sessao } = useAuth();
  const { cores } = useTema();
  const insets = useSafeAreaInsets();
  const [vista, setVista] = useState<Vista>("painel");
  const token = sessao?.token;

  if (vista === "painel") {
    return <Painel onAbrir={setVista} topo={insets.top} base={insets.bottom} cores={cores} />;
  }
  if (vista === "movimentacao") {
    return <Movimento onVoltar={() => setVista("painel")} topo={insets.top} base={insets.bottom} cores={cores} token={token} />;
  }
  return (
    <ListaItens
      modo={vista}
      onVoltar={() => setVista("painel")}
      topo={insets.top}
      base={insets.bottom}
      cores={cores}
      token={token}
    />
  );
}

// -------------------- Painel --------------------

function Painel({
  onAbrir,
  topo,
  base,
  cores,
}: {
  onAbrir: (v: Vista) => void;
  topo: number;
  base: number;
  cores: any;
}) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      contentContainerStyle={{
        paddingTop: topo + theme.espaco(2),
        paddingBottom: base + theme.espaco(12),
        paddingHorizontal: theme.espaco(2.5),
      }}
    >
      <Text style={[estilos.titulo, { color: cores.texto }]}>Estoque</Text>

      <BotaoLista icone="package" cor={cores.texto} texto="Itens de estoque" cores={cores} onPress={() => onAbrir("itens")} />
      <BotaoLista icone="trending-up" cor={cores.positivo} texto="Movimentação (mais vendidos)" cores={cores} onPress={() => onAbrir("movimentacao")} />
      <BotaoLista icone="alert-triangle" cor={cores.primaria} texto="Ponto de pedido" cores={cores} onPress={() => onAbrir("pedido")} />
    </ScrollView>
  );
}

// -------------------- Lista de itens / ponto de pedido --------------------

function ListaItens({
  modo,
  onVoltar,
  topo,
  base,
  cores,
  token,
}: {
  modo: "itens" | "pedido";
  onVoltar: () => void;
  topo: number;
  base: number;
  cores: any;
  token?: string;
}) {
  const ehPedido = modo === "pedido";
  const [dados, setDados] = useState<ItensEstoque | null>(null);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    setErro(null);
    try {
      setDados(ehPedido ? await api.estoquePontoPedido(token) : await api.estoqueItens(token));
    } catch {
      setErro("Não consegui carregar o estoque.");
    } finally {
      setCarregando(false);
    }
  }, [token, ehPedido]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Busca em memoria por descricao ou qualquer um dos codigos.
  const filtrados = useMemo(() => {
    const itens = dados?.itens ?? [];
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter(
      (i) =>
        i.descricao.toLowerCase().includes(q) ||
        String(i.codItem).includes(q) ||
        i.codigoFabricante.toLowerCase().includes(q) ||
        i.codigoInterno.toLowerCase().includes(q) ||
        i.referencia.toLowerCase().includes(q)
    );
  }, [dados, busca]);

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo, paddingTop: topo + theme.espaco(1) }}>
      <TelaHeader titulo={ehPedido ? "Ponto de pedido" : "Itens de estoque"} onVoltar={onVoltar} />

      {/* Busca (so na lista de itens) */}
      {!ehPedido ? (
        <View style={[estilos.buscaWrap, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
          <Feather name="search" size={18} color={cores.textoApagado} />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar por nome ou código"
            placeholderTextColor={cores.textoApagado}
            style={[estilos.buscaInput, { color: cores.texto }]}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {busca ? (
            <TouchableOpacity onPress={() => setBusca("")} accessibilityLabel="Limpar busca">
              <Feather name="x" size={18} color={cores.textoApagado} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {dados && !carregando ? (
        <Text style={[estilos.contagem, { color: cores.textoFraco }]}>
          {filtrados.length} {filtrados.length === 1 ? "item" : "itens"}
          {ehPedido ? " abaixo do mínimo" : ""}
        </Text>
      ) : null}

      {carregando ? (
        <SkeletonLista linhas={6} />
      ) : erro ? (
        <EstadoVazio icone="alert-circle" titulo={erro} subtitulo="Volte e tente de novo." />
      ) : filtrados.length === 0 ? (
        <EstadoVazio
          icone={ehPedido ? "check-circle" : "package"}
          titulo={
            ehPedido
              ? "Nenhum item no ponto de pedido"
              : busca
              ? "Nenhum item encontrado"
              : "Nenhum item de estoque"
          }
          subtitulo={ehPedido ? "Todos os itens com mínimo definido estão acima do nível." : undefined}
        />
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={(i) => String(i.codItem)}
          contentContainerStyle={{ paddingHorizontal: theme.espaco(2.5), paddingBottom: base + theme.espaco(12) }}
          ItemSeparatorComponent={() => <View style={{ height: theme.espaco(1.25) }} />}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <CartaoItem item={item} cores={cores} destacarSaldo={ehPedido} />}
        />
      )}
    </View>
  );
}

function CartaoItem({ item, cores, destacarSaldo }: { item: ItemEstoque; cores: any; destacarSaldo: boolean }) {
  const saldoBaixo = item.minimo > 0 && item.saldo <= item.minimo;
  const corSaldo = destacarSaldo || saldoBaixo ? cores.primaria : cores.texto;
  return (
    <Card style={{ padding: theme.espaco(1.75) }}>
      <View style={estilos.itemTopo}>
        <Text style={[estilos.itemNome, { color: cores.texto }]} numberOfLines={2}>
          {item.descricao || "—"}
        </Text>
        <Text style={[estilos.itemPreco, { color: cores.texto }]}>{moeda(item.precoVenda)}</Text>
      </View>

      <Codigos item={item} cores={cores} />

      <View style={[estilos.itemRodape, { borderTopColor: cores.borda }]}>
        <Text style={[estilos.saldoLabel, { color: cores.textoFraco }]}>
          Saldo <Text style={[estilos.saldoValor, { color: corSaldo }]}>{formatQtd(item.saldo)}</Text>
        </Text>
        {item.minimo > 0 ? (
          <Text style={[estilos.minimo, { color: cores.textoApagado }]}>mín. {formatQtd(item.minimo)}</Text>
        ) : null}
      </View>
    </Card>
  );
}

function Codigos({ item, cores }: { item: ItemEstoque; cores: any }) {
  const pares: [string, string][] = [
    ["Cód.", String(item.codItem)],
    ["Fab.", item.codigoFabricante],
    ["Interno", item.codigoInterno],
    ["Ref.", item.referencia],
  ];
  const visiveis = pares.filter(([, v]) => v && v !== "0");
  return (
    <View style={estilos.codigos}>
      {visiveis.map(([k, v]) => (
        <Text key={k} style={[estilos.codigo, { color: cores.textoApagado }]}>
          <Text style={{ fontFamily: theme.familia.semibold }}>{k} </Text>
          {v}
        </Text>
      ))}
    </View>
  );
}

// -------------------- Movimentacao (mais vendidos) --------------------

function Movimento({
  onVoltar,
  topo,
  base,
  cores,
  token,
}: {
  onVoltar: () => void;
  topo: number;
  base: number;
  cores: any;
  token?: string;
}) {
  const hoje = new Date();
  const [modo, setModo] = useState<"dia" | "mes">("mes");
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [dia, setDia] = useState(new Date());
  const [dados, setDados] = useState<Movimentacao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    setErro(null);
    try {
      const r =
        modo === "mes"
          ? await api.estoqueMovimentacao(token, "mes", chaveMes(ano, mes))
          : await api.estoqueMovimentacao(token, "dia", chaveDia(dia));
      setDados(r);
    } catch {
      setErro("Não consegui carregar a movimentação.");
    } finally {
      setCarregando(false);
    }
  }, [token, modo, ano, mes, dia]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function mudarMes(delta: number) {
    const m = somarMes(ano, mes, delta);
    setAno(m.ano);
    setMes(m.mes);
  }
  function mudarDia(delta: number) {
    const d = new Date(dia);
    d.setDate(d.getDate() + delta);
    setDia(d);
  }

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo, paddingTop: topo + theme.espaco(1) }}>
      <TelaHeader titulo="Mais vendidos" onVoltar={onVoltar} />

      {/* Alternador dia / mes */}
      <View style={estilos.segmento}>
        {(["dia", "mes"] as const).map((m) => {
          const ativo = modo === m;
          return (
            <TouchableOpacity
              key={m}
              onPress={() => setModo(m)}
              style={[
                estilos.segBtn,
                {
                  backgroundColor: ativo ? cores.primariaSuave : cores.superficie2,
                  borderColor: ativo ? cores.primaria : cores.borda,
                },
              ]}
            >
              <Text style={[estilos.segTxt, { color: ativo ? cores.primaria : cores.textoFraco }]}>
                {m === "dia" ? "Por dia" : "Por mês"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Navegador de periodo */}
      <View style={estilos.mesBar}>
        <TouchableOpacity onPress={() => (modo === "mes" ? mudarMes(-1) : mudarDia(-1))} accessibilityLabel="Anterior">
          <Feather name="chevron-left" size={22} color={cores.textoFraco} />
        </TouchableOpacity>
        <Text style={[estilos.mesTxt, { color: cores.texto }]}>
          {modo === "mes" ? rotuloMes(ano, mes) : dataBr(chaveDia(dia))}
        </Text>
        <TouchableOpacity onPress={() => (modo === "mes" ? mudarMes(1) : mudarDia(1))} accessibilityLabel="Próximo">
          <Feather name="chevron-right" size={22} color={cores.textoFraco} />
        </TouchableOpacity>
      </View>

      {/* Total no topo */}
      <View style={{ paddingHorizontal: theme.espaco(2.5), marginBottom: theme.espaco(1.5) }}>
        <CardTotal
          rotulo="Vendido no período"
          valor={moeda(dados?.totalValor ?? 0)}
          tom="positivo"
          sub={`${formatQtd(dados?.totalQuantidade ?? 0)} un · ${dados?.quantidade ?? 0} itens`}
        />
      </View>

      {carregando ? (
        <SkeletonLista linhas={5} />
      ) : erro ? (
        <EstadoVazio icone="alert-circle" titulo={erro} subtitulo="Volte e tente de novo." />
      ) : !dados || dados.itens.length === 0 ? (
        <EstadoVazio icone="trending-up" titulo="Nenhuma venda de estoque no período" />
      ) : (
        <FlatList
          data={dados.itens}
          keyExtractor={(i) => String(i.codItem)}
          contentContainerStyle={{ paddingHorizontal: theme.espaco(2.5), paddingBottom: base + theme.espaco(12) }}
          ItemSeparatorComponent={() => <View style={{ height: theme.espaco(1.25) }} />}
          renderItem={({ item, index }) => <CartaoVendido item={item} posicao={index + 1} cores={cores} />}
        />
      )}
    </View>
  );
}

function CartaoVendido({ item, posicao, cores }: { item: ItemVendido; posicao: number; cores: any }) {
  return (
    <Card style={{ padding: theme.espaco(1.75) }}>
      <View style={estilos.vendTopo}>
        <View style={[estilos.posicao, { backgroundColor: cores.superficie2 }]}>
          <Text style={[estilos.posicaoTxt, { color: cores.textoFraco }]}>{posicao}</Text>
        </View>
        <Text style={[estilos.itemNome, { color: cores.texto, flex: 1 }]} numberOfLines={2}>
          {item.descricao || "—"}
        </Text>
      </View>

      <View style={estilos.vendMeta}>
        <View>
          <Text style={[estilos.saldoLabel, { color: cores.textoFraco }]}>Quantidade</Text>
          <Text style={[estilos.vendQtd, { color: cores.texto }]}>{formatQtd(item.quantidade)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[estilos.saldoLabel, { color: cores.textoFraco }]}>Valor total</Text>
          <Text style={[estilos.vendValor, { color: cores.positivo }]}>{moeda(item.valorTotal)}</Text>
        </View>
      </View>

      <Codigos item={item as any} cores={cores} />
    </Card>
  );
}

// -------------------- helpers de UI --------------------

/** Quantidade sem casas desnecessarias (3 -> "3", 2.5 -> "2,5"). */
function formatQtd(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
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
  titulo: { fontSize: theme.fonte.titulo, fontFamily: theme.familia.extrabold, letterSpacing: theme.tracking.titulo, marginBottom: theme.espaco(2) },
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
  // busca
  buscaWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.espaco(1),
    marginHorizontal: theme.espaco(2.5),
    marginBottom: theme.espaco(1),
    paddingHorizontal: theme.espaco(1.5),
    height: 44,
    borderRadius: theme.raio.md,
    borderWidth: 1,
  },
  buscaInput: { flex: 1, fontSize: theme.fonte.corpo, fontFamily: theme.familia.medio, paddingVertical: 0 },
  contagem: { fontSize: theme.fonte.pequeno, paddingHorizontal: theme.espaco(2.5), marginBottom: theme.espaco(1) },
  // cartao item
  itemTopo: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: theme.espaco(1) },
  itemNome: { flex: 1, fontSize: theme.fonte.corpo, fontFamily: theme.familia.bold },
  itemPreco: { fontSize: theme.fonte.corpo, fontFamily: theme.familia.extrabold },
  codigos: { flexDirection: "row", flexWrap: "wrap", gap: theme.espaco(1.5), marginTop: 6 },
  codigo: { fontSize: theme.fonte.pequeno },
  itemRodape: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.espaco(1.25),
    paddingTop: theme.espaco(1),
    borderTopWidth: 1,
  },
  saldoLabel: { fontSize: theme.fonte.pequeno },
  saldoValor: { fontSize: theme.fonte.corpo, fontFamily: theme.familia.extrabold },
  minimo: { fontSize: theme.fonte.pequeno },
  // movimentacao
  segmento: { flexDirection: "row", gap: theme.espaco(1), justifyContent: "center", marginBottom: theme.espaco(1) },
  segBtn: { paddingHorizontal: theme.espaco(2.5), paddingVertical: theme.espaco(0.75), borderRadius: theme.raio.pill, borderWidth: 1 },
  segTxt: { fontSize: theme.fonte.pequeno, fontFamily: theme.familia.bold },
  mesBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.espaco(3), paddingVertical: theme.espaco(0.5) },
  mesTxt: { fontSize: theme.fonte.corpo, fontFamily: theme.familia.bold, minWidth: 160, textAlign: "center" },
  vendTopo: { flexDirection: "row", alignItems: "center", gap: theme.espaco(1.25) },
  posicao: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  posicaoTxt: { fontSize: theme.fonte.pequeno, fontFamily: theme.familia.extrabold },
  vendMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: theme.espaco(1.25) },
  vendQtd: { fontSize: theme.fonte.secao, fontFamily: theme.familia.extrabold, marginTop: 2 },
  vendValor: { fontSize: theme.fonte.corpo, fontFamily: theme.familia.extrabold, marginTop: 2 },
});
