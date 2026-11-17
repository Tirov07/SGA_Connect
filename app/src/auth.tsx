import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { api, LoginResposta, EmpresaDoUsuario } from "./api";

type Sessao = {
  token: string;
  nome: string;
  empresa: string;
  codEmpresa: number;
  expiraEm: string;
};

/**
 * Resultado do entrar(): ou a sessao foi criada (ok), ou o CPF existe em varias
 * empresas e o app precisa mostrar a lista para o usuario escolher.
 */
type ResultadoEntrar =
  | { tipo: "ok" }
  | { tipo: "escolher"; empresas: EmpresaDoUsuario[] };

type AuthContexto = {
  sessao: Sessao | null;
  carregando: boolean;
  entrar: (login: string, senha: string, empresa?: string) => Promise<ResultadoEntrar>;
  sair: () => Promise<void>;
};

const CHAVE = "sga_connect_sessao";
const Ctx = createContext<AuthContexto | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Restaura a sessao guardada ao abrir o app (se o token ainda nao expirou).
  useEffect(() => {
    (async () => {
      try {
        const salvo = await SecureStore.getItemAsync(CHAVE);
        if (salvo) {
          const s = JSON.parse(salvo) as Sessao;
          if (new Date(s.expiraEm).getTime() > Date.now()) setSessao(s);
          else await SecureStore.deleteItemAsync(CHAVE);
        }
      } catch {
        /* ignora sessao corrompida */
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  async function entrar(
    login: string,
    senha: string,
    empresa?: string
  ): Promise<ResultadoEntrar> {
    const r: LoginResposta = await api.login(login, senha, empresa);

    // CPF em varias empresas: ainda nao ha token; o app mostra a lista para escolher.
    if (r.precisaEscolherEmpresa && r.empresas) {
      return { tipo: "escolher", empresas: r.empresas };
    }

    if (!r.token || !r.empresa || r.codEmpresa == null || !r.expiraEm) {
      throw new Error("Resposta de login invalida.");
    }

    const s: Sessao = {
      token: r.token,
      nome: r.nome ?? "",
      empresa: r.empresa,
      codEmpresa: r.codEmpresa,
      expiraEm: r.expiraEm,
    };
    await SecureStore.setItemAsync(CHAVE, JSON.stringify(s));
    setSessao(s);
    return { tipo: "ok" };
  }

  async function sair() {
    await SecureStore.deleteItemAsync(CHAVE);
    setSessao(null);
  }

  return (
    <Ctx.Provider value={{ sessao, carregando, entrar, sair }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return c;
}
