"use client";

// A Lisa Task leve (01/11/2026, o MVP — "Lisa Task (Integração Abacato)": gestão funcional, identidade
// da Lisa, sem hospedagem de arquivos). As tarefas da pessoa, só texto: criar, priorizar, lembrete,
// marcar como feita, apagar. Também dá para criar falando com a Lisa ("crie uma tarefa: …") — a
// conversa do usuário grava aqui (src/app/api/ask/route.js). Dados: /api/lisa-task, por dono.

import { useCallback, useEffect, useState } from "react";

const PRIORIDADES = [{ id: "alta", nome: "Alta" }, { id: "normal", nome: "Normal" }, { id: "baixa", nome: "Baixa" }];

const quando = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

async function chamar(url, metodo = "GET", corpo) {
  const r = await fetch(url, {
    method: metodo,
    headers: corpo === undefined ? undefined : { "content-type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export default function LisaTaskPage() {
  const [tarefas, setTarefas] = useState(null);
  const [erro, setErro] = useState("");
  const [titulo, setTitulo] = useState("");
  const [prioridade, setPrioridade] = useState("normal");
  const [lembrete, setLembrete] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const j = await chamar("/api/lisa-task");
      setTarefas(j.tarefas || []);
      setErro("");
    } catch (err) {
      setErro(`Não consegui carregar as tarefas (${err.message}).`);
      setTarefas((t) => t || []);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function criar(e) {
    e.preventDefault();
    const t = titulo.trim();
    if (!t || ocupado) return;
    setOcupado(true);
    try {
      await chamar("/api/lisa-task", "POST", { titulo: t, prioridade, lembreteEm: lembrete ? new Date(lembrete).toISOString() : null });
      setTitulo("");
      setLembrete("");
      setPrioridade("normal");
      await carregar();
    } catch (err) {
      setErro(`Não consegui criar a tarefa (${err.message}).`);
    } finally {
      setOcupado(false);
    }
  }

  async function mudar(t, dados) {
    setTarefas((ts) => ts.map((x) => (x.id === t.id ? { ...x, ...dados } : x)));
    try {
      await chamar(`/api/lisa-task/${t.id}`, "PATCH", dados);
      await carregar();
    } catch (err) {
      setErro(`Não consegui mudar a tarefa (${err.message}).`);
      await carregar();
    }
  }

  async function apagar(t) {
    setTarefas((ts) => ts.filter((x) => x.id !== t.id));
    try {
      await chamar(`/api/lisa-task/${t.id}`, "DELETE");
    } catch (err) {
      setErro(`Não consegui apagar a tarefa (${err.message}).`);
      await carregar();
    }
  }

  const abertas = (tarefas || []).filter((t) => t.status !== "feita");
  const feitas = (tarefas || []).filter((t) => t.status === "feita");

  const Item = ({ t }) => (
    <li className="bb-lt-item" data-feita={t.status === "feita" ? "sim" : "nao"} data-prioridade={t.prioridade}>
      <input type="checkbox" id={`lt-${t.id}`} checked={t.status === "feita"} onChange={() => mudar(t, { status: t.status === "feita" ? "aberta" : "feita" })} />
      <label htmlFor={`lt-${t.id}`} className="bb-lt-titulo">{t.titulo}</label>
      {t.prioridade === "alta" && t.status !== "feita" && <span className="bb-lt-chip">alta</span>}
      {t.lembreteEm && t.status !== "feita" && <span className="bb-lt-quando" title="Lembrete">⏰ {quando(t.lembreteEm)}</span>}
      <select className="bb-lt-prioridade" value={t.prioridade} aria-label={`prioridade de ${t.titulo}`} onChange={(e) => mudar(t, { prioridade: e.target.value })} disabled={t.status === "feita"}>
        {PRIORIDADES.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
      <button type="button" className="bb-lt-apagar" onClick={() => apagar(t)} aria-label={`apagar ${t.titulo}`} title="Apagar">×</button>
    </li>
  );

  return (
    <div className="bb-lt">
      <header className="bb-lt-topo">
        <h1>Lisa Task</h1>
        <p>Suas tarefas, só texto. Você também pode pedir à Lisa no Assistente: &quot;crie uma tarefa: revisar o PR&quot; ou &quot;me lembra de estudar React&quot;.</p>
      </header>

      <form className="bb-lt-nova" onSubmit={criar}>
        <input id="lt-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} placeholder="Nova tarefa…" aria-label="título da tarefa nova" />
        <select id="lt-prioridade" value={prioridade} onChange={(e) => setPrioridade(e.target.value)} aria-label="prioridade">
          {PRIORIDADES.map((p) => <option key={p.id} value={p.id}>Prioridade {p.nome.toLowerCase()}</option>)}
        </select>
        <input id="lt-lembrete" type="datetime-local" value={lembrete} onChange={(e) => setLembrete(e.target.value)} aria-label="lembrete (opcional)" title="Lembrete (opcional)" />
        <button type="submit" className="bb-fluxos-botao bb-fluxos-botao--lisa" disabled={ocupado || !titulo.trim()}>{ocupado ? "Criando…" : "Adicionar"}</button>
      </form>

      {erro && <p className="bb-lt-erro" role="alert">{erro}</p>}

      {tarefas === null ? (
        <p className="bb-lt-vazio">Carregando suas tarefas…</p>
      ) : !tarefas.length ? (
        <p className="bb-lt-vazio">Nenhuma tarefa ainda. Crie a primeira aqui em cima, ou peça à Lisa no Assistente.</p>
      ) : (
        <>
          <section className="bb-lt-secao">
            <h2>Abertas <small>{abertas.length}</small></h2>
            {abertas.length ? <ul>{abertas.map((t) => <Item key={t.id} t={t} />)}</ul> : <p className="bb-lt-vazio">Tudo feito.</p>}
          </section>
          {feitas.length > 0 && (
            <section className="bb-lt-secao">
              <h2>Feitas <small>{feitas.length}</small></h2>
              <ul>{feitas.map((t) => <Item key={t.id} t={t} />)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
