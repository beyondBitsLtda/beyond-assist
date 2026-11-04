"use client";

import { useCallback, useEffect, useState } from "react";
import { obter, criar } from "@/lib/api.js";
import { useAviso } from "@/componentes/Pecas.js";
import { comemorar, reagir } from "@/componentes/Neuro.js";
import { svgDaTropa } from "@/componentes/reino/tropasDePapel.js";
import { urlDoMonstro } from "@/componentes/reino/monstrosDePapel.js";
import { urlDoVeiculo } from "@/componentes/reino/veiculosDePapel.js";
import { MONSTROS } from "@/dominio/monstros.js";
import { TROPAS } from "@/dominio/tropas.js";
import { CONSTRUCOES_DA_ILHA } from "@/dominio/ilhas.js";
import { formatarMoedas } from "@/dominio/moedas.js";

const quando = (iso) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const dataCurta = (dia) => dia.split("-").reverse().join("/");
const urlDaTropa = (tipo) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDaTropa(tipo, "#2f6fd6"))}`;
const conchas = (n) => `🐚 ${formatarMoedas(n)}`;
const estrelas = (n) => (n ? "⭐".repeat(n) : "☆");
const DESFECHO = { conquista: "conquistou", saque: "saqueou", derrota: "não conseguiu" };

/**
 * As GRANDES EXPEDIÇÕES do Reino: a Temporada das Ilhas (03/11/2026, BEYOND-0020). Uma seção do Reino, não um
 * modo à parte ("as ilhas devem ser 3D igual são os reinos, integradas ao reino"): a carta náutica e o painel de
 * cada ilha ficam aqui, e a ilha aparece em 3D no mesmo mundo do Reino, lá em cima (`aoVerNoMundo`), com o
 * cenário dela e os guardas. A batalha também passa nele (`aoBatalha`).
 * Com o Navio Pirata e a tripulação, conquiste as ilhas dos nativos (⭐⭐), construa nelas com conchas 🐚, colete
 * conchas e pérolas (moedas para o reino) e dispute as ilhas com os outros jogadores — a paz aqui é só por pacto
 * entre dois. As regras moram em src/dominio/ilhas.js.
 */
export default function GrandesExpedicoes({ ilhaNoMundo = null, aoVerNoMundo, aoBatalha, aoGaragem }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [escolhida, setEscolhida] = useState(null);
  const [ocupado, setOcupado] = useState("");
  const [Aviso, avisar] = useAviso();

  const carregar = useCallback(() => obter("/api/ilhas").then((d) => {
    setDados(d);
    setEscolhida((atual) => atual || d.ilhas.find((i) => i.dono?.souEu)?.id || d.ilhas[0]?.id || null);
    return d;
  }).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);
  // a ilha que está no mundo 3D acompanha o que mudou nela (uma construção nova, outro dono)
  const idNoMundo = ilhaNoMundo?.id || null;
  useEffect(() => {
    if (!idNoMundo || !dados) return;
    const atual = dados.ilhas.find((i) => i.id === idNoMundo);
    if (atual) aoVerNoMundo?.(atual, { semRolar: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, idNoMundo]);

  const agir = useCallback(async (chave, corpo, texto) => {
    setOcupado(chave);
    try {
      const r = await criar("/api/ilhas", corpo);
      if (texto) avisar(texto(r));
      await carregar();
      return r;
    } catch (e) {
      avisar(`Não deu: ${e.message}`);
      return null;
    } finally {
      setOcupado("");
    }
  }, [avisar, carregar]);

  async function atacar(ilha) {
    const r = await agir(`atacar:${ilha.id}`, { acao: "atacar", ilha: ilha.id }, null);
    if (!r) return;
    // a luta passa no mundo 3D do Reino; no fim, o resultado
    aoBatalha?.(r, () => {
      if (r.desfecho === "conquista") comemorar(`🏝️ ${r.ilha.nome} é sua!`);
      else if (r.desfecho === "derrota") reagir("triste", "A ilha resistiu… treine mais tripulação e volte!", 4500);
      const caidas = Object.entries(r.caidas || {}).map(([tp, n]) => `${n} ${TROPAS[tp]?.nome || tp}`).join(", ");
      avisar(`${estrelas(r.estrelas)} ${r.destruicao}% · ${r.desfecho === "conquista" ? `${r.ilha.nome} é sua! Escudo por 12 h.` : r.desfecho === "saque" ? "saque!" : "a ilha resistiu (precisava de ⭐⭐)"}${r.conchas ? ` · 🐚 +${r.conchas}` : ""}${r.moedas ? ` · 🪙 +${r.moedas}` : ""}${caidas ? ` · caíram: ${caidas}` : ""}`);
    });
  }

  const ilha = dados?.ilhas.find((i) => i.id === escolhida) || null;
  const minhas = dados?.ilhas.filter((i) => i.dono?.souEu) || [];
  const juntado = minhas.reduce((s, i) => ({ conchas: s.conchas + (i.juntado?.conchas || 0), moedas: s.moedas + (i.juntado?.moedas || 0) }), { conchas: 0, moedas: 0 });

  return (
    <section className="pf-secao il-secao" id="grandes-expedicoes" aria-label="Grandes Expedições">
      <h2 className="pf-secao__titulo">🏝️ Grandes Expedições <small>Temporada das Ilhas</small></h2>
      <p className="pf-estat__nota">A primeira temporada de domínio: leve a sua tripulação de Navio Pirata, conquiste as ilhas dos nativos, construa nelas com conchas e defenda o seu território — ou tome o dos outros. Cada ilha abre em 3D aqui no Reino. A paz geral não vale nas ilhas: só um pacto entre dois jogadores segura um ataque.</p>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      {!dados && !erro && <p className="pf-estat__nota">Içando as velas…</p>}
      {dados && (
        <>
          <div className="il-faixa">
            <div className="il-faixa__item"><span className="pf-estat__rotulo">Conchas</span><strong>{conchas(dados.conchas)}</strong></div>
            <div className="il-faixa__item"><span className="pf-estat__rotulo">Moedas do reino</span><strong>🪙 {formatarMoedas(dados.moedas)}</strong></div>
            <div className="il-faixa__item"><span className="pf-estat__rotulo">Suas ilhas</span><strong>{minhas.length} de {dados.regras.ilhasPorJogador}</strong></div>
            <div className="il-faixa__item"><span className="pf-estat__rotulo">Ataques hoje</span><strong>{dados.ataquesHoje} de {dados.regras.ataquesPorDia}</strong></div>
            <div className="il-faixa__item"><span className="pf-estat__rotulo">Temporada</span><strong>{dataCurta(dados.temporada.inicio)} a {dataCurta(dados.temporada.fim)}</strong></div>
          </div>

          {!dados.temNavio && (
            <div className="pf-cartao il-navio">
              <img src={urlDoVeiculo("navio")} alt="" width="80" height="80" />
              <p><strong>Para navegar até as ilhas, você precisa do {dados.navio.emoji} {dados.navio.nome}.</strong> Compre na garagem do Reino por 🪙 {dados.navio.preco} (Torre do Neuro {dados.navio.torreMinima}+). Enquanto isso, dá para olhar o mapa e preparar a tripulação.</p>
              <button type="button" className="pf-botao pf-botao--pequeno" onClick={aoGaragem}>🚗 Ir à garagem</button>
            </div>
          )}

          <section className="pf-cartao il-conchas" aria-label="Conchas">
            <p className="pf-estat__nota">As ilhas usam a sua própria moeda: <strong>{dados.regras.conchasPorMoeda} conchas por moeda</strong> do reino — território desvalorizado, tudo lá é barato. Troque, construa e treine.</p>
            <div className="il-conchas__botoes">
              {dados.regras.pacotes.map((m) => (
                <button key={m} type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={Boolean(ocupado) || dados.moedas < m}
                  onClick={() => agir(`conchas:${m}`, { acao: "conchas", moedas: m }, (r) => `🐚 +${r.conchas} conchas`)}>
                  🪙 {m} → 🐚 {m * dados.regras.conchasPorMoeda}
                </button>
              ))}
              {minhas.length > 0 && (
                <button type="button" className="pf-botao pf-botao--pequeno" disabled={Boolean(ocupado) || (!juntado.conchas && !juntado.moedas)}
                  onClick={() => agir("coletar", { acao: "coletar" }, (r) => { comemorar(`🏝️ +🐚 ${r.conchas} e +🪙 ${r.moedas}`); return `Coletou 🐚 ${r.conchas} e 🪙 ${r.moedas} das suas ilhas`; })}>
                  ⛏️ Coletar das ilhas · 🐚 {juntado.conchas} · 🪙 {juntado.moedas}
                </button>
              )}
            </div>
          </section>


          <div className="il-grade">
            <Mapa ilhas={dados.ilhas} escolhida={escolhida} aoEscolher={setEscolhida} />
            {ilha && <PainelDaIlha ilha={ilha} ocupado={ocupado} aoAtacar={atacar} agir={agir} conchas={dados.conchas}
              noMundo={ilhaNoMundo?.id === ilha.id} aoVerNoMundo={() => aoVerNoMundo?.(ilha)} />}
          </div>

          <Tripulacao t={dados.tripulacao} ocupado={ocupado} agir={agir} />
          <Pactos pactos={dados.pactos} ocupado={ocupado} agir={agir} diasDoPacto={dados.regras.diasDoPacto} />
          <Recentes lista={dados.recentes} />
        </>
      )}
      {Aviso}
    </section>
  );
}

/** O mapa do arquipélago: o mar, as ilhas no lugar delas e a bandeira de quem manda em cada uma. */
function Mapa({ ilhas, escolhida, aoEscolher }) {
  return (
    <section className="il-mapa" aria-label="Mapa do arquipélago">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="il-mapa__mar" aria-hidden="true">
        <defs>
          <radialGradient id="il-agua" cx="50%" cy="45%" r="75%"><stop offset="0%" stopColor="#5ec8ef" /><stop offset="100%" stopColor="#1d7fb8" /></radialGradient>
        </defs>
        <rect width="100" height="100" fill="url(#il-agua)" />
        {[18, 38, 58, 78].map((y) => <path key={y} d={`M0 ${y} q6 -2 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0`} fill="none" stroke="#bae6fd" strokeWidth="0.35" opacity="0.5" />)}
      </svg>
      {ilhas.map((i) => {
        const de = i.dono ? (i.dono.souEu ? "minha" : "outro") : "nativos";
        return (
          <button key={i.id} type="button" className={`il-ilha il-ilha--${de}${i.id === escolhida ? " il-ilha--escolhida" : ""}`}
            style={{ left: `${i.x}%`, top: `${i.y}%` }} onClick={() => aoEscolher(i.id)}
            aria-label={`${i.nome}, ${i.nomeDoNivel}, ${i.dono ? (i.dono.souEu ? "sua" : `de ${i.dono.nome}`) : "dos nativos"}`} aria-pressed={i.id === escolhida}>
            <span className="il-ilha__terra" aria-hidden="true"><span className="il-ilha__emoji">{i.emoji}</span></span>
            <span className="il-ilha__nome">{i.nome}</span>
            <span className="il-ilha__dono">{i.dono ? (i.dono.souEu ? "🚩 sua" : `🏴 ${i.dono.nome}`) : `🗿 nativos · ${"★".repeat(i.nivel)}`}</span>
          </button>
        );
      })}
    </section>
  );
}

function PainelDaIlha({ ilha, ocupado, aoAtacar, agir, conchas: saldo, noMundo, aoVerNoMundo }) {
  const minha = ilha.dono?.souEu;
  const defensores = Object.entries(ilha.defensores || {});
  return (
    <section className="pf-cartao il-painel" aria-label={ilha.nome}>
      <div className="il-painel__topo">
        <span className="il-painel__emoji" aria-hidden="true">{ilha.emoji}</span>
        <div>
          <h2>{ilha.nome}</h2>
          <p className="pf-estat__nota">{ilha.nomeDoNivel} · {ilha.dono ? (minha ? "a ilha é sua" : `de ${ilha.dono.nome}`) : "dos nativos"}{ilha.escudoAte ? ` · 🛡️ escudo até ${quando(ilha.escudoAte)}` : ""}{ilha.pacto ? " · 🤝 vocês têm um pacto" : ""}</p>
        </div>
      </div>
      <button type="button" className={`pf-botao ${noMundo ? "pf-botao--sec " : ""}il-ver3d`} onClick={aoVerNoMundo} data-so-olhar>
        {noMundo ? "👁️ A ilha está no mundo 3D, lá em cima" : "👁️ Ver a ilha em 3D"}
      </button>
      <p className="pf-estat__nota">Produz 🐚 {ilha.producao.conchas}/h e 🪙 {ilha.producao.moedas}/h (pérolas){minha && ilha.juntado ? ` — juntou 🐚 ${ilha.juntado.conchas} e 🪙 ${ilha.juntado.moedas} em ${String(ilha.juntado.horas).replace(".", ",")} h` : ""}.</p>
      {defensores.length > 0 && (
        <div className="il-defensores">
          <span className="pf-estat__rotulo">{ilha.dono ? "Guardas" : "Nativos"}</span>
          <div className="il-defensores__lista">
            {defensores.map(([tipo, n]) => (
              <span key={tipo} className="il-defensor" title={MONSTROS[tipo]?.nome}><img src={urlDoMonstro(tipo)} alt="" width="34" height="34" /> {n}× {MONSTROS[tipo]?.nome}</span>
            ))}
          </div>
        </div>
      )}
      {!minha && (
        <div className="il-painel__acoes">
          <button type="button" className="pf-botao" disabled={!ilha.podeAtacar || Boolean(ocupado)} onClick={() => aoAtacar(ilha)}>
            {ocupado === `atacar:${ilha.id}` ? "Zarpando…" : ilha.dono ? `⚔️ Invadir a ilha de ${ilha.dono.nome}` : "🏴‍☠️ Zarpar e conquistar"}
          </button>
          {!ilha.podeAtacar && ilha.motivoDoAtaque && <p className="pf-estat__nota">{ilha.motivoDoAtaque}</p>}
          {ilha.dono && !ilha.pacto && (
            <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={Boolean(ocupado)}
              onClick={() => agir(`pacto:${ilha.dono.id}`, { acao: "pacto", com: ilha.dono.id }, () => `🤝 Pedido de pacto mandado para ${ilha.dono.nome}`)}>
              🤝 Propor pacto a {ilha.dono.nome}
            </button>
          )}
          <p className="pf-estat__nota">⭐⭐ (a Cabana do Chefe no chão, ou metade da ilha) conquista a ilha; ⭐ leva conchas. Quem cai na batalha sai da tripulação.</p>
        </div>
      )}
      <h3 className="il-painel__sub">Construções</h3>
      <ul className="il-construcoes">
        {ilha.construcoes.map((c) => (
          <li key={c.chave} className={c.nivel ? "" : "il-construcoes__vazia"}>
            <span><span aria-hidden="true">{c.emoji}</span> <strong>{c.nome}</strong> {c.nivel ? `nv ${c.nivel}` : "—"}<small> · {c.efeito}</small></span>
            {minha && c.nivel < 5 && (
              <button type="button" className="pf-botao pf-botao--pequeno" disabled={!c.pode || Boolean(ocupado)} title={c.motivo || undefined}
                onClick={() => agir(`construir:${c.chave}`, { acao: "construir", ilha: ilha.id, chave: c.chave }, (r) => `${c.emoji} ${c.nome} no nível ${r.nivel}`)}>
                {c.nivel ? "Melhorar" : "Construir"} · 🐚 {c.custo}
              </button>
            )}
            {minha && c.nivel < 5 && !c.pode && c.motivo && <small className="il-construcoes__motivo">{c.motivo}</small>}
          </li>
        ))}
      </ul>
      {minha && saldo < 300 && <p className="pf-estat__nota">Precisa de conchas? Troque moedas lá em cima, ou colete a produção das suas ilhas.</p>}
    </section>
  );
}

function Tripulacao({ t, ocupado, agir }) {
  const lista = Object.entries(t.tropas);
  return (
    <section className="pf-secao" aria-label="Tripulação">
      <h2 className="pf-secao__titulo">🏴‍☠️ A tripulação <small>{t.usado} de {t.capacidade} de espaço · Porto {t.porto}</small></h2>
      <p className="pf-estat__nota">Quem vai no navio a cada ataque. O espaço cresce com o Porto das suas ilhas (+12 por nível); as tropas mais fortes pedem um Porto maior.{lista.length ? "" : " Ainda ninguém a bordo."}</p>
      <ul className="il-tripulacao">
        {t.catalogo.map((x) => (
          <li key={x.id} className="pf-cartao il-tropa">
            <img src={urlDaTropa(x.id)} alt="" width="64" height="64" />
            <div>
              <strong>{x.emoji} {x.nome}</strong> {x.tem ? <span className="pf-pilula">a bordo: {x.tem}</span> : null}
              <p className="pf-estat__nota">{x.descricao} · ❤️ {x.vida} · 💥 {x.dano} · espaço {x.espaco}</p>
              <div className="il-tropa__botoes">
                <button type="button" className="pf-botao pf-botao--pequeno" disabled={!x.pode1 || Boolean(ocupado)} title={x.motivo || undefined}
                  onClick={() => agir(`treinar:${x.id}`, { acao: "treinar", tropa: x.id, quantidade: 1 }, () => `${x.emoji} +1 ${x.nome}`)}>+1 · 🐚 {x.custo}</button>
                <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={!x.pode5 || Boolean(ocupado)}
                  onClick={() => agir(`treinar:${x.id}`, { acao: "treinar", tropa: x.id, quantidade: 5 }, () => `${x.emoji} +5 ${x.nome}`)}>+5 · 🐚 {x.custo * 5}</button>
              </div>
              {!x.pode1 && x.motivo && <p className="pf-estat__nota">{x.motivo}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Pactos({ pactos, ocupado, agir, diasDoPacto }) {
  return (
    <section className="pf-secao" aria-label="Pactos">
      <h2 className="pf-secao__titulo">🤝 Pactos <small>a única paz das ilhas</small></h2>
      <p className="pf-estat__nota">A paz do reino não vale no arquipélago. Para não ser atacado (e não atacar) um vizinho, proponha um pacto: aceito, vale {diasDoPacto} dias, só entre vocês dois.</p>
      {!pactos.length && <p className="pf-estat__nota">Nenhum pacto por enquanto.</p>}
      <ul className="il-lista">
        {pactos.map((p) => (
          <li key={p.id}>
            {p.vigente ? `🤝 Pacto com ${p.com} até ${quando(p.ate)}` : p.euPropus ? `⏳ Você propôs um pacto a ${p.com} — esperando a resposta` : `📨 ${p.com} propôs um pacto a você`}
            {!p.vigente && !p.euPropus && (
              <button type="button" className="pf-botao pf-botao--pequeno" disabled={Boolean(ocupado)}
                onClick={() => agir(`aceitar:${p.id}`, { acao: "aceitar-pacto", id: p.id }, () => `🤝 Pacto com ${p.com} fechado`)}>Aceitar o pacto</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Recentes({ lista }) {
  if (!lista.length) return null;
  return (
    <section className="pf-secao" aria-label="Batalhas recentes">
      <h2 className="pf-secao__titulo">⚓ Batalhas recentes</h2>
      <ul className="il-lista">
        {lista.map((b) => (
          <li key={b.id}>
            {estrelas(b.estrelas)} {quando(b.quando)} · {b.ataquei ? `você ${DESFECHO[b.desfecho]} ${b.ilha} (contra ${b.outro})` : `${b.outro} ${DESFECHO[b.desfecho]} ${b.ilha}, que era sua`}
            {b.conchas ? ` · 🐚 ${b.ataquei ? "+" : "−"}${b.conchas}` : ""}{b.moedas ? ` · 🪙 +${b.moedas}` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}
