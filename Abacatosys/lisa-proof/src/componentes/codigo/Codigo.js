"use client";

import { useEffect, useState } from "react";
import { highlightCode, classHighlighter } from "@lezer/highlight";
import { carregarLinguagem, rotuloDaLinguagem } from "./linguagens.js";

/**
 * Código para LER: colorido pela linguagem, com o número de cada linha.
 *
 * Não é um editor (esse é o EditorDeCodigo): aqui o analisador da linguagem lê o texto uma vez e
 * devolve pedaços com classe (tok-keyword, tok-string...), que viram <span>. Nada do texto vira
 * HTML — ele entra como texto em cada span, então código com "<script>" aparece escrito, não roda.
 *
 * Antes da linguagem carregar (ou se ela for desconhecida), o código aparece sem cor — nunca
 * some. Foi o que motivou isto: uma pergunta do quiz dizia "observe o código abaixo" e não havia
 * código nenhum na tela.
 */
export default function Codigo({ texto, linguagem }) {
  const codigo = String(texto ?? "").replace(/\s+$/, "");
  const [linhas, setLinhas] = useState(() => semCor(codigo));

  useEffect(() => {
    let vivo = true;
    setLinhas(semCor(codigo));
    carregarLinguagem(linguagem).then((lang) => {
      if (!vivo || !lang) return;
      const parser = (lang.language || lang).parser;
      if (!parser) return;
      setLinhas(colorir(codigo, parser.parse(codigo)));
    });
    return () => { vivo = false; };
  }, [codigo, linguagem]);

  const rotulo = rotuloDaLinguagem(linguagem);
  return (
    <figure className="pf-codigo" data-linguagem={rotulo || undefined}>
      {rotulo && <figcaption className="pf-codigo__linguagem">{rotulo}</figcaption>}
      <pre className="pf-codigo__corpo" tabIndex={0}>
        <code>
          {linhas.map((pedacos, i) => (
            <span key={i} className="pf-codigo__linha">
              <span className="pf-codigo__numero" aria-hidden="true">{i + 1}</span>
              <span className="pf-codigo__texto">
                {pedacos.length ? pedacos.map((p, j) => (p.classe ? <span key={j} className={p.classe}>{p.texto}</span> : p.texto)) : " "}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}

function semCor(codigo) {
  return codigo.split("\n").map((l) => (l ? [{ texto: l, classe: "" }] : []));
}

function colorir(codigo, arvore) {
  const linhas = [[]];
  highlightCode(
    codigo,
    arvore,
    classHighlighter,
    (texto, classe) => linhas[linhas.length - 1].push({ texto, classe }),
    () => linhas.push([]),
  );
  return linhas;
}
