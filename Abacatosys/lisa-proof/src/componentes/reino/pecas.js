"use client";

// Peças pequenas que várias partes da tela do Reino usam (a página, a garagem, a mina de ouro, a
// bolsa e a tela cheia).

import { formatarMoedas } from "@/dominio/moedas.js";

export const numero = (n) => new Intl.NumberFormat("pt-BR").format(n || 0);
export const hora = (iso) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
/** Moedas: com centavos quando tem (ou sempre, com `centavos` — o saldo, que é dinheiro de verdade). */
export const Moedas = ({ n, centavos = false }) => <span className="rn-moedas">🪙 {formatarMoedas(n, { sempreComCentavos: centavos })}</span>;

/** Botão que, quando não pode, diz o porquê em vez de só ficar cinza. */
export function Botao({ ok, motivo, ocupado, aoClicar, children, secundario = false }) {
  return (
    <div className="rn-botao">
      <button type="button" className={`pf-botao pf-botao--pequeno${secundario ? " pf-botao--sec" : ""}`} disabled={!ok || ocupado} onClick={aoClicar}>
        {ocupado ? "Um instante…" : children}
      </button>
      {!ok && motivo && <span className="rn-motivo">{motivo}</span>}
    </div>
  );
}
