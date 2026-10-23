"use client";

// "O que há de novo": um modal caprichado que aparece uma vez por edição, assim que a pessoa entra
// no Proof (pedido de 22/10/2026). A edição vista fica guardada neste navegador — em outro
// aparelho, ela aparece de novo uma vez, o que não faz mal. Enquanto ele está aberto, o aviso de
// vale espera (os dois juntos brigavam pela tela).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Neuro from "./Neuro.js";
import { urlDoMonstro } from "./reino/monstrosDePapel.js";

export const EDICAO_DAS_NOVIDADES = "2026-10-23-bolsa";
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
  { icone: "📈", titulo: "A Bolsa ganhou tela própria", texto: "Um pregão de verdade: letreiro de cotações, Índice do Reino, gráfico hora a hora com mira, velas de 14 dias, boleta de compra e venda e o mural de notícias da Lisa. No menu: Bolsa.", destaque: true },
  { icone: "⏰", titulo: "Cotações de hora em hora", texto: "A Lisa decide onde cada ação fecha o dia; o preço anda de hora em hora até lá — acompanhe o movimento nos gráficos." },
  { icone: "💎", titulo: "Diamantes na Mina de Ouro", texto: "Cada pedra que os operários tiram pode ser um diamante, que vale bem mais que ouro. Quanto mais funda a mina, mais sorte." },
  { icone: "⛏️", titulo: "Operários cavando", texto: "Os seus operários agora aparecem no mundo 3D, de picareta na mão, em volta da Mina de Ouro." },
  { icone: "🚀", titulo: "Veículos e mapas novos", texto: "Submarino, Dirigível, Tanque de Magma e Nave Estelar — com fundo do mar, montanhas, vulcões e planetoides sorteados. Cada veículo faz 3 expedições por dia; depois, é só abastecer." },
  { icone: "🥑", titulo: "Neuro Abacate, de graça", texto: "O Neuro vestido de mascote do Abacato: já é de todo mundo — é só vestir em Personagens." },
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
          <h2 id="novidades-titulo" className="novidades__titulo">Bolsa ao vivo e diamantes!</h2>
          <p className="novidades__sub">O pregão ganhou tela de home broker e cotações de hora em hora; e a Mina de Ouro agora pode dar diamantes.</p>
          <ul className="novidades__lista">
            {NOVIDADES.map((n) => (
              <li key={n.titulo} className={n.destaque ? "novidades__item novidades__item--destaque" : "novidades__item"}>
                <span className="novidades__icone" aria-hidden="true">{n.icone}</span>
                <span><strong>{n.titulo}</strong><span>{n.texto}</span></span>
              </li>
            ))}
          </ul>
          <div className="novidades__acoes">
            <Link ref={principal} href="/bolsa" className="pf-botao novidades__principal" onClick={fechar}>📈 Abrir a Bolsa</Link>
            <button type="button" className="pf-botao pf-botao--sec" onClick={fechar}>Depois eu vejo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
