"use client";

// Os cartões com repetição espaçada (31/10/2026): a revisão de hoje, cartão a cartão (frente, virar,
// esqueci/difícil/lembrei/fácil), e a pilha de cada trilha (a Lisa cria os do assunto da vez; a
// pessoa escreve os dela). As regras moram em src/dominio/cartoes.js.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { obter, criar, remover } from "@/lib/api.js";
import { formatarDia } from "@/dominio/datas.js";
import { PERFIS } from "@/dominio/perfis.js";
import { RESPOSTAS_DO_CARTAO, ORDEM_DAS_RESPOSTAS, LIMITES_DOS_CARTOES, PONTOS_DOS_CARTOES, previsoes, quandoVolta, revisarCartao } from "@/dominio/cartoes.js";
import { reagir, comemorar, celebrar } from "@/componentes/Neuro.js";
import { Barra, useAviso } from "@/componentes/Pecas.js";

// ------------------------------------------------------------------ a revisão

function Revisao({ hoje, inicial, aoTerminar, avisar }) {
  const [fila, setFila] = useState(inicial);
  const [virado, setVirado] = useState(false);
  const [feitos, setFeitos] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const atual = fila[0];
  const total = inicial.length;

  const responder = useCallback(async (resposta) => {
    if (!atual || enviando || !virado) return;
    setEnviando(true);
    setErro("");
    try {
      const r = await criar(`/api/cartoes/${atual.id}`, { resposta });
      if (r.pontos > 0) { if (!celebrar(r)) avisar(`+${r.pontos} pontos`); }
      // esqueceu: o cartão volta no fim da fila de hoje, com a agenda nova (como no Anki)
      const resto = fila.slice(1);
      const proxima = resposta === "esqueci" ? [...resto, { ...atual, ...revisarCartao(atual, resposta, hoje), revisadoEm: new Date().toISOString() }] : resto;
      if (resposta !== "esqueci") setFeitos((n) => n + 1);
      setFila(proxima);
      setVirado(false);
      if (!proxima.length) {
        comemorar("Revisão do dia completa! 🎉");
        aoTerminar();
      }
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }, [atual, enviando, virado, fila, hoje, avisar, aoTerminar]);

  useEffect(() => {
    const tecla = (ev) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
      if (ev.code === "Space" && !virado) { ev.preventDefault(); setVirado(true); }
      const n = Number(ev.key);
      if (virado && n >= 1 && n <= 4) responder(ORDEM_DAS_RESPOSTAS[n - 1]);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [virado, responder]);

  if (!atual) return null;
  const dias = previsoes(atual, hoje);
  return (
    <section className="pf-cartao cartoes__revisao" aria-label="Revisão de hoje">
      <Barra valor={feitos} total={total} rotulo="Cartões revisados hoje" />
      <small className="pf-estat__nota" style={{ margin: 0 }}>{feitos} de {total}{fila.length > total - feitos ? ` · ${fila.length - (total - feitos)} para rever` : ""} · {atual.tema}</small>
      <button type="button" className={`cartoes__cartao${virado ? " cartoes__cartao--virado" : ""}`} onClick={() => setVirado(true)} aria-live="polite">
        <span className="cartoes__frente">{atual.frente}</span>
        {virado ? (
          <>
            <span className="cartoes__verso">{atual.verso}</span>
            {atual.exemplo && <span className="cartoes__exemplo">{atual.exemplo}</span>}
          </>
        ) : <span className="cartoes__dica">Pense na resposta e toque para virar (ou barra de espaço)</span>}
      </button>
      {virado && (
        <div className="cartoes__respostas" role="group" aria-label="Como foi?">
          {ORDEM_DAS_RESPOSTAS.map((r, i) => (
            <button key={r} type="button" className={`cartoes__resposta cartoes__resposta--${r}`} disabled={enviando} onClick={() => responder(r)}>
              <strong>{RESPOSTAS_DO_CARTAO[r].nome}</strong>
              <small>{quandoVolta(dias[r])} · {i + 1}</small>
            </button>
          ))}
        </div>
      )}
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
    </section>
  );
}

// ------------------------------------------------------------------ a pilha de uma trilha

function NovoCartao({ trilha, aoCriar }) {
  const [frente, setFrente] = useState("");
  const [verso, setVerso] = useState("");
  const [exemplo, setExemplo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      await criar("/api/cartoes", { trilhaId: trilha.id, frente, verso, exemplo });
      setFrente(""); setVerso(""); setExemplo("");
      aoCriar("Cartão criado — ele entra na revisão de hoje.");
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setEnviando(false);
    }
  }
  return (
    <form className="cartoes__novo" onSubmit={enviar}>
      <label className="pf-campo">
        <span className="pf-campo__rotulo">Frente</span>
        <input className="pf-campo__entrada" value={frente} maxLength={LIMITES_DOS_CARTOES.frente} onChange={(e) => setFrente(e.target.value)} required
          placeholder={trilha.perfil === "idiomas" ? "a palavra na língua (ex.: to borrow)" : "a pergunta ou o termo"} />
      </label>
      <label className="pf-campo">
        <span className="pf-campo__rotulo">Verso</span>
        <textarea className="pf-campo__entrada" rows={2} value={verso} maxLength={LIMITES_DOS_CARTOES.verso} onChange={(e) => setVerso(e.target.value)} required
          placeholder={trilha.perfil === "idiomas" ? "a tradução (ex.: pegar emprestado)" : "a resposta"} />
      </label>
      <label className="pf-campo">
        <span className="pf-campo__rotulo">Exemplo (opcional)</span>
        <input className="pf-campo__entrada" value={exemplo} maxLength={LIMITES_DOS_CARTOES.exemplo} onChange={(e) => setExemplo(e.target.value)} />
      </label>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      <div className="pf-acoes"><button type="submit" className="pf-botao pf-botao--pequeno" disabled={enviando}>{enviando ? "Salvando…" : "Salvar cartão"}</button></div>
    </form>
  );
}

function ListaDaTrilha({ trilha, aoMudar }) {
  const [cartoes, setCartoes] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    obter(`/api/cartoes?trilha=${trilha.id}`).then((r) => setCartoes(r.cartoes)).catch((e) => setErro(e.message));
  }, [trilha.id, trilha.total]);
  async function apagar(c) {
    if (!window.confirm(`Apagar o cartão "${c.frente}"?`)) return;
    try {
      await remover(`/api/cartoes/${c.id}`);
      setCartoes((cs) => cs.filter((x) => x.id !== c.id));
      aoMudar();
    } catch (e) {
      setErro(e.message);
    }
  }
  if (erro) return <div className="pf-aviso pf-aviso--erro">{erro}</div>;
  if (!cartoes) return <small className="pf-estat__nota">Carregando…</small>;
  if (!cartoes.length) return <small className="pf-estat__nota">Nenhum cartão ainda.</small>;
  return (
    <ul className="cartoes__lista">
      {cartoes.map((c) => (
        <li key={c.id}>
          <span><strong>{c.frente}</strong> — {c.verso}</span>
          <small>{c.novo ? "novo" : `volta ${formatarDia(c.proximaEm)}`}{c.origem === "pessoa" ? " · seu" : ""}</small>
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" aria-label={`Apagar o cartão ${c.frente}`} onClick={() => apagar(c)}>Apagar</button>
        </li>
      ))}
    </ul>
  );
}

function PilhaDaTrilha({ trilha, iaDisponivel, aoMudar, avisar }) {
  const [aberto, setAberto] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");
  async function pedirALisa() {
    setCriando(true);
    setErro("");
    reagir("pensando", "Escolhendo o que vale a pena lembrar…", 30000);
    try {
      const r = await criar("/api/cartoes", { trilhaId: trilha.id });
      comemorar(`${r.criados} cartões novos de ${r.assunto}!`);
      aoMudar();
    } catch (e) {
      setErro(e.message);
      reagir("triste", "Não deu agora. Tenta de novo daqui a pouco?");
    } finally {
      setCriando(false);
    }
  }
  return (
    <section className="pf-cartao cartoes__trilha">
      <h3>{PERFIS[trilha.perfil]?.emoji} {trilha.tema}</h3>
      <p className="pf-estat__nota" style={{ margin: 0 }}>
        {trilha.total ? `${trilha.total} cartões · ${trilha.hoje} para hoje · ${trilha.novos} novos · ${trilha.firmes} firmes (21+ dias)` : "Nenhum cartão ainda."}
        {trilha.total > 0 && !trilha.hoje && trilha.proxima ? ` · o próximo volta ${formatarDia(trilha.proxima)}` : ""}
      </p>
      <div className="pf-acoes">
        <button type="button" className="pf-botao pf-botao--pequeno" disabled={criando || !iaDisponivel} onClick={pedirALisa}>{criando ? "A Lisa está criando…" : "✨ Cartões do assunto da vez"}</button>
        <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" aria-expanded={aberto === "novo"} onClick={() => setAberto(aberto === "novo" ? "" : "novo")}>＋ Escrever um cartão</button>
        {trilha.total > 0 && <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" aria-expanded={aberto === "lista"} onClick={() => setAberto(aberto === "lista" ? "" : "lista")}>Ver todos</button>}
      </div>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      {aberto === "novo" && <NovoCartao trilha={trilha} aoCriar={(t) => { avisar(t); aoMudar(); }} />}
      {aberto === "lista" && <ListaDaTrilha trilha={trilha} aoMudar={aoMudar} />}
    </section>
  );
}

// ------------------------------------------------------------------ a página

export default function Cartoes() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [Aviso, avisar] = useAviso();
  const carregar = useCallback(() => obter("/api/cartoes").then(setDados).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);

  if (!dados) return erro ? <div className="pf-aviso pf-aviso--erro">{erro}</div> : <div className="pf-carregando">Embaralhando os cartões…</div>;

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>Cartões</h1>
          <p>Frente e verso com repetição espaçada: cada cartão volta no dia em que você ia esquecer. Quanto melhor você lembra, mais tempo ele demora a voltar. Cada cartão revisado vale {PONTOS_DOS_CARTOES.porCartao} pontos, até {PONTOS_DOS_CARTOES.tetoPorDia} por dia.</p>
        </div>
      </div>

      {revisando && dados.revisao.length > 0 ? (
        <Revisao hoje={dados.hoje} inicial={dados.revisao} avisar={avisar} aoTerminar={() => { setRevisando(false); carregar(); }} />
      ) : (
        <section className="pf-cartao cartoes__hoje">
          {dados.revisao.length > 0 ? (
            <>
              <strong>{dados.revisao.length} cartão{dados.revisao.length > 1 ? "es" : ""} para revisar hoje</strong>
              <button type="button" className="pf-botao" onClick={() => setRevisando(true)}>Começar a revisão</button>
            </>
          ) : (
            <strong>{dados.trilhas.some((t) => t.total) ? "Nada para revisar agora — volte amanhã. ✅" : "Crie os primeiros cartões numa trilha abaixo."}</strong>
          )}
          {dados.revisadosHoje > 0 && <small className="pf-estat__nota" style={{ margin: 0 }}>Hoje: {dados.revisadosHoje} revisados · +{dados.pontosHoje} pontos</small>}
        </section>
      )}

      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      {!dados.trilhas.length ? (
        <div className="pf-cartao pf-vazio" style={{ marginTop: 16 }}>
          <h2>Nenhuma trilha ativa</h2>
          <p>Os cartões nascem dos assuntos das suas trilhas.</p>
          <Link className="pf-botao" href="/trilhas">Montar trilha</Link>
        </div>
      ) : (
        <div className="cartoes__trilhas">
          {dados.trilhas.map((t) => <PilhaDaTrilha key={t.id} trilha={t} iaDisponivel={dados.iaDisponivel} avisar={avisar} aoMudar={carregar} />)}
        </div>
      )}
      {Aviso}
    </>
  );
}
