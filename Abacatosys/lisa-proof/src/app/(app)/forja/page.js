"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { obter, criar } from "@/lib/api.js";
import { useAviso } from "@/componentes/Pecas.js";
import { comemorar } from "@/componentes/Neuro.js";
import { PONTOS_POR_MANA } from "@/dominio/forja.js";

const quando = (iso) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
function falta(iso, agora) {
  const min = Math.max(0, Math.round((new Date(iso).getTime() - agora) / 60_000));
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min` : `${min} min`;
}

/**
 * A Forja de Artefatos (03/11/2026): o estudo vira mana (10 pontos = 1 mana) e a mana vira artefato — a Poção
 * de Foco (2 h com +50% no que você ganhar estudando) e o Escudo de Folga (24 h sem invasões). As regras moram
 * em src/dominio/forja.js.
 */
export default function Forja() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [forjando, setForjando] = useState(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [Aviso, avisar] = useAviso();

  const carregar = useCallback(() => obter("/api/forja").then((d) => {
    setDados(d);
    for (const p of d.pagasAgora || []) if (p.bonus > 0) comemorar(`🧪 A Poção de Foco rendeu +🪙 ${p.bonus}!`);
  }).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(relogio);
  }, []);

  async function forjar(a) {
    setForjando(a.id);
    try {
      const r = await criar("/api/forja", { item: a.id });
      comemorar(`${a.emoji} ${a.nome} forjada!`);
      if (r.escudoAte) avisar(`🛡️ Reino protegido até ${quando(r.escudoAte)}.`);
      await carregar();
    } catch (e) {
      avisar(`Não deu: ${e.message}`);
    } finally {
      setForjando(null);
    }
  }

  const mana = dados?.mana;
  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>⚒️ Forja de Artefatos</h1>
          <p>O tempo que você passa estudando vira mana: cada {PONTOS_POR_MANA} pontos de estudo dão 1 de mana (as conquistas não contam). Com a mana, forje artefatos para o seu reino.</p>
        </div>
      </div>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      {!dados && !erro && <p className="pf-estat__nota">Acendendo a forja…</p>}
      {dados && (
        <>
          <div className="pf-grade pf-grade--2 pf-secao">
            <section className="pf-cartao fj-mana">
              <div className="pf-estat__rotulo">🔮 Mana</div>
              <div className="pf-estat__valor">{mana.disponivel} <small>disponível</small></div>
              <p className="pf-estat__nota">Juntou {mana.ganha} estudando e gastou {mana.gasta} na forja. Faltam {mana.proxima} ponto(s) de estudo para a próxima mana.</p>
              <Link href="/" className="pf-botao pf-botao--sec">Estudar agora →</Link>
            </section>
            <section className="pf-cartao">
              <div className="pf-estat__rotulo">✨ Fazendo efeito</div>
              {dados.pocao ? (
                <p className="pf-estat__nota">🧪 <strong>Poção de Foco</strong> por mais {falta(dados.pocao.ate, agora)}: até agora, +🪙 {dados.pocao.juntando} de extra (cai quando ela acabar).</p>
              ) : <p className="pf-estat__nota">🧪 Nenhuma Poção de Foco agora.</p>}
              {dados.escudoAte ? (
                <p className="pf-estat__nota">🛡️ <strong>Reino protegido</strong> até {quando(dados.escudoAte)} (atacar alguém quebra o escudo).</p>
              ) : <p className="pf-estat__nota">🛡️ O reino está sem escudo.</p>}
            </section>
          </div>

          <h2 className="pf-secao__titulo">Artefatos</h2>
          <ul className="fj-artefatos">
            {dados.artefatos.map((a) => (
              <li key={a.id} className="pf-cartao fj-artefato">
                <div className="fj-artefato__emoji" aria-hidden="true">{a.emoji}</div>
                <div className="fj-artefato__texto">
                  <h3>{a.nome} <span className="pf-pilula">🔮 {a.mana}</span></h3>
                  <p className="pf-estat__nota">{a.descricao}</p>
                  <button type="button" className="pf-botao" disabled={!a.pode || Boolean(forjando)} onClick={() => forjar(a)}>
                    {forjando === a.id ? "Forjando…" : `⚒️ Forjar · 🔮 ${a.mana}`}
                  </button>
                  {!a.pode && a.motivo && <p className="pf-estat__nota fj-artefato__motivo">{a.motivo}</p>}
                </div>
              </li>
            ))}
          </ul>

          {dados.historico.length > 0 && (
            <>
              <h2 className="pf-secao__titulo">Já forjados</h2>
              <ul className="fj-historico">
                {dados.historico.map((h) => (
                  <li key={h.id}>
                    <span aria-hidden="true">{h.emoji}</span> {h.nome} · {quando(h.inicio)} · 🔮 {h.mana}
                    {h.ativo ? " · fazendo efeito" : h.item === "pocao" && h.bonus !== null ? ` · rendeu +🪙 ${h.bonus}` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {Aviso}
    </>
  );
}
