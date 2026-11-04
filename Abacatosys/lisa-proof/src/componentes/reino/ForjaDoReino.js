"use client";

// A Forja de Artefatos DENTRO do Reino (03/11/2026: "a forja também deveria estar no reino e não num menu à
// parte, inclusive sendo possível ver no reino quais itens da forja estão em efeito"). O estudo vira mana (10
// pontos = 1 mana) e a mana vira artefato: a Poção de Foco (2 h com +50% no que se ganha estudando) e o Escudo
// de Folga (24 h sem invasões). A página do Reino carrega /api/forja e passa para cá e para os selos do mundo 3D
// (EfeitosDaForja). As regras moram em src/dominio/forja.js.

import { useEffect, useState } from "react";
import Link from "next/link";
import { criar } from "@/lib/api.js";
import { comemorar } from "@/componentes/Neuro.js";
import { PONTOS_POR_MANA } from "@/dominio/forja.js";

const quando = (iso) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const hora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
function falta(iso, agora) {
  const min = Math.max(0, Math.round((new Date(iso).getTime() - agora) / 60_000));
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min` : `${min} min`;
}
function useAgora(intervalo = 30_000) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const r = setInterval(() => setAgora(Date.now()), intervalo); return () => clearInterval(r); }, [intervalo]);
  return agora;
}

/** Os artefatos fazendo efeito, em selos por cima do mundo 3D do Reino (some quando não há nenhum). */
export function EfeitosDaForja({ forja, aoAbrir }) {
  const agora = useAgora();
  if (!forja) return null;
  const selos = [];
  if (forja.pocao) selos.push({ id: "pocao", texto: `🧪 Foco +50% · ${falta(forja.pocao.ate, agora)}`, titulo: `Poção de Foco até ${hora(forja.pocao.ate)}: +🪙 ${forja.pocao.juntando} até agora` });
  if (forja.escudoAte) selos.push({ id: "escudo", texto: `🛡️ Escudo até ${hora(forja.escudoAte)}`, titulo: `O reino está protegido de invasões até ${quando(forja.escudoAte)}` });
  if (!selos.length) return null;
  return (
    <div className="rn-efeitos" aria-label="Artefatos da Forja em efeito">
      {selos.map((s) => <button key={s.id} type="button" className="rn-efeitos__selo" title={s.titulo} onClick={aoAbrir} data-so-olhar>{s.texto}</button>)}
    </div>
  );
}

export default function ForjaDoReino({ dados, aoRecarregar, avisar }) {
  const [forjando, setForjando] = useState(null);
  const agora = useAgora();

  async function forjar(a) {
    setForjando(a.id);
    try {
      const r = await criar("/api/forja", { item: a.id });
      comemorar(`${a.emoji} ${a.nome} forjada!`);
      if (r.escudoAte) avisar?.(`🛡️ Reino protegido até ${quando(r.escudoAte)}.`);
      await aoRecarregar?.();
    } catch (e) {
      avisar?.(`Não deu: ${e.message}`);
    } finally {
      setForjando(null);
    }
  }

  return (
    <section className="pf-secao" id="forja" aria-label="Forja de Artefatos">
      <h2 className="pf-secao__titulo">⚒️ Forja de Artefatos <small>o estudo vira mana: {PONTOS_POR_MANA} pontos = 1 mana (as conquistas não contam)</small></h2>
      {!dados && <p className="pf-estat__nota">Acendendo a forja…</p>}
      {dados && (
        <>
          <div className="pf-grade pf-grade--2">
            <div className="pf-cartao fj-mana">
              <div className="pf-estat__rotulo">🔮 Mana</div>
              <div className="pf-estat__valor">{dados.mana.disponivel} <small>disponível</small></div>
              <p className="pf-estat__nota">Juntou {dados.mana.ganha} estudando e gastou {dados.mana.gasta} na forja. Faltam {dados.mana.proxima} ponto(s) de estudo para a próxima mana.</p>
              <Link href="/" className="pf-botao pf-botao--sec">Estudar agora →</Link>
            </div>
            <div className="pf-cartao">
              <div className="pf-estat__rotulo">✨ Fazendo efeito</div>
              {dados.pocao
                ? <p className="pf-estat__nota">🧪 <strong>Poção de Foco</strong> por mais {falta(dados.pocao.ate, agora)}: até agora, +🪙 {dados.pocao.juntando} de extra (cai quando ela acabar).</p>
                : <p className="pf-estat__nota">🧪 Nenhuma Poção de Foco agora.</p>}
              {dados.escudoAte
                ? <p className="pf-estat__nota">🛡️ <strong>Reino protegido</strong> até {quando(dados.escudoAte)} (atacar alguém quebra o escudo).</p>
                : <p className="pf-estat__nota">🛡️ O reino está sem escudo.</p>}
            </div>
          </div>
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
            <details className="fj-historico__caixa">
              <summary>Já forjados ({dados.historico.length})</summary>
              <ul className="fj-historico">
                {dados.historico.map((h) => (
                  <li key={h.id}>
                    <span aria-hidden="true">{h.emoji}</span> {h.nome} · {quando(h.inicio)} · 🔮 {h.mana}
                    {h.ativo ? " · fazendo efeito" : h.item === "pocao" && h.bonus !== null ? ` · rendeu +🪙 ${h.bonus}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
