import { API_URL } from "./config";

export type Empresa = { chave: string; nomePasta: string; bancoExiste: boolean };

export type LoginResposta = {
  token: string;
  expiraEm: string;
  nome: string;
  empresa: string;
  codEmpresa: number;
};

export type Resumo = {
  empresa: string;
  geradoEm: string;
  ordensServicoAbertas: number;
  ordensServicoFechadas7Dias: number;
  totalAReceberMes: number;
  totalAPagarMes: number;
};

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function tratar(resp: Response) {
  if (resp.ok) return resp.json();
  let msg = `Erro ${resp.status}`;
  try {
    const corpo = await resp.json();
    if (corpo?.erro) msg = corpo.erro;
  } catch {
    /* corpo nao-JSON */
  }
  throw new ApiError(resp.status, msg);
}

export const api = {
  async listarEmpresas(): Promise<Empresa[]> {
    const resp = await fetch(`${API_URL}/auth/empresas`);
    return tratar(resp);
  },

  async login(login: string, senha: string, empresa: string): Promise<LoginResposta> {
    const resp = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, senha, empresa }),
    });
    return tratar(resp);
  },

  async resumo(token: string): Promise<Resumo> {
    const resp = await fetch(`${API_URL}/resumo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return tratar(resp);
  },
};

export { ApiError };
