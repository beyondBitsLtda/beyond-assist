"use client";

// As FERRAMENTAS DO REINO DE TESTE (23/10/2026). O modo de teste antigo mexia no reino de verdade;
// agora tudo acontece no Reino de Teste, um mundo à parte (src/lib/mundo.js) — estes botões só
// existem lá, e o servidor recusa usá-los no reino de verdade.

import Link from "next/link";
import { FERRAMENTAS_DE_TESTE } from "@/dominio/mundoDeTeste.js";

export default function ModoDeTeste({ ocupado, aoAgir }) {
  return (
    <div className="rn-teste">
      <p className="rn-teste__aviso">
        🧪 Aqui as regras são as do jogo de verdade — só que com tudo liberado e sem esperar. Use os botões para zerar os limites do dia, restaurar os rivais ou recomeçar.
      </p>
      <div className="rn-teste__grade">
        {FERRAMENTAS_DE_TESTE.map((a) => (
          <button key={a.id} type="button" className={`rn-teste__botao${a.confirmar ? " rn-teste__botao--limpar" : ""}`} disabled={Boolean(ocupado)} onClick={() => aoAgir(a.id)}>
            <span className="rn-teste__emoji" aria-hidden="true">{a.emoji}</span>
            <span><strong>{ocupado === `teste:${a.id}` ? "Um instante…" : a.titulo}</strong><small>{a.texto}</small></span>
          </button>
        ))}
      </div>
      <p className="rn-teste__dica">
        A bolsa também tem o seu teste: <Link href="/bolsa/teste">abra a Bolsa de Teste</Link> — mesmas ações e preços, carteira do mundo de teste, negocia a qualquer hora (até numa hora simulada) e mostra a prévia do pregão de amanhã.
      </p>
    </div>
  );
}
