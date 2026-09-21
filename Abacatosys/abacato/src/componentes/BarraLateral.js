"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// A navegação inteira num lugar só. Acrescentar uma área do sistema é acrescentar uma linha
// aqui — e não um item de menu em cada arquivo que por acaso desenha o menu.
//
// `soAdmin` esconde o item de quem não administra. É SÓ ARRUMAÇÃO DE TELA: cada uma dessas
// rotas confere o mesmo por conta própria, no servidor, a cada pedido. Um menu não protege
// nada — quem digita o endereço na barra do navegador nunca passou por ele.
const ITENS = [
  { href: "/quadros", rotulo: "Quadros", icone: "▦" },
  { href: "/documentos", rotulo: "Documentos", icone: "🗂" },
  { href: "/dashboards", rotulo: "Dashboards", icone: "📊" },
  { href: "/pessoas", rotulo: "Pessoas", icone: "👥", soAdmin: true },
  { href: "/uso", rotulo: "Uso do sistema", icone: "📈", soAdmin: true },
];

export default function BarraLateral() {
  const caminho = usePathname();
  // `null` enquanto não se sabe. Começar em `false` faria os itens de administração piscarem
  // para fora e voltarem a cada troca de tela; começar em `true` os mostraria por um instante
  // a quem não pode vê-los, que é pior.
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/conta/plano")
      .then((r) => r.json())
      .then((d) => { if (vivo) setAdmin(Boolean(d?.uso?.admin)); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  return (
    <aside className="abacato-barra-lateral">
      <div className="abacato-barra-lateral__marca">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={28} height={28} style={{ borderRadius: 8 }} />
        Abacato
      </div>

      <nav className="abacato-barra-lateral__grupo">
        <div className="abacato-barra-lateral__titulo">Navegação</div>
        {ITENS.filter((item) => !item.soAdmin || admin === true).map((item) => {
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
