"use client";

import { Fragment, useEffect, useState } from "react";
import { CY, OR, GR, mono } from "@/lib/theme.js";
// (a mesma conta de src/lib/usoDosUsuarios.js, aqui para a tela não puxar o módulo que fala com o banco)
function duracaoLegivel(segundos) {
  const s = Math.max(0, Math.round(Number(segundos) || 0));
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

const FUSO = "America/Sao_Paulo";
const dataHora = (iso) => new Date(iso).toLocaleString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const hora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
const APARELHOS = { computador: "computador", celular: "celular", tablet: "tablet" };
const FRACO = "rgba(207,239,251,0.5)";
const LINHA = "1px solid rgba(var(--accent-rgb),0.14)";

function haQuanto(iso) {
  if (!iso) return "—";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 2) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} dia${d === 1 ? "" : "s"}`;
}

const estilos = {
  pagina: { padding: "24px 28px 48px", maxWidth: 1400, margin: "0 auto", color: "#e8f6fb" },
  titulo: { ...mono, fontSize: 13, letterSpacing: "0.18em", color: CY, margin: 0 },
  sub: { fontSize: 14, color: FRACO, margin: "6px 0 0" },
  aviso: { margin: "16px 0", padding: "10px 14px", border: LINHA, borderRadius: 10, fontSize: 12.5, color: FRACO, lineHeight: 1.5 },
  periodo: (ativo) => ({ ...mono, fontSize: 11, letterSpacing: "0.1em", padding: "7px 14px", borderRadius: 8, cursor: "pointer", border: `1px solid ${ativo ? CY : "rgba(var(--accent-rgb),0.25)"}`, background: ativo ? "rgba(var(--accent-rgb),0.16)" : "transparent", color: ativo ? CY : FRACO }),
  cartoes: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 16 },
  cartao: { border: LINHA, borderRadius: 12, padding: "14px 16px", background: "rgba(var(--accent-rgb),0.04)" },
  numero: { ...mono, fontSize: 26, color: CY, display: "block" },
  rotulo: { ...mono, fontSize: 10.5, letterSpacing: "0.12em", color: FRACO, textTransform: "uppercase" },
  tabela: { width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 },
  th: { ...mono, textAlign: "left", fontSize: 10.5, letterSpacing: "0.12em", color: FRACO, padding: "10px 12px", borderBottom: LINHA, fontWeight: 500 },
  td: { padding: "11px 12px", borderBottom: LINHA, verticalAlign: "top" },
  peq: { display: "block", fontSize: 11.5, color: FRACO, marginTop: 2 },
  pilula: { display: "inline-block", margin: "0 4px 4px 0", padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(var(--accent-rgb),0.3)", fontSize: 11, ...mono },
  detalhe: { display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", padding: "14px 4px 6px" },
  h3: { ...mono, fontSize: 11, letterSpacing: "0.14em", color: CY, margin: "0 0 8px" },
  item: { padding: "8px 10px", borderRadius: 8, border: LINHA, marginBottom: 6, fontSize: 12.5 },
};

/**
 * /uso — "Uso dos usuários" (04/11/2026: "quero poder ver o uso dos usuários dela"): quem entrou, quanto tempo ficou,
 * em que telas e o que fez (perguntas, desenhos, comentários de tela, falas e fluxogramas). Só o admin abre.
 */
export default function UsoDosUsuarios() {
  const [dias, setDias] = useState(7);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aberta, setAberta] = useState(null);

  useEffect(() => {
    let vale = true;
    setErro("");
    fetch(`/api/uso-dos-usuarios?dias=${dias}`).then((r) => r.json())
      .then((r) => { if (!vale) return; if (!r.ok) throw new Error(r.error || "falha ao carregar"); setDados(r); })
      .catch((e) => { if (vale) setErro(e.message); });
    return () => { vale = false; };
  }, [dias]);

  const t = dados?.totais;
  return (
    <div style={estilos.pagina}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={estilos.titulo}>USO DOS USUÁRIOS</h1>
          <p style={estilos.sub}>Quem entrou na Lisa, quanto tempo ficou, em que telas e o que fez.</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(dados?.periodos || [7, 30, 90]).map((d) => (
            <button key={d} type="button" style={estilos.periodo(dias === d)} onClick={() => setDias(d)}>{d} DIAS</button>
          ))}
        </div>
      </div>

      <p style={estilos.aviso}>
        🔒 Só o admin vê este painel. Ele mostra acessos, tempo, telas e quantas perguntas, desenhos, comentários de tela e
        falas cada pessoa usou — nunca o conteúdo da conversa. Serve para acompanhar o uso, não para avaliar ninguém sozinho.
        {dados?.medindoDesde && <> O tempo é medido desde {dataHora(dados.medindoDesde)}; o último login e as contagens valem desde antes.</>}
      </p>

      {erro && <div style={{ ...mono, fontSize: 12, color: OR, marginBottom: 12 }}>⚠ {erro}</div>}
      {!dados && !erro && <div style={{ ...mono, fontSize: 11, color: FRACO }}>carregando…</div>}

      {dados && (
        <>
          <div style={estilos.cartoes}>
            <div style={estilos.cartao}><span style={estilos.numero}>{t.ativas}<small style={{ fontSize: 13, color: FRACO }}>/{t.pessoas}</small></span><span style={estilos.rotulo}>usuários ativos</span></div>
            <div style={estilos.cartao}><span style={estilos.numero}>{t.acessos}</span><span style={estilos.rotulo}>acessos</span></div>
            <div style={estilos.cartao}><span style={estilos.numero}>{duracaoLegivel(t.segundos)}</span><span style={estilos.rotulo}>tempo na Lisa</span></div>
            <div style={estilos.cartao}><span style={estilos.numero}>{t.acoes}</span><span style={estilos.rotulo}>usos (perguntas, desenhos…)</span></div>
          </div>

          <div style={{ border: LINHA, borderRadius: 12, overflowX: "auto" }}>
            <table style={estilos.tabela}>
              <thead>
                <tr>
                  {["PESSOA", "ÚLTIMO ACESSO", "ACESSOS", "TEMPO", "DIAS", "ONDE MAIS FICOU", "O QUE FEZ"].map((c) => <th key={c} style={estilos.th}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {dados.pessoas.map((p) => (
                  <Fragment key={p.id}>
                    <tr onClick={() => setAberta(aberta === p.id ? null : p.id)} style={{ cursor: "pointer", opacity: p.acessos || p.totalDeAcoes || p.ultimoLogin ? 1 : 0.5, background: aberta === p.id ? "rgba(var(--accent-rgb),0.06)" : "transparent" }}>
                      <td style={estilos.td}>
                        <strong>{p.nome || p.email}</strong>{p.admin && <span style={{ ...estilos.pilula, marginLeft: 6, color: GR }}>admin</span>}
                        <span style={estilos.peq}>{p.email}</span>
                      </td>
                      <td style={{ ...estilos.td, whiteSpace: "nowrap" }}>{p.ultimoAcesso ? <>{haQuanto(p.ultimoAcesso)}<span style={estilos.peq}>{dataHora(p.ultimoAcesso)}</span></> : <span style={{ color: FRACO }}>não entrou</span>}</td>
                      <td style={{ ...estilos.td, whiteSpace: "nowrap" }}>{p.acessos}{p.logins ? <span style={estilos.peq}>{p.logins} login{p.logins === 1 ? "" : "s"}</span> : null}</td>
                      <td style={{ ...estilos.td, whiteSpace: "nowrap" }}>{p.segundos ? duracaoLegivel(p.segundos) : "—"}{p.acessos ? <span style={estilos.peq}>média {duracaoLegivel(p.mediaPorAcesso)}</span> : null}</td>
                      <td style={estilos.td}>{p.diasAtivos || "—"}</td>
                      <td style={estilos.td}>{p.telas.length ? p.telas.slice(0, 3).map((x) => <span key={x.tela} style={estilos.pilula}>{x.rotulo} · {x.minutos} min</span>) : "—"}</td>
                      <td style={{ ...estilos.td, minWidth: 200 }}>{p.acoes.length ? p.acoes.slice(0, 3).map((a) => a.texto).join(" · ") : "—"}</td>
                    </tr>
                    {aberta === p.id && (
                      <tr>
                        <td colSpan={7} style={{ ...estilos.td, background: "rgba(var(--accent-rgb),0.04)" }}>
                          <div style={estilos.detalhe}>
                            <div>
                              <h3 style={estilos.h3}>ACESSOS</h3>
                              {!p.historico.length ? <p style={{ color: FRACO, fontSize: 12.5 }}>Nenhum acesso medido no período.</p> : p.historico.map((h) => (
                                <div key={h.inicio} style={estilos.item}>
                                  <strong>{dataHora(h.inicio)}–{hora(h.ultimo)}</strong>
                                  <span style={estilos.peq}>{duracaoLegivel(h.segundos)} · {APARELHOS[h.aparelho] || h.aparelho}{h.entrou ? " · fez login" : ""}{h.telas.length ? ` · ${h.telas.join(", ")}` : ""}</span>
                                </div>
                              ))}
                            </div>
                            <div>
                              <h3 style={estilos.h3}>TEMPO POR TELA</h3>
                              {!p.telas.length ? <p style={{ color: FRACO, fontSize: 12.5 }}>Sem tempo medido no período.</p> : p.telas.map((x) => (
                                <div key={x.tela} style={{ display: "grid", gridTemplateColumns: "120px 1fr 56px", gap: 8, alignItems: "center", fontSize: 12.5, marginBottom: 6 }}>
                                  <span>{x.rotulo}</span>
                                  <span style={{ height: 6, borderRadius: 99, background: "rgba(var(--accent-rgb),0.12)", overflow: "hidden" }}>
                                    <span style={{ display: "block", height: "100%", width: `${Math.round((100 * x.minutos) / Math.max(1, ...p.telas.map((y) => y.minutos)))}%`, background: CY }} />
                                  </span>
                                  <span style={{ textAlign: "right", color: FRACO, ...mono, fontSize: 11 }}>{x.minutos} min</span>
                                </div>
                              ))}
                            </div>
                            <div>
                              <h3 style={estilos.h3}>O QUE FEZ</h3>
                              {!p.acoes.length ? <p style={{ color: FRACO, fontSize: 12.5 }}>Nada contado no período{p.admin ? " (o admin não entra na contagem diária)" : ""}.</p> : p.acoes.map((a) => <div key={a.chave} style={{ fontSize: 13, marginBottom: 4 }}>{a.texto}</div>)}
                              {p.criadaEm && <p style={{ ...estilos.peq, marginTop: 10 }}>conta criada em {dataHora(p.criadaEm)}{p.ultimoLogin ? ` · último login ${dataHora(p.ultimoLogin)}` : ""}</p>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
