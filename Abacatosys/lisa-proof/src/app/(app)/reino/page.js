"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { obter, criar } from "@/lib/api.js";
import { useAviso, Barra } from "@/componentes/Pecas.js";
import { CartaoDeVale } from "@/componentes/Vales.js";
import Neuro, { reagir, comemorar, definirPersonagem } from "@/componentes/Neuro.js";
import {
  ATAQUES_POR_DIA, FATIA_DO_SAQUE, TETO_DO_SAQUE, ESCUDO_APOS_DERROTA_HORAS, ESCUDO_DE_NOVATO_HORAS, HORAS_ATE_ENCHER,
  CONSTRUCOES, RIVAIS_SIMULADOS, rivalSimulado, simularBatalha, protecaoDoCofre, poderDo, combateDe, previsaoDeEstrelas,
  exercitoDeTreino,
} from "@/dominio/reino.js";
import { TROPAS, ORDEM_DAS_TROPAS, totalDeTropas } from "@/dominio/tropas.js";
import { BONUS_DE_TRES_ESTRELAS } from "@/dominio/monstros.js";
import { CARGAS_POR_DIA, EXTRAS_POR_DIA } from "@/dominio/veiculos.js";
import { HORAS_POR_PEPITA, VALOR_DA_PEPITA, OPERARIOS_INICIAIS, HORAS_DE_ALUGUEL } from "@/dominio/ouro.js";
import { VARIACAO_MAXIMA, TAXA_DA_CORRETAGEM, PRECO_MINIMO, MAXIMO_DE_ACOES } from "@/dominio/bolsa.js";
import { HORAS_ENTRE_ATAQUES_AO_MESMO_REINO } from "@/dominio/reino.js";
import { urlDoMonstro } from "@/componentes/reino/monstrosDePapel.js";
import { termosDaPaz, DIAS_DE_PAZ, OFENSIVA_PARA_VOTAR } from "@/dominio/paz.js";
import Folha from "@/componentes/Folha.js";
import { numero, hora, Moedas, Botao } from "@/componentes/reino/pecas.js";
import Garagem, { Tanque } from "@/componentes/reino/Garagem.js";
import MinaDeOuro from "@/componentes/reino/MinaDeOuro.js";
import ResumoDaBolsa from "@/componentes/bolsa/Resumo.js";
import Visita from "@/componentes/reino/Visita.js";
import TelaCheia from "@/componentes/reino/TelaCheia.js";
import ModoDeTeste from "@/componentes/reino/ModoDeTeste.js";
import { MUNDO_DE_TESTE, FERRAMENTAS_DE_TESTE, urlNoMundo } from "@/dominio/mundoDeTeste.js";
import { urlDoVeiculo } from "@/componentes/reino/veiculosDePapel.js";

// O mundo 3D (Three.js) só baixa nesta tela, e só no navegador.
const Mundo3D = dynamic(() => import("@/componentes/reino/Mundo3D.js"), {
  ssr: false,
  loading: () => <div className="rn-mundo rn-mundo--carregando"><span>Montando o reino…</span></div>,
});


/**
 * O Reino do Neuro. Estudar dá moedas (1 ponto = 1 moeda); moedas constroem o reino e sobem o
 * Neuro; o reino invade e é invadido por outros jogadores. As regras estão em
 * src/dominio/reino.js e a explicação para a pessoa, no fim desta tela.
 *
 * A mesma tela serve ao REINO DE TESTE (/reino/teste): um mundo à parte, com tudo liberado, onde
 * nada vale no jogo de verdade (src/lib/mundo.js). Toda chamada ao servidor passa por `api()`, que
 * leva o mundo da página.
 */
export default function Reino() {
  const mundo = usePathname()?.startsWith("/reino/teste") ? MUNDO_DE_TESTE : "real";
  const teste = mundo === MUNDO_DE_TESTE;
  const api = (url) => urlNoMundo(url, mundo);
  const [reino, setReino] = useState(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [alvos, setAlvos] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [simulando, setSimulando] = useState(false);
  const [mapa, setMapa] = useState(null);
  const [propondo, setPropondo] = useState(false); // a folha da proposta de paz
  const [resultadoExp, setResultadoExp] = useState(null);
  const [bolsa, setBolsa] = useState(null);
  const [mercado, setMercado] = useState(null); // operários dos outros reinos para alugar
  const [veiculoDoMapa, setVeiculoDoMapa] = useState("barco");
  const [telaCheia, setTelaCheia] = useState(false);
  const [painel, setPainel] = useState(null); // o menu aberto na tela cheia
  const [visita, setVisita] = useState(null); // o reino vizinho que estou visitando (na paz)
  const telaCheiaRef = useRef(false);
  telaCheiaRef.current = telaCheia;
  const pediuTelaCheiaDeVerdade = useRef(false);
  const montado = useRef(true);
  const [Aviso, avisar] = useAviso();

  const carregarMapa = () => obter(api("/api/reino/expedicoes")).then(setMapa).catch(() => {});
  const carregarMercado = () => obter(api("/api/reino/operarios")).then((r) => setMercado(r.ofertas)).catch(() => {});
  /** A bolsa: no primeiro acesso do dia a Lisa abre o pregão; enquanto ela abre, confere de novo. */
  function carregarBolsa() {
    obter(api("/api/reino/bolsa")).then((b) => {
      if (!montado.current) return;
      setBolsa(b);
      if (b.pregao?.abrindo) setTimeout(() => montado.current && carregarBolsa(), 5000);
    }).catch(() => {});
  }

  useEffect(() => {
    montado.current = true;
    obter(api("/api/reino")).then(setReino).catch((e) => setErro(e.message));
    obter(api("/api/reino/alvos")).then(setAlvos).catch(() => {});
    carregarMapa();
    carregarMercado();
    carregarBolsa();
    const aoResgatar = () => obter(api("/api/reino")).then(setReino).catch(() => {});
    window.addEventListener("proof-vale-resgatado", aoResgatar);
    return () => { montado.current = false; window.removeEventListener("proof-vale-resgatado", aoResgatar); };
    // carrega uma vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // chegou pelo atalho das novidades (/reino#expedicoes): a seção só existe depois que tudo carrega
  const pronto = Boolean(reino && mapa);
  useEffect(() => {
    const alvo = ["#expedicoes", "#paz", "#garagem", "#mina-de-ouro", "#bolsa"].includes(window.location.hash) ? window.location.hash.slice(1) : null;
    if (pronto && alvo) document.getElementById(alvo)?.scrollIntoView({ block: "start" });
  }, [pronto]);

  // ---- tela cheia: a página some, o mundo ocupa tudo; o navegador vai para a tela cheia de verdade quando deixa
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
  function entrarNaTelaCheia() {
    setTelaCheia(true);
    setPainel(null);
    const raiz = document.documentElement;
    if (raiz.requestFullscreen && !document.fullscreenElement) {
      raiz.requestFullscreen().then(() => { pediuTelaCheiaDeVerdade.current = true; }).catch(() => {});
    }
  }
  function sairDaTelaCheia() {
    setTelaCheia(false);
    setPainel(null);
    if (document.fullscreenElement) { pediuTelaCheiaDeVerdade.current = false; document.exitFullscreen?.().catch(() => {}); }
  }
  /** Mostra uma parte do reino: na tela cheia abre o menu dela; fora, rola até a seção. */
  function mostrarSecao(id, idDaSecao = id) {
    if (telaCheiaRef.current) setPainel(id);
    else document.getElementById(idDaSecao)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }
  function escolherConstrucao(chave) {
    if (telaCheiaRef.current) { setPainel("construcoes"); setTimeout(() => irParaConstrucao(chave), 80); }
    else irParaConstrucao(chave);
  }

  async function agir(chave, corpo, aoTerminar) {
    setOcupado(chave);
    try {
      const r = await criar(api("/api/reino"), corpo);
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
  const comprarVeiculo = (v) => agir(`veiculo:${v.id}`, { acao: "veiculo", id: v.id }, (r) => { comemorar(`${r.nome} na garagem! 🚗`); setVeiculoDoMapa(v.id); carregarMapa(); });
  const abastecerVeiculo = (v) => agir(`abastecer:${v.id}`, { acao: "abastecer", id: v.id }, (r) => { reagir("feliz", `⛽ Mais uma carga no ${r.nome}!`, 3000); carregarMapa(); });
  const coletarOuro = () => agir("ouro", { acao: "ouro" }, (r) => (r.diamantes
    ? comemorar(`💎 ${r.diamantes > 1 ? `${r.diamantes} diamantes` : "Um diamante"}! +${r.coletou} moedas`)
    : reagir("comemorando", `+${r.coletou} moedas de ouro! ⚒️`, 3500)));
  const contratar = () => agir("operario", { acao: "operario" }, (r) => comemorar(`Operário contratado! Agora são ${r.operarios} 👷`));
  const ofertar = ({ quantidade, preco }) => agir("ofertar", { acao: "ofertar", quantidade, preco },
    (r) => avisar(r.quantidade ? `Oferta salva: ${r.quantidade} operário(s) a 🪙 ${r.preco} cada` : "Oferta retirada"));
  const coletarMina = () => agir("coletar", { acao: "coletar" }, (r) => reagir("feliz", `+${r.coletou} moedas da mina!`));
  const verExpedicoes = (id) => { setVeiculoDoMapa(id); mostrarSecao("expedicoes"); };

  /** As ferramentas do Reino de Teste: mexem só no mundo de teste; depois tudo é recarregado. */
  async function testar(acao) {
    const ferramenta = FERRAMENTAS_DE_TESTE.find((x) => x.id === acao);
    if (ferramenta?.confirmar && !window.confirm(ferramenta.confirmar)) return;
    setOcupado(`teste:${acao}`);
    try {
      const r = await criar(api("/api/reino/teste"), { acao });
      const terminar = () => {
        setReino(r.reino);
        avisar(`🧪 ${r.resultado.mensagem}`);
        carregarMapa();
        carregarMercado();
        carregarBolsa();
        carregarAlvos();
        setOcupado("");
      };
      const inv = r.resultado.invasao;
      if (inv?.combate) {
        if (telaCheiaRef.current) setPainel(null);
        setVisita(null);
        assistirNaIlha({
          entrada: inv.combate, papel: "defensor", resultado: inv,
          titulo: `🛡️ ${String(inv.atacante).toUpperCase()} INVADIU VOCÊ`, aoTerminar: terminar,
        });
      } else terminar();
    } catch (e) {
      avisar(e.message);
      setOcupado("");
    }
  }

  async function alugar(oferta, quantidade) {
    setOcupado(`alugar:${oferta.dono}`);
    try {
      const r = await criar(api("/api/reino/operarios"), { dono: oferta.dono, quantidade });
      setReino(r.reino);
      setMercado(r.ofertas);
      comemorar(`+${r.resultado.quantidade} operário(s) de ${r.resultado.reino} na sua mina! 👷`);
    } catch (e) {
      avisar(e.message);
      carregarMercado();
    } finally {
      setOcupado("");
    }
  }

  /** Na paz, tocar numa ilha vizinha abre a visão completa daquele reino. */
  async function visitar(v) {
    if (!v?.id) return;
    setVisita({ carregando: true, nome: v.nome });
    try {
      const r = await obter(api(`/api/reino/visitar?id=${encodeURIComponent(v.id)}`));
      setVisita(r.reino);
      reagir("surpreso", `Que reino bonito, ${r.reino.dono}! 👀`, 3000);
    } catch (e) {
      setVisita(null);
      avisar(e.message);
    }
  }

  function assistir(b) {
    if (telaCheiaRef.current) setPainel(null);
    setVisita(null);
    const ok = assistirNaIlha({
      entrada: b.combate, papel: b.ataquei ? "atacante" : "defensor", resultado: b.resultado,
      titulo: b.ataquei ? `▶ REPLAY · VOCÊ INVADIU ${String(b.outro).toUpperCase()}` : `▶ REPLAY · ${String(b.outro).toUpperCase()} INVADIU VOCÊ`,
    });
    if (!ok) avisar("O replay precisa do mundo 3D (e do movimento ligado).");
  }

  async function carregarAlvos() {
    try {
      setAlvos(await obter(api("/api/reino/alvos")));
    } catch (e) {
      avisar(e.message);
    }
  }

  async function invadirReino(alvo) {
    setOcupado(`invadir:${alvo.id}`);
    setResultado(null);
    setVisita(null);
    if (telaCheiaRef.current) setPainel(null);
    reagir("pensando", "Avançar! ⚔️", 2000);
    try {
      const r = await criar(api("/api/reino/invadir"), { alvo: alvo.id });
      const mostrar = () => {
        setReino(r.reino);
        setResultado(r.resultado);
        if (r.resultado.venceu) comemorar(r.resultado.saque ? `Vitória! +${r.resultado.saque} moedas` : "Vitória!");
        else reagir("triste", "Eles se defenderam bem… da próxima vamos mais fortes!");
        carregarAlvos();
        setOcupado("");
        mostrarSecao("invadir");
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

  /** Paz: propor, votar ou cancelar — o servidor devolve o reino atualizado. */
  async function agirPaz(corpo, aoTerminar) {
    setOcupado(`paz:${corpo.acao}`);
    try {
      const r = await criar(api("/api/reino/paz"), corpo);
      setReino(r.reino);
      carregarAlvos();
      aoTerminar?.(r);
    } catch (e) {
      avisar(e.message);
    } finally {
      setOcupado("");
    }
  }

  /** Expedição contra a CPU: o servidor decide, a ilha mostra a luta e, no fim, o resultado. */
  async function partir(x) {
    setOcupado(`exp:${x.id}`);
    setResultadoExp(null);
    setVisita(null);
    if (telaCheiaRef.current) setPainel(null);
    reagir("pensando", x.id === "planetoide" ? "Rumo às estrelas! 🚀" : "Rumo à aventura! 🗺️", 2000);
    try {
      const r = await criar(api("/api/reino/expedicoes"), { id: x.id });
      const mostrar = () => {
        setReino(r.reino);
        setMapa(r.mapa);
        setResultadoExp(r.resultado);
        if (r.resultado.saque) comemorar(`+${r.resultado.saque} moedas de saque! 🪙`);
        else reagir("triste", "Os monstros resistiram… volte mais forte!");
        if (alvos) carregarAlvos();
        setOcupado("");
        mostrarSecao("expedicoes");
      };
      assistirNaIlha({
        entrada: r.resultado.combate, papel: "atacante", resultado: r.resultado,
        titulo: `${x.id === "planetoide" ? "🚀" : "🗺️"} EXPEDIÇÃO · ${String(r.resultado.expedicao.nome).toUpperCase()}`, aoTerminar: mostrar,
      });
    } catch (e) {
      avisar(e.message);
      setOcupado("");
    }
  }

  function assistirExpedicao(x) {
    if (telaCheiaRef.current) setPainel(null);
    setVisita(null);
    const ok = assistirNaIlha({ entrada: x.combate, papel: "atacante", resultado: x.resultado, titulo: `▶ REPLAY · ${String(x.nome).toUpperCase()}` });
    if (!ok) avisar("O replay precisa do mundo 3D (e do movimento ligado).");
  }

  if (!reino) {
    return erro ? <div className="pf-aviso pf-aviso--erro">{erro}</div> : <div className="pf-carregando">Abrindo os portões do reino…</div>;
  }

  const restantes = reino.invasoes.porDia - reino.invasoes.feitasHoje;
  const disponiveis = alvos ? alvos.alvos.filter((a) => a.pode).length : null;
  const escudoMaisCurto = alvos?.alvos.filter((a) => a.escudoAte).map((a) => a.escudoAte).sort()[0] || null;

  // ---- as partes do reino: a página mostra todas, uma embaixo da outra; a tela cheia, uma por vez num menu
  const secoes = {
    paz: () => <Paz reino={reino} ocupado={ocupado} aoAgir={agirPaz} aoPropor={() => setPropondo(true)} />,
    minas: () => (
      <>
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
            <div className="pf-estat__rotulo">⛏️ Mina de Moedas {reino.paz?.vigente && <span className="pf-pilula pf-pilula--verde rn-mina-x2">×{reino.paz.vigente.fatorDaMina} paz</span>}</div>
            <div className="pf-estat__valor"><Moedas n={reino.mina.paraColetar} /> <small>de {reino.mina.capacidade}</small></div>
            <p className="pf-estat__nota">Produz {reino.mina.porHora} moeda(s) por hora e para quando enche ({HORAS_ATE_ENCHER} h). Colete sempre que passar por aqui.</p>
            <Botao ok={reino.mina.paraColetar > 0} motivo="nada para coletar ainda" ocupado={ocupado === "coletar"} aoClicar={coletarMina}>
              Coletar
            </Botao>
          </section>
        </div>
        <MinaDeOuro ouro={reino.ouro} mercado={mercado} ocupado={ocupado} aoColetar={coletarOuro} aoContratar={contratar} aoOfertar={ofertar} aoAlugar={alugar} />
      </>
    ),
    personagens: () => (
      <Personagens lista={reino.personagens} atual={reino.personagem} ocupado={ocupado}
        aoEscolher={(p) => agir(`personagem:${p.id}`, { acao: "personagem", id: p.id }, (r) => {
          definirPersonagem(r.personagem);
          if (r.comprou) comemorar(`${r.nome} é seu! 🎭`);
          else reagir("feliz", `Agora eu sou o ${r.nome}!`);
        })} />
    ),
    tropas: () => (
      <>
        {reino.lotacao && (
          <div className="pf-cartao rn-lotacao">
            <div>
              <div className="pf-estat__rotulo">⛺ Lotação do Acampamento: {reino.lotacao.usado} de {reino.lotacao.capacidade} de espaço</div>
              <Barra valor={reino.lotacao.usado} total={Math.max(1, reino.lotacao.capacidade)} rotulo="Lotação do Acampamento" />
            </div>
            <p className="pf-estat__nota">Fora da batalha, todas as tropas (exército + defesa) ficam à vista na ilhota do Acampamento, ao lado do reino. Lotado? Aumente o ⛺ Acampamento: cada nível abre +25 de espaço.</p>
          </div>
        )}
        <Reserva destino="exercito" dados={reino.exercito} heroi={reino.heroi.ataque} ocupado={ocupado} aoTreinar={treinar} />
        <Reserva destino="guarnicao" dados={reino.guarnicao} heroi={reino.heroi.defesa} ocupado={ocupado} aoTreinar={treinar} />
      </>
    ),
    construcoes: () => (
      <section className="pf-secao" id="construcoes">
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
    ),
    garagem: () => <Garagem garagem={reino.garagem} ocupado={ocupado} aoComprar={comprarVeiculo} aoAbastecer={abastecerVeiculo} aoVerExpedicoes={verExpedicoes} />,
    expedicoes: () => (
      <Expedicoes mapa={mapa} veiculo={veiculoDoMapa} aoVeiculo={setVeiculoDoMapa} ocupado={ocupado} resultado={resultadoExp} aoFecharResultado={() => setResultadoExp(null)}
        aoPartir={partir} aoAssistir={assistirExpedicao} aoAbastecer={abastecerVeiculo} aoGaragem={() => mostrarSecao("garagem")}
        aoBloqueado={(x) => avisar(x.liberada ? x.motivo : `${x.nome} libera com a Torre do Neuro no nível ${x.torreMinima}`)} />
    ),
    bolsa: () => <ResumoDaBolsa bolsa={bolsa} href={teste ? "/bolsa/teste" : "/bolsa"} />,
    teste: () => (
      <section className="pf-secao" id="teste">
        <h2 className="pf-secao__titulo">🧪 Ferramentas do Reino de Teste <small>mexem só neste mundo — o seu reino de verdade não muda</small></h2>
        <ModoDeTeste ocupado={ocupado} aoAgir={testar} />
      </section>
    ),
    invadir: () => (
      <>
        <section className="pf-secao" id="invadir">
          <h2 className="pf-secao__titulo">Invadir outros reinos <small>{restantes > 0 ? `${restantes} de ${reino.invasoes.porDia} invasões hoje` : "as invasões de hoje acabaram"} · o mesmo reino só a cada 2 dias</small></h2>
          {alvos?.emPaz && <div className="pf-aviso rn-paz__aviso" style={{ marginBottom: 12 }}>🕊️ O mundo está em paz até {hora(alvos.pazAte)}: nenhum reino pode invadir outro — mas dá para visitar os vizinhos (toque numa ilha vizinha no mundo 3D).</div>}
          {resultado && <ResultadoDaBatalha r={resultado} aoFechar={() => setResultado(null)} />}
          {alvos && alvos.alvos.length > 0 && disponiveis === 0 && !alvos.emPaz && (
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
                      <th scope="row">
                        {a.reino}
                        {a.revanche && <span className="pf-pilula pf-pilula--alerta rn-revanche" title="Esse reino atacou você nos últimos 2 dias">↩️ revanche</span>}
                        <span className="rk-sub">{a.dono} · 🏆 {numero(a.trofeus)}</span>
                      </th>
                      <td className="rn-col-info">{a.torre} · {a.neuro}</td>
                      <td><span className={`pf-pilula rn-faixa rn-faixa--${a.defesa.replace("í", "i").replace("é", "e")}`}>{a.defesa}</span></td>
                      <td className="rn-col-acao">
                        {a.pode ? (
                          <button type="button" className="pf-botao pf-botao--pequeno" disabled={Boolean(ocupado)} onClick={() => invadirReino(a)}>
                            {ocupado === `invadir:${a.id}` ? "Atacando…" : "⚔️ Invadir"}
                          </button>
                        ) : <span className="rn-motivo">{alvos.emPaz ? "🕊️ em paz" : a.escudoAte ? `🛡️ escudo até ${hora(a.escudoAte)}` : a.motivo}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
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
      </>
    ),
  };

  return (
    <>
      {!telaCheia && teste && (
        <div className="rn-faixa-teste" role="note">
          <span className="rn-faixa-teste__selo">🧪 REINO DE TESTE</span>
          <span>Um mundo à parte, com tudo liberado: moedas, expedições, invasões, paz, operários e bolsa daqui <strong>não valem no jogo de verdade</strong>. Os rivais são reinos-robô e os reinos de teste de outras pessoas.</span>
          <Link href="/reino" className="pf-botao pf-botao--sec pf-botao--pequeno">← Voltar ao meu reino</Link>
        </div>
      )}
      {!telaCheia && (
        <div className="pf-cabecalho">
          <div>
            <h1>{teste ? `🧪 ${reino.nome}` : reino.nome}</h1>
            <p>{teste ? "Teste tudo à vontade — nada daqui chega ao seu reino de verdade." : "Estude, ganhe moedas, construa — e defenda o seu reino."} <NomeDoReino atual={reino.nome} ocupado={ocupado === "nome"} aoSalvar={(nome) => agir("nome", { acao: "nome", nome }, () => avisar("Reino renomeado"))} /></p>
          </div>
        </div>
      )}

      {!telaCheia && !teste && <CartaoDeVale />}

      {/* ------------------------------------------------------------ vista (e a tela cheia, por cima de tudo) */}
      <VistaDoReino reino={reino} visita={visita} telaCheia={telaCheia} aoTelaCheia={entrarNaTelaCheia}
        aoEscolher={escolherConstrucao} aoVisitar={visitar} aoVoltarDaVisita={() => setVisita(null)}>
        {telaCheia && (
          <TelaCheia reino={reino} painel={painel} aoPainel={setPainel} aoSair={sairDaTelaCheia} ocupado={ocupado} comTeste={teste}
            aoColetarMina={coletarMina} aoColetarOuro={coletarOuro}>
            {painel && secoes[painel]?.()}
          </TelaCheia>
        )}
      </VistaDoReino>

      {!telaCheia && (
        <>
          {/* o atalho para a briga: logo abaixo do mundo, com quantos alvos há agora */}
          <div className="rn-acoes">
            <button type="button" className="pf-botao rn-acoes__invadir" onClick={() => mostrarSecao("invadir")}>
              ⚔️ Invadir reinos <span className="rn-acoes__conta">{restantes > 0 ? `${restantes} de ${reino.invasoes.porDia} hoje` : "acabaram as de hoje"}</span>
            </button>
            <span className="rn-acoes__nota">
              {disponiveis == null ? "procurando reinos…"
                : disponiveis > 0 ? `${disponiveis} reino(s) para invadir agora`
                : alvos.alvos.length === 0 ? "ainda não há outros reinos"
                : alvos.emPaz ? "🕊️ o mundo está em paz"
                : `todos estão com escudo${escudoMaisCurto ? ` · o primeiro abre ${hora(escudoMaisCurto)}` : ""}`}
            </span>
            <button type="button" className="pf-botao pf-botao--sec" onClick={() => mostrarSecao("expedicoes")}>
              🗺️ Expedições{mapa ? <span className="rn-acoes__conta rn-acoes__conta--sec">{mapa.expedicoes.restantes} hoje</span> : null}
            </button>
            <button type="button" className="pf-botao pf-botao--sec" onClick={() => mostrarSecao("bolsa")}>📈 Bolsa</button>
            <button type="button" className="pf-botao pf-botao--sec" onClick={entrarNaTelaCheia}>⛶ Tela cheia</button>
            <button type="button" className="pf-botao pf-botao--sec" aria-expanded={simulando} aria-controls="simulador" onClick={() => setSimulando((s) => !s)}>
              🎮 {simulando ? "Fechar simulação" : "Simular batalha"}
            </button>
            {!teste && <Link href="/ranking" className="pf-botao pf-botao--sec rn-acoes__ranking">🏆 Ranking</Link>}
          </div>
          {simulando && <Simulador reino={reino} aoFechar={() => setSimulando(false)} />}
          {teste && secoes.teste()}
          {!teste && reino.modoDeTeste && (
            <Link href="/reino/teste" className="rn-entrada-teste">
              <span className="rn-entrada-teste__emoji" aria-hidden="true">🧪</span>
              <span>
                <strong>Reino de Teste</strong>
                <small>Um reino à parte, com tudo liberado e rivais-robô para atacar — para testar expedições, invasões, paz, operários e a bolsa sem mexer no seu reino de verdade.</small>
              </span>
              <span className="rn-entrada-teste__ir" aria-hidden="true">Entrar →</span>
            </Link>
          )}

          <div className="rn-numeros">
            <Numero rotulo="Moedas" valor={<Moedas n={reino.saldo} centavos />} nota={`${numero(reino.cofre.protege)} a salvo no cofre (e todas podem ser gastas)`} />
            <Numero rotulo="Troféus" valor={`🏆 ${numero(reino.trofeus)}`} nota={teste ? "troféus do mundo de teste (não entram no ranking)" : <Link href="/ranking">ver ranking dos reinos</Link>} />
            <Numero rotulo="Ataque · Defesa" valor={`⚔️ ${reino.poder.ataque}/s · 🛡️ ${reino.poder.defesa}`} nota={`exército: ${totalDeTropas(reino.exercito.tropas)} tropa(s) · defesa: ${totalDeTropas(reino.guarnicao.tropas)}`} />
            <Numero rotulo="Escudo" valor={reino.escudoAte ? "🛡️ Ativo" : "Sem escudo"} nota={reino.escudoAte ? `até ${hora(reino.escudoAte)} · atacar tira o escudo` : "o seu reino pode ser invadido"} />
          </div>

          {secoes.paz()}
          {secoes.minas()}
          {secoes.personagens()}
          {secoes.tropas()}
          {secoes.construcoes()}
          {secoes.garagem()}
          {secoes.expedicoes()}
          {secoes.bolsa()}
          {secoes.invadir()}
          <Regras />
        </>
      )}

      <PropostaDePaz aberta={propondo} totalDeReinos={reino.paz?.totalDeReinos || 1} ocupado={ocupado} aoFechar={() => setPropondo(false)}
        aoEnviar={(dias) => agirPaz({ acao: "propor", dias }, (r) => {
          setPropondo(false);
          if (r.resultado?.resultado === "aprovada") comemorar("A paz foi aprovada! 🕊️");
          else reagir("feliz", "Proposta de paz levada para votação! 🗳️", 4000);
        })} />
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

/**
 * O mundo 3D; se o aparelho não tiver WebGL, a vista plana de antes. Na tela cheia, a mesma
 * seção ocupa a tela toda (o mundo não é montado de novo) e os menus vêm em `children`. Numa
 * visita (na paz), o mundo mostra a ilha do vizinho.
 */
function VistaDoReino({ reino, visita, telaCheia, aoTelaCheia, aoEscolher, aoVisitar, aoVoltarDaVisita, children }) {
  const [plana, setPlana] = useState(false);
  const humor = reino.escudoAte ? "normal" : "feliz";
  const vendo = visita && !visita.carregando ? visita : null;
  return (
    <section aria-label={vendo ? `Vista do ${vendo.nome}` : "Vista do reino"} className={`rn-vista3d${telaCheia ? " rn-tela-cheia" : ""}${vendo ? " rn-vista3d--visita" : ""}`}>
      {plana ? <VistaPlana reino={reino} humor={humor} /> : (
        <Mundo3D construcoes={vendo ? vendo.construcoes : reino.construcoes}
          tropas={vendo ? vendo.tropas : { exercito: reino.exercito.tropas, guarnicao: reino.guarnicao.tropas }}
          vizinhos={vendo ? [] : reino.paz?.vigente?.vizinhos || []}
          personagem={vendo ? vendo.personagem : undefined} soLeitura={Boolean(vendo)}
          mineiros={vendo ? vendo.ouro?.trabalhando || 0 : reino.ouro?.equipe?.trabalhando || 0} diamantes={vendo ? 0 : reino.ouro?.diamantes || 0}
          humor={humor} aoEscolher={vendo ? undefined : aoEscolher} aoVisitar={aoVisitar} aoFalhar={() => setPlana(true)} />
      )}
      {!telaCheia && !vendo && <button type="button" className="rn-vista3d__cheia" onClick={aoTelaCheia}>⛶ Tela cheia</button>}
      <Visita visita={visita} aoVoltar={aoVoltarDaVisita} />
      {children}
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
const plural = (nome) => (nome.endsWith("ão") ? `${nome.slice(0, -2)}ões` : `${nome}s`); // Balão → Balões, Dragão → Dragões
function descreverTropas(tropas) {
  const partes = ORDEM_DAS_TROPAS.filter((t) => tropas?.[t]).map((t) => `${tropas[t]} ${TROPAS[t].emoji} ${tropas[t] > 1 ? plural(TROPAS[t].nome) : TROPAS[t].nome}`);
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

/** Os personagens do Neuro: cada um aparece de verdade (o próprio Neuro, vestido). */
function Personagens({ lista, atual, ocupado, aoEscolher }) {
  return (
    <section className="pf-secao" id="personagens">
      <h2 className="pf-secao__titulo">🎭 Personagens <small>o Neuro de todas as telas (e da ilha) veste o que você escolher</small></h2>
      <div className="rn-personagens">
        {lista.map((p) => {
          const usando = p.id === atual;
          return (
            <article key={p.id} className={`pf-cartao rn-personagem${usando ? " rn-personagem--usando" : ""}`}>
              <div className="rn-personagem__vitrine" aria-hidden="true"><Neuro personagem={p.id} humor={usando ? "feliz" : "normal"} tamanho={96} /></div>
              <strong>{p.emoji} {p.nome}</strong>
              <span className="rn-personagem__desc">{p.descricao}</span>
              {usando ? <span className="pf-pilula pf-pilula--verde">Em uso</span>
                : p.tem ? (
                  <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={Boolean(ocupado)} onClick={() => aoEscolher(p)}>Usar</button>
                ) : (
                  <div className="rn-botao">
                    <button type="button" className="pf-botao pf-botao--pequeno" disabled={!p.pode || Boolean(ocupado)} onClick={() => aoEscolher(p)}>
                      Comprar · <Moedas n={p.preco} />
                    </button>
                    {!p.pode && <span className="rn-motivo">{p.motivo}</span>}
                  </div>
                )}
            </article>
          );
        })}
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
        <dd>Reino que cai ganha {ESCUDO_APOS_DERROTA_HORAS} h de escudo; reino novo nasce com {ESCUDO_DE_NOVATO_HORAS} h; atacar tira o seu escudo. {ATAQUES_POR_DIA} invasões por dia; o mesmo reino só a cada {HORAS_ENTRE_ATAQUES_AO_MESMO_REINO / 24} dias (quem foi atacado pode revidar). Só as tropas que caem se perdem; as que sobrevivem voltam para casa.</dd>
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

/** Os termos (da paz), do jeito que aparecem na proposta. */
function Termos({ termos }) {
  return (
    <ul className="rn-termos">
      {termos.map((t) => (
        <li key={t.titulo}>
          <span className="rn-termos__icone" aria-hidden="true">{t.icone}</span>
          <span><strong>{t.titulo}</strong><span>{t.texto}</span></span>
        </li>
      ))}
    </ul>
  );
}

/** A paz entre os reinos: a paz que vale agora, a votação aberta (com o placar e o voto) ou o convite para propor. */
function Paz({ reino, ocupado, aoAgir, aoPropor }) {
  const paz = reino.paz || {};
  const v = paz.vigente, vt = paz.votacao;
  return (
    <section className="pf-secao" id="paz">
      <h2 className="pf-secao__titulo">
        🕊️ Paz entre os reinos{" "}
        <small>{v ? `em paz até ${hora(v.ate)}` : vt ? `votação aberta até ${hora(vt.expira)}` : `${paz.totalDeReinos || 0} reinos · decidida por votação`}</small>
      </h2>
      {v && (
        <article className="pf-cartao rn-paz rn-paz--vigente">
          <span className="rn-convite__selo rn-convite__selo--paz">🕊️ O mundo está em paz</span>
          <h3 className="rn-convite__titulo">{v.reinos} reinos em paz por {v.dias} dias, até {hora(v.ate)}</h3>
          <ul className="rn-aliado__beneficios">
            <li>⚔️ <span>Sem guerra: nenhum reino pode invadir outro</span></li>
            <li>⛏️ <span>A sua mina rende ×{v.fatorDaMina}: {reino.mina.porHora} moeda(s) por hora</span></li>
            <li>🗺️ <span>Expedições repartem: quando alguém saqueia, cada um dos outros reinos ganha {Math.round(v.parteDaExpedicao * 100)}% do saque</span></li>
            <li>🏝️ <span>Todos vizinhos: {v.vizinhos.map((x) => x.nome).join(", ") || "—"}</span></li>
          </ul>
        </article>
      )}
      {vt && (
        <article className="pf-cartao rn-convite rn-paz" aria-label="Proposta de paz em votação">
          <div className="rn-convite__topo">
            <span className="rn-convite__selo">🗳️ Proposta de paz</span>
            <span className="rn-motivo">vota até {hora(vt.expira)}</span>
          </div>
          <h3 className="rn-convite__titulo"><strong>{vt.propostaPor}</strong> propõe {vt.dias} dias de paz para todos os reinos</h3>
          <div className="rn-paz__placar">
            <Barra valor={vt.sims} total={Math.max(1, vt.eleitores)} rotulo="Votos a favor da paz" />
            <span><strong>{vt.sims} de {vt.eleitores}</strong> {vt.eleitores === 1 ? "eleitor votou" : "eleitores votaram"} sim — a paz precisa de todos{vt.votaram.length ? ` · já votaram: ${vt.votaram.join(", ")}` : ""}</span>
            <span className="rn-motivo">
              🔥 Votam os reinos com {paz.ofensivaParaVotar}+ dias de ofensiva de estudo.
              {vt.semVoto > 0 && ` ${vt.semVoto} ${vt.semVoto === 1 ? "reino ainda não pode votar e ganha" : "reinos ainda não podem votar e ganham"} a paz do mesmo jeito.`}
            </span>
          </div>
          <Termos termos={vt.termos} />
          {vt.meuVoto === null && vt.podeVotar ? (
            <div className="pf-acoes">
              <button type="button" className="pf-botao" disabled={Boolean(ocupado)}
                onClick={() => aoAgir({ acao: "votar", id: vt.id, voto: true }, (r) => (r.resultado?.resultado === "aprovada" ? comemorar("Todos votaram: a paz começou! 🕊️") : reagir("feliz", "Voto registrado. Faltam os outros eleitores 🕊️", 4000)))}>
                🕊️ Votar SIM pela paz
              </button>
              <button type="button" className="pf-botao pf-botao--sec" disabled={Boolean(ocupado)}
                onClick={() => aoAgir({ acao: "votar", id: vt.id, voto: false }, () => reagir("normal", "Voto registrado: não. A proposta caiu.", 4000))}>
                Votar NÃO
              </button>
            </div>
          ) : vt.meuVoto === null ? (
            <div className="rn-paz__sem-voto">
              <p>🔥 Você ainda não pode votar: {vt.motivoDoVoto.replace(/^para votar, /, "")}.</p>
              <Link href="/" className="pf-botao pf-botao--sec pf-botao--pequeno">Estudar agora</Link>
            </div>
          ) : (
            <p className="rn-paz__meu-voto">{vt.meuVoto ? "✅ Você votou sim. Falta o voto dos outros eleitores." : "Você votou não."}</p>
          )}
          {vt.souQuemPropos && (
            <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={Boolean(ocupado)}
              onClick={() => aoAgir({ acao: "cancelar", id: vt.id }, () => reagir("normal", "Proposta de paz cancelada.", 3000))}>Cancelar a proposta</button>
          )}
        </article>
      )}
      {!v && !vt && (
        <div className="pf-cartao rn-paz rn-paz--vazia">
          <p className="pf-estat__nota" style={{ marginTop: 0 }}>
            Cansado da guerra? Proponha a paz: votam os reinos com <strong>{paz.ofensivaParaVotar}+ dias de ofensiva de estudo</strong> e, se todos eles votarem sim,
            ninguém invade ninguém, todos viram vizinhos, a mina de cada um rende ×{paz.totalDeReinos || 1} e as expedições repartem o saque —
            para os {paz.totalDeReinos || 0} reinos, inclusive quem não votou.
          </p>
          <div className="rn-paz__propor">
            <button type="button" className="pf-botao" disabled={Boolean(ocupado) || !paz.podePropor} onClick={aoPropor}>🕊️ Propor a paz</button>
            {!paz.podePropor && paz.motivo && <span className="rn-motivo">🔥 {paz.motivo}</span>}
          </div>
        </div>
      )}
    </section>
  );
}

/** A proposta de paz: quem propõe escolhe os dias e vê o que a paz traz antes de levar para votação. */
function PropostaDePaz({ aberta, totalDeReinos, ocupado, aoFechar, aoEnviar }) {
  const [dias, setDias] = useState(7);
  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo="Propor a paz">
      {aberta && (
        <div className="rn-convite-novo">
          <span className="rn-convite__selo">🗳️ Proposta de paz</span>
          <h2 className="rn-convite__titulo">Paz para todos os reinos</h2>
          <p className="pf-campo__rotulo" style={{ marginBottom: 6 }}>Quantos dias de paz?</p>
          <div className="rn-dias" role="radiogroup" aria-label="Dias de paz">
            {DIAS_DE_PAZ.map((d) => (
              <button key={d} type="button" role="radio" aria-checked={dias === d} className={`rn-dias__opcao${dias === d ? " rn-dias__opcao--atual" : ""}`} onClick={() => setDias(d)}>
                {d} dias
              </button>
            ))}
          </div>
          <p className="pf-campo__rotulo" style={{ margin: "12px 0 6px" }}>O que a paz traz (se todos os eleitores votarem sim)</p>
          <Termos termos={termosDaPaz(dias, totalDeReinos)} />
          <div className="pf-acoes">
            <button type="button" className="pf-botao" disabled={Boolean(ocupado)} onClick={() => aoEnviar(dias)}>
              {ocupado.startsWith("paz:propor") ? "Enviando…" : "🗳️ Levar para votação"}
            </button>
            <button type="button" className="pf-botao pf-botao--sec" onClick={aoFechar}>Agora não</button>
          </div>
          <p className="rn-motivo">O seu voto já conta como sim. Votam os reinos com {OFENSIVA_PARA_VOTAR}+ dias de ofensiva de estudo; a votação fica aberta 3 dias e um único não derruba a proposta.</p>
        </div>
      )}
    </Folha>
  );
}

/**
 * O mapa das expedições, por veículo: uma aba para cada um (com o tanque de hoje), e os lugares
 * aonde ele leva — um cartão por lugar, com o chefe, os monstros, as estrelas e o saque. A Nave
 * mostra o radar: o planetoide sorteado para a próxima viagem.
 */
function Expedicoes({ mapa, veiculo, aoVeiculo, ocupado, resultado, aoFecharResultado, aoPartir, aoAssistir, aoBloqueado, aoAbastecer, aoGaragem }) {
  const v = mapa?.veiculos?.find((x) => x.id === veiculo) || mapa?.veiculos?.[0];
  const lugares = mapa && v ? mapa.lugares.filter((x) => x.veiculo === v.id) : [];
  return (
    <section className="pf-secao" id="expedicoes">
      <h2 className="pf-secao__titulo">
        🗺️ Expedições <small>contra a CPU · {!mapa ? "abrindo o mapa…" : mapa.expedicoes.restantes > 0 ? `${mapa.expedicoes.restantes} com o combustível de hoje` : "os tanques de hoje acabaram"}</small>
      </h2>
      <p className="pf-estat__nota rn-exp__intro">
        Monstros e tesouros para saquear. <strong>É de graça:</strong> nenhuma tropa se perde. Cada veículo leva a um tipo de lugar e faz
        {" "}{CARGAS_POR_DIA} expedições por dia (pode repetir o mesmo lugar); acabou o combustível, dá para abastecer com moedas.
        O saque é proporcional à destruição (⭐⭐⭐ dá +{Math.round(BONUS_DE_TRES_ESTRELAS * 100)}%).
      </p>
      {mapa?.veiculos && (
        <div className="rn-exp__abas" role="tablist" aria-label="Veículos">
          {mapa.veiculos.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={x.id === v?.id} className={`rn-exp__aba${x.id === v?.id ? " rn-exp__aba--atual" : ""}${x.tem ? "" : " rn-exp__aba--trancada"}`}
              onClick={() => aoVeiculo(x.id)}>
              <span aria-hidden="true">{x.emoji}</span> {x.nome}
              {x.tem ? <Tanque tanque={x.tanque} compacto /> : <span className="rn-exp__cadeado" aria-label="ainda não é seu">🔒</span>}
            </button>
          ))}
        </div>
      )}
      {v && !v.tem && (
        <div className="pf-cartao rn-exp__trancado">
          <img src={urlDoVeiculo(v.id)} alt="" width="72" height="72" />
          <p><strong>{v.emoji} {v.nome}</strong> leva a: {v.destino}. {v.descricao} Compre na garagem por <Moedas n={v.preco} /> (Torre {v.torreMinima}+).</p>
          <button type="button" className="pf-botao pf-botao--pequeno" onClick={aoGaragem}>🚗 Ir à garagem</button>
        </div>
      )}
      {v?.tem && (
        <div className="rn-exp__tanque">
          <Tanque tanque={v.tanque} />
          <span className="rn-motivo">{v.tanque.restantes ? `${v.tanque.restantes} expedição(ões) de ${v.nome} hoje` : `tanque vazio${v.tanque.extras ? ` (já abasteceu ${v.tanque.extras}×)` : ""}`}</span>
          {!v.tanque.restantes && v.abastecer && (
            <Botao ok={v.abastecer.ok} motivo={v.abastecer.motivo} ocupado={ocupado === `abastecer:${v.id}`} aoClicar={() => aoAbastecer(v)}>
              ⛽ Abastecer +1 · <Moedas n={v.abastecer.custo} />
            </Botao>
          )}
        </div>
      )}
      {mapa?.tropa && (
        <div className={`pf-aviso rn-exp__tropa${mapa.tropa.emprestada ? " rn-exp__tropa--emprestada" : ""}`}>
          {mapa.tropa.emprestada
            ? <>🎒 <strong>Seu exército está vazio, então você parte com a Tropa da Expedição:</strong> {descreverTropas(mapa.tropa.tropas)} + o Neuro. Emprestada e de graça — não precisa treinar nada.</>
            : <>⚔️ <strong>Você parte com o seu exército:</strong> {descreverTropas(mapa.tropa.tropas)} + o Neuro. Nenhuma tropa se perde.</>}
        </div>
      )}
      {resultado && <ResultadoDaExpedicao r={resultado} aoFechar={aoFecharResultado} />}
      {!mapa ? (
        <div className="pf-cartao"><p className="pf-estat__nota" style={{ marginTop: 0 }}>Abrindo o mapa…</p></div>
      ) : (
        <div className="rn-exp">
          {lugares.map((x) => (
            <article key={x.id} className={`pf-cartao rn-exp__lugar rn-exp__lugar--${x.tipo}${x.liberada && x.temVeiculo ? "" : " rn-exp__lugar--bloqueada"}`}>
              <button type="button" className="rn-exp__arte" disabled={Boolean(ocupado)}
                aria-label={x.pode ? `Atacar ${x.nome}` : `${x.nome}: ${x.liberada ? x.motivo : `libera com a Torre nível ${x.torreMinima}`}`}
                onClick={() => (x.pode ? aoPartir(x) : aoBloqueado(x))}>
                <img src={urlDoMonstro(x.chefe)} alt="" width="104" height="104" />
                <span className="rn-exp__estrelas" aria-label={`${x.melhorEstrelas} de 3 estrelas conquistadas`}>
                  {[1, 2, 3].map((n) => <span key={n} className={n <= x.melhorEstrelas ? "rn-exp__estrela--ok" : ""} aria-hidden="true">★</span>)}
                </span>
                {x.pode && <span className="rn-exp__clique" aria-hidden="true">⚔️</span>}
              </button>
              <div className="rn-exp__info">
                <span className="rn-exp__tipo">{x.id === "planetoide" ? "📡 Radar da Nave · a próxima viagem" : `${x.emoji} ${x.lugar} · Torre ${x.torreMinima}+`}</span>
                <h3>{x.nome}{x.vezesHoje > 0 && x.id !== "planetoide" && <span className="rn-exp__vezes">{x.vezesHoje}× hoje</span>}</h3>
                <div className="rn-exp__nivel">
                  <span className={`rn-exp__dif rn-exp__dif--${x.dificuldade}`} title={`Dificuldade ${x.dificuldade} de 5`}>
                    <span aria-hidden="true">{"💀".repeat(x.dificuldade)}</span> {x.nomeDaDificuldade}
                  </span>
                  {x.forca && <span className={`rn-exp__forca${x.forca > 1 ? " rn-exp__forca--forte" : ""}`}>{x.emojiDaRaca} {x.nomeDaRaca} · força ×{String(x.forca).replace(".", ",")}</span>}
                  <span className="rn-exp__premio">Recompensa <Moedas n={x.recompensa} /></span>
                </div>
                <p className="pf-estat__nota">{x.descricao}{x.id === "planetoide" ? " Cada viagem cai num planetoide diferente — a raça, a força e o tesouro são sorteados." : ""}</p>
                <ul className="rn-exp__monstros" aria-label="Monstros">
                  {x.monstros.map((m) => (
                    <li key={m.tipo} title={m.nome}><img src={urlDoMonstro(m.tipo)} alt="" width="30" height="30" /><span>{m.quantidade}× {m.nome}</span></li>
                  ))}
                </ul>
                <div className="rn-exp__rodape">
                  <span className="rn-exp__saque"><small>100% destruído · ⭐⭐⭐ dá +{Math.round(BONUS_DE_TRES_ESTRELAS * 100)}%</small></span>
                  {x.pode ? (
                    <button type="button" className="pf-botao pf-botao--pequeno" disabled={Boolean(ocupado)} onClick={() => aoPartir(x)}>
                      {ocupado === `exp:${x.id}` ? "Partindo…" : x.id === "planetoide" ? "🚀 Decolar" : "⚔️ Atacar"}
                    </button>
                  ) : <span className="rn-motivo">{x.liberada ? x.motivo : `🔒 libera com a Torre nível ${x.torreMinima}`}</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {mapa?.recentes?.length > 0 && (
        <div className="pf-cartao rn-exp__recentes">
          <p className="pf-campo__rotulo" style={{ marginTop: 0 }}>Últimas expedições</p>
          <ul className="rn-batalhas">
            {mapa.recentes.map((x) => (
              <li key={x.id} className={x.estrelas ? "rn-batalha--ganhei" : "rn-batalha--perdi"}>
                <span className="rn-batalha__icone" aria-hidden="true">{x.estrelas ? (x.expedicao === "planetoide" ? "🪐" : "🗺️") : "💥"}</span>
                <span className="rn-batalha__texto">
                  <strong>{x.nome}</strong> — {x.estrelas ? `${estrelas(x.estrelas)}` : "recuou"}
                  <small>{x.destruicao}% destruído · {hora(x.quando)}</small>
                </span>
                {x.combate && <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno rn-batalha__ver" onClick={() => aoAssistir(x)}>▶ Assistir</button>}
                <span className="rn-batalha__saldo">{x.saque ? <>+🪙{numero(x.saque)}</> : null}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ResultadoDaExpedicao({ r, aoFechar }) {
  return (
    <div className={`pf-cartao rn-resultado ${r.saque ? "rn-resultado--venceu" : "rn-resultado--perdeu"}`} role="status">
      <div className="rn-resultado__titulo">{r.estrelas ? `${estrelas(r.estrelas)} Vitória!` : "💥 A expedição recuou"} — {r.expedicao.nome}{r.expedicao.forca && r.expedicao.forca !== 1 ? <small> (força ×{String(r.expedicao.forca).replace(".", ",")})</small> : null}</div>
      <p>
        {r.destruicao}% destruído. {r.saque ? `Você saqueou 🪙 ${numero(r.saque)} moedas.` : "Nada de saque desta vez."}{" "}
        {r.emprestado ? "A Tropa da Expedição voltou inteira para o próximo desafio" : "Todas as tropas voltaram para casa"}: expedição não gasta tropa nem moeda.
        {r.repartido ? ` 🕊️ Como o mundo está em paz, cada um dos outros reinos também ganhou 🪙 ${numero(r.repartido)}.` : ""}
      </p>
      <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={aoFechar}>Ok</button>
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
        {" "}{r.voltaram && Object.keys(r.voltaram).length ? `Voltaram para casa: ${descreverTropas(r.voltaram)}.` : "Nenhuma tropa sua voltou."}
        {r.perdas && Object.keys(r.perdas).length ? ` Caíram (treine de novo): ${descreverTropas(r.perdas)}.` : ""}
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
          <p>A Torre do Neuro é o coração do reino: nenhuma construção passa do nível dela, o Neuro chega no máximo ao dobro e nela moram as tropas de defesa. A Mina produz moedas sozinha até encher ({HORAS_ATE_ENCHER} h); a Mina de Ouro rende pepitas com os operários; o Cofre protege moedas que nenhuma invasão leva (e todas continuam podendo ser gastas); Torre de Arqueiros, Canhão e Muralha defendem; o Quartel treina o exército.</p>
        </details>
        <details>
          <summary>⚔️ Invasões</summary>
          <p>{ATAQUES_POR_DIA} invasões por dia, com o seu exército: só as tropas que caem precisam ser treinadas de novo — as que sobrevivem voltam para casa. Cada reino só pode ser invadido por você uma vez a cada {HORAS_ENTRE_ATAQUES_AO_MESMO_REINO / 24} dias, contando do ataque — e a conta é de cada lado: se alguém invadiu você, você pode revidar na hora. A batalha é de verdade: cada tropa e cada defesa luta sozinha, e você assiste na ilha. Estrelas: 50% destruído, a Torre do Neuro no chão e 100%. O saque é {Math.round(FATIA_DO_SAQUE * 100)}% das moedas fora do cofre vezes a destruição (até {TETO_DO_SAQUE}); os troféus seguem as estrelas. Toda batalha fica na lista para assistir de novo.</p>
        </details>
        <details>
          <summary>🗺️ Expedições</summary>
          <p>Contra a CPU — ninguém perde moedas nem troféus. <strong>É de graça:</strong> todas as tropas voltam para casa, então não há nada para treinar de novo. Os lugares liberam com a Torre do Neuro; cada um tem a sua dificuldade (de 💀 Fácil a 💀💀💀💀💀 Lendário), a sua recompensa e o seu cenário. O saque é proporcional à destruição (⭐⭐⭐ dá +{Math.round(BONUS_DE_TRES_ESTRELAS * 100)}%). Cada veículo leva a um tipo de lugar: o Barco Voador às vilas, florestas, bosques e acampamentos; o Submarino ao fundo do mar; o Dirigível às montanhas geladas; o Tanque de Magma aos reinos de fogo e lava; e a Nave Estelar a planetoides sorteados, com raças alienígenas de força e tesouro aleatórios.</p>
        </details>
        <details>
          <summary>🚗 Veículos e combustível</summary>
          <p>O Barco Voador é de todo mundo; os outros veículos se compram na garagem (cada um pede a Torre do Neuro num nível). Cada veículo tem o seu tanque: {CARGAS_POR_DIA} expedições por dia, e o tanque enche sozinho na virada do dia. Acabou? Abasteça com moedas — cada carga extra do dia custa um pouco mais, até {EXTRAS_POR_DIA} por veículo.</p>
        </details>
        <details>
          <summary>⚒️ Mina de Ouro e operários</summary>
          <p>Todo reino tem uma Mina de Ouro e nasce com {OPERARIOS_INICIAIS} operários. Cada operário tira 1 pepita a cada {HORAS_POR_PEPITA} h, e cada pepita vale {VALOR_DA_PEPITA} moedas na coleta — demora mais que a Mina de Moedas, mas vale mais. Contrate mais operários (cabem mais quanto maior a mina) e, se sobrar, ponha para alugar: quem aluga paga na hora e o operário trabalha {HORAS_DE_ALUGUEL} h na mina de quem alugou.</p>
        </details>
        <details>
          <summary>📈 Bolsa do Reino</summary>
          <p>Uma bolsa só, a mesma para todos. Todo dia, no primeiro acesso depois da meia-noite, a Lisa abre o pregão: decide quanto cada ação sobe ou cai (até {VARIACAO_MAXIMA}%), conta a notícia de cada uma e lança empresas novas. Compre e venda com as suas moedas; cada ordem paga {Math.round(TAXA_DA_CORRETAGEM * 100)}% de corretagem (no mínimo 1). Empresa que chega a {PRECO_MINIMO} moedas vai à falência e as ações viram pó; com mais de {MAXIMO_DE_ACOES} empresas, a mais antiga fecha o capital e paga o preço do dia a quem tem ações dela.</p>
        </details>
        <details>
          <summary>🕊️ Paz entre os reinos</summary>
          <p>Qualquer jogador pode propor a paz e escolher quantos dias ela dura ({DIAS_DE_PAZ.join(", ")}). Votam (e propõem) os reinos com {OFENSIVA_PARA_VOTAR}+ dias seguidos de ofensiva de estudo, conferidos na hora do voto; o voto de quem propôs já conta como sim. A paz só começa com 100% dos eleitores a favor — um único não derruba a proposta — e a votação fica aberta 3 dias. A paz vale para todos os reinos, inclusive os que não votaram. Durante a paz: nenhum reino invade outro, todos viram vizinhos no mundo 3D (toque numa ilha vizinha para ver o reino inteiro), a mina de cada reino rende vezes o número de reinos e, quando alguém saqueia uma expedição, cada um dos outros reinos ganha 20% do saque.</p>
        </details>
        <details>
          <summary>🛡️ Escudos</summary>
          <p>Reino novo nasce com {ESCUDO_DE_NOVATO_HORAS} h de escudo. Reino que cai ganha {ESCUDO_APOS_DERROTA_HORAS} h de escudo, para ninguém ser invadido sem parar. Atenção: <strong>atacar tira o seu escudo</strong>.</p>
        </details>
      </div>
    </section>
  );
}
