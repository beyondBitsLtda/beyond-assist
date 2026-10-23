// Os números da Bolsa do Reino: preço com centavos, variação com sinal e seta, hora e dia curtos.

const comCentavos = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inteiro = new Intl.NumberFormat("pt-BR");

export const preco = (n) => comCentavos.format(Number(n) || 0);
export const moedas = (n) => inteiro.format(Math.round(Number(n) || 0));
/** "+2,4%" / "−1,0%" / "0,0%" — o sinal de menos tipográfico, para não confundir com hífen. */
export const pct = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${comCentavos.format(Math.abs(v)).replace(/,(\d)0$/, ",$1")}%`;
export const seta = (v) => (v > 0 ? "▲" : v < 0 ? "▼" : "•");
export const rumo = (v) => (v > 0 ? "sobe" : v < 0 ? "cai" : "igual");
export const horaCurta = (h) => `${String(h).padStart(2, "0")}h`;
export const diaCurto = (dia) => { const [, m, d] = String(dia).split("-"); return `${d}/${m}`; };
