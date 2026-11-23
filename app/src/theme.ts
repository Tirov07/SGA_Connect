/**
 * Tema do SGA Connect — estilo dashboard moderno, com tema CLARO (padrao) e ESCURO.
 *
 * - `theme` guarda os tokens que NAO mudam com o tema (espaco, raio, fonte, cores do grafico).
 * - `paletas.claro` / `paletas.escuro` trazem as CORES, que mudam conforme o tema ativo.
 *
 * As telas pegam as cores via useTema() (TemaProvider), nao direto daqui, para reagir
 * a troca de tema em tempo real.
 */

export type Paleta = {
  fundo: string;
  superficie: string;
  superficie2: string;
  borda: string;
  texto: string;
  textoFraco: string;
  textoApagado: string;
  primaria: string;
  primariaEscura: string;
  positivo: string;
  negativo: string;
  atencao: string;
  /** Sombra dos cards (mais forte no escuro, mais suave no claro). */
  sombraCard: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
};

const escuro: Paleta = {
  fundo: "#0E0E10",
  superficie: "#1A1A1E",
  superficie2: "#232329",
  borda: "#2E2E35",
  texto: "#F5F5F7",
  textoFraco: "#9A9AA3",
  textoApagado: "#6B6B73",
  primaria: "#E11D2A",
  primariaEscura: "#B5151F",
  positivo: "#35C759",
  negativo: "#E11D2A",
  atencao: "#F5A623",
  sombraCard: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};

const claro: Paleta = {
  // Fundo cinza claro (nao branco estourado), cards brancos.
  fundo: "#ECECEF",
  superficie: "#FFFFFF",
  superficie2: "#F4F4F6",
  borda: "#E2E2E8",
  texto: "#17171B",
  textoFraco: "#5B5B66",
  textoApagado: "#9A9AA3",
  primaria: "#E11D2A",
  primariaEscura: "#B5151F",
  positivo: "#1E9E4A",
  negativo: "#E11D2A",
  atencao: "#C77B12",
  sombraCard: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};

export const paletas = { claro, escuro } as const;
export type NomeTema = keyof typeof paletas;

export const theme = {
  raio: { sm: 10, md: 16, lg: 22, pill: 999 },
  espaco: (n: number) => n * 8,
  fonte: { titulo: 30, secao: 19, corpo: 15, pequeno: 13, numeroCard: 32 },
  familia: {
    regular: "Manrope_400Regular",
    medio: "Manrope_500Medium",
    semibold: "Manrope_600SemiBold",
    bold: "Manrope_700Bold",
    extrabold: "Manrope_800ExtraBold",
  },
  // Tracking (letter-spacing) por uso. Titulos/numeros grandes ficam "apertados"
  // (negativo) como nos apps de referencia; rotulos pequenos em caixa alta abrem um pouco.
  tracking: { titulo: -0.5, numero: -0.8, rotulo: 0.5 },
  // Cores do grafico (iguais nos dois temas): peca (ambar) x servico (teal).
  grafico: {
    peca: "#F5A623",
    pecaEscura: "#B9791A",
    servico: "#2DD4BF",
    servicoEscura: "#1A9183",
  },
} as const;

export type Theme = typeof theme;
