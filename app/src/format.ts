export function moeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function horaCurta(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** (2026, 11) -> "Novembro 2026" */
export function rotuloMes(ano: number, mes: number): string {
  const nome = MESES[mes - 1] ?? "";
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${ano}`;
}

/** "AAAA-MM-DD" -> "17/11/2026" (ou "—" se nulo) */
export function dataBr(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Soma/subtrai meses de (ano, mes) 1-based. */
export function somarMes(ano: number, mes: number, delta: number): { ano: number; mes: number } {
  const base = new Date(ano, mes - 1 + delta, 1);
  return { ano: base.getFullYear(), mes: base.getMonth() + 1 };
}

/** (2026, 11) -> "2026-11" */
export function chaveMes(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}
