"use client";

import { Fragment } from "react";
import Codigo from "./codigo/Codigo.js";
import { chaveDaLinguagem } from "./codigo/linguagens.js";

/**
 * Mostra a explicação da IA: títulos (##), listas (- ou *), blocos de código (```), código em
 * linha (`x`) e negrito (**x**). Só isso, de propósito.
 *
 * Sem biblioteca de Markdown e sem `dangerouslySetInnerHTML`: o texto vem de um modelo, e
 * montar os elementos à mão garante que nada nele vire HTML de verdade na página.
 *
 * Os blocos de código saem coloridos e numerados (<Codigo>), na linguagem da cerca (```python).
 * `linguagem` é a de reserva, para cerca sem nome.
 */
export function emLinha(texto) {
  return texto.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((pedaco, i) => {
    if (/^`[^`]+`$/.test(pedaco)) return <code key={i}>{pedaco.slice(1, -1)}</code>;
    if (/^\*\*[^*]+\*\*$/.test(pedaco)) return <strong key={i}>{pedaco.slice(2, -2)}</strong>;
    return <Fragment key={i}>{pedaco}</Fragment>;
  });
}

// A cerca "```" começa uma linha, sempre. O modelo às vezes manda tudo grudado — "Analise o
// código: ```javascript let x = 1; console.log(x);``` O que sai?" — e antes isso aparecia na tela
// com as crases cruas, porque só se reconhecia a cerca no começo da linha (visto em 20/10/2026).
const NOME_DA_CERCA = /^([A-Za-z][\w#+.-]*)?[ \t]*(.*)$/;

export function blocosDe(texto) {
  const blocos = [];
  let codigo = null; // { linguagem, linhas }
  let lista = null;
  const fecharLista = () => {
    if (lista) blocos.push({ tipo: "lista", itens: lista });
    lista = null;
  };
  const fecharCodigo = () => {
    const corpo = codigo.linhas.join("\n").replace(/^\n+|\s+$/g, "");
    if (corpo) blocos.push({ tipo: "codigo", texto: corpo, linguagem: codigo.linguagem });
    codigo = null;
  };
  const linhaComum = (linha) => {
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
  };

  const linhas = String(texto || "").replace(/([^\n])```/g, "$1\n```").split("\n");
  for (const linha of linhas) {
    if (/^\s*```/.test(linha)) {
      const resto = linha.replace(/^\s*```/, "");
      if (codigo) {
        // cerca de fechamento; o que vier depois dela na mesma linha é texto comum
        fecharCodigo();
        if (resto.trim()) linhaComum(resto);
      } else {
        fecharLista();
        let [, linguagem = "", primeira = ""] = NOME_DA_CERCA.exec(resto.trim()) || [];
        // "``` let x = 1": sem nome de linguagem, a primeira palavra já é código
        if (primeira && !chaveDaLinguagem(linguagem)) { primeira = resto.trim(); linguagem = ""; }
        codigo = { linguagem, linhas: primeira ? [primeira] : [] };
      }
      continue;
    }
    if (codigo) {
      codigo.linhas.push(linha);
      continue;
    }
    linhaComum(linha);
  }
  if (codigo) fecharCodigo();
  fecharLista();
  return blocos;
}

export default function Explicacao({ texto, className = "pf-explicacao", linguagem = "" }) {
  return (
    <div className={className}>
      {blocosDe(texto).map((b, i) => {
        if (b.tipo === "titulo") return <h3 key={i}>{emLinha(b.texto)}</h3>;
        if (b.tipo === "codigo") return <Codigo key={i} texto={b.texto} linguagem={b.linguagem || linguagem} />;
        if (b.tipo === "lista") return <ul key={i}>{b.itens.map((t, j) => <li key={j}>{emLinha(t)}</li>)}</ul>;
        return <p key={i}>{emLinha(b.texto)}</p>;
      })}
    </div>
  );
}
