"use client";

// Os sites que a Lisa usou quando pesquisou na internet (01/11/2026, ver src/lib/buscaNaWeb.js):
// links pequenos embaixo da resposta, abertos em outra aba. Só na tela — a fala não lê endereço.
// Classes "bb-" pelo mesmo motivo do TextoComCodigo.js (a camada de fonte dos painéis).

import { dominioDe } from "@/lib/buscaNaWeb.js";

export default function FontesDaWeb({ fontes }) {
  const lista = (fontes || []).filter((f) => /^https?:\/\//i.test(String(f?.url || "")));
  if (!lista.length) return null;
  return (
    <div className="bb-fontes">
      <span className="bb-fontes-cabeca">Fontes</span>
      {lista.map((f) => (
        <a key={f.url} className="bb-fonte" href={f.url} target="_blank" rel="noopener noreferrer" title={f.nome || f.url}>
          {/* a busca do Google manda o domínio no título (o link é um redirecionamento do Google) */}
          {f.titulo || dominioDe(f.url)}
        </a>
      ))}
    </div>
  );
}
