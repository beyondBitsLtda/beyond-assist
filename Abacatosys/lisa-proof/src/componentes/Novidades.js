"use client";

// "O que há de novo": um modal caprichado que aparece uma vez por edição, assim que a pessoa entra
// no Proof (pedido de 22/10/2026). A edição vista fica guardada neste navegador — em outro
// aparelho, ela aparece de novo uma vez, o que não faz mal. Enquanto ele está aberto, o aviso de
// vale espera (os dois juntos brigavam pela tela).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Neuro from "./Neuro.js";
import { retratoDoConsultor } from "./bolsa/consultoresDePapel.js";

export const EDICAO_DAS_NOVIDADES = "2026-10-26-consultores-da-bolsa";
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
  { icone: "🔮", titulo: "Mesa dos Consultores", texto: "Madame Ametista, o Barão Cifrão, a Luna “Foguete”, o Professor Corvo, a Dona Zuleica e o Gorgo, o Urso, projetam onde cada ação da Bolsa fecha. Cada um tem história, jeito e uma margem de erro secreta que muda todo dia.", destaque: true },
  { icone: "📊", titulo: "O que dizem da sua ação", texto: "Na ação escolhida, uma régua mostra o preço que cada consultor projetou, o preço de agora e a mediana da mesa — com a fala de cada um." },
  { icone: "🏆", titulo: "Placar e retrospecto", texto: "Depois das 17h, o placar mostra quem chegou mais perto. O retrospecto dos últimos pregões é a sua pista de em quem confiar." },
  { icone: "✖️", titulo: "Recompensas em triplo", texto: "Quiz, exercício, projetos da semana e do mês e as conquistas de andares do Modo Domínio passam a valer o triplo de pontos e moedas." },
];

const NA_ESQUERDA = ["ametista", "barao", "luna"];
const NA_DIREITA = ["corvo", "zuleica", "gorgo"];

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
            <span>{NA_ESQUERDA.map((id) => <img key={id} className="novidades__retrato" src={retratoDoConsultor(id)} alt="" />)}</span>
            <span>{NA_DIREITA.map((id) => <img key={id} className="novidades__retrato" src={retratoDoConsultor(id)} alt="" />)}</span>
          </div>
          <div className="novidades__neuro"><Neuro humor="comemorando" tamanho={92} /></div>
          <span className="novidades__chao" />
        </div>
        <div className="novidades__corpo">
          <span className="novidades__selo">✨ Novidade no Proof</span>
          <h2 id="novidades-titulo" className="novidades__titulo">A Mesa dos Consultores!</h2>
          <p className="novidades__sub">Seis personagens projetam o fechamento da Bolsa do Reino — cada um erra do seu jeito, e ninguém sabe a margem de erro de hoje. E estudar agora rende o triplo de moedas.</p>
          <ul className="novidades__lista">
            {NOVIDADES.map((n) => (
              <li key={n.titulo} className={n.destaque ? "novidades__item novidades__item--destaque" : "novidades__item"}>
                <span className="novidades__icone" aria-hidden="true">{n.icone}</span>
                <span><strong>{n.titulo}</strong><span>{n.texto}</span></span>
              </li>
            ))}
          </ul>
          <div className="novidades__acoes">
            <Link ref={principal} href="/bolsa" className="pf-botao novidades__principal" onClick={fechar}>🔮 Ver os consultores</Link>
            <button type="button" className="pf-botao pf-botao--sec" onClick={fechar}>Depois eu vejo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
