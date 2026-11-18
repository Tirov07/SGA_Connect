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

export type Banco = { numeroBanco: number; nome: string };

export type Lancamento = {
  data: string; // "AAAA-MM-DD"
  descricao: string;
  nome: string;
  numero: string;
  observacao: string;
  valor: number;
  entrada: boolean;
};

export type Extrato = {
  inicio: string;
  fim: string;
  totalEntradas: number;
  totalSaidas: number;
  resultado: number;
  lancamentos: Lancamento[];
};

export type PontoSaldo = { data: string; saldo: number };

export type SaldoSerie = {
  numeroBanco: number;
  inicio: string;
  fim: string;
  saldoAtual: number;
  pontos: PontoSaldo[];
};

// ---------------- OSv ----------------

export type OsItem = {
  numOs: number;
  cliente: string;
  placa: string;
  operacao: string;
  comLaudo: boolean;
  abertura: string | null;
  fechamento: string | null;
  peca: number;
  servico: number;
  total: number;
};

export type OsLista = {
  quantidade: number;
  totalPeca: number;
  totalServico: number;
  totalGeral: number;
  itens: OsItem[];
};

export type OsAberturaDia = {
  data: string; // "AAAA-MM-DD"
  comLaudo: number;
  semLaudo: number;
  total: number;
};

export type OsAberturas = {
  diasRetornados: number;
  totalComLaudo: number;
  totalSemLaudo: number;
  dias: OsAberturaDia[];
};

export type OsResumoLinha = {
  numOs: number;
  cliente: string;
  notaPeca: string;
  notaServico: string;
  fechamento: string | null;
  peca: number;
  servico: number;
  total: number;
};

export type OsResumo = {
  inicio: string;
  fim: string;
  quantidade: number;
  totalPeca: number;
  totalServico: number;
  totalGeral: number;
  linhas: OsResumoLinha[];
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

  async empresasDoUsuario(token: string): Promise<EmpresaDoUsuario[]> {
    const resp = await fetch(`${API_URL}/auth/empresas-do-usuario`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return tratar(resp);
  },

  /** Troca de empresa sem senha: devolve um novo token para a empresa de destino. */
  async trocarEmpresa(token: string, empresa: string): Promise<LoginResposta> {
    const resp = await fetch(`${API_URL}/auth/trocar-empresa`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ empresa }),
    });
    return tratar(resp);
  },

  async bancos(token: string): Promise<Banco[]> {
    const resp = await fetch(`${API_URL}/financeiro/bancos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return tratar(resp);
  },

  /** Extrato consolidado de 1+ bancos. numeros: lista de NumeroBanco. */
  async extrato(token: string, numeros: number[], dias = 90): Promise<Extrato> {
    const bancos = numeros.join(",");
    const resp = await fetch(`${API_URL}/financeiro/extrato?bancos=${bancos}&dias=${dias}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return tratar(resp);
  },

  /** Serie de saldo acumulado de UM banco (grafico estilo bolsa). */
  async saldo(token: string, numeroBanco: number, dias = 90): Promise<SaldoSerie> {
    const resp = await fetch(`${API_URL}/financeiro/saldo?banco=${numeroBanco}&dias=${dias}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return tratar(resp);
  },

  // ---------------- OSv ----------------

  /** OS em aberto (DataFechamento vazia). */
  async osvAbertas(token: string): Promise<OsLista> {
    const resp = await fetch(`${API_URL}/osv/abertas`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return tratar(resp);
  },

  /** OS fechadas nos ultimos N dias (default 7). */
  async osvFechadas(token: string, dias = 7): Promise<OsLista> {
    const resp = await fetch(`${API_URL}/osv/fechadas?dias=${dias}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return tratar(resp);
  },

  /** Grafico de OSv abertas por dia (com/sem laudo). */
  async osvAberturas(token: string, dias = 10): Promise<OsAberturas> {
    const resp = await fetch(`${API_URL}/osv/aberturas?dias=${dias}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return tratar(resp);
  },

  /**
   * Resumo financeiro por data de FECHAMENTO.
   * periodo "mes": passa mes "AAAA-MM"; periodo "dia": passa data "AAAA-MM-DD".
   */
  async osvResumo(
    token: string,
    periodo: "dia" | "mes",
    chave: string
  ): Promise<OsResumo> {
    const q =
      periodo === "dia"
        ? `periodo=dia&data=${chave}`
        : `periodo=mes&mes=${chave}`;
    const resp = await fetch(`${API_URL}/osv/resumo?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return tratar(resp);
  },
};

export { ApiError };
