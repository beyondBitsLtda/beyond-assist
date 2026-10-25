"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { obter, criar } from "@/lib/api.js";
import { diaDe } from "@/dominio/datas.js";
import { DIAS_PADRAO, NOMES_DOS_NIVEIS } from "@/dominio/plano.js";
import { NIVEIS_DO_CURSO, DURACOES_EM_SEMANAS, resumoDoCurso } from "@/dominio/curso.js";
import { capitulosDoLivro } from "@/dominio/biblioteca.js";
import { DiasDeEstudo } from "@/componentes/Pecas.js";
import Neuro, { reagir, comemorar } from "@/componentes/Neuro.js";

const ROTULO_DO_NIVEL = { iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado" };

/**
 * Criar um curso com a Lisa: tema e nível → a Lisa propõe módulos e assuntos → a pessoa revisa
 * (tira o que não quer, muda o nome) → o quadro STUDY nasce no Abacato com a trilha pronta.
 *
 * Ou a partir de um livro da biblioteca (25/10/2026): escolhe o livro e os capítulos, e a Lisa lê o
 * texto deles e monta o curso seguindo o livro — cada assunto com as páginas que ele cobre.
 */
export default function NovoCurso() {
  const router = useRouter();
  const [fonte, setFonte] = useState("tema"); // tema | livro
  const [tema, setTema] = useState("");
  const [nivel, setNivel] = useState("iniciante");
  const [objetivo, setObjetivo] = useState("");
  const [semanas, setSemanas] = useState(4);
  const [dias, setDias] = useState(DIAS_PADRAO);
  const [inicio, setInicio] = useState(diaDe());
  const [proposta, setProposta] = useState(null);
  const [etapa, setEtapa] = useState("form"); // form | pensando | proposta | criando
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [livros, setLivros] = useState(null);
  const [livroId, setLivroId] = useState("");
  const [livro, setLivro] = useState(null);
  const [capitulosFora, setCapitulosFora] = useState(new Set());
  const [comCaderno, setComCaderno] = useState(true);

  // ?livro= (o botão "Gerar curso" da biblioteca e do leitor)
  useEffect(() => {
    const pedido = new URLSearchParams(window.location.search).get("livro");
    if (pedido) { setFonte("livro"); setLivroId(pedido); }
  }, []);

  useEffect(() => {
    if (fonte !== "livro" || livros) return;
    obter("/api/biblioteca").then((r) => setLivros(r.livros.filter((l) => l.status === "pronto" && l.paginasComTexto > 0))).catch((e) => setErro(e.message));
  }, [fonte, livros]);

  useEffect(() => {
    if (!livroId) { setLivro(null); return; }
    setCapitulosFora(new Set());
    obter(`/api/biblioteca/${livroId}`).then((r) => setLivro(r.livro)).catch((e) => setErro(e.message));
  }, [livroId]);

  const capitulos = useMemo(() => (livro ? capitulosDoLivro(livro.sumario, livro.paginas) : []), [livro]);
  const faixas = capitulos.filter((_, i) => !capitulosFora.has(i)).map((c) => ({ de: c.de, ate: c.ate }));
  const paginasEscolhidas = faixas.reduce((s, f) => s + f.ate - f.de + 1, 0);

  async function propor(e) {
    e?.preventDefault();
    setErro("");
    setAviso("");
    setEtapa("pensando");
    reagir("pensando", fonte === "livro" ? "Lendo o livro e desenhando o curso capítulo por capítulo… isso leva de meio a um minuto." : "Desenhando o seu curso, módulo por módulo… isso leva uns segundinhos.", 120000);
    try {
      const corpo = fonte === "livro"
        ? { livroId, faixas, nivel, objetivo, semanas, diasDeEstudo: dias }
        : { tema, nivel, objetivo, semanas, diasDeEstudo: dias };
      const r = await criar("/api/cursos/proposta", corpo);
      setProposta(r.proposta);
      if (r.aviso) setAviso(r.aviso);
      setEtapa("proposta");
      reagir("feliz", "Prontinho! Dá uma olhada e tira o que não fizer sentido.", 6000);
    } catch (falha) {
      setErro(falha.message);
      setEtapa("form");
      reagir("triste", "Não consegui montar agora. Tenta de novo?");
    }
  }

  function tirarAssunto(m, a) {
    setProposta((p) => ({
      ...p,
      modulos: p.modulos
        .map((mod, i) => (i === m ? { ...mod, assuntos: mod.assuntos.filter((_, j) => j !== a) } : mod))
        .filter((mod) => mod.assuntos.length),
    }));
  }

  async function confirmar() {
    setErro("");
    setEtapa("criando");
    reagir("pensando", "Criando o quadro no Abacato e desenhando a trilha…", 60000);
    try {
      const r = await criar("/api/cursos", { proposta, diasDeEstudo: dias, inicio, comCaderno });
      comemorar(`Curso de ${proposta.tema} criado! 🎉`);
      router.push(`/trilhas/${r.trilhaId}${r.aviso ? `?aviso=${encodeURIComponent(r.aviso)}` : ""}`);
    } catch (falha) {
      setErro(falha.message);
      setEtapa("proposta");
      reagir("triste", "Algo falhou ao criar. Nada ficou pela metade no Abacato — pode tentar de novo.");
    }
  }

  const resumo = proposta ? resumoDoCurso(proposta) : null;
  const ocupado = etapa === "pensando" || etapa === "criando";
  const podePropor = fonte === "livro" ? Boolean(livro) && faixas.length > 0 : tema.trim().length >= 2;

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <p style={{ margin: 0 }}><Link href="/trilhas">← Trilhas</Link></p>
          <h1>Criar curso com a Lisa</h1>
          <p>{fonte === "livro" ? "A Lisa lê o livro e monta o curso seguindo os capítulos dele." : "Diga o tema e o nível. A Lisa monta o quadro STUDY no Abacato e a trilha já pronta."}</p>
        </div>
      </div>

      <div className="pf-cartao curso__neuro">
        <Neuro
          humor={ocupado ? "pensando" : proposta ? "feliz" : "normal"}
          fala={proposta ? "" : fonte === "livro" ? "Escolha o livro e os capítulos: eu leio e monto o curso com as páginas de cada assunto." : "O que você quer aprender? Pode ser uma linguagem, um framework, banco de dados…"}
          tamanho={96}
          ouvir
        />
      </div>

      {erro && <div className="pf-aviso pf-aviso--erro" style={{ marginTop: 12 }}>{erro}</div>}

      {(etapa === "form" || etapa === "pensando") && (
        <form className="pf-cartao curso__form" onSubmit={propor}>
          <div className="pf-dias curso__fonte" role="group" aria-label="De onde vem o curso">
            <button type="button" className="pf-dia" aria-pressed={fonte === "tema"} onClick={() => setFonte("tema")} disabled={ocupado}>✨ Pelo tema</button>
            <button type="button" className="pf-dia" aria-pressed={fonte === "livro"} onClick={() => setFonte("livro")} disabled={ocupado}>📖 A partir de um livro</button>
          </div>

          {fonte === "tema" ? (
            <label className="pf-campo">
              <span className="pf-campo__rotulo">Tema do curso</span>
              <input className="pf-campo__entrada" value={tema} onChange={(e) => setTema(e.target.value)} maxLength={80}
                placeholder="Ex.: JavaScript, SQL para análise de dados, React com TypeScript" required disabled={ocupado} />
            </label>
          ) : (
            <>
              <label className="pf-campo">
                <span className="pf-campo__rotulo">Livro da biblioteca</span>
                <select className="pf-campo__entrada" value={livroId} onChange={(e) => setLivroId(e.target.value)} disabled={ocupado || !livros} required>
                  <option value="">{livros ? (livros.length ? "Escolha um livro…" : "Nenhum livro com texto na biblioteca") : "Carregando…"}</option>
                  {(livros || []).map((l) => <option key={l.id} value={l.id}>{l.titulo} ({l.paginas} págs.)</option>)}
                </select>
                {livros && !livros.length && <small className="pf-estat__nota" style={{ margin: 0 }}><Link href="/biblioteca">Suba um PDF na biblioteca</Link> para gerar um curso a partir dele.</small>}
              </label>
              {livro && (
                <div className="pf-campo">
                  <span className="pf-campo__rotulo">
                    Capítulos do curso · {faixas.length} de {capitulos.length} · {paginasEscolhidas} páginas
                    {!livro.sumario?.length && " (o PDF não tem sumário: o livro foi dividido em blocos de páginas)"}
                  </span>
                  <div className="curso__capitulos">
                    <div className="pf-acoes">
                      <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setCapitulosFora(new Set())} disabled={ocupado}>Todos</button>
                      <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setCapitulosFora(new Set(capitulos.map((_, i) => i)))} disabled={ocupado}>Nenhum</button>
                    </div>
                    <ul>
                      {capitulos.map((c, i) => (
                        <li key={`${c.de}-${i}`}>
                          <label>
                            <input type="checkbox" checked={!capitulosFora.has(i)} disabled={ocupado}
                              onChange={() => setCapitulosFora((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                            <span className="curso__capitulo">{c.titulo}</span>
                            <small>págs. {c.de}–{c.ate}{c.secoes.length ? ` · ${c.secoes.length} seções` : ""}</small>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="pf-campo">
            <span className="pf-campo__rotulo">Nível</span>
            <div className="pf-dias" role="group" aria-label="Nível">
              {Object.keys(NIVEIS_DO_CURSO).map((n) => (
                <button key={n} type="button" className="pf-dia" aria-pressed={nivel === n} onClick={() => setNivel(n)} disabled={ocupado}>
                  {ROTULO_DO_NIVEL[n]}
                </button>
              ))}
            </div>
            <small className="pf-estat__nota" style={{ margin: 0 }}>{NIVEIS_DO_CURSO[nivel]}</small>
          </div>

          <label className="pf-campo">
            <span className="pf-campo__rotulo">Objetivo (opcional)</span>
            <textarea className="pf-campo__entrada" rows={2} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} maxLength={400}
              placeholder="Ex.: conseguir criar uma API REST e me preparar para vagas júnior" disabled={ocupado} />
          </label>

          <div className="pf-campo">
            <span className="pf-campo__rotulo">Duração</span>
            <div className="pf-dias" role="group" aria-label="Duração">
              {DURACOES_EM_SEMANAS.map((s) => (
                <button key={s} type="button" className="pf-dia" aria-pressed={semanas === s} onClick={() => setSemanas(s)} disabled={ocupado}>
                  {s} semanas
                </button>
              ))}
            </div>
          </div>

          <div className="pf-campo">
            <span className="pf-campo__rotulo">Em que dias você estuda?</span>
            <DiasDeEstudo valor={dias} aoMudar={setDias} />
          </div>

          <label className="pf-campo">
            <span className="pf-campo__rotulo">Começar em</span>
            <input className="pf-campo__entrada" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required disabled={ocupado} />
          </label>

          <label className="curso__caderno">
            <input type="checkbox" checked={comCaderno} onChange={(e) => setComCaderno(e.target.checked)} disabled={ocupado} />
            <span>📓 Criar também o caderno do curso — um módulo por módulo, uma página por assunto, já ligadas à trilha{fonte === "livro" ? " e às páginas do livro" : ""}</span>
          </label>

          <button className="pf-botao" type="submit" disabled={ocupado || !podePropor}>
            {etapa === "pensando" ? (fonte === "livro" ? "A Lisa está lendo o livro…" : "A Lisa está montando o curso…") : "✨ Montar proposta"}
          </button>
        </form>
      )}

      {proposta && (etapa === "proposta" || etapa === "criando") && (
        <>
          <section className="pf-cartao curso__resumo">
            <label className="pf-campo">
              <span className="pf-campo__rotulo">Nome do quadro no Abacato</span>
              <input className="pf-campo__entrada" value={proposta.nome} maxLength={80} disabled={ocupado}
                onChange={(e) => setProposta((p) => ({ ...p, nome: e.target.value }))} />
              <small className="pf-estat__nota" style={{ margin: 0 }}>Começa com STUDY: é o que faz o quadro virar trilha.</small>
            </label>
            {proposta.resumo && <p style={{ margin: 0 }}>{proposta.resumo}</p>}
            {aviso && <div className="pf-aviso">{aviso}</div>}
            <div className="pf-assunto__chips">
              {proposta.livro && <span className="pf-pilula pf-pilula--tema">📖 {proposta.livro.titulo}</span>}
              <span className="pf-pilula pf-pilula--tema">{ROTULO_DO_NIVEL[proposta.nivel]}</span>
              <span className="pf-pilula">{resumo.modulos} módulos</span>
              <span className="pf-pilula">{resumo.assuntos} assuntos</span>
              <span className="pf-pilula">{resumo.tarefas} tarefas de teoria</span>
              <span className="pf-pilula">~{resumo.dias} dias de estudo</span>
            </div>
          </section>

          {proposta.modulos.map((m, i) => (
            <section key={`${m.nome}-${i}`} className="pf-secao">
              <h2 className="pf-secao__titulo">
                <span>Módulo {i + 1} · {m.nome}</span>
                <small>{m.assuntos.length} assunto(s)</small>
              </h2>
              <ul className="curso__assuntos">
                {m.assuntos.map((a, j) => (
                  <li key={`${a.titulo}-${j}`} className="pf-cartao curso__assunto">
                    <div>
                      <p className="pf-etapa__titulo">{a.titulo}</p>
                      <p className="pf-etapa__meta">
                        <span>{NOMES_DOS_NIVEIS[a.nivel]}</span>
                        <span>{a.dias} dia(s)</span>
                        <span>{a.tarefas.length} tarefa(s)</span>
                        {a.paginas && <span>📖 {a.paginas.de === a.paginas.ate ? `p. ${a.paginas.de}` : `págs. ${a.paginas.de}–${a.paginas.ate}`}</span>}
                      </p>
                      {a.secao && <p className="pf-etapa__objetivo curso__secao">{a.secao}</p>}
                      {a.objetivo && <p className="pf-etapa__objetivo">{a.objetivo}</p>}
                      {a.tarefas.length > 0 && (
                        <details className="curso__tarefas">
                          <summary>Ver tarefas</summary>
                          <ul>{a.tarefas.map((t, k) => <li key={k}>{t}</li>)}</ul>
                        </details>
                      )}
                    </div>
                    <button type="button" className="curso__tirar" onClick={() => tirarAssunto(i, j)} disabled={ocupado}
                      aria-label={`Tirar ${a.titulo} do curso`} title="Tirar do curso">✕</button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <label className="curso__caderno">
            <input type="checkbox" checked={comCaderno} onChange={(e) => setComCaderno(e.target.checked)} disabled={ocupado} />
            <span>📓 Criar também o caderno do curso</span>
          </label>
          <div className="pf-acoes curso__confirmar">
            <button type="button" className="pf-botao" onClick={confirmar} disabled={ocupado || resumo.assuntos < 3}>
              {etapa === "criando" ? "Criando quadro e trilha…" : "Criar quadro e trilha"}
            </button>
            <button type="button" className="pf-botao pf-botao--sec" onClick={() => propor()} disabled={ocupado}>Gerar outra proposta</button>
            <button type="button" className="pf-botao pf-botao--sec" onClick={() => { setProposta(null); setEtapa("form"); }} disabled={ocupado}>
              {fonte === "livro" ? "Mudar livro, capítulos ou nível" : "Mudar tema ou nível"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
