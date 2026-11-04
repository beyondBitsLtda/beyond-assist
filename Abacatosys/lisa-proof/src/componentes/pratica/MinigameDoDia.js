"use client";

// O MINIGAME DO DIA na Prática (03/11/2026: "a arena lúdica não deveria ser um modo à parte, e sim minigames dos
// exercícios diários, igual o quiz"). Um bloco a mais na prática de todo dia: a primeira fase vencida no dia vale
// pontos (contam para a meta e a ofensiva, como o quiz) e cada fase nova ainda rende moedas para o reino. Os três
// jogos — a Masmorra da Depuração, o Mascote Programável e os Quebra-cabeças de Parsons — abrem aqui mesmo.
// O conteúdo e as regras moram em src/dominio/arena.js; o servidor confere em src/lib/arena.js.

import { useCallback, useEffect, useState } from "react";
import { obter, criar } from "@/lib/api.js";
import { useAviso } from "@/componentes/Pecas.js";
import { comemorar } from "@/componentes/Neuro.js";
import Masmorra from "@/componentes/arena/Masmorra.js";
import Mascote from "@/componentes/arena/Mascote.js";
import Parsons from "@/componentes/arena/Parsons.js";

export default function MinigameDoDia() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(false);
  const [jogo, setJogo] = useState(null);
  const [Aviso, avisar] = useAviso();

  const carregar = useCallback(() => obter("/api/arena").then((d) => {
    setDados(d);
    setJogo((atual) => atual || d.doDia);
  }).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);
  // quem chega por /pratica#minigame (o endereço antigo da Arena) já encontra o bloco aberto
  useEffect(() => { if (window.location.hash === "#minigame") setAberto(true); }, []);

  const aoConferir = useCallback(async (corpo) => {
    try {
      const r = await criar("/api/arena", { acao: "conferir", ...corpo });
      if (r.ok) {
        if (r.pontosDoDia) comemorar(`🕹️ Minigame do dia: +${r.pontosDoDia} pts${r.recompensa ? ` e +🪙 ${r.recompensa}` : ""}`);
        await carregar();
      }
      return r;
    } catch (e) {
      avisar(`Não deu para conferir: ${e.message}`);
      return null;
    }
  }, [avisar, carregar]);

  const aoExplicar = useCallback(async (corpo) => {
    try {
      return await criar("/api/arena", { acao: "explicar", ...corpo });
    } catch (e) {
      avisar(`A Lisa não conseguiu explicar agora: ${e.message}`);
      return null;
    }
  }, [avisar]);

  const doDia = dados?.jogos.find((j) => j.id === dados.doDia);
  return (
    <section className="pf-secao mg-dia" id="minigame" aria-label="Minigame do dia">
      <button type="button" className={`pf-cartao pratica__bloco mg-dia__bloco${dados?.hoje.feito ? " pratica__bloco--feito" : ""}`} aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        <span className="pratica__icone" aria-hidden="true">🕹️</span>
        <span className="pratica__textos">
          <strong>Minigame do dia{doDia ? ` · ${doDia.emoji} ${doDia.nome}` : ""}</strong>
          <small>
            {!dados ? (erro || "Carregando…")
              : !dados.plano?.temProgramacao ? "Os minigames são de programação: eles entram quando o seu plano de estudo tiver uma trilha de programação"
              : dados.hoje.feito ? `Feito hoje ✅ +${dados.hoje.pontos} pts · dá para continuar jogando (cada fase nova rende moedas)`
              : `Vença uma fase hoje: +${dados.pontosDoDia} pts (e moedas para o reino em cada fase nova)`}
          </small>
        </span>
        <span className="pratica__acao">{aberto ? "Fechar" : dados?.hoje.feito ? "Jogar mais" : "Jogar"}</span>
      </button>
      {aberto && dados && !dados.plano?.temProgramacao && (
        <div className="mg-dia__corpo">
          <p className="pf-aviso">🕹️ Os minigames do dia (a masmorra, o mascote e os blocos) são de programação, e o seu plano de estudo não tem uma trilha de programação agora. A prática do dia, logo abaixo, já vem do seu plano; quando você montar uma trilha de programação, os minigames entram nela.</p>
        </div>
      )}
      {aberto && dados && dados.plano?.temProgramacao !== false && (
        <div className="mg-dia__corpo">
          <div className="agenda__modos ar-jogos" role="tablist" aria-label="Minigames">
            {dados.jogos.map((j) => (
              <button key={j.id} type="button" role="tab" aria-selected={jogo === j.id} className="agenda__modo" onClick={() => setJogo(j.id)}>
                {j.emoji} {j.nome}{j.id === dados.doDia ? " ⭐" : ""}{j.foraDoPlano ? " · em JavaScript" : ""} <span className="co-abas__n">{j.concluidas}/{j.fases}</span>
              </button>
            ))}
          </div>
          <p className="pf-estat__nota ar-jogo__descricao">
            {dados.jogos.find((j) => j.id === jogo)?.descricao} {jogo === dados.doDia ? "⭐ É o minigame em destaque hoje — mas qualquer um vale os pontos do dia." : ""}
            {jogo === "parsons" && dados.plano?.linguagens?.length ? ` Os blocos vêm na linguagem do seu plano de estudo (${dados.plano.linguagens.map((l) => l.nome).join(", ")}).` : ""}
            {dados.jogos.find((j) => j.id === jogo)?.foraDoPlano ? " Este jogo é em JavaScript, que não está no seu plano: fica como extra." : ""}
          </p>
          {jogo === "masmorra" && <Masmorra andares={dados.masmorra} aoConferir={aoConferir} aoExplicar={aoExplicar} />}
          {jogo === "mascote" && <Mascote niveis={dados.mascote} aoConferir={aoConferir} aoExplicar={aoExplicar} />}
          {jogo === "parsons" && <Parsons puzzles={dados.parsons} aoConferir={aoConferir} linguagens={dados.plano?.linguagens || []} />}
        </div>
      )}
      {Aviso}
    </section>
  );
}
