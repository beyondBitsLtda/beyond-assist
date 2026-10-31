"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { paragrafosDaPagina } from "@/dominio/biblioteca.js";
import { textoDaPagina } from "./pdf.js";

const DE_UMA_VEZ = 3; // páginas que entram a cada vez que a leitura chega perto do fim (ou do começo)

/**
 * O modo texto do leitor (31/10/2026, BEYOND-0007: "funcionar como um e-reader de qualidade faria").
 * No celular, a página do PDF fica pequena demais para ler; aqui o texto dela vira parágrafos numa
 * coluna de leitura (letra serifada, tamanho ajustável, o tema do leitor), em rolagem contínua: as
 * próximas páginas entram quando a leitura chega perto do fim. O texto sai do próprio PDF no
 * navegador (pdf.js), sem ida ao servidor. A página que está no alto da tela é a "página atual".
 */
export default function LeituraEmTexto({ pdf, total, inicial, tamanho, aoMudarPagina, aoTocar, rolagemRef }) {
  const [faixa, setFaixa] = useState({ de: inicial, ate: Math.min(total, inicial + DE_UMA_VEZ - 1) });
  const [textos, setTextos] = useState({}); // página → [parágrafos]; ausente = ainda carregando
  const caixa = useRef(null);
  const pedidas = useRef(new Set());
  const fila = useRef(Promise.resolve());
  const carregando = useRef(0);
  const montado = useRef(true);
  const ajusteDoTopo = useRef(null);
  const quadro = useRef(0);

  // montado de novo a cada montagem (o React de desenvolvimento monta, desmonta e monta outra vez)
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; cancelAnimationFrame(quadro.current); };
  }, []);

  // as páginas da faixa entram numa fila (uma de cada vez, na ordem); nada se perde se a faixa crescer no meio
  useEffect(() => {
    for (let n = faixa.de; n <= faixa.ate; n++) {
      if (pedidas.current.has(n)) continue;
      pedidas.current.add(n);
      carregando.current += 1;
      fila.current = fila.current.then(async () => {
        let paragrafos = [];
        try { paragrafos = paragrafosDaPagina(await textoDaPagina(pdf, n), n); } catch { /* fica vazia: o aviso diz para ver no modo página */ }
        carregando.current -= 1;
        if (montado.current) setTextos((t) => ({ ...t, [n]: paragrafos }));
      });
    }
  }, [faixa, pdf]);

  /** Perto do fim (menos de uma tela e meia): mais páginas. E a página no alto da tela vira a atual. */
  const conferir = useCallback(() => {
    const el = caixa.current;
    if (!el) return;
    if (!carregando.current && el.scrollTop + el.clientHeight > el.scrollHeight - el.clientHeight * 1.5) {
      setFaixa((f) => (f.ate >= total ? f : { ...f, ate: Math.min(total, f.ate + DE_UMA_VEZ) }));
    }
    const topo = el.getBoundingClientRect().top + 80;
    let atual = null;
    for (const s of el.querySelectorAll("[data-pagina]")) {
      if (s.getBoundingClientRect().top <= topo) atual = Number(s.dataset.pagina);
      else break;
    }
    aoMudarPagina(atual ?? faixa.de);
  }, [total, aoMudarPagina, faixa.de]);

  const aoRolar = () => {
    cancelAnimationFrame(quadro.current);
    quadro.current = requestAnimationFrame(conferir);
  };

  // página curta (ou que acabou de carregar) pode deixar a tela sem rolagem: confere de novo
  useEffect(() => { conferir(); }, [textos, conferir]);

  // páginas de antes entram em cima sem a leitura pular (a rolagem compensa a altura nova)
  useEffect(() => {
    const el = caixa.current;
    if (el && ajusteDoTopo.current != null) {
      el.scrollTop += el.scrollHeight - ajusteDoTopo.current;
      ajusteDoTopo.current = null;
    }
  }, [textos, faixa.de]);

  function paginasDeAntes() {
    if (caixa.current) ajusteDoTopo.current = caixa.current.scrollHeight;
    setFaixa((f) => ({ ...f, de: Math.max(1, f.de - DE_UMA_VEZ) }));
  }

  const numeros = [];
  for (let n = faixa.de; n <= faixa.ate; n++) numeros.push(n);
  return (
    <div
      ref={(el) => { caixa.current = el; if (rolagemRef) rolagemRef.current = el; }}
      className="lp-leitura" lang="pt-BR" onScroll={aoRolar} onPointerUp={aoTocar}
    >
      <div className="lp-leitura__coluna" style={{ fontSize: `${tamanho}px` }}>
        {faixa.de > 1 && (
          <button type="button" className="lp-leitura__antes" onClick={paginasDeAntes}>↑ Páginas anteriores</button>
        )}
        {numeros.map((n) => (
          <section key={n} className="lp-leitura__pagina" data-pagina={n} aria-label={`Página ${n}`}>
            <div className="lp-leitura__marca"><span>p. {n}</span></div>
            {textos[n] === undefined
              ? <p className="lp-leitura__vazia">Abrindo a página…</p>
              : textos[n].length
                ? textos[n].map((p, i) => <p key={i}>{p}</p>)
                : <p className="lp-leitura__vazia">Esta página não tem texto (uma figura, ou o PDF é escaneado). Veja no modo página.</p>}
          </section>
        ))}
        <div className="lp-leitura__fim">{faixa.ate >= total ? "Fim do livro." : ""}</div>
      </div>
    </div>
  );
}
