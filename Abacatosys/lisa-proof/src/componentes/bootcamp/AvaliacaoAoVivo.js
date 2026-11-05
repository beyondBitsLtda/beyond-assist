"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Neuro from "@/componentes/Neuro.js";
import Codigo from "@/componentes/codigo/Codigo.js";
import DesenhoDoJurado, { DesenhoDaApresentadora } from "./Jurados.js";
import { MedidorDeEmocao, RESULTADO, Insignias } from "./Pecas.js";
import { roteiroDaAvaliacao, emocaoInicial, reagirNaCena, humorDaEmocao, humorDoResultado } from "@/dominio/bootcamp.js";

// quanto dura cada parte da cena (ms); com "reduzir movimento", as caminhadas são curtas (o avatar vai direto)
const TEMPO = {
  entrando: 3200, andandoSemMovimento: 700, notaMin: 2600, resultado: 2800, porLetra: 55, itemMin: 3800,
  saindo: 3400, falaMin: 3200, indoEmbora: 2000, fichaMax: 16000,
};

/**
 * A avaliação ao vivo do Modo Bootcamp (04/11/2026): um competidor por vez — do melhor prato ao pior — vai até a
 * bancada; os jurados fazem o code review ao vivo (o trecho bem ou mal avaliado e a fala de cada um), a nota sai e
 * o resultado fecha a cena (com a insígnia de quem venceu a prova). O avatar reage (aflição, felicidade, raiva,
 * tristeza) e o medidor mostra a emoção.
 *
 * O humano eliminado ganha a despedida: deixa a bancada e vai até a porta de saída, onde a apresentadora faz a
 * entrevista (pergunta dela, resposta dele); depois sai pela porta e a cena corta para a ficha dele — as notas de
 * cada jurado, os testes, os pontos, as insígnias e os pontos fortes e fracos.
 *
 * `aoMudar({ palco, humores })` leva a cena ao escritório 3D; `aoAcabar()` fecha. Dá para pular a cena de um
 * competidor ou a avaliação inteira (também com Esc).
 */
export default function AvaliacaoAoVivo({ avaliacao, participantes, jurados, apresentadora, insignias = {}, numero, aoMudar, aoAcabar, aoRevelar }) {
  const roteiro = useMemo(() => roteiroDaAvaliacao(avaliacao), [avaliacao]);
  const porId = useMemo(() => new Map(participantes.map((p) => [p.id, p])), [participantes]);
  const juradoPor = useMemo(() => new Map(jurados.map((j) => [j.id, j])), [jurados]);
  const [indice, setIndice] = useState(0);
  // entrando → review (item a item) → nota → resultado → [despedida: saindo → entrevista → indoEmbora → ficha]
  const [fase, setFase] = useState("entrando");
  const [item, setItem] = useState(0);
  const [emocao, setEmocao] = useState(emocaoInicial);
  const semMovimento = useRef(false);
  useEffect(() => { semMovimento.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches; }, []);

  const passo = roteiro[indice] || null;
  const review = passo?.review || [];
  const entrevista = passo?.despedida || [];
  const atual = fase === "review" ? review[item] : null;
  // na entrevista, cada pergunta tem dois tempos: a apresentadora pergunta (par) e o competidor responde (ímpar)
  const pergunta = fase === "entrevista" ? entrevista[Math.floor(item / 2)] : null;
  const quemFala = fase === "entrevista" ? (item % 2 === 0 ? "apresentadora" : "competidor") : null;
  const competidor = passo ? porId.get(passo.id) : null;
  const equipe = (avaliacao.equipes || []).find((e) => e.membros.includes(passo?.id)) || null;

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
    const andando = (ms) => (semMovimento.current ? TEMPO.andandoSemMovimento : ms);
    let espera;
    if (fase === "entrando") espera = andando(TEMPO.entrando);
    else if (fase === "review") espera = Math.max(TEMPO.itemMin, (atual?.fala.length || 0) * TEMPO.porLetra);
    else if (fase === "nota") espera = TEMPO.notaMin;
    else if (fase === "resultado") espera = TEMPO.resultado;
    else if (fase === "saindo") espera = andando(TEMPO.saindo);
    else if (fase === "entrevista") espera = Math.max(TEMPO.falaMin, ((quemFala === "apresentadora" ? pergunta?.pergunta : pergunta?.resposta) || "").length * TEMPO.porLetra);
    else if (fase === "indoEmbora") espera = andando(TEMPO.indoEmbora);
    else espera = TEMPO.fichaMax; // a ficha espera o "Continuar" (ou segue sozinha depois de um tempo)
    const r = setTimeout(() => {
      if (fase === "entrando") {
        if (review.length) { setFase("review"); setItem(0); setEmocao((e) => reagirNaCena(e, { tipo: review[0].tipo })); }
        else { setFase("nota"); setEmocao((e) => reagirNaCena(e, { tipo: "nota", nota: passo.nota })); }
      } else if (fase === "review") {
        if (item + 1 < review.length) { setItem(item + 1); setEmocao((e) => reagirNaCena(e, { tipo: review[item + 1].tipo })); }
        else { setFase("nota"); setEmocao((e) => reagirNaCena(e, { tipo: "nota", nota: passo.nota })); }
      } else if (fase === "nota") {
        setFase("resultado");
        setEmocao((e) => reagirNaCena(e, { tipo: "resultado", resultado: passo.resultado, campeao: passo.campeao, nota: passo.nota }));
      } else if (fase === "resultado") {
        if (passo.despedir && entrevista.length) { setFase("saindo"); setItem(0); } else proximo();
      } else if (fase === "saindo") {
        setFase("entrevista");
        setItem(0);
      } else if (fase === "entrevista") {
        if (item + 1 < entrevista.length * 2) setItem(item + 1);
        else setFase("indoEmbora");
      } else if (fase === "indoEmbora") {
        setFase("ficha");
      } else {
        proximo();
      }
    }, espera);
    return () => clearTimeout(r);
  }, [passo, fase, item, atual, review, entrevista, pergunta, quemFala, proximo, aoAcabar]);

  // a cena no 3D: quem está no palco, onde (bancada, porta, fora), quem fala e os humores de todos
  const humorDoCompetidor = fase === "entrando" ? "aflito" : humorDaEmocao(emocao);
  const humores = useMemo(() => {
    const h = {};
    for (const j of jurados) h[`jurado:${j.id}`] = fase === "nota" ? "pensando" : "normal";
    if (atual) h[`jurado:${atual.jurado}`] = atual.tipo === "elogio" ? "feliz" : "bravo";
    if (fase === "resultado") for (const j of jurados) h[`jurado:${j.id}`] = passo?.resultado === "eliminado" || passo?.resultado === "ameacado" ? "normal" : "feliz";
    h.apresentadora = fase === "entrevista" ? (quemFala === "apresentadora" ? "pensando" : "triste") : fase === "indoEmbora" ? "feliz" : "normal";
    // quem já passou pela bancada fica com a cara da nota dele; quem ainda espera, aflito
    roteiro.forEach((p, i) => { if (i < indice) h[p.id] = humorDoResultado(p); else if (i > indice) h[p.id] = "aflito"; });
    return h;
  }, [jurados, atual, fase, passo, quemFala, roteiro, indice]);

  // o que a tela pode mostrar: a nota (os pontos, a insígnia, quem saiu) de quem já passou pela bancada
  useEffect(() => {
    if (!aoRevelar) return;
    const revelado = ["nota", "resultado", "saindo", "entrevista", "indoEmbora", "ficha"].includes(fase);
    aoRevelar(new Set([...roteiro.slice(0, indice).map((p) => p.id), ...(revelado && passo ? [passo.id] : [])]));
  }, [aoRevelar, roteiro, indice, fase, passo]);
  const local = ["saindo", "entrevista"].includes(fase) ? "saida" : ["indoEmbora", "ficha"].includes(fase) ? "fora" : "bancada";
  useEffect(() => {
    if (!passo) return;
    aoMudar({
      palco: { id: passo.id, juradoAtivo: atual?.jurado || null, local, falando: quemFala },
      humores: { ...humores, [passo.id]: humorDoCompetidor },
    });
  }, [passo, atual, local, quemFala, humores, humorDoCompetidor, aoMudar]);

  // Esc pula tudo
  useEffect(() => {
    const tecla = (e) => { if (e.key === "Escape") aoAcabar(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aoAcabar]);

  if (!passo) return null;
  const jurado = atual ? juradoPor.get(atual.jurado) : null;
  const resultado = passo.campeao ? RESULTADO.campeao : RESULTADO[passo.resultado] || { texto: passo.resultado, classe: "tema" };
  const nome = competidor?.souEu ? "Você" : passo.nome;

  return (
    <section className="bc-aovivo" aria-label={`Avaliação ao vivo da rodada ${numero}`}>
      <div className="bc-aovivo__topo">
        <span className="bc-aovivo__selo">● AO VIVO</span>
        <strong>{fase === "ficha" ? "Ficha de despedida" : ["saindo", "entrevista", "indoEmbora"].includes(fase) ? "A despedida" : `Avaliação da rodada ${numero}`}</strong>
        <span className="pf-estat__nota">{indice + 1} de {roteiro.length}</span>
        <div className="bc-aovivo__pular">
          {/* data-so-olhar: pular a cena vale também no modo espectador (é só assistir) */}
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" data-so-olhar onClick={proximo}>⏭ Pular esta cena</button>
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" data-so-olhar onClick={aoAcabar}>⏩ Pular tudo</button>
        </div>
      </div>

      {fase === "ficha" ? (
        <FichaDeDespedida passo={passo} competidor={competidor} jurados={jurados} insignias={insignias} aoContinuar={proximo} />
      ) : (
        <div className="bc-aovivo__corpo">
          <div className="bc-aovivo__competidor">
            <Neuro personagem={competidor?.skin} humor={humorDoCompetidor} tamanho={84} />
            <div>
              <strong>{nome}{passo.tipo === "npc" ? " 🤖" : ""}</strong>
              {equipe && <span className={`pf-pilula bc-time bc-time--${equipe.id}`}>{equipe.emoji} {equipe.nome}</span>}
              <p className="pf-estat__nota">
                {{ entrando: "a caminho da bancada…", review: "ouvindo os jurados", nota: "esperando a nota", resultado: "o veredito", saindo: "deixando o escritório…", entrevista: "a entrevista de despedida", indoEmbora: "saindo pela porta…" }[fase]}
              </p>
            </div>
            <MedidorDeEmocao emocao={emocao} />
          </div>

          <div className="bc-aovivo__palco" aria-live="polite">
            {fase === "entrando" && <p className="bc-aovivo__anuncio">🎬 {nome}, à bancada, por favor.</p>}
            {fase === "review" && atual && (
              <div className={`bc-review bc-review--${atual.tipo}`} key={`${indice}:${item}`}>
                <div className="bc-review__jurado">
                  <DesenhoDoJurado id={atual.jurado} humor={atual.tipo === "elogio" ? "feliz" : "bravo"} tamanho={64} />
                  <div>
                    <strong>{jurado?.emoji} {jurado?.nome}</strong>
                    <span className={`pf-pilula pf-pilula--${atual.tipo === "elogio" ? "verde" : "alerta"}`}>{atual.trecho ? `${atual.tipo === "elogio" ? "✅ bem avaliado" : "❌ mal avaliado"} · linhas ${atual.linhaInicio}–${atual.linhaFim}` : atual.rotulo || "❌ entrega vazia"}</span>
                  </div>
                </div>
                <p className="bc-review__fala">“{atual.fala}”</p>
                {atual.trecho && <Codigo texto={atual.trecho} linguagem={avaliacao.participantes.find((a) => a.id === passo.id)?.linguagem || "javascript"} />}
                <span className="pf-estat__nota">{item + 1} de {review.length} no code review</span>
              </div>
            )}
            {(fase === "nota" || fase === "resultado") && (
              <div className="bc-aovivo__nota">
                <span className="bc-aovivo__numero">{passo.nota}<small>/100</small></span>
                {fase === "resultado" && <span className={`pf-pilula pf-pilula--${resultado.classe}`}>{resultado.texto}</span>}
                {fase === "resultado" && passo.insignia && (
                  <span className="bc-aovivo__insignia">{insignias[passo.insignia]?.emoji || "🎖️"} ganhou a insígnia <strong>{insignias[passo.insignia]?.nome || passo.insignia}</strong></span>
                )}
                {fase === "resultado" && passo.moedas > 0 && <span className="bc-aovivo__moedas">🪙 +{passo.moedas} moedas no reino</span>}
                {passo.fala && fase === "resultado" && <p className="bc-nota__fala">“{passo.fala}”</p>}
              </div>
            )}
            {fase === "saindo" && <p className="bc-aovivo__anuncio">🚪 {nome} deixa a bancada… {apresentadora?.nome || "A apresentadora"} espera na porta de saída.</p>}
            {fase === "entrevista" && pergunta && (
              <div className="bc-entrevista" key={`${indice}:${item}`}>
                <div className={`bc-entrevista__fala${quemFala === "apresentadora" ? " bc-entrevista__fala--agora" : ""}`}>
                  <DesenhoDaApresentadora humor={quemFala === "apresentadora" ? "pensando" : "triste"} tamanho={60} />
                  <div><strong>🎤 {apresentadora?.nome || "Clara Compila"}</strong><p>“{pergunta.pergunta}”</p></div>
                </div>
                {quemFala === "competidor" && (
                  <div className="bc-entrevista__fala bc-entrevista__fala--agora bc-entrevista__fala--resposta">
                    <Neuro personagem={competidor?.skin} humor={humorDoCompetidor} tamanho={60} />
                    <div><strong>{nome}</strong><p>“{pergunta.resposta}”</p></div>
                  </div>
                )}
                <span className="pf-estat__nota">pergunta {Math.floor(item / 2) + 1} de {entrevista.length}</span>
              </div>
            )}
            {fase === "indoEmbora" && <p className="bc-aovivo__anuncio">👋 {nome} sai pela porta. Até a próxima temporada!</p>}
          </div>
        </div>
      )}
    </section>
  );
}

/** A ficha de quem saiu: a nota, as notas de cada jurado, os testes, os pontos, as insígnias e os pontos fortes e fracos. */
function FichaDeDespedida({ passo, competidor, jurados, insignias, aoContinuar }) {
  return (
    <div className="bc-ficha">
      <div className="bc-ficha__topo">
        <Neuro personagem={competidor?.skin} humor="triste" tamanho={96} />
        <div>
          <h3>{competidor?.souEu ? "Você" : passo.nome}</h3>
          <p className="pf-estat__nota">deixou o escritório nesta prova · {competidor?.pontos ?? 0} pontos no torneio</p>
          <Insignias lista={competidor?.insignias || []} catalogo={insignias} />
        </div>
        <span className="bc-aovivo__numero">{passo.nota}<small>/100</small></span>
      </div>
      <div className="bc-ficha__notas">
        {jurados.map((j) => (
          <div key={j.id} className="bc-ficha__nota">
            <span className="bc-nota__criterio">{j.emoji} {j.criterio}</span>
            <span className="bc-status__barra"><span style={{ width: `${(passo.notas?.[j.id] ?? 0) * 10}%` }} /></span>
            <strong>{passo.notas?.[j.id] ?? 0}</strong>
          </div>
        ))}
        <div className="bc-ficha__nota">
          <span className="bc-nota__criterio">🧪 Testes</span>
          <span className="bc-status__barra"><span style={{ width: `${passo.testes.total ? (passo.testes.passados / passo.testes.total) * 100 : 0}%` }} /></span>
          <strong>{passo.testes.passados}/{passo.testes.total}</strong>
        </div>
      </div>
      <div className="bc-ficha__pontos">
        <div>
          <h4>✅ Pontos fortes</h4>
          <ul>{(passo.pontosFortes.length ? passo.pontosFortes : ["Chegou até a bancada e encarou os jurados."]).map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
        <div>
          <h4>⚠️ Pontos fracos</h4>
          <ul>{(passo.pontosFracos.length ? passo.pontosFracos : ["Os jurados não deixaram anotações."]).map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      </div>
      <div className="bc-passo__acoes">
        <button type="button" className="pf-botao" data-so-olhar onClick={aoContinuar}>Continuar</button>
      </div>
    </div>
  );
}
