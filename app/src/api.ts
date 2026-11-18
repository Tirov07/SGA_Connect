import { API_URL } from "./config";

export type EmpresaDoUsuario = { empresa: string; nome: string; codEmpresa: number };

export type LoginResposta = {
  token: string | null;
  expiraEm: string | null;
  nome: string | null;
  empresa: string | null;
  codEmpresa: number | null;
  precisaEscolherEmpresa: boolean;
  empresas: EmpresaDoUsuario[] | null;
};

export type Resumo = {
  empresa: string;
  geradoEm: string;
  ordensServicoAbertas: number;
  ordensServicoFechadas7Dias: number;
  totalAReceberMes: number;
  totalAPagarMes: number;
};

export type VendaDia = {
  data: string; // "AAAA-MM-DD"
  peca: number;
  servico: number;
  total: number;
};

export type VendasResumo = {
  diasRetornados: number;
  totalPeca: number;
  totalServico: number;
  dias: VendaDia[];
};

export type Titulo = {
  nome: string;
  numero: string;
  vencimento: string | null; // "AAAA-MM-DD"
  saldo: number;
  observacao: string;
};

export type Titulos = {
  ano: number;
  mes: number;
  quantidade: number;
  total: number;
  titulos: Titulo[];
};

export type Vencidos = {
  qtdReceber: number;
  totalReceber: number;
  qtdPagar: number;
  totalPagar: number;
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
  /**
   * Login com CPF + senha. Na 1a chamada, nao envia empresa: se o CPF existir em varias,
   * a resposta vem com precisaEscolherEmpresa=true e a lista. Aí chamamos de novo passando
   * a empresa escolhida.
   */
  async login(login: string, senha: string, empresa?: string): Promise<LoginResposta> {
    const resp = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, senha, empresa: empresa ?? null }),
    });
    return tratar(resp);
  },

  async resumo(token: string): Promise<Resumo> {
    const resp = await fetch(`${API_URL}/resumo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return tratar(resp);
  },

  async vendasResumo(token: string, dias = 20): Promise<VendasResumo> {
    const resp = await fetch(`${API_URL}/vendas-resumo?dias=${dias}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return tratar(resp);
  },

  async vencidos(token: string): Promise<Vencidos> {
    const resp = await fetch(`${API_URL}/financeiro/vencidos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return tratar(resp);
  },

  /** tipo: "receber" | "pagar"; mes: "AAAA-MM" (opcional, default mes atual) */
  async titulos(token: string, tipo: "receber" | "pagar", mes?: string): Promise<Titulos> {
    const q = mes ? `?mes=${mes}` : "";
    const resp = await fetch(`${API_URL}/financeiro/${tipo}${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return tratar(resp);
  },
};

export { ApiError };
