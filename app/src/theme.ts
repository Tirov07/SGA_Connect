/**
 * Tema do SGA Connect — vermelho / cinza / preto, estilo dashboard moderno.
 * Centralizar aqui facilita trocar a identidade visual depois (nome, cores, raios).
 */
export const theme = {
  cores: {
    fundo: "#0E0E10", // quase preto
    superficie: "#1A1A1E", // card
    superficie2: "#232329", // card elevado / input
    borda: "#2E2E35",
    texto: "#F5F5F7",
    textoFraco: "#9A9AA3",
    textoApagado: "#6B6B73",
    primaria: "#E11D2A", // vermelho Canada
    primariaEscura: "#B5151F",
    positivo: "#35C759", // a receber
    negativo: "#E11D2A", // a pagar
    atencao: "#F5A623",
  },
  raio: {
    sm: 10,
    md: 16,
    lg: 22,
    pill: 999,
  },
  espaco: (n: number) => n * 8,
  sombra: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
  },
  fonte: {
    titulo: 28,
    secao: 18,
    corpo: 15,
    pequeno: 13,
    numeroCard: 30,
  },
  // Familias Manrope (carregadas no _layout). Use sempre via estes nomes.
  familia: {
    regular: "Manrope_400Regular",
    medio: "Manrope_500Medium",
    semibold: "Manrope_600SemiBold",
    bold: "Manrope_700Bold",
    extrabold: "Manrope_800ExtraBold",
  },
  // Cores do grafico de vendas: peca (ambar) x servico (teal).
  grafico: {
    peca: "#F5A623",
    pecaEscura: "#B9791A",
    servico: "#2DD4BF",
    servicoEscura: "#1A9183",
  },
} as const;

export type Theme = typeof theme;
