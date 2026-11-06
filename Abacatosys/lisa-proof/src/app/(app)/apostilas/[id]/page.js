"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { obter } from "@/lib/api.js";
import Previa from "@/componentes/caderno/Previa.js";

/**
 * A apostila para ler (06/11/2026): a aula completa de um assunto, escrita pela Lisa, já renderizada —
 * o sumário de um lado e as páginas uma depois da outra, como uma apostila impressa. Para mudar o texto,
 * "Editar no caderno" abre o mesmo conteúdo no editor de cadernos.
 */
export default function Apostila() {
  const { id } = useParams();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [atual, setAtual] = useState(0);

  useEffect(() => {
    obter(`/api/apostilas/${id}`).then(setDados).catch((e) => setErro(e.message));
  }, [id]);

  // o sumário acompanha a leitura: a seção que está na tela fica marcada
  useEffect(() => {
    if (!dados?.paginas?.length || typeof IntersectionObserver === "undefined") return;
    const secoes = dados.paginas.map((_, i) => document.getElementById(`ap-${i}`)).filter(Boolean);
    const olho = new IntersectionObserver((vistas) => {
      const visivel = vistas.filter((v) => v.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visivel) setAtual(Number(visivel.target.dataset.indice));
    }, { rootMargin: "-15% 0px -70% 0px" });
    for (const s of secoes) olho.observe(s);
    return () => olho.disconnect();
  }, [dados]);

  if (!dados) return erro ? <div className="pf-aviso pf-aviso--erro">{erro}</div> : <div className="pf-carregando">Abrindo a apostila…</div>;

  const { caderno, paginas, origem } = dados;
  const titulo = caderno.titulo.replace(/^Apostila\s+—\s+/, "");
  const ir = (i) => (e) => {
    e.preventDefault();
    document.getElementById(`ap-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setAtual(i);
  };
  const sumario = (
    <ol className="ap-sumario__lista">
      {paginas.map((p, i) => (
        <li key={p.id}>
          <a href={`#ap-${i}`} onClick={ir(i)} aria-current={atual === i ? "true" : undefined}>{p.titulo}</a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className={`ap cd-cor--${caderno.cor}`}>
      <header className="ap-capa">
        <Link className="ap-capa__voltar" href="/cadernos?categoria=apostila">← Apostilas</Link>
        <span className="ap-capa__faixa">📘 Apostila</span>
        <h1 className="ap-capa__titulo">{titulo}</h1>
        <p className="ap-capa__meta">
          {origem?.tema ? <>{origem.tema} · </> : null}
          {origem?.assunto ? <>assunto <strong>{origem.assunto}</strong> · </> : null}
          {paginas.length} página{paginas.length === 1 ? "" : "s"} de aula
        </p>
        <div className="ap-capa__acoes">
          {origem?.href && <Link className="pf-botao pf-botao--pequeno" href={origem.href}>Voltar ao assunto</Link>}
          <Link className="pf-botao pf-botao--sec pf-botao--pequeno" href={`/cadernos/${caderno.id}`}>✏️ Editar no caderno</Link>
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => window.print()}>🖨️ Imprimir</button>
        </div>
      </header>

      {paginas.length === 0 ? (
        <div className="pf-cartao cd-estante-vazia"><p>Esta apostila está sem páginas. Abra no caderno para escrever, ou refaça a aula no assunto.</p></div>
      ) : (
        <div className="ap-corpo">
          <nav className="ap-sumario" aria-label="Sumário da apostila">
            <details className="ap-sumario__celular">
              <summary>📑 Sumário · {paginas[atual]?.titulo}</summary>
              {sumario}
            </details>
            <div className="ap-sumario__lado">
              <p className="ap-sumario__titulo">Sumário</p>
              {sumario}
            </div>
          </nav>
          <article className="ap-folhas">
            {paginas.map((p, i) => (
              <section key={p.id} id={`ap-${i}`} data-indice={i} className="ap-folha">
                <Previa texto={p.conteudo} />
                <div className="ap-folha__pe">
                  {i > 0 ? <a href={`#ap-${i - 1}`} onClick={ir(i - 1)}>← {paginas[i - 1].titulo}</a> : <span />}
                  {i < paginas.length - 1 ? <a href={`#ap-${i + 1}`} onClick={ir(i + 1)}>{paginas[i + 1].titulo} →</a> : <span>Fim da apostila ✓</span>}
                </div>
              </section>
            ))}
          </article>
        </div>
      )}
    </div>
  );
}
