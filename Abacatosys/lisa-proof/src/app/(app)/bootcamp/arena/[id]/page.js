"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { obter, criar } from "@/lib/api.js";
import { useAviso } from "@/componentes/Pecas.js";
import { comemorar, reagir } from "@/componentes/Neuro.js";
import EditorDeCodigo from "@/componentes/codigo/EditorDeCodigo.js";
import { Avatar, BaiasPlanas, Cronometro, FluxoDoExercicio, ResultadoDosTestes, ROTULO_DA_ETAPA, StatusDoNpc, Insignias } from "@/componentes/bootcamp/Pecas.js";
import AvaliacaoAoVivo from "@/componentes/bootcamp/AvaliacaoAoVivo.js";
import { caminhoPadrao, CENARIOS, ORDEM_DOS_CENARIOS, NIVEIS_DO_TORNEIO } from "@/dominio/bootcamp.js";

const Escritorio3D = dynamic(() => import("@/componentes/bootcamp/Escritorio3D.js"), {
  ssr: false,
  loading: () => <div className="bc-escritorio bc-escritorio--carregando">Acendendo as luzes do escritório…</div>,
});

const estrelas = (d) => "★".repeat(d) + "☆".repeat(3 - d);
const guardado = (chave) => { try { return localStorage.getItem(chave) || ""; } catch { return ""; } };
const guardar = (chave, valor) => { try { localStorage.setItem(chave, valor); } catch { /* sem armazenamento: o rascunho vale só nesta visita */ } };

/**
 * A arena do Modo Bootcamp: o escritório de TI em 3D com as 8 baias, o painel de status, o desafio dos jurados e
 * a minha entrega, etapa por etapa do "Fluxo de Desenvolvimento do Exercício".
 */
export default function Arena() {
  const { id } = useParams();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [sem3d, setSem3d] = useState(false);
  const [escolhido, setEscolhido] = useState(null);
  const [Aviso, avisar] = useAviso();
  const campeaoAntes = useRef(null);
  const [cenario, setCenario] = useState(null); // o escolhido neste navegador ou, sem escolha, o do torneio
  const [aoVivo, setAoVivo] = useState(null);   // o número da rodada cuja avaliação está passando ao vivo
  const [cena, setCena] = useState(null);       // { palco, humores } da avaliação ao vivo, para o 3D
  const [revelados, setRevelados] = useState(null); // na avaliação ao vivo: quem já passou pela bancada
  const salvarRascunho = useRef(null);           // a baia registra aqui o "salvar o código do editor agora"
  const registrarRascunho = useCallback((f) => { salvarRascunho.current = f; }, []);

  const carregar = useCallback(() => obter(`/api/bootcamp/${id}`).then((d) => { setDados(d); setErro(""); }).catch((e) => setErro(e.message)), [id]);
  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => { if (dados && cenario === null) setCenario(guardado(`bootcamp:cenario:${id}`) || dados.torneio.cenario || "neon"); }, [dados, cenario, id]);
  const escolherCenario = (c) => { setCenario(c); guardar(`bootcamp:cenario:${id}`, c); };

  // a avaliação ao vivo começa sozinha, uma vez por rodada para cada pessoa (e dá para rever depois)
  useEffect(() => {
    const r = dados?.rodada;
    if (!r || r.status !== "avaliada" || !r.avaliacao?.participantes?.length || aoVivo) return;
    const chave = `bootcamp:visto:${id}:${r.numero}`;
    if (guardado(chave)) return;
    guardar(chave, "1");
    setRevelados(new Set());
    setAoVivo(r.numero);
  }, [dados, aoVivo, id]);
  const acabarAoVivo = useCallback(() => { setAoVivo(null); setCena(null); setRevelados(null); }, []);

  // com a rodada aberta, a arena se atualiza sozinha: os outros competidores andam pelo fluxo
  const aberta = dados?.rodada?.status === "aberta" || dados?.avaliando;
  useEffect(() => {
    if (!aberta) return undefined;
    const r = setInterval(() => { if (document.visibilityState === "visible") carregar(); }, dados?.avaliando ? 5000 : 15000);
    return () => clearInterval(r);
  }, [aberta, dados?.avaliando, carregar]);

  // o campeão aparece: festa (uma vez)
  useEffect(() => {
    const c = dados?.torneio?.campeaoId;
    if (!c || campeaoAntes.current === c) return;
    // na primeira carga, só festeja se a avaliação acabou de sair (e não a cada vez que abre a arena)
    if (campeaoAntes.current !== null || (dados.rodada?.avaliadaEm && Date.now() - new Date(dados.rodada.avaliadaEm).getTime() < 60_000)) {
      if (c === dados.eu?.id) comemorar("🏆 Você é o campeão do Bootcamp!");
    }
    campeaoAntes.current = c;
  }, [dados]);

  const agir = useCallback(async (corpo, rotulo) => {
    setOcupado(rotulo || corpo.acao);
    try {
      const r = await criar(`/api/bootcamp/${id}`, corpo);
      setDados(r);
      return r;
    } catch (e) {
      avisar(`Não deu: ${e.message}`);
      return null;
    } finally {
      setOcupado("");
    }
  }, [id, avisar]);

  // sem espera: entregou o último humano da prova (ou a prova é só dos personagens da CPU), os jurados entram sozinhos
  const chamouJurados = useRef(null);
  useEffect(() => {
    const r = dados?.rodada;
    if (!r || r.status !== "aberta" || !dados.todosEnviaram || !dados.podeChamarJurados || dados.avaliando || ocupado) return;
    if (chamouJurados.current === r.numero) return;
    chamouJurados.current = r.numero;
    setOcupado("jurados");
    // em silêncio: se outra pessoa chamou antes, a trava do servidor responde 409 e a arena só recarrega
    criar(`/api/bootcamp/${id}`, { acao: "jurados" }).then(setDados).catch(() => carregar()).finally(() => setOcupado(""));
  }, [dados, ocupado, id, carregar]);

  // a implementação começou: a página desce até o desafio e o editor (que ocupam a altura da tela)
  const areaDeTrabalho = useRef(null);
  const codandoAgora = dados?.rodada?.status === "aberta" && !dados?.eu?.eliminado && ["codigo", "testes"].includes(dados?.minhaEntrega?.etapa);
  useEffect(() => {
    if (!codandoAgora) return;
    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    areaDeTrabalho.current?.scrollIntoView({ behavior: semMovimento ? "auto" : "smooth", block: "start" });
  }, [codandoAgora]);

  if (erro && !dados) {
    return (
      <>
        <div className="pf-aviso pf-aviso--erro">{erro}</div>
        <Link href="/bootcamp" className="pf-botao pf-botao--sec">← Bootcamp</Link>
      </>
    );
  }
  if (!dados) return <p className="pf-estat__nota">Entrando no escritório…</p>;

  const { torneio, rodada, minhaEntrega, eu } = dados;
  // na avaliação ao vivo, a nota de ninguém aparece antes da vez dele (04/11/2026): até passar pela bancada, cada um
  // fica com os pontos, as insígnias e a situação de antes da prova (e o campeão só aparece no fim)
  const emAoVivo = Boolean(aoVivo && rodada?.numero === aoVivo && rodada.avaliacao?.participantes?.length);
  const naBancada = new Map((rodada?.avaliacao?.participantes || []).map((a) => [a.id, a]));
  const escondido = (pid) => emAoVivo && naBancada.has(pid) && !revelados?.has(pid);
  const participantes = dados.participantes.map((p) => {
    if (!escondido(p.id)) return p;
    const a = naBancada.get(p.id);
    const saiuAgora = p.eliminadoNa === rodada.numero;
    return {
      ...p, pontos: a.pontosAntes ?? (p.pontos - (rodada.prova?.tipo === "eliminacao" ? 0 : a.nota || 0)), nota: null, resultado: null, testes: null,
      etapa: "revisao", enviada: true, eliminado: saiuAgora ? false : p.eliminado, eliminadoNa: saiuAgora ? null : p.eliminadoNa,
      insignias: (p.insignias || []).filter((i) => i.numero !== rodada.numero),
    };
  });
  const campeaoVisivel = torneio.campeaoId && escondido(torneio.campeaoId) ? null : torneio.campeaoId;
  const dadosVisiveis = { ...dados, participantes, torneio: { ...torneio, campeaoId: campeaoVisivel } };
  const minhasInsignias = participantes.find((p) => p.souEu)?.insignias || eu?.insignias || [];
  const selecionado = participantes.find((p) => p.id === escolhido) || null;
  const prova = rodada?.prova;
  const codando = rodada?.status === "aberta" && Boolean(minhaEntrega) && !eu?.eliminado && ["codigo", "testes"].includes(minhaEntrega.etapa);
  const telao = {
    titulo: dados.final ? "GRANDE FINAL" : rodada ? `${prova?.emoji || ""} ${prova?.nome || "Rodada"} · ${rodada.numero} de ${torneio.rodadasTotal}`.trim() : torneio.status === "encerrado" ? "Temporada encerrada" : "Aguardando a 1ª prova",
    subtitulo: rodada?.desafio?.titulo || torneio.nome,
  };

  return (
    <div className="bc-pagina bc-pagina--arena">
      <div className="pf-cabecalho">
        <div>
          <h1>🏁 {torneio.nome}</h1>
          <p>{torneio.formatoNome}: {torneio.formatoDescricao}</p>
          <div className="bc-pilulas">
            <span className="pf-pilula">{torneio.formato === "temporada" ? "Prova" : "Rodada"} {torneio.rodadaAtual || 0} de {torneio.rodadasTotal}</span>
            {minhasInsignias.length > 0 && <span className="pf-pilula">suas insígnias: <Insignias lista={minhasInsignias} catalogo={dados.insignias} /></span>}
            <span className="pf-pilula">{torneio.participantes} competidores</span>
            <span className="pf-pilula">{torneio.linguagens?.modo === "jurados" ? "⚖️ linguagem dos jurados" : "🧰 linguagem livre"}</span>
            {torneio.contraCpu && <span className="pf-pilula">{NIVEIS_DO_TORNEIO[torneio.nivel]?.emoji} nível {torneio.nivelNome}</span>}
            {rodada?.status === "aberta" ? <Cronometro prazo={rodada.prazo} /> : <span className="pf-pilula">{torneio.tempoMin ? `⏱️ ${torneio.tempoMin} min por desafio` : "⏳ sem limite de tempo"}</span>}
          </div>
        </div>
        <div className="bc-cabecalho__acoes">
          <Link href={`/bootcamp/judges/${torneio.id}`} className="pf-botao pf-botao--sec">⚖️ Jurados</Link>
          <Link href="/bootcamp" className="pf-botao pf-botao--sec">← Bootcamp</Link>
        </div>
      </div>

      {torneio.plano && <LinhaDaTemporada plano={torneio.plano} atual={torneio.rodadaAtual} avaliada={rodada?.status === "avaliada"} />}

      {/* o palco: o escritório em 3D (e a avaliação ao vivo embaixo dele) ao lado da prova e do painel de status */}
      <div className="bc-palco-grade">
        <div className="bc-palco-grade__cena">
          {sem3d ? (
            <BaiasPlanas participantes={participantes} campeaoId={campeaoVisivel} aoEscolher={setEscolhido} />
          ) : (
            <div className="bc-cena3d">
              <Escritorio3D participantes={participantes} jurados={dados.jurados} apresentadora={dados.apresentadora} campeaoId={campeaoVisivel} telao={telao}
                avaliando={dados.avaliando} cenario={cenario || torneio.cenario} palco={cena?.palco} humores={cena?.humores} final={dados.final}
                aoEscolher={setEscolhido} aoFalhar={() => setSem3d(true)} />
              {/* data-so-olhar: trocar o cenário da própria tela vale também no modo espectador */}
              <label className="bc-cena3d__cenario" title={CENARIOS[cenario || torneio.cenario]?.descricao}>
                <span aria-hidden="true">{CENARIOS[cenario || torneio.cenario]?.emoji || "🎨"}</span>
                <select aria-label="Cenário do escritório" value={cenario || torneio.cenario} onChange={(e) => escolherCenario(e.target.value)} data-so-olhar>
                  {ORDEM_DOS_CENARIOS.map((c) => <option key={c} value={c}>{CENARIOS[c].nome}</option>)}
                </select>
              </label>
              {dados.final && <span className="bc-cena3d__final">🏆 arena especial da grande final</span>}
            </div>
          )}
          {aoVivo && rodada?.numero === aoVivo && rodada.avaliacao?.participantes?.length > 0 && (
            <AvaliacaoAoVivo key={aoVivo} avaliacao={rodada.avaliacao} participantes={participantes} jurados={dados.jurados}
              apresentadora={dados.apresentadora} insignias={dados.insignias} numero={rodada.numero} aoMudar={setCena} aoAcabar={acabarAoVivo} aoRevelar={setRevelados} />
          )}
          {selecionado && <Competidor p={participantes.find((p) => p.id === selecionado.id) || selecionado} dados={dadosVisiveis} aoFechar={() => setEscolhido(null)} />}
        </div>
        <aside className="bc-palco-grade__lado">
          {rodada && <ProvaAtual dados={dados} />}
          <Classificacao dados={dadosVisiveis} aoEscolher={setEscolhido} />
          {rodada?.confrontos?.length > 0 && (
            <section className="pf-cartao bc-confrontos">
              <h2 className="bc-lado__titulo">⚔️ Confrontos da rodada {rodada.numero}</h2>
              <ul>
                {rodada.confrontos.map((c) => (
                  <li key={c.a}>{c.nomeA} <span aria-hidden="true">×</span> {c.b ? c.nomeB : <em>folga: passa direto</em>}</li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      <Abertura dados={dados} ocupado={ocupado} agir={agir} />
      {dados.escolha && <EscolhaDoCapitao dados={dados} ocupado={ocupado} agir={agir} />}

      {rodada && (
        <div ref={areaDeTrabalho} className={`bc-arena bc-arena--${codando ? "codando" : "lendo"}`}>
          <div className="bc-arena__desafio"><Desafio rodada={rodada} /></div>
          <div className="bc-arena__trabalho">
            {rodada.status === "aberta" && eu && !eu.eliminado && minhaEntrega && (
              <MinhaEntrega key={`${rodada.numero}`} torneioId={torneio.id} dados={dados} entrega={minhaEntrega} ocupado={ocupado} agir={agir}
                setDados={setDados} setOcupado={setOcupado} avisar={avisar} aoRegistrarRascunho={registrarRascunho} />
            )}
            {rodada.status === "aberta" && eu?.salvo && (
              <p className="pf-aviso pf-aviso--ok">🛡️ Você está salvo desta prova: ela é de quem não se salvou na anterior. Assista e torça (ou secará?).</p>
            )}
            {rodada.status === "aberta" && eu?.eliminado && <p className="pf-aviso">Você saiu do torneio, mas pode acompanhar as provas e as notas dos jurados até o fim.</p>}
            {rodada.status === "aberta" && <ChamarJurados dados={dados} ocupado={ocupado} agir={agir} antesDeChamar={() => salvarRascunho.current?.()} />}
            {rodada.status === "avaliada" && (emAoVivo
              ? <p className="pf-aviso" role="status">⚖️ A avaliação está passando ao vivo: o resultado de cada um aparece na vez dele (ou tudo de uma vez, em ⏩ Pular tudo).</p>
              : <ResultadoDaRodada dados={dados} aoRever={aoVivo ? null : () => { setRevelados(new Set()); setAoVivo(rodada.numero); window.scrollTo({ top: 0, behavior: "smooth" }); }} />)}
          </div>
        </div>
      )}
      {Aviso}
    </div>
  );
}

/** A temporada inteira numa linha: cada prova (imunidade, equipe, eliminação, final), com a de agora acesa. */
function LinhaDaTemporada({ plano, atual, avaliada }) {
  return (
    <ol className="bc-temporada" aria-label="As provas da temporada">
      {plano.map((p) => {
        const estado = p.numero < atual || (p.numero === atual && avaliada) ? "feita" : p.numero === atual ? "agora" : "depois";
        return (
          <li key={p.numero} className={`bc-temporada__prova bc-temporada__prova--${estado} bc-temporada__prova--${p.tipo}`} title={`${p.nome} · episódio ${p.episodio}`}
            aria-current={estado === "agora" ? "step" : undefined}>
            <span aria-hidden="true">{p.emoji}</span>
            <small>{p.tipo === "final" ? "Final" : `Ep. ${p.episodio}`}</small>
          </li>
        );
      })}
    </ol>
  );
}

/** A prova de agora: o tipo, quem joga, quantos saem, as equipes e quem ficou salvo. */
function ProvaAtual({ dados }) {
  const { rodada, participantes } = dados;
  const prova = rodada.prova;
  const salvos = participantes.filter((p) => p.salvo);
  return (
    <section className={`pf-cartao bc-prova bc-prova--${prova.tipo}`}>
      <div className="bc-prova__topo">
        <span className="bc-prova__emoji" aria-hidden="true">{prova.emoji}</span>
        <div>
          <h2 className="bc-lado__titulo">{prova.nome}</h2>
          <span className="pf-estat__nota">{prova.tipo === "rodada" ? `Rodada ${rodada.numero}` : prova.tipo === "final" ? "A decisão" : `Episódio ${prova.episodio}`} · {prova.competidores.length} na prova{prova.sai ? ` · sai${prova.sai > 1 ? "em" : ""} ${prova.sai}` : ""}</span>
        </div>
      </div>
      <p className="bc-prova__descricao">{prova.descricao}</p>
      {prova.equipes?.length > 0 && (
        <div className="bc-equipes">
          {prova.equipes.map((e) => (
            <div key={e.id} className={`bc-equipe bc-time--${e.id}`}>
              <strong>{e.emoji} {e.nome}</strong>
              <span>{e.nomes.join(", ")}</span>
              {e.nomeDoCapitao && <small>capitão: {e.nomeDoCapitao}</small>}
            </div>
          ))}
        </div>
      )}
      {salvos.length > 0 && <p className="pf-estat__nota">🛡️ Salvos desta prova: {salvos.map((p) => (p.souEu ? "você" : p.nome)).join(", ")}</p>}
    </section>
  );
}

/** A prova em equipe no modo "capitão": o vencedor da última prova escolhe um membro; os outros esperam. */
function EscolhaDoCapitao({ dados, ocupado, agir }) {
  const { escolha } = dados;
  if (!escolha.souEu) {
    return <p className="pf-aviso">🤝 Prova em equipe: aguardando {escolha.nomeDoCapitao}, o vencedor da última prova, escolher um membro para o time. O resto será sorteado.</p>;
  }
  return (
    <section className="pf-cartao bc-escolha">
      <h2>🤝 Você é o capitão!</h2>
      <p className="pf-estat__nota">Como você venceu a última prova, escolha <strong>um</strong> competidor para o seu time. O resto dos times sai por sorteio, e a prova abre em seguida.</p>
      <div className="bc-escolha__grade">
        {escolha.disponiveis.map((p) => (
          <div key={p.id} className="bc-escolha__opcao">
            <Avatar p={{ ...p, eliminado: false }} tamanho={56} />
            <strong>{p.nome}{p.tipo === "npc" ? " 🤖" : ""}</strong>
            <StatusDoNpc status={p.status} especialidades={p.especialidades} catalogo={dados.especialidades} rotulos={dados.rotulosDeStatus} />
            <button type="button" className="pf-botao pf-botao--pequeno" disabled={Boolean(ocupado)} onClick={() => agir({ acao: "escolher-membro", membro: p.id }, "escolher")}>
              {ocupado === "escolher" ? "Montando os times…" : "Escolher para o meu time"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/** O que falta para a rodada começar: o organizador abre (os jurados lançam o desafio); os outros esperam. */
function Abertura({ dados, ocupado, agir }) {
  const { torneio, rodada, podeAbrirRodada } = dados;
  if (torneio.status === "encerrado") {
    const campeao = dados.participantes.find((p) => p.id === torneio.campeaoId);
    return campeao ? (
      <section className="pf-cartao bc-campeao">
        <Avatar p={campeao} campeaoId={torneio.campeaoId} tamanho={96} />
        <div>
          <h2>🏆 {campeao.souEu ? "Você é o campeão!" : `${campeao.nome} é o campeão!`}</h2>
          <p className="pf-estat__nota">{campeao.pontos} pontos na temporada. As notas de cada rodada estão no painel dos jurados.</p>
          <Link href={`/bootcamp/judges/${torneio.id}`} className="pf-botao pf-botao--pequeno">Ver o painel dos jurados</Link>
        </div>
      </section>
    ) : null;
  }
  if (rodada && rodada.status !== "avaliada") return null;
  if (dados.escolha) return null;
  const proxima = (torneio.rodadaAtual || 0) + 1;
  const nomeDaProxima = torneio.proxima ? `${torneio.proxima.emoji} ${torneio.proxima.nome}` : `rodada ${proxima}`;
  if (!podeAbrirRodada) {
    return <p className="pf-aviso">Aguardando o organizador abrir a próxima prova ({nomeDaProxima}): os jurados lançam o desafio quando ela abrir.</p>;
  }
  return (
    <section className="pf-cartao bc-abrir">
      <div>
        <h2>{rodada ? `Próxima: ${nomeDaProxima}` : `Tudo pronto no escritório: ${nomeDaProxima}`}</h2>
        <p className="pf-estat__nota">
          {torneio.proxima?.tipo === "equipe" && torneio.opcoes?.provaDeEquipe === "capitao" ? "O vencedor da última prova vai escolher um membro do time antes de começar. " : ""}
          Os 3 jurados lançam o desafio da prova {proxima} de {torneio.rodadasTotal}{torneio.linguagens?.modo === "jurados" ? " e estipulam a linguagem" : ""}. {torneio.tempoMin ? `O relógio de ${torneio.tempoMin} minutos começa na hora.` : "Sem limite de tempo."}
        </p>
      </div>
      <button type="button" className="pf-botao" disabled={Boolean(ocupado)} onClick={() => agir({ acao: "abrir-rodada" }, "abrir")}>
        {ocupado === "abrir" ? "Os jurados estão preparando o desafio…" : `🎬 Abrir: ${nomeDaProxima}`}
      </button>
    </section>
  );
}

/** O desafio dos jurados: as falas, o enunciado, a entrada e a saída, os requisitos e os exemplos. */
function Desafio({ rodada }) {
  const d = rodada.desafio;
  return (
    <section className="pf-cartao bc-desafio">
      <div className="bc-desafio__cabeca">
      <div className="bc-desafio__topo">
        <span className="pf-pilula">{rodada.prova && rodada.prova.tipo !== "rodada" ? `${rodada.prova.emoji} Prova` : "Rodada"} {rodada.numero}</span>
        <span className="pf-pilula" title="dificuldade">{estrelas(d.dificuldade)}</span>
        {d.linguagem && <span className="pf-pilula pf-pilula--verde">linguagem: {d.linguagem}</span>}
        {d.origem === "reserva" && <span className="pf-pilula" title="A IA dos jurados não respondeu e entrou um desafio do banco do Bootcamp">desafio do banco</span>}
      </div>
      <h2 className="bc-desafio__titulo">{d.titulo}</h2>
      </div>
      <div className="bc-desafio__texto">
      {Object.values(d.falas || {}).some(Boolean) && (
        <ul className="bc-falas">
          {["kernel", "vetor", "sintaxe"].map((j) => d.falas?.[j] && <li key={j}><strong>{j === "kernel" ? "⚙️ Kernel" : j === "vetor" ? "📐 Vetor" : "📜 Sintaxe"}:</strong> “{d.falas[j]}”</li>)}
        </ul>
      )}
      <p className="bc-desafio__enunciado">{d.enunciado}</p>
      <div className="bc-desafio__formato">
        <div><span className="pf-campo__rotulo">Entrada (stdin)</span><p>{d.formatoEntrada}</p></div>
        <div><span className="pf-campo__rotulo">Saída (stdout)</span><p>{d.formatoSaida}</p></div>
      </div>
      {d.requisitos?.length > 0 && (
        <>
          <span className="pf-campo__rotulo">Requisitos</span>
          <ul className="bc-desafio__requisitos">{d.requisitos.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </>
      )}
      {rodada.colaborativa && <DivisaoDoTime colaborativa={rodada.colaborativa} />}
      </div>
      <div className="bc-desafio__casos">
      <span className="pf-campo__rotulo">Exemplos</span>
      <div className="bc-exemplos">
        {d.exemplos.map((e, i) => (
          <div key={i} className="bc-exemplo">
            <div><small>entrada {d.exemplos.length > 1 ? i + 1 : ""}</small><pre>{e.entrada || "(vazia)"}</pre></div>
            <div><small>saída</small><pre>{e.saida}</pre></div>
          </div>
        ))}
      </div>
      <p className="pf-estat__nota">+ {d.ocultos} teste(s) oculto(s): os jurados só dizem se passou.</p>
      </div>
    </section>
  );
}

/** A prova colaborativa: as partes do programa, na ordem, e quem escreve cada uma no meu time. */
function DivisaoDoTime({ colaborativa }) {
  const meu = colaborativa.times.find((t) => t.meu) || null;
  const lista = meu?.divisao || colaborativa.times[0]?.divisao || [];
  return (
    <div className="bc-divisao">
      <span className="pf-campo__rotulo">🧩 {meu ? "A divisão do seu time" : "As partes do programa"}</span>
      <ol className="bc-divisao__lista">
        {lista.map((d) => (
          <li key={d.parte} className={`bc-divisao__parte${d.souEu ? " bc-divisao__parte--minha" : ""}`}>
            <code>{d.funcao}()</code>
            <div>
              <strong>{d.nome}</strong>
              {meu && <span className="bc-divisao__dono">{d.souEu ? "você" : d.nomeDoResponsavel}</span>}
              <p>{d.descricao}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="pf-estat__nota">A parte principal do time chama as funções nessa ordem e imprime: <code>{colaborativa.principal.split("\n").at(-1)}</code>. Na bancada, os jurados juntam o código de todos e rodam os testes no programa do time.</p>
    </div>
  );
}

/** A minha entrega, etapa por etapa do fluxo. */
function MinhaEntrega({ torneioId, dados, entrega, ocupado, agir, setDados, setOcupado, avisar, aoRegistrarRascunho }) {
  const { rodada, torneio, fluxo } = dados;
  const exigida = rodada.desafio.linguagem;
  const linguagens = torneio.linguagensDisponiveis;
  const chaveDoRascunho = `bootcamp:${torneioId}:${rodada.numero}`;
  const [plano, setPlano] = useState(entrega.plano || "");
  const [modo, setModo] = useState(entrega.modo || "editor");
  const [linguagem, setLinguagem] = useState(exigida || entrega.linguagem || linguagens[0]?.chave || "python");
  const [repo, setRepo] = useState(entrega.repo || "");
  const [caminho, setCaminho] = useState(entrega.caminho || "");
  const [codigo, setCodigo] = useState(() => guardado(chaveDoRascunho) || entrega.codigo || "");
  const [resultado, setResultado] = useState(entrega.testes?.length ? { testes: entrega.testes, resumo: entrega.resumo } : null);
  const [revendo, setRevendo] = useState(""); // "plano" | "ambiente": voltar uma etapa para mexer
  const etapa = entrega.etapa;

  const colaborativa = dados.rodada?.colaborativa || null;
  const modelo = useMemo(() => colaborativa?.modelo || linguagens.find((l) => l.chave === (entrega.linguagem || linguagem))?.modelo || "", [colaborativa, linguagens, entrega.linguagem, linguagem]);
  // o editor começa com o modelo da linguagem (lê a entrada e imprime), uma vez, se ainda não há código
  const preencheu = useRef(Boolean(codigo));
  useEffect(() => {
    if (preencheu.current || etapa !== "codigo" || entrega.modo !== "editor" || !modelo) return;
    preencheu.current = true;
    setCodigo(modelo);
  }, [etapa, entrega.modo, modelo]);
  useEffect(() => { if (codigo) guardar(chaveDoRascunho, codigo); }, [codigo, chaveDoRascunho]);

  // o rascunho também vai para o servidor (2,5 s depois da última tecla): se a prova fechar sem o envio, os
  // jurados testam e avaliam o último código, e não uma entrega vazia
  const codigoAtual = useRef(codigo);
  codigoAtual.current = codigo;
  const noServidor = useRef(entrega.codigo || "");
  const salvarNoServidor = useCallback(async () => {
    if (entrega.modo !== "editor" || !["codigo", "testes"].includes(etapa)) return;
    const atual = codigoAtual.current;
    if (atual === noServidor.current) return;
    try {
      await criar(`/api/bootcamp/${torneioId}`, { acao: "rascunho", codigo: atual });
      noServidor.current = atual;
    } catch { /* fica para a próxima pausa; o rascunho do navegador continua guardado */ }
  }, [entrega.modo, etapa, torneioId]);
  useEffect(() => {
    const r = setTimeout(salvarNoServidor, 2500);
    return () => clearTimeout(r);
  }, [codigo, salvarNoServidor]);
  useEffect(() => {
    aoRegistrarRascunho?.(salvarNoServidor);
    return () => aoRegistrarRascunho?.(null);
  }, [aoRegistrarRascunho, salvarNoServidor]);

  async function testar(enviar) {
    setOcupado(enviar ? "enviar" : "testar");
    try {
      const r = await criar("/api/bootcamp/challenge/submit", { torneioId, codigo: entrega.modo === "editor" ? codigo : undefined, enviar });
      if (entrega.modo === "editor") noServidor.current = codigo; // os testes gravam o código junto
      setDados(r);
      setResultado(r.resultado);
      if (r.resultado.enviada) comemorar("📨 Entrega enviada aos jurados!");
      else if (r.resultado.resumo.passou) reagir("feliz", "Passou em todos! Agora é enviar.", 3500);
      else reagir("pensando", "Não passou: de volta ao código.", 3500);
      if (enviar && !r.resultado.resumo.passou) avisar("Não passou em todos os testes: a entrega volta para o código.");
    } catch (e) {
      avisar(`Não deu: ${e.message}`);
    } finally {
      setOcupado("");
    }
  }

  const testadoIgual = entrega.modo === "github" || codigo === entrega.codigo;
  const podeEnviar = entrega.passou && etapa === "testes" && testadoIgual;
  // enviar roda os testes antes (se o código de agora ainda não passou): um clique só para entregar
  const temCodigo = entrega.modo === "github" || codigo.trim().length > 0;
  const mostrarPlano = etapa === "analise" || revendo === "plano";
  const mostrarAmbiente = etapa === "ambiente" || revendo === "ambiente";

  return (
    <section className="pf-cartao bc-entrega" aria-label="Minha entrega">
      <h2 className="bc-entrega__titulo">Sua baia</h2>
      <FluxoDoExercicio fluxo={fluxo} etapa={etapa} passou={entrega.passou} testou={entrega.tentativas > 0} />
      <p className="bc-entrega__etapa">{fluxo.find((e) => e.id === etapa)?.titulo}</p>

      {etapa === "leitura" && (
        <div className="bc-passo">
          <p>Leia o enunciado e os exemplos acima com calma. Quando entender o que os jurados pedem, siga para a análise.</p>
          <button type="button" className="pf-botao" disabled={Boolean(ocupado)} onClick={() => agir({ acao: "ler" })}>📖 Li o enunciado</button>
        </div>
      )}

      {mostrarPlano && (
        <div className="bc-passo">
          <label className="pf-campo">
            <span className="pf-campo__rotulo">Análise de requisitos e planejamento</span>
            <textarea className="pf-campo__entrada bc-plano" value={plano} onChange={(e) => setPlano(e.target.value)} maxLength={2000} rows={5}
              placeholder={"Os requisitos que entendi, os casos de borda e como vou resolver.\nEx.: ler N, guardar os números numa lista, somar só os pares; N = 1 e negativos são casos de borda."} />
          </label>
          <p className="pf-estat__nota">A Jurada Vetor lê o plano na hora de avaliar a arquitetura.</p>
          <div className="bc-passo__acoes">
            <button type="button" className="pf-botao" disabled={Boolean(ocupado)} onClick={async () => { if (await agir({ acao: "planejar", plano })) setRevendo(""); }}>🗺️ Salvar o plano{etapa === "analise" ? " e seguir" : ""}</button>
            {revendo === "plano" && <button type="button" className="pf-botao pf-botao--sec" onClick={() => setRevendo("")}>Cancelar</button>}
          </div>
        </div>
      )}

      {mostrarAmbiente && (
        <div className="bc-passo">
          <span className="pf-campo__rotulo">Formato de entrega do código</span>
          <div className="bc-opcoes" role="radiogroup" aria-label="Formato de entrega">
            <label className={`bc-opcao${modo === "editor" ? " bc-opcao--escolhida" : ""}`}>
              <input type="radio" name="modo" checked={modo === "editor"} onChange={() => setModo("editor")} />
              <strong>⌨️ Código direto na tela</strong>
              <span>No editor embutido aqui no navegador.</span>
            </label>
            {!colaborativa && (
              <label className={`bc-opcao${modo === "github" ? " bc-opcao--escolhida" : ""}`}>
                <input type="radio" name="modo" checked={modo === "github"} onChange={() => setModo("github")} />
                <strong>🐙 Código de projeto (GitHub)</strong>
                <span>Você faz commit e push num repositório público; os jurados leem o último commit.</span>
              </label>
            )}
          </div>
          <label className="pf-campo">
            <span className="pf-campo__rotulo">Linguagem</span>
            <select className="pf-campo__entrada" value={linguagem} onChange={(e) => setLinguagem(e.target.value)} disabled={Boolean(exigida)}>
              {linguagens.filter((l) => !exigida || l.chave === exigida).map((l) => <option key={l.chave} value={l.chave}>{l.rotulo}</option>)}
            </select>
          </label>
          {exigida && <p className="pf-estat__nota">Nesta rodada os jurados estipularam a linguagem.</p>}
          {modo === "github" && (
            <>
              <label className="pf-campo">
                <span className="pf-campo__rotulo">Repositório público do GitHub</span>
                <input className="pf-campo__entrada" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="https://github.com/voce/bootcamp" inputMode="url" />
              </label>
              <label className="pf-campo">
                <span className="pf-campo__rotulo">Arquivo da solução no repositório</span>
                <input className="pf-campo__entrada" value={caminho} onChange={(e) => setCaminho(e.target.value)} placeholder={caminhoPadrao(rodada.numero, linguagem)} />
              </label>
            </>
          )}
          <div className="bc-passo__acoes">
            <button type="button" className="pf-botao" disabled={Boolean(ocupado)}
              onClick={async () => { if (await agir({ acao: "ambiente", modo, linguagem, repo, caminho: caminho || caminhoPadrao(rodada.numero, linguagem) })) setRevendo(""); }}>
              🛠️ Configurar o ambiente
            </button>
            {revendo === "ambiente" && <button type="button" className="pf-botao pf-botao--sec" onClick={() => setRevendo("")}>Cancelar</button>}
          </div>
        </div>
      )}

      {(etapa === "codigo" || etapa === "testes") && !revendo && (
        <div className="bc-passo">
          <div className="bc-passo__ambiente">
            <span className="pf-pilula">{entrega.modo === "github" ? "🐙 GitHub" : "⌨️ Editor"}</span>
            <span className="pf-pilula">{linguagens.find((l) => l.chave === entrega.linguagem)?.rotulo || entrega.linguagem}</span>
            {colaborativa?.minhasPartes?.length > 0 && (
              <span className="pf-pilula pf-pilula--verde" title="Rodar os testes junta a sua parte com o gabarito das outras">🧩 sua parte: {colaborativa.minhasPartes.map((p) => `${p}()`).join(", ")}</span>
            )}
            <button type="button" className="bc-link" onClick={() => setRevendo("plano")}>rever o plano</button>
            <button type="button" className="bc-link" onClick={() => setRevendo("ambiente")}>trocar o ambiente</button>
          </div>
          {entrega.modo === "editor" ? (
            <EditorDeCodigo valor={codigo} aoMudar={setCodigo} linguagem={entrega.linguagem} desabilitado={Boolean(ocupado)} aoCtrlEnter={() => testar(false)}
              placeholder="Escreva a sua solução: leia do stdin e imprima no stdout." rotulo="Editor da solução do Bootcamp" />
          ) : (
            <div className="bc-github">
              <p>Os jurados leem <code>{entrega.caminho}</code> no último commit de <a href={entrega.repo} target="_blank" rel="noreferrer">{entrega.repo}</a>.</p>
              <pre className="bc-github__passos">{`git clone ${entrega.repo}\n# escreva a solução em ${entrega.caminho}\ngit add ${entrega.caminho}\ngit commit -m "bootcamp: rodada ${rodada.numero}"\ngit push`}</pre>
              {entrega.urlDoCommit && <p className="pf-estat__nota">Último commit testado: <a href={entrega.urlDoCommit} target="_blank" rel="noreferrer">{entrega.commitSha.slice(0, 7)}</a></p>}
            </div>
          )}
          <div className="bc-passo__acoes">
            <button type="button" className="pf-botao pf-botao--sec" disabled={Boolean(ocupado)} onClick={() => testar(false)}>
              {ocupado === "testar" ? "Rodando os testes…" : entrega.modo === "github" ? "🧪 Ler o último commit e rodar os testes" : "🧪 Rodar os testes"}
            </button>
            <button type="button" className="pf-botao" disabled={Boolean(ocupado) || !temCodigo} onClick={() => testar(true)}
              title={temCodigo ? undefined : "Escreva a solução antes de enviar"}>
              {ocupado === "enviar" ? (podeEnviar ? "Enviando…" : "Testando e enviando…") : podeEnviar ? "📨 Enviar para os jurados" : "📨 Testar e enviar para os jurados"}
            </button>
          </div>
          <p className="pf-estat__nota">
            {podeEnviar ? "Passou em todos os testes: é só enviar." : "Enviar roda os testes primeiro: se passar em todos, a entrega vai para os jurados; se não, volta para o código."}
            {entrega.modo === "editor" ? " O seu código fica salvo sozinho enquanto você digita." : ""}
          </p>
          {resultado && <ResultadoDosTestes testes={resultado.testes} resumo={resultado.resumo} />}
          {resultado && !resultado.resumo.passou && <p className="pf-aviso">Passou nos testes? <strong>Não.</strong> De volta à implementação: corrija e rode de novo.</p>}
        </div>
      )}

      {etapa === "revisao" && (
        <div className="bc-passo">
          <p className="pf-aviso pf-aviso--ok">📨 Entrega enviada ({entrega.resumo.passados}/{entrega.resumo.total} testes). Agora é com os jurados: eles avaliam quando todos enviarem, quando o tempo acabar ou quando o organizador encerrar a rodada.</p>
          {resultado && <ResultadoDosTestes testes={resultado.testes} resumo={resultado.resumo} />}
        </div>
      )}
    </section>
  );
}

/** Chamar os jurados: quando todos enviaram, quando o tempo acabou ou quando o organizador encerra. */
function ChamarJurados({ dados, ocupado, agir, antesDeChamar }) {
  const souDono = dados.torneio.souDono;
  if (dados.avaliando) return <p className="pf-aviso" role="status">⚖️ Os jurados estão avaliando a rodada…</p>;
  const euFaltando = Boolean(dados.minhaEntrega && !dados.minhaEntrega.enviadaEm);
  const antesDaHora = souDono && !dados.todosEnviaram && !dados.tempoAcabou;
  async function chamar() {
    if (antesDaHora && !window.confirm(euFaltando
      ? "Você ainda não enviou a sua entrega. Encerrar a prova mesmo assim? Os jurados rodam os testes no código que está no seu editor e avaliam do jeito que estiver."
      : "Nem todos enviaram. Encerrar a prova agora? Quem não enviou é avaliado pelo último código que escreveu.")) return;
    await antesDeChamar?.();
    await agir({ acao: "jurados" }, "jurados");
  }
  // antes da hora, encerrar é a exceção (e não o jeito de entregar): um cartão discreto, com o botão secundário
  if (antesDaHora) {
    return (
      <section className="pf-cartao bc-chamar bc-chamar--discreto">
        <div>
          <h2>⏹️ Encerrar a prova</h2>
          <p className="pf-estat__nota">
            {euFaltando
              ? "Para entregar, use “Testar e enviar” na sua baia: os jurados entram sozinhos depois do envio. Encerrar agora leva aos jurados o código do seu editor do jeito que estiver."
              : "Os jurados entram sozinhos quando todos enviarem. Como organizador, você pode encerrar antes: quem não enviou é avaliado pelo último código que escreveu."}
          </p>
        </div>
        <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={!dados.podeChamarJurados || Boolean(ocupado)} onClick={chamar}>
          {ocupado === "jurados" ? "Os jurados estão avaliando…" : "Encerrar a prova agora"}
        </button>
      </section>
    );
  }
  return (
    <section className="pf-cartao bc-chamar">
      <div>
        <h2>⚖️ Os jurados</h2>
        <p className="pf-estat__nota">
          {dados.todosEnviaram && !dados.participantes.some((p) => p.compete && p.tipo === "humano") ? "Esta prova é só dos personagens da CPU: os jurados entram sozinhos." : dados.todosEnviaram ? "Todos os humanos enviaram: os jurados podem entrar." : dados.tempoAcabou ? "O tempo acabou: os jurados podem entrar." : dados.motivoDosJurados || "O organizador pode encerrar a rodada a qualquer momento."}
        </p>
      </div>
      <button type="button" className="pf-botao" disabled={!dados.podeChamarJurados || Boolean(ocupado)} onClick={chamar}>
        {ocupado === "jurados" ? "Os jurados estão avaliando…" : "Chamar os jurados"}
      </button>
    </section>
  );
}

/** O fim da rodada: o comentário dos jurados, a minha nota e quem saiu. */
function ResultadoDaRodada({ dados, aoRever }) {
  const { rodada, participantes, torneio } = dados;
  const eu = participantes.find((p) => p.souEu);
  const nomes = new Map(participantes.map((p) => [p.id, p.souEu ? "você" : p.nome]));
  const saiu = rodada.avaliacao?.eliminados || [];
  const av = rodada.avaliacao || {};
  const prova = rodada.prova;
  const ameacados = (av.participantes || []).filter((a) => a.resultado === "ameacado").map((a) => nomes.get(a.id));
  const insigniaDoVencedor = (av.participantes || []).find((a) => a.insignia);
  const minha = (av.participantes || []).find((a) => a.id === eu?.id);
  const semCodigo = Boolean(minha) && !minha.testes?.total;
  return (
    <section className="pf-cartao bc-resultado">
      <h2>Resultado: {prova?.emoji} {prova?.nome || `rodada ${rodada.numero}`}</h2>
      {insigniaDoVencedor && (
        <p className="bc-resultado__vencedor">
          {dados.insignias?.[insigniaDoVencedor.insignia]?.emoji} {(av.vencedores || []).map((pid) => nomes.get(pid)).join(", ")} {av.vencedores?.length > 1 ? "venceram" : "venceu"} e {av.vencedores?.length > 1 ? "ganharam" : "ganhou"} a insígnia <strong>{dados.insignias?.[insigniaDoVencedor.insignia]?.nome}</strong>
        </p>
      )}
      {av.equipes?.length > 0 && (
        <div className="bc-equipes">
          {av.equipes.map((e) => (
            <div key={e.id} className={`bc-equipe bc-time--${e.id}${e.venceu ? " bc-equipe--venceu" : ""}`}>
              <strong>{e.emoji} {e.nome} · {e.nota}/100 {e.venceu ? "🏅" : ""}</strong>
              <span>{e.membros.map((pid) => nomes.get(pid)).join(", ")}</span>
              {e.integracao && <small>🧩 programa do time: {e.integracao.passados}/{e.integracao.total} testes{e.integracao.faltou.length ? ` · faltou a parte de ${e.integracao.faltou.join(", ")}` : ""}</small>}
            </div>
          ))}
        </div>
      )}
      {(av.salvos || []).length > 0 && <p className="pf-estat__nota">🛡️ Salvos da eliminação: {av.salvos.map((pid) => nomes.get(pid)).join(", ")}</p>}
      {ameacados.length > 0 && <p className="pf-estat__nota">🔥 Vão para a prova de eliminação: {ameacados.join(", ")}</p>}
      {rodada.avaliacao?.comentarioGeral && <p className="bc-resultado__comentario">“{rodada.avaliacao.comentarioGeral}”</p>}
      {eu && eu.nota !== null && eu.nota !== undefined && <p className="bc-resultado__nota">Sua nota: <strong>{eu.nota}</strong>/100 · {eu.pontos} pontos no torneio</p>}
      {semCodigo && <p className="pf-aviso">Nenhum código chegou aos jurados nesta prova: o editor estava vazio quando ela fechou. Na próxima, escreva a solução e use “Testar e enviar” na sua baia.</p>}
      {saiu.length > 0 && <p className="pf-estat__nota">Saíram nesta rodada: {saiu.map((id) => nomes.get(id)).join(", ")}.</p>}
      <div className="bc-passo__acoes">
        {aoRever && rodada.avaliacao?.participantes?.length > 0 && (
          <button type="button" className="pf-botao pf-botao--pequeno" data-so-olhar onClick={aoRever}>🎬 Ver a avaliação ao vivo</button>
        )}
        <Link href={`/bootcamp/judges/${torneio.id}`} className="pf-botao pf-botao--sec pf-botao--pequeno">Ver as notas e os feedbacks dos jurados</Link>
      </div>
    </section>
  );
}

/** A classificação, ao lado: quem está vivo, os pontos e a etapa de cada um. */
function Classificacao({ dados, aoEscolher }) {
  const lista = [...dados.participantes].sort((a, b) => (Number(a.eliminado) - Number(b.eliminado)) || (b.pontos - a.pontos) || (a.baia - b.baia));
  return (
    <section className="pf-cartao bc-classificacao">
      <h2 className="bc-lado__titulo">📋 Painel de status</h2>
      <ol>
        {lista.map((p) => (
          <li key={p.id} className={`${p.souEu ? "bc-eu" : ""}${p.eliminado ? " bc-fora" : ""}`}>
            <button type="button" className="bc-classificacao__item" onClick={() => aoEscolher(p.id)}>
              <Avatar p={p} campeaoId={dados.torneio.campeaoId} tamanho={30} />
              <span className="bc-classificacao__nome">
                <span className="bc-classificacao__texto">{p.souEu ? "Você" : p.nome}{p.tipo === "npc" ? " 🤖" : ""}</span>
                <Insignias lista={p.insignias} catalogo={dados.insignias} max={4} />
              </span>
              <span className="bc-classificacao__info">
                {p.eliminado ? `saiu na prova ${p.eliminadoNa}` : p.salvo ? "🛡️ salvo desta prova" : p.etapa ? ROTULO_DA_ETAPA[p.etapa] : "—"}
                {p.equipe && <span className={`bc-time-ponto bc-time--${p.equipe}`} aria-label={`time ${p.equipe}`} />}
              </span>
              <span className="bc-classificacao__pontos">{p.pontos}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** O cartão de quem foi tocado no escritório: personalidade, status e especialidades (CPU), insígnias, etapa e pontos. */
function Competidor({ p, dados, aoFechar }) {
  const campeaoId = dados.torneio.campeaoId;
  return (
    <section className="pf-cartao bc-competidor" aria-label={`Baia de ${p.nome}`}>
      <Avatar p={p} campeaoId={campeaoId} tamanho={72} />
      <div className="bc-competidor__texto">
        <strong>{p.souEu ? "Você" : p.nome} {p.tipo === "npc" ? <span className="pf-pilula">🤖 personagem da Lisa</span> : <span className="pf-pilula">humano</span>}</strong>
        {p.personalidade && <p className="pf-estat__nota">{p.personalidade}</p>}
        {p.bordao && <p><em>“{p.bordao}”</em></p>}
        <StatusDoNpc status={p.status} especialidades={p.especialidades} catalogo={dados.especialidades} rotulos={dados.rotulosDeStatus} />
        <Insignias lista={p.insignias} catalogo={dados.insignias} />
        {p.eliminado && <Link href={`/bootcamp/judges/${dados.torneio.id}#despedida-${encodeURIComponent(p.id)}`} className="bc-link">🎤 Ver a entrevista de despedida</Link>}
        <p className="pf-estat__nota">
          {p.eliminado ? `Eliminado na prova ${p.eliminadoNa}` : p.salvo ? "Salvo desta prova" : p.etapa ? `Agora: ${ROTULO_DA_ETAPA[p.etapa]}` : "Aguardando a prova"}
          {p.testes ? ` · testes ${p.testes.passados}/${p.testes.total}` : ""} · {p.pontos} pontos{p.nota !== null && p.nota !== undefined ? ` · última nota ${p.nota}` : ""}
        </p>
      </div>
      <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={aoFechar} aria-label="Fechar">✕</button>
    </section>
  );
}
