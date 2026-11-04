"use client";

// "O que há de novo": um modal caprichado que aparece uma vez por edição, assim que a pessoa entra
// no Proof (pedido de 22/10/2026). A edição vista fica guardada neste navegador — em outro
// aparelho, ela aparece de novo uma vez, o que não faz mal. Enquanto ele está aberto, o aviso de
// vale espera (os dois juntos brigavam pela tela).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Neuro from "./Neuro.js";

// a 1.0 com o banner (03/11/2026): edição nova, para o anúncio aparecer de novo para todo mundo
export const EDICAO_DAS_NOVIDADES = "2026-11-03-versao-1-banner";
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

// a edição da VERSÃO 1.0 (03/11/2026): o Lisa_Proof sai do "em construção". O que chegou nela vem primeiro; o
// resto lembra o que o app já é, para quem chega agora. O topo é o banner da 1.0 (public/novidades/).
const NOVIDADES = [
  { icone: "✨", destaque: true, titulo: "Visual novo", texto: "Tudo escuro e premium: cartões de vidro, a ofensiva em destaque com a sua semana dia a dia e o Reino organizado em abas." },
  { icone: "🏝️", destaque: true, titulo: "Temporada das Ilhas", texto: "A primeira temporada de domínio: no Reino, as Grandes Expedições: compre o Navio Pirata, conquiste as ilhas dos nativos (em 3D, como o seu reino), construa com conchas e dispute o arquipélago — aqui, só pacto entre dois segura um ataque." },
  { icone: "🕹️", destaque: true, titulo: "Arena Lúdica de Programação", texto: "O minigame do dia, na Prática: conserte bugs para atravessar a Masmorra da Depuração, programe o mascote para comer tudo e monte algoritmos embaralhados. Vale pontos todo dia, como o quiz." },
  { icone: "🧩", titulo: "O exemplo da Lisa nos exercícios", texto: "Travou? Em todo exercício e projeto, a Lisa mostra um exemplo que aplica todos os conceitos que você vai precisar — sem resolver o seu." },
  { icone: "⚔️", titulo: "Reino maior", texto: "Tropas novas (Lanceiro, Cavaleiro, Grifo e o Colosso de Pedra), o Pomar, o Lança-Chamas, a Torre de Gelo, a Catapulta e seis expedições novas." },
  { icone: "👹", titulo: "Chefões com dentes", texto: "De pé, o chefão da procrastinação rouba um pouquinho do reino por dia. Derrube ele e recebe tudo de volta, mais a recompensa." },
  { icone: "🤖", titulo: "A Lisa joga sozinha", texto: "Ela estuda e joga várias vezes por dia — acompanhe tudo o que ela faz em Lisa joga." },
  { icone: "🧠", titulo: "Tudo o que já estava aqui", texto: "Trilhas e prática diária, Cadernos e Biblioteca, o Modo Domínio, a Bolsa, a Forja, o Duelo com a Lisa, o clima do Reino e o humor do Neuro." },
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
        {/* o banner da 1.0 (03/11/2026): a versão menor no celular, a maior na tela larga */}
        <picture className="novidades__banner">
          <source media="(min-width: 700px)" srcSet="/novidades/lisa-proof-1-0.webp" />
          <img src="/novidades/lisa-proof-1-0-900.webp" width={1672} height={941} decoding="async"
            alt="Lisa Proof 1.0 — agora ainda mais completo para suas necessidades! A Lisa, de óculos e prancheta, apresenta a versão nova." />
        </picture>
        <div className="novidades__corpo">
          <span className="novidades__selo novidades__selo--versao">🎉 Versão 1.0</span>
          <h2 id="novidades-titulo" className="novidades__titulo">O Lisa_Proof chegou à versão 1.0!</h2>
          <p className="novidades__sub">Obrigado por estudar e jogar com a gente até aqui. A 1.0 fecha o "em construção" com a Temporada das Ilhas, a Arena Lúdica e o exemplo da Lisa em todo exercício.</p>
          <ul className="novidades__lista">
            {NOVIDADES.map((n) => (
              <li key={n.titulo} className={n.destaque ? "novidades__item novidades__item--destaque" : "novidades__item"}>
                <span className="novidades__icone" aria-hidden="true">{n.personagem ? <Neuro personagem={n.personagem} humor="feliz" tamanho={66} /> : n.icone}</span>
                <span><strong>{n.titulo}</strong><span>{n.texto}</span></span>
              </li>
            ))}
          </ul>
          <div className="novidades__acoes">
            <Link ref={principal} href="/reino#grandes-expedicoes" className="pf-botao novidades__principal" onClick={fechar}>🏝️ Ir para as Ilhas</Link>
            <Link href="/pratica#minigame" className="pf-botao pf-botao--sec" onClick={fechar}>🕹️ Minigame do dia</Link>
            <button type="button" className="pf-botao pf-botao--sec" onClick={fechar}>Depois</button>
          </div>
        </div>
      </div>
    </div>
  );
}
