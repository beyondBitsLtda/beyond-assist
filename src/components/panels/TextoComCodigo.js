"use client";

// Uma resposta da Lisa no histórico da conversa: a fala normal e o código num bloco com realce de
// sintaxe, em vez das crases cruas. A resposta da vez também abre o editor que digita
// (IdeDaLisa.js); o histórico fica com o código parado, para reler e copiar.
//
// As linhas e os tokens levam classe "bb-": a camada de fonte dos painéis (globals.css, .bb-painel)
// troca a fonte de todo div/span SEM classe "bb-" — sem isso o código sairia em fonte proporcional.

import { Highlight } from "prism-react-renderer";
import { CY, OR, GR, PU } from "@/lib/theme.js";
import { trechosDaResposta } from "@/lib/codigoNaResposta.js";

/** As cores do código — as do próprio app (as mesmas do Modo Código), não a paleta do Prism. */
export const TEMA_DO_CODIGO = {
  plain: { color: "#cfeffb" },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "rgba(207,239,251,0.45)", fontStyle: "italic" } },
    { types: ["string", "attr-value", "char", "inserted"], style: { color: GR } },
    { types: ["keyword", "tag", "important", "atrule", "deleted"], style: { color: PU } },
    { types: ["function", "class-name", "selector"], style: { color: CY } },
    { types: ["number", "boolean", "constant", "regex", "symbol"], style: { color: OR } },
    { types: ["punctuation", "operator"], style: { color: "rgba(207,239,251,0.6)" } },
    { types: ["property", "attr-name"], style: { color: "rgba(207,239,251,0.85)" } },
    { types: ["variable", "parameter", "builtin"], style: { color: "#eafcff" } },
  ],
};

const FONTE_DO_CODIGO = "var(--bb-mono, 'JetBrains Mono', ui-monospace, monospace)";

/** As linhas de um código com realce (ou sem cor, se a linguagem não tem gramática). `fim`: o que vai no fim da última linha (o cursor do editor). */
export function LinhasDoCodigo({ codigo, linguagem, fim = null }) {
  if (!linguagem) {
    return <span className="bb-ide-linha" style={{ fontFamily: FONTE_DO_CODIGO }}>{codigo}{fim}</span>;
  }
  return (
    <Highlight code={codigo} language={linguagem} theme={TEMA_DO_CODIGO}>
      {({ tokens, getLineProps, getTokenProps }) => tokens.map((linha, i) => {
        const ultima = i === tokens.length - 1;
        // linha vazia: o Prism põe um "\n" nela, que empurraria o cursor uma linha para baixo
        const soCursor = ultima && fim && linha.every((t) => t.empty || t.content === "" || t.content === "\n");
        return (
          <div key={i} {...getLineProps({ line: linha, className: "bb-ide-linha", style: { fontFamily: FONTE_DO_CODIGO } })}>
            {soCursor ? fim : linha.map((token, ti) => <span key={ti} {...getTokenProps({ token, className: "bb-ide-token" })} />)}
            {ultima && !soCursor && fim}
          </div>
        );
      })}
    </Highlight>
  );
}

export default function TextoComCodigo({ texto }) {
  const { trechos, depois } = trechosDaResposta(texto);
  if (!trechos.length) return texto;
  return (
    <>
      {trechos.map((t, i) => (
        <span key={i}>
          {t.fala && <>{t.fala}{"\n"}</>}
          <span className="bb-ide-bloco" style={{
            display: "block", margin: "6px 0 8px", padding: "8px 10px", borderRadius: 8, overflowX: "auto",
            background: "#050b10", border: "1px solid rgba(var(--accent-rgb),0.18)", fontSize: 12, lineHeight: 1.55, whiteSpace: "pre",
          }}>
            <span className="bb-ide-arquivo" style={{ display: "block", fontSize: 10, color: PU, marginBottom: 4, fontFamily: FONTE_DO_CODIGO }}>{t.rotulo}</span>
            <LinhasDoCodigo codigo={t.codigo} linguagem={t.linguagem} />
          </span>
        </span>
      ))}
      {depois}
    </>
  );
}
