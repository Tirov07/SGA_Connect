import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { paletas, NomeTema, Paleta } from "./theme";

type TemaContexto = {
  nome: NomeTema;
  cores: Paleta;
  alternar: () => void;
  pronto: boolean; // preferencia ja carregada do storage
};

const CHAVE = "sga_connect_tema";
const Ctx = createContext<TemaContexto | null>(null);

export function TemaProvider({ children }: { children: React.ReactNode }) {
  // Tema CLARO como padrao.
  const [nome, setNome] = useState<NomeTema>("claro");
  const [pronto, setPronto] = useState(false);

  // Restaura a preferencia salva ao abrir.
  useEffect(() => {
    (async () => {
      try {
        const salvo = await AsyncStorage.getItem(CHAVE);
        if (salvo === "claro" || salvo === "escuro") setNome(salvo);
      } catch {
        /* ignora */
      } finally {
        setPronto(true);
      }
    })();
  }, []);

  function alternar() {
    setNome((atual) => {
      const novo: NomeTema = atual === "claro" ? "escuro" : "claro";
      AsyncStorage.setItem(CHAVE, novo).catch(() => {});
      return novo;
    });
  }

  return (
    <Ctx.Provider value={{ nome, cores: paletas[nome], alternar, pronto }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTema() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTema deve ser usado dentro de TemaProvider");
  return c;
}
