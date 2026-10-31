"use client";

// A tela de abertura (31/10/2026): na primeira vez que o Proof abre na sessão, o mascote se desenha,
// pisca, o nome aparece e a tela some — uns 2,5 s, ou na hora com um toque. Nas outras páginas da
// mesma sessão ela não volta: o script do <head> marca `data-abertura="vista"` antes de pintar, e o
// CSS esconde. Quem pede menos movimento vê o mascote parado por meio segundo.

import { useEffect, useState } from "react";
import { Mascote } from "./Mascote.js";

const CHAVE = "proof-abertura";
const DURACAO_MS = 2700;

export default function TelaDeAbertura() {
  const [fora, setFora] = useState(false);

  useEffect(() => {
    let vista = false;
    try {
      vista = Boolean(sessionStorage.getItem(CHAVE));
      sessionStorage.setItem(CHAVE, "1");
    } catch { /* sem armazenamento: mostra a cada carregamento, o que não faz mal */ }
    if (vista) { setFora(true); return undefined; }
    const pouco = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setFora(true), pouco ? 600 : DURACAO_MS);
    const tecla = (e) => { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") setFora(true); };
    window.addEventListener("keydown", tecla);
    return () => { clearTimeout(t); window.removeEventListener("keydown", tecla); };
  }, []);

  if (fora) return null;
  return (
    <div className="abertura" onClick={() => setFora(true)} aria-hidden="true">
      <div className="abertura__centro">
        <div className="abertura__selo">
          <Mascote tamanho={132} animado />
        </div>
        <p className="abertura__nome"><span>Lisa</span><b>_</b><span>Proof</span></p>
        <p className="abertura__lema">estudo diário, de qualquer tema</p>
      </div>
      <span className="abertura__barra" />
    </div>
  );
}
