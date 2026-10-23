"use client";

import { useMemo, useState } from "react";
import Folha from "@/componentes/Folha.js";
import { Moedas, numero } from "./pecas.js";
import { corretagem } from "@/dominio/bolsa.js";

const diaCurto = (dia) => { const [, m, d] = String(dia).split("-"); return `${d}/${m}`; };
const sinal = (v) => (v > 0 ? `+${String(v).replace(".", ",")}` : String(v).replace(".", ",").replace("-", "−"));

/** A variação do dia, com seta e sinal (a cor nunca é o único jeito de saber se subiu). */
function Variacao({ v, estreia }) {
  if (estreia) return <span className="rn-var rn-var--estreia">✨ estreia</span>;
  const tipo = v > 0 ? "sobe" : v < 0 ? "cai" : "igual";
  return <span className={`rn-var rn-var--${tipo}`}>{v > 0 ? "▲" : v < 0 ? "▼" : "•"} {sinal(v)}%</span>;
}

/**
 * O gráfico do preço nos últimos pregões: uma linha de 2 px, o último ponto marcado e, ao passar
 * o dedo ou o mouse, o preço daquele dia. Sobe ou cai pela cor E pela seta da variação ao lado.
 */
function Grafico({ historico, nome }) {
  const [foco, setFoco] = useState(null);
  const L = 160, A = 48, M = 6;
  const pontos = useMemo(() => {
    const h = historico.length ? historico : [];
    if (!h.length) return [];
    const precos = h.map((p) => p.preco);
    const min = Math.min(...precos), max = Math.max(...precos);
    const faixa = max - min || 1;
    return h.map((p, i) => ({
      ...p,
      x: h.length === 1 ? L / 2 : M + (i * (L - 2 * M)) / (h.length - 1),
      y: max === min ? A / 2 : M + ((max - p.preco) * (A - 2 * M)) / faixa,
    }));
  }, [historico]);
  if (!pontos.length) return null;
  const subiu = pontos[pontos.length - 1].preco >= pontos[0].preco;
  const ultimo = pontos[pontos.length - 1];
  const f = foco != null ? pontos[foco] : null;
  const mover = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * L;
    let melhor = 0;
    pontos.forEach((p, i) => { if (Math.abs(p.x - x) < Math.abs(pontos[melhor].x - x)) melhor = i; });
    setFoco(melhor);
  };
  return (
    <div className="rn-grafico">
      <svg viewBox={`0 0 ${L} ${A}`} className={`rn-grafico__svg rn-grafico__svg--${subiu ? "sobe" : "cai"}`}
        role="img" aria-label={`${nome}: de ${pontos[0].preco} para ${ultimo.preco} moedas nos últimos ${pontos.length} pregões`}
        onPointerMove={mover} onPointerLeave={() => setFoco(null)}>
        <polyline className="rn-grafico__linha" points={pontos.map((p) => `${p.x},${p.y}`).join(" ")} />
        <circle className="rn-grafico__ponto" cx={ultimo.x} cy={ultimo.y} r="4" />
        {f && <line className="rn-grafico__guia" x1={f.x} x2={f.x} y1="0" y2={A} />}
        {f && <circle className="rn-grafico__ponto rn-grafico__ponto--foco" cx={f.x} cy={f.y} r="4" />}
        <rect x="0" y="0" width={L} height={A} fill="transparent" />
      </svg>
      <span className="rn-grafico__dica" aria-hidden="true">{f ? `${diaCurto(f.dia)} · 🪙 ${numero(f.preco)}` : `${pontos.length} pregão(ões)`}</span>
    </div>
  );
}

/**
 * A Bolsa do Reino: a manchete do pregão (a Lisa decide), as ações de todo mundo, a minha carteira
 * e a folha de comprar e vender.
 */
export default function Bolsa({ bolsa, ocupado, aoNegociar, aoRecarregar }) {
  const [negociando, setNegociando] = useState(null); // { acao, tipo }
  if (!bolsa) {
    return (
      <section className="pf-secao" id="bolsa">
        <h2 className="pf-secao__titulo">📈 Bolsa do Reino</h2>
        <div className="pf-cartao"><p className="pf-estat__nota" style={{ marginTop: 0 }}>Abrindo a bolsa… (no primeiro acesso do dia, a Lisa abre o pregão — pode levar alguns segundos)</p></div>
      </section>
    );
  }
  const c = bolsa.carteira;
  const negociar = negociando ? bolsa.acoes.find((a) => a.id === negociando.acao) : null;
  return (
    <section className="pf-secao" id="bolsa">
      <h2 className="pf-secao__titulo">
        📈 Bolsa do Reino <small>pregão de {diaCurto(bolsa.pregao.dia)} · {bolsa.pregao.abrindo ? "abrindo…" : bolsa.pregao.geradoPor === "lisa" ? "a Lisa decidiu" : "sorteio automático"} · a mesma para todos</small>
      </h2>
      {bolsa.pregao.abrindo ? (
        <div className="pf-aviso rn-bolsa__abrindo">
          ⏳ A Lisa está abrindo o pregão de hoje: decidindo quais ações sobem e quais caem. Os preços de ontem ficam até ela terminar.
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={aoRecarregar}>Atualizar</button>
        </div>
      ) : bolsa.pregao.manchete && (
        <div className="pf-cartao rn-bolsa__manchete"><span aria-hidden="true">🎙️</span><p><strong>Lisa, no pregão:</strong> {bolsa.pregao.manchete}</p></div>
      )}
      <div className="rn-bolsa__carteira">
        <div className="pf-cartao rn-numero"><div className="pf-estat__rotulo">Minha carteira</div><div className="pf-estat__valor"><Moedas n={c.valor} /></div><p className="pf-estat__nota">pagou <Moedas n={c.custo} /></p></div>
        <div className="pf-cartao rn-numero"><div className="pf-estat__rotulo">Lucro ou prejuízo</div><div className={`pf-estat__valor rn-var--${c.lucro > 0 ? "sobe" : c.lucro < 0 ? "cai" : "igual"}`}>{c.lucro > 0 ? "▲ +" : c.lucro < 0 ? "▼ −" : ""}🪙 {numero(Math.abs(c.lucro))}</div><p className="pf-estat__nota">se vendesse tudo hoje (antes da corretagem)</p></div>
        <div className="pf-cartao rn-numero"><div className="pf-estat__rotulo">Para investir</div><div className="pf-estat__valor"><Moedas n={bolsa.saldo} /></div><p className="pf-estat__nota">corretagem de {Math.round(bolsa.regras.taxa * 100)}% (mín. 1) em cada ordem</p></div>
      </div>
      {bolsa.acoes.length === 0 ? (
        <div className="pf-cartao"><p className="pf-estat__nota" style={{ marginTop: 0 }}>Nenhuma empresa na bolsa ainda — o primeiro pregão lança as primeiras.</p></div>
      ) : (
        <div className="rn-bolsa">
          {bolsa.acoes.map((a) => (
            <article key={a.id} className="pf-cartao rn-acao">
              <div className="rn-acao__topo">
                <span className="rn-acao__emoji" aria-hidden="true">{a.emoji}</span>
                <div className="rn-acao__nome"><h3>{a.nome}</h3><small>{a.id} · {a.setor}</small></div>
                <div className="rn-acao__preco"><Moedas n={a.preco} /><Variacao v={a.variacao} estreia={a.estreia} /></div>
              </div>
              {a.noticia && <p className="pf-estat__nota rn-acao__noticia">📰 {a.noticia}</p>}
              <Grafico historico={a.historico} nome={a.nome} />
              {a.minha && (
                <p className="rn-acao__minha">
                  Você tem <strong>{a.minha.quantidade}</strong> · vale <Moedas n={a.minha.valor} /> ·{" "}
                  <span className={`rn-var--${a.minha.lucro > 0 ? "sobe" : a.minha.lucro < 0 ? "cai" : "igual"}`}>{a.minha.lucro >= 0 ? "+" : "−"}🪙 {numero(Math.abs(a.minha.lucro))}</span>
                </p>
              )}
              <div className="pf-acoes rn-acao__acoes">
                <button type="button" className="pf-botao pf-botao--pequeno" disabled={Boolean(ocupado) || bolsa.pregao.abrindo} onClick={() => setNegociando({ acao: a.id, tipo: "comprar" })}>Comprar</button>
                {a.minha && <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={Boolean(ocupado) || bolsa.pregao.abrindo} onClick={() => setNegociando({ acao: a.id, tipo: "vender" })}>Vender</button>}
              </div>
            </article>
          ))}
        </div>
      )}
      {bolsa.saidas.length > 0 && (
        <div className="pf-cartao rn-bolsa__saidas">
          <p className="pf-campo__rotulo" style={{ marginTop: 0 }}>Saíram da bolsa</p>
          <ul>
            {bolsa.saidas.map((s) => (
              <li key={s.id}>{s.emoji} <strong>{s.nome}</strong> {s.status === "falida" ? "💀 faliu — as ações viraram pó" : `🏁 fechou o capital — quem tinha recebeu 🪙 ${numero(s.preco)} por ação`} ({diaCurto(s.dia)})</li>
            ))}
          </ul>
        </div>
      )}
      {bolsa.ordens.length > 0 && (
        <div className="pf-cartao rn-bolsa__ordens">
          <p className="pf-campo__rotulo" style={{ marginTop: 0 }}>Minhas últimas ordens</p>
          <ul className="rn-batalhas">
            {bolsa.ordens.map((o, i) => (
              <li key={i} className={o.tipo === "venda" || o.tipo === "resgate" ? "rn-batalha--ganhei" : "rn-batalha--perdi"}>
                <span className="rn-batalha__icone" aria-hidden="true">{{ compra: "🛒", venda: "💰", resgate: "🏁", falencia: "💀" }[o.tipo]}</span>
                <span className="rn-batalha__texto"><strong>{{ compra: "Comprou", venda: "Vendeu", resgate: "Resgate de", falencia: "Faliu:" }[o.tipo]} {o.quantidade} {o.nome}</strong><small>a 🪙 {numero(o.preco)}{o.taxa ? ` · corretagem 🪙 ${o.taxa}` : ""}</small></span>
                <span className="rn-batalha__saldo">{o.tipo === "compra" ? "−" : "+"}🪙{numero(o.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Negociar aberta={Boolean(negociar)} acao={negociar} tipoInicial={negociando?.tipo} saldo={bolsa.saldo} regras={bolsa.regras} ocupado={ocupado}
        aoFechar={() => setNegociando(null)}
        aoEnviar={(tipo, quantidade) => aoNegociar({ acao: tipo, id: negociar.id, quantidade }, () => setNegociando(null))} />
    </section>
  );
}

/** Comprar ou vender: quantas ações, o valor, a corretagem e o total antes de confirmar. */
function Negociar({ aberta, acao, tipoInicial, saldo, regras, ocupado, aoFechar, aoEnviar }) {
  const [tipo, setTipo] = useState(tipoInicial || "comprar");
  const [qtd, setQtd] = useState(1);
  const chave = acao ? `${acao.id}:${tipoInicial}` : "";
  const [visto, setVisto] = useState("");
  if (aberta && visto !== chave) { setVisto(chave); setTipo(tipoInicial || "comprar"); setQtd(1); }
  if (!aberta || !acao) return null;
  const tem = acao.minha?.quantidade || 0;
  const cabe = Math.max(0, Math.min(regras.maximoPorOrdem, Math.floor(saldo / (acao.preco * (1 + regras.taxa)) - 0.0001)));
  const maximo = tipo === "comprar" ? Math.max(1, cabe) : tem;
  const q = Math.max(1, Math.min(maximo, Math.floor(Number(qtd) || 1)));
  const valor = acao.preco * q;
  const taxa = tipo === "comprar" ? corretagem(valor) : Math.min(valor, corretagem(valor));
  const total = tipo === "comprar" ? valor + taxa : valor - taxa;
  const falta = tipo === "comprar" && total > saldo;
  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo={`Negociar ${acao.nome}`}>
      <div className="rn-negociar">
        <h2 className="rn-convite__titulo">{acao.emoji} {acao.nome} <small>{acao.id} · 🪙 {numero(acao.preco)} por ação</small></h2>
        <div className="rn-dias" role="radiogroup" aria-label="Comprar ou vender">
          <button type="button" role="radio" aria-checked={tipo === "comprar"} className={`rn-dias__opcao${tipo === "comprar" ? " rn-dias__opcao--atual" : ""}`} onClick={() => setTipo("comprar")}>🛒 Comprar</button>
          <button type="button" role="radio" aria-checked={tipo === "vender"} disabled={!tem} className={`rn-dias__opcao${tipo === "vender" ? " rn-dias__opcao--atual" : ""}`} onClick={() => setTipo("vender")}>💰 Vender{tem ? ` (tem ${tem})` : ""}</button>
        </div>
        <label className="pf-campo">
          <span className="pf-campo__rotulo">Quantas ações (até {maximo})</span>
          <div className="rn-negociar__qtd">
            <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setQtd(Math.max(1, q - 1))} aria-label="Menos uma">−</button>
            <input className="pf-campo__entrada" type="number" min={1} max={maximo} value={qtd} onChange={(e) => setQtd(e.target.value)} />
            <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setQtd(Math.min(maximo, q + 1))} aria-label="Mais uma">+</button>
            <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setQtd(maximo)}>Máx.</button>
          </div>
        </label>
        <dl className="rn-negociar__conta">
          <dt>{q} × 🪙 {numero(acao.preco)}</dt><dd>🪙 {numero(valor)}</dd>
          <dt>Corretagem ({Math.round(regras.taxa * 100)}%, mín. 1)</dt><dd>{tipo === "comprar" ? "+" : "−"}🪙 {numero(taxa)}</dd>
          <dt><strong>{tipo === "comprar" ? "Você paga" : "Você recebe"}</strong></dt><dd><strong>🪙 {numero(total)}</strong></dd>
        </dl>
        {falta && <p className="rn-motivo">Faltam 🪙 {numero(total - saldo)}.</p>}
        <p className="rn-motivo">O preço só muda no próximo pregão (a Lisa decide uma vez por dia). Comprar e vender no mesmo dia só gasta a corretagem.</p>
        <div className="pf-acoes">
          <button type="button" className="pf-botao" disabled={Boolean(ocupado) || falta || (tipo === "vender" && !tem)} onClick={() => aoEnviar(tipo, q)}>
            {ocupado ? "Enviando…" : tipo === "comprar" ? `🛒 Comprar ${q}` : `💰 Vender ${q}`}
          </button>
          <button type="button" className="pf-botao pf-botao--sec" onClick={aoFechar}>Agora não</button>
        </div>
      </div>
    </Folha>
  );
}
