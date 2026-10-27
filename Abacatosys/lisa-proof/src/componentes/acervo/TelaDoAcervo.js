"use client";

// A TELA DA BIBLIOTECA COLABORATIVA (26/10/2026). Redesenhada no mesmo dia ("melhore a interface
// muito mesmo"): o mundo 3D grande no alto, com um painel flutuante do nível; uma faixa com as
// quatro construções (o nível de cada uma, a barra até o próximo e quanto vale agora); e o acervo em
// PRATELEIRAS, como numa loja de filmes — "Chegaram agora" e uma prateleira por tipo — com cartões de
// capa grande. Procurando ou filtrando, as prateleiras viram uma grade. Clicar num cartão abre a
// FICHA do material (capa, quem trouxe, as ações e a gorjeta).
//
// Ler um PDF do acervo é "levar para a minha biblioteca": o livro entra na estante da pessoa
// apontando para o mesmo arquivo e abre no leitor de sempre. Vídeo: assistir aqui mesmo ou no MODO
// CINEMA (SalaDeCinema.js), uma sala 3D com a turma da biblioteca nas poltronas. Artigo por link
// abre na fonte.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { obter, criar, remover } from "@/lib/api.js";
import Neuro, { reagir, comemorar } from "@/componentes/Neuro.js";
import { useAviso } from "@/componentes/Pecas.js";
import { formatarMoedas } from "@/dominio/moedas.js";
import { formatarTamanho } from "@/dominio/biblioteca.js";
import {
  TIPOS_DE_MATERIAL, ORDEM_DOS_TIPOS, CONSTRUCOES_DO_ACERVO, CATEGORIAS_DO_ACERVO, LIMITES_DO_ACERVO,
  NIVEIS_DA_BIBLIOTECA, NIVEIS_DA_CONSTRUCAO, videoDoLink, linkValido,
} from "@/dominio/acervo.js";
import { abrirPdf, sumarioDoPdf, metadadosDoPdf, capaDoPdf, enviarTextoDoLivro, enviarArquivo } from "@/componentes/biblioteca/pdf.js";
import { urlDoFuncionario } from "./personagensDoAcervo.js";

const MundoDaBiblioteca = dynamic(() => import("./MundoDaBiblioteca.js"), { ssr: false, loading: () => <div className="ac-mundo ac-mundo--carregando">Abrindo os portões da biblioteca…</div> });
const SalaDeCinema = dynamic(() => import("./SalaDeCinema.js"), { ssr: false, loading: () => <div className="ac-cinema ac-cinema--carregando">🎬 Preparando a sala…</div> });

const moedas = (n) => `🪙 ${formatarMoedas(n)}`;
const STATUS = { pendente: "na fila do bibliotecário", aprovado: "no acervo", recusado: "recusado", retirado: "retirado do acervo", enviando: "envio incompleto" };
const ORDENS = { recentes: "Mais recentes", agradecidos: "Mais agradecidos", nome: "A–Z" };
const CORES_DAS_INICIAIS = ["#7c3aed", "#0891b2", "#16a34a", "#ea580c", "#db2777", "#2563eb", "#ca8a04"];
const corDe = (s) => CORES_DAS_INICIAIS[[...String(s)].reduce((a, c) => a + c.codePointAt(0), 0) % CORES_DAS_INICIAIS.length];

/** A fração do caminho até o próximo nível (0 a 1) numa escada de limites. */
function progresso(escada, qtd, nivel) {
  const de = escada[nivel - 1] ?? 0, ate = escada[nivel];
  return ate == null ? 1 : Math.min(1, Math.max(0, (qtd - de) / (ate - de)));
}

/** O SHA-256 do arquivo (acusa o mesmo PDF mandado de novo). */
async function hashDe(buffer) {
  const h = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Uma imagem escolhida pela pessoa vira a capa: JPEG pequeno (cabe no banco). */
function capaDaImagem(arquivo) {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => {
      const largura = 240, escala = largura / img.width;
      const c = document.createElement("canvas");
      c.width = largura;
      c.height = Math.round(img.height * escala);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      for (const q of [0.8, 0.6, 0.45]) {
        const url = c.toDataURL("image/jpeg", q);
        if (url.length <= 150_000) { URL.revokeObjectURL(img.src); return ok(url); }
      }
      return falha(new Error("a imagem da capa ficou grande demais"));
    };
    img.onerror = () => falha(new Error("não consegui abrir a imagem da capa"));
    img.src = URL.createObjectURL(arquivo);
  });
}

// ---------------------------------------------------------------- peças

/** A capa: a imagem guardada; o vídeo com a miniatura sobre ela mesma desfocada; ou o ícone do tipo. */
function Capa({ m, fonte: fonteDada, grande = false }) {
  const [falhou, setFalhou] = useState(false);
  const fonte = fonteDada ?? (m.video?.miniatura || (m.id ? `/api/acervo/${m.id}/capa` : null));
  const classe = `ac-capa ac-capa--${m.tipo}${grande ? " ac-capa--grande" : ""}`;
  if (!fonte || falhou) return <span className={classe} aria-hidden="true"><span className="ac-capa__icone">{TIPOS_DE_MATERIAL[m.tipo].icone}</span></span>;
  if (m.video || TIPOS_DE_MATERIAL[m.tipo].formato === "video") {
    return (
      <span className={`${classe} ac-capa--filme`}>
        <img className="ac-capa__fundo" src={fonte} alt="" aria-hidden="true" loading="lazy" />
        <img className="ac-capa__miniatura" src={fonte} alt="" loading="lazy" onError={() => setFalhou(true)} />
        <span className="ac-capa__play" aria-hidden="true">▶</span>
      </span>
    );
  }
  return <span className={classe}><img src={fonte} alt="" loading="lazy" onError={() => setFalhou(true)} /></span>;
}

/** A bolinha com a inicial de quem trouxe (leve: na grade não vai um Neuro por cartão). */
const Inicial = ({ nome }) => <span className="ac-inicial" style={{ background: corDe(nome) }} aria-hidden="true">{String(nome || "?").trim()[0]?.toUpperCase()}</span>;

/** O cartão de um material (prateleira, grade e a prévia do envio). */
function Cartao({ m, aoAbrir, previa = false }) {
  const t = TIPOS_DE_MATERIAL[m.tipo];
  const Corpo = previa ? "div" : "button";
  return (
    <Corpo {...(previa ? {} : { type: "button", onClick: () => aoAbrir(m) })} className={`ac-cartao ac-cartao--${m.tipo}${previa ? " ac-cartao--previa" : ""}`} aria-label={previa ? undefined : `${t.nome}: ${m.titulo}`}>
      <span className="ac-cartao__capa">
        <Capa m={m} fonte={previa ? m.capaDaPrevia || m.video?.miniatura || null : undefined} />
        <span className="ac-cartao__selo">{t.icone} {t.nome}</span>
        {m.naMinhaBiblioteca && <span className="ac-cartao__estante">📖 na estante</span>}
      </span>
      <span className="ac-cartao__corpo">
        <strong className="ac-cartao__titulo">{m.titulo || "Nome do material"}</strong>
        <span className="ac-cartao__autores">{m.autores || (previa ? "autor" : "")}</span>
        <span className="ac-cartao__pe">
          <span className="ac-cartao__categoria">{m.categoria || "categoria"}</span>
          {m.gorjetas?.quantos > 0 && <span className="ac-cartao__gratidao" title={`${m.gorjetas.quantos} agradecimento(s)`}>🙏 {m.gorjetas.quantos}</span>}
        </span>
        {m.autor && <span className="ac-cartao__quem"><Inicial nome={m.autor.nome} /> {m.meu ? "você trouxe" : m.autor.nome}</span>}
      </span>
    </Corpo>
  );
}

/** Uma prateleira: o título, quantos são, "ver tudo" e os cartões rolando para o lado. */
function Prateleira({ titulo, icone, lista, aoAbrir, aoVerTudo, total }) {
  if (!lista.length) return null;
  return (
    <section className="ac-prateleira" aria-label={titulo}>
      <div className="ac-prateleira__topo">
        <h3><span aria-hidden="true">{icone}</span> {titulo} <small>{total ?? lista.length}</small></h3>
        {aoVerTudo && <button type="button" onClick={aoVerTudo}>Ver tudo →</button>}
      </div>
      <ul className="ac-prateleira__fila">
        {lista.map((m) => <li key={m.id}><Cartao m={m} aoAbrir={aoAbrir} /></li>)}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- a tela

export default function TelaDoAcervo() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("acervo");
  const [semMundo, setSemMundo] = useState(false);
  const [filtro, setFiltro] = useState({ texto: "", tipo: "", categoria: "", autor: "", ordem: "recentes" });
  const [destaque, setDestaque] = useState(null); // { tipo: "contribuidor" | "funcionario", ... }
  const [aberto, setAberto] = useState(null);     // o material na ficha
  const [assistindo, setAssistindo] = useState(null);
  const [cinema, setCinema] = useState(null);
  const [levando, setLevando] = useState(null);   // { titulo, feitas, total }
  const [Aviso, avisar] = useAviso();
  const router = useRouter();
  const lista = useRef(null);

  const carregar = useCallback(() => obter("/api/acervo").then((d) => { setDados(d); setErro(""); }).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);

  const irParaOAcervo = () => requestAnimationFrame(() => lista.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  const escolherTipo = useCallback((tipo) => {
    setAba("acervo");
    setFiltro((f) => ({ ...f, tipo, autor: "" }));
    irParaOAcervo();
  }, []);
  const mostrarContribuidor = useCallback((id) => setDestaque({ tipo: "contribuidor", id }), []);
  const mostrarFuncionario = useCallback((tipo) => {
    const p = CONSTRUCOES_DO_ACERVO[tipo].personagem;
    setDestaque({ tipo: "funcionario", construcao: tipo, fala: p.falas[Math.floor(Math.random() * p.falas.length)] });
  }, []);
  const semWebGL = useCallback(() => setSemMundo(true), []);

  const filtrando = Boolean(filtro.texto.trim() || filtro.tipo || filtro.categoria || filtro.autor);
  const materiais = useMemo(() => {
    const t = filtro.texto.trim().toLowerCase();
    const l = (dados?.materiais || []).filter((m) => (!filtro.tipo || m.tipo === filtro.tipo) && (!filtro.categoria || m.categoria === filtro.categoria)
      && (!filtro.autor || m.autor.id === filtro.autor)
      && (!t || `${m.titulo} ${m.autores} ${m.assunto} ${m.descricao} ${m.autor.nome} ${m.categoria}`.toLowerCase().includes(t)));
    if (filtro.ordem === "agradecidos") l.sort((a, b) => b.gorjetas.quantos - a.gorjetas.quantos || b.gorjetas.moedas - a.gorjetas.moedas);
    if (filtro.ordem === "nome") l.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
    return l;
  }, [dados, filtro]);

  // o material da ficha acompanha os dados (depois de agradecer, por exemplo)
  const naFicha = aberto ? dados?.materiais.find((m) => m.id === aberto) : null;

  async function ler(m) {
    if (m.naMinhaBiblioteca) return router.push(`/biblioteca/${m.naMinhaBiblioteca}`);
    setLevando({ titulo: m.titulo, feitas: 0, total: m.paginas });
    let pdf = null;
    try {
      const r = await criar(`/api/acervo/${m.id}/levar`, {});
      if (r.endereco && r.livro.status !== "pronto") {
        pdf = await abrirPdf({ url: r.endereco });
        await enviarTextoDoLivro({ pdf, livroId: r.livro.id, enviar: criar, aoAvancar: (feitas, total) => setLevando({ titulo: m.titulo, feitas, total }) });
      }
      router.push(`/biblioteca/${r.livro.id}`);
    } catch (e) {
      avisar(e.message);
      setLevando(null);
    } finally {
      pdf?.destroy();
    }
    return undefined;
  }

  async function agradecer(m, valor) {
    try {
      const r = await criar(`/api/acervo/${m.id}/agradecer`, { moedas: valor });
      comemorar(`🙏 ${moedas(r.moedas)} para ${m.autor.nome}!`);
      carregar();
    } catch (e) {
      avisar(e.message);
    }
  }

  async function retirar(m) {
    const motivo = window.prompt(`Por que “${m.titulo}” sai do acervo? (quem trouxe vai ver o motivo)`);
    if (motivo == null) return;
    try {
      await criar(`/api/acervo/${m.id}/revisar`, { decisao: "retirar", motivo });
      avisar("Material retirado do acervo.");
      setAberto(null);
      carregar();
    } catch (e) {
      avisar(e.message);
    }
  }

  /** A plateia do cinema: você, quem trouxe o vídeo e a turma que frequenta a biblioteca. */
  function plateiaDe(m) {
    const eu = dados.eu;
    const lista = [{ id: "voce", nome: "Você", personagem: eu?.personagem || "neuro", papel: "voce" }];
    if (!m.meu) lista.push({ ...m.autor, papel: "autor" });
    for (const c of dados.contribuidores) {
      if (lista.length >= 16) break;
      if (c.id === eu?.id || c.id === m.autor.id) continue;
      lista.push({ id: c.id, nome: c.nome, personagem: c.personagem, papel: "frequentador" });
    }
    return lista;
  }
  const abrirCinema = (m) => { setAssistindo(null); setAberto(null); setCinema(m); };

  if (!dados) return <div className="pf-carregando">{erro || "Abrindo a Biblioteca Colaborativa…"}</div>;
  const b = dados.biblioteca;
  const contribuidor = destaque?.tipo === "contribuidor" ? dados.contribuidores.find((c) => c.id === destaque.id) : null;
  const abas = [
    ["acervo", "📚 Acervo", dados.materiais.length],
    ["trazer", "＋ Trazer material", null],
    ["meus", "📮 Meus envios", dados.meus.length || null],
    ...(dados.souBibliotecario ? [["mesa", "🔎 Mesa do bibliotecário", dados.fila.length || null]] : []),
  ];
  const recentes = [...dados.materiais].sort((a, c) => String(c.revisadoEm).localeCompare(String(a.revisadoEm))).slice(0, 12);

  return (
    <div className="ac">
      <header className="ac-topo">
        <div>
          <h1>Biblioteca Colaborativa</h1>
          <p>Traga livros, artigos e vídeos para todos: o bibliotecário confere, você ganha moedas e a biblioteca cresce.</p>
        </div>
        <div className="ac-topo__acoes">
          <span className="ac-saldo" title="as suas moedas do Reino">{moedas(dados.saldo)}</span>
          <button type="button" className="pf-botao" onClick={() => { setAba("trazer"); irParaOAcervo(); }}>＋ Trazer material</button>
        </div>
      </header>

      {semMundo ? (
        <div className="ac-plano">
          {ORDEM_DOS_TIPOS.map((t) => (
            <button key={t} type="button" className="ac-plano__predio" onClick={() => escolherTipo(t)}>
              <img src={urlDoFuncionario(CONSTRUCOES_DO_ACERVO[t].personagem.id)} alt="" width={72} height={72} />
              <strong>{CONSTRUCOES_DO_ACERVO[t].nome}</strong>
              <small>nível {b.construcoes[t].nivel}</small>
            </button>
          ))}
        </div>
      ) : (
        <section className="ac-heroi" aria-label="O mundo da biblioteca">
          <MundoDaBiblioteca estado={b} contribuidores={dados.contribuidores} aoEscolher={escolherTipo} aoContribuidor={mostrarContribuidor} aoFuncionario={mostrarFuncionario} aoFalhar={semWebGL} />
          <div className="ac-hud">
            <span className="ac-hud__numero" aria-hidden="true">{b.nivel}</span>
            <div>
              <strong>Biblioteca nível {b.nivel}</strong>
              <small>{b.total} {b.total === 1 ? "material" : "materiais"}{b.proximo != null ? ` · faltam ${b.faltam} para o nível ${b.nivel + 1}` : " · nível máximo"}</small>
              <span className="ac-barra"><i style={{ width: `${progresso(NIVEIS_DA_BIBLIOTECA, b.total, b.nivel) * 100}%` }} /></span>
            </div>
          </div>
          <p className="ac-heroi__dica">Arraste para girar · clique numa construção, num funcionário ou em quem anda pela ilha</p>
          {destaque && (
            <div className="ac-balao" role="status">
              <button type="button" className="ac-balao__fechar" onClick={() => setDestaque(null)} aria-label="Fechar">✕</button>
              {destaque.tipo === "funcionario" && (() => {
                const c = CONSTRUCOES_DO_ACERVO[destaque.construcao];
                return (
                  <div className="ac-balao__corpo">
                    <img src={urlDoFuncionario(c.personagem.id)} alt="" width={84} height={84} />
                    <div>
                      <strong>{c.personagem.nome}, {c.personagem.cargo}</strong>
                      <small>{c.nome} · nível {b.construcoes[destaque.construcao].nivel}</small>
                      <q>{destaque.fala}</q>
                      <button type="button" className="pf-botao pf-botao--pequeno" onClick={() => { escolherTipo(destaque.construcao); setDestaque(null); }}>
                        Ver {TIPOS_DE_MATERIAL[destaque.construcao].plural.toLowerCase()}
                      </button>
                    </div>
                  </div>
                );
              })()}
              {contribuidor && (
                <div className="ac-balao__corpo">
                  <Neuro personagem={contribuidor.personagem} humor="feliz" tamanho={84} />
                  <div>
                    <strong>{contribuidor.nome}</strong>
                    <small>trouxe {contribuidor.total} {contribuidor.total === 1 ? "material" : "materiais"}{contribuidor.gorjetas ? ` · ganhou ${moedas(contribuidor.gorjetas)} em agradecimentos` : ""}</small>
                    <span className="ac-balao__tipos">
                      {ORDEM_DOS_TIPOS.filter((t) => contribuidor.porTipo[t]).map((t) => <span key={t}>{TIPOS_DE_MATERIAL[t].icone} {contribuidor.porTipo[t]}</span>)}
                    </span>
                    {contribuidor.ultimo && <q>O último foi “{contribuidor.ultimo.titulo}”.</q>}
                    <button type="button" className="pf-botao pf-botao--pequeno" onClick={() => { setAba("acervo"); setFiltro((f) => ({ ...f, texto: "", tipo: "", categoria: "", autor: contribuidor.id })); setDestaque(null); irParaOAcervo(); }}>
                      Ver o que trouxe
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <ul className="ac-predios" aria-label="As construções da biblioteca">
        {ORDEM_DOS_TIPOS.map((t) => {
          const c = b.construcoes[t];
          const p = CONSTRUCOES_DO_ACERVO[t];
          return (
            <li key={t}>
              <button type="button" className={`ac-predio ac-predio--${t}`} onClick={() => escolherTipo(t)} aria-pressed={filtro.tipo === t}>
                <img src={urlDoFuncionario(p.personagem.id)} alt="" width={56} height={56} />
                <span className="ac-predio__texto">
                  <strong>{p.nome}</strong>
                  <small>{TIPOS_DE_MATERIAL[t].plural} · {c.qtd} no acervo</small>
                  <span className="ac-predio__nivel">
                    <b>nv {c.nivel}</b>
                    <span className="ac-barra"><i style={{ width: `${progresso(NIVEIS_DA_CONSTRUCAO, c.qtd, c.nivel) * 100}%` }} /></span>
                  </span>
                </span>
                <span className="ac-predio__premio" title="o que um material aprovado deste tipo vale agora">{moedas(b.recompensas[t])}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="ac-bibliotecarios">
        🔎 Bibliotecários: {dados.bibliotecarios.map((x) => `${x.nome}${x.lider ? " (líder da semana)" : ""}`).join(" e ") || "—"} · cada nível da biblioteca aumenta as recompensas em 10%.
      </p>

      <div ref={lista} className="ac-abas" role="tablist" aria-label="Biblioteca Colaborativa">
        {abas.map(([id, rotulo, n]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} className={aba === id ? "ac-aba ac-aba--atual" : "ac-aba"} onClick={() => setAba(id)}>
            {rotulo}{n != null && <span className="ac-aba__n">{n}</span>}
          </button>
        ))}
      </div>

      {aba === "acervo" && (
        <section className="ac-catalogo" aria-label="Acervo">
          <div className="ac-ferramentas">
            <label className="ac-busca">
              <span aria-hidden="true">🔍</span>
              <input type="search" placeholder="Procurar por título, autor, assunto ou quem trouxe…" value={filtro.texto} onChange={(e) => setFiltro((f) => ({ ...f, texto: e.target.value }))} aria-label="Procurar no acervo" />
            </label>
            <select className="ac-seletor" value={filtro.categoria} onChange={(e) => setFiltro((f) => ({ ...f, categoria: e.target.value }))} aria-label="Categoria">
              <option value="">Todas as categorias</option>
              {CATEGORIAS_DO_ACERVO.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="ac-seletor" value={filtro.ordem} onChange={(e) => setFiltro((f) => ({ ...f, ordem: e.target.value }))} aria-label="Ordem">
              {Object.entries(ORDENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="ac-chips" role="group" aria-label="Tipo">
            <button type="button" aria-pressed={!filtro.tipo} onClick={() => setFiltro((f) => ({ ...f, tipo: "" }))}>Tudo</button>
            {ORDEM_DOS_TIPOS.map((t) => (
              <button key={t} type="button" aria-pressed={filtro.tipo === t} onClick={() => setFiltro((f) => ({ ...f, tipo: f.tipo === t ? "" : t }))}>
                {TIPOS_DE_MATERIAL[t].icone} {TIPOS_DE_MATERIAL[t].plural} <small>{b.construcoes[t].qtd}</small>
              </button>
            ))}
          </div>
          {filtro.autor && (
            <p className="ac-filtro-autor">Mostrando o que <strong>{dados.materiais.find((m) => m.autor.id === filtro.autor)?.autor.nome}</strong> trouxe · <button type="button" onClick={() => setFiltro((f) => ({ ...f, autor: "" }))}>ver tudo</button></p>
          )}
          {!dados.materiais.length ? (
            <button type="button" className="ac-vazio" onClick={() => setAba("trazer")}>
              <span aria-hidden="true">🏛️</span>
              <strong>O acervo ainda está vazio</strong>
              <span>Seja a primeira pessoa a trazer um livro, um artigo ou um vídeo — e ganhe moedas quando o bibliotecário aprovar.</span>
            </button>
          ) : filtrando ? (
            materiais.length ? (
              <ul className="ac-grade">{materiais.map((m) => <li key={m.id}><Cartao m={m} aoAbrir={(x) => setAberto(x.id)} /></li>)}</ul>
            ) : <p className="pf-vazio">Nada encontrado com esses filtros.</p>
          ) : (
            <div className="ac-prateleiras">
              <Prateleira titulo="Chegaram agora" icone="✨" lista={recentes} aoAbrir={(x) => setAberto(x.id)} total={dados.materiais.length} />
              {ORDEM_DOS_TIPOS.map((t) => {
                const doTipo = materiais.filter((m) => m.tipo === t);
                return <Prateleira key={t} titulo={TIPOS_DE_MATERIAL[t].plural} icone={TIPOS_DE_MATERIAL[t].icone} lista={doTipo.slice(0, 16)} total={doTipo.length} aoAbrir={(x) => setAberto(x.id)} aoVerTudo={doTipo.length > 4 ? () => setFiltro((f) => ({ ...f, tipo: t })) : null} />;
              })}
            </div>
          )}
        </section>
      )}
      {aba === "trazer" && <Trazer dados={dados} avisar={avisar} aoEnviar={() => { carregar(); setAba("meus"); }} />}
      {aba === "meus" && <MeusEnvios meus={dados.meus} avisar={avisar} aoMudar={carregar} />}
      {aba === "mesa" && dados.souBibliotecario && <Mesa fila={dados.fila} dados={dados} avisar={avisar} aoMudar={carregar} aoAssistir={setAssistindo} />}

      {naFicha && (
        <Ficha m={naFicha} saldo={dados.saldo} gorjetas={dados.gorjetas} souBibliotecario={dados.souBibliotecario} aoFechar={() => setAberto(null)}
          aoLer={ler} aoAssistir={(m) => { setAberto(null); setAssistindo(m); }} aoCinema={abrirCinema} aoAgradecer={agradecer} aoRetirar={retirar}
          aoVerDoAutor={(id) => { setAberto(null); setFiltro((f) => ({ ...f, texto: "", tipo: "", categoria: "", autor: id })); }} />
      )}

      {assistindo && (
        <div className="ac-sala" role="dialog" aria-modal="true" aria-label={assistindo.titulo} onClick={(e) => { if (e.target === e.currentTarget) setAssistindo(null); }}>
          <div className="ac-sala__caixa">
            <div className="ac-sala__topo">
              <strong>{TIPOS_DE_MATERIAL[assistindo.tipo].icone} {assistindo.titulo}</strong>
              <div className="ac-sala__acoes">
                <button type="button" className="pf-botao pf-botao--pequeno" onClick={() => abrirCinema(assistindo)}>🎬 Modo cinema</button>
                <button type="button" className="ac-fechar" onClick={() => setAssistindo(null)} aria-label="Fechar">✕</button>
              </div>
            </div>
            <div className="ac-sala__video">
              <iframe src={`${assistindo.video.embed}${assistindo.video.plataforma === "youtube" ? "?rel=0" : ""}`} title={assistindo.titulo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
            </div>
            {assistindo.autores && <p className="ac-sala__autores">{assistindo.autores}</p>}
          </div>
        </div>
      )}
      {cinema && <SalaDeCinema material={cinema} plateia={plateiaDe(cinema)} aoSair={() => setCinema(null)} aoFalhar={() => { avisar("Este aparelho não abre a sala 3D — o vídeo abre normal."); setAssistindo(cinema); setCinema(null); }} />}
      {levando && (
        <div className="ac-sala" role="status">
          <div className="ac-sala__caixa ac-levando">
            <strong>📖 Preparando “{levando.titulo}” na sua biblioteca…</strong>
            <span>Guardando o texto das páginas para a busca e os cursos: {levando.feitas} de {levando.total}</span>
            <span className="ac-barra"><i style={{ width: `${levando.total ? Math.round((levando.feitas / levando.total) * 100) : 0}%` }} /></span>
          </div>
        </div>
      )}
      {Aviso}
    </div>
  );
}

// ---------------------------------------------------------------- a ficha do material

function Ficha({ m, saldo, gorjetas, souBibliotecario, aoFechar, aoLer, aoAssistir, aoCinema, aoAgradecer, aoRetirar, aoVerDoAutor }) {
  const t = TIPOS_DE_MATERIAL[m.tipo];
  const fechar = useRef(null);
  useEffect(() => {
    fechar.current?.focus({ preventScroll: true });
    const tecla = (e) => { if (e.key === "Escape") aoFechar(); };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aoFechar]);
  return (
    <div className="ac-ficha-fundo" role="dialog" aria-modal="true" aria-labelledby="ac-ficha-titulo" onClick={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <article className={`ac-ficha ac-ficha--${m.tipo}`}>
        <button ref={fechar} type="button" className="ac-fechar ac-ficha__fechar" onClick={aoFechar} aria-label="Fechar">✕</button>
        <div className="ac-ficha__capa"><Capa m={m} grande /></div>
        <div className="ac-ficha__info">
          <div className="ac-ficha__selos">
            <span className="ac-selo">{t.icone} {t.nome}</span>
            <span className="ac-selo">{m.categoria}</span>
            <span className="ac-selo">{m.assunto}</span>
          </div>
          <h2 id="ac-ficha-titulo">{m.titulo}</h2>
          {m.autores && <p className="ac-ficha__autores">{m.autores}</p>}
          {m.descricao && <p className="ac-ficha__descricao">{m.descricao}</p>}
          <dl className="ac-ficha__dados">
            {m.paginas > 0 && <div><dt>Páginas</dt><dd>{m.paginas}</dd></div>}
            {m.tamanho > 0 && <div><dt>Tamanho</dt><dd>{formatarTamanho(m.tamanho)}</dd></div>}
            {m.revisadoEm && <div><dt>No acervo desde</dt><dd>{new Date(m.revisadoEm).toLocaleDateString("pt-BR")}</dd></div>}
            <div><dt>Agradecimentos</dt><dd>🙏 {m.gorjetas.quantos}{m.gorjetas.moedas ? ` · ${moedas(m.gorjetas.moedas)}` : ""}</dd></div>
          </dl>
          <div className="ac-ficha__acoes">
            {m.temPdf && <button type="button" className="pf-botao" onClick={() => aoLer(m)}>{m.naMinhaBiblioteca ? "📖 Abrir na minha biblioteca" : "📖 Ler na minha biblioteca"}</button>}
            {m.video && <button type="button" className="pf-botao" onClick={() => aoCinema(m)}>🎬 Assistir no Modo cinema</button>}
            {m.video && <button type="button" className="pf-botao pf-botao--sec" onClick={() => aoAssistir(m)}>▶ Assistir aqui</button>}
            {m.link && !m.temPdf && <a className="pf-botao" href={m.link} target="_blank" rel="noopener noreferrer">🔗 Abrir o artigo</a>}
          </div>
          <div className="ac-ficha__quem">
            <Neuro personagem={m.autor.personagem} humor="feliz" tamanho={58} />
            <div>
              <small>trazido por</small>
              <strong>{m.meu ? "você" : m.autor.nome}</strong>
              <button type="button" onClick={() => aoVerDoAutor(m.autor.id)}>ver tudo o que trouxe →</button>
            </div>
            <div className="ac-ficha__gorjeta">
              {m.meu ? <small>Quando alguém agradecer, a gorjeta vem para você.</small>
                : m.agradeci ? <span className="ac-selo ac-selo--feito">🙏 você agradeceu</span>
                : saldo < Math.min(...gorjetas) ? <small>Sem moedas para agradecer agora.</small>
                : (
                  <>
                    <small>Agradecer com uma gorjeta:</small>
                    <span>{gorjetas.map((g) => <button key={g} type="button" disabled={g > saldo} onClick={() => aoAgradecer(m, g)}>{moedas(g)}</button>)}</span>
                  </>
                )}
            </div>
          </div>
          {souBibliotecario && <button type="button" className="ac-retirar" onClick={() => aoRetirar(m)}>Retirar do acervo</button>}
        </div>
      </article>
    </div>
  );
}

// ---------------------------------------------------------------- trazer material

const VAZIO = { tipo: "livro", titulo: "", autores: "", categoria: "", assunto: "", descricao: "", link: "", modoDoArtigo: "pdf" };

function Trazer({ dados, avisar, aoEnviar }) {
  const [f, setF] = useState(VAZIO);
  const [arquivo, setArquivo] = useState(null);       // o PDF escolhido
  const [leitura, setLeitura] = useState(null);       // { paginas, sumario, hash, capa } do PDF
  const [capaPropria, setCapaPropria] = useState(null);
  const [etapa, setEtapa] = useState(null);           // { texto, progresso }
  const def = TIPOS_DE_MATERIAL[f.tipo];
  const usaPdf = def.formato === "pdf" || (def.formato === "pdf-ou-link" && f.modoDoArtigo === "pdf");
  const video = def.formato === "video" ? videoDoLink(f.link) : null;
  const mudar = (campo, valor) => setF((x) => ({ ...x, [campo]: valor }));
  const restantes = Math.max(0, dados.envios.porDia - dados.envios.hoje);

  async function escolherPdf(a) {
    if (!a) return;
    if (!/pdf$/i.test(a.type) && !/\.pdf$/i.test(a.name)) return avisar("escolha um arquivo PDF");
    if (a.size > LIMITES_DO_ACERVO.arquivo) return avisar(`o PDF tem ${formatarTamanho(a.size)} — o limite é ${formatarTamanho(LIMITES_DO_ACERVO.arquivo)}`);
    setEtapa({ texto: "Lendo o PDF…" });
    let pdf = null;
    try {
      const buffer = await a.arrayBuffer();
      const hash = await hashDe(buffer);
      pdf = await abrirPdf({ data: buffer });
      const [meta, sumario, capa] = await Promise.all([metadadosDoPdf(pdf), sumarioDoPdf(pdf), capaDoPdf(pdf, 220)]);
      setArquivo(a);
      setLeitura({ paginas: pdf.numPages, sumario, hash, capa });
      setF((x) => ({ ...x, titulo: x.titulo || meta.titulo || a.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "), autores: x.autores || meta.autor || "" }));
    } catch (e) {
      avisar(`não consegui ler o PDF: ${e.message}`);
    } finally {
      pdf?.destroy();
      setEtapa(null);
    }
    return undefined;
  }

  async function escolherCapa(a) {
    if (!a) return;
    try { setCapaPropria(await capaDaImagem(a)); } catch (e) { avisar(e.message); }
  }

  async function enviar(e) {
    e.preventDefault();
    if (usaPdf && !arquivo) return avisar("escolha o PDF");
    let criado = null;
    try {
      setEtapa({ texto: "Conferindo…" });
      const corpo = {
        tipo: f.tipo, titulo: f.titulo, autores: f.autores, categoria: f.categoria, assunto: f.assunto, descricao: f.descricao,
        capa: capaPropria || (usaPdf ? leitura?.capa : null) || undefined,
        ...(usaPdf ? { pdf: { tamanho: arquivo.size, paginas: leitura.paginas, hash: leitura.hash, sumario: leitura.sumario } } : { link: f.link }),
      };
      const r = await criar("/api/acervo", corpo);
      criado = r.material;
      if (r.envio) {
        setEtapa({ texto: "Enviando o PDF…", progresso: 0 });
        await enviarArquivo(r.envio.url, arquivo, (p) => setEtapa({ texto: "Enviando o PDF…", progresso: p }));
        await criar(`/api/acervo/${criado.id}/enviado`, {});
      }
      comemorar(`📮 “${f.titulo}” foi para a fila do bibliotecário!`);
      setF(VAZIO); setArquivo(null); setLeitura(null); setCapaPropria(null);
      aoEnviar();
    } catch (erro) {
      if (criado?.status === "enviando") await remover(`/api/acervo/${criado.id}`).catch(() => {});
      avisar(erro.message);
    } finally {
      setEtapa(null);
    }
    return undefined;
  }

  const capaVista = capaPropria || (usaPdf ? leitura?.capa : null) || video?.miniatura || null;
  const previa = { tipo: f.tipo, titulo: f.titulo, autores: f.autores, categoria: f.categoria, video, capaDaPrevia: capaVista };
  return (
    <form className="ac-trazer" onSubmit={enviar}>
      <div className="ac-trazer__passo">
        <span className="ac-trazer__numero">1</span>
        <h3>O que você vai trazer?</h3>
      </div>
      <div className="ac-trazer__tipos" role="radiogroup" aria-label="O que você vai trazer">
        {ORDEM_DOS_TIPOS.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={f.tipo === t} className={f.tipo === t ? "ac-tipo ac-tipo--atual" : "ac-tipo"} onClick={() => mudar("tipo", t)}>
            <span aria-hidden="true">{TIPOS_DE_MATERIAL[t].icone}</span>
            <strong>{TIPOS_DE_MATERIAL[t].nome}</strong>
            <small>aprovado vale {moedas(dados.biblioteca.recompensas[t])}</small>
          </button>
        ))}
      </div>

      <div className="ac-trazer__grade">
        <div className="ac-trazer__campos">
          <div className="ac-trazer__passo">
            <span className="ac-trazer__numero">2</span>
            <h3>{usaPdf ? "O arquivo" : "O link"}</h3>
          </div>
          {def.formato === "pdf-ou-link" && (
            <div className="ac-chips" role="radiogroup" aria-label="O artigo vem como">
              <button type="button" role="radio" aria-checked={f.modoDoArtigo === "pdf"} aria-pressed={f.modoDoArtigo === "pdf"} onClick={() => mudar("modoDoArtigo", "pdf")}>📄 PDF</button>
              <button type="button" role="radio" aria-checked={f.modoDoArtigo === "link"} aria-pressed={f.modoDoArtigo === "link"} onClick={() => mudar("modoDoArtigo", "link")}>🔗 Link (DOI ou página)</button>
            </div>
          )}
          {usaPdf ? (
            <label className={`ac-arquivo${arquivo ? " ac-arquivo--ok" : ""}`}>
              <input type="file" accept="application/pdf,.pdf" onChange={(e) => { escolherPdf(e.target.files?.[0]); e.target.value = ""; }} />
              <span className="ac-arquivo__icone" aria-hidden="true">{arquivo ? "✅" : "📄"}</span>
              <span>{arquivo ? <><strong>{arquivo.name}</strong><small>{leitura?.paginas || "?"} páginas · {formatarTamanho(arquivo.size)} · clique para trocar</small></> : <><strong>Escolha o PDF</strong><small>até 50 MB · o nome, o autor e a capa vêm do arquivo</small></>}</span>
            </label>
          ) : (
            <label className="pf-campo">
              <span className="pf-campo__rotulo">{def.formato === "video" ? "Link do vídeo (YouTube ou Vimeo)" : "Link do artigo (DOI ou página)"}</span>
              <input className="pf-campo__entrada" type="url" inputMode="url" placeholder="https://" value={f.link} onChange={(e) => mudar("link", e.target.value)} required />
              {f.link && def.formato === "video" && !video && <small className="ac-erro">Esse link não é de um vídeo do YouTube ou do Vimeo.</small>}
              {f.link && def.formato !== "video" && !linkValido(f.link) && <small className="ac-erro">Esse link não parece válido.</small>}
            </label>
          )}
          <div className="ac-trazer__passo">
            <span className="ac-trazer__numero">3</span>
            <h3>Os detalhes</h3>
          </div>
          <label className="pf-campo">
            <span className="pf-campo__rotulo">Nome</span>
            <input className="pf-campo__entrada" value={f.titulo} maxLength={LIMITES_DO_ACERVO.titulo} onChange={(e) => mudar("titulo", e.target.value)} required minLength={3} />
          </label>
          <label className="pf-campo">
            <span className="pf-campo__rotulo">{f.tipo === "artigo" ? "Autores e revista" : def.formato === "video" ? "Canal ou professor" : "Autor(es)"}</span>
            <input className="pf-campo__entrada" value={f.autores} maxLength={LIMITES_DO_ACERVO.autores} onChange={(e) => mudar("autores", e.target.value)} />
          </label>
          <div className="ac-trazer__dupla">
            <label className="pf-campo">
              <span className="pf-campo__rotulo">Categoria</span>
              <select className="pf-campo__entrada" value={f.categoria} onChange={(e) => mudar("categoria", e.target.value)} required>
                <option value="">Escolha…</option>
                {CATEGORIAS_DO_ACERVO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="pf-campo">
              <span className="pf-campo__rotulo">Assunto</span>
              <input className="pf-campo__entrada" value={f.assunto} maxLength={LIMITES_DO_ACERVO.assunto} placeholder="ex.: álgebra linear" onChange={(e) => mudar("assunto", e.target.value)} required minLength={2} />
            </label>
          </div>
          <label className="pf-campo">
            <span className="pf-campo__rotulo">Por que vale a pena (opcional)</span>
            <textarea className="pf-campo__entrada" rows={3} maxLength={LIMITES_DO_ACERVO.descricao} value={f.descricao} onChange={(e) => mudar("descricao", e.target.value)} />
          </label>
        </div>

        <aside className="ac-trazer__previa" aria-label="Como vai aparecer no acervo">
          <span className="pf-campo__rotulo">Como vai aparecer</span>
          <Cartao m={previa} previa />
          {def.formato !== "video" && (
            <label className="ac-arquivo ac-arquivo--pequeno">
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { escolherCapa(e.target.files?.[0]); e.target.value = ""; }} />
              <span>🖼️ {capaPropria ? "Trocar a imagem da capa" : usaPdf ? "Usar outra capa (a padrão é a 1ª página)" : "Escolher uma capa"}</span>
            </label>
          )}
          {def.formato === "video" && <small className="ac-ajuda">A capa é a miniatura do vídeo.</small>}
          <small className="ac-ajuda">Aprovado, vale <strong>{moedas(dados.biblioteca.recompensas[f.tipo])}</strong> para você.</small>
        </aside>
      </div>

      <div className="ac-trazer__rodape">
        <small>{restantes > 0 ? `Você ainda pode mandar ${restantes} hoje.` : "Você já mandou o máximo de hoje — volte amanhã."} O bibliotecário confere antes de entrar no acervo.</small>
        <button type="submit" className="pf-botao" disabled={Boolean(etapa) || restantes === 0}>
          {etapa ? `${etapa.texto}${etapa.progresso != null ? ` ${Math.round(etapa.progresso * 100)}%` : ""}` : "📮 Mandar para o bibliotecário"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- meus envios

function MeusEnvios({ meus, avisar, aoMudar }) {
  async function desistir(m) {
    if (!window.confirm(`Tirar “${m.titulo}” ${m.status === "pendente" ? "da fila" : "da lista"}?`)) return;
    try { await remover(`/api/acervo/${m.id}`); aoMudar(); } catch (e) { avisar(e.message); }
  }
  if (!meus.length) return <p className="pf-vazio">Você ainda não trouxe nada. Que tal começar por aquele livro que te ajudou?</p>;
  return (
    <ul className="ac-meus">
      {meus.map((m) => (
        <li key={m.id} className={`ac-envio ac-envio--${m.status}`}>
          <Capa m={m} />
          <div>
            <strong>{m.titulo}</strong>
            <small>{TIPOS_DE_MATERIAL[m.tipo].icone} {TIPOS_DE_MATERIAL[m.tipo].nome} · enviado em {new Date(m.enviadoEm).toLocaleDateString("pt-BR")}</small>
            <span className={`ac-status ac-status--${m.status}`}>{STATUS[m.status]}{m.status === "aprovado" && m.recompensa ? ` · +${moedas(m.recompensa)}` : ""}</span>
            {m.motivo && <p className="ac-envio__motivo">Motivo: {m.motivo}</p>}
          </div>
          {(m.status === "pendente" || m.status === "recusado") && <button type="button" className="ac-retirar" onClick={() => desistir(m)}>{m.status === "pendente" ? "Desistir" : "Tirar da lista"}</button>}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- a mesa do bibliotecário

function Mesa({ fila, dados, avisar, aoMudar, aoAssistir }) {
  const [motivos, setMotivos] = useState({});
  const [ocupado, setOcupado] = useState(null);
  const sozinho = dados.bibliotecarios.length <= 1;

  async function espiar(m) {
    try {
      const r = await obter(`/api/acervo/${m.id}`);
      if (r.endereco) window.open(r.endereco, "_blank", "noopener");
    } catch (e) {
      avisar(e.message);
    }
  }
  async function decidir(m, decisao) {
    setOcupado(m.id);
    try {
      const r = await criar(`/api/acervo/${m.id}/revisar`, { decisao, motivo: motivos[m.id] || "" });
      if (decisao === "aprovar") comemorar(`✅ Aprovado! ${m.autor.nome} ganhou ${moedas(r.recompensa)}${r.pagamento ? ` e você ${moedas(r.pagamento)}` : ""}.`);
      else reagir("pensando", `Recusado. ${r.pagamento ? `+${moedas(r.pagamento)} pela revisão.` : ""}`, 4000);
      aoMudar();
    } catch (e) {
      avisar(e.message);
    } finally {
      setOcupado(null);
    }
  }
  if (!fila.length) return <p className="pf-vazio">A fila está vazia. Quando alguém trouxer um material, ele aparece aqui para você conferir.</p>;
  return (
    <ul className="ac-fila">
      <li className="ac-fila__regras">Confira se o material é o que diz ser, se está completo e se ajuda a estudar. Aprovando, quem trouxe ganha as moedas do tipo; você ganha {moedas(dados.pagamentoDaRevisao)} por revisão (menos nos seus próprios envios).</li>
      {fila.map((m) => {
        const proprio = m.meu && !sozinho;
        return (
          <li key={m.id} className="ac-revisao">
            <Capa m={m} />
            <div className="ac-revisao__info">
              <span className="ac-revisao__tipo">{TIPOS_DE_MATERIAL[m.tipo].icone} {TIPOS_DE_MATERIAL[m.tipo].nome} · {m.categoria} · {m.assunto}</span>
              <strong>{m.titulo}</strong>
              {m.autores && <span className="ac-revisao__autores">{m.autores}</span>}
              <span className="ac-revisao__quem">trazido por <strong>{m.autor.nome}</strong> em {new Date(m.enviadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
              {m.descricao && <p className="ac-revisao__descricao">{m.descricao}</p>}
              <div className="ac-revisao__ver">
                {m.temPdf && <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => espiar(m)}>📄 Espiar o PDF ({m.paginas} págs.)</button>}
                {m.video && <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => aoAssistir(m)}>▶ Ver o vídeo</button>}
                {m.link && !m.video && <a className="pf-botao pf-botao--sec pf-botao--pequeno" href={m.link} target="_blank" rel="noopener noreferrer">🔗 Abrir o link</a>}
              </div>
              {proprio ? <p className="ac-revisao__proprio">É o seu envio: fica para o outro bibliotecário.</p> : (
                <div className="ac-revisao__decisao">
                  <input className="pf-campo__entrada" placeholder="Motivo (obrigatório para recusar)" maxLength={LIMITES_DO_ACERVO.motivo} value={motivos[m.id] || ""} onChange={(e) => setMotivos((x) => ({ ...x, [m.id]: e.target.value }))} aria-label={`Motivo para ${m.titulo}`} />
                  <button type="button" className="pf-botao pf-botao--pequeno" disabled={ocupado === m.id} onClick={() => decidir(m, "aprovar")}>{ocupado === m.id ? "Revisando…" : `✅ Aprovar (+${moedas(dados.biblioteca.recompensas[m.tipo])})`}</button>
                  <button type="button" className="pf-botao pf-botao--perigo pf-botao--pequeno" disabled={ocupado === m.id || (motivos[m.id] || "").trim().length < 5} onClick={() => decidir(m, "recusar")}>Recusar</button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
