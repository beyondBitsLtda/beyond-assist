"use client";

import Link from "next/link";
import SeletorDeTema from "./SeletorDeTema.js";

/**
 * A faixa do topo: tema e sair.
 *
 * Antes essas duas coisas moravam no RODAPÉ da barra lateral, e no celular a barra lateral
 * vira uma faixa de navegação no rodapé — que esconde o próprio rodapé. O resultado é que no
 * celular não havia como trocar o tema nem sair. Aqui em cima, existem nos dois.
 *
 * A faixa é fina de propósito. A tela do quadro já tem uma barra própria com o nome e os
 * contadores; duas barras gordas empilhadas comeriam a altura que as colunas precisam.
 */
export default function BarraDoTopo() {
  return (
    <header className="abacato-topo">
      {/* A marca aparece só no celular: no computador ela já está no alto da barra lateral, e
          repetir o nome do sistema duas vezes na mesma tela é ruído. */}
      <div className="abacato-topo__marca">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={24} height={24} style={{ borderRadius: 7 }} />
        Abacato
      </div>

      <div className="abacato-topo__direita">
        <Link href="/conta" className="abacato-topo__sair" title="Minha conta">
          <span aria-hidden="true">◔</span>
          <span className="abacato-topo__sair-texto">Minha conta</span>
        </Link>
        <SeletorDeTema />
        <button
          type="button"
          className="abacato-topo__sair"
          title="Sair do Abacato"
          onClick={async () => {
            await fetch("/api/auth/sair", { method: "POST" });
            window.location.href = "/entrar";
          }}
        >
          <span aria-hidden="true">⏻</span>
          <span className="abacato-topo__sair-texto">Sair</span>
        </button>
      </div>
    </header>
  );
}
