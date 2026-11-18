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
  OsLista,
  OsItem,
  OsAberturas,
  OsAberturaDia,
  OsResumo,
} from "../../src/api";
import { theme } from "../../src/theme";
import { moeda, dataBr, diaMes, rotuloMes, somarMes, chaveMes, chaveDia } from "../../src/format";
import { Card } from "../../src/components/Card";
import { GraficoAberturas } from "../../src/components/GraficoAberturas";

type Vista = "painel" | "fechadas" | "abertas" | "resumo";

export default function Osv() {
  const { sessao } = useAuth();
  const { cores } = useTema();
  const insets = useSafeAreaInsets();
  const [vista, setVista] = useState<Vista>("painel");
  const token = sessao?.token;

  if (vista === "painel") {
    return <Painel onAbrir={setVista} topo={insets.top} base={insets.bottom} cores={cores} token={token} />;
  }
  if (vista === "resumo") {
    return <ResumoFinanceiro onVoltar={() => setVista("painel")} topo={insets.top} base={insets.bottom} cores={cores} token={token} />;
  }
  return (
    <ListaOs
      tipo={vista}
      onVoltar={() => setVista("painel")}
      topo={insets.top}
      base={insets.bottom}
      cores={cores}
      token={token}
    />
  );
}

// -------------------- Painel (botoes + grafico de aberturas) --------------------

function Painel({
  onAbrir,
  topo,
  base,
  cores,
  token,
}: {
  onAbrir: (v: Vista) => void;
  topo: number;
  base: number;
  cores: any;
  token?: string;
}) {
  const [aberturas, setAberturas] = useState<OsAberturas | null>(null);
  const [selDia, setSelDia] = useState<OsAberturaDia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    try {
      setAberturas(await api.osvAberturas(token, 10));
    } catch {
      setAberturas(null);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [token]);

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
      <Text style={[estilos.titulo, { color: cores.texto }]}>OSv</Text>

      <BotaoLista icone="check-circle" cor={cores.positivo} texto="OS fechadas (7 dias)" cores={cores} onPress={() => onAbrir("fechadas")} />
      <BotaoLista icone="folder" cor={cores.primaria} texto="OS em aberto" cores={cores} onPress={() => onAbrir("abertas")} />

      {/* Grafico de OSv abertas por dia */}
      <Card style={{ marginTop: theme.espaco(0.5), marginBottom: theme.espaco(1.5) }}>
        <Text style={[estilos.cardTitulo, { color: cores.texto }]}>OS abertas por dia</Text>
        <Text style={[estilos.cardSub, { color: cores.textoFraco }]}>
          Segure numa coluna para ver com/sem laudo
        </Text>
        {carregando ? (
          <ActivityIndicator color={cores.primaria} style={{ marginVertical: theme.espaco(3) }} />
        ) : aberturas && aberturas.dias.length > 0 ? (
          <>
            <GraficoAberturas dias={aberturas.dias} onSelecionar={setSelDia} />
            {selDia ? (
              <View style={[estilos.detDia, { borderTopColor: cores.borda }]}>
                <Text style={[estilos.detData, { color: cores.textoFraco }]}>{diaMes(selDia.data)}</Text>
                <View style={estilos.detLinha}>
                  <View style={estilos.detCol}>
                    <Text style={[estilos.detLabel, { color: cores.textoFraco }]}>Com laudo</Text>
                    <Text style={[estilos.detValor, { color: cores.primaria }]}>{selDia.comLaudo}</Text>
                  </View>
                  <View style={[estilos.detDiv, { backgroundColor: cores.borda }]} />
                  <View style={estilos.detCol}>
                    <Text style={[estilos.detLabel, { color: cores.textoFraco }]}>Sem laudo</Text>
                    <Text style={[estilos.detValor, { color: cores.atencao }]}>{selDia.semLaudo}</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={[estilos.vazio, { color: cores.textoApagado }]}>Sem OS abertas no período.</Text>
        )}
      </Card>

      <BotaoLista icone="file-text" cor={cores.texto} texto="Resumo financeiro" cores={cores} onPress={() => onAbrir("resumo")} />
    </ScrollView>
  );
}

// -------------------- Lista de OS (fechadas / abertas) --------------------

function ListaOs({
  tipo,
  onVoltar,
  topo,
  base,
  cores,
  token,
}: {
  tipo: "fechadas" | "abertas";
  onVoltar: () => void;
  topo: number;
  base: number;
  cores: any;
  token?: string;
}) {
  const ehFechadas = tipo === "fechadas";
  const [dados, setDados] = useState<OsLista | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    setErro(null);
    try {
      setDados(ehFechadas ? await api.osvFechadas(token, 7) : await api.osvAbertas(token));
    } catch {
      setErro("Não consegui carregar as OS.");
    } finally {
      setCarregando(false);
    }
  }, [token, ehFechadas]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo, paddingTop: topo + theme.espaco(1) }}>
      <View style={estilos.topoLista}>
        <TouchableOpacity onPress={onVoltar} style={{ padding: 4 }} accessibilityLabel="Voltar">
          <Feather name="chevron-left" size={26} color={cores.texto} />
        </TouchableOpacity>
        <Text style={[estilos.tituloLista, { color: cores.texto }]}>
          {ehFechadas ? "Fechadas (7 dias)" : "Em aberto"}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {dados ? (
        <View style={estilos.resumoTopo}>
          <Text style={[estilos.resumoQtd, { color: cores.texto }]}>{dados.quantidade} OS</Text>
          <Text style={[estilos.resumoTotal, { color: cores.textoFraco }]}>Total {moeda(dados.totalGeral)}</Text>
        </View>
      ) : null}

      {carregando ? (
        <ActivityIndicator color={cores.primaria} size="large" style={{ marginTop: theme.espaco(6) }} />
      ) : erro ? (
        <Text style={[estilos.centroTxt, { color: cores.primaria }]}>{erro}</Text>
      ) : !dados || dados.itens.length === 0 ? (
        <Text style={[estilos.centroTxt, { color: cores.textoApagado }]}>Nenhuma OS encontrada.</Text>
      ) : (
        <FlatList
          data={dados.itens}
          keyExtractor={(o) => String(o.numOs)}
          contentContainerStyle={{ paddingHorizontal: theme.espaco(2.5), paddingBottom: base + theme.espaco(12) }}
          ItemSeparatorComponent={() => <View style={{ height: theme.espaco(1.25) }} />}
          renderItem={({ item }) => <CartaoOs item={item} cores={cores} />}
        />
      )}
    </View>
  );
}

function CartaoOs({ item, cores }: { item: OsItem; cores: any }) {
  return (
    <Card style={{ padding: theme.espaco(1.75) }}>
      <View style={estilos.osTopo}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.espaco(1), flex: 1 }}>
          <Text style={[estilos.osNum, { color: cores.texto }]}>OS {item.numOs}</Text>
          {item.placa ? (
            <View style={[estilos.placa, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
              <Text style={[estilos.placaTxt, { color: cores.textoFraco }]}>{item.placa}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[estilos.osTotal, { color: cores.texto }]}>{moeda(item.total)}</Text>
      </View>

      <Text style={[estilos.osCliente, { color: cores.textoFraco }]} numberOfLines={1}>
        {item.cliente || "—"}
      </Text>

      <View style={estilos.osMeta}>
        {item.operacao ? (
          <Text style={[estilos.osOperacao, { color: cores.textoApagado }]} numberOfLines={1}>
            {item.operacao}
          </Text>
        ) : <View />}
        {item.comLaudo ? (
          <View style={[estilos.laudoTag, { backgroundColor: cores.primaria }]}>
            <Text style={estilos.laudoTxt}>Laudo</Text>
          </View>
        ) : null}
      </View>

      <View style={[estilos.osValores, { borderTopColor: cores.borda }]}>
        <Text style={[estilos.osVal, { color: cores.textoFraco }]}>
          Peça <Text style={{ color: cores.texto, fontFamily: theme.familia.bold }}>{moeda(item.peca)}</Text>
        </Text>
        <Text style={[estilos.osVal, { color: cores.textoFraco }]}>
          Serviço <Text style={{ color: cores.texto, fontFamily: theme.familia.bold }}>{moeda(item.servico)}</Text>
        </Text>
      </View>
    </Card>
  );
}

// -------------------- Resumo financeiro por fechamento --------------------

function ResumoFinanceiro({
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
  const [dados, setDados] = useState<OsResumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    setErro(null);
    try {
      const r =
        modo === "mes"
          ? await api.osvResumo(token, "mes", chaveMes(ano, mes))
          : await api.osvResumo(token, "dia", chaveDia(dia));
      setDados(r);
    } catch {
      setErro("Não consegui carregar o resumo.");
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
      <View style={estilos.topoLista}>
        <TouchableOpacity onPress={onVoltar} style={{ padding: 4 }} accessibilityLabel="Voltar">
          <Feather name="chevron-left" size={26} color={cores.texto} />
        </TouchableOpacity>
        <Text style={[estilos.tituloLista, { color: cores.texto }]}>Resumo financeiro</Text>
        <View style={{ width: 26 }} />
      </View>

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
                { backgroundColor: ativo ? cores.primaria : cores.superficie2, borderColor: cores.borda },
              ]}
            >
              <Text style={[estilos.segTxt, { color: ativo ? "#fff" : cores.textoFraco }]}>
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

      {/* Total no topo (estilo extrato) */}
      <View style={{ alignItems: "center", marginBottom: theme.espaco(1) }}>
        <Text style={[estilos.totalLabel, { color: cores.textoFraco }]}>Total no período</Text>
        <Text style={[estilos.totalValor, { color: cores.texto }]}>{moeda(dados?.totalGeral ?? 0)}</Text>
        <Text style={[estilos.totalSub, { color: cores.textoApagado }]}>
          Peça {moeda(dados?.totalPeca ?? 0)} · Serviço {moeda(dados?.totalServico ?? 0)}
        </Text>
      </View>

      {carregando ? (
        <ActivityIndicator color={cores.primaria} size="large" style={{ marginTop: theme.espaco(6) }} />
      ) : erro ? (
        <Text style={[estilos.centroTxt, { color: cores.primaria }]}>{erro}</Text>
      ) : !dados || dados.linhas.length === 0 ? (
        <Text style={[estilos.centroTxt, { color: cores.textoApagado }]}>Nenhuma OS fechada no período.</Text>
      ) : (
        <FlatList
          data={dados.linhas}
          keyExtractor={(l) => String(l.numOs)}
          contentContainerStyle={{ paddingHorizontal: theme.espaco(2.5), paddingBottom: base + theme.espaco(12) }}
          ItemSeparatorComponent={() => <View style={{ height: theme.espaco(1) }} />}
          renderItem={({ item }) => (
            <Card style={{ padding: theme.espaco(1.5) }}>
              <View style={estilos.osTopo}>
                <Text style={[estilos.osNum, { color: cores.texto }]}>OS {item.numOs}</Text>
                <Text style={[estilos.osTotal, { color: cores.texto }]}>{moeda(item.total)}</Text>
              </View>
              <Text style={[estilos.osCliente, { color: cores.textoFraco }]} numberOfLines={1}>
                {item.cliente || "—"}
              </Text>
              <View style={estilos.notasLinha}>
                {item.notaServico ? (
                  <Text style={[estilos.notaTxt, { color: cores.textoApagado }]}>NF serviço {item.notaServico}</Text>
                ) : null}
                {item.notaPeca ? (
                  <Text style={[estilos.notaTxt, { color: cores.textoApagado }]}>NF peça {item.notaPeca}</Text>
                ) : null}
                {!item.notaServico && !item.notaPeca ? (
                  <Text style={[estilos.notaTxt, { color: cores.textoApagado }]}>Sem nota</Text>
                ) : null}
              </View>
              <View style={[estilos.osValores, { borderTopColor: cores.borda }]}>
                <Text style={[estilos.osVal, { color: cores.textoFraco }]}>
                  Peça <Text style={{ color: cores.texto, fontFamily: theme.familia.bold }}>{moeda(item.peca)}</Text>
                </Text>
                <Text style={[estilos.osVal, { color: cores.textoFraco }]}>
                  Serviço <Text style={{ color: cores.texto, fontFamily: theme.familia.bold }}>{moeda(item.servico)}</Text>
                </Text>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

// -------------------- Botao de lista (igual ao do financeiro) --------------------

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
  cardTitulo: { fontSize: theme.fonte.secao, fontFamily: theme.familia.extrabold },
  cardSub: { fontSize: theme.fonte.pequeno, marginBottom: theme.espaco(1.5) },
  vazio: { fontSize: theme.fonte.corpo, paddingVertical: theme.espaco(3) },
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
  // detalhe do dia selecionado (sob o grafico)
  detDia: { marginTop: theme.espaco(1.5), paddingTop: theme.espaco(1.5), borderTopWidth: 1 },
  detData: { fontSize: theme.fonte.pequeno, fontFamily: theme.familia.semibold, textAlign: "center", marginBottom: 6 },
  detLinha: { flexDirection: "row", alignItems: "center" },
  detCol: { flex: 1, alignItems: "center" },
  detDiv: { width: 1, alignSelf: "stretch", marginVertical: 4 },
  detLabel: { fontSize: theme.fonte.pequeno, fontFamily: theme.familia.semibold },
  detValor: { fontSize: theme.fonte.titulo, fontFamily: theme.familia.extrabold, marginTop: 2 },
  // topo das vistas internas
  topoLista: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.espaco(2),
    marginBottom: theme.espaco(1),
  },
  tituloLista: { fontSize: theme.fonte.secao, fontFamily: theme.familia.extrabold },
  resumoTopo: { alignItems: "center", marginBottom: theme.espaco(1.5) },
  resumoQtd: { fontSize: theme.fonte.secao, fontFamily: theme.familia.extrabold },
  resumoTotal: { fontSize: theme.fonte.pequeno, marginTop: 2 },
  centroTxt: { textAlign: "center", marginTop: theme.espaco(4), fontSize: theme.fonte.corpo },
  // cartao de OS
  osTopo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.espaco(1) },
  osNum: { fontSize: theme.fonte.corpo, fontFamily: theme.familia.extrabold },
  osTotal: { fontSize: theme.fonte.corpo, fontFamily: theme.familia.extrabold },
  osCliente: { fontSize: theme.fonte.corpo, marginTop: 2 },
  osMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, gap: theme.espaco(1) },
  osOperacao: { fontSize: theme.fonte.pequeno, flex: 1 },
  placa: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.raio.sm, borderWidth: 1 },
  placaTxt: { fontSize: theme.fonte.pequeno, fontFamily: theme.familia.bold, letterSpacing: 1 },
  laudoTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.raio.pill },
  laudoTxt: { fontSize: 11, color: "#fff", fontFamily: theme.familia.bold },
  osValores: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: theme.espaco(1.25),
    paddingTop: theme.espaco(1),
    borderTopWidth: 1,
  },
  osVal: { fontSize: theme.fonte.pequeno },
  notasLinha: { flexDirection: "row", flexWrap: "wrap", gap: theme.espaco(1.5), marginTop: 6 },
  notaTxt: { fontSize: theme.fonte.pequeno, fontStyle: "italic" },
  // resumo financeiro
  segmento: { flexDirection: "row", gap: theme.espaco(1), justifyContent: "center", marginBottom: theme.espaco(1) },
  segBtn: { paddingHorizontal: theme.espaco(2.5), paddingVertical: theme.espaco(0.75), borderRadius: theme.raio.pill, borderWidth: 1 },
  segTxt: { fontSize: theme.fonte.pequeno, fontFamily: theme.familia.bold },
  mesBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.espaco(3),
    paddingVertical: theme.espaco(0.5),
  },
  mesTxt: { fontSize: theme.fonte.corpo, fontFamily: theme.familia.bold, minWidth: 160, textAlign: "center" },
  totalLabel: { fontSize: theme.fonte.pequeno, fontFamily: theme.familia.semibold },
  totalValor: { fontSize: theme.fonte.titulo, fontFamily: theme.familia.extrabold, marginTop: 2 },
  totalSub: { fontSize: theme.fonte.pequeno, marginTop: 2 },
});
