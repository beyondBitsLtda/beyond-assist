"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { obter, criar } from "@/lib/api.js";
import { TIPOS_DE_ALVO } from "@/dominio/cadernos.js";

/** Um alvo num chip: ícone, nome e o link para ele (se ainda existe). */
export function ChipDoAlvo({ alvo, aoTirar }) {
  const conteudo = (
    <>
      <span aria-hidden="true">{alvo.icone || TIPOS_DE_ALVO[alvo.tipo]?.icone}</span>
      <span className="cd-chip__texto">{alvo.rotulo}</span>
    </>
  );
  return (
    <span className={`cd-chip${alvo.existe === false ? " cd-chip--sumiu" : ""}`} title={alvo.existe === false ? "Este destino não existe mais" : alvo.rotulo}>
      {alvo.href ? <Link href={alvo.href} className="cd-chip__link">{conteudo}</Link> : <span className="cd-chip__link">{conteudo}</span>}
      {aoTirar && <button type="button" className="cd-chip__tirar" onClick={aoTirar} aria-label={`Desvincular ${alvo.rotulo}`}>×</button>}
    </span>
  );
}

const ABAS = [
  { chave: "trilhas", rotulo: "Trilhas e cursos" },
  { chave: "torres", rotulo: "Torres" },
  { chave: "livros", rotulo: "Livros" },
];

/**
 * Escolher a que vincular: uma trilha (ou um assunto dela), uma torre (ou um andar) ou um livro
 * (ou uma página dele). Devolve { tipo, id, numero } em `aoEscolher`.
 */
export function EscolherAlvo({ aoEscolher, aoCancelar, ocupado }) {
  const [alvos, setAlvos] = useState(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("trilhas");
  const [aberto, setAberto] = useState(null);
  const [pagina, setPagina] = useState("");

  useEffect(() => {
    obter("/api/vinculos/alvos").then(setAlvos).catch((e) => setErro(e.message));
  }, []);

  const lista = alvos?.[aba] || [];
  return (
    <div className="cd-escolher">
      <div className="cd-escolher__abas" role="tablist">
        {ABAS.map((a) => (
          <button key={a.chave} type="button" role="tab" aria-selected={aba === a.chave} className="cd-escolher__aba" onClick={() => { setAba(a.chave); setAberto(null); }}>
            {a.rotulo}{alvos ? ` (${alvos[a.chave].length})` : ""}
          </button>
        ))}
      </div>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      {!alvos && !erro && <p className="cd-escolher__vazio">Carregando…</p>}
      {alvos && !lista.length && (
        <p className="cd-escolher__vazio">
          {aba === "trilhas" ? "Você ainda não tem trilhas." : aba === "torres" ? "Você ainda não tem torres no Modo Domínio." : "A biblioteca está vazia."}
        </p>
      )}
      <ul className="cd-escolher__lista">
        {lista.map((item) => {
          const tipo = aba === "trilhas" ? "trilha" : aba === "torres" ? "torre" : "livro";
          const expandido = aberto === item.id;
          return (
            <li key={item.id} className="cd-escolher__item">
              <button type="button" className="cd-escolher__nome" aria-expanded={expandido} onClick={() => { setAberto(expandido ? null : item.id); setPagina(""); }}>
                <span aria-hidden="true">{TIPOS_DE_ALVO[tipo].icone}</span>
                <span>{item.nome}</span>
                {item.curso && <small className="pf-pilula">curso do livro</small>}
                {tipo === "livro" && <small>{item.paginas} págs.</small>}
                <span className="cd-escolher__seta" aria-hidden="true">{expandido ? "▾" : "▸"}</span>
              </button>
              {expandido && (
                <div className="cd-escolher__sub">
                  <button type="button" className="pf-botao pf-botao--pequeno" disabled={ocupado} onClick={() => aoEscolher({ tipo, id: item.id })}>
                    {tipo === "trilha" ? "Vincular à trilha inteira" : tipo === "torre" ? "Vincular à torre inteira" : "Vincular ao livro inteiro"}
                  </button>
                  {tipo === "trilha" && item.assuntos.length > 0 && (
                    <ul className="cd-escolher__filhos">
                      {item.assuntos.map((a) => (
                        <li key={a.id}><button type="button" disabled={ocupado} onClick={() => aoEscolher({ tipo: "assunto", id: a.id })}>📌 {a.nome}</button></li>
                      ))}
                    </ul>
                  )}
                  {tipo === "torre" && item.andares.length > 0 && (
                    <ul className="cd-escolher__filhos">
                      {item.andares.map((a) => (
                        <li key={a.numero}><button type="button" disabled={ocupado} onClick={() => aoEscolher({ tipo: "andar", id: item.id, numero: a.numero })}>⚔️ Andar {a.numero} · {a.nome}</button></li>
                      ))}
                    </ul>
                  )}
                  {tipo === "livro" && (
                    <form className="cd-escolher__pagina" onSubmit={(e) => { e.preventDefault(); if (pagina) aoEscolher({ tipo: "livro", id: item.id, numero: Number(pagina) }); }}>
                      <label>
                        <span>ou a página</span>
                        <input type="number" min={1} max={item.paginas} value={pagina} onChange={(e) => setPagina(e.target.value)} className="pf-campo__entrada" placeholder="45" />
                      </label>
                      <button type="submit" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={ocupado || !pagina}>Vincular à página</button>
                    </form>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {aoCancelar && <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={aoCancelar}>Cancelar</button>}
    </div>
  );
}

/**
 * As anotações ligadas a um ponto de estudo (trilha, assunto, torre, livro) e o "Anotar aqui", que
 * cria uma página já vinculada e abre o caderno nela. No assunto de um curso feito de um livro,
 * mostra também a leitura ("📖 Ler págs. 45–60").
 */
export function AnotacoesDoAlvo({ alvo, titulo = "Anotações", compacto = false, nomeDoAlvo }) {
  const router = useRouter();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [anotando, setAnotando] = useState(false);
  const [cadernos, setCadernos] = useState(null);
  const [escolhido, setEscolhido] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(() => {
    if (!alvo?.id) return;
    obter(`/api/vinculos?tipo=${alvo.tipo}&id=${alvo.id}`).then(setDados).catch((e) => setErro(e.message));
  }, [alvo?.tipo, alvo?.id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function abrirAnotar() {
    setAnotando((a) => !a);
    if (!cadernos) {
      try {
        const r = await obter("/api/cadernos");
        setCadernos(r.cadernos);
      } catch (e) {
        setErro(e.message);
      }
    }
  }

  async function anotar() {
    setOcupado(true);
    setErro("");
    try {
      const r = await criar("/api/anotar", { alvo, cadernoId: escolhido || null });
      router.push(r.href);
    } catch (e) {
      setErro(e.message);
      setOcupado(false);
    }
  }

  const anotacoes = dados?.anotacoes || [];
  const leitura = dados?.leitura;
  return (
    <section className={`cd-anotacoes${compacto ? " cd-anotacoes--compacto" : ""}`} aria-label={titulo}>
      <div className="cd-anotacoes__topo">
        <span className="cd-anotacoes__titulo">📓 {titulo}{anotacoes.length ? ` (${anotacoes.length})` : ""}</span>
        {leitura && (
          <Link className="cd-anotacoes__leitura" href={`/biblioteca/${leitura.livroId}?pagina=${leitura.de}`}>
            📖 Ler {leitura.de === leitura.ate ? `a pág. ${leitura.de}` : `as págs. ${leitura.de}–${leitura.ate}`} de “{leitura.livroTitulo}”
          </Link>
        )}
        <button type="button" className="cd-anotacoes__anotar" onClick={abrirAnotar} aria-expanded={anotando}>＋ Anotar aqui</button>
      </div>
      {anotacoes.length > 0 && (
        <ul className="cd-anotacoes__lista">
          {anotacoes.map((a) => (
            <li key={a.id}>
              <Link href={a.href} className="cd-anotacao">
                <span aria-hidden="true">{a.caderno?.icone || "📓"}</span>
                <span className="cd-anotacao__caderno">{a.caderno?.titulo || "Caderno"}</span>
                {a.pagina && <span className="cd-anotacao__pagina">› {a.pagina.titulo}</span>}
                {(alvo.tipo === "trilha" || alvo.tipo === "torre") && a.alvo.tipo !== alvo.tipo && a.alvo.nome !== a.pagina?.titulo && (
                  <small className="cd-anotacao__onde">{a.alvo.icone} {a.alvo.rotulo}</small>
                )}
                {alvo.tipo === "livro" && a.alvo.numero && <small className="cd-anotacao__onde">p. {a.alvo.numero}</small>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {anotando && (
        <div className="cd-anotacoes__nova">
          <label className="pf-campo">
            <span className="pf-campo__rotulo">Em qual caderno{nomeDoAlvo ? ` (sobre “${nomeDoAlvo}”)` : ""}?</span>
            <select className="pf-campo__entrada" value={escolhido} onChange={(e) => setEscolhido(e.target.value)} disabled={ocupado}>
              <option value="">＋ Um caderno novo</option>
              {(cadernos || []).map((c) => <option key={c.id} value={c.id}>{c.icone} {c.titulo}</option>)}
            </select>
          </label>
          <div className="pf-acoes">
            <button type="button" className="pf-botao pf-botao--pequeno" onClick={anotar} disabled={ocupado}>{ocupado ? "Criando a página…" : "Criar página e abrir"}</button>
            <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setAnotando(false)} disabled={ocupado}>Cancelar</button>
          </div>
        </div>
      )}
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
    </section>
  );
}
