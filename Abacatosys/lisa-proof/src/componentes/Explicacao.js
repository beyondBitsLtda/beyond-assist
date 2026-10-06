"use client";

import { Fragment } from "react";

/**
 * Mostra a explicação da IA: títulos (##), listas (- ou *), blocos de código (```), código em
 * linha (`x`) e negrito (**x**). Só isso, de propósito.
 *
 * Sem biblioteca de Markdown e sem `dangerouslySetInnerHTML`: o texto vem de um modelo, e
 * montar os elementos à mão garante que nada nele vire HTML de verdade na página.
 */
export function emLinha(texto) {
  return texto.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((pedaco, i) => {
    if (/^`[^`]+`$/.test(pedaco)) return <code key={i}>{pedaco.slice(1, -1)}</code>;
    if (/^\*\*[^*]+\*\*$/.test(pedaco)) return <strong key={i}>{pedaco.slice(2, -2)}</strong>;
    return <Fragment key={i}>{pedaco}</Fragment>;
  });
}

export function blocosDe(texto) {
  const blocos = [];
  let codigo = null;
  let lista = null;
  const fecharLista = () => {
    if (lista) blocos.push({ tipo: "lista", itens: lista });
    lista = null;
  };

  for (const linha of String(texto || "").split("\n")) {
    if (/^\s*```/.test(linha)) {
      if (codigo) {
        blocos.push({ tipo: "codigo", texto: codigo.join("\n") });
        codigo = null;
      } else {
        fecharLista();
        codigo = [];
      }
      continue;
    }
    if (codigo) {
      codigo.push(linha);
      continue;
    }
    const titulo = /^\s*#{1,4}\s+(.*)$/.exec(linha);
    const item = /^\s*(?:[-*]|\d+[.)])\s+(.*)$/.exec(linha);
    if (titulo) {
      fecharLista();
      blocos.push({ tipo: "titulo", texto: titulo[1] });
    } else if (item) {
      (lista ||= []).push(item[1]);
    } else if (linha.trim()) {
      fecharLista();
      blocos.push({ tipo: "paragrafo", texto: linha.trim() });
    } else {
      fecharLista();
    }
  }
  if (codigo) blocos.push({ tipo: "codigo", texto: codigo.join("\n") });
  fecharLista();
  return blocos;
}

export default function Explicacao({ texto, className = "pf-explicacao" }) {
  return (
    <div className={className}>
      {blocosDe(texto).map((b, i) => {
        if (b.tipo === "titulo") return <h3 key={i}>{emLinha(b.texto)}</h3>;
        if (b.tipo === "codigo") return <pre key={i}><code>{b.texto}</code></pre>;
        if (b.tipo === "lista") return <ul key={i}>{b.itens.map((t, j) => <li key={j}>{emLinha(t)}</li>)}</ul>;
        return <p key={i}>{emLinha(b.texto)}</p>;
      })}
    </div>
  );
}
