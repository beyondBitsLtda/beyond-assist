"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// A navegação inteira num lugar só. Acrescentar uma área do sistema é acrescentar uma linha
// aqui — e não um item de menu em cada arquivo que por acaso desenha o menu.
const ITENS = [
  { href: "/quadros", rotulo: "Quadros", icone: "▦" },
  { href: "/documentos", rotulo: "Documentos", icone: "🗂" },
  { href: "/dashboards", rotulo: "Dashboards", icone: "📊" },
];

export default function BarraLateral() {
  const caminho = usePathname();

  return (
    <aside className="abacato-barra-lateral">
      <div className="abacato-barra-lateral__marca">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={28} height={28} style={{ borderRadius: 8 }} />
        Abacato
      </div>

      <nav className="abacato-barra-lateral__grupo">
        <div className="abacato-barra-lateral__titulo">Navegação</div>
        {ITENS.map((item) => {
          // Compara por segmento, e não por `startsWith`: sem isto, /quadros ficaria aceso
          // enquanto você estivesse em /quadros-arquivados, que é outra tela.
          const ativo = caminho === item.href || caminho.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`abacato-barra-lateral__item${ativo ? " abacato-barra-lateral__item--ativo" : ""}`}
            >
              <span className="abacato-barra-lateral__icone">{item.icone}</span>
              {item.rotulo}
            </Link>
          );
        })}
      </nav>

    </aside>
  );
}
