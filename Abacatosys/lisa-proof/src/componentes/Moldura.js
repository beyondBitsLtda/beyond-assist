"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconeHoje, IconeTrilhas, IconeAgenda, IconePratica, IconeProgresso, Marca } from "./Icones.js";
import { Confete } from "./Neuro.js";
import Celebracao from "./Celebracao.js";
import BotaoDeTema from "./BotaoDeTema.js";

const ITENS = [
  { href: "/", rotulo: "Hoje", Icone: IconeHoje },
  { href: "/trilhas", rotulo: "Trilhas", Icone: IconeTrilhas },
  { href: "/agenda", rotulo: "Agenda", Icone: IconeAgenda },
  { href: "/pratica", rotulo: "Prática", Icone: IconePratica },
  { href: "/progresso", rotulo: "Progresso", Icone: IconeProgresso },
];

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
          <Marca />
          <span>
            Lisa_Proof
            <span className="pf-marca__sub">estudo diário</span>
          </span>
        </Link>
        <nav className="pf-nav" aria-label="Navegação principal">
          {ITENS.map(({ href, rotulo, Icone }) => (
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
        </nav>
        <div className="pf-lateral__rodape">
          <BotaoDeTema comTexto />
          <button type="button" className="pf-lateral__sair" onClick={sair}>Sair</button>
        </div>
      </aside>

      <header className="pf-topo">
        <Link href="/" className="pf-marca">
          <Marca />
          Lisa_Proof
        </Link>
        <div className="pf-topo__acoes">
          <BotaoDeTema />
          <button type="button" className="pf-topo__sair" onClick={sair}>Sair</button>
        </div>
      </header>

      <main className="pf-principal">{children}</main>

      <nav className="pf-abas" aria-label="Navegação principal">
        {ITENS.map(({ href, rotulo, Icone }) => (
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
      </nav>
      <Celebracao />
      <Confete />
    </div>
  );
}
