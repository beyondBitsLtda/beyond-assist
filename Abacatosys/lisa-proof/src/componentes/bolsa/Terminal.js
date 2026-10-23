"use client";

// A TELA DA BOLSA DO REINO (23/10/2026: "quero uma tela diferente, realmente como se fosse algo
// imitando a bolsa, com gráficos"): o pregão no jeito de um home broker — o letreiro de cotações
// correndo, o Índice do Reino, a lista de ações com o minigráfico de cada uma, o gráfico grande
// (hora a hora ou velas de 14 dias) da ação escolhida, a boleta para comprar e vender, a carteira,
// os destaques e o mural de notícias da Lisa. Os preços mudam de hora em hora (o mesmo para todos);
// a tela confere de minuto em minuto e avisa quando vem a próxima hora.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { obter, criar } from "@/lib/api.js";
import { useAviso } from "@/componentes/Pecas.js";
import { reagir, comemorar } from "@/componentes/Neuro.js";
import { corretagem, valorDaCompra, valorDaVenda } from "@/dominio/bolsa.js";
import { GraficoDoDia, GraficoDeVelas, Mini } from "./Graficos.js";
import { preco, moedas, pct, seta, rumo, horaCurta, diaCurto } from "./formatos.js";

const ORDENS = { altas: "Maiores altas", baixas: "Maiores baixas", nome: "A–Z", volume: "Mais negociadas" };

export default function Terminal() {
  const [bolsa, setBolsa] = useState(null);
  const [erro, setErro] = useState("");
  const [escolhida, setEscolhida] = useState(null);
  const [modo, setModo] = useState("hoje"); // "hoje" (hora a hora) ou "velas" (14 dias)
  const [ordem, setOrdem] = useState("altas");
  const [ocupado, setOcupado] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const [horaDeTeste, setHoraDeTeste] = useState(null); // modo de teste: ver o pregão numa hora qualquer
  const [previa, setPrevia] = useState(null);           // modo de teste: o pregão de amanhã pela Lisa, sem aplicar
  const [Aviso, avisar] = useAviso();

  const carregar = useCallback(() => obter(horaDeTeste == null ? "/api/reino/bolsa" : `/api/reino/bolsa?hora=${horaDeTeste}`)
    .then((b) => { setBolsa(b); setErro(""); }).catch((e) => setErro(e.message)), [horaDeTeste]);
  useEffect(() => {
    carregar();
    // confere de minuto em minuto (o preço muda na virada da hora); com a aba escondida, para
    const t = setInterval(() => { setAgora(Date.now()); if (!document.hidden) carregar(); }, 60_000);
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    const voltou = () => { if (!document.hidden) carregar(); };
    document.addEventListener("visibilitychange", voltou);
    return () => { clearInterval(t); clearInterval(relogio); document.removeEventListener("visibilitychange", voltou); };
  }, [carregar]);
  // a Lisa ainda está abrindo o pregão de hoje: confere de novo em alguns segundos
  useEffect(() => {
    if (!bolsa?.pregao?.abrindo) return undefined;
    const t = setTimeout(carregar, 5000);
    return () => clearTimeout(t);
  }, [bolsa, carregar]);
  // a virada da hora: busca o preço novo assim que ela chega
  useEffect(() => {
    if (!bolsa?.pregao?.proximaAtualizacao) return undefined;
    const falta = new Date(bolsa.pregao.proximaAtualizacao).getTime() - Date.now() + 1500;
    const t = setTimeout(carregar, Math.max(2000, falta));
    return () => clearTimeout(t);
  }, [bolsa?.pregao?.proximaAtualizacao, carregar]);

  const lista = useMemo(() => {
    const acoes = [...(bolsa?.acoes || [])];
    if (ordem === "altas") acoes.sort((a, b) => b.variacao - a.variacao);
    if (ordem === "baixas") acoes.sort((a, b) => a.variacao - b.variacao);
    if (ordem === "nome") acoes.sort((a, b) => a.nome.localeCompare(b.nome));
    if (ordem === "volume") acoes.sort((a, b) => b.volume - a.volume);
    return acoes;
  }, [bolsa, ordem]);
  const acao = bolsa?.acoes.find((a) => a.id === escolhida) || lista[0] || null;

  async function negociar(tipo, quantidade) {
    setOcupado(true);
    try {
      const r = await criar("/api/reino/bolsa", { acao: tipo, id: acao.id, quantidade });
      setBolsa(r.bolsa);
      const x = r.resultado;
      if (tipo === "comprar") reagir("feliz", `🛒 ${x.quantidade} ${x.nome} a 🪙 ${preco(x.preco)}`, 4000);
      else if (x.lucro > 0) comemorar(`💰 Vendeu com lucro de 🪙 ${moedas(x.lucro)}!`);
      else reagir(x.lucro < 0 ? "triste" : "feliz", `💰 Vendeu ${x.quantidade} ${x.nome} por 🪙 ${moedas(x.total)}`, 4000);
      avisar(`${tipo === "comprar" ? "Compra" : "Venda"} executada: ${x.quantidade} ${x.acao} a 🪙 ${preco(x.preco)} · total 🪙 ${moedas(x.total)}`);
    } catch (e) {
      avisar(e.message);
      carregar();
    } finally {
      setOcupado(false);
    }
  }

  if (!bolsa) {
    return (
      <div className="bx bx--carregando">
        {erro ? <p>{erro}</p> : <p>📈 Abrindo o pregão… no primeiro acesso do dia, a Lisa decide as cotações — pode levar alguns segundos.</p>}
      </div>
    );
  }

  const faltaMin = Math.max(0, Math.ceil((new Date(bolsa.pregao.proximaAtualizacao).getTime() - agora) / 60_000));
  const relogio = new Date(agora).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const idx = bolsa.indice;
  return (
    <div className="bx">
      <Letreiro acoes={bolsa.acoes} />

      <header className="bx-topo">
        <div className="bx-topo__marca">
          <Link href="/reino" className="bx-voltar">← Reino</Link>
          <h1>📈 Bolsa do Reino</h1>
          <span className={`bx-status${bolsa.pregao.abrindo ? " bx-status--abrindo" : ""}`}>
            <span className="bx-status__luz" aria-hidden="true" />
            {bolsa.pregao.abrindo ? "A Lisa está abrindo o pregão…" : `Pregão aberto · ${horaCurta(bolsa.pregao.hora)}${bolsa.pregao.simulada ? " (simulação)" : ""}`}
          </span>
        </div>
        <div className="bx-topo__relogio">
          <strong>{relogio}</strong>
          <small>próxima cotação às {horaCurta(((bolsa.pregao.horaDeVerdade ?? bolsa.pregao.hora) + 1) % 24)} · em {faltaMin} min</small>
        </div>
        <div className="bx-indice">
          <div>
            <span className="bx-rotulo">Índice do Reino (IRN)</span>
            <strong>{preco(idx.valor)}</strong>
            <span className={`bx-txt--${rumo(idx.variacao)}`}>{seta(idx.variacao)} {pct(idx.variacao)}</span>
          </div>
          {idx.serie.length > 0 && <Mini horas={idx.serie.map((p) => ({ hora: p.hora, preco: p.valor }))} abertura={idx.abertura} largura={120} altura={40} />}
        </div>
      </header>

      {bolsa.pregao.manchete && (
        <p className="bx-manchete"><span>🎙️ LISA AO VIVO</span> {bolsa.pregao.manchete}</p>
      )}

      {bolsa.modoDeTeste && (
        <BarraDeTeste bolsa={bolsa} hora={horaDeTeste} aoHora={setHoraDeTeste} previa={previa} aoPrevia={setPrevia} avisar={avisar} />
      )}

      <div className="bx-grade-principal">
        <section className="bx-painel bx-lista" aria-label="Ações">
          <div className="bx-painel__topo">
            <h2>Ações</h2>
            <select className="bx-select" value={ordem} onChange={(e) => setOrdem(e.target.value)} aria-label="Ordenar as ações">
              {Object.entries(ORDENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <ul>
            {lista.map((a) => (
              <li key={a.id}>
                <button type="button" className={`bx-linha-acao${acao?.id === a.id ? " bx-linha-acao--atual" : ""}`} aria-pressed={acao?.id === a.id}
                  onClick={() => { setEscolhida(a.id); if (window.innerWidth < 900) document.getElementById("bx-acao")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
                  <span className="bx-linha-acao__emoji" aria-hidden="true">{a.emoji}</span>
                  <span className="bx-linha-acao__nome"><strong>{a.id}</strong><small>{a.nome}</small></span>
                  <Mini horas={a.horas} abertura={a.abertura} />
                  <span className="bx-linha-acao__preco"><strong>{preco(a.preco)}</strong><small className={`bx-txt--${rumo(a.variacao)}`}>{seta(a.variacao)} {pct(a.variacao)}</small></span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {acao && (
          <section className="bx-painel bx-acao" id="bx-acao" aria-label={`${acao.nome}`}>
            <div className="bx-acao__cabeca">
              <span className="bx-acao__emoji" aria-hidden="true">{acao.emoji}</span>
              <div>
                <h2>{acao.nome} <small>{acao.id} · {acao.setor}{acao.estreia ? " · ✨ estreou hoje" : ""}</small></h2>
                <p className="bx-acao__preco">
                  <strong>🪙 {preco(acao.preco)}</strong>
                  <span className={`bx-pilula bx-pilula--${rumo(acao.variacao)}`}>{seta(acao.variacao)} {pct(acao.variacao)} hoje</span>
                </p>
              </div>
            </div>
            <dl className="bx-numeros">
              <div><dt>Abertura</dt><dd>{preco(acao.abertura)}</dd></div>
              <div><dt>Máxima</dt><dd>{preco(acao.maxima)}</dd></div>
              <div><dt>Mínima</dt><dd>{preco(acao.minima)}</dd></div>
              <div><dt>Volume hoje</dt><dd>{Number(acao.volume || 0).toLocaleString("pt-BR")} ações</dd></div>
            </dl>
            <div className="bx-abas" role="tablist" aria-label="Período do gráfico">
              <button type="button" role="tab" aria-selected={modo === "hoje"} className={modo === "hoje" ? "bx-aba bx-aba--atual" : "bx-aba"} onClick={() => setModo("hoje")}>Hoje · hora a hora</button>
              <button type="button" role="tab" aria-selected={modo === "velas"} className={modo === "velas" ? "bx-aba bx-aba--atual" : "bx-aba"} onClick={() => setModo("velas")}>{acao.velas.length} dias · velas</button>
            </div>
            {modo === "hoje"
              ? <GraficoDoDia horas={acao.horas} abertura={acao.abertura} rotulo={`${acao.nome} hoje: abriu a ${preco(acao.abertura)}, agora ${preco(acao.preco)}`} />
              : <GraficoDeVelas velas={acao.velas} rotulo={`${acao.nome} nos últimos ${acao.velas.length} dias`} />}
            {acao.noticia && <p className="bx-noticia"><span>📰</span> {acao.noticia}</p>}
            <p className="bx-descricao">{acao.descricao}</p>
          </section>
        )}

        {acao && <Boleta acao={acao} saldo={bolsa.saldo} regras={bolsa.regras} ocupado={ocupado} pregaoAbrindo={bolsa.pregao.abrindo} simulada={bolsa.pregao.simulada} aoEnviar={negociar} />}
      </div>

      <div className="bx-grade-baixo">
        <Carteira bolsa={bolsa} aoEscolher={setEscolhida} />
        <Destaques acoes={bolsa.acoes} aoEscolher={setEscolhida} />
        <Mural bolsa={bolsa} aoEscolher={setEscolhida} />
      </div>
      <p className="bx-rodape">
        Uma bolsa só, a mesma para todos. Todo dia a Lisa decide onde cada ação fecha; o preço anda hora a hora até lá. Corretagem de {Math.round(bolsa.regras.taxa * 100)}% (mín. 1 moeda) por ordem;
        empresa que chega a {bolsa.regras.precoMinimo} moedas vai à falência; com mais de {bolsa.regras.maximoDeAcoes} empresas, a mais antiga fecha o capital e paga quem tem ações dela.
      </p>
      {Aviso}
    </div>
  );
}

/** O letreiro de cotações correndo no topo (parado para quem pede menos movimento). */
function Letreiro({ acoes }) {
  if (!acoes.length) return null;
  const itens = acoes.map((a) => (
    <span key={a.id} className="bx-letreiro__item">
      <strong>{a.id}</strong> {preco(a.preco)} <span className={`bx-txt--${rumo(a.variacao)}`}>{seta(a.variacao)} {pct(a.variacao)}</span>
    </span>
  ));
  return (
    <div className="bx-letreiro" aria-label="Cotações">
      <div className="bx-letreiro__faixa">
        <div className="bx-letreiro__grupo">{itens}</div>
        <div className="bx-letreiro__grupo" aria-hidden="true">{itens}</div>
      </div>
    </div>
  );
}

/** A boleta: comprar ou vender a ação escolhida, ao preço desta hora. */
function Boleta({ acao, saldo, regras, ocupado, pregaoAbrindo, simulada, aoEnviar }) {
  const [tipo, setTipo] = useState("comprar");
  const [qtd, setQtd] = useState(1);
  const tem = acao.minha?.quantidade || 0;
  useEffect(() => { setQtd(1); if (!tem) setTipo("comprar"); }, [acao.id, tem]);
  const cabe = Math.max(0, Math.min(regras.maximoPorOrdem, Math.floor(saldo / (acao.preco * (1 + regras.taxa)) - 0.0001)));
  const maximo = tipo === "comprar" ? Math.max(1, cabe) : Math.max(1, tem);
  const q = Math.max(1, Math.min(maximo, Math.floor(Number(qtd) || 1)));
  const valor = tipo === "comprar" ? valorDaCompra(acao.preco, q) : valorDaVenda(acao.preco, q);
  const taxa = tipo === "comprar" ? corretagem(valor) : Math.min(valor, corretagem(valor));
  const total = tipo === "comprar" ? valor + taxa : valor - taxa;
  const falta = tipo === "comprar" && total > saldo;
  const m = acao.minha;
  return (
    <section className="bx-painel bx-boleta" aria-label="Boleta">
      <div className="bx-abas bx-abas--boleta" role="tablist" aria-label="Comprar ou vender">
        <button type="button" role="tab" aria-selected={tipo === "comprar"} className={`bx-aba bx-aba--compra${tipo === "comprar" ? " bx-aba--atual" : ""}`} onClick={() => setTipo("comprar")}>Comprar</button>
        <button type="button" role="tab" aria-selected={tipo === "vender"} disabled={!tem} className={`bx-aba bx-aba--venda${tipo === "vender" ? " bx-aba--atual" : ""}`} onClick={() => setTipo("vender")}>Vender{tem ? ` (${tem})` : ""}</button>
      </div>
      <p className="bx-boleta__ativo">{acao.emoji} <strong>{acao.id}</strong> a 🪙 {preco(acao.preco)} <small>preço desta hora</small></p>
      <label className="bx-campo">
        <span>Quantidade (até {maximo})</span>
        <div className="bx-qtd">
          <button type="button" onClick={() => setQtd(Math.max(1, q - 1))} aria-label="Menos uma">−</button>
          <input type="number" min={1} max={maximo} value={qtd} onChange={(e) => setQtd(e.target.value)} />
          <button type="button" onClick={() => setQtd(Math.min(maximo, q + 1))} aria-label="Mais uma">+</button>
          <button type="button" className="bx-qtd__max" onClick={() => setQtd(maximo)}>Máx.</button>
        </div>
      </label>
      <dl className="bx-conta">
        <dt>{q} × 🪙 {preco(acao.preco)}</dt><dd>🪙 {moedas(valor)}</dd>
        <dt>Corretagem</dt><dd>{tipo === "comprar" ? "+" : "−"} 🪙 {moedas(taxa)}</dd>
        <dt><strong>{tipo === "comprar" ? "Você paga" : "Você recebe"}</strong></dt><dd><strong>🪙 {moedas(total)}</strong></dd>
      </dl>
      {falta && <p className="bx-alerta">Faltam 🪙 {moedas(total - saldo)}.</p>}
      {simulada && <p className="bx-alerta">🧪 Você está vendo uma hora simulada — volte para “agora” para negociar (a ordem usa sempre o preço da hora de verdade).</p>}
      <button type="button" className={`bx-enviar bx-enviar--${tipo}`} disabled={ocupado || pregaoAbrindo || simulada || falta || (tipo === "vender" && !tem)} onClick={() => aoEnviar(tipo, q)}>
        {ocupado ? "Enviando a ordem…" : tipo === "comprar" ? `Comprar ${q} ${acao.id}` : `Vender ${q} ${acao.id}`}
      </button>
      <p className="bx-boleta__saldo">Saldo para investir: <strong>🪙 {moedas(saldo)}</strong></p>
      {m && (
        <dl className="bx-posicao">
          <div><dt>Você tem</dt><dd>{m.quantidade}</dd></div>
          <div><dt>Preço médio</dt><dd>{preco(m.precoMedio)}</dd></div>
          <div><dt>Vale agora</dt><dd>🪙 {moedas(m.valor)}</dd></div>
          <div><dt>Resultado</dt><dd className={`bx-txt--${rumo(m.lucro)}`}>{m.lucro >= 0 ? "+" : "−"}🪙 {moedas(Math.abs(m.lucro))}</dd></div>
        </dl>
      )}
    </section>
  );
}

function Carteira({ bolsa, aoEscolher }) {
  const minhas = bolsa.acoes.filter((a) => a.minha);
  const c = bolsa.carteira;
  return (
    <section className="bx-painel bx-carteira" aria-label="Minha carteira">
      <div className="bx-painel__topo">
        <h2>Minha carteira</h2>
        <span className={`bx-txt--${rumo(c.lucro)}`}>{c.lucro >= 0 ? "+" : "−"}🪙 {moedas(Math.abs(c.lucro))}</span>
      </div>
      <p className="bx-carteira__total">Vale <strong>🪙 {moedas(c.valor)}</strong> · pagou 🪙 {moedas(c.custo)}</p>
      {minhas.length === 0 ? <p className="bx-vazio">Você ainda não tem ações. Escolha uma empresa e compre pela boleta.</p> : (
        <table className="bx-tabela">
          <thead><tr><th scope="col">Ação</th><th scope="col">Qtd.</th><th scope="col">Médio</th><th scope="col">Agora</th><th scope="col">Resultado</th></tr></thead>
          <tbody>
            {minhas.map((a) => (
              <tr key={a.id} onClick={() => aoEscolher(a.id)}>
                <th scope="row">{a.emoji} {a.id}</th>
                <td>{a.minha.quantidade}</td>
                <td>{preco(a.minha.precoMedio)}</td>
                <td>{preco(a.preco)}</td>
                <td className={`bx-txt--${rumo(a.minha.lucro)}`}>{a.minha.lucro >= 0 ? "+" : "−"}{moedas(Math.abs(a.minha.lucro))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {bolsa.ordens.length > 0 && (
        <details className="bx-ordens">
          <summary>Minhas últimas ordens</summary>
          <ul>
            {bolsa.ordens.map((o, i) => (
              <li key={i}>{{ compra: "🛒 Comprou", venda: "💰 Vendeu", resgate: "🏁 Resgate", falencia: "💀 Faliu" }[o.tipo]} {o.quantidade} {o.acao_id} a {preco(o.preco)} · 🪙 {moedas(o.total)}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Destaques({ acoes, aoEscolher }) {
  const ordenadas = [...acoes].sort((a, b) => b.variacao - a.variacao);
  const altas = ordenadas.filter((a) => a.variacao > 0).slice(0, 3);
  const baixas = ordenadas.filter((a) => a.variacao < 0).reverse().slice(0, 3);
  const linha = (a) => (
    <li key={a.id}><button type="button" onClick={() => aoEscolher(a.id)}>{a.emoji} <strong>{a.id}</strong> <span className={`bx-txt--${rumo(a.variacao)}`}>{seta(a.variacao)} {pct(a.variacao)}</span></button></li>
  );
  return (
    <section className="bx-painel bx-destaques" aria-label="Destaques do dia">
      <h2>Destaques do dia</h2>
      <div className="bx-destaques__colunas">
        <div><h3 className="bx-txt--sobe">▲ Maiores altas</h3><ul>{altas.length ? altas.map(linha) : <li className="bx-vazio">nenhuma ainda</li>}</ul></div>
        <div><h3 className="bx-txt--cai">▼ Maiores baixas</h3><ul>{baixas.length ? baixas.map(linha) : <li className="bx-vazio">nenhuma ainda</li>}</ul></div>
      </div>
    </section>
  );
}

/** O mural de notícias: a manchete da Lisa e a notícia de cada empresa no pregão de hoje. */
function Mural({ bolsa, aoEscolher }) {
  return (
    <section className="bx-painel bx-mural" aria-label="Notícias do pregão">
      <h2>📰 Notícias do pregão</h2>
      <ul>
        {bolsa.acoes.filter((a) => a.noticia).map((a) => (
          <li key={a.id}><button type="button" onClick={() => aoEscolher(a.id)}><strong>{a.id}</strong> {a.noticia}</button></li>
        ))}
        {bolsa.saidas.map((s) => (
          <li key={s.id} className="bx-mural__saida">{s.emoji} <strong>{s.nome}</strong> {s.status === "falida" ? "faliu — as ações viraram pó" : `fechou o capital e pagou 🪙 ${preco(s.preco)} por ação`} ({diaCurto(s.dia)})</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * O modo de teste na bolsa: ver o pregão de hoje numa hora qualquer (o caminho do preço é o mesmo
 * para todos, então dá para ver como o dia anda) e pedir à Lisa a prévia do pregão de amanhã.
 */
function BarraDeTeste({ bolsa, hora, aoHora, previa, aoPrevia, avisar }) {
  const [pedindo, setPedindo] = useState(false);
  const vendo = hora == null ? bolsa.pregao.horaDeVerdade : hora;
  async function pedirPrevia() {
    setPedindo(true);
    try {
      const r = await criar("/api/reino/teste", { acao: "pregao" });
      aoPrevia(r.previa);
    } catch (e) {
      avisar(e.message);
    } finally {
      setPedindo(false);
    }
  }
  return (
    <section className="bx-teste" aria-label="Modo de teste da bolsa">
      <div className="bx-teste__linha">
        <strong>🧪 Modo de teste</strong>
        <label className="bx-teste__hora">
          <span>Ver o pregão às <b>{horaCurta(vendo)}</b>{hora == null ? " (agora)" : " (simulação)"}</span>
          <input type="range" min={0} max={23} step={1} value={vendo} onChange={(e) => aoHora(Number(e.target.value))} aria-label="Hora do pregão" />
        </label>
        {hora != null && <button type="button" className="bx-teste__botao" onClick={() => aoHora(null)}>⟲ Agora</button>}
        <button type="button" className="bx-teste__botao" disabled={pedindo} onClick={pedirPrevia}>{pedindo ? "A Lisa está pensando…" : "🎙️ Prévia do pregão de amanhã"}</button>
      </div>
      {previa && (
        <div className="bx-teste__previa">
          <p><strong>Prévia de {diaCurto(previa.dia)}</strong> ({previa.geradoPor === "lisa" ? "a Lisa decidiu" : "sorteio automático"} · nada foi aplicado): {previa.manchete}</p>
          <ul>
            {previa.movimentos.map((m) => (
              <li key={m.acao}><strong>{m.acao}</strong> {preco(m.de)} → {preco(m.para)} <span className={`bx-txt--${rumo(m.variacao)}`}>{seta(m.variacao)} {pct(m.variacao)}</span> · {m.noticia}</li>
            ))}
            {previa.novas.map((n) => <li key={n.id}>✨ <strong>{n.id}</strong> {n.emoji} {n.nome} estrearia a {preco(n.preco)} · {n.descricao}</li>)}
          </ul>
          <button type="button" className="bx-teste__botao" onClick={() => aoPrevia(null)}>Fechar a prévia</button>
        </div>
      )}
    </section>
  );
}
