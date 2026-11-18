import React, { createContext, useContext, useEffect, useState } from "react";
import { api, LoginResposta, EmpresaDoUsuario } from "./api";
import { armazenamento } from "./armazenamento";

type Sessao = {
  token: string;
  nome: string;
  empresa: string;
  codEmpresa: number;
  expiraEm: string;
  /** Empresas do usuario (para o botao Trocar empresa). >1 = mostra o botao. */
  empresas: EmpresaDoUsuario[];
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
  trocarEmpresa: (empresa: string) => Promise<void>;
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
        const salvo = await armazenamento.ler(CHAVE);
        if (salvo) {
          const s = JSON.parse(salvo) as Sessao;
          if (!Array.isArray(s.empresas)) s.empresas = []; // sessao antiga sem o campo
          if (new Date(s.expiraEm).getTime() > Date.now()) setSessao(s);
          else await armazenamento.apagar(CHAVE);
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
    await criarSessao(r);
    return { tipo: "ok" };
  }

  // Monta a sessao a partir da resposta de login/troca e busca a lista de empresas do CPF.
  async function criarSessao(r: LoginResposta) {
    let empresas: EmpresaDoUsuario[] = [];
    try {
      empresas = await api.empresasDoUsuario(r.token!);
    } catch {
      /* se falhar, segue sem o botao de trocar */
    }
    const s: Sessao = {
      token: r.token!,
      nome: r.nome ?? "",
      empresa: r.empresa!,
      codEmpresa: r.codEmpresa!,
      expiraEm: r.expiraEm!,
      empresas,
    };
    await armazenamento.guardar(CHAVE, JSON.stringify(s));
    setSessao(s);
  }

  async function trocarEmpresa(empresa: string) {
    if (!sessao) return;
    const r = await api.trocarEmpresa(sessao.token, empresa);
    if (!r.token || !r.empresa || r.codEmpresa == null || !r.expiraEm)
      throw new Error("Falha ao trocar de empresa.");
    // Mantem a lista de empresas que ja tinhamos (evita nova varredura).
    const s: Sessao = {
      token: r.token,
      nome: r.nome ?? sessao.nome,
      empresa: r.empresa,
      codEmpresa: r.codEmpresa,
      expiraEm: r.expiraEm,
      empresas: sessao.empresas,
    };
    await armazenamento.guardar(CHAVE, JSON.stringify(s));
    setSessao(s);
  }

  async function sair() {
    await armazenamento.apagar(CHAVE);
    setSessao(null);
  }

  return (
    <Ctx.Provider value={{ sessao, carregando, entrar, trocarEmpresa, sair }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return c;
}
