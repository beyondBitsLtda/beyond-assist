"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { obter, criar, remover } from "@/lib/api.js";
import { formatarTamanho, tituloDoArquivo, LIMITES_DA_BIBLIOTECA } from "@/dominio/biblioteca.js";
import { abrirPdf, sumarioDoPdf, metadadosDoPdf, capaDoPdf, enviarTextoDoLivro, enviarArquivo } from "@/componentes/biblioteca/pdf.js";
import Estante from "@/componentes/biblioteca/Estante.js";

const ETAPAS = { lendo: "Lendo o PDF", enviando: "Enviando", texto: "Guardando o texto", pronto: "Pronto", erro: "Falhou" };
const VISAO = "proof-biblioteca-visao";

/**
 * A biblioteca (25/10/2026): os PDFs da pessoa numa estante. Subir é escolher (ou arrastar) o
 * arquivo: o navegador lê o PDF, manda o arquivo direto para o armazenamento e guarda o texto de
 * cada página — é o texto que alimenta a busca e os cursos feitos a partir do livro.
 */
export default function Biblioteca() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [envios, setEnvios] = useState([]); // [{ chave, nome, etapa, progresso, erro, livroId }]
  const [arrastando, setArrastando] = useState(false);
  const [visao, setVisao] = useState("estante"); // estante (3D) | lista
  const entrada = useRef(null);
  const ocupado = envios.some((e) => e.etapa !== "pronto" && e.etapa !== "erro");

  useEffect(() => {
    try { if (localStorage.getItem(VISAO) === "lista") setVisao("lista"); } catch { /* sem armazenamento: estante */ }
  }, []);
  const mudarVisao = (v) => {
    setVisao(v);
    try { localStorage.setItem(VISAO, v); } catch { /* vale nesta visita */ }
  };

  const carregar = useCallback(() => obter("/api/biblioteca").then(setDados).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);

  const mudarEnvio = (chave, mudanca) => setEnvios((l) => l.map((e) => (e.chave === chave ? { ...e, ...mudanca } : e)));

  async function subir(arquivo) {
    const chave = `${arquivo.name}-${arquivo.size}-${Date.now()}`;
    setEnvios((l) => [...l, { chave, nome: arquivo.name, etapa: "lendo", progresso: 0 }]);
    let livroId = null;
    let pdf = null;
    try {
      if (!/pdf$/i.test(arquivo.type) && !/\.pdf$/i.test(arquivo.name)) throw new Error("não é um PDF");
      if (arquivo.size > LIMITES_DA_BIBLIOTECA.arquivo) throw new Error(`tem ${formatarTamanho(arquivo.size)} — o limite é ${formatarTamanho(LIMITES_DA_BIBLIOTECA.arquivo)}`);
      // o pdf.js fica com o buffer que recebe; o arquivo original segue inteiro para o envio
      pdf = await abrirPdf({ data: await arquivo.arrayBuffer() });
      const [meta, sumario, capa] = await Promise.all([metadadosDoPdf(pdf), sumarioDoPdf(pdf), capaDoPdf(pdf)]);
      const r = await criar("/api/biblioteca", {
        titulo: tituloDoArquivo(arquivo.name, meta.titulo), autor: meta.autor, tamanho: arquivo.size, paginas: pdf.numPages, sumario, capa,
      });
      livroId = r.livro.id;
      mudarEnvio(chave, { etapa: "enviando", livroId });
      await enviarArquivo(r.envio.url, arquivo, (p) => mudarEnvio(chave, { progresso: p }));
      await criar(`/api/biblioteca/${livroId}/enviado`, {});
      mudarEnvio(chave, { etapa: "texto", progresso: 0 });
      carregar();
      await enviarTextoDoLivro({ pdf, livroId, enviar: criar, aoAvancar: (n, total) => mudarEnvio(chave, { progresso: n / total }) });
      mudarEnvio(chave, { etapa: "pronto", progresso: 1 });
    } catch (e) {
      // o livro que nasceu sem arquivo não fica na estante como fantasma
      if (livroId) {
        const chegou = await obter(`/api/biblioteca/${livroId}`).then((x) => x.livro.status !== "enviando").catch(() => false);
        if (!chegou) await remover(`/api/biblioteca/${livroId}`).catch(() => {});
      }
      mudarEnvio(chave, { etapa: "erro", erro: e.message });
    } finally {
      pdf?.destroy();
      carregar();
    }
  }

  async function subirVarios(lista) {
    for (const arquivo of lista) await subir(arquivo); // um de cada vez: PDF grande ocupa a memória do navegador
  }

  async function apagar(livro) {
    if (!window.confirm(`Apagar “${livro.titulo}” da biblioteca, com as marcações? Cursos feitos dele continuam, sem o livro.`)) return;
    try {
      await remover(`/api/biblioteca/${livro.id}`);
      carregar();
    } catch (e) {
      setErro(e.message);
    }
  }

  const livros = dados?.livros || [];
  const espaco = dados?.espaco;
  return (
    <div
      className={`bb-biblioteca${arrastando ? " bb-biblioteca--arrastando" : ""}`}
      onDragOver={(e) => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); setArrastando(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setArrastando(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        const pdfs = [...e.dataTransfer.files].filter((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
        if (pdfs.length) subirVarios(pdfs);
      }}
    >
      <div className="pf-cabecalho">
        <div>
          <h1>Biblioteca</h1>
          <p>Seus livros em PDF: leia, marque, mande trechos para o caderno e gere cursos a partir deles.</p>
        </div>
        <div className="pf-acoes">
          <div className="bb-visao" role="group" aria-label="Como ver a biblioteca">
            <button type="button" aria-pressed={visao === "estante"} onClick={() => mudarVisao("estante")}>📚 Estante</button>
            <button type="button" aria-pressed={visao === "lista"} onClick={() => mudarVisao("lista")}>☰ Lista</button>
          </div>
          <input ref={entrada} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { const l = [...(e.target.files || [])]; e.target.value = ""; if (l.length) subirVarios(l); }} />
          <button type="button" className="pf-botao" onClick={() => entrada.current?.click()} disabled={ocupado}>＋ Subir PDF</button>
        </div>
      </div>

      {espaco && (
        <div className="bb-espaco" title={`${formatarTamanho(espaco.usado)} de ${formatarTamanho(espaco.total)}`}>
          <span>{formatarTamanho(espaco.usado)} de {formatarTamanho(espaco.total)} usados · até {formatarTamanho(espaco.arquivo)} por PDF</span>
          <span className="bb-espaco__barra"><i style={{ width: `${Math.min(100, (espaco.usado / espaco.total) * 100)}%` }} /></span>
        </div>
      )}
      {erro && <div className="pf-aviso pf-aviso--erro" style={{ marginBottom: 12 }}>{erro}</div>}

      {envios.length > 0 && (
        <ul className="bb-envios">
          {envios.map((e) => (
            <li key={e.chave} className={`bb-envio bb-envio--${e.etapa}`}>
              <span className="bb-envio__nome">📄 {e.nome}</span>
              <span className="bb-envio__etapa">{ETAPAS[e.etapa]}{e.etapa === "erro" ? `: ${e.erro}` : e.etapa !== "pronto" && e.progresso ? ` · ${Math.round(e.progresso * 100)}%` : ""}</span>
              {e.etapa !== "erro" && <span className="bb-envio__barra"><i style={{ width: `${e.etapa === "pronto" ? 100 : Math.round((e.progresso || 0) * 100)}%` }} /></span>}
              {e.etapa === "pronto" && e.livroId && <Link href={`/biblioteca/${e.livroId}`} className="bb-envio__abrir">Abrir</Link>}
              {(e.etapa === "pronto" || e.etapa === "erro") && <button type="button" className="bb-envio__tirar" onClick={() => setEnvios((l) => l.filter((x) => x.chave !== e.chave))} aria-label="Tirar da lista">×</button>}
            </li>
          ))}
        </ul>
      )}

      {!dados && !erro && <div className="pf-carregando">Arrumando a estante…</div>}
      {dados && visao === "estante" && (
        <Estante livros={livros} aoSubir={() => entrada.current?.click()} aoApagar={apagar} />
      )}
      {dados && visao === "lista" && !livros.length && !envios.length && (
        <button type="button" className="pf-cartao bb-vazia" onClick={() => entrada.current?.click()}>
          <span className="bb-vazia__icone" aria-hidden="true">📚</span>
          <strong>A estante está vazia</strong>
          <span>Clique aqui ou arraste um PDF para esta tela. Até {formatarTamanho(LIMITES_DA_BIBLIOTECA.arquivo)} por arquivo.</span>
        </button>
      )}

      {visao === "lista" && livros.length > 0 && (
        <ul className="bb-estante">
          {livros.map((l) => (
            <li key={l.id} className="bb-livro">
              <Link href={`/biblioteca/${l.id}`} className="bb-livro__capa" aria-label={`Abrir ${l.titulo}`}>
                {l.capa ? <img src={l.capa} alt="" loading="lazy" /> : <span className="bb-livro__lombada">{l.titulo}</span>}
                {l.progresso > 1 && <span className="bb-livro__progresso" style={{ width: `${l.progresso}%` }} aria-hidden="true" />}
              </Link>
              <div className="bb-livro__info">
                <Link href={`/biblioteca/${l.id}`} className="bb-livro__titulo">{l.titulo}</Link>
                {l.autor && <span className="bb-livro__autor">{l.autor}</span>}
                <span className="bb-livro__meta">
                  {l.paginas} págs. · {formatarTamanho(l.tamanho)}
                  {l.marcacoes ? ` · 🖍️ ${l.marcacoes}` : ""}
                  {l.progresso > 1 ? ` · ${l.progresso}% lido` : ""}
                </span>
                {l.status !== "pronto" && <span className="pf-pilula pf-pilula--atencao">{l.status === "enviando" ? "envio incompleto" : "texto incompleto — abra para terminar"}</span>}
                {l.status === "pronto" && !l.paginasComTexto && <span className="pf-pilula">PDF sem texto (escaneado)</span>}
                <div className="bb-livro__acoes">
                  <Link href={`/biblioteca/${l.id}`} className="pf-botao pf-botao--pequeno">{l.progresso > 1 ? "Continuar" : "Ler"}</Link>
                  {l.status === "pronto" && l.paginasComTexto > 0 && (
                    <Link href={`/trilhas/novo?livro=${l.id}`} className="pf-botao pf-botao--sec pf-botao--pequeno">🎓 Gerar curso</Link>
                  )}
                  <button type="button" className="bb-livro__apagar" onClick={() => apagar(l)} aria-label={`Apagar ${l.titulo}`} title="Apagar">🗑️</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {arrastando && <div className="bb-soltar" aria-hidden="true">Solte o PDF para subir 📥</div>}
    </div>
  );
}
