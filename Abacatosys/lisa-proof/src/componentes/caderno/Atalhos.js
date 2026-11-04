"use client";

// A barra de atalhos do caderno no celular e no tablet (31/10/2026): fica logo acima do teclado
// virtual enquanto o editor está em foco, com o que o teclado não tem à mão — desfazer, recuo, os
// sinais do Markdown (título, negrito, lista, tarefa, código, link) e, nas páginas de código, os
// símbolos de programação. Tocar num botão não tira o foco do editor (o teclado continua aberto).

const DO_MARKDOWN = [
  { rotulo: "#", dica: "Título", faz: (e) => e.prefixar("# ") },
  { rotulo: "B", dica: "Negrito", classe: "cd-atalhos__negrito", faz: (e) => e.envolver("**", "**", "negrito") },
  { rotulo: "I", dica: "Itálico", classe: "cd-atalhos__italico", faz: (e) => e.envolver("_", "_", "itálico") },
  { rotulo: "•", dica: "Lista", faz: (e) => e.prefixar("- ") },
  { rotulo: "1.", dica: "Lista numerada", faz: (e) => e.prefixar("1. ") },
  { rotulo: "☐", dica: "Tarefa", faz: (e) => e.prefixar("- [ ] ") },
  { rotulo: "❝", dica: "Citação", faz: (e) => e.prefixar("> ") },
  { rotulo: "`", dica: "Código na linha", faz: (e) => e.envolver("`", "`", "código") },
  { rotulo: "{ }", dica: "Bloco de código", faz: (e) => e.envolver("\n```\n", "\n```\n", "código") },
  { rotulo: "🔗", dica: "Link", faz: (e) => e.envolver("[", "](https://)", "texto do link") },
];

const DO_CODIGO = ["{}", "()", "[]", "<>", "\"\"", "''", ";", "=", ":", "/", "|", "&", "_", "$", "#", "!"].map((s) => ({
  rotulo: s,
  dica: `Inserir ${s}`,
  faz: (e) => (s.length === 2 ? e.envolver(s[0], s[1]) : e.envolver(s)),
}));

const SEMPRE = [
  { rotulo: "↶", dica: "Desfazer", faz: (e) => e.comando("desfazer") },
  { rotulo: "↷", dica: "Refazer", faz: (e) => e.comando("refazer") },
  { rotulo: "⇤", dica: "Diminuir o recuo", faz: (e) => e.comando("desrecuar") },
  { rotulo: "⇥", dica: "Aumentar o recuo", faz: (e) => e.comando("recuar") },
];

export default function Atalhos({ editor, linguagem }) {
  const botoes = [...SEMPRE, ...(linguagem === "markdown" || linguagem === "texto" ? DO_MARKDOWN : DO_CODIGO)];
  return (
    <div className="cd-atalhos" role="toolbar" aria-label="Atalhos de escrita">
      {botoes.map((b) => (
        <button
          key={b.dica + b.rotulo} type="button" className={b.classe} title={b.dica} aria-label={b.dica}
          // o toque não pode levar o foco: o editor perderia o cursor e o teclado fecharia
          onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()}
          onClick={() => { const e = editor(); if (e) b.faz(e); }}
        >
          {b.rotulo}
        </button>
      ))}
    </div>
  );
}
