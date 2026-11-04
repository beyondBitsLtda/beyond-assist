"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { obter, criar } from "@/lib/api.js";
import Neuro from "@/componentes/Neuro.js";

/**
 * A configuração de um torneio novo do Modo Bootcamp: o formato (mata-mata ou pontos corridos), o tempo por
 * desafio (opcional), as linguagens (livres ou estipuladas pelos jurados) e os participantes — você, quem você
 * convidar do Proof e os personagens da Lisa para completar até 8.
 */
export default function CriarTorneio() {
  const router = useRouter();
  const [opcoes, setOpcoes] = useState(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [busca, setBusca] = useState("");
  const [f, setF] = useState({
    nome: "", formato: "mata-mata", rodadas: 3, usarTempo: false, tempoMin: 30,
    modoLinguagem: "livre", permitidas: [], total: 8, convidados: [], npcs: [],
  });
  const mudar = (campo, valor) => setF((x) => ({ ...x, [campo]: valor }));
  const alternar = (campo, valor) => setF((x) => ({ ...x, [campo]: x[campo].includes(valor) ? x[campo].filter((v) => v !== valor) : [...x[campo], valor] }));

  useEffect(() => { obter("/api/bootcamp").then((d) => setOpcoes(d.opcoes)).catch((e) => setErro(e.message)); }, []);

  const vagasDosPersonagens = f.total - 1 - f.convidados.length;
  const sorteados = Math.max(0, vagasDosPersonagens - f.npcs.length);
  const rodadasDoMataMata = Math.ceil(Math.log2(Math.max(2, f.total)));
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
      });
      router.push(`/bootcamp/arena/${id}`);
    } catch (e2) {
      setErro(e2.message);
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>Novo torneio</h1>
          <p>Monte a temporada: o formato, o tempo, as linguagens e quem vai disputar as 8 baias do escritório.</p>
        </div>
        <Link href="/bootcamp" className="pf-botao pf-botao--sec">← Bootcamp</Link>
      </div>
      {erro && <div className="pf-aviso pf-aviso--erro" role="alert">{erro}</div>}
      {!opcoes && !erro && <p className="pf-estat__nota">Carregando as opções…</p>}

      {opcoes && (
        <form className="bc-criar" onSubmit={enviar}>
          <section className="pf-cartao bc-criar__bloco">
            <label className="pf-campo">
              <span className="pf-campo__rotulo">Nome do torneio</span>
              <input className="pf-campo__entrada" value={f.nome} onChange={(e) => mudar("nome", e.target.value)} maxLength={60} placeholder="Ex.: Temporada de Algoritmos" required />
            </label>
          </section>

          <section className="pf-cartao bc-criar__bloco">
            <h2 className="bc-criar__titulo">Formato de disputa</h2>
            <div className="bc-opcoes" role="radiogroup" aria-label="Formato">
              {opcoes.formatos.map((o) => (
                <label key={o.id} className={`bc-opcao${f.formato === o.id ? " bc-opcao--escolhida" : ""}`}>
                  <input type="radio" name="formato" value={o.id} checked={f.formato === o.id} onChange={() => mudar("formato", o.id)} />
                  <strong>{o.id === "mata-mata" ? "⚔️" : "📊"} {o.nome}</strong>
                  <span>{o.descricao}</span>
                </label>
              ))}
            </div>
            {f.formato === "pontos-corridos" ? (
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
            <h2 className="bc-criar__titulo">Controle de tempo</h2>
            <label className="bc-chave">
              <input type="checkbox" checked={f.usarTempo} onChange={(e) => mudar("usarTempo", e.target.checked)} />
              <span>Usar limite de tempo em cada desafio</span>
            </label>
            {f.usarTempo && (
              <label className="pf-campo bc-criar__linha">
                <span className="pf-campo__rotulo">Minutos por desafio</span>
                <select className="pf-campo__entrada" value={f.tempoMin} onChange={(e) => mudar("tempoMin", Number(e.target.value))}>
                  {opcoes.tempos.map((n) => <option key={n} value={n}>{n} minutos</option>)}
                </select>
              </label>
            )}
            <p className="pf-estat__nota">{f.usarTempo ? "Quando o tempo acaba, as entregas fecham e os jurados avaliam o que cada um testou até ali." : "Sem limite: a rodada fecha quando todos enviarem ou quando você chamar os jurados."}</p>
          </section>

          <section className="pf-cartao bc-criar__bloco">
            <h2 className="bc-criar__titulo">Linguagens</h2>
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
            <span className="pf-campo__rotulo">Linguagens do torneio {f.permitidas.length ? `(${f.permitidas.length})` : "(todas)"}</span>
            <div className="bc-chips">
              {opcoes.linguagens.map((l) => (
                <button key={l.chave} type="button" className={`bc-chip${f.permitidas.includes(l.chave) ? " bc-chip--ativo" : ""}`} aria-pressed={f.permitidas.includes(l.chave)} onClick={() => alternar("permitidas", l.chave)}>
                  {l.rotulo}
                </button>
              ))}
            </div>
            <p className="pf-estat__nota">Nenhuma marcada = todas as que o Bootcamp roda. Os testes conferem a entrada (stdin) e a saída (stdout), então valem para qualquer linguagem.</p>
          </section>

          <section className="pf-cartao bc-criar__bloco">
            <h2 className="bc-criar__titulo">Participantes</h2>
            <label className="pf-campo bc-criar__linha">
              <span className="pf-campo__rotulo">Competidores no torneio</span>
              <select className="pf-campo__entrada" value={f.total} onChange={(e) => mudar("total", Number(e.target.value))}>
                {Array.from({ length: opcoes.limites.max - opcoes.limites.min + 1 }, (_, i) => i + opcoes.limites.min).map((n) => (
                  <option key={n} value={n} disabled={n < 1 + f.convidados.length}>{n} competidores</option>
                ))}
              </select>
            </label>

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
                  </button>
                );
              })}
            </div>
            <p className="pf-estat__nota">
              Você{f.convidados.length ? ` + ${f.convidados.length} convidado(s)` : ""} + {Math.max(0, vagasDosPersonagens)} personagem(ns) da Lisa = {f.total} competidores, cada um com skin, nome e personalidade únicos. As vagas sem escolha são sorteadas.
            </p>
          </section>

          <div className="bc-criar__fim">
            <button type="submit" className="pf-botao" disabled={enviando}>{enviando ? "Montando o escritório…" : "🏁 Criar o torneio"}</button>
          </div>
        </form>
      )}
    </>
  );
}
