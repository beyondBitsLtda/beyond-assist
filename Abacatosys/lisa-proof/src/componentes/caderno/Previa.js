"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import Codigo from "../codigo/Codigo.js";
import { blocosDoMarkdown } from "@/dominio/markdown.js";

/** Os pedaços de uma linha (src/dominio/markdown.js) em elementos. */
function Linha({ pedacos }) {
  return pedacos.map((p, i) => {
    if (p.t === "texto") return <Fragment key={i}>{p.v}</Fragment>;
    if (p.t === "codigo") return <code key={i}>{p.v}</code>;
    if (p.t === "negrito") return <strong key={i}><Linha pedacos={p.filhos} /></strong>;
    if (p.t === "italico") return <em key={i}><Linha pedacos={p.filhos} /></em>;
    if (p.t === "riscado") return <del key={i}><Linha pedacos={p.filhos} /></del>;
    if (p.t === "link") {
      // caminho do próprio Proof navega sem recarregar; o resto abre em outra aba
      return p.href.startsWith("/")
        ? <Link key={i} href={p.href}><Linha pedacos={p.filhos} /></Link>
        : <a key={i} href={p.href} target="_blank" rel="noreferrer noopener"><Linha pedacos={p.filhos} /></a>;
    }
    return null;
  });
}

const comQuebras = (linhas) => linhas.map((l, i) => (
  <Fragment key={i}>{i > 0 && <br />}<Linha pedacos={l} /></Fragment>
));

/**
 * A prévia de uma página Markdown do caderno. Nada do texto vira HTML de verdade: os elementos são
 * montados um a um, e os blocos de código saem coloridos e numerados (<Codigo>).
 */
export default function Previa({ texto }) {
  const blocos = useMemo(() => blocosDoMarkdown(texto), [texto]);
  if (!blocos.length) return <div className="cd-previa cd-previa--vazia">Nada escrito ainda.</div>;
  return (
    <div className="cd-previa">
      {blocos.map((b, i) => {
        if (b.tipo === "titulo") {
          const H = `h${Math.min(b.nivel + 1, 6)}`;
          return <H key={i}><Linha pedacos={b.linha} /></H>;
        }
        if (b.tipo === "paragrafo") return <p key={i}>{comQuebras(b.linhas)}</p>;
        if (b.tipo === "citacao") return <blockquote key={i}>{comQuebras(b.linhas)}</blockquote>;
        if (b.tipo === "divisoria") return <hr key={i} />;
        if (b.tipo === "codigo") return <Codigo key={i} texto={b.texto} linguagem={b.linguagem} />;
        if (b.tipo === "lista") {
          const L = b.ordenada ? "ol" : "ul";
          return (
            <L key={i} className={b.itens.some((x) => x.tarefa !== null) ? "cd-previa__tarefas" : undefined}>
              {b.itens.map((item, j) => (
                <li key={j} className={item.recuo ? "cd-previa__recuo" : undefined}>
                  {item.tarefa !== null && <input type="checkbox" checked={item.tarefa} readOnly tabIndex={-1} aria-label={item.tarefa ? "feito" : "a fazer"} />}
                  <Linha pedacos={item.linha} />
                </li>
              ))}
            </L>
          );
        }
        if (b.tipo === "tabela") {
          return (
            <div key={i} className="cd-previa__tabela">
              <table>
                <thead><tr>{b.cabecalho.map((c, j) => <th key={j}><Linha pedacos={c} /></th>)}</tr></thead>
                <tbody>{b.linhas.map((l, j) => <tr key={j}>{l.map((c, k) => <td key={k}><Linha pedacos={c} /></td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
