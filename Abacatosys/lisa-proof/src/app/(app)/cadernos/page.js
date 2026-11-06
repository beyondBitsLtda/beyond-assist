"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { obter, criar } from "@/lib/api.js";
import { CORES_DO_CADERNO, ICONES_DO_CADERNO } from "@/dominio/cadernos.js";

const quando = (iso) => {
  const d = new Date(iso);
  const hoje = new Date();
  return d.toDateString() === hoje.toDateString()
    ? `hoje, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

/** A capa da apostila (06/11/2026): encadernada, com a lombada costurada e a faixa "Apostila" — não é caderno de arame. */
function CapaDaApostila({ c }) {
  return (
    <Link href={`/apostilas/${c.id}`} className={`cd-capa cd-capa--apostila cd-cor--${c.cor}`}>
      <span className="cd-capa__faixa"><span>Apostila</span><span aria-hidden="true">{c.icone}</span></span>
      <span className="cd-capa__tituloDaApostila">{c.titulo.replace(/^Apostila\s+—\s+/, "")}</span>
      {c.descricao && <span className="cd-capa__descricao">{c.descricao}</span>}
      <span className="cd-capa__pe">
        <span className="cd-capa__meta">{c.paginas} página{c.paginas === 1 ? "" : "s"} de aula</span>
        <span className="cd-capa__quando">feita {quando(c.criadoEm)}</span>
      </span>
    </Link>
  );
}

/**
 * Os cadernos (25/10/2026): uma estante de cadernos de anotação, cada um com módulos e páginas, e
 * cada um podendo ser ligado a trilhas, cursos, torres e livros. As apostilas (06/11/2026: a aula
 * completa de um assunto, pedida no modo aula da trilha) ficam numa categoria à parte, com a capa delas.
 */
export default function Cadernos() {
  const router = useRouter();
  const [cadernos, setCadernos] = useState(null);
  const [categoria, setCategoria] = useState("caderno");
  const [erro, setErro] = useState("");
  const [novo, setNovo] = useState(null); // null | { titulo, icone, cor }
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    // ?categoria=apostila (o link "Todas as apostilas" da trilha) abre direto nas apostilas
    if (new URLSearchParams(window.location.search).get("categoria") === "apostila") setCategoria("apostila");
    obter("/api/cadernos").then((r) => setCadernos(r.cadernos)).catch((e) => setErro(e.message));
  }, []);

  function escolherCategoria(c) {
    setCategoria(c);
    setNovo(null);
    window.history.replaceState(null, "", c === "apostila" ? "/cadernos?categoria=apostila" : "/cadernos");
  }

  const daCategoria = (cadernos || []).filter((c) => (c.categoria || "caderno") === categoria);
  const quantas = (c) => (cadernos || []).filter((x) => (x.categoria || "caderno") === c).length;

  async function criarCaderno(e) {
    e.preventDefault();
    setCriando(true);
    setErro("");
    try {
      const r = await criar("/api/cadernos", novo);
      router.push(`/cadernos/${r.caderno.id}`);
    } catch (falha) {
      setErro(falha.message);
      setCriando(false);
    }
  }

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>Cadernos</h1>
          <p>Anotações com cor de código, em módulos e páginas — ligadas às suas trilhas, cursos, torres e livros. E as apostilas: as aulas completas que a Lisa escreve.</p>
        </div>
        {categoria === "caderno" && (
          <button type="button" className="pf-botao" onClick={() => setNovo({ titulo: "", icone: ICONES_DO_CADERNO[0], cor: CORES_DO_CADERNO[0] })}>＋ Novo caderno</button>
        )}
      </div>

      <div className="cd-categorias" role="tablist" aria-label="Categoria">
        {[["caderno", "📓 Cadernos"], ["apostila", "📘 Apostilas"]].map(([c, rotulo]) => (
          <button key={c} type="button" role="tab" aria-selected={categoria === c} className="cd-categorias__aba" onClick={() => escolherCategoria(c)}>
            {rotulo}{cadernos ? <span className="cd-categorias__conta">{quantas(c)}</span> : null}
          </button>
        ))}
      </div>

      {erro && <div className="pf-aviso pf-aviso--erro" style={{ marginBottom: 12 }}>{erro}</div>}

      {novo && (
        <form className="pf-cartao cd-novo" onSubmit={criarCaderno}>
          <label className="pf-campo">
            <span className="pf-campo__rotulo">Nome do caderno</span>
            <input className="pf-campo__entrada" value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} maxLength={120}
              placeholder="Ex.: Estudos de JavaScript, Anotações do Clean Code" autoFocus required disabled={criando} />
          </label>
          <div className="pf-campo">
            <span className="pf-campo__rotulo">Ícone</span>
            <div className="cd-icones">{ICONES_DO_CADERNO.map((i) => <button key={i} type="button" aria-pressed={novo.icone === i} onClick={() => setNovo({ ...novo, icone: i })}>{i}</button>)}</div>
          </div>
          <div className="pf-campo">
            <span className="pf-campo__rotulo">Cor</span>
            <div className="cd-cores">{CORES_DO_CADERNO.map((c) => <button key={c} type="button" className={`cd-cor cd-cor--${c}`} aria-pressed={novo.cor === c} aria-label={c} onClick={() => setNovo({ ...novo, cor: c })} />)}</div>
          </div>
          <div className="pf-acoes">
            <button type="submit" className="pf-botao" disabled={criando || !novo.titulo.trim()}>{criando ? "Criando…" : "Criar e abrir"}</button>
            <button type="button" className="pf-botao pf-botao--sec" onClick={() => setNovo(null)} disabled={criando}>Cancelar</button>
          </div>
        </form>
      )}

      {!cadernos && !erro && <div className="pf-carregando">Abrindo a estante…</div>}
      {cadernos && categoria === "apostila" && !daCategoria.length && (
        <div className="pf-cartao cd-estante-vazia">
          <p className="cd-estante-vazia__icone" aria-hidden="true">📘</p>
          <h2>Nenhuma apostila ainda</h2>
          <p>A apostila é a aula completa de um assunto, escrita pela Lisa com todos os pontos do checklist de teoria. Na sua trilha, abra um assunto no mapa e toque em “🎓 Aula completa com a Lisa”.</p>
          <Link className="pf-botao" href="/trilhas">Ir para as trilhas</Link>
        </div>
      )}
      {cadernos && categoria === "caderno" && !daCategoria.length && !novo && (
        <div className="pf-cartao cd-estante-vazia">
          <p className="cd-estante-vazia__icone" aria-hidden="true">📓</p>
          <h2>Nenhum caderno ainda</h2>
          <p>Crie um caderno para anotar enquanto estuda: Markdown, código com cor, módulos e páginas. Dá para ligar cada página a um assunto da trilha, a um andar da torre ou à página de um livro.</p>
          <button type="button" className="pf-botao" onClick={() => setNovo({ titulo: "", icone: ICONES_DO_CADERNO[0], cor: CORES_DO_CADERNO[0] })}>＋ Criar o primeiro caderno</button>
        </div>
      )}
      {daCategoria.length > 0 && (
        <ul className="cd-estante">
          {daCategoria.map((c) => c.categoria === "apostila" ? (
            <li key={c.id}><CapaDaApostila c={c} /></li>
          ) : (
            <li key={c.id}>
              {/* o caderno de arame (03/11/2026): todos do mesmo tamanho, a capa na cor dele, a espiral e a etiqueta */}
              <Link href={`/cadernos/${c.id}`} className={`cd-capa cd-cor--${c.cor}`}>
                <span className="cd-capa__espiral" aria-hidden="true" />
                <span className="cd-capa__icone" aria-hidden="true">{c.icone}</span>
                <span className="cd-capa__etiqueta">
                  <span className="cd-capa__titulo">{c.titulo}</span>
                  {c.descricao && <span className="cd-capa__descricao">{c.descricao}</span>}
                </span>
                <span className="cd-capa__pe">
                  <span className="cd-capa__meta">
                    {c.paginas} página{c.paginas === 1 ? "" : "s"}{c.modulos ? ` · ${c.modulos} módulo${c.modulos === 1 ? "" : "s"}` : ""}
                    {c.vinculos ? ` · 🔗 ${c.vinculos}` : ""}
                  </span>
                  <span className="cd-capa__quando">editado {quando(c.atualizadoEm)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
