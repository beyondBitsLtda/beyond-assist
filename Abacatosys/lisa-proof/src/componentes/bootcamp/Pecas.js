"use client";

import { useEffect, useState } from "react";
import Neuro from "@/componentes/Neuro.js";
import { EMOCOES, ORDEM_DAS_EMOCOES, emocaoDominante, humorDoResultado } from "@/dominio/bootcamp.js";

/**
 * O medidor de emoção da avaliação ao vivo: as quatro emoções (aflição, felicidade, raiva e tristeza) de 0 a 100,
 * com a que manda agora em destaque.
 */
export function MedidorDeEmocao({ emocao }) {
  const dominante = emocaoDominante(emocao);
  return (
    <div className="bc-medidor" aria-label={`Emoção agora: ${EMOCOES[dominante].nome}`}>
      <span className="bc-medidor__agora">{EMOCOES[dominante].emoji} {EMOCOES[dominante].nome}</span>
      {ORDEM_DAS_EMOCOES.map((k) => (
        <div key={k} className={`bc-medidor__linha bc-medidor__linha--${k}${k === dominante ? " bc-medidor__linha--dominante" : ""}`}>
          <span className="bc-medidor__rotulo" aria-hidden="true">{EMOCOES[k].emoji}</span>
          <span className="bc-medidor__barra" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={emocao[k]} aria-label={EMOCOES[k].nome}>
            <span style={{ width: `${emocao[k]}%` }} />
          </span>
          <span className="bc-medidor__valor">{emocao[k]}</span>
        </div>
      ))}
    </div>
  );
}

/** O humor do Neuro pela situação do competidor (também no 3D: src/componentes/bootcamp/Escritorio3D.js). */
export function humorDoCompetidor(p, campeaoId) {
  if (p.id === campeaoId) return "comemorando";
  if (p.eliminado) return "triste";
  // a prova já avaliada: a cara é a da nota e do resultado (nota baixa não volta sorrindo para a baia)
  if (p.etapa === "fim" && p.nota !== null && p.nota !== undefined) return humorDoResultado({ nota: p.nota, resultado: p.resultado });
  if (p.enviada) return "feliz";
  if (p.etapa === "codigo" || p.etapa === "analise" || p.etapa === "testes") return "pensando";
  return "normal";
}

export const ROTULO_DA_ETAPA = {
  leitura: "lendo o enunciado", analise: "analisando e planejando", ambiente: "configurando o ambiente", codigo: "codando",
  testes: "testes passando", revisao: "enviou aos jurados", fim: "avaliado",
};

export const RESULTADO = {
  avancou: { texto: "avançou", classe: "verde" },
  folga: { texto: "folga: passou direto", classe: "verde" },
  pontuou: { texto: "pontuou", classe: "verde" },
  eliminado: { texto: "eliminado", classe: "alerta" },
  // a temporada
  salvo: { texto: "🛡️ salvo da eliminação", classe: "verde" },
  ameacado: { texto: "🔥 vai para a prova de eliminação", classe: "atencao" },
  sobreviveu: { texto: "segue na disputa", classe: "verde" },
  campeao: { texto: "🏆 campeão do Bootcamp", classe: "verde" },
  vice: { texto: "🥈 vice-campeão", classe: "tema" },
};

/** As insígnias de um competidor, em fila (emoji com o nome no título). */
export function Insignias({ lista = [], catalogo = {}, max = 8 }) {
  if (!lista?.length) return null;
  return (
    <span className="bc-insignias" aria-label={`${lista.length} insígnia(s)`}>
      {lista.slice(0, max).map((i, k) => (
        <span key={k} className="bc-insignia" title={`${catalogo[i.tipo]?.nome || i.tipo} · prova ${i.numero}`}>{catalogo[i.tipo]?.emoji || "🎖️"}</span>
      ))}
      {lista.length > max && <span className="bc-insignia">+{lista.length - max}</span>}
    </span>
  );
}

/** Os status (1 a 10) e as especialidades de um personagem da CPU. */
export function StatusDoNpc({ status, especialidades = [], catalogo = {}, rotulos = {} }) {
  if (!status) return null;
  return (
    <div className="bc-status">
      {Object.entries(rotulos).map(([k, nome]) => (
        <div key={k} className="bc-status__linha">
          <span>{nome}</span>
          <span className="bc-status__barra" role="meter" aria-valuemin={1} aria-valuemax={10} aria-valuenow={status[k] ?? 0} aria-label={nome}>
            <span style={{ width: `${(status[k] ?? 0) * 10}%` }} />
          </span>
          <strong>{status[k] ?? 0}</strong>
        </div>
      ))}
      {especialidades.length > 0 && (
        <div className="bc-status__especialidades">
          {especialidades.map((e) => <span key={e} className="pf-pilula">{catalogo[e]?.emoji} {catalogo[e]?.nome || e}</span>)}
        </div>
      )}
    </div>
  );
}

/** O boneco do competidor (o Neuro com a skin dele). */
export function Avatar({ p, campeaoId = null, tamanho = 56 }) {
  return (
    <span className={`bc-avatar${p.eliminado ? " bc-avatar--fora" : ""}`} aria-hidden="true">
      <Neuro personagem={p.skin} humor={humorDoCompetidor(p, campeaoId)} tamanho={tamanho} />
    </span>
  );
}

/**
 * O "Fluxo de Desenvolvimento do Exercício": as etapas em linha, com a decisão "Passou nos testes?" entre os
 * testes e a revisão. A etapa atual fica acesa; as anteriores, marcadas.
 */
export function FluxoDoExercicio({ fluxo, etapa, passou, testou }) {
  const atual = fluxo.findIndex((e) => e.id === etapa);
  return (
    <ol className="bc-fluxo" aria-label="Fluxo de desenvolvimento do exercício">
      {fluxo.map((e, i) => {
        const estado = i < atual ? "feita" : i === atual ? "agora" : "depois";
        return [
          e.id === "revisao" && (
            <li key="decisao" className={`bc-fluxo__decisao${testou ? (passou ? " bc-fluxo__decisao--sim" : " bc-fluxo__decisao--nao") : ""}`}>
              <span className="bc-fluxo__losango" aria-hidden="true">?</span>
              <span>Passou nos testes?{testou ? (passou ? " Sim" : " Não → correção") : ""}</span>
            </li>
          ),
          <li key={e.id} className={`bc-fluxo__etapa bc-fluxo__etapa--${estado}`} aria-current={estado === "agora" ? "step" : undefined} title={e.titulo}>
            <span className="bc-fluxo__marca" aria-hidden="true">{estado === "feita" ? "✓" : i + 1}</span>
            <span className="bc-fluxo__nome">{e.curto}</span>
          </li>,
        ];
      })}
    </ol>
  );
}

/** Quanto falta para o prazo (ou "sem limite de tempo"). */
export function Cronometro({ prazo }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!prazo) return undefined;
    const r = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(r);
  }, [prazo]);
  if (!prazo) return <span className="pf-pilula">⏳ sem limite de tempo</span>;
  const resta = Math.max(0, new Date(prazo).getTime() - agora);
  const m = Math.floor(resta / 60_000), s = Math.floor((resta % 60_000) / 1000);
  return (
    <span className={`pf-pilula${resta < 5 * 60_000 ? " pf-pilula--alerta" : ""}`} role="timer" aria-live="off">
      ⏱️ {resta ? `${m}:${String(s).padStart(2, "0")}` : "tempo esgotado"}
    </span>
  );
}

/** O resultado dos testes: os visíveis com a entrada, a saída esperada e a obtida; os ocultos só ✓/✗. */
export function ResultadoDosTestes({ testes, resumo }) {
  if (!testes?.length) return null;
  return (
    <div className="bc-testes">
      <div className={`bc-testes__resumo${resumo.passou ? " bc-testes__resumo--ok" : ""}`}>
        {resumo.passou ? "✅" : "❌"} Passou em {resumo.passados} de {resumo.total} testes
      </div>
      <ul className="bc-testes__lista">
        {testes.map((t) => (
          <li key={t.n} className={`bc-teste${t.ok ? " bc-teste--ok" : " bc-teste--falhou"}`}>
            <div className="bc-teste__topo">
              <strong>{t.ok ? "✓" : "✗"} Teste {t.n}</strong>
              {t.oculto && <span className="pf-pilula">oculto</span>}
            </div>
            {!t.oculto && (
              <div className="bc-teste__corpo">
                <div><span className="pf-campo__rotulo">Entrada</span><pre>{t.entrada || "(vazia)"}</pre></div>
                <div><span className="pf-campo__rotulo">Esperado</span><pre>{t.esperada}</pre></div>
                <div><span className="pf-campo__rotulo">Seu programa</span><pre>{t.obtida || "(nada)"}</pre></div>
              </div>
            )}
            {!t.oculto && t.erro && <pre className="bc-teste__erro">{t.erro}</pre>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** As baias sem 3D (sem WebGL ou ainda carregando): uma grade de cartões, na ordem das baias. */
export function BaiasPlanas({ participantes, campeaoId, aoEscolher }) {
  const lista = [...participantes].sort((a, b) => a.baia - b.baia);
  return (
    <div className="bc-baias" role="list">
      {lista.map((p) => (
        <button key={p.id} type="button" role="listitem" className={`bc-baia${p.souEu ? " bc-baia--eu" : ""}${p.eliminado ? " bc-baia--fora" : ""}`} onClick={() => aoEscolher?.(p.id)}>
          <Avatar p={p} campeaoId={campeaoId} tamanho={52} />
          <span className="bc-baia__nome">{p.id === campeaoId ? "🏆 " : ""}{p.souEu ? "Você" : p.nome}{p.tipo === "npc" ? " 🤖" : ""}</span>
          <span className="bc-baia__etapa">{p.eliminado ? "eliminado" : p.etapa ? ROTULO_DA_ETAPA[p.etapa] : "aguardando"}{p.testes ? ` · ${p.testes.passados}/${p.testes.total}` : ""}</span>
        </button>
      ))}
    </div>
  );
}
