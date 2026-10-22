"use client";

// "O que há de novo": um modal caprichado que aparece uma vez por edição, assim que a pessoa entra
// no Proof (pedido de 22/10/2026). A edição vista fica guardada neste navegador — em outro
// aparelho, ela aparece de novo uma vez, o que não faz mal. Enquanto ele está aberto, o aviso de
// vale espera (os dois juntos brigavam pela tela).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Neuro from "./Neuro.js";
import { urlDoMonstro } from "./reino/monstrosDePapel.js";

export const EDICAO_DAS_NOVIDADES = "2026-10-22";
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

const NOVIDADES = [
  { icone: "🗺️", titulo: "Expedições contra monstros", texto: "Ataque vilas, florestas, bosques e acampamentos de monstros para saquear moedas — de graça, 3 vezes por dia. Cada lugar tem a sua dificuldade, a sua recompensa e o seu cenário.", destaque: true },
  { icone: "⚔️", titulo: "Guerra a cada 2 dias", texto: "Você invade o mesmo reino uma vez a cada 2 dias. Foi atacado? A revanche fica liberada na hora." },
  { icone: "💡", titulo: "Dicas da Lisa", texto: "Nos projetos da semana e do mês: um passo a passo para começar, sem entregar a resposta." },
  { icone: "▶️", titulo: "Rode o seu código", texto: "Todo exercício do dia ganhou o botão Rodar: veja o resultado antes de enviar." },
  { icone: "🧩", titulo: "Projetos em partes", texto: "Cada requisito vale pontos e você entrega aos poucos. Escolha a complexidade: desafiador vale 1,5×." },
  { icone: "⛺", titulo: "Acampamento das tropas", texto: "Suas tropas, desenhadas no papel como o Neuro, numa ilhota só delas ao lado do reino." },
];

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
        <div className="novidades__palco" aria-hidden="true">
          <span className="novidades__estrelas" />
          <img className="novidades__bicho novidades__bicho--cerbero" src={urlDoMonstro("cerbero")} alt="" />
          <img className="novidades__bicho novidades__bicho--goblin" src={urlDoMonstro("goblin")} alt="" />
          <img className="novidades__bicho novidades__bicho--cogumelo" src={urlDoMonstro("cogumelo")} alt="" />
          <img className="novidades__bicho novidades__bicho--morcego" src={urlDoMonstro("morcego")} alt="" />
          <div className="novidades__neuro"><Neuro humor="comemorando" tamanho={92} /></div>
          <span className="novidades__chao" />
        </div>
        <div className="novidades__corpo">
          <span className="novidades__selo">✨ Novidade no Proof</span>
          <h2 id="novidades-titulo" className="novidades__titulo">Chegaram as Expedições!</h2>
          <p className="novidades__sub">Monstros para enfrentar, saque para levar — e um monte de coisa nova para estudar melhor.</p>
          <ul className="novidades__lista">
            {NOVIDADES.map((n) => (
              <li key={n.titulo} className={n.destaque ? "novidades__item novidades__item--destaque" : "novidades__item"}>
                <span className="novidades__icone" aria-hidden="true">{n.icone}</span>
                <span><strong>{n.titulo}</strong><span>{n.texto}</span></span>
              </li>
            ))}
          </ul>
          <div className="novidades__acoes">
            <Link ref={principal} href="/reino#expedicoes" className="pf-botao novidades__principal" onClick={fechar}>⚔️ Partir para as Expedições</Link>
            <button type="button" className="pf-botao pf-botao--sec" onClick={fechar}>Depois eu vejo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
