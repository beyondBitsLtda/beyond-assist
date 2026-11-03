"use client";

// "O que há de novo": um modal caprichado que aparece uma vez por edição, assim que a pessoa entra
// no Proof (pedido de 22/10/2026). A edição vista fica guardada neste navegador — em outro
// aparelho, ela aparece de novo uma vez, o que não faz mal. Enquanto ele está aberto, o aviso de
// vale espera (os dois juntos brigavam pela tela).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Neuro from "./Neuro.js";
import { urlDoFuncionario } from "./acervo/personagensDoAcervo.js";

export const EDICAO_DAS_NOVIDADES = "2026-11-03-clima-e-forja";
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

// a edição de 03/11/2026 (à noite): o clima do Reino e as quatro ideias da Lisa — o humor do Neuro, a Forja,
// os Chefões da Procrastinação e o Duelo de Lógica
const NOVIDADES = [
  { icone: "🌧️", destaque: true, titulo: "O Reino agora tem clima e anoitece", texto: "A luz segue a hora de verdade: amanhece, entardece dourado e anoitece com estrelas e janelas acesas. E o tempo muda a cada 3 horas — chuva, neve, vento e tempestade com relâmpagos." },
  { icone: "🧠", titulo: "O humor do Neuro", texto: "Estudando todo dia, o Neuro evolui e a sua mina rende até +20%. Sumiu 3 dias? Ele fica revoltado e fecha as expedições até você voltar a estudar." },
  { icone: "⚒️", titulo: "Forja de Artefatos", texto: "Seus estudos viram mana (menu Jogo → Forja): a Poção de Foco dá +50% no que você ganhar por 2 horas, e o Escudo de Folga protege o reino por 24 horas." },
  { icone: "👹", titulo: "Chefões da Procrastinação", texto: "Matérias e revisões atrasadas viram um monstro gigante no seu Reino. Bata nele com a Prática, o diário e os Cadernos — derrubou, ganha moedas." },
  { icone: "⚔️", titulo: "Duelo de Lógica com a Lisa", texto: "Em Lisa joga → Duelo: 5 perguntas rápidas de código e raciocínio, valendo moedas. Ganhou dela, leva a aposta do reino dela." },
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
          <h2 id="novidades-titulo" className="novidades__titulo">Chuva, noite e chefões no Reino!</h2>
          <p className="novidades__sub">O Reino ganhou clima de verdade, e chegaram as ideias da Lisa: o humor do Neuro, a Forja, os Chefões e o Duelo.</p>
          <ul className="novidades__lista">
            {NOVIDADES.map((n) => (
              <li key={n.titulo} className={n.destaque ? "novidades__item novidades__item--destaque" : "novidades__item"}>
                <span className="novidades__icone" aria-hidden="true">{n.personagem ? <Neuro personagem={n.personagem} humor="feliz" tamanho={66} /> : n.icone}</span>
                <span><strong>{n.titulo}</strong><span>{n.texto}</span></span>
              </li>
            ))}
          </ul>
          <div className="novidades__acoes">
            <Link ref={principal} href="/reino" className="pf-botao novidades__principal" onClick={fechar}>🌧️ Ver o Reino</Link>
            <button type="button" className="pf-botao pf-botao--sec" onClick={fechar}>Depois eu vejo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
