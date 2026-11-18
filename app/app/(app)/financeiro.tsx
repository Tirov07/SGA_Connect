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
import {
  api,
  Resumo,
  Vencidos,
  Titulo,
  Banco,
  SaldoSerie,
  Extrato as ExtratoData,
} from "../../src/api";
import { theme } from "../../src/theme";
import { moeda, dataBr, rotuloMes, somarMes, chaveMes } from "../../src/format";
import { Card } from "../../src/components/Card";
import { StatCard } from "../../src/components/StatCard";
import { GraficoSaldo } from "../../src/components/GraficoSaldo";

type Vista = "painel" | "receber" | "pagar" | "extrato";

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
  if (vista === "extrato") {
    return (
      <Extrato
        onVoltar={() => setVista("painel")}
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
  onAbrir: (v: "receber" | "pagar" | "extrato") => void;
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
      <BotaoLista icone="file-text" cor={cores.texto} texto="Resumo financeiro (extrato)" cores={cores} onPress={() => onAbrir("extrato")} />

      {/* Grafico de saldo por banco */}
      <PainelSaldo cores={cores} sessaoToken={sessaoToken} />
    </ScrollView>
  );
}

// -------------------- Grafico de saldo por banco (na propria home do financeiro) --------------------

function PainelSaldo({ cores, sessaoToken }: { cores: any; sessaoToken?: string }) {
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [serie, setSerie] = useState<SaldoSerie | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Carrega a lista de bancos uma vez.
  useEffect(() => {
    if (!sessaoToken) return;
    api
      .bancos(sessaoToken)
      .then((bs) => {
        setBancos(bs);
        if (bs.length > 0) setSel(bs[0].numeroBanco);
      })
      .catch(() => setBancos([]));
  }, [sessaoToken]);

  // Carrega a serie do banco selecionado.
  useEffect(() => {
    if (!sessaoToken || sel == null) return;
    setCarregando(true);
    api
      .saldo(sessaoToken, sel, 7)
      .then(setSerie)
      .catch(() => setSerie(null))
      .finally(() => setCarregando(false));
  }, [sessaoToken, sel]);

  if (bancos.length === 0) return null;

  return (
    <Card style={{ marginTop: theme.espaco(1) }}>
      <Text style={[estilos.cardTitulo, { color: cores.texto }]}>Saldo em caixa (7 dias)</Text>

      {carregando || !serie ? (
        <ActivityIndicator color={cores.primaria} style={{ marginVertical: theme.espaco(3) }} />
      ) : (
        <GraficoSaldo pontos={serie.pontos} />
      )}

      {/* Seletor de banco (1 por vez) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: theme.espaco(1) }}>
        <View style={{ flexDirection: "row", gap: theme.espaco(1) }}>
          {bancos.map((b) => {
            const ativo = b.numeroBanco === sel;
            return (
              <TouchableOpacity
                key={b.numeroBanco}
                onPress={() => setSel(b.numeroBanco)}
                style={[
                  estilos.chip,
                  { borderColor: cores.borda, backgroundColor: ativo ? cores.primaria : cores.superficie2 },
                ]}
              >
                <Text style={[estilos.chipTxt, { color: ativo ? "#fff" : cores.textoFraco }]} numberOfLines={1}>
                  {b.nome}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </Card>
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

// -------------------- Extrato (resumo financeiro: entradas/saidas por banco) --------------------

function Extrato({
  onVoltar,
  topo,
  base,
  cores,
  sessaoToken,
}: {
  onVoltar: () => void;
  topo: number;
  base: number;
  cores: any;
  sessaoToken?: string;
}) {
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [dados, setDados] = useState<ExtratoData | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Lista os bancos; comeca com TODOS selecionados (extrato consolidado).
  useEffect(() => {
    if (!sessaoToken) return;
    api
      .bancos(sessaoToken)
      .then((bs) => {
        setBancos(bs);
        setSelecionados(bs.map((b) => b.numeroBanco));
      })
      .catch(() => setErro("Não consegui carregar os bancos."));
  }, [sessaoToken]);

  const carregar = useCallback(async () => {
    if (!sessaoToken || selecionados.length === 0) {
      setDados(null);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      setDados(await api.extrato(sessaoToken, selecionados, 90));
    } catch {
      setErro("Não consegui carregar o extrato.");
    } finally {
      setCarregando(false);
    }
  }, [sessaoToken, selecionados]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function alternar(num: number) {
    setSelecionados((atual) =>
      atual.includes(num) ? atual.filter((x) => x !== num) : [...atual, num]
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo, paddingTop: topo + theme.espaco(1) }}>
      <View style={estilos.topoLista}>
        <TouchableOpacity onPress={onVoltar} style={{ padding: 4 }} accessibilityLabel="Voltar">
          <Feather name="chevron-left" size={26} color={cores.texto} />
        </TouchableOpacity>
        <Text style={[estilos.tituloLista, { color: cores.texto }]}>Extrato (90 dias)</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Seletor de bancos (varios) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: theme.espaco(1),
          paddingHorizontal: theme.espaco(2.5),
          paddingVertical: theme.espaco(0.5),
          alignItems: "center",
        }}
      >
        {bancos.map((b) => {
          const ativo = selecionados.includes(b.numeroBanco);
          return (
            <TouchableOpacity
              key={b.numeroBanco}
              onPress={() => alternar(b.numeroBanco)}
              style={[estilos.chip, { borderColor: cores.borda, backgroundColor: ativo ? cores.primaria : cores.superficie2 }]}
            >
              <Text style={[estilos.chipTxt, { color: ativo ? "#fff" : cores.textoFraco }]} numberOfLines={1}>
                {b.nome}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Totais */}
      {dados ? (
        <View style={estilos.totais}>
          <View style={estilos.totalCol}>
            <Text style={[estilos.totalLabel, { color: cores.textoFraco }]}>Entradas</Text>
            <Text style={[estilos.totalVal, { color: cores.positivo }]}>{moeda(dados.totalEntradas)}</Text>
          </View>
          <View style={estilos.totalCol}>
            <Text style={[estilos.totalLabel, { color: cores.textoFraco }]}>Saídas</Text>
            <Text style={[estilos.totalVal, { color: cores.negativo }]}>{moeda(dados.totalSaidas)}</Text>
          </View>
          <View style={estilos.totalCol}>
            <Text style={[estilos.totalLabel, { color: cores.textoFraco }]}>Resultado</Text>
            <Text style={[estilos.totalVal, { color: dados.resultado >= 0 ? cores.positivo : cores.negativo }]}>
              {moeda(dados.resultado)}
            </Text>
          </View>
        </View>
      ) : null}

      {carregando ? (
        <ActivityIndicator color={cores.primaria} size="large" style={{ marginTop: theme.espaco(6) }} />
      ) : erro ? (
        <Text style={[estilos.centroTxt, { color: cores.primaria }]}>{erro}</Text>
      ) : !dados || dados.lancamentos.length === 0 ? (
        <Text style={[estilos.centroTxt, { color: cores.textoApagado }]}>Sem movimento no período.</Text>
      ) : (
        <FlatList
          data={dados.lancamentos}
          keyExtractor={(l, i) => `${l.data}-${i}`}
          contentContainerStyle={{ paddingHorizontal: theme.espaco(2.5), paddingBottom: base + theme.espaco(12) }}
          ItemSeparatorComponent={() => <View style={{ height: theme.espaco(1) }} />}
          renderItem={({ item }) => (
            <Card style={estilos.lancCard}>
              <View style={estilos.lancTopo}>
                <Text style={[estilos.lancNome, { color: cores.texto }]} numberOfLines={1}>
                  {item.nome || item.descricao}
                </Text>
                <Text style={[estilos.lancVal, { color: item.entrada ? cores.positivo : cores.negativo }]}>
                  {item.entrada ? "+" : "−"} {moeda(item.valor)}
                </Text>
              </View>
              <View style={estilos.lancMeta}>
                <Text style={[estilos.lancMetaTxt, { color: cores.textoFraco }]}>
                  {item.descricao} · Nº {item.numero || "—"}
                </Text>
                <Text style={[estilos.lancMetaTxt, { color: cores.textoFraco }]}>{dataBr(item.data)}</Text>
              </View>
              {item.observacao ? (
                <Text style={[estilos.lancObs, { color: cores.textoApagado }]} numberOfLines={2}>
                  {item.observacao}
                </Text>
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
  chip: {
    height: 34,
    justifyContent: "center",
    paddingHorizontal: theme.espaco(1.75),
    borderRadius: theme.raio.pill,
    borderWidth: 1,
    maxWidth: 180,
  },
  chipTxt: { fontSize: theme.fonte.pequeno, fontFamily: theme.familia.semibold },
  totais: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: theme.espaco(1.5),
    paddingHorizontal: theme.espaco(2.5),
  },
  totalCol: { alignItems: "center" },
  totalVal: { fontSize: theme.fonte.corpo, fontFamily: theme.familia.extrabold, marginTop: 2 },
  lancCard: { padding: theme.espaco(1.5) },
  lancTopo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.espaco(1) },
  lancNome: { flex: 1, fontSize: theme.fonte.corpo, fontFamily: theme.familia.bold },
  lancVal: { fontSize: theme.fonte.corpo, fontFamily: theme.familia.extrabold },
  lancMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, gap: theme.espaco(1) },
  lancMetaTxt: { fontSize: theme.fonte.pequeno },
  lancObs: { fontSize: theme.fonte.pequeno, marginTop: 4, fontStyle: "italic" },
});
