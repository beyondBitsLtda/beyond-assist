"use client";

import { useEffect, useState } from "react";
import Neuro from "@/componentes/Neuro.js";

/** O humor do Neuro pela situação do competidor (também no 3D: src/componentes/bootcamp/Escritorio3D.js). */
export function humorDoCompetidor(p, campeaoId) {
  if (p.id === campeaoId) return "comemorando";
  if (p.eliminado) return "triste";
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
};

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
