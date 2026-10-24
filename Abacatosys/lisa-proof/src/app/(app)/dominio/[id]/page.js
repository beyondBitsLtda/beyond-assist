"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { obter, criar, remover } from "@/lib/api.js";
import { Barra, useAviso } from "@/componentes/Pecas.js";
import Neuro, { celebrar, comemorar, reagir } from "@/componentes/Neuro.js";
import { urlDoMonstro } from "@/componentes/reino/monstrosDePapel.js";
import { TROPAS } from "@/dominio/tropas.js";
import {
  ATRIBUTOS, NIVEIS, NOTA_PARA_VENCER, chefaoPorId, chefoesDaTorre, sementeDe, premiosDaTorre, pontosDoAndar,
  pontosDoTopo, dificuldadeEsperada,
} from "@/dominio/modoDominio.js";
import { baixarCertificado, desenharCertificado } from "@/componentes/dominio/certificado.js";

const TorreDoDominio = dynamic(() => import("@/componentes/dominio/TorreDoDominio.js"), {
  ssr: false,
  loading: () => <div className="dm-torre dm-torre--carregando">Montando a torre…</div>,
});

const PAUSA_DO_GOLPE = 1000;
const estrelas = (d) => "★".repeat(d) + "☆".repeat(5 - d);
const tropasEmTexto = (pacote) => Object.entries(pacote || {}).map(([t, q]) => `${q}× ${TROPAS[t]?.nome || t}`).join(", ");

/** O que um prêmio promete (antes de ganhar). */
function textoDoPremio(p) {
  switch (p.tipo) {
    case "pontos": return `🪙 +${p.pontos} pontos`;
    case "tropas": return `⚔️ ${tropasEmTexto(p.tropas)} no exército`;
    case "defesas": return `🛡️ ${tropasEmTexto(p.tropas)} na defesa`;
    case "veiculo": return "🚀 o próximo veículo da garagem";
    case "avatar": return `👑 ${chefaoPorId(p.personagem?.replace(/^chefao-/, ""))?.nome || "o chefão"} como avatar`;
    case "certificado": return "📜 certificado em PDF";
    default: return "";
  }
}

/** O que um prêmio entregou de fato (o que não coube virou moedas). */
function textoDoRecebido(p) {
  switch (p.tipo) {
    case "pontos": return `🪙 +${p.pontos} pontos do marco`;
    case "topo": return `🏔️ +${p.pontos} pontos do topo`;
    case "tropas":
    case "defesas": {
      const foi = tropasEmTexto(p.tropas);
      const onde = p.tipo === "tropas" ? "no exército" : "na defesa";
      return [foi && `${p.tipo === "tropas" ? "⚔️" : "🛡️"} ${foi} ${onde}`, p.moedas ? `🪙 ${p.moedas} moedas (o que não coube no Reino)` : ""].filter(Boolean).join(" · ");
    }
    case "veiculo": return p.veiculo ? `🚀 ${p.nome} na garagem` : p.moedas ? `🪙 ${p.moedas} moedas (você já tem todos os veículos)` : textoDoPremio(p);
    case "avatar": return p.nome ? `👑 ${p.nome} é seu avatar — vista no Reino` : p.moedas ? `🪙 ${p.moedas} moedas (o avatar já era seu)` : textoDoPremio(p);
    case "pendente": return "⏳ o Reino não aceitou o prêmio agora — fale com o suporte";
    case "certificado": return "📜 certificado liberado";
    default: return "";
  }
}

export default function PaginaDaTorre() {
  const { id } = useParams();
  const router = useRouter();
  const [torre, setTorre] = useState(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [luta, setLuta] = useState(null); // { resultado, passo }
  const [naSala, setNaSala] = useState(false); // o Neuro (e a câmera) dentro da sala do chefão
  const [vendo, setVendo] = useState(null);
  const [semTela, setSemTela] = useState(false);
  const [Aviso, avisar] = useAviso();
  const [telaCheia, setTelaCheia] = useState(false);
  const [painel, setPainel] = useState(null);
  const telaCheiaRef = useRef(false);
  telaCheiaRef.current = telaCheia;
  const pediuTelaCheiaDeVerdade = useRef(false);

  // ---- tela cheia: a torre ocupa tudo; o navegador vai para a tela cheia de verdade quando deixa
  useEffect(() => {
    document.documentElement.classList.toggle("rn-sem-rolagem", telaCheia);
    return () => document.documentElement.classList.remove("rn-sem-rolagem");
  }, [telaCheia]);
  useEffect(() => {
    const aoMudar = () => {
      if (!document.fullscreenElement && pediuTelaCheiaDeVerdade.current && telaCheiaRef.current) {
        pediuTelaCheiaDeVerdade.current = false;
        setTelaCheia(false);
        setPainel(null);
      }
    };
    document.addEventListener("fullscreenchange", aoMudar);
    return () => document.removeEventListener("fullscreenchange", aoMudar);
  }, []);
  const entrarNaTelaCheia = useCallback(() => {
    setTelaCheia(true);
    setPainel(null);
    const raiz = document.documentElement;
    if (raiz.requestFullscreen && !document.fullscreenElement) {
      raiz.requestFullscreen().then(() => { pediuTelaCheiaDeVerdade.current = true; }).catch(() => {});
    }
  }, []);
  const sairDaTelaCheia = useCallback(() => {
    setTelaCheia(false);
    setPainel(null);
    if (document.fullscreenElement) { pediuTelaCheiaDeVerdade.current = false; document.exitFullscreen?.().catch(() => {}); }
  }, []);

  const carregar = useCallback(async () => {
    try {
      const r = await obter(`/api/dominio/${id}`);
      setTorre(r.torre);
      setErro("");
      return r.torre;
    } catch (e) {
      setErro(e.message);
      return null;
    }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  // montando (outra aba, ou a página recarregou no meio): confere de tempos em tempos
  useEffect(() => {
    if (torre?.status !== "montando") return undefined;
    const t = setInterval(carregar, 6000);
    return () => clearInterval(t);
  }, [torre?.status, carregar]);

  async function agir(rotulo, fn) {
    if (ocupado) return null;
    setOcupado(rotulo);
    setErro("");
    try {
      return await fn();
    } catch (e) {
      setErro(e.message);
      reagir("triste", e.message, 5000);
      return null;
    } finally {
      setOcupado("");
    }
  }

  // ---- a luta: um golpe a cada segundo; no fim, recarrega a torre (o Neuro sobe se venceu)
  const semMovimento = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  useEffect(() => {
    if (!luta) return undefined;
    const golpes = luta.resultado.entrega.golpes || [];
    if (luta.passo > golpes.length) return undefined;
    const t = setTimeout(() => setLuta((l) => (l ? { ...l, passo: l.passo + 1 } : l)), luta.passo === 0 ? 1500 : PAUSA_DO_GOLPE); // o primeiro espera o Neuro entrar na sala
    return () => clearTimeout(t);
  }, [luta]);
  const terminou = luta && luta.passo > (luta.resultado.entrega.golpes || []).length;
  const avisouFim = useRef(null);
  useEffect(() => {
    if (!terminou || avisouFim.current === luta.resultado.entrega.sha) return undefined;
    avisouFim.current = luta.resultado.entrega.sha;
    const r = luta.resultado;
    if (!celebrar(r)) {
      if (r.concluiu) comemorar("Torre conquistada! 🏆");
      else if (r.venceu) comemorar(`Chefão derrotado! +${r.pontos} pontos`);
      else reagir("triste", `Nota ${r.entrega.nota}. Melhore e tente de novo — ${NOTA_PARA_VENCER} vence!`, 6000);
    }
    // o chefão cai (ou o Neuro recua), o Neuro sai da sala e, vencendo, a torre recarrega e ele sobe a escada
    setTimeout(() => setNaSala(false), 1800);
    setTimeout(carregar, 2400);
    if (telaCheiaRef.current) setTimeout(() => setPainel("resultado"), 2900);
    return undefined;
  }, [terminou, luta, carregar]);
  useEffect(() => { if (!luta) setNaSala(false); }, [luta]);

  if (!torre) {
    return erro ? <div className="pf-aviso pf-aviso--erro">{erro} · <Link href="/dominio">voltar</Link></div> : <div className="pf-carregando">Subindo as escadas…</div>;
  }

  const montada = torre.status === "ativo" || torre.status === "concluido";
  const golpes = luta?.resultado.entrega.golpes || [];
  const golpe = !luta || luta.passo === 0 ? null
    : luta.passo <= golpes.length ? { k: luta.passo, ...golpes[luta.passo - 1] }
    : { k: "fim", fim: true, venceu: luta.resultado.venceu };
  const ultimo = luta && luta.passo > 0 ? golpes[Math.min(luta.passo, golpes.length) - 1] : null;

  async function entregar() {
    const r = await agir("entregar", () => criar(`/api/dominio/${id}/entregar`, {}));
    if (!r) return;
    if (telaCheiaRef.current) setPainel(null);
    else document.querySelector(".dm-torre")?.scrollIntoView({ behavior: semMovimento ? "auto" : "smooth", block: "center" });
    setNaSala(!semMovimento);
    setLuta({ resultado: r.resultado, passo: semMovimento ? 999 : 0 });
  }

  async function salvarBranch(repo, branch) {
    const r = await agir("branch", () => criar(`/api/dominio/${id}/entrega`, { repo, branch }));
    if (r) { setTorre(r.torre); avisar("Branch conferida! ✅"); }
  }

  async function abrirDesafio() {
    const r = await agir("desafio", () => criar(`/api/dominio/${id}/desafio`, {}));
    if (r) setTorre(r.torre);
  }

  async function desistir() {
    if (!window.confirm("Desistir desta torre? Os andares e as entregas somem (os pontos que você já ganhou ficam).")) return;
    const r = await agir("desistir", () => remover(`/api/dominio/${id}`));
    if (r) router.push("/dominio");
  }

  return (
    <div className="dm dm-pagina">
      {Aviso}
      <Link href="/dominio" className="dm-voltar">← Modo Domínio</Link>
      <div className="pf-cabecalho">
        <div>
          <h1 className="dm-titulo">🗼 {torre.repo}</h1>
          <p>
            <a href={torre.url} target="_blank" rel="noreferrer">{torre.provedor === "gitlab" ? "GitLab" : "GitHub"} ↗</a>
            {" · "}Nível {torre.nivel} — {torre.nomeDoNivel}
            {montada && ` · ${torre.vencidos} de ${torre.andares} andares`}
          </p>
        </div>
        {torre.status !== "concluido" && (
          <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={desistir} disabled={Boolean(ocupado)}>Desistir da torre</button>
        )}
      </div>
      {erro && <div className="pf-aviso pf-aviso--erro" role="alert">{erro}</div>}

      {!montada ? (
        <MontarTorre torre={torre} ocupado={ocupado} aoMontar={async (n) => {
          const r = await agir("montar", () => criar(`/api/dominio/${id}/montar`, { andares: n }));
          if (r) { setTorre(r.torre); comemorar("Torre montada! Bora escalar! 🧗"); }
          else carregar();
        }} />
      ) : (
        <>
          <div className="dm-palco">
            <div className={`dm-palco__mundo${telaCheia ? " dm-tela-cheia" : ""}`}>
              {semTela ? <TorrePlana torre={torre} /> : (
                <TorreDoDominio
                  andares={torre.andaresDaTorre}
                  atual={torre.andarAtual}
                  concluida={torre.status === "concluido"}
                  semente={sementeDe(torre.id)}
                  golpe={golpe}
                  lutando={naSala}
                  humor={luta ? (terminou ? (luta.resultado.venceu ? "comemorando" : "triste") : "surpreso") : "normal"}
                  telaCheia={telaCheia}
                  aoTelaCheia={telaCheia ? sairDaTelaCheia : entrarNaTelaCheia}
                  aoEscolher={(n) => setVendo(n)}
                  aoFalhar={() => setSemTela(true)}
                >
                  {luta && <Placar luta={luta} ultimo={ultimo} terminou={terminou} />}
                </TorreDoDominio>
              )}
              {semTela && luta && <Placar luta={luta} ultimo={ultimo} terminou={terminou} plano />}
              {vendo && <AndarVisto torre={torre} numero={vendo} aoFechar={() => setVendo(null)} />}
              {telaCheia && (
                <HudDaTorre torre={torre} painel={painel} aoPainel={setPainel} aoSair={sairDaTelaCheia} temResultado={Boolean(luta && terminou)}>
                  {painel === "desafio" && (
                    <AndarAtual torre={torre} ocupado={ocupado} lutando={Boolean(luta && !terminou)} aoAbrir={abrirDesafio} aoEntregar={entregar} />
                  )}
                  {painel === "branch" && <PrepararBranch torre={torre} ocupado={ocupado} aoSalvar={salvarBranch} />}
                  {painel === "resultado" && luta && terminou && <ResultadoDaEntrega resultado={luta.resultado} aoFechar={() => setPainel(null)} />}
                  {painel === "neuro" && <AtributosDoNeuro torre={torre} />}
                  {painel === "premios" && <TrilhaDePremios torre={torre} />}
                  {painel === "andares" && <ListaDeAndares torre={torre} aberta />}
                  {painel === "certificado" && <Certificado torre={torre} avisar={avisar} />}
                </HudDaTorre>
              )}
            </div>
            <AtributosDoNeuro torre={torre} />
          </div>

          {luta && terminou && <ResultadoDaEntrega resultado={luta.resultado} aoFechar={() => setLuta(null)} />}

          {torre.status === "concluido" ? <Certificado torre={torre} avisar={avisar} /> : (
            <>
              <PrepararBranch torre={torre} ocupado={ocupado} aoSalvar={salvarBranch} />
              <AndarAtual torre={torre} ocupado={ocupado} lutando={Boolean(luta && !terminou)} aoAbrir={abrirDesafio} aoEntregar={entregar} />
            </>
          )}

          <TrilhaDePremios torre={torre} />
          <ListaDeAndares torre={torre} aberta={semTela} />
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ a tela cheia

/**
 * A tela cheia da torre (pedido de 24/10/2026), no desenho da do Reino: a barra de cima (a torre e o
 * andar), o dock de baixo e um painel flutuante com a parte escolhida da página. Esc fecha o painel;
 * Esc de novo sai da tela cheia.
 */
function HudDaTorre({ torre, painel, aoPainel, aoSair, temResultado, children }) {
  const concluida = torre.status === "concluido";
  const itens = [
    ...(concluida
      ? [{ id: "certificado", emoji: "📜", rotulo: "Certificado" }]
      : [{ id: "desafio", emoji: "⚔️", rotulo: "Desafio" }, { id: "branch", emoji: "🌿", rotulo: "Branch" }]),
    ...(temResultado ? [{ id: "resultado", emoji: "📝", rotulo: "Resultado" }] : []),
    { id: "neuro", emoji: "🧠", rotulo: "Neuro" },
    { id: "premios", emoji: "🎁", rotulo: "Prêmios" },
    { id: "andares", emoji: "🗼", rotulo: "Andares" },
  ];
  useEffect(() => {
    const tecla = (e) => {
      if (e.key !== "Escape") return;
      if (painel) aoPainel(null);
      else aoSair();
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [painel, aoPainel, aoSair]);
  const atual = itens.find((p) => p.id === painel);
  return (
    <>
      <div className="rn-hud__topo">
        <div className="rn-hud__reino">
          <strong>🗼 {torre.repo}</strong>
          <span>{concluida ? "🏆 conquistada" : `Andar ${torre.andarAtual} de ${torre.andares}`}</span>
          <span>Nível {torre.nivel}</span>
        </div>
        <div className="rn-hud__rapido">
          <button type="button" className="rn-hud__botao rn-hud__sair" onClick={aoSair} aria-label="Sair da tela cheia">✕ <span>Sair</span></button>
        </div>
      </div>
      {atual && (
        <aside className="rn-hud__painel dm-hud__painel" aria-label={atual.rotulo}>
          <div className="rn-hud__painel-topo">
            <strong>{atual.emoji} {atual.rotulo}</strong>
            <button type="button" className="folha__fechar" onClick={() => aoPainel(null)} aria-label="Fechar o painel">✕</button>
          </div>
          <div className="rn-hud__painel-corpo">{children}</div>
        </aside>
      )}
      <nav className="rn-hud__dock" aria-label="Menus da torre">
        {itens.map((p) => (
          <button key={p.id} type="button" className={`rn-hud__item${painel === p.id ? " rn-hud__item--atual" : ""}`} aria-pressed={painel === p.id}
            onClick={() => aoPainel(painel === p.id ? null : p.id)}>
            <span aria-hidden="true">{p.emoji}</span><small>{p.rotulo}</small>
          </button>
        ))}
      </nav>
    </>
  );
}

// ------------------------------------------------------------------ montar

function MontarTorre({ torre, ocupado, aoMontar }) {
  const { min, max } = torre.permitido;
  const [n, setN] = useState(() => Math.min(max, Math.max(min, torre.analise?.andaresSugeridos || min)));
  const final = useMemo(() => chefoesDaTorre(n, sementeDe(torre.id)).at(-1), [n, torre.id]);
  const premios = useMemo(() => premiosDaTorre(n, torre.nivel, final), [n, torre.nivel, final]);
  const pontosMaximos = useMemo(() => {
    let s = pontosDoTopo(torre.nivel, n);
    for (let i = 1; i <= n; i++) s += pontosDoAndar(100, dificuldadeEsperada(i, n), torre.nivel);
    for (const m of premios) for (const p of m.premios) if (p.tipo === "pontos") s += p.pontos;
    return s;
  }, [n, torre.nivel, premios]);
  const montando = torre.status === "montando" || ocupado === "montar";
  const a = torre.analise || {};

  return (
    <section className="dm-montar">
      <div className="pf-cartao dm-analise">
        <div className="dm-analise__neuro" aria-hidden="true">
          <Neuro humor={montando ? "pensando" : "feliz"} tamanho={96} />
        </div>
        <div className="dm-analise__textos">
          <h2>O que a Lisa viu</h2>
          <p>{a.resumo}</p>
          <p className="dm-analise__motivo">{a.motivo}</p>
          {a.tecnologias?.length > 0 && <div className="dm-chips">{a.tecnologias.map((t) => <span key={t} className="dm-chip">{t}</span>)}</div>}
          {a.assuntos?.length > 0 && (
            <details className="dm-assuntos">
              <summary>Os {a.assuntos.length} assuntos para dominar</summary>
              <ol>{a.assuntos.map((s) => <li key={s}>{s}</li>)}</ol>
            </details>
          )}
        </div>
      </div>

      <div className="pf-cartao dm-escolha">
        <h2>Quantos andares?</h2>
        <p>Nível {torre.nivel} ({NIVEIS[torre.nivel]?.nome}): de {min} a {max} andares. Mais andares, mais fundo você vai — e mais prêmios.</p>
        <div className="dm-escolha__controle">
          <input type="range" min={min} max={max} value={n} onChange={(e) => setN(Number(e.target.value))} disabled={montando} aria-label="Número de andares" />
          <output className="dm-escolha__numero">{n}</output>
        </div>
        <div className="dm-escolha__final">
          <img src={urlDoMonstro(final)} alt="" width="72" height="72" />
          <div>
            <strong>Guardião do topo: {chefaoPorId(final)?.nome}</strong>
            <small>{chefaoPorId(final)?.descricao}</small>
          </div>
        </div>
        <ul className="dm-marcos">
          {premios.map((m) => (
            <li key={m.andar}><span className="dm-marcos__andar">Andar {m.andar}</span> {m.premios.map(textoDoPremio).filter(Boolean).join(" · ")}</li>
          ))}
        </ul>
        <p className="dm-nota">Até <strong>{pontosMaximos}</strong> pontos (com nota 100 em todos os andares). Os pontos viram moedas e contam para a ofensiva.</p>
        <button type="button" className="pf-botao" disabled={montando} onClick={() => aoMontar(n)}>
          {montando ? "A Lisa está montando a torre…" : `Montar a torre de ${n} andares`}
        </button>
        {montando && <p className="dm-espera" role="status"><span className="dm-espera__ponto" aria-hidden="true" />A Lisa está desenhando os {n} andares — pode levar até um minuto. Pode ficar nesta tela.</p>}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ a luta

function Placar({ luta, ultimo, terminou, plano = false }) {
  const r = luta.resultado;
  const vidaNeuro = ultimo ? ultimo.vidaNeuro : 100;
  const vidaChefao = ultimo ? ultimo.vidaChefao : 100;
  const atributo = ultimo?.especial ? ATRIBUTOS.find((a) => a.id === ultimo.especial) : null;
  const fala = !ultimo ? `⚔️ ${r.chefao.nome} desafia o Neuro!`
    : terminou ? (r.venceu ? `🏆 ${r.chefao.nome} caiu! Nota ${r.entrega.nota}.` : `💫 O Neuro recuou. Nota ${r.entrega.nota} — ${NOTA_PARA_VENCER} vence.`)
    : ultimo.quem === "neuro" ? `${atributo ? `${atributo.emoji} Golpe de ${atributo.nome}! ` : "👊 "}−${ultimo.dano}`
    : `${r.chefao.emoji} ${r.chefao.nome} ataca! −${ultimo.dano}`;
  return (
    <div className={`dm-placar${plano ? " dm-placar--plano" : ""}`} role="status" aria-live="polite">
      <div className="dm-placar__lado">
        <span>🧠 Neuro</span>
        <div className="dm-vida"><div className="dm-vida__cheio dm-vida__cheio--neuro" style={{ width: `${vidaNeuro}%` }} /></div>
      </div>
      <div className="dm-placar__fala">{fala}</div>
      <div className="dm-placar__lado dm-placar__lado--chefao">
        <span>{r.chefao.emoji} {r.chefao.nome}</span>
        <div className="dm-vida"><div className="dm-vida__cheio dm-vida__cheio--chefao" style={{ width: `${vidaChefao}%` }} /></div>
      </div>
    </div>
  );
}

function ResultadoDaEntrega({ resultado: r, aoFechar }) {
  const e = r.entrega;
  return (
    <section className={`pf-cartao dm-resultado${r.venceu ? " dm-resultado--venceu" : ""}`} aria-label="Resultado da entrega">
      <div className="dm-resultado__topo">
        <div className="dm-resultado__nota"><strong>{e.nota}</strong><small>/100</small></div>
        <div>
          <h2>{r.concluiu ? "🏆 Torre conquistada!" : r.venceu ? `Andar ${r.andar} vencido!` : `Ainda não foi desta vez (${NOTA_PARA_VENCER} vence)`}</h2>
          <p>{e.comentario}</p>
          {r.pontos > 0 && <p className="dm-resultado__pontos">+{r.pontos} pontos</p>}
        </div>
        <button type="button" className="dm-fechar" onClick={aoFechar} aria-label="Fechar o resultado">✕</button>
      </div>
      <div className="dm-atributos-da-entrega">
        {ATRIBUTOS.map((a) => (
          <div key={a.id} className="dm-atributo"><span>{a.emoji} {a.nome}</span><Barra valor={e.atributos?.[a.id] || 0} total={100} rotulo={`${a.nome}: ${e.atributos?.[a.id] || 0}`} /><b>{e.atributos?.[a.id] || 0}</b></div>
        ))}
      </div>
      <div className="dm-resultado__listas">
        {e.pontosFortes?.length > 0 && <div><h3>👍 Pontos fortes</h3><ul>{e.pontosFortes.map((p) => <li key={p}>{p}</li>)}</ul></div>}
        {e.melhorar?.length > 0 && <div><h3>🔧 Para melhorar</h3><ul>{e.melhorar.map((p) => <li key={p}>{p}</li>)}</ul></div>}
      </div>
      {r.premios?.length > 0 && (
        <div className="dm-resultado__premios">
          <h3>🎁 Prêmios do marco</h3>
          <ul>{r.premios.map((p, i) => <li key={i}>{textoDoRecebido(p)}</li>)}</ul>
        </div>
      )}
      <small className="dm-resultado__commit">Commit avaliado: {e.link ? <a href={e.link} target="_blank" rel="noreferrer">{e.sha.slice(0, 7)}</a> : e.sha.slice(0, 7)} · {e.arquivos} arquivo(s), {e.commits} commit(s)</small>
    </section>
  );
}

// ------------------------------------------------------------------ o Neuro e os prêmios

function AtributosDoNeuro({ torre }) {
  const { valores, nivel, experiencia, andares } = torre.neuro;
  return (
    <aside className="pf-cartao dm-neuro" aria-label="Atributos do Neuro">
      <div className="dm-neuro__topo">
        <Neuro humor="normal" tamanho={80} />
        <div>
          <strong>Neuro · nível {nivel}</strong>
          <small>{experiencia} de experiência · {andares} andar(es) vencido(s)</small>
        </div>
      </div>
      <div className="dm-neuro__barras">
        {ATRIBUTOS.map((a) => (
          <div key={a.id} className="dm-atributo"><span>{a.emoji} {a.nome}</span><Barra valor={valores[a.id] || 0} total={100} rotulo={`${a.nome}: ${valores[a.id] || 0}`} /><b>{valores[a.id] || 0}</b></div>
        ))}
      </div>
      <div className="dm-neuro__progresso">
        <span>Escalada</span>
        <Barra valor={torre.vencidos} total={torre.andares || 1} rotulo={`${torre.vencidos} de ${torre.andares} andares`} />
        <small>{torre.vencidos} de {torre.andares} andares · topo vale +{torre.pontosDoTopo} pontos</small>
      </div>
    </aside>
  );
}

function TrilhaDePremios({ torre }) {
  if (!torre.premios?.length) return null;
  const recebidos = new Map((torre.premiosRecebidos || []).map((p) => [p.andar, p]));
  return (
    <section className="pf-secao">
      <h2 className="pf-secao__titulo">🎁 Prêmios da escalada <small>cada marco paga uma vez</small></h2>
      <ol className="dm-premios">
        {torre.premios.map((m) => {
          const pago = recebidos.get(m.andar);
          return (
            <li key={m.andar} className={`pf-cartao dm-premio${m.recebido ? " dm-premio--recebido" : ""}`}>
              <span className="dm-premio__andar">{m.recebido ? "✅" : "🔒"} Andar {m.andar}</span>
              <ul>{(pago ? pago.entregues.map(textoDoRecebido) : m.premios.map(textoDoPremio)).filter(Boolean).map((t, i) => <li key={i}>{t}</li>)}</ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ------------------------------------------------------------------ a branch e o andar

function PrepararBranch({ torre, ocupado, aoSalvar }) {
  const [editando, setEditando] = useState(!torre.entrega);
  const [repo, setRepo] = useState(torre.entrega?.url || torre.url);
  const [branch, setBranch] = useState(torre.entrega?.branch || torre.branchSugerida);
  const pasta = torre.repo.split("/").pop();
  const atual = torre.atual;

  if (torre.entrega && !editando) {
    return (
      <section className="pf-cartao dm-branch dm-branch--pronta">
        <div>
          <strong>🌿 Branch do desafio: <code>{torre.entrega.branch}</code></strong>
          <small>
            em <a href={torre.entrega.url} target="_blank" rel="noreferrer">{torre.entrega.url.replace(/^https:\/\//, "")}</a>
            {atual?.commitInicio && <> · o andar {atual.numero} começou no commit {atual.linkDoInicio ? <a href={atual.linkDoInicio} target="_blank" rel="noreferrer">{atual.commitInicio.slice(0, 7)}</a> : atual.commitInicio.slice(0, 7)}</>}
          </small>
        </div>
        <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setEditando(true)}>Trocar</button>
      </section>
    );
  }

  return (
    <section className="pf-cartao dm-branch">
      <h2>🌿 Prepare a branch do desafio</h2>
      <p>A torre inteira é feita numa branch só. Crie a branch, envie (push) e a Lisa marca o ponto de partida. Sem permissão de push no repositório original? Faça um <strong>fork</strong> e use o link dele.</p>
      <pre className="dm-comandos"><code>{`git clone ${repo || torre.url}.git
cd ${pasta}
git checkout -b ${branch}
git push -u origin ${branch}`}</code></pre>
      <form className="dm-branch__form" onSubmit={(e) => { e.preventDefault(); aoSalvar(repo.trim(), branch.trim()); }}>
        <label className="pf-campo">
          <span className="pf-campo__rotulo">Repositório onde você vai trabalhar (o mesmo ou o seu fork, público)</span>
          <input className="pf-campo__entrada" type="url" value={repo} onChange={(e) => setRepo(e.target.value)} required />
        </label>
        <label className="pf-campo">
          <span className="pf-campo__rotulo">Branch</span>
          <input className="pf-campo__entrada" value={branch} onChange={(e) => setBranch(e.target.value)} required spellCheck={false} />
        </label>
        <div className="dm-branch__acoes">
          <button type="submit" className="pf-botao" disabled={Boolean(ocupado)}>{ocupado === "branch" ? "Conferindo…" : "Já enviei a branch — conferir"}</button>
          {torre.entrega && <button type="button" className="pf-botao pf-botao--sec" onClick={() => setEditando(false)}>Cancelar</button>}
        </div>
        {torre.entrega && <small className="dm-nota">Trocar a branch recomeça o andar de agora a partir da ponta dela.</small>}
      </form>
    </section>
  );
}

function AndarAtual({ torre, ocupado, lutando, aoAbrir, aoEntregar }) {
  const a = torre.atual;
  if (!a) return null;
  const d = a.desafio;
  return (
    <section className="pf-secao">
      <h2 className="pf-secao__titulo">Andar {a.numero} de {torre.andares} <small>{estrelas(a.dificuldade)} · vale até {a.pontosEmJogo} pontos</small></h2>
      <article className="pf-cartao dm-andar">
        <div className="dm-andar__chefao">
          <img src={urlDoMonstro(a.chefao)} alt="" width="96" height="96" />
          <strong>{a.chefaoNome}</strong>
          <small>{chefaoPorId(a.chefao)?.descricao}</small>
        </div>
        <div className="dm-andar__corpo">
          <h3>{a.titulo}</h3>
          <p className="dm-andar__objetivo">{a.objetivo}</p>
          {a.assunto && <span className="dm-chip">{a.assunto}</span>}

          {!d ? (
            <div className="dm-andar__abrir">
              <button type="button" className="pf-botao" disabled={Boolean(ocupado)} onClick={aoAbrir}>
                {ocupado === "desafio" ? "A Lisa está lendo o código…" : "Abrir o desafio do andar"}
              </button>
              <small>A Lisa lê o código do repositório {torre.entrega ? "no ponto em que o andar começou" : ""} e escreve o desafio.</small>
            </div>
          ) : (
            <div className="dm-desafio">
              <p className="dm-desafio__enunciado">{d.enunciado}</p>
              <h4>Requisitos</h4>
              <ol>{d.requisitos.map((r) => <li key={r}>{r}</li>)}</ol>
              {d.criterios?.length > 0 && (<><h4>Como a Lisa avalia</h4><ul>{d.criterios.map((c) => <li key={c}>{c}</li>)}</ul></>)}
              {d.arquivos?.length > 0 && <div className="dm-chips">{d.arquivos.map((f) => <code key={f} className="dm-chip dm-chip--arquivo">{f}</code>)}</div>}
              {d.dica && <details className="dm-dica"><summary>💡 Uma dica</summary><p>{d.dica}</p></details>}

              <div className="dm-entregar">
                {torre.entrega ? (
                  <>
                    <pre className="dm-comandos"><code>{`git add .
git commit -m "andar ${a.numero}: ${a.titulo.replace(/"/g, "'")}"
git push`}</code></pre>
                    <button type="button" className="pf-botao dm-entregar__botao" disabled={Boolean(ocupado) || lutando} onClick={aoEntregar}>
                      {ocupado === "entregar" ? "A Lisa está avaliando o commit…" : lutando ? "⚔️ Lutando…" : `⚔️ Entregar o andar ${a.numero}`}
                    </button>
                    <small>A Lisa lê tudo o que mudou na branch <code>{torre.entrega.branch}</code> desde o começo do andar e dá a nota. {NOTA_PARA_VENCER}+ vence o chefão.</small>
                  </>
                ) : <p className="pf-aviso">Prepare a branch do desafio (acima) para poder entregar.</p>}
              </div>
            </div>
          )}
        </div>
      </article>

      {a.entregas?.length > 0 && (
        <div className="dm-entregas">
          <h3>Entregas deste andar <small>{a.tentativas} tentativa(s) · melhor nota {a.melhorNota ?? "—"}</small></h3>
          <ul>
            {a.entregas.map((e) => (
              <li key={e.sha + e.quando} className={`pf-cartao dm-entrega${e.venceu ? " dm-entrega--venceu" : ""}`}>
                <div className="dm-entrega__topo">
                  <span className={`pf-pilula ${e.venceu ? "pf-pilula--verde" : "pf-pilula--atencao"}`}>Nota {e.nota}</span>
                  <small>{new Date(e.quando).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small>
                  {e.link && <a href={e.link} target="_blank" rel="noreferrer"><code>{e.sha.slice(0, 7)}</code></a>}
                </div>
                <p>{e.comentario}</p>
                {e.melhorar?.length > 0 && <details><summary>O que melhorar</summary><ul>{e.melhorar.map((m) => <li key={m}>{m}</li>)}</ul></details>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ os andares

function AndarVisto({ torre, numero, aoFechar }) {
  const a = torre.andaresDaTorre.find((x) => x.numero === numero);
  if (!a) return null;
  return (
    <div className="pf-cartao dm-visto" role="dialog" aria-label={`Andar ${a.numero}`}>
      <img src={urlDoMonstro(a.chefao)} alt="" width="56" height="56" />
      <div>
        <strong>Andar {a.numero}: {a.titulo}</strong>
        <small>{a.chefaoNome} · {estrelas(a.dificuldade)}{a.vencido ? ` · vencido com nota ${a.melhorNota}` : a.numero === torre.andarAtual ? " · andar de agora" : ""}</small>
        <p>{a.objetivo}</p>
      </div>
      <button type="button" className="dm-fechar" onClick={aoFechar} aria-label="Fechar">✕</button>
    </div>
  );
}

function ListaDeAndares({ torre, aberta }) {
  return (
    <details className="pf-secao dm-andares" open={aberta}>
      <summary><h2 className="pf-secao__titulo">Todos os andares <small>{torre.vencidos} de {torre.andares} vencidos</small></h2></summary>
      <ol className="dm-andares__lista">
        {torre.andaresDaTorre.map((a) => (
          <li key={a.numero} className={`dm-andares__item${a.vencido ? " dm-andares__item--vencido" : ""}${a.numero === torre.andarAtual && torre.status !== "concluido" ? " dm-andares__item--atual" : ""}`}>
            <img src={urlDoMonstro(a.chefao)} alt="" width="36" height="36" loading="lazy" />
            <span className="dm-andares__num">{a.numero}</span>
            <span className="dm-andares__texto"><strong>{a.titulo}</strong><small>{a.chefaoNome} · {a.assunto}</small></span>
            <span className="dm-andares__estado">{a.vencido ? `✅ ${a.melhorNota}` : a.numero === torre.andarAtual && torre.status !== "concluido" ? "📍 agora" : "🔒"}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

/** Sem WebGL: a torre como uma pilha de andares, do de agora para cima. */
function TorrePlana({ torre }) {
  const de = Math.max(1, torre.andarAtual - 2);
  const lista = torre.andaresDaTorre.filter((a) => a.numero >= de && a.numero <= de + 6).reverse();
  return (
    <div className="dm-plana" aria-label="A torre">
      {lista.map((a) => (
        <div key={a.numero} className={`dm-plana__andar${a.vencido ? " dm-plana__andar--vencido" : ""}${a.numero === torre.andarAtual ? " dm-plana__andar--atual" : ""}`}>
          <span>{a.numero}</span>
          {a.vencido ? <span aria-hidden="true">🚩</span> : <img src={urlDoMonstro(a.chefao)} alt="" width="40" height="40" />}
          {a.numero === torre.andarAtual && torre.status !== "concluido" && <Neuro tamanho={44} />}
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ o certificado

function Certificado({ torre, avisar }) {
  const tela = useRef(null);
  const [baixando, setBaixando] = useState(false);
  const c = torre.certificado;
  const dados = useMemo(() => ({
    nome: c?.nome, repo: torre.repo, provedor: torre.provedor, nivel: torre.nivel, nomeDoNivel: torre.nomeDoNivel,
    andares: torre.andares, media: c?.media, tecnologias: torre.tecnologias, assuntos: c?.assuntos,
    concluidoEm: c?.concluidoEm, codigo: c?.codigo, chefaoFinal: torre.chefaoFinal,
    link: typeof window !== "undefined" ? `${window.location.origin}/certificado/${c?.codigo}` : "",
  }), [torre, c]);

  useEffect(() => {
    if (tela.current && c) desenharCertificado(tela.current, dados).catch(() => {});
  }, [dados, c]);

  if (!c) return null;
  async function baixar() {
    setBaixando(true);
    try {
      await baixarCertificado(dados);
      avisar("Certificado baixado! 📜");
    } catch (e) {
      avisar(e.message);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <section className="pf-secao dm-certificado">
      <h2 className="pf-secao__titulo">📜 Seu certificado <small>média final {c.media}/100</small></h2>
      <div className="pf-cartao dm-certificado__cartao">
        <canvas ref={tela} className="dm-certificado__previa" role="img" aria-label={`Certificado de Domínio de ${c.nome} no repositório ${torre.repo}`} />
        <div className="dm-certificado__acoes">
          <button type="button" className="pf-botao" onClick={baixar} disabled={baixando}>{baixando ? "Gerando o PDF…" : "Baixar certificado (PDF)"}</button>
          <a className="pf-botao pf-botao--sec" href={`/certificado/${c.codigo}`} target="_blank" rel="noreferrer">Página de conferência ↗</a>
          <small>Código <code>{c.codigo}</code>: quem receber o PDF confere a autenticidade na página, que mostra só o seu nome público.</small>
        </div>
      </div>
    </section>
  );
}
