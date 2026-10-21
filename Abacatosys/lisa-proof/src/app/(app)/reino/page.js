"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { obter, criar } from "@/lib/api.js";
import { useAviso, Barra } from "@/componentes/Pecas.js";
import { CartaoDeVale } from "@/componentes/Vales.js";
import Neuro, { reagir, comemorar } from "@/componentes/Neuro.js";
import {
  ATAQUES_POR_DIA, FATIA_DO_SAQUE, TETO_DO_SAQUE, ESCUDO_APOS_DERROTA_HORAS, ESCUDO_DE_NOVATO_HORAS, HORAS_ATE_ENCHER,
  CONSTRUCOES, RIVAIS_SIMULADOS, rivalSimulado, simularBatalha, protecaoDoCofre, poderDo, combateDe, previsaoDeEstrelas,
  exercitoDeTreino,
} from "@/dominio/reino.js";
import { TROPAS, ORDEM_DAS_TROPAS, totalDeTropas } from "@/dominio/tropas.js";

// O mundo 3D (Three.js) só baixa nesta tela, e só no navegador.
const Mundo3D = dynamic(() => import("@/componentes/reino/Mundo3D.js"), {
  ssr: false,
  loading: () => <div className="rn-mundo rn-mundo--carregando"><span>Montando o reino…</span></div>,
});

const numero = (n) => new Intl.NumberFormat("pt-BR").format(n || 0);
const hora = (iso) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const Moedas = ({ n }) => <span className="rn-moedas">🪙 {numero(n)}</span>;

/**
 * O Reino do Neuro. Estudar dá moedas (1 ponto = 1 moeda); moedas constroem o reino e sobem o
 * Neuro; o reino invade e é invadido por outros jogadores. As regras estão em
 * src/dominio/reino.js e a explicação para a pessoa, no fim desta tela.
 */
export default function Reino() {
  const [reino, setReino] = useState(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [alvos, setAlvos] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [simulando, setSimulando] = useState(false);
  const [Aviso, avisar] = useAviso();

  useEffect(() => {
    obter("/api/reino").then(setReino).catch((e) => setErro(e.message));
    obter("/api/reino/alvos").then(setAlvos).catch(() => {});
    const aoResgatar = () => obter("/api/reino").then(setReino).catch(() => {});
    window.addEventListener("proof-vale-resgatado", aoResgatar);
    return () => window.removeEventListener("proof-vale-resgatado", aoResgatar);
  }, []);

  async function agir(chave, corpo, aoTerminar) {
    setOcupado(chave);
    try {
      const r = await criar("/api/reino", corpo);
      setReino(r.reino);
      aoTerminar?.(r.resultado);
      if (alvos) carregarAlvos(); // o meu ataque mudou: as faixas e os botões também
    } catch (e) {
      avisar(e.message);
      reagir("triste", "Ops, não deu certo dessa vez.");
    } finally {
      setOcupado("");
    }
  }

  const treinar = (destino, tropa, quantidade) => agir(`treinar:${destino}:${tropa.chave}`, { acao: "treinar", tropa: tropa.chave, quantidade, destino },
    (r) => reagir("feliz", `+${r.quantidade} ${tropa.emoji} ${tropa.nome}${r.quantidade > 1 ? "s" : ""} ${destino === "exercito" ? "no exército" : "na defesa"}!`));

  function assistir(b) {
    const ok = assistirNaIlha({
      entrada: b.combate, papel: b.ataquei ? "atacante" : "defensor", resultado: b.resultado,
      titulo: b.ataquei ? `▶ REPLAY · VOCÊ INVADIU ${String(b.outro).toUpperCase()}` : `▶ REPLAY · ${String(b.outro).toUpperCase()} INVADIU VOCÊ`,
    });
    if (!ok) avisar("O replay precisa do mundo 3D (e do movimento ligado).");
  }

  async function carregarAlvos() {
    try {
      setAlvos(await obter("/api/reino/alvos"));
    } catch (e) {
      avisar(e.message);
    }
  }

  async function invadirReino(alvo) {
    setOcupado(`invadir:${alvo.id}`);
    setResultado(null);
    reagir("pensando", "Avançar! ⚔️", 2000);
    try {
      const r = await criar("/api/reino/invadir", { alvo: alvo.id });
      const mostrar = () => {
        setReino(r.reino);
        setResultado(r.resultado);
        if (r.resultado.venceu) comemorar(r.resultado.saque ? `Vitória! +${r.resultado.saque} moedas` : "Vitória!");
        else reagir("triste", "Eles se defenderam bem… da próxima vamos mais fortes!");
        carregarAlvos();
        setOcupado("");
        document.getElementById("invadir")?.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      assistirNaIlha({
        entrada: r.resultado.combate, papel: "atacante", resultado: r.resultado,
        titulo: `⚔️ INVADINDO ${String(r.resultado.alvo.reino).toUpperCase()}`, aoTerminar: mostrar,
      });
    } catch (e) {
      avisar(e.message);
      setOcupado("");
    }
  }

  if (!reino) {
    return erro ? <div className="pf-aviso pf-aviso--erro">{erro}</div> : <div className="pf-carregando">Abrindo os portões do reino…</div>;
  }

  const restantes = reino.invasoes.porDia - reino.invasoes.feitasHoje;
  const disponiveis = alvos ? alvos.alvos.filter((a) => a.pode).length : null;
  const escudoMaisCurto = alvos?.alvos.filter((a) => a.escudoAte).map((a) => a.escudoAte).sort()[0] || null;
  const irParaInvasoes = () => document.getElementById("invadir")?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start",
  });

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>{reino.nome}</h1>
          <p>Estude, ganhe moedas, construa — e defenda o seu reino. <NomeDoReino atual={reino.nome} ocupado={ocupado === "nome"} aoSalvar={(nome) => agir("nome", { acao: "nome", nome }, () => avisar("Reino renomeado"))} /></p>
        </div>
      </div>

      <CartaoDeVale />

      {/* ------------------------------------------------------------ vista e números */}
      <VistaDoReino reino={reino} />

      {/* o atalho para a briga: logo abaixo do mundo, com quantos alvos há agora */}
      <div className="rn-acoes">
        <button type="button" className="pf-botao rn-acoes__invadir" onClick={irParaInvasoes}>
          ⚔️ Invadir reinos <span className="rn-acoes__conta">{restantes > 0 ? `${restantes} de ${reino.invasoes.porDia} hoje` : "acabaram as de hoje"}</span>
        </button>
        <span className="rn-acoes__nota">
          {disponiveis == null ? "procurando reinos…"
            : disponiveis > 0 ? `${disponiveis} reino(s) para invadir agora`
            : alvos.alvos.length === 0 ? "ainda não há outros reinos"
            : `todos estão com escudo${escudoMaisCurto ? ` · o primeiro abre ${hora(escudoMaisCurto)}` : ""}`}
        </span>
        <button type="button" className="pf-botao pf-botao--sec" aria-expanded={simulando} aria-controls="simulador" onClick={() => setSimulando((s) => !s)}>
          🎮 {simulando ? "Fechar simulação" : "Simular batalha"}
        </button>
        <Link href="/ranking" className="pf-botao pf-botao--sec rn-acoes__ranking">🏆 Ranking</Link>
      </div>
      {simulando && <Simulador reino={reino} aoFechar={() => setSimulando(false)} />}

      <div className="rn-numeros">
        <Numero rotulo="Moedas" valor={<Moedas n={reino.saldo} />} nota={`${numero(reino.cofre.protege)} a salvo no cofre`} />
        <Numero rotulo="Troféus" valor={`🏆 ${numero(reino.trofeus)}`} nota={<Link href="/ranking">ver ranking dos reinos</Link>} />
        <Numero rotulo="Ataque · Defesa" valor={`⚔️ ${reino.poder.ataque}/s · 🛡️ ${reino.poder.defesa}`} nota={`exército: ${totalDeTropas(reino.exercito.tropas)} tropa(s) · defesa: ${totalDeTropas(reino.guarnicao.tropas)}`} />
        <Numero rotulo="Escudo" valor={reino.escudoAte ? "🛡️ Ativo" : "Sem escudo"} nota={reino.escudoAte ? `até ${hora(reino.escudoAte)} · atacar tira o escudo` : "o seu reino pode ser invadido"} />
      </div>

      {/* ------------------------------------------------------------ Neuro e mina */}
      <div className="pf-grade pf-grade--2 pf-secao">
        <section className="pf-cartao rn-neuro">
          <div className="pf-estat__rotulo">O seu Neuro</div>
          <div className="pf-estat__valor">Nível {reino.neuro.nivel} <small>· {reino.neuro.estagio}</small></div>
          <p className="pf-estat__nota">O herói do reino: vai em toda invasão (❤️ {reino.heroi.ataque.vida} · 💥 {reino.heroi.ataque.dano}) e defende a Torre. Máximo agora: nível {reino.neuro.maximo} (sobe com a Torre do Neuro).</p>
          <Botao ok={reino.neuro.ok} motivo={reino.neuro.motivo} ocupado={ocupado === "neuro"}
            aoClicar={() => agir("neuro", { acao: "neuro" }, (r) => comemorar(`Neuro nível ${r.nivel}! ${r.estagio} 🧠`))}>
            Treinar Neuro · <Moedas n={reino.neuro.custo} />
          </Botao>
        </section>
        <section className="pf-cartao">
          <div className="pf-estat__rotulo">⛏️ Mina de Moedas</div>
          <div className="pf-estat__valor"><Moedas n={reino.mina.paraColetar} /> <small>de {reino.mina.capacidade}</small></div>
          <p className="pf-estat__nota">Produz {reino.mina.porHora} moeda(s) por hora e para quando enche ({HORAS_ATE_ENCHER} h). Colete sempre que passar por aqui.</p>
          <Botao ok={reino.mina.paraColetar > 0} motivo="nada para coletar ainda" ocupado={ocupado === "coletar"}
            aoClicar={() => agir("coletar", { acao: "coletar" }, (r) => reagir("feliz", `+${r.coletou} moedas da mina!`))}>
            Coletar
          </Botao>
        </section>
      </div>

      {/* ------------------------------------------------------------ tropas */}
      <Reserva destino="exercito" dados={reino.exercito} heroi={reino.heroi.ataque} ocupado={ocupado} aoTreinar={treinar} />
      <Reserva destino="guarnicao" dados={reino.guarnicao} heroi={reino.heroi.defesa} ocupado={ocupado} aoTreinar={treinar} />

      {/* ------------------------------------------------------------ construções */}
      <section className="pf-secao">
        <h2 className="pf-secao__titulo">Construções <small>nenhuma passa do nível da Torre do Neuro</small></h2>
        <div className="rn-construcoes">
          {reino.construcoes.map((c) => (
            <article key={c.chave} id={`construcao-${c.chave}`} tabIndex={-1} className="pf-cartao rn-construcao">
              <div className="rn-construcao__topo">
                <span className="rn-construcao__emoji" aria-hidden="true">{c.emoji}</span>
                <div>
                  <h3>{c.nome}</h3>
                  <Niveis nivel={c.nivel} max={c.max} />
                </div>
              </div>
              <p className="pf-estat__nota">{c.nivel > 0 ? c.efeitoAtual : "Ainda não construída."}</p>
              {c.efeitoProximo && <p className="pf-estat__nota rn-construcao__proximo">Próximo nível: {c.efeitoProximo}</p>}
              {c.nivel < c.max ? (
                <Botao ok={c.pode} motivo={c.motivo} ocupado={ocupado === c.chave}
                  aoClicar={() => agir(c.chave, { acao: "melhorar", chave: c.chave }, (r) => reagir("comemorando", `${c.nome} nível ${r.nivel}! 🎉`))}>
                  {c.chave === "terreno" ? (c.nivel === 0 ? "Comprar terra" : "Expandir de novo") : c.nivel === 0 ? "Construir" : "Melhorar"} · <Moedas n={c.custo} />
                </Botao>
              ) : <span className="pf-pilula pf-pilula--verde">Nível máximo</span>}
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ invasões */}
      <section className="pf-secao" id="invadir">
        <h2 className="pf-secao__titulo">Invadir outros reinos <small>{restantes > 0 ? `${restantes} de ${reino.invasoes.porDia} invasões hoje` : "as invasões de hoje acabaram"}</small></h2>
        {resultado && <ResultadoDaBatalha r={resultado} aoFechar={() => setResultado(null)} />}
        {alvos && alvos.alvos.length > 0 && disponiveis === 0 && (
          <div className="pf-aviso" style={{ marginBottom: 12 }}>
            Todos os reinos estão protegidos por escudo agora{escudoMaisCurto ? ` — o primeiro escudo acaba ${hora(escudoMaisCurto)}` : ""}.
            Reino novo nasce com {ESCUDO_DE_NOVATO_HORAS} h de escudo e quem cai ganha {ESCUDO_APOS_DERROTA_HORAS} h.
          </div>
        )}
        {!alvos ? (
          <div className="pf-cartao"><p className="pf-estat__nota" style={{ marginTop: 0 }}>Procurando reinos…</p></div>
        ) : alvos.alvos.length === 0 ? (
          <div className="pf-cartao"><p className="pf-estat__nota" style={{ marginTop: 0 }}>Ainda não há outros reinos. Um reino aparece aqui quando a pessoa abre a tela Reino pela primeira vez — chame quem estuda com você!</p></div>
        ) : (
          <div className="pf-cartao rk-tabela-caixa">
            <table className="rx-tabela rn-alvos">
              <thead>
                <tr><th scope="col">Reino</th><th scope="col" className="rn-col-info">Torre · Neuro</th><th scope="col">Defesa</th><th scope="col"><span className="sr-only">Ação</span></th></tr>
              </thead>
              <tbody>
                {alvos.alvos.map((a) => (
                  <tr key={a.id}>
                    <th scope="row">{a.reino}<span className="rk-sub">{a.dono} · 🏆 {numero(a.trofeus)}</span></th>
                    <td className="rn-col-info">{a.torre} · {a.neuro}</td>
                    <td><span className={`pf-pilula rn-faixa rn-faixa--${a.defesa.replace("í", "i").replace("é", "e")}`}>{a.defesa}</span></td>
                    <td className="rn-col-acao">
                      {a.pode ? (
                        <button type="button" className="pf-botao pf-botao--pequeno" disabled={Boolean(ocupado)} onClick={() => invadirReino(a)}>
                          {ocupado === `invadir:${a.id}` ? "Atacando…" : "⚔️ Invadir"}
                        </button>
                      ) : <span className="rn-motivo">{a.escudoAte ? `🛡️ escudo até ${hora(a.escudoAte)}` : a.motivo}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ batalhas */}
      <section className="pf-secao">
        <h2 className="pf-secao__titulo">Batalhas recentes</h2>
        <div className="pf-cartao">
          {reino.batalhas.length === 0 ? <p className="pf-estat__nota" style={{ marginTop: 0 }}>Nenhuma batalha ainda.</p> : (
            <ul className="rn-batalhas">
              {reino.batalhas.map((b) => (
                <li key={b.id} className={b.ganhei ? "rn-batalha--ganhei" : "rn-batalha--perdi"}>
                  <span className="rn-batalha__icone" aria-hidden="true">{b.ganhei ? "🏆" : "💥"}</span>
                  <span className="rn-batalha__texto">
                    <strong>{b.ataquei ? `Você invadiu ${b.outro}` : `${b.outro} invadiu você`}</strong>
                    {" — "}{b.ganhei ? (b.ataquei ? "vitória" : "defesa vencida") : (b.ataquei ? "derrota" : "o reino caiu")}
                    <small>{b.estrelas != null ? `${estrelas(b.estrelas)} · ${b.destruicao}% destruído` : `⚔️ ${b.ataque} contra 🛡️ ${b.defesa}`} · {hora(b.quando)}</small>
                  </span>
                  {b.combate && <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno rn-batalha__ver" onClick={() => assistir(b)}>▶ Assistir</button>}
                  <span className="rn-batalha__saldo">
                    {b.moedas ? <>{b.moedas > 0 ? "+" : "−"}🪙{numero(Math.abs(b.moedas))} </> : null}
                    {b.trofeus ? `${b.trofeus > 0 ? "+" : "−"}🏆${Math.abs(b.trofeus)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <Regras />
      {Aviso}
    </>
  );
}

/** Leva até o cartão da construção escolhida no mundo e dá uma piscada nele. */
function irParaConstrucao(chave) {
  const el = document.getElementById(`construcao-${chave}`);
  if (!el) return;
  const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "center" });
  el.classList.remove("rn-construcao--destaque");
  void el.offsetWidth;
  el.classList.add("rn-construcao--destaque");
  (el.querySelector("button:not(:disabled)") || el).focus({ preventScroll: true });
}

/** O mundo 3D; se o aparelho não tiver WebGL, a vista plana de antes. */
function VistaDoReino({ reino }) {
  const [plana, setPlana] = useState(false);
  const humor = reino.escudoAte ? "normal" : "feliz";
  if (plana) return <VistaPlana reino={reino} humor={humor} />;
  return (
    <section aria-label="Vista do reino">
      <Mundo3D construcoes={reino.construcoes} humor={humor} aoEscolher={irParaConstrucao} aoFalhar={() => setPlana(true)} />
    </section>
  );
}

function VistaPlana({ reino, humor }) {
  return (
    <section className="rn-vista" aria-label="Vista do reino">
      <div className="rn-vista__chao">
        {reino.construcoes.filter((c) => c.chave !== "castelo").slice(0, 2).map((c) => <Predio key={c.chave} c={c} />)}
        <div className="rn-vista__centro">
          <Predio c={reino.construcoes.find((c) => c.chave === "castelo")} grande />
          <div className="rn-vista__neuro"><Neuro tamanho={84} ouvir humor={humor} /></div>
        </div>
        {reino.construcoes.filter((c) => c.chave !== "castelo").slice(2).map((c) => <Predio key={c.chave} c={c} />)}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ batalha na ilha
const virgula = (x) => String(x).replace(".", ",");
const estrelas = (n) => (n ? "⭐".repeat(n) : "☆");
const NOMES_DOS_PREDIOS = Object.fromEntries(Object.entries(CONSTRUCOES).map(([k, v]) => [k, v.nome]));

/** "12 🗡️ Guerreiros, 3 🪨 Gigantes" */
function descreverTropas(tropas) {
  const partes = ORDEM_DAS_TROPAS.filter((t) => tropas?.[t]).map((t) => `${tropas[t]} ${TROPAS[t].emoji} ${TROPAS[t].nome}${tropas[t] > 1 ? "s" : ""}`);
  return partes.length ? partes.join(", ") : "nenhuma";
}

/**
 * Manda a ilha 3D mostrar a batalha (o mesmo motor do servidor, passo a passo). Sem 3D, o
 * resultado aparece direto. `aoTerminar` roda quando a luta acaba (ou logo, sem 3D).
 */
function assistirNaIlha({ entrada, papel, resultado, titulo, aoTerminar }) {
  const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelector(".rn-mundo")?.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "center" });
  const detail = { entrada, papel, resultado, titulo, aoTerminar };
  window.dispatchEvent(new CustomEvent("reino-combate", { detail }));
  if (!detail.aceito) aoTerminar?.();
  return Boolean(detail.aceito);
}

/** Exército (Quartel) ou tropas de defesa (Torre do Neuro): o que tem e o que dá para treinar. */
function Reserva({ destino, dados, heroi, ocupado, aoTreinar }) {
  const exercito = destino === "exercito";
  return (
    <section className="pf-secao" id={exercito ? "exercito" : "guarnicao"}>
      <h2 className="pf-secao__titulo">
        {exercito ? "⚔️ Exército" : "🛡️ Tropas de defesa"}
        <small>{exercito ? "treinado no Quartel · vai inteiro em cada invasão e é gasto nela" : "moram na Torre do Neuro · saem quando o inimigo chega perto"}</small>
      </h2>
      <div className="pf-cartao rn-reserva">
        <div className="rn-reserva__topo">
          <div>
            <div className="pf-estat__rotulo">{dados.usado} de {dados.capacidade} de espaço</div>
            <Barra valor={dados.usado} total={Math.max(1, dados.capacidade)} rotulo={exercito ? "Espaço do exército" : "Espaço das tropas de defesa"} />
          </div>
          <p className="pf-estat__nota">{dados.capacidade === 0 ? "Construa o Quartel para treinar o exército." : `Agora: ${descreverTropas(dados.tropas)}.`}</p>
        </div>
        <div className="rn-tropas">
          <article className="rn-tropa rn-tropa--heroi">
            <span className="rn-tropa__emoji" aria-hidden="true">🧠</span>
            <div className="rn-tropa__texto">
              <strong>Neuro <small>herói · sempre junto</small></strong>
              <span className="rn-tropa__dados">❤️ {heroi.vida} · 💥 {heroi.dano} a cada {virgula(heroi.intervalo)} s · 📏 {virgula(heroi.alcance)}{heroi.acertaAr ? " · acerta quem voa" : ""}</span>
              <span className="rn-tropa__desc">{exercito ? "Luta corpo a corpo em toda invasão. Fica mais forte a cada nível — sem treino." : "Defende a Torre atirando livros de longe."}</span>
            </div>
          </article>
          {dados.catalogo.map((t) => (
            <article key={t.chave} className={`rn-tropa${t.liberada ? "" : " rn-tropa--bloqueada"}`}>
              <span className="rn-tropa__emoji" aria-hidden="true">{t.emoji}</span>
              <div className="rn-tropa__texto">
                <strong>{t.nome} {t.tem > 0 && <span className="pf-pilula pf-pilula--verde">×{t.tem}</span>}</strong>
                <span className="rn-tropa__dados">❤️ {t.vida} · 💥 {t.dano} a cada {virgula(t.intervalo)} s · 📏 {virgula(t.alcance)} · {t.voa ? "🪽 voa" : "🦶 chão"} · espaço {t.espaco}</span>
                <span className="rn-tropa__desc">{t.descricao}</span>
              </div>
              <div className="rn-tropa__acoes">
                {t.liberada ? (
                  <>
                    <button type="button" className="pf-botao pf-botao--pequeno" disabled={!t.podeUm || Boolean(ocupado)} onClick={() => aoTreinar(destino, t, 1)}>
                      +1 · <Moedas n={t.custo} />
                    </button>
                    <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={!t.podeCinco || Boolean(ocupado)} onClick={() => aoTreinar(destino, t, 5)}>
                      +5 · <Moedas n={t.custo * 5} />
                    </button>
                    {!t.podeUm && <span className="rn-motivo">{t.motivo}</span>}
                  </>
                ) : <span className="rn-motivo">🔒 {exercito ? "Quartel" : "Torre do Neuro"} no nível {t.nivelMinimo}</span>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ modo simulação
/**
 * Treino de batalha: o mesmo motor da invasão de verdade, contra um rival de mentira tirado do
 * próprio reino. A ilha mostra a luta; o passo a passo explica. Não grava nada.
 */
function Simulador({ reino, aoFechar }) {
  const [tipo, setTipo] = useState("atacar");
  const [forca, setForca] = useState("parelho");
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const caixaDoResultado = useRef(null);

  const eu = useMemo(() => ({
    construcoes: Object.fromEntries(reino.construcoes.map((c) => [c.chave, c.nivel])),
    neuro_nivel: reino.neuro.nivel, exercito: reino.exercito.tropas, guarnicao: reino.guarnicao.tropas,
  }), [reino]);
  const rivais = useMemo(() => Object.fromEntries(Object.keys(RIVAIS_SIMULADOS).map((k) => [k, rivalSimulado(eu, k)])), [eu]);
  const rival = rivais[forca];
  const exercitoVazio = totalDeTropas(eu.exercito) === 0;
  const atacanteDaVez = tipo === "atacar"
    ? { exercito: exercitoVazio ? exercitoDeTreino(eu.construcoes.quartel) : eu.exercito, neuro_nivel: eu.neuro_nivel }
    : { exercito: rival.exercito, neuro_nivel: rival.neuro_nivel };
  const previsao = useMemo(
    () => previsaoDeEstrelas(combateDe({ atacante: atacanteDaVez, defensor: tipo === "atacar" ? rival : eu, semente: 1 }), 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eu, rival, tipo],
  );

  useEffect(() => {
    if (resultado) caixaDoResultado.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [resultado]);

  function simular() {
    const semente = (Math.floor(Math.random() * 4294967295) >>> 0) || 1;
    const r = simularBatalha({ tipo, eu, rival, meuSaldo: reino.saldo, saldoDoRival: 500, semente });
    setResultado(null);
    setRodando(true);
    assistirNaIlha({
      entrada: r.entrada, papel: tipo === "atacar" ? "atacante" : "defensor", resultado: r,
      titulo: tipo === "atacar" ? "🎮 TREINO · INVASÃO EM ANDAMENTO" : "🎮 TREINO · SEU REINO ESTÁ SENDO ATACADO!",
      aoTerminar: () => { setRodando(false); setResultado(r); },
    });
  }

  const fraseDaPrevisao = previsao >= 2.5 ? "vitória esmagadora" : previsao >= 1.5 ? "boa chance" : previsao >= 0.8 ? "batalha apertada" : "muito difícil";
  return (
    <section id="simulador" className="pf-cartao rn-simulador" aria-label="Simulação de batalha">
      <div className="rn-simulador__principal">
        <div className="rn-simulador__topo">
          <h2>🎮 Simulação de batalha</h2>
          <span className="pf-pilula">treino · nada muda de verdade</span>
        </div>

        <div className="agenda__modos" role="tablist" aria-label="O que simular">
          <button type="button" role="tab" aria-selected={tipo === "atacar"} className="agenda__modo" onClick={() => { setTipo("atacar"); setResultado(null); }}>⚔️ Eu ataco</button>
          <button type="button" role="tab" aria-selected={tipo === "defender"} className="agenda__modo" onClick={() => { setTipo("defender"); setResultado(null); }}>🛡️ Meu reino é atacado</button>
        </div>

        <div className="rn-simulador__rivais" role="group" aria-label="Contra quem">
          {Object.entries(RIVAIS_SIMULADOS).map(([k, r]) => {
            const pr = poderDo(rivais[k]);
            return (
              <button key={k} type="button" className="pf-dia rn-simulador__rival" aria-pressed={forca === k} onClick={() => { setForca(k); setResultado(null); }}>
                <strong>{r.nome}</strong>
                <small>⚔️ {pr.ataque}/s · 🛡️ {pr.defesa}</small>
              </button>
            );
          })}
        </div>

        <div className="rn-simulador__chance">
          <p className="pf-estat__nota" style={{ marginTop: 0 }}>
            {tipo === "atacar"
              ? <>Vão as suas tropas: <strong>{descreverTropas(atacanteDaVez.exercito)}</strong> + o Neuro.{exercitoVazio && " (Seu exército está vazio: no treino vai um exército de exemplo.)"}</>
              : <>Vem o rival com <strong>{descreverTropas(rival.exercito)}</strong> + o Neuro dele, contra as suas defesas e {totalDeTropas(eu.guarnicao) ? descreverTropas(eu.guarnicao) : "nenhuma tropa de defesa"}.</>}
          </p>
          <div className="pf-estat__rotulo">
            Previsão em 8 batalhas: <strong>{virgula(previsao)} ⭐ {tipo === "atacar" ? "para você" : "para o rival"}</strong> · {tipo === "atacar" ? fraseDaPrevisao : previsao < 0.8 ? "seu reino aguenta bem" : previsao < 1.5 ? "defesa apertada" : "seu reino sofre"}
          </div>
          <Barra valor={Math.round(previsao * 10)} total={30} rotulo="Estrelas previstas" />
        </div>

        <button type="button" className="pf-botao" onClick={simular} disabled={rodando}>
          {rodando ? "Batalha em andamento…" : "▶ Simular batalha"}
        </button>

        {resultado && (
          <div ref={caixaDoResultado} className={`rn-resultado rn-simulacao ${resultado.euVenci ? "rn-resultado--venceu" : "rn-resultado--perdeu"}`} role="status">
            <div className="rn-resultado__titulo">
              {resultado.tipo === "atacar"
                ? (resultado.euVenci ? `${estrelas(resultado.estrelas)} A invasão deu certo!` : "💥 A invasão falhou")
                : (resultado.euVenci ? "🛡️ O reino resistiu!" : `💥 O reino caiu · ${estrelas(resultado.estrelas)}`)}
              <small> · simulação</small>
            </div>
            <PassoAPasso r={resultado} />
            <div className="rn-simulacao__acoes">
              <button type="button" className="pf-botao pf-botao--pequeno" onClick={simular} disabled={rodando}>Simular de novo</button>
              <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={aoFechar}>Fechar</button>
            </div>
          </div>
        )}
      </div>

      <RegrasDaBatalha />
    </section>
  );
}

function PassoAPasso({ r }) {
  const ataque = r.tipo === "atacar";
  const perdas = descreverTropas(r.perdasDaGuarnicao);
  return (
    <ol className="rn-passos">
      <li>
        <strong>Quem lutou.</strong> {ataque ? "Você atacou" : "O rival atacou"} com {descreverTropas(r.exercitoUsado)} + o Neuro.
        {" "}A batalha durou {virgula(r.duracao)} s.
      </li>
      <li>
        <strong>Destruição: {r.destruicao}%.</strong> {r.destruidos.length ? `Caíram: ${r.destruidos.map((c) => NOMES_DOS_PREDIOS[c]).join(", ")}.` : "Nenhuma construção caiu."}
        {r.muralhaCaiu ? " A Muralha também caiu." : ""}
      </li>
      <li>
        <strong>Estrelas: {estrelas(r.estrelas)}</strong> — {r.destruicao >= 50 ? "⭐ por passar de 50%" : "faltou chegar a 50%"}; {r.casteloCaiu ? "⭐ pela Torre do Neuro" : "a Torre do Neuro ficou de pé"}; {r.destruicao === 100 ? "⭐ por 100%" : "não chegou a 100%"}.
      </li>
      <li>
        <strong>Moedas.</strong> O defensor tinha 🪙 {numero(r.saldoDoDefensor)}{ataque ? " (imaginando um rival com 500)" : " (o seu saldo de agora)"}; o cofre guarda {numero(r.protegido)}, então {numero(r.exposto)} estavam expostas.
        {" "}{r.venceu ? <>Saque: {Math.round(FATIA_DO_SAQUE * 100)}% × {r.destruicao}% de destruição, no máximo {TETO_DO_SAQUE} = <b>🪙 {numero(r.saque)}</b> {ataque ? "para você" : "saem do seu reino"}.</> : "Sem nenhuma estrela, ninguém perde moeda."}
      </li>
      <li>
        <strong>Troféus.</strong> Você {r.meusTrofeus >= 0 ? "ganharia" : "perderia"} <b>{Math.abs(r.meusTrofeus)} 🏆</b>.
      </li>
      <li>
        <strong>Tropas.</strong> {ataque
          ? "Numa invasão de verdade, o exército inteiro é gasto — treine de novo no Quartel."
          : `As suas tropas de defesa que caíram (${perdas}) teriam de ser treinadas de novo.`}
        {r.escudoDoDefensorHoras ? ` ${ataque ? "O reino invadido" : "O seu reino"} ganharia ${ESCUDO_APOS_DERROTA_HORAS} h de escudo.` : ""}
      </li>
    </ol>
  );
}

function RegrasDaBatalha() {
  const t = CONSTRUCOES;
  return (
    <aside className="rn-simulador__regras" aria-label="Regras da batalha">
      <h3>📜 Regras da batalha</h3>
      <dl>
        <dt>⚔️ Como é a luta</dt>
        <dd>As tropas desembarcam na beirada da ilha e cada uma vai sozinha atrás do alvo mais perto — o Gigante só atrás de defesas. Cada defesa mira a tropa mais perto que alcança. Tudo tem vida: quem chega a zero cai.</dd>
        <dt>🏹 Torre de Arqueiros</dt>
        <dd>{t.torre.efeito(1)} (nível 1).</dd>
        <dt>💣 Canhão</dt>
        <dd>{t.canhao.efeito(1)} (nível 1). Dragão passa por cima.</dd>
        <dt>🧱 Muralha</dt>
        <dd>Cerca a Torre do Neuro: quem bate de perto, por terra, precisa derrubá-la antes. Arqueiras atiram por cima; Dragão voa por cima.</dd>
        <dt>🛡️ Tropas de defesa</dt>
        <dd>Moram na Torre do Neuro e saem quando um inimigo chega perto, junto com o Neuro do reino. As que caem precisam ser treinadas de novo.</dd>
        <dt>⭐ Estrelas</dt>
        <dd>Uma por destruir 50% das construções, uma por derrubar a Torre do Neuro e uma por 100%. A Muralha não conta na porcentagem.</dd>
        <dt>🪙 Saque</dt>
        <dd>{Math.round(FATIA_DO_SAQUE * 100)}% das moedas fora do cofre, vezes a destruição, até {TETO_DO_SAQUE}. O Cofre guarda {protecaoDoCofre(1)} moedas por nível.</dd>
        <dt>🏆 Troféus</dt>
        <dd>Quem ataca: +6, +10 ou +14 por 1, 2 ou 3 estrelas (−3 sem estrela). Quem defende: −3, −5 ou −7 (+5 se segurar tudo).</dd>
        <dt>🛡️ Escudo e limites</dt>
        <dd>Reino que cai ganha {ESCUDO_APOS_DERROTA_HORAS} h de escudo; reino novo nasce com {ESCUDO_DE_NOVATO_HORAS} h; atacar tira o seu escudo. {ATAQUES_POR_DIA} invasões por dia, uma por reino. O exército é gasto em cada invasão.</dd>
        <dt>📚 Pontos</dt>
        <dd>Moeda vem do estudo (1 ponto = 1 moeda). Perder moeda numa invasão nunca tira pontos do ranking.</dd>
      </dl>
    </aside>
  );
}

function Numero({ rotulo, valor, nota }) {
  return (
    <div className="pf-cartao rn-numero">
      <div className="pf-estat__rotulo">{rotulo}</div>
      <div className="pf-estat__valor">{valor}</div>
      <p className="pf-estat__nota">{nota}</p>
    </div>
  );
}

/** Botão que, quando não pode, diz o porquê em vez de só ficar cinza. */
function Botao({ ok, motivo, ocupado, aoClicar, children }) {
  return (
    <div className="rn-botao">
      <button type="button" className="pf-botao pf-botao--pequeno" disabled={!ok || ocupado} onClick={aoClicar}>
        {ocupado ? "Um instante…" : children}
      </button>
      {!ok && motivo && <span className="rn-motivo">{motivo}</span>}
    </div>
  );
}

function Niveis({ nivel, max }) {
  return (
    <span className="rn-niveis" role="img" aria-label={`nível ${nivel} de ${max}`}>
      {Array.from({ length: max }, (_, i) => <span key={i} className={i < nivel ? "rn-niveis__cheio" : ""} />)}
    </span>
  );
}

function Predio({ c, grande = false }) {
  if (!c) return null;
  const vazio = c.nivel === 0;
  return (
    <div className={`rn-predio${grande ? " rn-predio--grande" : ""}${vazio ? " rn-predio--vazio" : ""}`} style={{ "--nivel": c.nivel }} title={`${c.nome} · nível ${c.nivel}`}>
      <span className="rn-predio__emoji" aria-hidden="true">{vazio ? "🚧" : c.emoji}</span>
      <span className="rn-predio__nivel">{vazio ? "—" : `nv ${c.nivel}`}</span>
      <span className="sr-only">{c.nome}, nível {c.nivel}</span>
    </div>
  );
}

function ResultadoDaBatalha({ r, aoFechar }) {
  return (
    <div className={`pf-cartao rn-resultado ${r.venceu ? "rn-resultado--venceu" : "rn-resultado--perdeu"}`} role="status">
      <div className="rn-resultado__titulo">{r.venceu ? `${estrelas(r.estrelas)} Vitória!` : "💥 A invasão falhou"} — {r.alvo.reino} <small>({r.alvo.dono})</small></div>
      <p>
        {r.destruicao}% destruído{r.destruidos?.length ? ` (${r.destruidos.map((c) => NOMES_DOS_PREDIOS[c]).join(", ")})` : ""}.{" "}
        {r.venceu
          ? (r.saque ? `Você saqueou 🪙 ${numero(r.saque)} moedas e ganhou ${r.trofeus} troféus.` : `Ganhou ${r.trofeus} troféus — mas o cofre deles guardava tudo.`)
          : `Você perdeu ${Math.abs(r.trofeus)} troféus. Treine um exército maior (Gigantes seguram as defesas) e tente de novo.`}
        {" "}O exército foi gasto na batalha.
      </p>
      <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={aoFechar}>Ok</button>
    </div>
  );
}

function NomeDoReino({ atual, ocupado, aoSalvar }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(atual);
  if (!editando) {
    return <button type="button" className="rn-renomear" onClick={() => { setNome(atual); setEditando(true); }}>✏️ renomear</button>;
  }
  return (
    <form className="rn-renomear__form" onSubmit={(e) => { e.preventDefault(); aoSalvar(nome); setEditando(false); }}>
      <input className="pf-campo__entrada" value={nome} maxLength={30} onChange={(e) => setNome(e.target.value)} aria-label="Nome do reino" autoFocus />
      <button type="submit" className="pf-botao pf-botao--pequeno" disabled={ocupado || nome.trim().length < 3}>Salvar</button>
      <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setEditando(false)}>Cancelar</button>
    </form>
  );
}

function Regras() {
  return (
    <section className="pf-secao">
      <h2 className="pf-secao__titulo">Como funciona</h2>
      <div className="pf-cartao rn-regras">
        <details open>
          <summary>🪙 Moedas</summary>
          <p>Cada ponto de estudo vale uma moeda: quiz, exercício, projetos, tarefas, metas e conquistas. A mina, os saques e os vales somam; construir, treinar tropas e treinar o Neuro gastam. <strong>Os pontos do ranking nunca diminuem</strong> — gastar moedas no reino não tira você do placar.</p>
        </details>
        <details>
          <summary>🏰 Construções e Neuro</summary>
          <p>A Torre do Neuro é o coração do reino: nenhuma construção passa do nível dela, o Neuro chega no máximo ao dobro e nela moram as tropas de defesa. A Mina produz moedas sozinha até encher ({HORAS_ATE_ENCHER} h); o Cofre guarda moedas que nenhuma invasão leva; Torre de Arqueiros, Canhão e Muralha defendem; o Quartel treina o exército.</p>
        </details>
        <details>
          <summary>⚔️ Invasões</summary>
          <p>{ATAQUES_POR_DIA} invasões por dia, uma por reino, com o exército inteiro (que é gasto). A batalha é de verdade: cada tropa e cada defesa luta sozinha, e você assiste na ilha. Estrelas: 50% destruído, a Torre do Neuro no chão e 100%. O saque é {Math.round(FATIA_DO_SAQUE * 100)}% das moedas fora do cofre vezes a destruição (até {TETO_DO_SAQUE}); os troféus seguem as estrelas. Toda batalha fica na lista para assistir de novo.</p>
        </details>
        <details>
          <summary>🛡️ Escudos</summary>
          <p>Reino novo nasce com {ESCUDO_DE_NOVATO_HORAS} h de escudo. Reino que cai ganha {ESCUDO_APOS_DERROTA_HORAS} h de escudo, para ninguém ser invadido sem parar. Atenção: <strong>atacar tira o seu escudo</strong>.</p>
        </details>
      </div>
    </section>
  );
}
