"use client";

import { useEffect, useState } from "react";
import Folha from "@/componentes/Folha.js";
import { Moedas, Botao, hora, numero } from "./pecas.js";
import { faixaDePreco, descontoSobreOTreino, MAXIMO_POR_ANUNCIO, ANUNCIOS_POR_REINO } from "@/dominio/mercadoDeTropas.js";

const NA_RESERVA = { exercito: "no exército", guarnicao: "na defesa" };
const DA_RESERVA = { exercito: "do exército", guarnicao: "da defesa" };

/**
 * O Mercado de Tropas (30/10/2026): as tropas que os outros reinos puseram à venda, os meus
 * anúncios (com o retirar) e as minhas vendas. Quem compra escolhe se elas vão para o exército ou
 * para a defesa — com as mesmas regras do treino. Vender é pelo botão "💱 Vender" de cada tropa.
 */
export default function MercadoDeTropas({ mercado, ocupado, aoComprar, aoRetirar }) {
  const [destino, setDestino] = useState("exercito");
  return (
    <section className="pf-secao" id="mercado-de-tropas">
      <h2 className="pf-secao__titulo">🏪 Mercado de tropas <small>venda o que sobra para liberar espaço · compre mais barato que treinar</small></h2>
      <div className="pf-grade pf-grade--2">
        <article className="pf-cartao rn-ouro">
          <div className="pf-estat__rotulo">📥 À venda nos outros reinos</div>
          <div className="rn-mt__destino" role="radiogroup" aria-label="Para onde vão as tropas compradas">
            <span className="pf-campo__rotulo">Comprar para</span>
            {["exercito", "guarnicao"].map((d) => (
              <button key={d} type="button" role="radio" aria-checked={destino === d}
                className={`rn-dias__opcao${destino === d ? " rn-dias__opcao--atual" : ""}`} onClick={() => setDestino(d)}>
                {d === "exercito" ? "⚔️ Exército" : "🛡️ Defesa"}
              </button>
            ))}
          </div>
          {!mercado ? <p className="pf-estat__nota">Procurando tropas à venda…</p>
            : mercado.ofertas.length === 0 ? <p className="pf-estat__nota">Ninguém está vendendo tropas agora.</p>
            : (
              <ul className="rn-mercado">
                {mercado.ofertas.map((o) => {
                  const maximo = o.maximo[destino];
                  const comprando = ocupado === `mercado:comprar:${o.id}`;
                  return (
                    <li key={o.id}>
                      <span className="rn-mt__emoji" aria-hidden="true">{o.emoji}</span>
                      <span className="rn-mercado__quem">
                        <strong>{o.nome} <small>×{o.quantidade}</small></strong>
                        <small>{o.reino} · {o.vendedor}</small>
                      </span>
                      <span className="rn-mercado__preco">
                        <Moedas n={o.preco} /> <small>cada</small>
                        {o.desconto > 0 && <span className="pf-pilula pf-pilula--verde rn-mt__desconto">−{o.desconto}% do treino</span>}
                      </span>
                      {maximo > 0 ? (
                        <span className="rn-mt__botoes">
                          <button type="button" className="pf-botao pf-botao--pequeno" disabled={Boolean(ocupado)} onClick={() => aoComprar(o, 1, destino)}>
                            {comprando ? "Comprando…" : <>Comprar 1 · <Moedas n={o.preco} /></>}
                          </button>
                          {maximo > 1 && (
                            <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={Boolean(ocupado)} onClick={() => aoComprar(o, maximo, destino)}>
                              Comprar {maximo} · <Moedas n={o.preco * maximo} />
                            </button>
                          )}
                        </span>
                      ) : <span className="rn-motivo rn-mt__motivo">{o.motivo[destino]}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          <span className="rn-motivo">As tropas compradas seguem as regras do treino: a construção no nível da tropa, o espaço {destino === "exercito" ? "do exército" : "da defesa"} e a lotação do Acampamento.</span>
        </article>

        <article className="pf-cartao rn-ouro">
          <div className="pf-estat__rotulo">📤 Os meus anúncios <small>({mercado?.meus.length ?? 0} de {ANUNCIOS_POR_REINO})</small></div>
          {!mercado ? <p className="pf-estat__nota">…</p>
            : mercado.meus.length === 0 ? (
              <p className="pf-estat__nota" style={{ marginTop: 0 }}>Nenhuma tropa à venda. Toque em <strong>💱 Vender</strong> numa tropa do exército ou da defesa: ela sai na hora e o espaço fica livre.</p>
            ) : (
              <ul className="rn-mercado">
                {mercado.meus.map((a) => (
                  <li key={a.id}>
                    <span className="rn-mt__emoji" aria-hidden="true">{a.emoji}</span>
                    <span className="rn-mercado__quem">
                      <strong>{a.nome} <small>{a.restante} de {a.quantidade} à venda</small></strong>
                      <small>saiu {DA_RESERVA[a.origem]} · <Moedas n={a.preco} /> cada{a.vendidas ? ` · ${a.vendidas} vendida(s)` : ""}</small>
                    </span>
                    <Botao ok={a.podeRetirar} motivo={a.motivo} ocupado={ocupado === `mercado:retirar:${a.id}`} secundario aoClicar={() => aoRetirar(a)}>
                      Retirar
                    </Botao>
                  </li>
                ))}
              </ul>
            )}
          {mercado?.vendas.length > 0 && (
            <>
              <div className="pf-estat__rotulo" style={{ marginTop: 8 }}>💰 Vendas recentes</div>
              <ul className="rn-ouro__alugueis">
                {mercado.vendas.map((v) => (
                  <li key={v.id}>+<Moedas n={v.valor} /> · {v.quantidade} {v.emoji} {v.nome} para {v.comprador} <small className="rn-motivo">{hora(v.quando)}</small></li>
                ))}
              </ul>
            </>
          )}
          <span className="rn-motivo">Retirar devolve o que não foi vendido para a reserva de onde saiu — se ainda couber lá.</span>
        </article>
      </div>
    </section>
  );
}

/**
 * A folha de vender: quantas tropas e a que preço. `venda`: { origem, tropa } — `tropa` é o item do
 * catálogo da reserva (chave, nome, emoji, espaco, custo, tem).
 */
export function VenderTropas({ venda, ocupado, aoFechar, aoVender }) {
  const tropa = venda?.tropa;
  const faixa = faixaDePreco(tropa?.chave);
  const limite = Math.min(tropa?.tem || 0, MAXIMO_POR_ANUNCIO);
  const [quantidade, setQuantidade] = useState(1);
  const [preco, setPreco] = useState(faixa.sugerido);
  useEffect(() => {
    if (!venda) return;
    setQuantidade(1);
    setPreco(faixaDePreco(venda.tropa.chave).sugerido);
  }, [venda]);

  const q = Math.floor(Number(quantidade)) || 0, p = Math.floor(Number(preco)) || 0;
  const valido = q >= 1 && q <= limite && p >= faixa.minimo && p <= faixa.maximo;
  return (
    <Folha aberta={Boolean(venda)} aoFechar={aoFechar} titulo="Vender tropas">
      {venda && (
        <form className="rn-convite-novo" onSubmit={(ev) => { ev.preventDefault(); if (valido) aoVender({ tropa: tropa.chave, origem: venda.origem, quantidade: q, preco: p }); }}>
          <span className="rn-convite__selo">💱 Mercado de tropas</span>
          <h2 className="rn-convite__titulo">{tropa.emoji} Vender {tropa.nome} {DA_RESERVA[venda.origem]}</h2>
          <p className="pf-estat__nota" style={{ marginTop: 0 }}>
            Você tem <strong>{tropa.tem}</strong> {NA_RESERVA[venda.origem]}. As tropas anunciadas <strong>saem na hora</strong>: o espaço fica livre e elas não lutam mais por você.
          </p>
          <div className="rn-ouro__campos">
            <label className="pf-campo">
              <span className="pf-campo__rotulo">Quantas (até {limite})</span>
              <input className="pf-campo__entrada" type="number" inputMode="numeric" min={1} max={limite} value={quantidade} onChange={(ev) => setQuantidade(ev.target.value)} />
            </label>
            <label className="pf-campo">
              <span className="pf-campo__rotulo">Preço (🪙 por tropa)</span>
              <input className="pf-campo__entrada" type="number" inputMode="numeric" min={faixa.minimo} max={faixa.maximo} value={preco} onChange={(ev) => setPreco(ev.target.value)} />
            </label>
          </div>
          {limite > 1 && (
            <div className="pf-acoes" style={{ marginTop: 8 }}>
              <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setQuantidade(limite)}>Todas ({limite})</button>
              <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setPreco(faixa.sugerido)}>Preço sugerido (<Moedas n={faixa.sugerido} />)</button>
            </div>
          )}
          <ul className="rn-mt__resumo">
            <li>Libera <strong>{numero(Math.max(0, q) * (tropa.espaco || 0))}</strong> de espaço agora</li>
            <li>Você recebe até <Moedas n={Math.max(0, q) * Math.max(0, p)} /> quando venderem{p > 0 && p <= faixa.maximo ? ` (${descontoSobreOTreino(tropa.chave, p)}% mais barato que treinar)` : ""}</li>
          </ul>
          <div className="pf-acoes">
            <button type="submit" className="pf-botao" disabled={!valido || Boolean(ocupado)}>
              {ocupado === "mercado:anunciar" ? "Anunciando…" : "💱 Anunciar e liberar espaço"}
            </button>
            <button type="button" className="pf-botao pf-botao--sec" onClick={aoFechar}>Agora não</button>
          </div>
          <p className="rn-motivo">
            Preço de {faixa.minimo} a {faixa.maximo} moedas por tropa (treinar custa {faixa.maximo}). Mudou de ideia? Retire o anúncio: o que não foi vendido volta {NA_RESERVA[venda.origem]}, se couber.
          </p>
        </form>
      )}
    </Folha>
  );
}
