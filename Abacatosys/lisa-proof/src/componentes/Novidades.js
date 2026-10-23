"use client";

// "O que há de novo": um modal caprichado que aparece uma vez por edição, assim que a pessoa entra
// no Proof (pedido de 22/10/2026). A edição vista fica guardada neste navegador — em outro
// aparelho, ela aparece de novo uma vez, o que não faz mal. Enquanto ele está aberto, o aviso de
// vale espera (os dois juntos brigavam pela tela).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Neuro from "./Neuro.js";
import { urlDoMonstro } from "./reino/monstrosDePapel.js";

export const EDICAO_DAS_NOVIDADES = "2026-10-23-veiculos";
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
  { icone: "🚀", titulo: "Veículos e mapas novos", texto: "Compre na garagem o Submarino (fundo do mar), o Dirigível (montanhas geladas), o Tanque de Magma (reinos de fogo) e a Nave Estelar: cada viagem cai num planetoide com aliens de força e tesouro sorteados.", destaque: true },
  { icone: "⛽", titulo: "Combustível", texto: "Cada veículo faz 3 expedições por dia. Acabou? Abasteça com moedas e siga explorando." },
  { icone: "⚒️", titulo: "Mina de Ouro", texto: "Todo reino ganhou uma mina e 3 operários: eles tiram pepitas que valem mais moedas. Contrate mais — e alugue os seus para outros reinos (ou alugue os deles)." },
  { icone: "📈", titulo: "Bolsa do Reino", texto: "Invista as suas moedas em ações. Todo dia a Lisa abre o pregão, decide quem sobe e quem cai e lança empresas novas — a mesma bolsa para todos." },
  { icone: "⛶", titulo: "Tela cheia e visitas", texto: "Veja o reino em tela cheia, com os menus flutuando por cima. Na paz, toque numa ilha vizinha para ver aquele reino inteiro." },
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
          <h2 id="novidades-titulo" className="novidades__titulo">Veículos, Ouro e Bolsa!</h2>
          <p className="novidades__sub">Explore o fundo do mar, as montanhas, os vulcões e o espaço; tire ouro com os seus operários; e invista na bolsa que a Lisa comanda.</p>
          <ul className="novidades__lista">
            {NOVIDADES.map((n) => (
              <li key={n.titulo} className={n.destaque ? "novidades__item novidades__item--destaque" : "novidades__item"}>
                <span className="novidades__icone" aria-hidden="true">{n.icone}</span>
                <span><strong>{n.titulo}</strong><span>{n.texto}</span></span>
              </li>
            ))}
          </ul>
          <div className="novidades__acoes">
            <Link ref={principal} href="/reino#garagem" className="pf-botao novidades__principal" onClick={fechar}>🚗 Ver a garagem</Link>
            <button type="button" className="pf-botao pf-botao--sec" onClick={fechar}>Depois eu vejo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
