"use client";

// "O que há de novo": um modal caprichado que aparece uma vez por edição, assim que a pessoa entra
// no Proof (pedido de 22/10/2026). A edição vista fica guardada neste navegador — em outro
// aparelho, ela aparece de novo uma vez, o que não faz mal. Enquanto ele está aberto, o aviso de
// vale espera (os dois juntos brigavam pela tela).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Neuro from "./Neuro.js";
import { urlDoMonstro } from "./reino/monstrosDePapel.js";

export const EDICAO_DAS_NOVIDADES = "2026-10-23-trilha-amarrada";
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
  { icone: "🔗", titulo: "A prática agora move a trilha", texto: "O assunto conclui com a teoria E o quiz dele (60% ou mais). Cada semana do plano termina num projeto — aprovado, a semana seguinte abre.", destaque: true },
  { icone: "🏆", titulo: "Projeto final, do tamanho do seu plano", texto: "O projeto do mês virou o projeto final da trilha: num plano de 5 dias é um projeto só, pequeno e completo; numa trilha longa, junta tudo. O que você já tinha concluído continua valendo." },
  { icone: "🪐", titulo: "Planetoides de verdade", texto: "As expedições da Nave agora são numa esfera: tropas, monstros e construções andam em volta do planeta, estilo Mario Galaxy." },
  { icone: "🌊", titulo: "Fundo do mar de verdade", texto: "Nada de nuvem embaixo d'água: areia até o horizonte, algas balançando, cardumes, raios de luz e bolhas subindo." },
  { icone: "🧪", titulo: "Reino de Teste", texto: "Um reino à parte, com tudo liberado e reinos-robô para atacar: teste tudo sem mexer no seu reino de verdade." },
  { icone: "⏰", titulo: "A Bolsa abre das 07h às 17h", texto: "O pregão negocia das 07:00 às 17:00 (horário de Brasília), e o preço anda de hora em hora nesse intervalo. Fora dele, dá para acompanhar as cotações, mas não comprar nem vender." },
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
          <div className="novidades__neuro"><Neuro humor="comemorando" tamanho={92} personagem="abacato" /></div>
          <span className="novidades__chao" />
        </div>
        <div className="novidades__corpo">
          <span className="novidades__selo">✨ Novidade no Proof</span>
          <h2 id="novidades-titulo" className="novidades__titulo">Trilha e prática juntas!</h2>
          <p className="novidades__sub">O quiz conclui o assunto, o projeto abre a semana seguinte e o projeto final fecha a trilha. E as expedições ganharam planetoides esféricos e um fundo do mar de verdade.</p>
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
