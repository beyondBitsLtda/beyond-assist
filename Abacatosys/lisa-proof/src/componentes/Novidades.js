"use client";

// "O que há de novo": um modal caprichado que aparece uma vez por edição, assim que a pessoa entra
// no Proof (pedido de 22/10/2026). A edição vista fica guardada neste navegador — em outro
// aparelho, ela aparece de novo uma vez, o que não faz mal. Enquanto ele está aberto, o aviso de
// vale espera (os dois juntos brigavam pela tela).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Neuro from "./Neuro.js";
import { urlDoFuncionario } from "./acervo/personagensDoAcervo.js";

export const EDICAO_DAS_NOVIDADES = "2026-11-03-raposao";
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

// a edição de 03/11/2026: o Raposão (o prêmio do Viana, à venda para todos), os Presentes, o correio, a Lisa
// jogando, os chamados e o exercício do dia valendo o triplo
const NOVIDADES = [
  { icone: "🦊", personagem: "raposao", destaque: true, titulo: "Personagem novo: Neuro Raposão", texto: "Uma raposa azul e branca, de orelhas em pé e rabo cheio. É o prêmio do Viana, que já está esperando por ele em Presentes — e está à venda para todo mundo por 🪙 610, em Reino → Personagens." },
  { icone: "🎁", titulo: "Presentes", texto: "Área nova (no menu Você): o que for guardado para você espera lá até você abrir. Abriu, o personagem entra na sua coleção sem custar nada." },
  { icone: "🕊️", titulo: "Correio com pombo-carteiro", texto: "Mande recados para outros jogadores (útil = os dois ganham moedas) e até 2 perguntas do quiz do dia. A caixa de correio fica no seu Reino: a bandeirinha sobe quando chega carta." },
  { icone: "🤖", titulo: "A Lisa joga com você", texto: "A Lisa tem conta própria e estuda e joga como qualquer um: curso do mês, quiz, Reino, Bolsa. Em Jogo → Lisa joga dá para ver tudo dela, até por dentro." },
  { icone: "✍️", titulo: "Exercício do dia vale o triplo", texto: "Até 360 pontos (e moedas do Reino) com nota 100. A 2ª e a 3ª rodada do dia continuam valendo metade." },
  { icone: "🛟", titulo: "Acompanhe seus chamados", texto: "Em Você → Chamados: o status de cada problema que você reportou, a previsão de término e as respostas do técnico." },
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
          <div className="novidades__neuro"><Neuro humor="comemorando" tamanho={92} personagem="raposao" /></div>
          <span className="novidades__chao" />
        </div>
        <div className="novidades__corpo">
          <span className="novidades__selo">✨ Novidade no Proof</span>
          <h2 id="novidades-titulo" className="novidades__titulo">Chegou o Raposão!</h2>
          <p className="novidades__sub">Um personagem novo, a área de presentes, o correio entre jogadores e a Lisa jogando junto com você.</p>
          <ul className="novidades__lista">
            {NOVIDADES.map((n) => (
              <li key={n.titulo} className={n.destaque ? "novidades__item novidades__item--destaque" : "novidades__item"}>
                <span className="novidades__icone" aria-hidden="true">{n.personagem ? <Neuro personagem={n.personagem} humor="feliz" tamanho={66} /> : n.icone}</span>
                <span><strong>{n.titulo}</strong><span>{n.texto}</span></span>
              </li>
            ))}
          </ul>
          <div className="novidades__acoes">
            <Link ref={principal} href="/reino" className="pf-botao novidades__principal" onClick={fechar}>🦊 Ver o Raposão</Link>
            <button type="button" className="pf-botao pf-botao--sec" onClick={fechar}>Depois eu vejo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
