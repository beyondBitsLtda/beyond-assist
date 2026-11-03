"use client";

import { useEffect, useState } from "react";
import { obter } from "@/lib/api.js";
import { NOMES_DOS_DESAFIOS } from "@/dominio/pratica.js";

const numero = (n) => new Intl.NumberFormat("pt-BR").format(Math.round(n || 0));
const quando = (iso) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const ICONE_DA_ACAO = { curso: "🎓", mina: "⛏️", teoria: "📖", quiz: "❓", exercicio: "✍️", projeto: "🧩", reino: "🏰", bolsa: "📈", caderno: "📓", acervo: "🏛️", conta: "👋" };
const STATUS_DO_ACERVO = { pendente: "esperando aprovação", aprovado: "aprovado", recusado: "recusado", retirado: "retirado" };

/**
 * A Lisa jogadora (BEYOND-0014): ela estuda e joga no Proof como qualquer pessoa — um curso de tecnologia
 * por mês, o quiz e o exercício do dia, o Reino, a Bolsa, o caderno e o Acervo — e tudo fica aqui para
 * todos verem. Quem joga é a rotina do relógio (scripts/lisa-joga.mjs); esta tela só mostra.
 */
export default function LisaJoga() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => { obter("/api/lisa").then(setDados).catch((e) => setErro(e.message)); }, []);

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>🤖 A Lisa joga</h1>
          <p>A Lisa estuda e joga no Proof como qualquer pessoa: um curso de tecnologia por mês, o quiz e o exercício do dia, o Reino, a Bolsa, o caderno e o Acervo. Ela erra, aprende e melhora com o tempo — e tudo o que faz fica aqui.</p>
        </div>
        {dados?.existe && <BotaoDeEspiar />}
      </div>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      {!dados && !erro && <p className="pf-estat__nota">Carregando…</p>}
      {dados && !dados.existe && <div className="pf-cartao"><p className="pf-estat__nota">A Lisa ainda não entrou no jogo. Volte em breve!</p></div>}
      {dados?.existe && <Painel d={dados} />}
    </>
  );
}

function Painel({ d }) {
  const curso = d.cursos[0];
  const construcoes = Object.entries(d.reino?.construcoes || {}).filter(([, n]) => Number(n) > 0);
  return (
    <>
      <div className="lj-numeros">
        <Numero rotulo="Pontos" valor={numero(d.pontos)} />
        <Numero rotulo="Ofensiva" valor={`🔥 ${numero(d.ofensiva?.atual ?? d.ofensiva ?? 0)}`} nota="dias seguidos" />
        <Numero rotulo="Moedas" valor={d.saldo == null ? "—" : `🪙 ${numero(d.saldo)}`} />
        <Numero rotulo="Troféus" valor={`🏆 ${numero(d.reino?.trofeus)}`} />
      </div>

      <div className="lj-grade">
        <section className="pf-cartao lj-bloco">
          <h2 className="lj-bloco__titulo">🎓 Curso do mês</h2>
          {curso ? <p className="lj-destaque">{curso.tema}</p> : <p className="pf-estat__nota">Escolhendo o próximo curso.</p>}
          {curso && <p className="pf-estat__nota">desde {curso.inicio.split("-").reverse().join("/")}</p>}
          {d.cursos.length > 1 && <p className="pf-estat__nota">Antes: {d.cursos.slice(1).map((c) => c.tema).join(", ")}</p>}
        </section>

        <section className="pf-cartao lj-bloco">
          <h2 className="lj-bloco__titulo">🩻 Raio-X</h2>
          <ul className="lj-lista">
            <li>Quizzes: <strong>{d.raioX.quizzes}</strong>{d.raioX.mediaDoQuiz != null && <> · média <strong>{d.raioX.mediaDoQuiz}</strong></>}</li>
            <li>Exercícios: <strong>{d.raioX.exercicios}</strong>{d.raioX.mediaDoExercicio != null && <> · média <strong>{d.raioX.mediaDoExercicio}</strong></>}</li>
            <li>Projetos entregues: <strong>{d.raioX.projetos}</strong></li>
          </ul>
        </section>

        <section className="pf-cartao lj-bloco">
          <h2 className="lj-bloco__titulo">🏰 {d.reino?.nome || "Reino"}</h2>
          {d.reino ? (
            <ul className="lj-lista lj-lista--chips">
              <li className="pf-pilula">Neuro nível {d.reino.neuro}</li>
              {construcoes.map(([chave, n]) => <li key={chave} className="pf-pilula">{chave} {n}</li>)}
            </ul>
          ) : <p className="pf-estat__nota">O reino ainda vai ser fundado.</p>}
        </section>

        <section className="pf-cartao lj-bloco">
          <h2 className="lj-bloco__titulo">📈 Carteira na Bolsa</h2>
          {d.carteira.length ? (
            <ul className="lj-lista">{d.carteira.map((p) => <li key={p.acao}><strong>{p.acao}</strong> · {p.quantidade} {p.quantidade === 1 ? "ação" : "ações"} (pagou 🪙 {numero(p.custo)})</li>)}</ul>
          ) : <p className="pf-estat__nota">Nenhuma ação na carteira agora.</p>}
        </section>

        <section className="pf-cartao lj-bloco">
          <h2 className="lj-bloco__titulo">📓 Cadernos</h2>
          {d.cadernos.length ? <ul className="lj-lista">{d.cadernos.map((c, i) => <li key={i}>{c.icone} {c.titulo}</li>)}</ul> : <p className="pf-estat__nota">Nenhum caderno ainda.</p>}
        </section>

        <section className="pf-cartao lj-bloco">
          <h2 className="lj-bloco__titulo">🏛️ No Acervo</h2>
          {d.acervo.length ? (
            <ul className="lj-lista">
              {d.acervo.map((m, i) => (
                <li key={i}>{m.link ? <a href={m.link} target="_blank" rel="noreferrer">{m.titulo}</a> : m.titulo} <span className="pf-estat__nota">· {m.tipo}, {STATUS_DO_ACERVO[m.status] || m.status}</span></li>
              ))}
            </ul>
          ) : <p className="pf-estat__nota">Ela manda vídeos e artigos todo domingo.</p>}
        </section>
      </div>

      {d.ultimosDesafios.length > 0 && (
        <section className="pf-secao">
          <h2 className="pf-secao__titulo">Últimas notas</h2>
          <div className="pf-cartao">
            <ul className="lj-lista">
              {d.ultimosDesafios.map((x, i) => (
                <li key={i}>{x.dia.split("-").reverse().slice(0, 2).join("/")} · {NOMES_DOS_DESAFIOS[x.tipo] || x.tipo}{x.titulo ? ` — ${x.titulo}` : ""}: <strong>{x.nota ?? "em andamento"}</strong></li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="pf-secao">
        <h2 className="pf-secao__titulo">O que ela fez</h2>
        {d.diario.length ? (
          <ol className="lj-diario">
            {d.diario.map((x, i) => (
              <li key={i} className="lj-diario__linha">
                <span className="lj-diario__icone" aria-hidden="true">{ICONE_DA_ACAO[x.acao] || "•"}</span>
                <span><span className="lj-diario__quando">{quando(x.criado_em)}</span> {x.resumo}</span>
              </li>
            ))}
          </ol>
        ) : <div className="pf-cartao"><p className="pf-estat__nota">Nada ainda.</p></div>}
      </section>
    </>
  );
}

/** Entra no Proof da Lisa: as mesmas telas (Reino, trilhas, cadernos, prática, Bolsa, Raio-X), com os dados dela, só para olhar. */
function BotaoDeEspiar() {
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState("");
  async function entrar() {
    setEntrando(true);
    try {
      const r = await fetch("/api/espiar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ligar: true }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      window.location.href = "/reino";
    } catch (e) { setErro(e.message); setEntrando(false); }
  }
  return (
    <div className="lj-espiar">
      <button type="button" className="pf-botao" onClick={entrar} disabled={entrando}>{entrando ? "Entrando…" : "👀 Ver tudo da Lisa por dentro"}</button>
      <span className="pf-estat__nota">O Reino, as trilhas, os cadernos e a Prática dela, nas mesmas telas que as suas.</span>
      {erro && <span className="pf-aviso pf-aviso--erro">{erro}</span>}
    </div>
  );
}

function Numero({ rotulo, valor, nota }) {
  return (
    <div className="pf-cartao lj-numero">
      <div className="pf-estat__rotulo">{rotulo}</div>
      <div className="pf-estat__valor">{valor}</div>
      {nota && <p className="pf-estat__nota">{nota}</p>}
    </div>
  );
}
