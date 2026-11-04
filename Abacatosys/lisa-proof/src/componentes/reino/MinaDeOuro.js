"use client";

import { useEffect, useState } from "react";
import { Barra } from "@/componentes/Pecas.js";
import { Moedas, Botao, hora, numero } from "./pecas.js";
import { Ouro, Diamante } from "./icones.js";

/**
 * A Mina de Ouro: as pepitas que os operários juntaram (viram moedas na coleta), a equipe, o
 * contratar, a oferta de aluguel e o mercado de operários dos outros reinos.
 */
export default function MinaDeOuro({ ouro, mercado, ocupado, aoColetar, aoContratar, aoOfertar, aoAlugar }) {
  if (!ouro) return null;
  const e = ouro.equipe;
  return (
    <section className="pf-secao" id="mina-de-ouro">
      <h2 className="pf-secao__titulo">⚒️ Mina de Ouro <small>nível {ouro.nivel} · {ouro.vagas} vagas · <Ouro tamanho={14} /> = 🪙 {ouro.valorDaPepita} · <Diamante tamanho={14} /> = 🪙 {ouro.valorDoDiamante}</small></h2>
      <div className="pf-grade pf-grade--2">
        <article className="pf-cartao rn-ouro">
          <div className="pf-estat__rotulo">Tesouro para coletar {ouro.cheia && <span className="pf-pilula pf-pilula--alerta">cheia</span>}</div>
          <div className="pf-estat__valor rn-ouro__tesouro">
            <span title="barras de ouro"><Ouro tamanho={26} /> {ouro.pepitasDeOuro}</span>
            <span className={ouro.diamantes ? "rn-ouro__diamantes rn-ouro__diamantes--tem" : "rn-ouro__diamantes"} title="diamantes"><Diamante tamanho={26} /> {ouro.diamantes}</span>
            <small>{ouro.pepitas} de {ouro.capacidade} pedras · vale <Moedas n={ouro.moedas} /></small>
          </div>
          <Barra valor={ouro.pepitas} total={Math.max(1, ouro.capacidade)} rotulo="Pedras na mina" />
          <p className="pf-estat__nota">
            {e.trabalhando} operário(s) cavando: cada um tira 1 pedra a cada {ouro.horasPorPepita} h — ouro (🪙 {ouro.valorDaPepita}) ou, com {ouro.chanceDeDiamante}% de sorte, um diamante (🪙 {ouro.valorDoDiamante}).
            Quanto mais funda a mina (o nível), mais diamantes. Cheia, para de juntar.
          </p>
          <Botao ok={ouro.pepitas > 0} motivo="nenhuma pepita inteira ainda" ocupado={ocupado === "ouro"} aoClicar={aoColetar}>
            Coletar{ouro.diamantes ? " ouro e diamantes" : " ouro"}{ouro.moedas ? <> · <Moedas n={ouro.moedas} /></> : null}
          </Botao>
        </article>
        <article className="pf-cartao rn-ouro">
          <div className="pf-estat__rotulo">👷 Operários</div>
          <div className="pf-estat__valor">{e.proprios} <small>seus · {e.emCasa} na mina{e.alugadosParaFora ? ` · ${e.alugadosParaFora} alugado(s) fora` : ""}{e.alugadosDeFora ? ` · +${e.alugadosDeFora} alugado(s) de outros` : ""}</small></div>
          <p className="pf-estat__nota">Todo reino nasce com 3. A mina cabe {ouro.vagas} ({ouro.vagasLivres} vaga(s) livre(s)) — melhore a Mina de Ouro para caber mais.</p>
          <Botao ok={ouro.comprar.ok} motivo={ouro.comprar.motivo} ocupado={ocupado === "operario"} aoClicar={aoContratar}>
            Contratar operário · <Moedas n={ouro.comprar.custo} />
          </Botao>
          {ouro.alugadosParaFora.length > 0 && (
            <ul className="rn-ouro__alugueis">
              {ouro.alugadosParaFora.map((a) => <li key={a.id}>📤 {a.quantidade} com {a.com} até {hora(a.fim)} (recebeu <Moedas n={a.total} />)</li>)}
            </ul>
          )}
          {ouro.alugadosDeFora.length > 0 && (
            <ul className="rn-ouro__alugueis">
              {ouro.alugadosDeFora.map((a) => <li key={a.id}>📥 {a.quantidade} de {a.com} até {hora(a.fim)}</li>)}
            </ul>
          )}
        </article>
      </div>
      <div className="pf-grade pf-grade--2" style={{ marginTop: "var(--pf-gap)" }}>
        <Oferta ouro={ouro} ocupado={ocupado} aoOfertar={aoOfertar} />
        <Mercado mercado={mercado} ouro={ouro} ocupado={ocupado} aoAlugar={aoAlugar} />
      </div>
    </section>
  );
}

/** Pôr os meus operários para alugar: quantos e a que preço (por operário, por 24 h). */
function Oferta({ ouro, ocupado, aoOfertar }) {
  const p = ouro.precoDoAluguel;
  const [quantidade, setQuantidade] = useState(ouro.oferta?.quantidade ?? 0);
  const [preco, setPreco] = useState(ouro.oferta?.preco ?? p.sugerido);
  useEffect(() => { setQuantidade(ouro.oferta?.quantidade ?? 0); setPreco(ouro.oferta?.preco ?? p.sugerido); }, [ouro.oferta?.quantidade, ouro.oferta?.preco, p.sugerido]);
  return (
    <form className="pf-cartao rn-ouro" onSubmit={(ev) => { ev.preventDefault(); aoOfertar({ quantidade: Number(quantidade), preco: Number(preco) }); }}>
      <div className="pf-estat__rotulo">📤 Alugar os meus operários</div>
      <p className="pf-estat__nota" style={{ marginTop: 0 }}>
        {ouro.oferta ? <>Você oferece <strong>{ouro.oferta.quantidade}</strong> a <Moedas n={ouro.oferta.preco} /> cada (24 h).</> : "Ninguém está à venda agora."}{" "}
        Quem aluga paga na hora; enquanto durar, o operário tira ouro na mina de quem alugou.
      </p>
      <div className="rn-ouro__campos">
        <label className="pf-campo">
          <span className="pf-campo__rotulo">Quantos</span>
          <input className="pf-campo__entrada" type="number" min={0} max={ouro.operarios} value={quantidade} onChange={(ev) => setQuantidade(ev.target.value)} />
        </label>
        <label className="pf-campo">
          <span className="pf-campo__rotulo">Preço (🪙 por operário)</span>
          <input className="pf-campo__entrada" type="number" min={p.minimo} max={p.maximo} value={preco} onChange={(ev) => setPreco(ev.target.value)} />
        </label>
      </div>
      <div className="pf-acoes">
        <button type="submit" className="pf-botao pf-botao--pequeno" disabled={Boolean(ocupado)}>{ocupado === "ofertar" ? "Salvando…" : Number(quantidade) ? "Salvar oferta" : "Tirar a oferta"}</button>
      </div>
      <span className="rn-motivo">De {p.minimo} a {p.maximo} moedas. Um operário rende cerca de 🪙 {Math.round(p.sugerido / 0.6)} por dia na mina.</span>
    </form>
  );
}

/** O mercado: operários dos outros reinos para alugar. */
function Mercado({ mercado, ouro, ocupado, aoAlugar }) {
  return (
    <div className="pf-cartao rn-ouro">
      <div className="pf-estat__rotulo">📥 Operários para alugar <small>({ouro.vagasLivres} vaga(s) livre(s) na sua mina)</small></div>
      {!mercado ? <p className="pf-estat__nota">Procurando operários…</p>
        : mercado.length === 0 ? <p className="pf-estat__nota">Ninguém está alugando operários agora.</p>
        : (
          <ul className="rn-mercado">
            {mercado.map((o) => (
              <li key={o.dono}>
                <span className="rn-mercado__quem"><strong>{o.reino}</strong><small>{o.nome} · {o.disponiveis} disponível(is)</small></span>
                <span className="rn-mercado__preco"><Moedas n={o.preco} /> <small>cada / 24 h</small></span>
                <button type="button" className="pf-botao pf-botao--pequeno" disabled={Boolean(ocupado) || ouro.vagasLivres < 1}
                  onClick={() => aoAlugar(o, 1)}>{ocupado === `alugar:${o.dono}` ? "Alugando…" : "Alugar 1"}</button>
                {o.disponiveis > 1 && ouro.vagasLivres > 1 && (
                  <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={Boolean(ocupado)}
                    onClick={() => aoAlugar(o, Math.min(o.disponiveis, ouro.vagasLivres))}>Alugar {Math.min(o.disponiveis, ouro.vagasLivres)} · 🪙 {numero(o.preco * Math.min(o.disponiveis, ouro.vagasLivres))}</button>
                )}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
