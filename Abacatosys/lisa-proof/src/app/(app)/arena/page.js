"use client";

import { useCallback, useEffect, useState } from "react";
import { obter, criar } from "@/lib/api.js";
import { useAviso } from "@/componentes/Pecas.js";
import Masmorra from "@/componentes/arena/Masmorra.js";
import Mascote from "@/componentes/arena/Mascote.js";
import Parsons from "@/componentes/arena/Parsons.js";

/**
 * A Arena Lúdica de Programação (03/11/2026, BEYOND-0023): três jogos para treinar programação brincando — a
 * Masmorra da Depuração, o Mascote Programável e os Quebra-cabeças de Parsons. Cada fase vencida dá moedas para
 * o reino, uma vez. As regras e o conteúdo moram em src/dominio/arena.js.
 */
export default function Arena() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [jogo, setJogo] = useState("masmorra");
  const [Aviso, avisar] = useAviso();

  const carregar = useCallback(() => obter("/api/arena").then(setDados).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);

  const aoConferir = useCallback(async (corpo) => {
    try {
      const r = await criar("/api/arena", { acao: "conferir", ...corpo });
      if (r.ok) await carregar();
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

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>🕹️ Arena Lúdica</h1>
          <p>Programação no modo jogo: conserte bugs para atravessar a masmorra, programe o mascote para comer tudo e monte algoritmos embaralhados. O terminal roda na hora; a Lisa explica os erros; cada fase vencida rende moedas para o reino.</p>
        </div>
      </div>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      {!dados && !erro && <p className="pf-estat__nota">Abrindo a arena…</p>}
      {dados && (
        <>
          <p className="pf-estat__nota">{dados.resumo.concluidas} de {dados.resumo.total} fases vencidas · 🪙 {dados.resumo.moedas} ganhas na Arena</p>
          <div className="agenda__modos ar-jogos" role="tablist" aria-label="Jogos da Arena">
            {dados.jogos.map((j) => (
              <button key={j.id} type="button" role="tab" aria-selected={jogo === j.id} className="agenda__modo" onClick={() => setJogo(j.id)}>
                {j.emoji} {j.nome} <span className="co-abas__n">{j.concluidas}/{j.fases}</span>
              </button>
            ))}
          </div>
          <p className="pf-estat__nota ar-jogo__descricao">{dados.jogos.find((j) => j.id === jogo)?.descricao} Cada fase nova vale 🪙 {dados.jogos.find((j) => j.id === jogo)?.recompensa}.</p>
          {jogo === "masmorra" && <Masmorra andares={dados.masmorra} aoConferir={aoConferir} aoExplicar={aoExplicar} />}
          {jogo === "mascote" && <Mascote niveis={dados.mascote} aoConferir={aoConferir} aoExplicar={aoExplicar} />}
          {jogo === "parsons" && <Parsons puzzles={dados.parsons} aoConferir={aoConferir} />}
        </>
      )}
      {Aviso}
    </>
  );
}
