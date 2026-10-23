"use client";

import Link from "next/link";
import { Mini } from "./Graficos.js";
import { preco, moedas, pct, seta, rumo } from "./formatos.js";

/**
 * A Bolsa dentro do Reino (e no menu da tela cheia): o Índice do Reino, as maiores altas e baixas
 * desta hora e a minha carteira — e o botão para a tela do pregão (/bolsa), onde se negocia.
 */
export default function ResumoDaBolsa({ bolsa }) {
  return (
    <section className="pf-secao" id="bolsa">
      <h2 className="pf-secao__titulo">📈 Bolsa do Reino <small>a mesma para todos · as cotações mudam de hora em hora</small></h2>
      <div className="bx bx--resumo">
        {!bolsa ? <p className="bx-vazio">Abrindo o pregão…</p> : (
          <>
            <div className="bx-resumo__topo">
              <div className="bx-indice">
                <div>
                  <span className="bx-rotulo">Índice do Reino (IRN)</span>
                  <strong>{preco(bolsa.indice.valor)}</strong>
                  <span className={`bx-txt--${rumo(bolsa.indice.variacao)}`}>{seta(bolsa.indice.variacao)} {pct(bolsa.indice.variacao)} hoje</span>
                </div>
                {bolsa.indice.serie.length > 0 && <Mini horas={bolsa.indice.serie.map((p) => ({ hora: p.hora, preco: p.valor }))} abertura={bolsa.indice.abertura} largura={140} altura={44} />}
              </div>
              <div className="bx-resumo__carteira">
                <span className="bx-rotulo">Minha carteira</span>
                <strong>🪙 {moedas(bolsa.carteira.valor)}</strong>
                <span className={`bx-txt--${rumo(bolsa.carteira.lucro)}`}>{bolsa.carteira.lucro >= 0 ? "+" : "−"}🪙 {moedas(Math.abs(bolsa.carteira.lucro))}</span>
              </div>
            </div>
            {bolsa.pregao.manchete && <p className="bx-manchete"><span>🎙️ LISA</span> {bolsa.pregao.manchete}</p>}
            <ul className="bx-resumo__lista">
              {[...bolsa.acoes].sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao)).slice(0, 4).map((a) => (
                <li key={a.id}>
                  <span aria-hidden="true">{a.emoji}</span> <strong>{a.id}</strong>
                  <Mini horas={a.horas} abertura={a.abertura} largura={70} altura={24} />
                  <span>{preco(a.preco)}</span>
                  <span className={`bx-txt--${rumo(a.variacao)}`}>{seta(a.variacao)} {pct(a.variacao)}</span>
                </li>
              ))}
            </ul>
            <Link href="/bolsa" className="bx-enviar bx-enviar--comprar bx-resumo__abrir">📈 Abrir o pregão</Link>
          </>
        )}
      </div>
    </section>
  );
}
