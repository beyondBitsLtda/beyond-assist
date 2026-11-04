"use client";

// "O que há de novo": um modal caprichado que aparece uma vez por edição, assim que a pessoa entra
// no Proof (pedido de 22/10/2026). A edição vista fica guardada neste navegador — em outro
// aparelho, ela aparece de novo uma vez, o que não faz mal. Enquanto ele está aberto, o aviso de
// vale espera (os dois juntos brigavam pela tela).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
// a 1.0 com o banner (03/11/2026), na versão grande e curta ("bem mais largo, menos texto, um texto só
// apresentando o sistema"): edição nova, para o anúncio aparecer de novo para todo mundo
export const EDICAO_DAS_NOVIDADES = "2026-11-03-versao-1-grande";
const CHAVE = "proof-novidades-vistas";

/** Ainda há novidade para mostrar neste navegador? (Sem armazenamento: não mostra.) */
export function novidadesPendentes() {
  try {
    return localStorage.getItem(CHAVE) !== EDICAO_DAS_NOVIDADES;
  } catch {
    return false;
  }
}

function marcarComoVistas() {
  try { localStorage.setItem(CHAVE, EDICAO_DAS_NOVIDADES); } catch { /* sem armazenamento: aparece de novo na próxima visita */ }
  window.dispatchEvent(new CustomEvent("proof-novidades-fechou"));
}

export default function Novidades() {
  const [aberto, setAberto] = useState(false);
  const principal = useRef(null);

  useEffect(() => {
    if (!novidadesPendentes()) return undefined;
    const t = setTimeout(() => setAberto(true), 500);
    return () => clearTimeout(t);
  }, []);

  const fechar = useCallback(() => {
    marcarComoVistas();
    setAberto(false);
  }, []);

  useEffect(() => {
    if (!aberto) return undefined;
    // foco no botão sem rolar: no celular, rolar até ele escondia o palco com os monstros
    const t = setTimeout(() => principal.current?.focus({ preventScroll: true }), 250);
    const tecla = (e) => { if (e.key === "Escape") fechar(); };
    document.addEventListener("keydown", tecla);
    return () => { clearTimeout(t); document.removeEventListener("keydown", tecla); };
  }, [aberto, fechar]);

  if (!aberto) return null;

  return (
    <div className="novidades" role="dialog" aria-modal="true" aria-labelledby="novidades-titulo"
      onClick={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="novidades__caixa">
        {/* o banner da 1.0 (03/11/2026): a versão menor no celular, a maior na tela larga */}
        <picture className="novidades__banner">
          <source media="(min-width: 700px)" srcSet="/novidades/lisa-proof-1-0.webp" />
          <img src="/novidades/lisa-proof-1-0-900.webp" width={1672} height={941} decoding="async"
            alt="Lisa Proof 1.0 — agora ainda mais completo para suas necessidades! A Lisa, de óculos e prancheta, apresenta a versão nova." />
        </picture>
        <div className="novidades__corpo novidades__corpo--curto">
          <div className="novidades__texto">
            <h2 id="novidades-titulo" className="novidades__titulo">Bem-vindo ao Lisa Proof 1.0</h2>
            <p className="novidades__sub">O seu lugar para estudar todo dia: a Lisa monta as trilhas, você pratica com quiz, exercícios e minigames, e cada ponto vira moeda para construir o seu reino — agora com visual novo e as ilhas para conquistar.</p>
          </div>
          <div className="novidades__acoes">
            <button ref={principal} type="button" className="pf-botao novidades__principal" onClick={fechar}>Vamos lá!</button>
            <Link href="/reino" className="pf-botao pf-botao--sec" onClick={fechar}>Ver o meu reino</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
