"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { obter, criar } from "@/lib/api.js";
import { useAviso } from "@/componentes/Pecas.js";
import { comemorar, reagir } from "@/componentes/Neuro.js";
import EditorDeCodigo from "@/componentes/codigo/EditorDeCodigo.js";
import { Avatar, BaiasPlanas, Cronometro, FluxoDoExercicio, ResultadoDosTestes, ROTULO_DA_ETAPA } from "@/componentes/bootcamp/Pecas.js";
import { caminhoPadrao } from "@/dominio/bootcamp.js";

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

  const carregar = useCallback(() => obter(`/api/bootcamp/${id}`).then((d) => { setDados(d); setErro(""); }).catch((e) => setErro(e.message)), [id]);
  useEffect(() => { carregar(); }, [carregar]);

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

  if (erro && !dados) {
    return (
      <>
        <div className="pf-aviso pf-aviso--erro">{erro}</div>
        <Link href="/bootcamp" className="pf-botao pf-botao--sec">← Bootcamp</Link>
      </>
    );
  }
  if (!dados) return <p className="pf-estat__nota">Entrando no escritório…</p>;

  const { torneio, participantes, rodada, minhaEntrega, eu } = dados;
  const selecionado = participantes.find((p) => p.id === escolhido) || null;
  const telao = {
    titulo: rodada ? `Rodada ${rodada.numero} de ${torneio.rodadasTotal}` : torneio.status === "encerrado" ? "Temporada encerrada" : "Aguardando a 1ª rodada",
    subtitulo: rodada?.desafio?.titulo || torneio.nome,
  };

  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>🏁 {torneio.nome}</h1>
          <p>{torneio.formatoNome}: {torneio.formatoDescricao}</p>
          <div className="bc-pilulas">
            <span className="pf-pilula">Rodada {torneio.rodadaAtual || 0} de {torneio.rodadasTotal}</span>
            <span className="pf-pilula">{torneio.participantes} competidores</span>
            <span className="pf-pilula">{torneio.linguagens?.modo === "jurados" ? "⚖️ linguagem dos jurados" : "🧰 linguagem livre"}</span>
            {rodada?.status === "aberta" ? <Cronometro prazo={rodada.prazo} /> : <span className="pf-pilula">{torneio.tempoMin ? `⏱️ ${torneio.tempoMin} min por desafio` : "⏳ sem limite de tempo"}</span>}
          </div>
        </div>
        <div className="bc-cabecalho__acoes">
          <Link href={`/bootcamp/judges/${torneio.id}`} className="pf-botao pf-botao--sec">⚖️ Jurados</Link>
          <Link href="/bootcamp" className="pf-botao pf-botao--sec">← Bootcamp</Link>
        </div>
      </div>

      {sem3d ? (
        <BaiasPlanas participantes={participantes} campeaoId={torneio.campeaoId} aoEscolher={setEscolhido} />
      ) : (
        <Escritorio3D participantes={participantes} jurados={dados.jurados} campeaoId={torneio.campeaoId} telao={telao}
          avaliando={dados.avaliando} aoEscolher={setEscolhido} aoFalhar={() => setSem3d(true)} />
      )}
      {selecionado && <Competidor p={selecionado} campeaoId={torneio.campeaoId} aoFechar={() => setEscolhido(null)} />}

      <div className="bc-arena">
        <div className="bc-arena__principal">
          <Abertura dados={dados} ocupado={ocupado} agir={agir} />
          {rodada && <Desafio rodada={rodada} />}
          {rodada?.status === "aberta" && eu && !eu.eliminado && minhaEntrega && (
            <MinhaEntrega key={`${rodada.numero}`} torneioId={torneio.id} dados={dados} entrega={minhaEntrega} ocupado={ocupado} agir={agir}
              setDados={setDados} setOcupado={setOcupado} avisar={avisar} />
          )}
          {rodada?.status === "aberta" && eu?.eliminado && <p className="pf-aviso">Você saiu do torneio, mas pode acompanhar a rodada e as notas dos jurados até o fim.</p>}
          {rodada?.status === "aberta" && <ChamarJurados dados={dados} ocupado={ocupado} agir={agir} />}
          {rodada?.status === "avaliada" && <ResultadoDaRodada dados={dados} />}
        </div>
        <aside className="bc-arena__lado">
          <Classificacao dados={dados} aoEscolher={setEscolhido} />
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
      {Aviso}
    </>
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
  const proxima = (torneio.rodadaAtual || 0) + 1;
  if (!podeAbrirRodada) {
    return <p className="pf-aviso">Aguardando o organizador abrir a rodada {proxima}: os jurados lançam o desafio quando ela abrir.</p>;
  }
  return (
    <section className="pf-cartao bc-abrir">
      <div>
        <h2>{rodada ? `Pronto para a rodada ${proxima}?` : "Tudo pronto no escritório"}</h2>
        <p className="pf-estat__nota">Os 3 jurados lançam o desafio da rodada {proxima} de {torneio.rodadasTotal}{torneio.linguagens?.modo === "jurados" ? " e estipulam a linguagem" : ""}. {torneio.tempoMin ? `O relógio de ${torneio.tempoMin} minutos começa na hora.` : "Sem limite de tempo."}</p>
      </div>
      <button type="button" className="pf-botao" disabled={Boolean(ocupado)} onClick={() => agir({ acao: "abrir-rodada" }, "abrir")}>
        {ocupado === "abrir" ? "Os jurados estão preparando o desafio…" : `🎬 Abrir a rodada ${proxima}`}
      </button>
    </section>
  );
}

/** O desafio dos jurados: as falas, o enunciado, a entrada e a saída, os requisitos e os exemplos. */
function Desafio({ rodada }) {
  const d = rodada.desafio;
  return (
    <section className="pf-cartao bc-desafio">
      <div className="bc-desafio__topo">
        <span className="pf-pilula">Rodada {rodada.numero}</span>
        <span className="pf-pilula" title="dificuldade">{estrelas(d.dificuldade)}</span>
        {d.linguagem && <span className="pf-pilula pf-pilula--verde">linguagem: {d.linguagem}</span>}
        {d.origem === "reserva" && <span className="pf-pilula" title="A IA dos jurados não respondeu e entrou um desafio do banco do Bootcamp">desafio do banco</span>}
      </div>
      <h2 className="bc-desafio__titulo">{d.titulo}</h2>
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
      <span className="pf-campo__rotulo">Exemplos</span>
      <div className="bc-exemplos">
        {d.exemplos.map((e, i) => (
          <div key={i} className="bc-exemplo">
            <div><small>entrada</small><pre>{e.entrada || "(vazia)"}</pre></div>
            <div><small>saída</small><pre>{e.saida}</pre></div>
          </div>
        ))}
      </div>
      <p className="pf-estat__nota">+ {d.ocultos} teste(s) oculto(s): os jurados só dizem se passou.</p>
    </section>
  );
}

/** A minha entrega, etapa por etapa do fluxo. */
function MinhaEntrega({ torneioId, dados, entrega, ocupado, agir, setDados, setOcupado, avisar }) {
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

  const modelo = useMemo(() => linguagens.find((l) => l.chave === (entrega.linguagem || linguagem))?.modelo || "", [linguagens, entrega.linguagem, linguagem]);
  // o editor começa com o modelo da linguagem (lê a entrada e imprime), uma vez, se ainda não há código
  const preencheu = useRef(Boolean(codigo));
  useEffect(() => {
    if (preencheu.current || etapa !== "codigo" || entrega.modo !== "editor" || !modelo) return;
    preencheu.current = true;
    setCodigo(modelo);
  }, [etapa, entrega.modo, modelo]);
  useEffect(() => { if (codigo) guardar(chaveDoRascunho, codigo); }, [codigo, chaveDoRascunho]);

  async function testar(enviar) {
    setOcupado(enviar ? "enviar" : "testar");
    try {
      const r = await criar("/api/bootcamp/challenge/submit", { torneioId, codigo: entrega.modo === "editor" ? codigo : undefined, enviar });
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
            <label className={`bc-opcao${modo === "github" ? " bc-opcao--escolhida" : ""}`}>
              <input type="radio" name="modo" checked={modo === "github"} onChange={() => setModo("github")} />
              <strong>🐙 Código de projeto (GitHub)</strong>
              <span>Você faz commit e push num repositório público; os jurados leem o último commit.</span>
            </label>
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
            <button type="button" className="pf-botao" disabled={Boolean(ocupado) || !podeEnviar} onClick={() => testar(true)}
              title={podeEnviar ? undefined : "Passe em todos os testes (com o código que está no editor) para enviar"}>
              {ocupado === "enviar" ? "Enviando…" : "📨 Enviar para a revisão dos jurados"}
            </button>
          </div>
          {entrega.passou && !testadoIgual && <p className="pf-estat__nota">O código mudou depois do último teste: rode os testes de novo para poder enviar.</p>}
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
function ChamarJurados({ dados, ocupado, agir }) {
  const souDono = dados.torneio.souDono;
  if (dados.avaliando) return <p className="pf-aviso" role="status">⚖️ Os jurados estão avaliando a rodada…</p>;
  async function chamar() {
    if (souDono && !dados.todosEnviaram && !dados.tempoAcabou
      && !window.confirm("Nem todos enviaram. Encerrar a rodada agora? Quem não enviou é avaliado pelo que testou até aqui.")) return;
    await agir({ acao: "jurados" }, "jurados");
  }
  return (
    <section className="pf-cartao bc-chamar">
      <div>
        <h2>⚖️ Os jurados</h2>
        <p className="pf-estat__nota">
          {dados.todosEnviaram ? "Todos os humanos enviaram: os jurados podem entrar." : dados.tempoAcabou ? "O tempo acabou: os jurados podem entrar." : dados.motivoDosJurados || "O organizador pode encerrar a rodada a qualquer momento."}
        </p>
      </div>
      <button type="button" className="pf-botao" disabled={!dados.podeChamarJurados || Boolean(ocupado)} onClick={chamar}>
        {ocupado === "jurados" ? "Os jurados estão avaliando…" : souDono && !dados.todosEnviaram && !dados.tempoAcabou ? "Encerrar a rodada e chamar os jurados" : "Chamar os jurados"}
      </button>
    </section>
  );
}

/** O fim da rodada: o comentário dos jurados, a minha nota e quem saiu. */
function ResultadoDaRodada({ dados }) {
  const { rodada, participantes, torneio } = dados;
  const eu = participantes.find((p) => p.souEu);
  const nomes = new Map(participantes.map((p) => [p.id, p.souEu ? "você" : p.nome]));
  const saiu = rodada.avaliacao?.eliminados || [];
  return (
    <section className="pf-cartao bc-resultado">
      <h2>Resultado da rodada {rodada.numero}</h2>
      {rodada.avaliacao?.comentarioGeral && <p className="bc-resultado__comentario">“{rodada.avaliacao.comentarioGeral}”</p>}
      {eu && eu.nota !== null && eu.nota !== undefined && <p className="bc-resultado__nota">Sua nota: <strong>{eu.nota}</strong>/100 · {eu.pontos} pontos no torneio</p>}
      {saiu.length > 0 && <p className="pf-estat__nota">Saíram nesta rodada: {saiu.map((id) => nomes.get(id)).join(", ")}.</p>}
      <Link href={`/bootcamp/judges/${torneio.id}`} className="pf-botao pf-botao--sec pf-botao--pequeno">Ver as notas e os feedbacks dos jurados</Link>
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
              <Avatar p={p} campeaoId={dados.torneio.campeaoId} tamanho={34} />
              <span className="bc-classificacao__nome">{p.souEu ? "Você" : p.nome}{p.tipo === "npc" ? " 🤖" : ""}</span>
              <span className="bc-classificacao__info">{p.eliminado ? `saiu na ${p.eliminadoNa}ª` : p.etapa ? ROTULO_DA_ETAPA[p.etapa] : "—"}</span>
              <span className="bc-classificacao__pontos">{p.pontos}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** O cartão de quem foi tocado no escritório: personalidade, etapa, testes e pontos. */
function Competidor({ p, campeaoId, aoFechar }) {
  return (
    <section className="pf-cartao bc-competidor" aria-label={`Baia de ${p.nome}`}>
      <Avatar p={p} campeaoId={campeaoId} tamanho={72} />
      <div className="bc-competidor__texto">
        <strong>{p.souEu ? "Você" : p.nome} {p.tipo === "npc" ? <span className="pf-pilula">🤖 personagem da Lisa</span> : <span className="pf-pilula">humano</span>}</strong>
        {p.personalidade && <p className="pf-estat__nota">{p.personalidade}</p>}
        {p.bordao && <p><em>“{p.bordao}”</em></p>}
        <p className="pf-estat__nota">
          {p.eliminado ? `Eliminado na rodada ${p.eliminadoNa}` : p.etapa ? `Agora: ${ROTULO_DA_ETAPA[p.etapa]}` : "Aguardando a rodada"}
          {p.testes ? ` · testes ${p.testes.passados}/${p.testes.total}` : ""} · {p.pontos} pontos{p.nota !== null && p.nota !== undefined ? ` · última nota ${p.nota}` : ""}
        </p>
      </div>
      <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={aoFechar} aria-label="Fechar">✕</button>
    </section>
  );
}
