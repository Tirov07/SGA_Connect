import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../auth";
import { useTema } from "../tema";
import { theme } from "../theme";
import { BotaoTema } from "./BotaoTema";

/**
 * Botoes do topo da Home: tema, trocar empresa (so se houver +1) e sair.
 * A troca de empresa abre um modal com as empresas do usuario e usa /auth/trocar-empresa
 * (sem senha).
 */
export function BotoesTopo() {
  const { sessao, trocarEmpresa, sair } = useAuth();
  const { cores } = useTema();
  const [aberto, setAberto] = useState(false);
  const [trocando, setTrocando] = useState<string | null>(null);

  const temMais = (sessao?.empresas?.length ?? 0) > 1;

  async function escolher(empresa: string) {
    if (empresa === sessao?.empresa) {
      setAberto(false);
      return;
    }
    setTrocando(empresa);
    try {
      await trocarEmpresa(empresa);
      setAberto(false);
    } catch {
      /* mantem aberto; poderia exibir erro */
    } finally {
      setTrocando(null);
    }
  }

  return (
    <View style={estilos.linha}>
      <BotaoTema />

      {temMais ? (
        <TouchableOpacity
          onPress={() => setAberto(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Trocar empresa"
          style={[estilos.icone, { backgroundColor: cores.superficie, borderColor: cores.borda }]}
        >
          <Feather name="refresh-cw" size={17} color={cores.texto} />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[estilos.sair, { borderColor: cores.borda, backgroundColor: cores.superficie }]}
        onPress={sair}
      >
        <Text style={[estilos.sairTxt, { color: cores.textoFraco }]}>Sair</Text>
      </TouchableOpacity>

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <TouchableOpacity style={estilos.backdrop} activeOpacity={1} onPress={() => setAberto(false)}>
          <View style={[estilos.folha, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
            <Text style={[estilos.folhaTitulo, { color: cores.texto }]}>Trocar empresa</Text>
            {sessao?.empresas.map((e) => {
              const ativa = e.empresa === sessao.empresa;
              return (
                <TouchableOpacity
                  key={e.empresa}
                  style={[estilos.item, { borderColor: cores.borda }]}
                  onPress={() => escolher(e.empresa)}
                  disabled={trocando !== null}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[estilos.itemNome, { color: cores.texto }]}>{e.empresa.toUpperCase()}</Text>
                    <Text style={[estilos.itemDono, { color: cores.textoFraco }]}>{e.nome}</Text>
                  </View>
                  {trocando === e.empresa ? (
                    <ActivityIndicator color={cores.primaria} />
                  ) : ativa ? (
                    <Feather name="check" size={20} color={cores.primaria} />
                  ) : (
                    <Feather name="chevron-right" size={20} color={cores.textoApagado} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: "row", alignItems: "center", gap: theme.espaco(1) },
  icone: {
    width: 40,
    height: 40,
    borderRadius: theme.raio.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sair: {
    paddingVertical: theme.espaco(1),
    paddingHorizontal: theme.espaco(2),
    borderRadius: theme.raio.pill,
    borderWidth: 1,
  },
  sairTxt: { fontFamily: theme.familia.bold, fontSize: theme.fonte.pequeno },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: theme.espaco(3),
  },
  folha: {
    borderRadius: theme.raio.lg,
    borderWidth: 1,
    padding: theme.espaco(2),
  },
  folhaTitulo: { fontSize: theme.fonte.secao, fontFamily: theme.familia.extrabold, marginBottom: theme.espaco(1.5) },
  item: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: theme.raio.md,
    paddingVertical: theme.espaco(1.5),
    paddingHorizontal: theme.espaco(1.5),
    marginBottom: theme.espaco(1),
  },
  itemNome: { fontSize: theme.fonte.corpo, fontFamily: theme.familia.bold },
  itemDono: { fontSize: theme.fonte.pequeno, marginTop: 2 },
});
