"use client";

// "O que há de novo": um modal caprichado que aparece uma vez por edição, assim que a pessoa entra
// no Proof (pedido de 22/10/2026). A edição vista fica guardada neste navegador — em outro
// aparelho, ela aparece de novo uma vez, o que não faz mal. Enquanto ele está aberto, o aviso de
// vale espera (os dois juntos brigavam pela tela).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Neuro from "./Neuro.js";
import { urlDoFuncionario } from "./acervo/personagensDoAcervo.js";

export const EDICAO_DAS_NOVIDADES = "2026-10-31-avatar-lisa";
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
  { icone: "👓", titulo: "Avatar novo, de graça: a Lisa", texto: "O mascote do Proof virou personagem, liberado para todo mundo. Vista no Reino → Personagens: ele pisca, sorri, comemora e até dorme.", destaque: true },
  { icone: "🃏", titulo: "Cartões, torres de tema e revisão da turma", texto: "Cartões com repetição espaçada (Prática → Cartões), o Modo Domínio de qualquer tema e a revisão de um colega quando você discorda da Lisa." },
  { icone: "💬", titulo: "Conversa com a Lisa", texto: "Nos cursos de idiomas: uma cena do dia a dia na língua do curso. A Lisa faz um papel, corrige cada fala e avalia no fim." },
  { icone: "📈", titulo: "Passo a passo e gráficos", texto: "Na matemática: cada linha da resolução é conferida (o erro aparece onde nasceu) e há gráficos de arrastar pontos e retas. Na música, leitura na pauta, ritmo e afinação ao vivo." },
  { icone: "📓", titulo: "Diário, PDF e torre de um livro", texto: "O diário do dia (o que aprendeu e onde travou), entrega em PDF, a frase-senha nas gravações e a torre do Modo Domínio feita a partir de um livro da Biblioteca." },
];

const NA_ESQUERDA = ["celeste", "iris"];
const NA_DIREITA = ["tobias", "pipoca"];

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
          <div className="novidades__retratos">
            <span>{NA_ESQUERDA.map((id) => <img key={id} className="novidades__retrato novidades__retrato--solto" src={urlDoFuncionario(id)} alt="" />)}</span>
            <span>{NA_DIREITA.map((id) => <img key={id} className="novidades__retrato novidades__retrato--solto" src={urlDoFuncionario(id)} alt="" />)}</span>
          </div>
          <div className="novidades__neuro"><Neuro humor="comemorando" tamanho={92} /></div>
          <span className="novidades__chao" />
        </div>
        <div className="novidades__corpo">
          <span className="novidades__selo">✨ Novidade no Proof</span>
          <h2 id="novidades-titulo" className="novidades__titulo">Cursos de qualquer tema!</h2>
          <p className="novidades__sub">O Proof deixou de ser só de programação: cada curso tem o seu tipo, e o exercício do dia e os projetos mudam com ele. (E no Reino, agora dá para vender e comprar tropas.)</p>
          <ul className="novidades__lista">
            {NOVIDADES.map((n) => (
              <li key={n.titulo} className={n.destaque ? "novidades__item novidades__item--destaque" : "novidades__item"}>
                <span className="novidades__icone" aria-hidden="true">{n.icone}</span>
                <span><strong>{n.titulo}</strong><span>{n.texto}</span></span>
              </li>
            ))}
          </ul>
          <div className="novidades__acoes">
            <Link ref={principal} href="/cartoes" className="pf-botao novidades__principal" onClick={fechar}>🃏 Ver os cartões</Link>
            <button type="button" className="pf-botao pf-botao--sec" onClick={fechar}>Depois eu vejo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
