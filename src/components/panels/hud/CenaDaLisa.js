"use client";

// A cena do Assistente (01/11/2026): "eu queria que, quando a IA for escrever a resposta, ao invés de
// escrever na tela como está, ela escrevesse numa janela flutuante, e nessa hora hologramas como os
// da imagem surgissem. Quero um zoom mais próximo da Lisa também e um efeito de profundidade quando
// surgirem essas janelas e elementos na tela."
//
// Camadas numa perspectiva 3D: os hologramas (HologramasDaLisa.js), a Lisa (o visual, com o anel e
// os cantos que andam com ela) e a janela da resposta (JanelaDaResposta.js). Quando a resposta aparece
// (`ativa`), a Lisa recua um pouco (sem sair do centro — "não gostei que a Lisa não ficou
// centralizada"), a janela vem do fundo para a frente e os hologramas surgem em profundidades
// diferentes; o mundo inteiro inclina de leve com o
// mouse (paralaxe). O nível da voz e o estado entram como variáveis de CSS a cada quadro (--nivel,
// data-estado), sem renderizar o React de novo: as barras e os anéis reagem à fala. Com "reduzir
// movimento", sem paralaxe (os giros e o surgir saem no CSS).

import { useEffect, useRef } from "react";
import HologramasDaLisa, { AnelDaLisa, CantosDaLisa } from "./HologramasDaLisa.js";

export default function CenaDaLisa({ ativa = false, obterSinal, dados = {}, janela = null, children }) {
  const cena = useRef(null);
  const sinalRef = useRef(obterSinal);
  sinalRef.current = obterSinal;

  useEffect(() => {
    const el = cena.current;
    if (!el) return undefined;
    const reduzido = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    const alvo = { x: 0, y: 0 };
    const agora = { x: 0, y: 0 };
    let nivel = 0.1;
    let estadoAntes = "";
    let quadro;
    const aoMover = (e) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      alvo.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      alvo.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    };
    const passo = (ms) => {
      if (!reduzido) {
        agora.x += (alvo.x - agora.x) * 0.05;
        agora.y += (alvo.y - agora.y) * 0.05;
        el.style.setProperty("--px", agora.x.toFixed(3));
        el.style.setProperty("--py", agora.y.toFixed(3));
      }
      let s = null;
      try { s = sinalRef.current?.(); } catch { /* o sinal nunca derruba a cena */ }
      const estado = s?.estado || "pronta";
      // sem volume medido, falando "respira" num ritmo de fala; parada, quase nada
      const t = ms / 1000;
      const meta = typeof s?.nivel === "number" ? Math.max(0, Math.min(1, s.nivel))
        : estado === "falando" ? 0.35 + 0.3 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 2.1))
        : estado === "pensando" ? 0.2 + 0.1 * Math.sin(t * 3) : 0.06;
      nivel += (meta - nivel) * 0.25;
      el.style.setProperty("--nivel", nivel.toFixed(3));
      if (estado !== estadoAntes) { el.dataset.estado = estado; estadoAntes = estado; }
      quadro = requestAnimationFrame(passo);
    };
    window.addEventListener("pointermove", aoMover, { passive: true });
    quadro = requestAnimationFrame(passo);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("pointermove", aoMover);
    };
  }, []);

  return (
    <div ref={cena} className={`bb-cena${ativa ? " bb-cena--hud" : ""}`}>
      <div className="bb-cena-mundo">
        <HologramasDaLisa dados={dados} />
        <div className="bb-cena-lisa">
          <AnelDaLisa />
          {children}
          <CantosDaLisa />
        </div>
        {janela}
      </div>
    </div>
  );
}
