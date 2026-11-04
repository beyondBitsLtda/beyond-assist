"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { obter } from "@/lib/api.js";
import Codigo from "@/componentes/codigo/Codigo.js";
import DesenhoDoJurado from "@/componentes/bootcamp/Jurados.js";
import { Avatar, RESULTADO, Insignias } from "@/componentes/bootcamp/Pecas.js";
import { APRESENTADORA } from "@/dominio/bootcamp.js";

/**
 * O painel dos 3 jurados do Modo Bootcamp: a classificação, as entrevistas de despedida de quem saiu e, rodada por
 * rodada, o desafio, o comentário dos jurados, as notas de cada critério (desempenho técnico, arquitetura e regras)
 * e o feedback de cada um.
 */
export default function PainelDosJurados() {
  const { id } = useParams();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  // o link "ver a entrevista de despedida" da arena (#despedida-<id>) abre e mostra a entrevista dele
  const [abertaNoLink, setAbertaNoLink] = useState("");

  useEffect(() => { obter(`/api/bootcamp/${id}/jurados`).then(setDados).catch((e) => setErro(e.message)); }, [id]);
  useEffect(() => {
    if (!dados) return;
    const alvo = decodeURIComponent(window.location.hash.replace(/^#despedida-/, ""));
    if (!alvo || alvo === window.location.hash) return;
    setAbertaNoLink(alvo);
    requestAnimationFrame(() => document.getElementById(`despedida-${alvo}`)?.scrollIntoView({ block: "start" }));
  }, [dados]);

  if (erro) {
    return (
      <>
        <div className="pf-aviso pf-aviso--erro">{erro}</div>
        <Link href="/bootcamp" className="pf-botao pf-botao--sec">← Bootcamp</Link>
      </>
    );
  }
  if (!dados) return <p className="pf-estat__nota">Chamando os jurados…</p>;
  const { torneio, jurados, classificacao, rodadas } = dados;
  // as entrevistas de despedida de quem saiu (humanos e personagens), da mais recente para a mais antiga
  const despedidas = rodadas.flatMap((r) => (r.avaliacao?.participantes || [])
    .filter((a) => a.resultado === "eliminado" && a.despedida?.length)
    .map((a) => ({ ...a, numero: r.numero, prova: r.prova })));
  const campeaoId = torneio.campeao?.id || null;

  return (
    <div className="bc-pagina">
      <div className="pf-cabecalho">
        <div>
          <h1>⚖️ Jurados · {torneio.nome}</h1>
          <p>Cada jurado dá uma nota de 0 a 10 no seu critério; a nota da rodada é a média dos três, vezes 10. {torneio.formato === "temporada" ? "Na temporada, toda prova tem vencedor (e insígnia); na eliminação, sai quem tirar a menor nota." : torneio.formato === "mata-mata" ? "No mata-mata, quem tira a nota menor no confronto sai." : "Nos pontos corridos, as notas somam rodada a rodada."}</p>
        </div>
        <div className="bc-cabecalho__acoes">
          <Link href={`/bootcamp/arena/${torneio.id}`} className="pf-botao">Voltar à arena</Link>
        </div>
      </div>

      <section className="bc-jurados" aria-label="Os jurados">
        {jurados.map((j) => (
          <div key={j.id} className="pf-cartao bc-jurado">
            <DesenhoDoJurado id={j.id} tamanho={84} />
            <div>
              <strong>{j.emoji} {j.nome}</strong>
              <span className="bc-jurado__criterio">{j.criterio}</span>
              <p className="pf-estat__nota">{j.arquetipo[0].toUpperCase() + j.arquetipo.slice(1)}. Olha {j.foco}.</p>
            </div>
          </div>
        ))}
      </section>

      <div className="bc-jurados-grade">
      <aside className="bc-jurados-grade__lado">
      <section className="pf-secao">
        <h2 className="pf-secao__titulo">Classificação <small>{torneio.status === "encerrado" ? "final" : `rodada ${torneio.rodadaAtual || 0} de ${torneio.rodadasTotal}`}</small></h2>
        <ol className="pf-cartao bc-tabela">
          {classificacao.map((c) => (
            <li key={c.id} className={`${c.souEu ? "bc-eu" : ""}${c.eliminado ? " bc-fora" : ""}`}>
              <span className="bc-tabela__pos">{c.posicao}º</span>
              <Avatar p={c} campeaoId={campeaoId} tamanho={34} />
              <span className="bc-tabela__nome">{c.id === campeaoId ? "🏆 " : ""}{c.souEu ? "Você" : c.nome}{c.tipo === "npc" ? " 🤖" : ""}</span>
              <span className="bc-tabela__info">{c.eliminado ? `saiu na prova ${c.eliminadoNa}` : "na disputa"}</span>
              <Insignias lista={c.insignias} catalogo={dados.insignias} />
              <span className="bc-tabela__pontos">{c.pontos} pts</span>
            </li>
          ))}
        </ol>
      </section>
      {despedidas.length > 0 && (
        <section className="pf-secao bc-despedidas" aria-label="As entrevistas de despedida">
          <h2 className="pf-secao__titulo">🎤 As despedidas</h2>
          {despedidas.map((d) => (
            <details key={`${d.numero}:${d.id}`} id={`despedida-${d.id}`} className="pf-cartao bc-despedida" open={abertaNoLink === d.id}>
              <summary>
                <Avatar p={{ ...d, eliminado: true }} tamanho={36} />
                <span><strong>{d.souEu ? "Você" : d.nome}</strong><small>saiu na {d.prova?.nome?.toLowerCase() || "prova"} {d.numero} · {d.nota}/100</small></span>
              </summary>
              <div className="bc-despedida__entrevista">
                {d.despedida.map((x, i) => (
                  <div key={i}>
                    <p><strong>{APRESENTADORA.emoji} {APRESENTADORA.nome}:</strong> {x.pergunta}</p>
                    <p className="bc-despedida__resposta"><strong>{d.souEu ? "Você" : d.nome}:</strong> {x.resposta}</p>
                  </div>
                ))}
              </div>
              {(d.pontosFortes?.length > 0 || d.pontosFracos?.length > 0) && (
                <div className="bc-ficha__pontos">
                  <div><h4>💪 Pontos fortes</h4><ul>{(d.pontosFortes || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                  <div><h4>🛠️ Pontos fracos</h4><ul>{(d.pontosFracos || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                </div>
              )}
            </details>
          ))}
        </section>
      )}
      </aside>

      <div className="bc-jurados-grade__provas">
      {!rodadas.length && <p className="pf-aviso">Nenhuma rodada ainda: os jurados entram quando o organizador abrir a primeira.</p>}
      {rodadas.map((r) => (
        <section key={r.numero} className="pf-secao">
          <h2 className="pf-secao__titulo">{r.prova?.emoji} {r.prova?.tipo === "rodada" ? `Rodada ${r.numero}` : `${r.prova?.nome} · prova ${r.numero}`}: {r.desafio.titulo}{r.avaliacao?.origem === "automatica" && <small title="A IA dos jurados não respondeu: as notas saíram dos testes, do plano e das regras">avaliação automática</small>}</h2>
          {!r.avaliacao && <p className="pf-aviso">{r.status === "avaliando" ? "Os jurados estão avaliando esta prova…" : "Prova em andamento: os jurados avaliam no fim."}</p>}
          {r.avaliacao && (
            <>
              {r.avaliacao.comentarioGeral && <p className="bc-resultado__comentario">“{r.avaliacao.comentarioGeral}”</p>}
              {r.vencedores?.length > 0 && <p className="bc-resultado__vencedor">🎖️ Vencedor{r.vencedores.length > 1 ? "es" : ""} da prova: {r.vencedores.join(", ")}</p>}
              {r.equipes?.length > 0 && (
                <div className="bc-equipes">
                  {r.equipes.map((e) => (
                    <div key={e.id} className={`bc-equipe bc-time--${e.id}${e.venceu ? " bc-equipe--venceu" : ""}`}>
                      <strong>{e.emoji} {e.nome} · {e.nota}/100 {e.venceu ? "🏅" : ""}</strong>
                      {e.integracao && <small>🧩 programa do time: {e.integracao.passados}/{e.integracao.total} testes{e.integracao.faltou.length ? ` · faltou a parte de ${e.integracao.faltou.join(", ")}` : ""}</small>}
                    </div>
                  ))}
                </div>
              )}
              {r.confrontos?.length > 0 && (
                <p className="pf-estat__nota">Confrontos: {r.confrontos.map((c) => (c.b ? `${c.nomeA} × ${c.nomeB}` : `${c.nomeA} (folga)`)).join(" · ")}</p>
              )}
              <ul className="bc-notas">
                {r.avaliacao.participantes.map((a) => (
                  <li key={a.id} className={`pf-cartao bc-nota${a.souEu ? " bc-eu" : ""}`}>
                    <div className="bc-nota__topo">
                      <Avatar p={{ ...a, eliminado: a.resultado === "eliminado" }} tamanho={44} />
                      <div className="bc-nota__quem">
                        <strong>{a.souEu ? "Você" : a.nome}{a.tipo === "npc" ? " 🤖" : ""}</strong>
                        <span className="pf-estat__nota">
                          testes {a.testes?.passados ?? 0}/{a.testes?.total ?? 0}
                          {a.linguagem ? ` · ${a.linguagem}` : ""}{a.modo === "github" ? " · GitHub" : a.modo === "editor" ? " · editor" : ""}
                          {a.tipo === "humano" && !a.enviou ? " · não enviou a tempo" : ""}
                        </span>
                      </div>
                      <span className={`pf-pilula pf-pilula--${RESULTADO[a.resultado]?.classe || "tema"}`}>{RESULTADO[a.resultado]?.texto || a.resultado}</span>
                      <span className="bc-nota__total">{a.nota}<small>/100</small></span>
                    </div>
                    {a.fala && <p className="bc-nota__fala">“{a.fala}”</p>}
                    <div className="bc-nota__jurados">
                      {jurados.map((j) => (
                        <div key={j.id} className="bc-nota__jurado">
                          <span className="bc-nota__criterio">{j.emoji} {j.criterio}</span>
                          <strong>{a.notas?.[j.id] ?? 0}</strong>
                          <p>{a.feedback?.[j.id]}</p>
                        </div>
                      ))}
                    </div>
                    {a.review?.length > 0 && (
                      <details className="bc-nota__review">
                        <summary>🔍 O code review ao vivo ({a.review.length} {a.review.length === 1 ? "trecho" : "trechos"}){a.tipo === "npc" ? " · trecho típico do personagem" : ""}</summary>
                        <ul>
                          {a.review.map((r, i) => (
                            <li key={i} className={`bc-review bc-review--${r.tipo}`}>
                              <div className="bc-review__jurado">
                                <DesenhoDoJurado id={r.jurado} humor={r.tipo === "elogio" ? "feliz" : "bravo"} tamanho={48} />
                                <div>
                                  <strong>{jurados.find((j) => j.id === r.jurado)?.nome}</strong>
                                  <span className={`pf-pilula pf-pilula--${r.tipo === "elogio" ? "verde" : "alerta"}`}>{r.trecho ? `${r.tipo === "elogio" ? "✅ bem avaliado" : "❌ mal avaliado"} · linhas ${r.linhaInicio}–${r.linhaFim}` : "❌ entrega vazia"}</span>
                                </div>
                              </div>
                              <p className="bc-review__fala">“{r.fala}”</p>
                              {r.trecho && <Codigo texto={r.trecho} linguagem={a.linguagem || "javascript"} />}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ))}
      </div>
      </div>
    </div>
  );
}
