"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  IconeHoje, IconeTrilhas, IconeAgenda, IconePratica, IconeProgresso, IconeRaioX, IconeRanking, IconeReino, IconeDominio, IconeBolsa, IconeMais, Marca,
  IconeCaderno, IconeBiblioteca, IconeAcervo, IconeChamados, IconeLisa,
} from "./Icones.js";
import { Confete } from "./Neuro.js";
import Celebracao from "./Celebracao.js";
import BotaoDeTema from "./BotaoDeTema.js";
import ReportarProblema from "./ReportarProblema.js";
import MinhaConta from "./MinhaConta.js";
import BotaoInstalar from "./BotaoInstalar.js";
import { AvisoDeVale } from "./Vales.js";
import Novidades from "./Novidades.js";
import TelaDeAbertura from "./marca/TelaDeAbertura.js";
import AcompanharTeclado from "./TecladoVirtual.js";

// em grupos (31/10/2026): treze itens soltos eram uma parede; com um rótulo discreto por grupo, o
// olho acha o que procura
const ITENS = [
  { href: "/", rotulo: "Hoje", Icone: IconeHoje, grupo: "Estudo" },
  { href: "/trilhas", rotulo: "Trilhas", Icone: IconeTrilhas, grupo: "Estudo" },
  { href: "/pratica", rotulo: "Prática", Icone: IconePratica, grupo: "Estudo" },
  { href: "/agenda", rotulo: "Agenda", Icone: IconeAgenda, grupo: "Estudo" },
  { href: "/cadernos", rotulo: "Cadernos", Icone: IconeCaderno, grupo: "Leitura" },
  { href: "/biblioteca", rotulo: "Biblioteca", Icone: IconeBiblioteca, grupo: "Leitura" },
  { href: "/acervo", rotulo: "Acervo", Icone: IconeAcervo, grupo: "Leitura" },
  { href: "/reino", rotulo: "Reino", Icone: IconeReino, grupo: "Jogo" },
  { href: "/dominio", rotulo: "Domínio", Icone: IconeDominio, grupo: "Jogo" },
  { href: "/bolsa", rotulo: "Bolsa", Icone: IconeBolsa, grupo: "Jogo" },
  { href: "/ranking", rotulo: "Ranking", Icone: IconeRanking, grupo: "Jogo" },
  { href: "/lisa", rotulo: "Lisa joga", Icone: IconeLisa, grupo: "Jogo" },
  { href: "/progresso", rotulo: "Progresso", Icone: IconeProgresso, grupo: "Você" },
  { href: "/raio-x", rotulo: "Raio-X", Icone: IconeRaioX, grupo: "Você" },
  { href: "/chamados", rotulo: "Chamados", Icone: IconeChamados, grupo: "Você" },
];
const GRUPOS = [...new Set(ITENS.map((i) => i.grupo))];

// No celular cabem 5 abas: as 4 do dia a dia e um "Mais" com o resto.
const NAS_ABAS = ["/", "/trilhas", "/pratica", "/reino"];
const ABAS = ITENS.filter((i) => NAS_ABAS.includes(i.href));
const NO_MAIS = ITENS.filter((i) => !NAS_ABAS.includes(i.href));

function ativo(caminho, href) {
  return href === "/" ? caminho === "/" : caminho === href || caminho.startsWith(href + "/");
}

async function sair() {
  await fetch("/api/auth/sair", { method: "POST" }).catch(() => {});
  window.location.href = "/entrar";
}

/**
 * A casca de todas as telas.
 *
 * Duas navegações, uma de cada vez: barra lateral a partir de 900px e, abaixo disso, barra de
 * abas presa embaixo — no celular o polegar alcança o rodapé, não o canto de cima.
 */
export default function Moldura({ children }) {
  const caminho = usePathname() || "/";

  return (
    <div className="pf-moldura">
      <aside className="pf-lateral">
        <Link href="/" className="pf-marca">
          <Marca tamanho={36} />
          <span>
            Lisa_Proof
            <span className="pf-marca__sub">estudo diário</span>
          </span>
        </Link>
        <nav className="pf-nav" aria-label="Navegação principal">
          {GRUPOS.map((grupo) => (
            <div key={grupo} className="pf-nav__grupo" role="group" aria-label={grupo}>
              <span className="pf-nav__rotulo" aria-hidden="true">{grupo}</span>
              {ITENS.filter((i) => i.grupo === grupo).map(({ href, rotulo, Icone }) => (
                <Link
                  key={href}
                  href={href}
                  className={`pf-nav__item${ativo(caminho, href) ? " pf-nav__item--ativo" : ""}`}
                  aria-current={ativo(caminho, href) ? "page" : undefined}
                >
                  <Icone />
                  {rotulo}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="pf-lateral__rodape">
          <div className="pf-lateral__ferramentas">
            <MinhaConta comTexto={false} />
            <BotaoDeTema />
            <ReportarProblema comTexto={false} />
            <BotaoInstalar comTexto={false} />
          </div>
          <button type="button" className="pf-lateral__sair" onClick={sair}>Sair</button>
        </div>
      </aside>

      <header className="pf-topo">
        <Link href="/" className="pf-marca">
          <Marca />
          Lisa_Proof
        </Link>
        <div className="pf-topo__acoes">
          <MinhaConta comTexto={false} />
          <BotaoInstalar comTexto={false} />
          <ReportarProblema comTexto={false} />
          <BotaoDeTema />
          <button type="button" className="pf-topo__sair" onClick={sair}>Sair</button>
        </div>
      </header>

      <main className="pf-principal">{children}</main>

      <nav className="pf-abas" aria-label="Navegação principal">
        {ABAS.map(({ href, rotulo, Icone }) => (
          <Link
            key={href}
            href={href}
            className={`pf-abas__item${ativo(caminho, href) ? " pf-abas__item--ativo" : ""}`}
            aria-current={ativo(caminho, href) ? "page" : undefined}
          >
            <Icone />
            {rotulo}
          </Link>
        ))}
        <Mais caminho={caminho} />
      </nav>
      <Celebracao />
      <TelaDeAbertura />
      <Confete />
      <AvisoDeVale />
      <Novidades />
      <AcompanharTeclado />
    </div>
  );
}

/** A 5ª aba do celular: abre um menu com o resto (Agenda, Cadernos, Biblioteca, Progresso, Domínio, Bolsa, Ranking, Raio-X). */
function Mais({ caminho }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef(null);
  const algumAtivo = NO_MAIS.some((i) => ativo(caminho, i.href));

  useEffect(() => setAberto(false), [caminho]);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => { if (!caixa.current?.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);

  return (
    <div className="pf-mais" ref={caixa}>
      <button type="button" className={`pf-abas__item${algumAtivo ? " pf-abas__item--ativo" : ""}`}
        aria-expanded={aberto} aria-haspopup="true" onClick={() => setAberto((a) => !a)}>
        <IconeMais />
        Mais
      </button>
      {aberto && (
        <div className="pf-mais__menu">
          {NO_MAIS.map(({ href, rotulo, Icone }) => (
            <Link key={href} href={href} aria-current={ativo(caminho, href) ? "page" : undefined}>
              <Icone />
              {rotulo}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
