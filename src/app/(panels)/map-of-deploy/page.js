"use client";

import { useCallback, useEffect, useState } from "react";
import { CY, GR, OR, PU, mono } from "@/lib/theme.js";
import { desde } from "@/lib/mapOfDeploy.js";

/**
 * "Map of Deploy": o quadro do Trello que diz onde cada aplicação está hospedada, com o estado
 * de cada uma por cima.
 *
 * O mapa continua sendo o Trello — coluna é o servidor, etiqueta é a conta, descrição é o
 * link. Este painel não edita nada disso: ele lê o quadro e acrescenta o que o Trello não sabe,
 * que é se a aplicação respondeu. O histórico vem das checagens periódicas
 * (/api/cron/deploy-check), e é dele que saem uptime e número de quedas.
 *
 * Clicar num card abre a pré-visualização do deploy num iframe. Boa parte das hospedagens
 * recusa ser embutida (X-Frame-Options), então há sempre o botão de abrir em aba — prometer
 * preview e entregar um quadrado branco seria pior que avisar.
 */

const POLL_MS = 60000;
const JANELAS = [
  { h: 24, label: "24 H" },
  { h: 24 * 7, label: "7 DIAS" },
  { h: 24 * 30, label: "30 DIAS" },
];

const COR = { "no ar": GR, erro: OR, fora: "#ff5d5d", desconhecido: "rgba(207,239,251,0.35)" };
const pct = (v) => (v == null ? "—" : `${(v * 100).toFixed(v > 0.99 ? 2 : 1)}%`);

function Luz({ estado, tamanho = 9 }) {
  const c = COR[estado] || COR.desconhecido;
  return (
    <span
      title={estado}
      style={{
        width: tamanho, height: tamanho, borderRadius: "50%", background: c, flex: "none",
        boxShadow: `0 0 ${tamanho}px ${c}`,
        animation: estado === "fora" ? "bb-flicker 1.6s infinite" : "none",
      }}
    />
  );
}

/** Últimas checagens como uma fita — é a forma mais rápida de ver instabilidade intermitente. */
function Fita({ historico }) {
  if (!historico?.length) return <span style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.3)" }}>sem checagens ainda</span>;
  return (
    <div style={{ display: "flex", gap: 1.5, alignItems: "flex-end", height: 16 }}>
      {historico.slice(-40).map((c, i) => (
        <span
          key={i}
          title={`${c.ok ? "no ar" : c.status ? `HTTP ${c.status}` : "sem resposta"} · ${new Date(c.at).toLocaleString("pt-BR")}`}
          style={{
            width: 4, height: c.ok ? 16 : 9, borderRadius: 1,
            background: c.ok ? "rgba(123,216,143,0.75)" : "#ff5d5d",
          }}
        />
      ))}
    </div>
  );
}

function Cartao({ app, onAbrir }) {
  const r = app.resumo || {};
  const estado = app.url ? r.estado || "desconhecido" : "desconhecido";
  return (
    <button
      onClick={() => app.url && onAbrir(app)}
      style={{
        textAlign: "left", width: "100%", display: "flex", flexDirection: "column", gap: 7,
        padding: "11px 12px", borderRadius: 7, cursor: app.url ? "pointer" : "default",
        border: `1px solid ${estado === "no ar" ? "rgba(123,216,143,0.3)" : estado === "desconhecido" ? "rgba(var(--accent-rgb),0.16)" : `${COR[estado]}66`}`,
        background: "linear-gradient(160deg, rgba(var(--accent-rgb),0.04), rgba(0,0,0,0.25))",
        color: "inherit", font: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Luz estado={estado} />
        <span style={{ fontSize: 13, color: "#eafcff", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.nome}</span>
        {r.uptime != null && (
          <span style={{ ...mono, fontSize: 9.5, color: r.uptime > 0.99 ? GR : r.uptime > 0.95 ? OR : "#ff5d5d" }}>{pct(r.uptime)}</span>
        )}
      </div>

      {app.conta && (
        <span style={{ ...mono, fontSize: 8.5, letterSpacing: 1, alignSelf: "flex-start", padding: "2px 6px", borderRadius: 3, background: "rgba(201,166,255,0.14)", color: PU }}>
          {app.conta}
        </span>
      )}

      {app.url ? (
        <span style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {app.url.replace(/^https?:\/\//, "")}
        </span>
      ) : (
        <span style={{ ...mono, fontSize: 9, color: OR }}>⚠ sem link na descrição do card</span>
      )}

      <Fita historico={app.historico} />

      <div style={{ ...mono, fontSize: 8.5, color: "rgba(207,239,251,0.4)", display: "flex", gap: 10, flexWrap: "wrap" }}>
        {r.quedas > 0 && <span style={{ color: OR }}>{r.quedas} queda{r.quedas > 1 ? "s" : ""}</span>}
        {r.msMedio != null && <span>{r.msMedio}ms</span>}
        {r.ultima && <span>visto {desde(r.ultima)}</span>}
      </div>
    </button>
  );
}

/** Pré-visualização do deploy. O iframe é uma tentativa: quem recusa embutir cai no aviso. */
function Preview({ app, onFechar }) {
  const [falhou, setFalhou] = useState(false);
  const [carregou, setCarregou] = useState(false);

  // Não há evento de "recusou embutir" que dê pra ouvir de fora: o navegador bloqueia em
  // silêncio. O que dá pra fazer é esperar — se em 6s o onLoad não veio, foi bloqueado.
  useEffect(() => {
    setFalhou(false);
    setCarregou(false);
    const id = setTimeout(() => setFalhou((f) => f || !carregou), 6000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.url]);

  if (!app) return null;
  const r = app.resumo || {};

  return (
    <div
      onClick={onFechar}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(2,6,9,0.86)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(1100px, 96vw)", height: "min(760px, 90vh)", display: "flex", flexDirection: "column", borderRadius: 10, border: `1px solid ${CY}`, background: "#040a0e", overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: "1px solid rgba(var(--accent-rgb),0.16)", flexWrap: "wrap" }}>
          <Luz estado={r.estado || "desconhecido"} tamanho={10} />
          <span style={{ fontSize: 14, color: "#eafcff" }}>{app.nome}</span>
          <span style={{ ...mono, fontSize: 9.5, letterSpacing: 1, color: "rgba(207,239,251,0.5)" }}>{app.servidor}{app.conta ? ` · ${app.conta}` : ""}</span>
          <div style={{ flex: 1 }} />
          <a href={app.url} target="_blank" rel="noreferrer" style={{ ...mono, fontSize: 9.5, letterSpacing: 1, padding: "6px 12px", borderRadius: 6, border: `1px solid ${CY}`, color: "#eafcff", textDecoration: "none" }}>ABRIR ↗</a>
          {app.cardUrl && (
            <a href={app.cardUrl} target="_blank" rel="noreferrer" style={{ ...mono, fontSize: 9.5, letterSpacing: 1, padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.28)", color: "rgba(207,239,251,0.7)", textDecoration: "none" }}>CARD</a>
          )}
          <button onClick={onFechar} style={{ ...mono, fontSize: 11, padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.28)", background: "transparent", color: "rgba(207,239,251,0.7)", cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 18, padding: "10px 14px", borderBottom: "1px solid rgba(var(--accent-rgb),0.1)", ...mono, fontSize: 10, color: "rgba(207,239,251,0.6)", flexWrap: "wrap" }}>
          <span>disponibilidade <b style={{ color: r.uptime > 0.99 ? GR : OR }}>{pct(r.uptime)}</b></span>
          <span>quedas <b style={{ color: r.quedas ? OR : GR }}>{r.quedas ?? 0}</b></span>
          <span>checagens {r.total ?? 0}</span>
          {r.msMedio != null && <span>resposta média {r.msMedio}ms</span>}
          {r.ultimaQueda && <span>última queda {desde(r.ultimaQueda)}</span>}
          {r.desde && <span>{r.estado} {desde(r.desde)}</span>}
        </div>

        <div style={{ flex: 1, minHeight: 0, position: "relative", background: "#000" }}>
          <iframe
            key={app.url}
            src={app.url}
            title={app.nome}
            onLoad={() => { setCarregou(true); setFalhou(false); }}
            sandbox="allow-scripts allow-same-origin allow-forms"
            style={{ width: "100%", height: "100%", border: 0, background: "#fff" }}
          />
          {falhou && !carregou && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "rgba(4,10,14,0.96)", padding: 24, textAlign: "center" }}>
              <div style={{ ...mono, fontSize: 11, letterSpacing: 1.5, color: OR }}>ESTA HOSPEDAGEM NÃO PERMITE PRÉ-VISUALIZAÇÃO</div>
              <div style={{ fontSize: 12, color: "rgba(207,239,251,0.6)", maxWidth: 460, lineHeight: 1.6 }}>
                O site respondeu, mas mandou o navegador não deixar ele ser embutido em outra
                página (X-Frame-Options). Isso não diz nada sobre ele estar no ar — quem diz é o
                semáforo aqui em cima.
              </div>
              <a href={app.url} target="_blank" rel="noreferrer" style={{ ...mono, fontSize: 10, letterSpacing: 1, padding: "8px 16px", borderRadius: 6, border: `1px solid ${CY}`, color: "#eafcff", textDecoration: "none" }}>ABRIR EM NOVA ABA ↗</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MapOfDeployPage() {
  const [data, setData] = useState(null);
  const [erro, setErro] = useState(null);
  const [horas, setHoras] = useState(24 * 7);
  const [checando, setChecando] = useState(false);
  const [aberto, setAberto] = useState(null);

  const carregar = useCallback(async (h) => {
    try {
      const res = await fetch(`/api/map-of-deploy?horas=${h}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "falha ao carregar");
      setData(json);
      setErro(null);
    } catch (err) {
      setErro(err.message);
    }
  }, []);

  useEffect(() => {
    carregar(horas);
    const id = setInterval(() => carregar(horas), POLL_MS);
    return () => clearInterval(id);
  }, [carregar, horas]);

  const checarAgora = async () => {
    setChecando(true);
    try {
      const res = await fetch("/api/map-of-deploy/check", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "falha ao checar");
      await carregar(horas);
      setErro(null);
    } catch (err) {
      setErro(err.message);
    } finally {
      setChecando(false);
    }
  };

  const g = data?.geral;
  const problemas = (data?.servidores || []).flatMap((s) => s.apps).filter((a) => a.url && a.resumo?.estado && a.resumo.estado !== "no ar" && a.resumo.estado !== "desconhecido");

  return (
    <div style={{ padding: "24px 28px", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>🚀 MAP OF DEPLOY</div>
        {data?.board?.url && (
          <a href={data.board.url} target="_blank" rel="noreferrer" style={{ ...mono, fontSize: 9, letterSpacing: 1, color: "rgba(207,239,251,0.45)", textDecoration: "none" }}>
            quadro: {data.board.nome} ↗
          </a>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 6 }}>
          {JANELAS.map((j) => (
            <button key={j.h} onClick={() => setHoras(j.h)} style={{ ...mono, fontSize: 9, padding: "6px 11px", borderRadius: 5, cursor: "pointer", border: `1px solid ${horas === j.h ? CY : "rgba(var(--accent-rgb),0.2)"}`, background: horas === j.h ? "rgba(var(--accent-rgb),0.1)" : "transparent", color: horas === j.h ? "#eafcff" : "rgba(207,239,251,0.5)" }}>
              {j.label}
            </button>
          ))}
        </div>
        <button onClick={checarAgora} disabled={checando} style={{ ...mono, fontSize: 9, letterSpacing: 1, padding: "7px 14px", borderRadius: 5, cursor: checando ? "wait" : "pointer", border: `1px solid ${CY}`, background: "rgba(var(--accent-rgb),0.1)", color: "#eafcff" }}>
          {checando ? "CHECANDO…" : "CHECAR AGORA"}
        </button>
      </div>

      {erro && <div style={{ ...mono, fontSize: 11, color: OR, marginBottom: 14 }}>⚠ {erro}</div>}
      {data?.aviso && (
        <div style={{ ...mono, fontSize: 10, color: OR, marginBottom: 14, lineHeight: 1.6 }}>
          ⚠ {data.aviso} — o mapa aparece mesmo assim, mas sem uptime nem contagem de quedas.
          Crie a tabela <b>deploy_checks</b> (db/schema.sql, item 28) e agende /api/cron/deploy-check.
        </div>
      )}

      {!data && !erro && <div style={{ ...mono, fontSize: 11, color: "rgba(207,239,251,0.5)" }}>lendo o quadro…</div>}

      {g && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 22 }}>
          {[
            { label: "NO AR", valor: g.noAr, cor: GR },
            { label: "COM ERRO", valor: g.comErro, cor: OR, nota: "respondeu, mas 4xx/5xx" },
            { label: "FORA DO AR", valor: g.fora, cor: "#ff5d5d", nota: "não respondeu" },
            { label: "QUEDAS NA JANELA", valor: g.quedas, cor: g.quedas ? OR : GR, nota: "episódios, não checagens" },
            { label: "DISPONIBILIDADE", valor: pct(g.uptime), cor: g.uptime > 0.99 ? GR : OR, nota: "média das aplicações" },
          ].map((c) => (
            <div key={c.label} style={{ border: "1px solid rgba(var(--accent-rgb),0.16)", borderRadius: 8, padding: "13px 15px", background: "linear-gradient(160deg, rgba(var(--accent-rgb),0.04), rgba(0,0,0,0.2))" }}>
              <div style={{ ...mono, fontSize: 8.5, letterSpacing: 2, color: "rgba(207,239,251,0.5)", marginBottom: 7 }}>{c.label}</div>
              <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: c.cor }}>{c.valor}</div>
              {c.nota && <div style={{ fontSize: 9.5, color: "rgba(207,239,251,0.38)", marginTop: 3 }}>{c.nota}</div>}
            </div>
          ))}
        </div>
      )}

      {problemas.length > 0 && (
        <div style={{ border: `1px solid ${OR}55`, borderRadius: 8, padding: "13px 15px", background: "rgba(255,157,61,0.05)", marginBottom: 22 }}>
          <div style={{ ...mono, fontSize: 9.5, letterSpacing: 2, color: OR, marginBottom: 9 }}>PRECISA DE ATENÇÃO AGORA</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {problemas.map((a) => (
              <button key={a.id} onClick={() => setAberto(a)} style={{ display: "flex", alignItems: "center", gap: 10, background: "transparent", border: 0, padding: 0, cursor: "pointer", color: "inherit", font: "inherit", textAlign: "left" }}>
                <Luz estado={a.resumo.estado} />
                <span style={{ fontSize: 12.5, color: "#eafcff" }}>{a.nome}</span>
                <span style={{ ...mono, fontSize: 9.5, color: "rgba(207,239,251,0.45)" }}>{a.servidor}</span>
                <span style={{ ...mono, fontSize: 9.5, color: OR }}>
                  {a.resumo.estado === "fora" ? "não responde" : `HTTP ${a.historico?.at(-1)?.status ?? "?"}`}
                  {a.resumo.desde ? ` ${desde(a.resumo.desde)}` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* o quadro, coluna por coluna, na mesma ordem do Trello */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", overflowX: "auto", paddingBottom: 8 }}>
        {(data?.servidores || []).map((s) => (
          <div key={s.servidor} className="bb-kanban-col" style={{ flex: "none", display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px" }}>
              <span style={{ ...mono, fontSize: 10, letterSpacing: 2, color: "#eafcff" }}>{s.servidor.toUpperCase()}</span>
              <span style={{ ...mono, fontSize: 9, color: s.noAr === s.total ? GR : OR }}>{s.noAr}/{s.total}</span>
            </div>
            {s.apps.map((a) => <Cartao key={a.id} app={a} onAbrir={setAberto} />)}
          </div>
        ))}
      </div>

      {data && (
        <div style={{ ...mono, fontSize: 9.5, color: "rgba(207,239,251,0.35)", marginTop: 18, lineHeight: 1.7, maxWidth: 720 }}>
          O mapa é o quadro do Trello: a coluna é o servidor, a etiqueta é a conta, a descrição é
          o link. Editar lá muda aqui. As checagens rodam pelo cron (/api/cron/deploy-check) e a
          tela recarrega sozinha a cada {POLL_MS / 1000}s. &quot;Quedas&quot; conta episódios, não
          checagens: três horas fora com checagem de 5 em 5 minutos é uma queda, não trinta e seis.
        </div>
      )}

      <Preview app={aberto} onFechar={() => setAberto(null)} />
    </div>
  );
}
