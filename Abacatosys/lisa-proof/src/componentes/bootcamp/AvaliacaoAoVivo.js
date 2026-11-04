"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Neuro from "@/componentes/Neuro.js";
import Codigo from "@/componentes/codigo/Codigo.js";
import DesenhoDoJurado from "./Jurados.js";
import { MedidorDeEmocao, RESULTADO } from "./Pecas.js";
import { roteiroDaAvaliacao, emocaoInicial, reagirNaCena, humorDaEmocao } from "@/dominio/bootcamp.js";

// quanto dura cada parte da cena (ms); com "reduzir movimento", a caminhada é curta (o avatar vai direto)
const TEMPO = { entrando: 3200, entrandoSemMovimento: 700, notaMin: 2600, resultado: 2600, porLetra: 55, itemMin: 3800 };

/**
 * A avaliação ao vivo do Modo Bootcamp (04/11/2026): um competidor por vez — do melhor prato ao pior — vai até a
 * bancada; os jurados fazem o code review ao vivo (o trecho bem ou mal avaliado e a fala de cada um), a nota sai e
 * o resultado fecha a cena. O avatar reage (aflição, felicidade, raiva, tristeza) e o medidor mostra a emoção.
 *
 * `aoMudar({ palco, humores })` leva a cena ao escritório 3D (quem está no palco, qual jurado fala e os humores);
 * `aoAcabar()` fecha. Dá para pular a cena de um competidor ou a avaliação inteira (também com Esc).
 */
export default function AvaliacaoAoVivo({ avaliacao, participantes, jurados, numero, aoMudar, aoAcabar }) {
  const roteiro = useMemo(() => roteiroDaAvaliacao(avaliacao), [avaliacao]);
  const porId = useMemo(() => new Map(participantes.map((p) => [p.id, p])), [participantes]);
  const juradoPor = useMemo(() => new Map(jurados.map((j) => [j.id, j])), [jurados]);
  const [indice, setIndice] = useState(0);
  const [fase, setFase] = useState("entrando"); // entrando → review (item a item) → nota → resultado
  const [item, setItem] = useState(0);
  const [emocao, setEmocao] = useState(emocaoInicial);
  const semMovimento = useRef(false);
  useEffect(() => { semMovimento.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches; }, []);

  const passo = roteiro[indice] || null;
  const review = passo?.review || [];
  const atual = fase === "review" ? review[item] : null;
  const competidor = passo ? porId.get(passo.id) : null;

  const proximo = useCallback(() => {
    if (indice + 1 >= roteiro.length) { aoAcabar(); return; }
    setIndice((i) => i + 1);
    setFase("entrando");
    setItem(0);
    setEmocao(emocaoInicial());
  }, [indice, roteiro.length, aoAcabar]);

  // a linha do tempo de cada competidor
  useEffect(() => {
    if (!passo) { aoAcabar(); return undefined; }
    let espera;
    if (fase === "entrando") espera = semMovimento.current ? TEMPO.entrandoSemMovimento : TEMPO.entrando;
    else if (fase === "review") espera = Math.max(TEMPO.itemMin, (atual?.fala.length || 0) * TEMPO.porLetra);
    else if (fase === "nota") espera = TEMPO.notaMin;
    else espera = TEMPO.resultado;
    const r = setTimeout(() => {
      if (fase === "entrando") {
        if (review.length) { setFase("review"); setItem(0); setEmocao((e) => reagirNaCena(e, { tipo: review[0].tipo })); }
        else { setFase("nota"); setEmocao((e) => reagirNaCena(e, { tipo: "nota", nota: passo.nota })); }
      } else if (fase === "review") {
        if (item + 1 < review.length) { setItem(item + 1); setEmocao((e) => reagirNaCena(e, { tipo: review[item + 1].tipo })); }
        else { setFase("nota"); setEmocao((e) => reagirNaCena(e, { tipo: "nota", nota: passo.nota })); }
      } else if (fase === "nota") {
        setFase("resultado");
        setEmocao((e) => reagirNaCena(e, { tipo: "resultado", resultado: passo.resultado, campeao: passo.campeao }));
      } else {
        proximo();
      }
    }, espera);
    return () => clearTimeout(r);
  }, [passo, fase, item, atual, review, proximo, aoAcabar]);

  // a cena no 3D: quem está no palco, qual jurado fala e os humores de todos
  const humorDoCompetidor = fase === "entrando" ? "aflito" : humorDaEmocao(emocao);
  const humoresDosJurados = useMemo(() => {
    const h = {};
    for (const j of jurados) h[`jurado:${j.id}`] = fase === "nota" ? "pensando" : "normal";
    if (atual) h[`jurado:${atual.jurado}`] = atual.tipo === "elogio" ? "feliz" : "bravo";
    if (fase === "resultado") for (const j of jurados) h[`jurado:${j.id}`] = passo?.resultado === "eliminado" ? "normal" : "feliz";
    return h;
  }, [jurados, atual, fase, passo]);
  useEffect(() => {
    if (!passo) return;
    aoMudar({ palco: { id: passo.id, juradoAtivo: atual?.jurado || null }, humores: { ...humoresDosJurados, [passo.id]: humorDoCompetidor } });
  }, [passo, atual, humoresDosJurados, humorDoCompetidor, aoMudar]);

  // Esc pula tudo
  useEffect(() => {
    const tecla = (e) => { if (e.key === "Escape") aoAcabar(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aoAcabar]);

  if (!passo) return null;
  const jurado = atual ? juradoPor.get(atual.jurado) : null;
  const resultado = passo.campeao ? { texto: "🏆 campeão do torneio", classe: "verde" } : RESULTADO[passo.resultado] || { texto: passo.resultado, classe: "tema" };

  return (
    <section className="bc-aovivo" aria-label={`Avaliação ao vivo da rodada ${numero}`}>
      <div className="bc-aovivo__topo">
        <span className="bc-aovivo__selo">● AO VIVO</span>
        <strong>Avaliação da rodada {numero}</strong>
        <span className="pf-estat__nota">{indice + 1} de {roteiro.length}</span>
        <div className="bc-aovivo__pular">
          {/* data-so-olhar: pular a cena vale também no modo espectador (é só assistir) */}
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" data-so-olhar onClick={proximo}>⏭ Pular esta cena</button>
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" data-so-olhar onClick={aoAcabar}>⏩ Pular tudo</button>
        </div>
      </div>

      <div className="bc-aovivo__corpo">
        <div className="bc-aovivo__competidor">
          <Neuro personagem={competidor?.skin} humor={humorDoCompetidor} tamanho={84} />
          <div>
            <strong>{competidor?.souEu ? "Você" : passo.nome}{passo.tipo === "npc" ? " 🤖" : ""}</strong>
            <p className="pf-estat__nota">{fase === "entrando" ? "a caminho da bancada…" : fase === "review" ? "ouvindo os jurados" : fase === "nota" ? "esperando a nota" : "o veredito"}</p>
          </div>
          <MedidorDeEmocao emocao={emocao} />
        </div>

        <div className="bc-aovivo__palco" aria-live="polite">
          {fase === "entrando" && <p className="bc-aovivo__anuncio">🎬 {competidor?.souEu ? "Você" : passo.nome}, à bancada, por favor.</p>}
          {fase === "review" && atual && (
            <div className={`bc-review bc-review--${atual.tipo}`} key={`${indice}:${item}`}>
              <div className="bc-review__jurado">
                <DesenhoDoJurado id={atual.jurado} humor={atual.tipo === "elogio" ? "feliz" : "bravo"} tamanho={64} />
                <div>
                  <strong>{jurado?.emoji} {jurado?.nome}</strong>
                  <span className={`pf-pilula pf-pilula--${atual.tipo === "elogio" ? "verde" : "alerta"}`}>{atual.tipo === "elogio" ? "✅ bem avaliado" : "❌ mal avaliado"} · linhas {atual.linhaInicio}–{atual.linhaFim}</span>
                </div>
              </div>
              <p className="bc-review__fala">“{atual.fala}”</p>
              <Codigo texto={atual.trecho} linguagem={avaliacao.participantes.find((a) => a.id === passo.id)?.linguagem || "javascript"} />
              <span className="pf-estat__nota">{item + 1} de {review.length} no code review</span>
            </div>
          )}
          {(fase === "nota" || fase === "resultado") && (
            <div className="bc-aovivo__nota">
              <span className="bc-aovivo__numero">{passo.nota}<small>/100</small></span>
              {fase === "resultado" && <span className={`pf-pilula pf-pilula--${resultado.classe}`}>{resultado.texto}</span>}
              {passo.fala && fase === "resultado" && <p className="bc-nota__fala">“{passo.fala}”</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
