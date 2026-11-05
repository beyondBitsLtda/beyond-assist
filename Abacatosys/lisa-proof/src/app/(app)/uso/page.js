"use client";

import { Fragment, useEffect, useState } from "react";
import { obter } from "@/lib/api.js";
import { duracaoLegivel } from "@/dominio/uso.js";

const FUSO = "America/Sao_Paulo";
const dataHora = (iso) => new Date(iso).toLocaleString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const hora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
const APARELHOS = { computador: "💻 computador", celular: "📱 celular", tablet: "📱 tablet" };

/** "agora há pouco", "há 12 min", "há 3 h", "há 2 dias". */
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

/**
 * /uso — o painel do administrador (05/11/2026: "ver quando as pessoas logaram, quanto tempo elas passaram no Proof e
 * o que fizeram"). Uma linha por pessoa; clicar abre os acessos (início, duração, aparelho, áreas) e as últimas ações.
 */
export default function PaginaDoUso() {
  const [dias, setDias] = useState(7);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aberta, setAberta] = useState(null);

  useEffect(() => {
    let vale = true;
    setErro("");
    obter(`/api/uso?dias=${dias}`).then((r) => { if (vale) setDados(r); }).catch((e) => { if (vale) setErro(e.message); });
    return () => { vale = false; };
  }, [dias]);

  const t = dados?.totais;
  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>Uso do Proof</h1>
          <p>Quem entrou, quanto tempo ficou, por onde andou e o que fez.</p>
        </div>
        <div className="uso__periodos" role="tablist" aria-label="Período">
          {(dados?.periodos || [7, 30, 90]).map((d) => (
            <button key={d} type="button" role="tab" aria-selected={dias === d} className="uso__periodo" onClick={() => setDias(d)}>{d} dias</button>
          ))}
        </div>
      </div>

      <p className="uso__aviso">
        🔒 Só o administrador vê esta tela. Ela mostra acessos, tempo, áreas e ações no app — nunca o conteúdo do que a pessoa
        escreveu. Serve para acompanhar o uso, não para avaliar ninguém sozinha.
        {dados?.medindoDesde && <> O tempo é medido desde {dataHora(dados.medindoDesde)}; as ações valem desde sempre.</>}
      </p>

      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      {!dados && !erro && <div className="pf-carregando">Juntando o uso…</div>}

      {dados && (
        <>
          <div className="pf-grade uso__totais">
            <div className="pf-cartao"><span className="pf-estat__valor">{t.ativas}<small>/{t.pessoas}</small></span><span className="pf-estat__rotulo">pessoas usaram</span></div>
            <div className="pf-cartao"><span className="pf-estat__valor">{t.acessos}</span><span className="pf-estat__rotulo">acessos</span></div>
            <div className="pf-cartao"><span className="pf-estat__valor">{duracaoLegivel(t.segundos)}</span><span className="pf-estat__rotulo">tempo no Proof</span></div>
            <div className="pf-cartao"><span className="pf-estat__valor">{t.acoes}</span><span className="pf-estat__rotulo">ações (estudo e jogo)</span></div>
          </div>

          <section className="pf-cartao uso__tabela-cartao">
            <table className="uso__tabela">
              <thead>
                <tr>
                  <th scope="col">Pessoa</th>
                  <th scope="col">Último acesso</th>
                  <th scope="col">Acessos</th>
                  <th scope="col">Tempo</th>
                  <th scope="col">Dias</th>
                  <th scope="col">Onde mais ficou</th>
                  <th scope="col">O que fez</th>
                </tr>
              </thead>
              <tbody>
                {dados.pessoas.map((p) => (
                  <Fragment key={p.id}>
                    <tr className={`uso__linha${p.acessos || p.totalDeAcoes ? "" : " uso__linha--parada"}${aberta === p.id ? " uso__linha--aberta" : ""}`}
                      onClick={() => setAberta(aberta === p.id ? null : p.id)} tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAberta(aberta === p.id ? null : p.id); } }}
                      aria-expanded={aberta === p.id}>
                      <th scope="row">
                        <strong>{p.nome || p.email}{p.robo ? " 🤖" : ""}</strong>
                        <small>{p.email}</small>
                      </th>
                      <td title={p.ultimoAcesso ? dataHora(p.ultimoAcesso) : ""}>{p.ultimoAcesso ? <>{haQuanto(p.ultimoAcesso)}<small>{dataHora(p.ultimoAcesso)}</small></> : <span className="uso__nada">não entrou</span>}</td>
                      <td>{p.acessos}{p.logins ? <small>{p.logins} login{p.logins === 1 ? "" : "s"}</small> : null}</td>
                      <td>{p.segundos ? duracaoLegivel(p.segundos) : "—"}{p.acessos ? <small>média {duracaoLegivel(p.mediaPorAcesso)}</small> : null}</td>
                      <td>{p.diasAtivos || "—"}</td>
                      <td>{p.areas.length ? p.areas.slice(0, 3).map((a) => <span key={a.area} className="pf-pilula uso__area">{a.rotulo} · {a.minutos} min</span>) : "—"}</td>
                      <td className="uso__oque">{p.acoes.length ? p.acoes.slice(0, 3).map((a) => a.texto).join(" · ") : "—"}</td>
                    </tr>
                    {aberta === p.id && (
                      <tr className="uso__detalhe">
                        <td colSpan={7}>
                          <Detalhe pessoa={p} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}

function Detalhe({ pessoa: p }) {
  const maxArea = Math.max(1, ...p.areas.map((a) => a.minutos));
  return (
    <div className="uso__detalhe-grade">
      <div>
        <h3>Acessos</h3>
        {!p.historico.length ? <p className="uso__nada">Nenhum acesso no período.</p> : (
          <ul className="uso__acessos">
            {p.historico.map((h) => (
              <li key={h.inicio}>
                <strong>{dataHora(h.inicio)}–{hora(h.ultimo)}</strong>
                <span>{duracaoLegivel(h.segundos)} · {APARELHOS[h.aparelho] || h.aparelho}{h.entrou ? " · fez login" : ""}</span>
                {h.areas.length > 0 && <small>{h.areas.slice(0, 5).join(", ")}</small>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3>Tempo por área</h3>
        {!p.areas.length ? <p className="uso__nada">Sem tempo medido no período.</p> : (
          <ul className="uso__areas">
            {p.areas.map((a) => (
              <li key={a.area}>
                <span>{a.rotulo}</span>
                <span className="uso__barra"><span style={{ width: `${Math.round((100 * a.minutos) / maxArea)}%` }} /></span>
                <small>{a.minutos} min</small>
              </li>
            ))}
          </ul>
        )}
        <h3>Ações</h3>
        {!p.acoes.length ? <p className="uso__nada">Nenhuma ação no período.</p> : (
          <ul className="uso__lista-acoes">{p.acoes.map((a) => <li key={a.chave}>{a.texto}</li>)}</ul>
        )}
      </div>
      <div>
        <h3>Últimas ações</h3>
        {!p.ultimasAcoes.length ? <p className="uso__nada">Nada no período.</p> : (
          <ul className="uso__acessos">
            {p.ultimasAcoes.map((a, i) => (
              <li key={`${a.quando}-${i}`}>
                <strong>{dataHora(a.quando)}</strong>
                <span>{a.rotulo}{a.pontos ? ` · +${a.pontos} pts` : ""}{a.moedas ? ` · ${a.moedas > 0 ? "+" : ""}${Math.round(a.moedas)} moedas` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
