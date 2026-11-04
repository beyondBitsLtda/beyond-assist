"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { obter, criar } from "@/lib/api.js";
import Neuro from "@/componentes/Neuro.js";
import { StatusDoNpc } from "@/componentes/bootcamp/Pecas.js";
import { planoDaTemporada } from "@/dominio/bootcamp.js";

const EQUIPE_ROTULO = {
  sorteio: { nome: "Times sorteados", descricao: "Os dois times saem por sorteio." },
  capitao: { nome: "O vencedor escolhe", descricao: "Quem venceu a última prova escolhe um membro para o time dele; o resto é sorteado." },
  nao: { nome: "Sem prova em equipe", descricao: "Todos os episódios começam com a prova de imunidade." },
};
const EMOJI_DO_FORMATO = { temporada: "🎬", "mata-mata": "⚔️", "pontos-corridos": "📊" };

/**
 * A configuração de um torneio novo do Modo Bootcamp. As opções ficam numa coluna (o formato e o ritmo da
 * temporada, o tempo e as linguagens, os participantes, o nível e o cenário) e, ao lado, o resumo fixo: o nome,
 * o que já foi escolhido, as provas da temporada e o botão de criar. No celular, o resumo vem no fim.
 */
export default function CriarTorneio() {
  const router = useRouter();
  const [opcoes, setOpcoes] = useState(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [busca, setBusca] = useState("");
  const [f, setF] = useState({
    nome: "", formato: "temporada", rodadas: 3, usarTempo: false, tempoMin: 30,
    modoLinguagem: "livre", permitidas: [], total: 8, convidados: [], npcs: [], nivel: "medio", cenario: "neon",
    eliminadosPorEpisodio: 2, provaDeEquipe: "capitao",
  });
  const mudar = (campo, valor) => setF((x) => ({ ...x, [campo]: valor }));
  const alternar = (campo, valor) => setF((x) => ({ ...x, [campo]: x[campo].includes(valor) ? x[campo].filter((v) => v !== valor) : [...x[campo], valor] }));

  useEffect(() => { obter("/api/bootcamp").then((d) => setOpcoes(d.opcoes)).catch((e) => setErro(e.message)); }, []);

  const vagasDosPersonagens = f.total - 1 - f.convidados.length;
  const sorteados = Math.max(0, vagasDosPersonagens - f.npcs.length);
  const rodadasDoMataMata = Math.ceil(Math.log2(Math.max(2, f.total)));
  const plano = useMemo(
    () => planoDaTemporada(f.total, { eliminadosPorEpisodio: f.eliminadosPorEpisodio, provaDeEquipe: f.provaDeEquipe }),
    [f.total, f.eliminadosPorEpisodio, f.provaDeEquipe],
  );
  const jogadores = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (opcoes?.jogadores || []).filter((j) => !termo || j.nome.toLowerCase().includes(termo)).slice(0, 40);
  }, [opcoes, busca]);

  // se as vagas diminuírem, os personagens escolhidos a mais saem (os últimos escolhidos primeiro)
  useEffect(() => {
    if (f.npcs.length > Math.max(0, vagasDosPersonagens)) mudar("npcs", f.npcs.slice(0, Math.max(0, vagasDosPersonagens)));
  }, [vagasDosPersonagens, f.npcs]);

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const { id } = await criar("/api/bootcamp", {
        nome: f.nome, formato: f.formato, rodadas: f.rodadas, usarTempo: f.usarTempo, tempoMin: f.tempoMin, total: f.total,
        linguagens: { modo: f.modoLinguagem, permitidas: f.permitidas }, npcs: f.npcs, convidados: f.convidados,
        nivel: f.nivel, cenario: f.cenario, eliminadosPorEpisodio: f.eliminadosPorEpisodio, provaDeEquipe: f.provaDeEquipe,
      });
      router.push(`/bootcamp/arena/${id}`);
    } catch (e2) {
      setErro(e2.message);
      setEnviando(false);
    }
  }

  const formato = opcoes?.formatos.find((o) => o.id === f.formato);
  const nivel = opcoes?.niveis.find((n) => n.id === f.nivel);
  const cenario = opcoes?.cenarios.find((c) => c.id === f.cenario);
  const temporada = f.formato === "temporada";

  return (
    <div className="bc-pagina">
      <div className="pf-cabecalho">
        <div>
          <h1>Novo torneio</h1>
          <p>Monte a temporada: o formato, o tempo, as linguagens e quem vai disputar as baias do escritório.</p>
        </div>
        <Link href="/bootcamp" className="pf-botao pf-botao--sec">← Bootcamp</Link>
      </div>
      {erro && !opcoes && <div className="pf-aviso pf-aviso--erro" role="alert">{erro}</div>}
      {!opcoes && !erro && <p className="pf-estat__nota">Carregando as opções…</p>}

      {opcoes && (
        <form className="bc-criar" onSubmit={enviar}>
          <div className="bc-criar__config">
            <section className="pf-cartao bc-criar__bloco">
              <h2 className="bc-criar__titulo">Formato de disputa</h2>
              <div className="bc-opcoes" role="radiogroup" aria-label="Formato">
                {opcoes.formatos.map((o) => (
                  <label key={o.id} className={`bc-opcao${f.formato === o.id ? " bc-opcao--escolhida" : ""}`}>
                    <input type="radio" name="formato" value={o.id} checked={f.formato === o.id} onChange={() => mudar("formato", o.id)} />
                    <strong>{EMOJI_DO_FORMATO[o.id] || "🏁"} {o.nome}</strong>
                    <span>{o.descricao}</span>
                  </label>
                ))}
              </div>
              {temporada ? (
                <>
                  <div className="bc-criar__grupo">
                    <span className="pf-campo__rotulo">Ritmo da temporada</span>
                    <div className="bc-opcoes" role="radiogroup" aria-label="Quantos saem por episódio">
                      {opcoes.eliminadosPorEpisodio.map((n) => (
                        <label key={n} className={`bc-opcao${f.eliminadosPorEpisodio === n ? " bc-opcao--escolhida" : ""}`}>
                          <input type="radio" name="eliminados" checked={f.eliminadosPorEpisodio === n} onChange={() => mudar("eliminadosPorEpisodio", n)} />
                          <strong>{n === 1 ? "📺 Temporada completa" : "⚡ Temporada rápida"}</strong>
                          <span>{n === 1 ? "Sai 1 por episódio, como no reality." : "Saem até 2 por episódio: menos provas até a final."}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="bc-criar__grupo">
                    <span className="pf-campo__rotulo">Prova em equipe (no meio da temporada)</span>
                    <div className="bc-opcoes bc-opcoes--tres" role="radiogroup" aria-label="Prova em equipe">
                      {opcoes.provasDeEquipe.map((m) => (
                        <label key={m} className={`bc-opcao${f.provaDeEquipe === m ? " bc-opcao--escolhida" : ""}`}>
                          <input type="radio" name="equipe" checked={f.provaDeEquipe === m} onChange={() => mudar("provaDeEquipe", m)} />
                          <strong>🤝 {EQUIPE_ROTULO[m].nome}</strong>
                          <span>{EQUIPE_ROTULO[m].descricao}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <p className="pf-estat__nota">🛡️ A imunidade salva metade · 🤝 em equipe, o time vencedor fica salvo · 🔥 a eliminação é só de quem não se salvou · 🏆 a final é numa arena especial, com a torcida de todos. Toda prova dá uma insígnia ao vencedor.</p>
                </>
              ) : f.formato === "pontos-corridos" ? (
                <label className="pf-campo bc-criar__linha">
                  <span className="pf-campo__rotulo">Rodadas</span>
                  <select className="pf-campo__entrada" value={f.rodadas} onChange={(e) => mudar("rodadas", Number(e.target.value))}>
                    {opcoes.rodadasDosPontosCorridos.map((n) => <option key={n} value={n}>{n} rodadas</option>)}
                  </select>
                </label>
              ) : (
                <p className="pf-estat__nota">Com {f.total} competidores, o mata-mata tem {rodadasDoMataMata} rodadas (com número ímpar, o melhor colocado passa direto naquela rodada).</p>
              )}
            </section>

            <section className="pf-cartao bc-criar__bloco">
              <h2 className="bc-criar__titulo">Tempo e linguagens</h2>
              <div className="bc-criar__tempo">
                <label className="bc-chave">
                  <input type="checkbox" checked={f.usarTempo} onChange={(e) => mudar("usarTempo", e.target.checked)} />
                  <span>Limite de tempo em cada desafio</span>
                </label>
                {f.usarTempo && (
                  <select className="pf-campo__entrada bc-criar__minutos" aria-label="Minutos por desafio" value={f.tempoMin} onChange={(e) => mudar("tempoMin", Number(e.target.value))}>
                    {opcoes.tempos.map((n) => <option key={n} value={n}>{n} minutos</option>)}
                  </select>
                )}
                <p className="pf-estat__nota">{f.usarTempo ? "Quando o tempo acaba, os jurados avaliam o último código de cada um." : "Sem limite: a prova fecha quando todos enviarem (ou quando você encerrar)."}</p>
              </div>
              <hr className="bc-criar__divisor" />
              <div className="bc-criar__grupo">
                <span className="pf-campo__rotulo">Quem escolhe a linguagem</span>
                <div className="bc-opcoes" role="radiogroup" aria-label="Quem escolhe a linguagem">
                  <label className={`bc-opcao${f.modoLinguagem === "livre" ? " bc-opcao--escolhida" : ""}`}>
                    <input type="radio" name="linguagem" checked={f.modoLinguagem === "livre"} onChange={() => mudar("modoLinguagem", "livre")} />
                    <strong>🧰 Qualquer linguagem</strong>
                    <span>Cada competidor escolhe a sua em cada desafio.</span>
                  </label>
                  <label className={`bc-opcao${f.modoLinguagem === "jurados" ? " bc-opcao--escolhida" : ""}`}>
                    <input type="radio" name="linguagem" checked={f.modoLinguagem === "jurados"} onChange={() => mudar("modoLinguagem", "jurados")} />
                    <strong>⚖️ Os jurados estipulam</strong>
                    <span>Em cada desafio, os 3 jurados escolhem a linguagem de todos.</span>
                  </label>
                </div>
              </div>
              <div className="bc-criar__grupo">
                <span className="pf-campo__rotulo">Linguagens do torneio {f.permitidas.length ? `(${f.permitidas.length})` : "(todas)"}</span>
                <div className="bc-chips">
                  {opcoes.linguagens.map((l) => (
                    <button key={l.chave} type="button" className={`bc-chip${f.permitidas.includes(l.chave) ? " bc-chip--ativo" : ""}`} aria-pressed={f.permitidas.includes(l.chave)} onClick={() => alternar("permitidas", l.chave)}>
                      {l.rotulo}
                    </button>
                  ))}
                </div>
                <p className="pf-estat__nota">Nenhuma marcada = todas as que o Bootcamp roda. Os testes conferem a entrada (stdin) e a saída (stdout), então valem para qualquer linguagem.</p>
              </div>
            </section>

            <section className="pf-cartao bc-criar__bloco">
              <h2 className="bc-criar__titulo">Participantes</h2>
              <div className="bc-criar__duas">
                <label className="pf-campo">
                  <span className="pf-campo__rotulo">Competidores no torneio</span>
                  <select className="pf-campo__entrada" value={f.total} onChange={(e) => mudar("total", Number(e.target.value))}>
                    {Array.from({ length: opcoes.limites.max - opcoes.limites.min + 1 }, (_, i) => i + opcoes.limites.min).map((n) => (
                      <option key={n} value={n} disabled={n < 1 + f.convidados.length}>{n} competidores</option>
                    ))}
                  </select>
                </label>
                <div className="bc-criar__grupo">
                  <span className="pf-campo__rotulo">Convidar pessoas do Proof ({f.convidados.length})</span>
                  {opcoes.jogadores.length ? (
                    <>
                      <input className="pf-campo__entrada" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome" aria-label="Buscar jogador" />
                      <ul className="bc-jogadores">
                        {jogadores.map((j) => {
                          const marcado = f.convidados.includes(j.id);
                          const cheio = !marcado && 1 + f.convidados.length >= f.total;
                          return (
                            <li key={j.id}>
                              <label className={`bc-chave${cheio ? " bc-chave--travada" : ""}`}>
                                <input type="checkbox" checked={marcado} disabled={cheio} onChange={() => alternar("convidados", j.id)} />
                                <span>{j.nome}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  ) : <p className="pf-estat__nota">Ninguém do ranking para convidar agora: o torneio fica com você e os personagens da Lisa.</p>}
                </div>
              </div>

              <span className="pf-campo__rotulo">Personagens da Lisa ({f.npcs.length} escolhidos · {sorteados} sorteados)</span>
              <div className="bc-npcs">
                {opcoes.npcs.map((n) => {
                  const escolhido = f.npcs.includes(n.id);
                  const semVaga = !escolhido && f.npcs.length >= vagasDosPersonagens;
                  return (
                    <button key={n.id} type="button" className={`bc-npc${escolhido ? " bc-npc--escolhido" : ""}`} aria-pressed={escolhido}
                      disabled={!n.disponivel || semVaga} onClick={() => alternar("npcs", n.id)}
                      title={!n.disponivel ? "A skin dele é a que você usa: cada competidor tem a sua." : n.personalidade}>
                      <Neuro personagem={n.skin} humor={escolhido ? "feliz" : "normal"} tamanho={64} />
                      <strong>{n.nome}</strong>
                      <span className="bc-npc__personalidade">{n.personalidade}</span>
                      <em>“{n.bordao}”</em>
                      <StatusDoNpc status={n.status} especialidades={n.especialidades} catalogo={opcoes.especialidades} rotulos={opcoes.rotulosDeStatus} />
                    </button>
                  );
                })}
              </div>
              <p className="pf-estat__nota">
                Você{f.convidados.length ? ` + ${f.convidados.length} convidado(s)` : ""} + {Math.max(0, vagasDosPersonagens)} personagem(ns) da Lisa = {f.total} competidores, cada um com skin, nome e personalidade únicos. As vagas sem escolha são sorteadas.
              </p>
            </section>

            {vagasDosPersonagens > 0 && (
              <section className="pf-cartao bc-criar__bloco">
                <h2 className="bc-criar__titulo">Nível do torneio contra a CPU</h2>
                <div className="bc-opcoes bc-opcoes--quatro" role="radiogroup" aria-label="Nível">
                  {opcoes.niveis.map((n) => (
                    <label key={n.id} className={`bc-opcao${f.nivel === n.id ? " bc-opcao--escolhida" : ""}`}>
                      <input type="radio" name="nivel" value={n.id} checked={f.nivel === n.id} onChange={() => mudar("nivel", n.id)} />
                      <strong>{n.emoji} {n.nome}</strong>
                      <span>{n.descricao}</span>
                    </label>
                  ))}
                </div>
                <p className="pf-estat__nota">O nível muda a habilidade e a rapidez dos personagens da Lisa e a dificuldade dos desafios dos jurados.</p>
              </section>
            )}

            <section className="pf-cartao bc-criar__bloco">
              <h2 className="bc-criar__titulo">Cenário do escritório</h2>
              <div className="bc-cenarios-grade" role="radiogroup" aria-label="Cenário">
                {opcoes.cenarios.map((c) => (
                  <label key={c.id} className={`bc-cenario bc-cenario--${c.id}${f.cenario === c.id ? " bc-cenario--escolhido" : ""}`}>
                    <input type="radio" name="cenario" value={c.id} checked={f.cenario === c.id} onChange={() => mudar("cenario", c.id)} />
                    <span className="bc-cenario__previa" aria-hidden="true">{c.emoji}</span>
                    <strong>{c.nome}</strong>
                    <span>{c.descricao}</span>
                  </label>
                ))}
              </div>
              <p className="pf-estat__nota">É o cenário que abre para todo mundo; na arena, cada competidor pode trocar o da própria tela.</p>
            </section>
          </div>

          <aside className="bc-criar__resumo">
            <section className="pf-cartao bc-resumo" aria-label="Resumo do torneio">
              <h2 className="bc-criar__titulo">🏁 Seu torneio</h2>
              <label className="pf-campo">
                <span className="pf-campo__rotulo">Nome do torneio</span>
                <input className="pf-campo__entrada" value={f.nome} onChange={(e) => mudar("nome", e.target.value)} maxLength={60} placeholder="Ex.: Temporada de Algoritmos" required />
              </label>
              <dl className="bc-resumo__lista">
                <dt>Formato</dt><dd>{EMOJI_DO_FORMATO[f.formato]} {formato?.nome}</dd>
                {temporada && <><dt>Ritmo</dt><dd>{f.eliminadosPorEpisodio === 1 ? "sai 1 por episódio" : "saem até 2 por episódio"}</dd></>}
                {temporada && <><dt>Em equipe</dt><dd>{EQUIPE_ROTULO[f.provaDeEquipe].nome}</dd></>}
                {f.formato === "pontos-corridos" && <><dt>Rodadas</dt><dd>{f.rodadas}</dd></>}
                {f.formato === "mata-mata" && <><dt>Rodadas</dt><dd>{rodadasDoMataMata}</dd></>}
                <dt>Competidores</dt>
                <dd>{f.total}: você{f.convidados.length ? ` + ${f.convidados.length} convidado(s)` : ""}{vagasDosPersonagens > 0 ? ` + ${vagasDosPersonagens} da Lisa` : ""}</dd>
                {vagasDosPersonagens > 0 && <><dt>Nível</dt><dd>{nivel?.emoji} {nivel?.nome}</dd></>}
                <dt>Cenário</dt><dd>{cenario?.emoji} {cenario?.nome}</dd>
                <dt>Tempo</dt><dd>{f.usarTempo ? `${f.tempoMin} min por desafio` : "sem limite"}</dd>
                <dt>Linguagem</dt><dd>{f.modoLinguagem === "jurados" ? "os jurados escolhem" : "livre"} · {f.permitidas.length || "todas"}</dd>
              </dl>
              {temporada && (
                <div className="bc-criar__grupo">
                  <span className="pf-campo__rotulo">As {plano.length} provas da temporada</span>
                  <ol className="bc-temporada bc-temporada--previa bc-temporada--compacta">
                    {plano.map((p) => (
                      <li key={p.numero} className={`bc-temporada__prova bc-temporada__prova--depois bc-temporada__prova--${p.tipo}`} title={opcoes.tiposDeProva[p.tipo]?.nome}>
                        <span aria-hidden="true">{opcoes.tiposDeProva[p.tipo]?.emoji}</span>
                        <small>{p.tipo === "final" ? "Final" : `Ep. ${p.episodio}`}</small>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {erro && <div className="pf-aviso pf-aviso--erro" role="alert">{erro}</div>}
              <button type="submit" className="pf-botao bc-resumo__criar" disabled={enviando}>{enviando ? "Montando o escritório…" : "🏁 Criar o torneio"}</button>
            </section>
          </aside>
        </form>
      )}
    </div>
  );
}
