"use client";

// A TELA DA BIBLIOTECA COLABORATIVA (26/10/2026): o mundo 3D da ilha (MundoDaBiblioteca), a placa
// com o nível da biblioteca e as recompensas de agora, e as abas — o acervo (procurar, ler, assistir,
// agradecer), trazer material, os meus envios e, para o bibliotecário, a mesa de revisão.
//
// Ler um PDF do acervo é "levar para a minha biblioteca": o livro entra na estante da pessoa
// apontando para o mesmo arquivo (com as marcações, a busca e os cursos dela) e abre no leitor de
// sempre. Vídeo abre aqui mesmo; artigo por link abre na fonte.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { obter, criar, remover } from "@/lib/api.js";
import Neuro, { reagir, comemorar } from "@/componentes/Neuro.js";
import { useAviso } from "@/componentes/Pecas.js";
import { formatarMoedas } from "@/dominio/moedas.js";
import { formatarTamanho } from "@/dominio/biblioteca.js";
import {
  TIPOS_DE_MATERIAL, ORDEM_DOS_TIPOS, CONSTRUCOES_DO_ACERVO, CATEGORIAS_DO_ACERVO, LIMITES_DO_ACERVO, NIVEIS_DA_BIBLIOTECA, videoDoLink, linkValido,
} from "@/dominio/acervo.js";
import { abrirPdf, sumarioDoPdf, metadadosDoPdf, capaDoPdf, enviarTextoDoLivro, enviarArquivo } from "@/componentes/biblioteca/pdf.js";
import { urlDoFuncionario } from "./personagensDoAcervo.js";

const MundoDaBiblioteca = dynamic(() => import("./MundoDaBiblioteca.js"), { ssr: false, loading: () => <div className="ac-mundo ac-mundo--carregando">Abrindo os portões da biblioteca…</div> });

const moedas = (n) => `🪙 ${formatarMoedas(n)}`;
const STATUS = { pendente: "na fila do bibliotecário", aprovado: "no acervo", recusado: "recusado", retirado: "retirado do acervo", enviando: "envio incompleto" };

/** A capa de um material: a imagem guardada, a miniatura do YouTube ou o ícone do tipo. */
function Capa({ m }) {
  const [falhou, setFalhou] = useState(false);
  const fonte = m.video?.miniatura || `/api/acervo/${m.id}/capa`;
  if (falhou || (m.video && !m.video.miniatura)) return <span className={`ac-capa ac-capa--${m.tipo}`} aria-hidden="true"><span>{TIPOS_DE_MATERIAL[m.tipo].icone}</span></span>;
  return <span className={`ac-capa ac-capa--${m.tipo}`}><img src={fonte} alt="" loading="lazy" onError={() => setFalhou(true)} />{m.video && <span className="ac-capa__play" aria-hidden="true">▶</span>}</span>;
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

export default function TelaDoAcervo() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("acervo");
  const [semMundo, setSemMundo] = useState(false);
  const [filtro, setFiltro] = useState({ texto: "", tipo: "", categoria: "", autor: "" });
  const [destaque, setDestaque] = useState(null); // { tipo: "contribuidor" | "funcionario", ... }
  const [assistindo, setAssistindo] = useState(null);
  const [levando, setLevando] = useState(null); // { titulo, feitas, total }
  const [Aviso, avisar] = useAviso();
  const router = useRouter();
  const lista = useRef(null);

  const carregar = useCallback(() => obter("/api/acervo").then((d) => { setDados(d); setErro(""); }).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);

  const escolherTipo = useCallback((tipo) => {
    setAba("acervo");
    setFiltro((f) => ({ ...f, tipo, autor: "" }));
    requestAnimationFrame(() => lista.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);
  const mostrarContribuidor = useCallback((id) => setDestaque({ tipo: "contribuidor", id }), []);
  const mostrarFuncionario = useCallback((tipo) => {
    const p = CONSTRUCOES_DO_ACERVO[tipo].personagem;
    setDestaque({ tipo: "funcionario", construcao: tipo, fala: p.falas[Math.floor(Math.random() * p.falas.length)] });
  }, []);
  const semWebGL = useCallback(() => setSemMundo(true), []);

  const materiais = useMemo(() => {
    const t = filtro.texto.trim().toLowerCase();
    return (dados?.materiais || []).filter((m) => (!filtro.tipo || m.tipo === filtro.tipo) && (!filtro.categoria || m.categoria === filtro.categoria)
      && (!filtro.autor || m.autor.id === filtro.autor)
      && (!t || `${m.titulo} ${m.autores} ${m.assunto} ${m.descricao} ${m.autor.nome}`.toLowerCase().includes(t)));
  }, [dados, filtro]);

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
      carregar();
    } catch (e) {
      avisar(e.message);
    }
  }

  if (!dados) return <div className="pf-carregando">{erro || "Abrindo a Biblioteca Colaborativa…"}</div>;
  const b = dados.biblioteca;
  const contribuidor = destaque?.tipo === "contribuidor" ? dados.contribuidores.find((c) => c.id === destaque.id) : null;
  const abas = [
    ["acervo", `📚 Acervo (${dados.materiais.length})`],
    ["trazer", "＋ Trazer material"],
    ["meus", `📮 Meus envios${dados.meus.length ? ` (${dados.meus.length})` : ""}`],
    ...(dados.souBibliotecario ? [["mesa", `🔎 Mesa do bibliotecário${dados.fila.length ? ` (${dados.fila.length})` : ""}`]] : []),
  ];

  return (
    <div className="ac">
      <div className="pf-cabecalho">
        <div>
          <h1>Biblioteca Colaborativa</h1>
          <p>Traga livros, artigos e vídeos para todos. O bibliotecário confere, você ganha moedas, e a biblioteca cresce com cada material aprovado.</p>
        </div>
        <div className="pf-acoes">
          <span className="ac-saldo">{moedas(dados.saldo)}</span>
          <button type="button" className="pf-botao" onClick={() => setAba("trazer")}>＋ Trazer material</button>
        </div>
      </div>

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
        <div className="ac-palco">
          <MundoDaBiblioteca estado={b} contribuidores={dados.contribuidores} aoEscolher={escolherTipo} aoContribuidor={mostrarContribuidor} aoFuncionario={mostrarFuncionario} aoFalhar={semWebGL} />
          <p className="ac-palco__dica">Arraste para girar · clique numa construção, num funcionário ou em quem anda pela ilha</p>
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
                      <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => { escolherTipo(destaque.construcao); setDestaque(null); }}>
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
                    <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => { setAba("acervo"); setFiltro({ texto: "", tipo: "", categoria: "", autor: contribuidor.id }); setDestaque(null); requestAnimationFrame(() => lista.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }}>
                      Ver o que trouxe
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <section className="ac-placa" aria-label="A biblioteca">
        <div className="ac-placa__nivel">
          <span className="ac-placa__numero">{b.nivel}</span>
          <div>
            <strong>Biblioteca nível {b.nivel}</strong>
            <small>{b.total} {b.total === 1 ? "material" : "materiais"} no acervo{b.proximo != null ? ` · faltam ${b.faltam} para o nível ${b.nivel + 1}` : " · nível máximo"}</small>
            {b.proximo != null && <span className="ac-barra"><i style={{ width: `${Math.min(100, ((b.total - NIVEIS_DA_BIBLIOTECA[b.nivel - 1]) / (b.proximo - NIVEIS_DA_BIBLIOTECA[b.nivel - 1])) * 100)}%` }} /></span>}
          </div>
        </div>
        <ul className="ac-placa__construcoes">
          {ORDEM_DOS_TIPOS.map((t) => {
            const c = b.construcoes[t];
            return (
              <li key={t}>
                <button type="button" onClick={() => escolherTipo(t)} aria-pressed={filtro.tipo === t}>
                  <span className="ac-placa__icone" aria-hidden="true">{TIPOS_DE_MATERIAL[t].icone}</span>
                  <span><strong>{TIPOS_DE_MATERIAL[t].plural}</strong><small>{CONSTRUCOES_DO_ACERVO[t].nome} · nível {c.nivel} · {c.qtd} no acervo</small></span>
                  <span className="ac-placa__premio" title="o que um material aprovado deste tipo vale agora">{moedas(b.recompensas[t])}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="ac-placa__bibliotecarios">
          🔎 Bibliotecários: {dados.bibliotecarios.map((x) => `${x.nome}${x.lider ? " (líder da semana)" : ""}`).join(" e ") || "—"}.
          {" "}Cada nível da biblioteca aumenta as recompensas em 10%.
        </p>
      </section>

      <div className="ac-abas" role="tablist" aria-label="Biblioteca Colaborativa">
        {abas.map(([id, rotulo]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} className={aba === id ? "ac-aba ac-aba--atual" : "ac-aba"} onClick={() => setAba(id)}>{rotulo}</button>
        ))}
      </div>

      <div ref={lista}>
        {aba === "acervo" && (
          <Catalogo materiais={materiais} total={dados.materiais.length} filtro={filtro} aoFiltrar={setFiltro} gorjetas={dados.gorjetas} saldo={dados.saldo} souBibliotecario={dados.souBibliotecario}
            autorFiltrado={filtro.autor ? dados.materiais.find((m) => m.autor.id === filtro.autor)?.autor.nome : null}
            aoLer={ler} aoAssistir={setAssistindo} aoAgradecer={agradecer} aoRetirar={retirar} aoTrazer={() => setAba("trazer")} />
        )}
        {aba === "trazer" && <Trazer dados={dados} avisar={avisar} aoEnviar={() => { carregar(); setAba("meus"); }} />}
        {aba === "meus" && <MeusEnvios meus={dados.meus} avisar={avisar} aoMudar={carregar} />}
        {aba === "mesa" && dados.souBibliotecario && <Mesa fila={dados.fila} dados={dados} avisar={avisar} aoMudar={carregar} aoAssistir={setAssistindo} />}
      </div>

      {assistindo && (
        <div className="ac-sala" role="dialog" aria-modal="true" aria-label={assistindo.titulo} onClick={(e) => { if (e.target === e.currentTarget) setAssistindo(null); }}>
          <div className="ac-sala__caixa">
            <div className="ac-sala__topo">
              <strong>{TIPOS_DE_MATERIAL[assistindo.tipo].icone} {assistindo.titulo}</strong>
              <button type="button" className="ac-balao__fechar" onClick={() => setAssistindo(null)} aria-label="Fechar">✕</button>
            </div>
            <div className="ac-sala__video">
              <iframe src={`${assistindo.video.embed}${assistindo.video.plataforma === "youtube" ? "?rel=0" : ""}`} title={assistindo.titulo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
            </div>
            {assistindo.autores && <p className="ac-sala__autores">{assistindo.autores}</p>}
          </div>
        </div>
      )}
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

// ---------------------------------------------------------------- o acervo

function Catalogo({ materiais, total, filtro, aoFiltrar, gorjetas, saldo, souBibliotecario, autorFiltrado, aoLer, aoAssistir, aoAgradecer, aoRetirar, aoTrazer }) {
  return (
    <section className="ac-catalogo" aria-label="Acervo">
      <div className="ac-filtros">
        <input type="search" className="pf-campo__entrada" placeholder="Procurar por título, autor, assunto…" value={filtro.texto} onChange={(e) => aoFiltrar((f) => ({ ...f, texto: e.target.value }))} aria-label="Procurar no acervo" />
        <div className="ac-chips" role="group" aria-label="Tipo">
          <button type="button" aria-pressed={!filtro.tipo} onClick={() => aoFiltrar((f) => ({ ...f, tipo: "" }))}>Todos</button>
          {ORDEM_DOS_TIPOS.map((t) => <button key={t} type="button" aria-pressed={filtro.tipo === t} onClick={() => aoFiltrar((f) => ({ ...f, tipo: f.tipo === t ? "" : t }))}>{TIPOS_DE_MATERIAL[t].icone} {TIPOS_DE_MATERIAL[t].plural}</button>)}
        </div>
        <select className="pf-campo__entrada ac-filtros__categoria" value={filtro.categoria} onChange={(e) => aoFiltrar((f) => ({ ...f, categoria: e.target.value }))} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {CATEGORIAS_DO_ACERVO.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {autorFiltrado && (
        <p className="ac-filtro-autor">Mostrando o que <strong>{autorFiltrado}</strong> trouxe · <button type="button" onClick={() => aoFiltrar((f) => ({ ...f, autor: "" }))}>ver tudo</button></p>
      )}
      {!total ? (
        <button type="button" className="pf-cartao ac-vazio" onClick={aoTrazer}>
          <span aria-hidden="true">🏛️</span>
          <strong>O acervo ainda está vazio</strong>
          <span>Seja a primeira pessoa a trazer um livro, um artigo ou um vídeo — e ganhe moedas quando o bibliotecário aprovar.</span>
        </button>
      ) : !materiais.length ? <p className="pf-vazio">Nada encontrado com esses filtros.</p> : (
        <ul className="ac-lista">
          {materiais.map((m) => (
            <li key={m.id} className="pf-cartao ac-item">
              <Capa m={m} />
              <div className="ac-item__info">
                <span className="ac-item__tipo">{TIPOS_DE_MATERIAL[m.tipo].icone} {TIPOS_DE_MATERIAL[m.tipo].nome} · {m.categoria}</span>
                <strong className="ac-item__titulo">{m.titulo}</strong>
                {m.autores && <span className="ac-item__autores">{m.autores}</span>}
                <span className="ac-item__meta">
                  {m.assunto}{m.paginas ? ` · ${m.paginas} págs.` : ""}{m.tamanho ? ` · ${formatarTamanho(m.tamanho)}` : ""}
                </span>
                {m.descricao && <p className="ac-item__descricao">{m.descricao}</p>}
                <span className="ac-item__quem">trazido por <strong>{m.autor.nome}</strong>{m.gorjetas.quantos ? ` · 🙏 ${m.gorjetas.quantos} agradecimento(s)` : ""}</span>
                <div className="ac-item__acoes">
                  {m.temPdf && <button type="button" className="pf-botao pf-botao--pequeno" onClick={() => aoLer(m)}>{m.naMinhaBiblioteca ? "📖 Abrir na minha biblioteca" : "📖 Ler na minha biblioteca"}</button>}
                  {m.video && <button type="button" className="pf-botao pf-botao--pequeno" onClick={() => aoAssistir(m)}>▶ Assistir</button>}
                  {m.link && !m.temPdf && <a className="pf-botao pf-botao--pequeno" href={m.link} target="_blank" rel="noopener noreferrer">🔗 Abrir o artigo</a>}
                  {!m.meu && (m.agradeci ? <span className="pf-pilula">🙏 você agradeceu</span> : saldo < Math.min(...gorjetas) ? (
                    <span className="pf-pilula" title="a gorjeta sai das suas moedas do Reino">🙏 sem moedas para agradecer</span>
                  ) : (
                    <details className="ac-gorjeta">
                      <summary>🙏 Agradecer</summary>
                      <div>{gorjetas.map((g) => (
                        <button key={g} type="button" disabled={g > saldo} onClick={(e) => { e.currentTarget.closest("details").open = false; aoAgradecer(m, g); }}>{moedas(g)}</button>
                      ))}</div>
                    </details>
                  ))}
                  {souBibliotecario && <button type="button" className="ac-item__retirar" onClick={() => aoRetirar(m)}>Retirar do acervo</button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
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

  const capaVista = capaPropria || (usaPdf ? leitura?.capa : null) || video?.miniatura;
  return (
    <form className="pf-cartao ac-trazer" onSubmit={enviar}>
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
          {def.formato === "pdf-ou-link" && (
            <div className="ac-chips" role="radiogroup" aria-label="O artigo vem como">
              <button type="button" role="radio" aria-checked={f.modoDoArtigo === "pdf"} aria-pressed={f.modoDoArtigo === "pdf"} onClick={() => mudar("modoDoArtigo", "pdf")}>📄 PDF</button>
              <button type="button" role="radio" aria-checked={f.modoDoArtigo === "link"} aria-pressed={f.modoDoArtigo === "link"} onClick={() => mudar("modoDoArtigo", "link")}>🔗 Link (DOI ou página)</button>
            </div>
          )}
          {usaPdf ? (
            <label className="ac-arquivo">
              <input type="file" accept="application/pdf,.pdf" onChange={(e) => { escolherPdf(e.target.files?.[0]); e.target.value = ""; }} />
              <span>{arquivo ? `📄 ${arquivo.name} · ${leitura?.paginas || "?"} págs. · ${formatarTamanho(arquivo.size)}` : "📄 Escolher o PDF (até 50 MB)"}</span>
            </label>
          ) : (
            <label className="pf-campo">
              <span className="pf-campo__rotulo">{def.formato === "video" ? "Link do vídeo (YouTube ou Vimeo)" : "Link do artigo (DOI ou página)"}</span>
              <input className="pf-campo__entrada" type="url" inputMode="url" placeholder="https://" value={f.link} onChange={(e) => mudar("link", e.target.value)} required />
              {f.link && def.formato === "video" && !video && <small className="ac-erro">Esse link não é de um vídeo do YouTube ou do Vimeo.</small>}
              {f.link && def.formato !== "video" && !linkValido(f.link) && <small className="ac-erro">Esse link não parece válido.</small>}
            </label>
          )}
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

        <div className="ac-trazer__capa">
          <span className="pf-campo__rotulo">Capa</span>
          <span className={`ac-capa ac-capa--grande ac-capa--${f.tipo}`}>
            {capaVista ? <img src={capaVista} alt="Prévia da capa" /> : <span aria-hidden="true">{def.icone}</span>}
          </span>
          {def.formato !== "video" && (
            <label className="ac-arquivo ac-arquivo--pequeno">
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { escolherCapa(e.target.files?.[0]); e.target.value = ""; }} />
              <span>{capaPropria ? "Trocar a imagem" : usaPdf ? "Usar outra imagem (a padrão é a 1ª página)" : "Escolher uma imagem"}</span>
            </label>
          )}
          {def.formato === "video" && <small className="pf-ajuda">A capa é a miniatura do vídeo.</small>}
        </div>
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
        <li key={m.id} className={`pf-cartao ac-envio ac-envio--${m.status}`}>
          <Capa m={m} />
          <div>
            <strong>{m.titulo}</strong>
            <small>{TIPOS_DE_MATERIAL[m.tipo].icone} {TIPOS_DE_MATERIAL[m.tipo].nome} · {new Date(m.enviadoEm).toLocaleDateString("pt-BR")}</small>
            <span className={`pf-pilula ac-status ac-status--${m.status}`}>{STATUS[m.status]}{m.status === "aprovado" && m.recompensa ? ` · +${moedas(m.recompensa)}` : ""}</span>
            {m.motivo && <p className="ac-envio__motivo">Motivo: {m.motivo}</p>}
          </div>
          {(m.status === "pendente" || m.status === "recusado") && <button type="button" className="ac-item__retirar" onClick={() => desistir(m)}>{m.status === "pendente" ? "Desistir" : "Tirar da lista"}</button>}
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
          <li key={m.id} className="pf-cartao ac-revisao">
            <Capa m={m} />
            <div className="ac-revisao__info">
              <span className="ac-item__tipo">{TIPOS_DE_MATERIAL[m.tipo].icone} {TIPOS_DE_MATERIAL[m.tipo].nome} · {m.categoria} · {m.assunto}</span>
              <strong>{m.titulo}</strong>
              {m.autores && <span className="ac-item__autores">{m.autores}</span>}
              <span className="ac-item__quem">trazido por <strong>{m.autor.nome}</strong> em {new Date(m.enviadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
              {m.descricao && <p className="ac-item__descricao">{m.descricao}</p>}
              <div className="ac-item__acoes">
                {m.temPdf && <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => espiar(m)}>📄 Espiar o PDF ({m.paginas} págs.)</button>}
                {m.video && <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => aoAssistir(m)}>▶ Ver o vídeo</button>}
                {m.link && !m.video && <a className="pf-botao pf-botao--sec pf-botao--pequeno" href={m.link} target="_blank" rel="noopener noreferrer">🔗 Abrir o link</a>}
              </div>
              {proprio ? <p className="ac-revisao__proprio">É o seu envio: fica para o outro bibliotecário.</p> : (
                <div className="ac-revisao__decisao">
                  <input className="pf-campo__entrada" placeholder="Motivo (obrigatório para recusar)" maxLength={LIMITES_DO_ACERVO.motivo} value={motivos[m.id] || ""} onChange={(e) => setMotivos((x) => ({ ...x, [m.id]: e.target.value }))} aria-label={`Motivo para ${m.titulo}`} />
                  <button type="button" className="pf-botao pf-botao--pequeno" disabled={ocupado === m.id} onClick={() => decidir(m, "aprovar")}>✅ Aprovar (+{moedas(dados.biblioteca.recompensas[m.tipo])})</button>
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
