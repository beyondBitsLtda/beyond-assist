"use client";

// "O que há de novo": um modal caprichado que aparece uma vez por edição, assim que a pessoa entra
// no Proof (pedido de 22/10/2026). A edição vista fica guardada neste navegador — em outro
// aparelho, ela aparece de novo uma vez, o que não faz mal. Enquanto ele está aberto, o aviso de
// vale espera (os dois juntos brigavam pela tela).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Neuro from "./Neuro.js";
import { urlDoMonstro } from "./reino/monstrosDePapel.js";

export const EDICAO_DAS_NOVIDADES = "2026-10-23-semana-do-curso";
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
  { icone: "📅", titulo: "O projeto semanal é o da semana do curso", texto: "A Semana 1 do projeto é a Semana 1 da sua trilha (a mesma do mapa e da agenda), sobre os assuntos dela. A semana seguinte só abre com o projeto aprovado.", destaque: true },
  { icone: "🎭", titulo: "5 personagens novos", texto: "Direto das expedições: Neuro Cogumelo, Mergulhador, Yeti, Magma e Alienígena. Estão no Reino, em Personagens." },
  { icone: "🃏", titulo: "Cartões do Reino arrumados", texto: "Personagens, garagem, expedições e construções com tamanhos iguais por linha e os botões sempre no pé do cartão, no computador e no celular." },
  { icone: "🔗", titulo: "A prática move a trilha", texto: "O assunto conclui com a teoria E o quiz dele (60% ou mais), e a trilha termina num projeto final do tamanho do seu plano." },
  { icone: "🪐", titulo: "Planetoides e fundo do mar de verdade", texto: "As expedições da Nave são numa esfera, estilo Mario Galaxy; as do Submarino, no fundo do mar, com cardumes e bolhas." },
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
          <img className="novidades__bicho novidades__bicho--cerbero" src={urlDoMonstro("kraken")} alt="" />
          <img className="novidades__bicho novidades__bicho--goblin" src={urlDoMonstro("zorg")} alt="" />
          <img className="novidades__bicho novidades__bicho--cogumelo" src={urlDoMonstro("diabrete")} alt="" />
          <img className="novidades__bicho novidades__bicho--morcego" src={urlDoMonstro("disco")} alt="" />
          <div className="novidades__neuro"><Neuro humor="comemorando" tamanho={92} personagem="alienigena" /></div>
          <span className="novidades__chao" />
        </div>
        <div className="novidades__corpo">
          <span className="novidades__selo">✨ Novidade no Proof</span>
          <h2 id="novidades-titulo" className="novidades__titulo">A semana do curso manda!</h2>
          <p className="novidades__sub">O projeto semanal agora é o da semana da sua trilha, e a semana só anda com ele aprovado. E o Reino ganhou 5 personagens das expedições e cartões arrumados.</p>
          <ul className="novidades__lista">
            {NOVIDADES.map((n) => (
              <li key={n.titulo} className={n.destaque ? "novidades__item novidades__item--destaque" : "novidades__item"}>
                <span className="novidades__icone" aria-hidden="true">{n.icone}</span>
                <span><strong>{n.titulo}</strong><span>{n.texto}</span></span>
              </li>
            ))}
          </ul>
          <div className="novidades__acoes">
            <Link ref={principal} href="/trilhas" className="pf-botao novidades__principal" onClick={fechar}>🗺️ Ver as minhas trilhas</Link>
            <button type="button" className="pf-botao pf-botao--sec" onClick={fechar}>Depois eu vejo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
