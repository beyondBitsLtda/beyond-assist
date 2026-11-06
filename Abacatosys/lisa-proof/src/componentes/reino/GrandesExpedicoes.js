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
import { CONSTRUCOES_DA_ILHA, HORAS_ATE_ENCHER_NA_ILHA, protecaoDoBau } from "@/dominio/ilhas.js";
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
export default function GrandesExpedicoes({ ilhaNoMundo = null, aoVerNoMundo, aoBatalha, aoGaragem, foco = null, destaque = null, aoSairDoFoco, aoArquipelago }) {
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

  // a VISÃO DA ILHA (06/11/2026): com a ilha no mundo 3D, o Reino mostra só ela — tudo dela, aqui embaixo
  if (foco) {
    const emFoco = dados?.ilhas.find((i) => i.id === foco) || null;
    return (
      <>
        {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
        {!dados && !erro && <p className="pf-estat__nota">Içando as velas…</p>}
        {dados && emFoco && (
          <IlhaEmFoco ilha={emFoco} dados={dados} minhas={minhas} ocupado={ocupado} agir={agir} aoAtacar={atacar} destaque={destaque}
            aoSair={aoSairDoFoco} aoArquipelago={aoArquipelago} aoGaragem={aoGaragem} />
        )}
        {Aviso}
      </>
    );
  }

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
              tripulacao={dados.tripulacao} pacotes={dados.regras.pacotes} conchasPorMoeda={dados.regras.conchasPorMoeda} moedas={dados.moedas}
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

function PainelDaIlha({ ilha, ocupado, aoAtacar, agir, conchas: saldo, noMundo, aoVerNoMundo, tripulacao, pacotes = [], conchasPorMoeda = 10, moedas = 0 }) {
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
          {ilha.semTripulacao && tripulacao && (
            <PassosDaTripulacao t={tripulacao} conchas={saldo} moedas={moedas} pacotes={pacotes} conchasPorMoeda={conchasPorMoeda} ocupado={ocupado} agir={agir} />
          )}
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

/**
 * A visão da ilha (06/11/2026: "quando eu mudar para a visão da ilha devo ver tudo relacionado à ilha, inclusive as
 * construções e a extração de recursos"): o que ela produz e o que já juntou (com a coleta), as construções com os
 * botões, os guardas, o ataque (se não é sua) e a tripulação. Clicar numa construção no 3D (`destaque`) traz o cartão dela.
 */
function IlhaEmFoco({ ilha, dados, minhas, ocupado, agir, aoAtacar, destaque, aoSair, aoArquipelago, aoGaragem }) {
  const minha = ilha.dono?.souEu;
  const nivel = Object.fromEntries(ilha.construcoes.map((c) => [c.chave, c.nivel]));
  const defensores = Object.entries(ilha.defensores || {});
  const guardas = defensores.reduce((s, [, n]) => s + n, 0);
  const j = ilha.juntado;
  const cheio = j ? Math.min(100, Math.round((j.horas / HORAS_ATE_ENCHER_NA_ILHA) * 100)) : 0;

  // a construção clicada no 3D: o cartão dela aparece e pisca
  useEffect(() => {
    if (!destaque?.chave) return;
    const el = document.getElementById(`ilha-construcao-${destaque.chave}`);
    if (!el) return;
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    el.classList.remove("il-foco__predio--destaque");
    void el.offsetWidth;
    el.classList.add("il-foco__predio--destaque");
  }, [destaque]);

  return (
    <section className="pf-secao il-foco" id="ilha-em-foco" aria-label={`Tudo da ${ilha.nome}`}>
      <div className="il-foco__topo">
        <span className="il-foco__emoji" aria-hidden="true">{ilha.emoji}</span>
        <div>
          <h2>{ilha.nome}</h2>
          <p className="pf-estat__nota">{ilha.nomeDoNivel} · {ilha.dono ? (minha ? "a ilha é sua" : `de ${ilha.dono.nome}`) : "dos nativos"}{ilha.escudoAte ? ` · 🛡️ escudo até ${quando(ilha.escudoAte)}` : ""}{ilha.pacto ? " · 🤝 vocês têm um pacto" : ""}</p>
        </div>
        <div className="il-foco__voltar">
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={aoArquipelago}>🗺️ Todas as ilhas</button>
          <button type="button" className="pf-botao pf-botao--pequeno" onClick={aoSair}>⬅ Meu reino</button>
        </div>
      </div>

      <div className="il-faixa">
        <div className="il-faixa__item"><span className="pf-estat__rotulo">Produção</span><strong>🐚 {ilha.producao.conchas}/h · 🪙 {ilha.producao.moedas}/h</strong></div>
        <div className="il-faixa__item"><span className="pf-estat__rotulo">Pronto para coletar</span><strong>{j ? `🐚 ${j.conchas} · 🪙 ${j.moedas}` : "só o dono coleta"}</strong></div>
        <div className="il-faixa__item"><span className="pf-estat__rotulo">{ilha.dono ? "Guardas" : "Nativos"}</span><strong>{guardas}</strong></div>
        <div className="il-faixa__item"><span className="pf-estat__rotulo">Baú do Tesouro</span><strong>{nivel.cofre ? `protege 🐚 ${protecaoDoBau([{ construcoes: nivel }])}` : "não tem"}</strong></div>
        <div className="il-faixa__item"><span className="pf-estat__rotulo">Suas conchas</span><strong>{conchas(dados.conchas)}</strong></div>
      </div>

      <h3 className="il-foco__sub">⛏️ Extração</h3>
      <div className="il-foco__extracao">
        <div className="pf-cartao il-foco__fonte">
          <span className="il-foco__fonte-emoji" aria-hidden="true">🌴</span>
          <div>
            <strong>Coqueiral {nivel.mina ? `nv ${nivel.mina}` : "— não construído"}</strong>
            <p className="pf-estat__nota">{nivel.mina ? `Os catadores juntam 🐚 ${ilha.producao.conchas} conchas por hora (até ${HORAS_ATE_ENCHER_NA_ILHA} h sem coletar).` : "Construa o Coqueiral para a ilha produzir conchas."}</p>
          </div>
        </div>
        <div className="pf-cartao il-foco__fonte">
          <span className="il-foco__fonte-emoji" aria-hidden="true">🦪</span>
          <div>
            <strong>Recife de Pérolas {nivel.biblioteca ? `nv ${nivel.biblioteca}` : "— não construído"}</strong>
            <p className="pf-estat__nota">{nivel.biblioteca ? `Os mergulhadores trazem pérolas: 🪙 ${ilha.producao.moedas} moedas do reino por hora.` : "Construa o Recife para a ilha render moedas de verdade para o reino."}</p>
          </div>
        </div>
        {minha && j && (
          <div className="pf-cartao il-foco__coleta">
            <div className="il-foco__barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={cheio} aria-label="Quanto a ilha já encheu">
              <span style={{ width: `${cheio}%` }} />
            </div>
            <p className="pf-estat__nota">{String(j.horas).replace(".", ",")} h de produção juntadas{cheio >= 100 ? " — cheio: colete para a ilha voltar a produzir" : ` · enche em ${Math.max(0, HORAS_ATE_ENCHER_NA_ILHA - j.horas).toFixed(1).replace(".", ",")} h`}</p>
            <button type="button" className="pf-botao pf-botao--pequeno" disabled={Boolean(ocupado) || (!j.conchas && !j.moedas)}
              onClick={() => agir("coletar", { acao: "coletar" }, (r) => { comemorar(`🏝️ +🐚 ${r.conchas} e +🪙 ${r.moedas}`); return `Coletou 🐚 ${r.conchas} e 🪙 ${r.moedas} das suas ilhas`; })}>
              ⛏️ Coletar · 🐚 {j.conchas} · 🪙 {j.moedas}
            </button>
            {minhas.length > 1 && <small className="pf-estat__nota">A coleta junta a produção de todas as suas ilhas.</small>}
          </div>
        )}
      </div>

      <h3 className="il-foco__sub">🏗️ Construções</h3>
      <div className="il-foco__predios">
        {ilha.construcoes.map((c) => (
          <div key={c.chave} id={`ilha-construcao-${c.chave}`} className={`pf-cartao il-foco__predio${c.nivel ? "" : " il-foco__predio--vazio"}`}>
            <div className="il-foco__predio-topo">
              <span className="il-foco__predio-emoji" aria-hidden="true">{c.emoji}</span>
              <div><strong>{c.nome}</strong><small>{c.nivel ? `nível ${c.nivel} de 5` : "não construída"}</small></div>
            </div>
            <p className="pf-estat__nota">{c.efeito}</p>
            {minha && c.nivel < 5 && (
              <>
                <button type="button" className="pf-botao pf-botao--pequeno" disabled={!c.pode || Boolean(ocupado)} title={c.motivo || undefined}
                  onClick={() => agir(`construir:${c.chave}`, { acao: "construir", ilha: ilha.id, chave: c.chave }, (r) => `${c.emoji} ${c.nome} no nível ${r.nivel}`)}>
                  {c.nivel ? "Melhorar" : "Construir"} · 🐚 {c.custo}
                </button>
                {!c.pode && c.motivo && <small className="il-construcoes__motivo">{c.motivo}</small>}
              </>
            )}
            {minha && c.nivel >= 5 && <small className="pf-estat__nota">nível máximo</small>}
          </div>
        ))}
      </div>
      {minha && dados.conchas < 300 && <p className="pf-estat__nota">Precisa de conchas? Troque moedas em 🗺️ Todas as ilhas, ou colete a produção.</p>}

      {defensores.length > 0 && (
        <>
          <h3 className="il-foco__sub">{ilha.dono ? "🛡️ Guardas" : "🗿 Nativos"}</h3>
          <div className="il-defensores__lista">
            {defensores.map(([tipo, n]) => (
              <span key={tipo} className="il-defensor" title={MONSTROS[tipo]?.nome || TROPAS[tipo]?.nome}>
                <img src={MONSTROS[tipo] ? urlDoMonstro(tipo) : urlDaTropa(tipo)} alt="" width="40" height="40" /> {n}× {MONSTROS[tipo]?.nome || TROPAS[tipo]?.nome || tipo}
              </span>
            ))}
          </div>
        </>
      )}

      {!minha && (
        <>
          <h3 className="il-foco__sub">🏴‍☠️ Conquistar</h3>
          <div className="il-painel__acoes">
            {!dados.temNavio ? (
              <>
                <p className="pf-estat__nota">Para navegar até as ilhas, você precisa do {dados.navio.emoji} {dados.navio.nome} (🪙 {dados.navio.preco}).</p>
                <button type="button" className="pf-botao pf-botao--pequeno" onClick={aoGaragem}>🚗 Ir à garagem</button>
              </>
            ) : (
              <>
                <button type="button" className="pf-botao" disabled={!ilha.podeAtacar || Boolean(ocupado)} onClick={() => aoAtacar(ilha)}>
                  {ocupado === `atacar:${ilha.id}` ? "Zarpando…" : ilha.dono ? `⚔️ Invadir a ilha de ${ilha.dono.nome}` : "🏴‍☠️ Zarpar e conquistar"}
                </button>
                {!ilha.podeAtacar && ilha.motivoDoAtaque && <p className="pf-estat__nota">{ilha.motivoDoAtaque}</p>}
                {ilha.semTripulacao && (
                  <PassosDaTripulacao t={dados.tripulacao} conchas={dados.conchas} moedas={dados.moedas} pacotes={dados.regras.pacotes} conchasPorMoeda={dados.regras.conchasPorMoeda} ocupado={ocupado} agir={agir} />
                )}
              </>
            )}
            <p className="pf-estat__nota">⭐⭐ (a Cabana do Chefe no chão, ou metade da ilha) conquista a ilha; ⭐ leva conchas. Quem cai na batalha sai da tripulação.</p>
          </div>
        </>
      )}

      <Tripulacao t={dados.tripulacao} ocupado={ocupado} agir={agir} />
    </section>
  );
}

/**
 * Os passos para a primeira tripulação (05/11/2026: "estou com o navio comprado, mas a opção de conquistar fica
 * desabilitada"): o navio sozinho não zarpa. Aqui mesmo, no painel da ilha: trocar moedas por conchas, treinar a
 * tripulação (piratas e arpoadoras, que o navio aceita sem Porto) e zarpar — sem precisar achar a seção lá embaixo.
 */
function PassosDaTripulacao({ t, conchas, moedas, pacotes, conchasPorMoeda, ocupado, agir }) {
  const basicas = t.catalogo.filter((x) => x.id === "pirata" || x.id === "arpoadora");
  const maisBarata = Math.min(...basicas.map((x) => x.custo * 5));
  const falta = Math.max(0, maisBarata - conchas);
  // o menor pacote de troca que cobre 5 piratas (ou o maior que der)
  const pacote = pacotes.find((m) => m * conchasPorMoeda >= falta && m <= moedas) || [...pacotes].reverse().find((m) => m <= moedas);
  return (
    <div className="il-passos" role="group" aria-label="Como montar a tripulação">
      <p className="il-passos__titulo">🏴‍☠️ Falta a tripulação para zarpar</p>
      <ol>
        <li className={falta === 0 ? "il-passos__feito" : ""}>
          <span>Conchas para pagar: você tem 🐚 {conchas}.</span>
          {falta > 0 && (pacote ? (
            <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={Boolean(ocupado)}
              onClick={() => agir(`conchas:${pacote}`, { acao: "conchas", moedas: pacote }, (r) => `🐚 +${r.conchas} conchas`)}>
              Trocar 🪙 {pacote} → 🐚 {pacote * conchasPorMoeda}
            </button>
          ) : <small>Faltam moedas do reino para trocar por conchas.</small>)}
        </li>
        <li>
          <span>Treine a tripulação (o navio leva {t.capacidade} de espaço):</span>
          <span className="il-passos__botoes">
            {basicas.map((x) => (
              <button key={x.id} type="button" className="pf-botao pf-botao--pequeno" disabled={!x.pode5 || Boolean(ocupado)} title={x.motivo || undefined}
                onClick={() => agir(`treinar:${x.id}`, { acao: "treinar", tropa: x.id, quantidade: 5 }, () => `${x.emoji} +5 ${x.nome}`)}>
                {x.emoji} +5 {x.nome} · 🐚 {x.custo * 5}
              </button>
            ))}
            <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => document.getElementById("il-tripulacao")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              ver todas as tropas ↓
            </button>
          </span>
        </li>
        <li><span>Zarpe: ⭐⭐ (a Cabana do Chefe no chão, ou metade da ilha) conquista a ilha.</span></li>
      </ol>
    </div>
  );
}

function Tripulacao({ t, ocupado, agir }) {
  const lista = Object.entries(t.tropas);
  return (
    <section className="pf-secao" id="il-tripulacao" aria-label="Tripulação">
      <h2 className="pf-secao__titulo">🏴‍☠️ A tripulação <small>{t.usado} de {t.capacidade} de espaço · Porto {t.porto}</small></h2>
      <p className="pf-estat__nota">Quem vai no navio a cada ataque. O espaço cresce com o Porto das suas ilhas (+12 por nível); as tropas mais fortes pedem um Porto maior.{lista.length ? "" : " Ainda ninguém a bordo."}</p>
      <ul className="il-tripulacao">
        {t.catalogo.map((x) => (
          <li key={x.id} className="pf-cartao il-tropa">
            <img src={urlDaTropa(x.id)} alt="" width="64" height="64" />
            <div>
              <strong>{x.emoji} {x.nome}</strong> {x.tem ? <span className="pf-pilula">a bordo: {x.tem}</span> : null}
              <p className="pf-estat__nota">{x.descricao} · ❤️ {x.vida} · {x.cura ? `💚 cura ${x.cura}` : `💥 ${x.dano}`} · espaço {x.espaco} · ⚓ Porto {x.nivelMinimo}{x.voa ? " · voa" : ""}</p>
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
