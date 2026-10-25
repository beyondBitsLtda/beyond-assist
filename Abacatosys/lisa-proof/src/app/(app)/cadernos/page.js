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

/**
 * Os cadernos (25/10/2026): uma estante de cadernos de anotação, cada um com módulos e páginas, e
 * cada um podendo ser ligado a trilhas, cursos, torres e livros.
 */
export default function Cadernos() {
  const router = useRouter();
  const [cadernos, setCadernos] = useState(null);
  const [erro, setErro] = useState("");
  const [novo, setNovo] = useState(null); // null | { titulo, icone, cor }
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    obter("/api/cadernos").then((r) => setCadernos(r.cadernos)).catch((e) => setErro(e.message));
  }, []);

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
          <p>Anotações com cor de código, em módulos e páginas — ligadas às suas trilhas, cursos, torres e livros.</p>
        </div>
        <button type="button" className="pf-botao" onClick={() => setNovo({ titulo: "", icone: ICONES_DO_CADERNO[0], cor: CORES_DO_CADERNO[0] })}>＋ Novo caderno</button>
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
      {cadernos && !cadernos.length && !novo && (
        <div className="pf-cartao cd-estante-vazia">
          <p className="cd-estante-vazia__icone" aria-hidden="true">📓</p>
          <h2>Nenhum caderno ainda</h2>
          <p>Crie um caderno para anotar enquanto estuda: Markdown, código com cor, módulos e páginas. Dá para ligar cada página a um assunto da trilha, a um andar da torre ou à página de um livro.</p>
          <button type="button" className="pf-botao" onClick={() => setNovo({ titulo: "", icone: ICONES_DO_CADERNO[0], cor: CORES_DO_CADERNO[0] })}>＋ Criar o primeiro caderno</button>
        </div>
      )}
      {cadernos?.length > 0 && (
        <ul className="cd-estante">
          {cadernos.map((c) => (
            <li key={c.id}>
              <Link href={`/cadernos/${c.id}`} className={`cd-capa cd-cor--${c.cor}`}>
                <span className="cd-capa__icone" aria-hidden="true">{c.icone}</span>
                <span className="cd-capa__titulo">{c.titulo}</span>
                {c.descricao && <span className="cd-capa__descricao">{c.descricao}</span>}
                <span className="cd-capa__meta">
                  {c.paginas} página{c.paginas === 1 ? "" : "s"}{c.modulos ? ` · ${c.modulos} módulo${c.modulos === 1 ? "" : "s"}` : ""}
                  {c.vinculos ? ` · 🔗 ${c.vinculos}` : ""}
                </span>
                <span className="cd-capa__quando">editado {quando(c.atualizadoEm)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
