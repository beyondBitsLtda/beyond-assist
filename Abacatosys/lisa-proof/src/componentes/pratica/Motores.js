"use client";

// As telas dos cursos que não são de programação (pedido de 30/10/2026): o seletor do tipo de
// curso, o desafio aberto, a lista de cálculo, o ditado, o treino de ouvido e a entrega por
// evidências (texto, fotos, áudio e vídeo do YouTube) — esta última também nos projetos. As regras
// moram em src/dominio/motores.js e src/dominio/perfis.js; o servidor corrige, a tela só mostra.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { criar } from "@/lib/api.js";
import { formatarDia } from "@/dominio/datas.js";
import { podeReenviar } from "@/dominio/pratica.js";
import { PERFIS, ORDEM_DOS_PERFIS } from "@/dominio/perfis.js";
import { EVIDENCIAS, LIMITES_DA_EVIDENCIA, MOTORES, desembaralhar, videoDoYoutube } from "@/dominio/motores.js";
import { analisar, lerResposta, FORMAS } from "@/dominio/expressao.js";
import Explicacao, { emLinha } from "../Explicacao.js";
import { reagir, comemorar, celebrar } from "../Neuro.js";
import { useAviso } from "../Pecas.js";
import { Avaliacao, reagirAEntrega } from "./Retorno.js";
import { PedirRevisao } from "./RevisaoDaTurma.js";

// ================================================================ o tipo de curso

/** Os cinco perfis, para escolher na criação do curso e trocar na tela da trilha. */
export function SeletorDePerfil({ valor, aoMudar, desabilitado = false }) {
  return (
    <div className="perfil-curso">
      <div className="pf-dias perfil-curso__opcoes" role="radiogroup" aria-label="Tipo de curso">
        {ORDEM_DOS_PERFIS.map((p) => (
          <button key={p} type="button" role="radio" className="pf-dia" aria-checked={valor === p} aria-pressed={valor === p}
            disabled={desabilitado} onClick={() => aoMudar(p)}>
            <span aria-hidden="true">{PERFIS[p].emoji}</span> {PERFIS[p].nome}
          </button>
        ))}
      </div>
      {PERFIS[valor] && <small className="pf-estat__nota" style={{ margin: 0 }}>{PERFIS[valor].descricao}</small>}
    </div>
  );
}

// ================================================================ cabeçalho comum dos motores

export function Cabecalho({ desafio, children }) {
  const motor = MOTORES[desafio.motor];
  return (
    <div className="pf-cartao">
      <div className="pf-assunto__chips">
        <span className="pf-pilula pf-pilula--tema">{desafio.tema}</span>
        {motor && <span className="pf-pilula">{motor.icone} {motor.nome}</span>}
        <span className="pf-pilula">{formatarDia(desafio.periodo, { comSemana: true })}</span>
        {motor?.tentativas === 1 && <span className="pf-pilula pf-pilula--atencao">uma tentativa, como o quiz</span>}
      </div>
      {children}
    </div>
  );
}

/** A reação de um motor corrigido no servidor (uma tentativa só): festa, pontos e o gabarito. */
export function reagirACorrecao(r, avisar) {
  const festejou = celebrar(r);
  if (r.nota === 100) comemorar(`Nota máxima! ${r.pontos > 0 ? `+${r.pontos} pontos` : ""} 🎉`);
  else if (r.avaliacao.aprovado) { if (!festejou) comemorar(`Aprovado com ${r.nota}! ${r.pontos > 0 ? `+${r.pontos} pontos` : ""}`); }
  else reagir("triste", "Não foi dessa vez — veja o gabarito e tente outra rodada na Prática.", 6000);
  if (r.pontos > 0 && !r.avaliacao.aprovado) avisar(`+${r.pontos} pontos`);
}

export function Rodape({ concluido, rodada, maxRodadas }) {
  if (!concluido) return null;
  return (
    <div className="pf-acoes" style={{ alignItems: "center" }}>
      <Link className="pf-botao" href="/pratica">Voltar à prática</Link>
      {(rodada || 1) < (maxRodadas || 1) && (
        <span className="pf-estat__nota" style={{ margin: 0 }}>Na Prática dá para fazer mais {(maxRodadas || 1) - (rodada || 1)} hoje, valendo metade dos pontos.</span>
      )}
    </div>
  );
}

// ================================================================ lista de cálculo

/** O que a pessoa digitou dá para ler? (Antes de enviar, para não perder a tentativa por um parêntese.) */
function leitura(item, valor) {
  if (!String(valor || "").trim()) return "";
  try {
    if (item.tipo === "numero") lerResposta(valor);
    else analisar(valor, item.variavel || "x");
    return "";
  } catch (e) {
    return e.message;
  }
}

export function ListaDeCalculo({ desafio }) {
  const c = desafio.conteudo;
  const [respostas, setRespostas] = useState(() => c.itens.map((_, i) => desafio.resposta?.respostas?.[i] || ""));
  const [resultado, setResultado] = useState(desafio.status === "concluido"
    ? { conteudo: c, correcao: desafio.resposta?.correcao, avaliacao: desafio.avaliacao, nota: desafio.nota } : null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [Aviso, avisar] = useAviso();
  const itens = resultado?.conteudo?.itens || c.itens;
  const problemas = c.itens.map((it, i) => leitura(it, respostas[i]));
  const vazias = respostas.filter((r) => !String(r).trim()).length;

  async function enviar(e) {
    e.preventDefault();
    if (vazias && !window.confirm(`${vazias} item(ns) sem resposta. Corrigir assim mesmo? É uma tentativa só.`)) return;
    setEnviando(true);
    setErro("");
    try {
      const r = await criar(`/api/desafios/${desafio.id}/enviar`, { respostas });
      setResultado({ conteudo: r.conteudo, correcao: r.resposta.correcao, avaliacao: r.avaliacao, nota: r.nota });
      reagirACorrecao(r, avisar);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="desafio">
      <Cabecalho desafio={desafio}>
        {c.instrucoes && <p className="desafio__texto" style={{ marginBottom: 0 }}>{emLinha(c.instrucoes)}</p>}
        <p className="pf-estat__nota" style={{ margin: 0 }}>
          Escreva em texto simples: <code>x^2</code> para potência, <code>sqrt(2)</code> para raiz, <code>3/4</code> para fração; número com vírgula ou ponto.
        </p>
      </Cabecalho>
      <form className="pf-cartao motor" onSubmit={enviar}>
        <ol className="motor__itens">
          {itens.map((it, i) => {
            const certo = resultado?.correcao?.itens?.[i];
            return (
              <li key={i} className={certo ? (certo.certo ? "motor__item--certo" : "motor__item--errado") : undefined}>
                <Explicacao texto={it.pergunta} className="desafio__texto" />
                <label className="pf-campo">
                  <span className="sr-only">Resposta do item {i + 1}</span>
                  <input className="pf-campo__entrada motor__entrada" value={respostas[i]} disabled={Boolean(resultado) || enviando}
                    onChange={(ev) => setRespostas((rs) => rs.map((r, k) => (k === i ? ev.target.value : r)))}
                    placeholder={it.tipo === "numero" ? "o número" : `uma expressão em ${it.variavel || "x"}`} autoComplete="off" spellCheck={false} />
                </label>
                {!resultado && it.forma && it.forma !== "livre" && <small className="pf-estat__nota">Forma pedida: {FORMAS[it.forma]}.</small>}
                {!resultado && problemas[i] && <small className="motor__aviso">Ainda não dá para ler: {problemas[i]}.</small>}
                {certo && (
                  <div className="motor__correcao">
                    <strong>{certo.certo ? "✓ Certo" : "✗ Errado"}</strong>{certo.motivo ? ` — ${certo.motivo}` : ""}
                    {it.resposta && <div>Resposta: <code>{it.resposta}</code></div>}
                    {it.explicacao && <p>{emLinha(it.explicacao)}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
        {!resultado && (
          <div className="pf-acoes">
            <button type="submit" className="pf-botao" disabled={enviando || vazias === respostas.length}>
              {enviando ? "Corrigindo…" : "Corrigir a lista"}
            </button>
          </div>
        )}
        <Rodape concluido={Boolean(resultado)} rodada={desafio.rodada} maxRodadas={desafio.maxRodadas} />
      </form>
      {resultado && <Avaliacao avaliacao={resultado.avaliacao} nota={resultado.nota} />}
      {Aviso}
    </div>
  );
}

// ================================================================ ditado

function falar(texto, idioma, velocidade = 0.92) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = idioma;
  u.rate = velocidade;
  const vozes = window.speechSynthesis.getVoices();
  const voz = vozes.find((v) => v.lang?.replace("_", "-") === idioma) || vozes.find((v) => v.lang?.slice(0, 2) === idioma.slice(0, 2));
  if (voz) u.voice = voz;
  window.speechSynthesis.speak(u);
  return true;
}

export function Ditado({ desafio }) {
  const c = desafio.conteudo;
  const textoDe = (f) => f.texto || desembaralhar(f.fala);
  const [respostas, setRespostas] = useState(() => c.frases.map((_, i) => desafio.resposta?.respostas?.[i] || ""));
  const [resultado, setResultado] = useState(desafio.status === "concluido"
    ? { conteudo: c, correcao: desafio.resposta?.correcao, avaliacao: desafio.avaliacao, nota: desafio.nota } : null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [semVoz, setSemVoz] = useState(false);
  const [vozDoIdioma, setVozDoIdioma] = useState(true);
  const [Aviso, avisar] = useAviso();
  const frases = resultado?.conteudo?.frases || c.frases;

  useEffect(() => {
    if (!("speechSynthesis" in window)) { setSemVoz(true); return undefined; }
    const conferir = () => {
      const vozes = window.speechSynthesis.getVoices();
      if (vozes.length) setVozDoIdioma(vozes.some((v) => v.lang?.slice(0, 2) === c.idioma.slice(0, 2)));
    };
    conferir();
    window.speechSynthesis.addEventListener?.("voiceschanged", conferir);
    return () => { window.speechSynthesis.removeEventListener?.("voiceschanged", conferir); window.speechSynthesis.cancel(); };
  }, [c.idioma]);

  async function enviar(e) {
    e.preventDefault();
    const vazias = respostas.filter((r) => !r.trim()).length;
    if (vazias && !window.confirm(`${vazias} frase(s) sem resposta. Corrigir assim mesmo? É uma tentativa só.`)) return;
    setEnviando(true);
    setErro("");
    try {
      const r = await criar(`/api/desafios/${desafio.id}/enviar`, { respostas });
      setResultado({ conteudo: r.conteudo, correcao: r.resposta.correcao, avaliacao: r.avaliacao, nota: r.nota });
      reagirACorrecao(r, avisar);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="desafio">
      <Cabecalho desafio={desafio}>
        <p className="desafio__texto" style={{ margin: 0 }}>
          Ouça cada frase e escreva o que entendeu. Pontuação e maiúsculas não contam; acento errado vale meio ponto.
        </p>
        {semVoz && <div className="pf-aviso pf-aviso--erro">Este navegador não tem voz sintetizada. Abra o Proof no Chrome, no Edge ou no Safari para fazer o ditado.</div>}
        {!semVoz && !vozDoIdioma && <div className="pf-aviso">Este aparelho não tem uma voz instalada para {c.idioma}: a frase vai sair com a voz padrão, com sotaque. No celular, instale a voz do idioma nas configurações de acessibilidade.</div>}
      </Cabecalho>
      <form className="pf-cartao motor" onSubmit={enviar}>
        <ol className="motor__itens">
          {frases.map((f, i) => {
            const correcao = resultado?.correcao?.frases?.[i];
            return (
              <li key={i} className={correcao ? (correcao.nota >= 0.999 ? "motor__item--certo" : "motor__item--errado") : undefined}>
                <div className="pf-acoes">
                  <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={semVoz} onClick={() => falar(textoDe(f), c.idioma)}>▶ Ouvir</button>
                  <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={semVoz} onClick={() => falar(textoDe(f), c.idioma, 0.6)}>🐢 Devagar</button>
                </div>
                <label className="pf-campo">
                  <span className="sr-only">Frase {i + 1}</span>
                  <input className="pf-campo__entrada" value={respostas[i]} disabled={Boolean(resultado) || enviando} lang={c.idioma}
                    onChange={(ev) => setRespostas((rs) => rs.map((r, k) => (k === i ? ev.target.value : r)))}
                    placeholder={`Frase ${i + 1}`} autoComplete="off" autoCapitalize="off" spellCheck={false} />
                </label>
                {correcao && (
                  <div className="motor__correcao">
                    <div className="ditado__palavras" lang={c.idioma}>
                      {correcao.palavras.map((p, k) => (
                        <span key={k} className={`ditado__palavra ditado__palavra--${p.marca}`} title={p.marca === "ok" ? "certa" : p.marca === "acento" ? "acento diferente" : "faltou ou escreveu diferente"}>{p.palavra}</span>
                      ))}
                    </div>
                    <div>{Math.round(correcao.nota * 100)}% · <span lang={c.idioma}>{f.texto}</span></div>
                    {f.traducao && <small className="pf-estat__nota">{f.traducao}</small>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
        {!resultado && (
          <div className="pf-acoes">
            <button type="submit" className="pf-botao" disabled={enviando || respostas.every((r) => !r.trim())}>{enviando ? "Corrigindo…" : "Corrigir o ditado"}</button>
          </div>
        )}
        <Rodape concluido={Boolean(resultado)} rodada={desafio.rodada} maxRodadas={desafio.maxRodadas} />
      </form>
      {resultado && <Avaliacao avaliacao={resultado.avaliacao} nota={resultado.nota} />}
      {Aviso}
    </div>
  );
}

// ================================================================ treino de ouvido

let contextoDeAudio = null;
/** O contexto de áudio da página (um só, reaproveitado), já acordado; null se o navegador não toca som. */
export function audioDaPagina() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  contextoDeAudio = contextoDeAudio || new Ctx();
  if (contextoDeAudio.state === "suspended") contextoDeAudio.resume();
  return contextoDeAudio;
}
export function tocarNotas(notas, modo) {
  if (!audioDaPagina()) return false;
  const t0 = contextoDeAudio.currentTime + 0.05;
  const nota = (midi, inicio, dur) => {
    const osc = contextoDeAudio.createOscillator();
    const ganho = contextoDeAudio.createGain();
    osc.type = "triangle";
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    ganho.gain.setValueAtTime(0.0001, inicio);
    ganho.gain.exponentialRampToValueAtTime(0.3 / Math.max(1, notas.length * 0.6), inicio + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
    osc.connect(ganho).connect(contextoDeAudio.destination);
    osc.start(inicio);
    osc.stop(inicio + dur + 0.05);
  };
  if (modo === "harmonico") {
    notas.forEach((m) => nota(m, t0, 1.4));               // juntas
    notas.forEach((m, i) => nota(m, t0 + 1.6 + i * 0.5, 0.6)); // e depois uma a uma, para conferir
  } else {
    notas.forEach((m, i) => nota(m, t0 + i * 0.85, 0.9));
  }
  return true;
}

export function TreinoDeOuvido({ desafio }) {
  const c = desafio.conteudo;
  const inicial = (desafio.resposta?.respostas || []).map((r) => (r === "" ? null : Number(r)));
  const [respostas, setRespostas] = useState(() => c.itens.map((_, i) => (Number.isInteger(inicial[i]) ? inicial[i] : null)));
  const [resultado, setResultado] = useState(desafio.status === "concluido"
    ? { conteudo: c, correcao: desafio.resposta?.correcao, avaliacao: desafio.avaliacao, nota: desafio.nota } : null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [Aviso, avisar] = useAviso();
  const itens = resultado?.conteudo?.itens || c.itens;

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      const r = await criar(`/api/desafios/${desafio.id}/enviar`, { respostas: respostas.map((x) => (x == null ? "" : x)) });
      setResultado({ conteudo: r.conteudo, correcao: r.resposta.correcao, avaliacao: r.avaliacao, nota: r.nota });
      reagirACorrecao(r, avisar);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setEnviando(false);
    }
  }

  const faltam = respostas.filter((x) => x == null).length;
  return (
    <div className="desafio">
      <Cabecalho desafio={desafio}>
        <p className="desafio__texto" style={{ margin: 0 }}>
          {c.categoria === "acordes"
            ? "Cada item toca um acorde (junto e depois nota a nota). Escolha o tipo."
            : "Cada item toca duas notas. Escolha o intervalo entre elas."} Use fone de ouvido se puder.
        </p>
      </Cabecalho>
      <form className="pf-cartao motor" onSubmit={enviar}>
        <ol className="motor__itens">
          {itens.map((it, i) => {
            const correcao = resultado?.correcao?.itens?.[i];
            return (
              <li key={i} className={correcao ? (correcao.certo ? "motor__item--certo" : "motor__item--errado") : undefined}>
                <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => { if (!tocarNotas(it.notas, it.modo)) setErro("este navegador não toca som"); }}>▶ Ouvir</button>
                <div className="motor__opcoes" role="radiogroup" aria-label={`Item ${i + 1}`}>
                  {c.opcoes.map((o, k) => {
                    let classe = "motor__opcao";
                    if (resultado && it.correta === k) classe += " motor__opcao--certa";
                    else if (resultado && respostas[i] === k) classe += " motor__opcao--errada";
                    return (
                      <button key={o} type="button" role="radio" aria-checked={respostas[i] === k} className={classe}
                        disabled={Boolean(resultado) || enviando} onClick={() => setRespostas((rs) => rs.map((r, n) => (n === i ? k : r)))}>
                        {o}
                      </button>
                    );
                  })}
                </div>
                {correcao && !correcao.certo && <small className="pf-estat__nota">{correcao.motivo}</small>}
              </li>
            );
          })}
        </ol>
        {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
        {!resultado && (
          <div className="pf-acoes" style={{ alignItems: "center" }}>
            <button type="submit" className="pf-botao" disabled={enviando || faltam > 0}>{enviando ? "Corrigindo…" : "Corrigir"}</button>
            {faltam > 0 && <span className="pf-estat__nota" style={{ margin: 0 }}>Falta responder {faltam}.</span>}
          </div>
        )}
        <Rodape concluido={Boolean(resultado)} rodada={desafio.rodada} maxRodadas={desafio.maxRodadas} />
      </form>
      {resultado && <Avaliacao avaliacao={resultado.avaliacao} nota={resultado.nota} />}
      {Aviso}
    </div>
  );
}

// ================================================================ desafio aberto

export function DesafioAberto({ desafio }) {
  const c = desafio.conteudo;
  return (
    <div className="desafio">
      <Cabecalho desafio={desafio}>
        <Explicacao texto={c.enunciado} className="desafio__texto" />
        {c.entrega && (
          <>
            <p className="pf-campo__rotulo">O que mandar</p>
            <p style={{ margin: 0 }}>{emLinha(c.entrega)}</p>
          </>
        )}
        {c.dicas?.length > 0 && (
          <div className="desafio__dicas">
            {c.dicas.map((d, i) => <details key={i}><summary>Dica {i + 1}</summary><p>{emLinha(d)}</p></details>)}
          </div>
        )}
        {c.criterios?.length > 0 && (
          <>
            <p className="pf-campo__rotulo">Como a Lisa vai corrigir</p>
            <ul className="avaliacao__simples">{c.criterios.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </>
        )}
      </Cabecalho>
      <EntregaComEvidencias desafio={desafio} aceitas={c.evidencias || ["texto"]} />
    </div>
  );
}

// ================================================================ a entrega por evidências

/** A foto reduzida (o lado maior com `lado` px), em JPEG: leve no celular e legível para a IA. */
export async function reduzirImagem(arquivo, lado, qualidade) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error("não deu para abrir esta imagem"));
      i.src = url;
    });
    const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", qualidade));
    return { blob, miniatura: lado <= 320 ? canvas.toDataURL("image/jpeg", qualidade) : null };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Qualquer áudio (gravado pela tela ou um arquivo) vira WAV mono de 16 kHz: é o formato que o Gemini
 * lê (o WebM do Chrome não) e 32 KB por segundo cabem folgados no envio.
 */
async function paraWav(blob, maximoDeSegundos) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const contexto = new Ctx();
  let audio;
  try {
    audio = await contexto.decodeAudioData(await blob.arrayBuffer());
  } catch {
    throw new Error("não deu para ler este áudio — grave pela própria tela ou mande MP3, M4A ou WAV");
  } finally {
    contexto.close?.();
  }
  if (audio.duration > maximoDeSegundos + 0.5) throw new Error(`o áudio tem ${Math.round(audio.duration)} s — o máximo aqui é ${maximoDeSegundos} s`);
  const taxa = 16_000;
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(audio.duration * taxa)), taxa);
  const fonte = offline.createBufferSource();
  fonte.buffer = audio;
  fonte.connect(offline.destination);
  fonte.start();
  const pcm = (await offline.startRendering()).getChannelData(0);
  const dados = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const escrever = (p, s) => { for (let i = 0; i < s.length; i++) dados.setUint8(p + i, s.charCodeAt(i)); };
  escrever(0, "RIFF"); dados.setUint32(4, 36 + pcm.length * 2, true); escrever(8, "WAVE");
  escrever(12, "fmt "); dados.setUint32(16, 16, true); dados.setUint16(20, 1, true); dados.setUint16(22, 1, true);
  dados.setUint32(24, taxa, true); dados.setUint32(28, taxa * 2, true); dados.setUint16(32, 2, true); dados.setUint16(34, 16, true);
  escrever(36, "data"); dados.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) dados.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  return { blob: new Blob([dados], { type: "audio/wav" }), segundos: Math.max(1, Math.round(audio.duration)) };
}

/** O gravador: microfone → MediaRecorder → WAV. Para sozinho no limite de segundos. */
export function useGravador(maximo) {
  const [estado, setEstado] = useState("parado"); // parado | gravando | convertendo
  const [segundos, setSegundos] = useState(0);
  const [audio, setAudio] = useState(null); // { blob, url, segundos }
  const [erro, setErro] = useState("");
  const gravador = useRef(null);
  const relogio = useRef(null);

  const guardar = (r) => setAudio((antigo) => { if (antigo?.url) URL.revokeObjectURL(antigo.url); return r ? { ...r, url: URL.createObjectURL(r.blob) } : null; });
  useEffect(() => () => { clearInterval(relogio.current); gravador.current?.stream?.getTracks().forEach((t) => t.stop()); }, []);

  async function comecar() {
    setErro("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setErro("este navegador não grava áudio — mande um arquivo"); return; }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
    } catch {
      setErro("o microfone não foi liberado — permita o microfone para o Proof no navegador");
      return;
    }
    const partes = [];
    const r = new MediaRecorder(stream);
    gravador.current = r;
    r.ondataavailable = (ev) => { if (ev.data.size) partes.push(ev.data); };
    r.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(relogio.current);
      setEstado("convertendo");
      try {
        guardar(await paraWav(new Blob(partes, { type: r.mimeType }), maximo));
      } catch (e) {
        setErro(e.message);
      } finally {
        setEstado("parado");
      }
    };
    r.start();
    setSegundos(0);
    setEstado("gravando");
    const inicio = Date.now();
    relogio.current = setInterval(() => {
      const s = Math.floor((Date.now() - inicio) / 1000);
      setSegundos(s);
      if (s >= maximo) parar();
    }, 250);
  }

  function parar() {
    if (gravador.current?.state === "recording") gravador.current.stop();
  }

  async function carregar(arquivo) {
    if (!arquivo) return;
    setErro("");
    setEstado("convertendo");
    try {
      guardar(await paraWav(arquivo, maximo));
    } catch (e) {
      setErro(e.message);
    } finally {
      setEstado("parado");
    }
  }

  return { estado, segundos, audio, erro, comecar, parar, carregar, limpar: () => guardar(null) };
}

const minutos = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Mandar a entrega: os campos que o desafio aceita (`aceitas`), e a avaliação da Lisa. `projeto`:
 * a entrega soma por partes e aceita áudio mais longo.
 */
export function EntregaComEvidencias({ desafio, aceitas, projeto = false, aoAvaliar }) {
  const r0 = desafio.resposta || {};
  const [texto, setTexto] = useState(r0.texto || "");
  const [video, setVideo] = useState(r0.video || "");
  const [fotos, setFotos] = useState([]); // { blob, url, miniatura }
  const [preparando, setPreparando] = useState(false);
  const [estado, setEstado] = useState({ status: desafio.status, nota: desafio.nota, tentativas: desafio.tentativas, avaliacao: desafio.avaliacao, completo: desafio.completo, resposta: r0 });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [Aviso, avisar] = useAviso();
  const maximoDeAudio = LIMITES_DA_EVIDENCIA.segundosDeAudio[projeto ? "projeto" : "exercicio"];
  const gravador = useGravador(maximoDeAudio);
  const camera = useRef(null);
  const galeria = useRef(null);

  // as prévias das fotos são URLs do navegador: soltas quando a foto sai ou a tela fecha
  const fotosAgora = useRef(fotos);
  fotosAgora.current = fotos;
  useEffect(() => () => fotosAgora.current.forEach((f) => URL.revokeObjectURL(f.url)), []);
  const tirarFotos = (sai) => {
    sai.forEach((f) => URL.revokeObjectURL(f.url));
    setFotos((fs) => fs.filter((f) => !sai.includes(f)));
  };

  const encerrado = !podeReenviar({ tipo: desafio.tipo, motor: desafio.motor, tentativas: estado.tentativas, status: estado.status, completo: estado.completo });
  const restantes = Math.max(0, (desafio.maxTentativas || 0) - estado.tentativas);
  const videoOk = !video.trim() || Boolean(videoDoYoutube(video));
  const temAlgo = texto.trim().length > 0 || fotos.length > 0 || Boolean(gravador.audio) || (video.trim() && videoOk);
  const ocupado = enviando || preparando || gravador.estado !== "parado";

  async function adicionarFotos(lista) {
    const arquivos = [...(lista || [])].filter((a) => a.type.startsWith("image/")).slice(0, LIMITES_DA_EVIDENCIA.imagens - fotos.length);
    if (!arquivos.length) return;
    setPreparando(true);
    setErro("");
    try {
      const novas = [];
      for (const a of arquivos) {
        const grande = await reduzirImagem(a, 1600, 0.82);
        const pequena = await reduzirImagem(a, 240, 0.6);
        novas.push({ blob: grande.blob, url: URL.createObjectURL(grande.blob), miniatura: pequena.miniatura });
      }
      setFotos((fs) => [...fs, ...novas].slice(0, LIMITES_DA_EVIDENCIA.imagens));
    } catch (e) {
      setErro(e.message);
    } finally {
      setPreparando(false);
    }
  }

  async function enviar(e) {
    e.preventDefault();
    if (!temAlgo || !videoOk) return;
    setEnviando(true);
    setErro("");
    reagir("pensando", gravador.audio ? "Ouvindo a sua gravação com atenção…" : fotos.length ? "Olhando as suas fotos com calma…" : "Lendo a sua entrega…", 60000);
    const form = new FormData();
    form.set("texto", texto.trim());
    form.set("video", video.trim());
    fotos.forEach((f, i) => { form.append("imagem", f.blob, `foto-${i + 1}.jpg`); form.append("miniatura", f.miniatura || ""); });
    if (gravador.audio) { form.set("audio", gravador.audio.blob, "audio.wav"); form.set("segundos", String(gravador.audio.segundos)); }
    try {
      const r = await criar(`/api/desafios/${desafio.id}/enviar`, form);
      const resposta = { texto: texto.trim(), video: video.trim() || null, audio: gravador.audio ? { segundos: gravador.audio.segundos } : null, miniaturas: fotos.map((f) => f.miniatura).filter(Boolean) };
      setEstado({ status: r.concluido ? "concluido" : "em_andamento", nota: r.nota, tentativas: r.tentativas, avaliacao: r.avaliacao, completo: r.completo, resposta });
      // os arquivos já foram: a próxima entrega começa sem eles (o texto fica, para melhorar)
      tirarFotos(fotos);
      gravador.limpar();
      aoAvaliar?.(r);
      reagirAEntrega(r, { projeto, avisar });
    } catch (falha) {
      setErro(falha.message);
      reagir("surpreso", "Ops, algo deu errado no envio.");
    } finally {
      setEnviando(false);
    }
  }

  const ultima = estado.resposta || {};
  return (
    <>
      <form className="pf-cartao entrega evid" onSubmit={enviar}>
        <p className="pf-campo__rotulo" style={{ margin: 0 }}>
          Sua entrega · {aceitas.map((a) => `${EVIDENCIAS[a].icone} ${EVIDENCIAS[a].nome}`).join(" · ")}
        </p>

        {aceitas.includes("texto") && (
          <label className="pf-campo">
            <span className="pf-campo__rotulo">Texto</span>
            <textarea className="pf-campo__entrada" rows={6} value={texto} maxLength={LIMITES_DA_EVIDENCIA.texto} disabled={encerrado || enviando}
              onChange={(ev) => setTexto(ev.target.value)} placeholder="Escreva aqui a sua resposta, a sua redação ou a sua resolução" />
            <small className="pf-estat__nota" style={{ margin: 0 }}>{texto.length.toLocaleString("pt-BR")} de {LIMITES_DA_EVIDENCIA.texto.toLocaleString("pt-BR")} caracteres</small>
          </label>
        )}

        {aceitas.includes("imagens") && (
          <div className="pf-campo">
            <span className="pf-campo__rotulo">Fotos · até {LIMITES_DA_EVIDENCIA.imagens} (o resultado, o caderno — não precisa aparecer você)</span>
            <div className="pf-acoes">
              <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={encerrado || ocupado || fotos.length >= LIMITES_DA_EVIDENCIA.imagens} onClick={() => camera.current?.click()}>📷 Tirar foto</button>
              <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={encerrado || ocupado || fotos.length >= LIMITES_DA_EVIDENCIA.imagens} onClick={() => galeria.current?.click()}>🖼️ Escolher fotos</button>
              {preparando && <span className="pf-estat__nota" style={{ margin: 0 }}>Preparando…</span>}
            </div>
            <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(ev) => { adicionarFotos(ev.target.files); ev.target.value = ""; }} />
            <input ref={galeria} type="file" accept="image/*" multiple hidden onChange={(ev) => { adicionarFotos(ev.target.files); ev.target.value = ""; }} />
            {fotos.length > 0 && (
              <ul className="evid__fotos">
                {fotos.map((f, i) => (
                  <li key={f.url}>
                    <img src={f.url} alt={`Foto ${i + 1} da entrega`} />
                    <button type="button" className="evid__tirar" aria-label={`Tirar a foto ${i + 1}`} disabled={enviando}
                      onClick={() => tirarFotos([f])}>✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {aceitas.includes("audio") && (
          <div className="pf-campo">
            <span className="pf-campo__rotulo">Áudio · até {minutos(maximoDeAudio)}</span>
            <div className="pf-acoes" style={{ alignItems: "center" }}>
              {gravador.estado === "gravando" ? (
                <button type="button" className="pf-botao pf-botao--perigo pf-botao--pequeno" onClick={gravador.parar}>■ Parar · {minutos(gravador.segundos)}</button>
              ) : (
                <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={encerrado || ocupado} onClick={gravador.comecar}>🎙️ {gravador.audio ? "Gravar de novo" : "Gravar"}</button>
              )}
              <label className="pf-botao pf-botao--sec pf-botao--pequeno evid__arquivo">
                📁 Enviar arquivo
                <input type="file" accept="audio/*" hidden disabled={encerrado || ocupado} onChange={(ev) => { gravador.carregar(ev.target.files?.[0]); ev.target.value = ""; }} />
              </label>
              {gravador.estado === "convertendo" && <span className="pf-estat__nota" style={{ margin: 0 }}>Preparando o áudio…</span>}
            </div>
            {gravador.audio && (
              <div className="evid__audio">
                <audio controls src={gravador.audio.url} />
                <span className="pf-estat__nota" style={{ margin: 0 }}>{minutos(gravador.audio.segundos)}</span>
                <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" disabled={enviando} onClick={gravador.limpar}>Descartar</button>
              </div>
            )}
            {gravador.erro && <small className="motor__aviso">{gravador.erro}</small>}
          </div>
        )}

        {aceitas.includes("video") && (
          <label className="pf-campo">
            <span className="pf-campo__rotulo">Vídeo do YouTube (público ou não listado)</span>
            <input className="pf-campo__entrada" type="url" value={video} disabled={encerrado || enviando} onChange={(ev) => setVideo(ev.target.value)}
              placeholder="https://youtu.be/…" />
            {!videoOk && <small className="motor__aviso">Use um link do YouTube (youtube.com ou youtu.be).</small>}
          </label>
        )}

        {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
        <div className="pf-acoes" style={{ alignItems: "center" }}>
          {!encerrado && (
            <button type="submit" className="pf-botao" disabled={ocupado || !temAlgo || !videoOk}>
              {enviando ? "A Lisa está avaliando…" : !estado.tentativas ? "Enviar para a Lisa avaliar" : projeto ? "Entregar de novo (soma o que for novo)" : "Enviar de novo"}
            </button>
          )}
          <span className="pf-estat__nota" style={{ margin: 0 }}>
            {encerrado
              ? (projeto ? (estado.completo ? "Projeto completo — tudo entregue!" : "As entregas deste projeto acabaram.") : `Concluído com nota ${estado.nota ?? 0}.`)
              : `Entrega ${estado.tentativas + 1} de ${desafio.maxTentativas}${projeto ? " · cada requisito novo soma os pontos dele" : " · vale a melhor nota"}${restantes <= 1 && estado.tentativas > 0 ? " · última chance!" : ""}`}
          </span>
        </div>
        <p className="pf-estat__nota" style={{ margin: 0 }}>
          🔒 As fotos e o áudio vão só para a Lisa avaliar e não ficam guardados: fica a avaliação, o texto e uma miniatura das fotos.
        </p>
      </form>

      {estado.tentativas > 0 && (ultima.texto || ultima.miniaturas?.length || ultima.audio || ultima.video) && (
        <div className="pf-cartao evid__ultima">
          <p className="pf-campo__rotulo" style={{ margin: 0 }}>Sua última entrega</p>
          {ultima.miniaturas?.length > 0 && (
            <ul className="evid__fotos evid__fotos--mini">
              {ultima.miniaturas.map((m, i) => <li key={i}><img src={m} alt={`Miniatura da foto ${i + 1}`} /></li>)}
            </ul>
          )}
          {ultima.audio && <p style={{ margin: 0 }}>🎙️ Áudio de {minutos(ultima.audio.segundos)}</p>}
          {ultima.video && <p style={{ margin: 0 }}>🎬 <a href={ultima.video} target="_blank" rel="noreferrer">{ultima.video}</a></p>}
          {ultima.texto && <p className="evid__texto">{ultima.texto}</p>}
        </div>
      )}
      <Avaliacao avaliacao={estado.avaliacao} nota={estado.nota} />
      {estado.tentativas > 0 && <PedirRevisao desafioId={desafio.id} versao={estado.tentativas} />}
      {Aviso}
    </>
  );
}
