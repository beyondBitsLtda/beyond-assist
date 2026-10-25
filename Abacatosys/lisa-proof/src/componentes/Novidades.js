"use client";

// "O que há de novo": um modal caprichado que aparece uma vez por edição, assim que a pessoa entra
// no Proof (pedido de 22/10/2026). A edição vista fica guardada neste navegador — em outro
// aparelho, ela aparece de novo uma vez, o que não faz mal. Enquanto ele está aberto, o aviso de
// vale espera (os dois juntos brigavam pela tela).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Neuro from "./Neuro.js";
import { urlDoMonstro } from "./reino/monstrosDePapel.js";

export const EDICAO_DAS_NOVIDADES = "2026-10-25-cadernos-e-biblioteca";
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
  { icone: "📓", titulo: "Cadernos", texto: "Anote como num editor de código: vários cadernos, módulos e páginas, cor de sintaxe em Markdown, JavaScript, Python, SQL e outras, abas, buscar e substituir, prévia e gravação automática.", destaque: true },
  { icone: "🔗", titulo: "Ligados ao seu estudo", texto: "Vincule um caderno, um módulo ou uma página a uma trilha, um curso, um assunto, uma torre, um andar ou a página de um livro — e o “📓 Anotações” aparece lá, com o caminho de volta." },
  { icone: "📚", titulo: "Biblioteca de PDFs", texto: "Suba seus livros em PDF e leia com destaque em cores, sublinhado, notas, marcação de área, marcador de página, sumário, miniaturas, busca e temas sépia e escuro. Mande trechos para o caderno." },
  { icone: "🎓", titulo: "Cursos a partir de um livro", texto: "Escolha o livro e os capítulos: a Lisa lê o texto e monta o curso seguindo o livro, com as páginas de cada assunto — e o quiz e o exercício cobram o que o livro ensina." },
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
          <img className="novidades__bicho novidades__bicho--cerbero" src={urlDoMonstro("dragaoDeLava")} alt="" />
          <img className="novidades__bicho novidades__bicho--goblin" src={urlDoMonstro("golem")} alt="" />
          <img className="novidades__bicho novidades__bicho--cogumelo" src={urlDoMonstro("ent")} alt="" />
          <img className="novidades__bicho novidades__bicho--morcego" src={urlDoMonstro("kraken")} alt="" />
          <div className="novidades__neuro"><Neuro humor="comemorando" tamanho={92} /></div>
          <span className="novidades__chao" />
        </div>
        <div className="novidades__corpo">
          <span className="novidades__selo">✨ Novidade no Proof</span>
          <h2 id="novidades-titulo" className="novidades__titulo">Cadernos e Biblioteca!</h2>
          <p className="novidades__sub">Um caderno de código para anotar enquanto estuda, uma biblioteca para ler e marcar seus PDFs — e cursos montados a partir dos seus livros.</p>
          <ul className="novidades__lista">
            {NOVIDADES.map((n) => (
              <li key={n.titulo} className={n.destaque ? "novidades__item novidades__item--destaque" : "novidades__item"}>
                <span className="novidades__icone" aria-hidden="true">{n.icone}</span>
                <span><strong>{n.titulo}</strong><span>{n.texto}</span></span>
              </li>
            ))}
          </ul>
          <div className="novidades__acoes">
            <Link ref={principal} href="/biblioteca" className="pf-botao novidades__principal" onClick={fechar}>📚 Abrir a biblioteca</Link>
            <Link href="/cadernos" className="pf-botao pf-botao--sec" onClick={fechar}>📓 Cadernos</Link>
            <button type="button" className="pf-botao pf-botao--sec" onClick={fechar}>Depois eu vejo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
