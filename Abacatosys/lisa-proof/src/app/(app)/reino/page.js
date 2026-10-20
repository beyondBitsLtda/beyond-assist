"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { obter, criar } from "@/lib/api.js";
import { useAviso } from "@/componentes/Pecas.js";
import Neuro, { reagir, comemorar } from "@/componentes/Neuro.js";
import {
  ATAQUES_POR_DIA, FATIA_DO_SAQUE, TETO_DO_SAQUE, SORTE, ESCUDO_APOS_DERROTA_HORAS, ESCUDO_DE_NOVATO_HORAS,
  HORAS_ATE_ENCHER, TROFEUS,
} from "@/dominio/reino.js";

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
  const [Aviso, avisar] = useAviso();

  useEffect(() => {
    obter("/api/reino").then(setReino).catch((e) => setErro(e.message));
    obter("/api/reino/alvos").then(setAlvos).catch(() => {});
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
      setReino(r.reino);
      setResultado(r.resultado);
      if (r.resultado.venceu) comemorar(r.resultado.saque ? `Vitória! +${r.resultado.saque} moedas` : "Vitória!");
      else reagir("triste", "Eles se defenderam bem… da próxima vamos mais fortes!");
      carregarAlvos();
    } catch (e) {
      avisar(e.message);
    } finally {
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
        <Link href="/ranking" className="pf-botao pf-botao--sec rn-acoes__ranking">🏆 Ranking</Link>
      </div>

      <div className="rn-numeros">
        <Numero rotulo="Moedas" valor={<Moedas n={reino.saldo} />} nota={`${numero(reino.cofre.protege)} a salvo no cofre`} />
        <Numero rotulo="Troféus" valor={`🏆 ${numero(reino.trofeus)}`} nota={<Link href="/ranking">ver ranking dos reinos</Link>} />
        <Numero rotulo="Ataque · Defesa" valor={`⚔️ ${reino.poder.ataque} · 🛡️ ${reino.poder.defesa}`} nota="sobe com quartel, muralha, arqueiros e Neuro" />
        <Numero rotulo="Escudo" valor={reino.escudoAte ? "🛡️ Ativo" : "Sem escudo"} nota={reino.escudoAte ? `até ${hora(reino.escudoAte)} · atacar tira o escudo` : "o seu reino pode ser invadido"} />
      </div>

      {/* ------------------------------------------------------------ Neuro e mina */}
      <div className="pf-grade pf-grade--2 pf-secao">
        <section className="pf-cartao rn-neuro">
          <div className="pf-estat__rotulo">O seu Neuro</div>
          <div className="pf-estat__valor">Nível {reino.neuro.nivel} <small>· {reino.neuro.estagio}</small></div>
          <p className="pf-estat__nota">Cada nível dá +8 de ataque e +6 de defesa. Máximo agora: nível {reino.neuro.maximo} (sobe com a Torre do Neuro).</p>
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
                  {c.nivel === 0 ? "Construir" : "Melhorar"} · <Moedas n={c.custo} />
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
                    <small>⚔️ {b.ataque} contra 🛡️ {b.defesa} · {hora(b.quando)}</small>
                  </span>
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
      <div className="rn-resultado__titulo">{r.venceu ? "🏆 Vitória!" : "💥 Derrota"} — {r.alvo.reino} <small>({r.alvo.dono})</small></div>
      <p>
        Seu ataque: <strong>⚔️ {r.ataque}</strong> contra a defesa deles: <strong>🛡️ {r.defesa}</strong>.{" "}
        {r.venceu
          ? (r.saque ? `Você saqueou 🪙 ${numero(r.saque)} moedas e ganhou ${r.trofeus} troféus.` : `Ganhou ${r.trofeus} troféus — mas o cofre deles guardava tudo, nada para saquear.`)
          : `Você perdeu ${Math.abs(r.trofeus)} troféus. Fortaleça o Quartel e o Neuro e tente outro reino.`}
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
          <p>Cada ponto de estudo vale uma moeda: quiz, exercício, projetos, tarefas, metas e conquistas. A mina e os saques somam; construir e treinar o Neuro gastam. <strong>Os pontos do ranking nunca diminuem</strong> — gastar moedas no reino não tira você do placar.</p>
        </details>
        <details>
          <summary>🏰 Construções e Neuro</summary>
          <p>A Torre do Neuro é o coração do reino: nenhuma construção passa do nível dela, e o Neuro chega no máximo ao dobro. A Mina produz moedas sozinha até encher ({HORAS_ATE_ENCHER} h); o Cofre guarda moedas que nenhuma invasão leva; Muralha e Torre de Arqueiros defendem; o Quartel ataca; o Neuro ajuda nos dois.</p>
        </details>
        <details>
          <summary>⚔️ Invasões</summary>
          <p>{ATAQUES_POR_DIA} invasões por dia, uma por reino. Vence quem tiver mais força na hora — cada lado tem uma sorte de ±{Math.round(SORTE * 100)}% e empate é da defesa. Quem vence leva {Math.round(FATIA_DO_SAQUE * 100)}% das moedas que estão fora do cofre (até {TETO_DO_SAQUE}) e +{TROFEUS.vitoriaAtacante} troféus; quem ataca e perde, {TROFEUS.ataqueFalho}. Defender bem vale +{TROFEUS.defesaVencida}; cair, {TROFEUS.derrotaDefensor}.</p>
        </details>
        <details>
          <summary>🛡️ Escudos</summary>
          <p>Reino novo nasce com {ESCUDO_DE_NOVATO_HORAS} h de escudo. Reino que cai ganha {ESCUDO_APOS_DERROTA_HORAS} h de escudo, para ninguém ser invadido sem parar. Atenção: <strong>atacar tira o seu escudo</strong>.</p>
        </details>
      </div>
    </section>
  );
}
