"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLog } from "@/components/shell/LogProvider.js";
import { CY, OR, GR, PU, mono } from "@/lib/theme.js";
import { speakText, isBrowserVoiceAudioPlaying } from "@/lib/browserVoice.js";

const AUTO_INTERVAL_OPTIONS = [
  { value: 20000, label: "20 segundos" },
  { value: 30000, label: "30 segundos" },
  { value: 60000, label: "1 minuto" },
  { value: 120000, label: "2 minutos" },
];

/** Tira UM retrato do <video> de uma captura de tela — mesma técnica do Modo Tela do
 * Assistente (canvas, reduzido a no máx. 1280px no lado maior, jpeg). */
function captureFrame(videoEl) {
  if (!videoEl || !videoEl.videoWidth) return null;
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(videoEl.videoWidth, videoEl.videoHeight));
  const w = Math.round(videoEl.videoWidth * scale), h = Math.round(videoEl.videoHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(videoEl, 0, 0, w, h);
  const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  return base64 ? { mimeType: "image/jpeg", data: base64 } : null;
}

/**
 * Modo Assistente de Testes: escolhe projeto → run → caso de teste (dados reais de
 * cloud_runs, o mesmo banco da aplicação de controle de testes do usuário — ver
 * src/lib/sentinelTests.js), liga o compartilhamento de 1 ou 2 telas/janelas, e a Lisa compara
 * o que vê com os passos e o critério de aprovação do caso, dando um veredito. Gravar o
 * resultado de volta no run de verdade é sempre OPCIONAL (desligado por padrão) — nunca abre
 * ticket sozinha, isso fica sempre na mão da pessoa.
 */
export default function TestModePage() {
  const { addLog } = useLog();

  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState("");
  const [runs, setRuns] = useState([]);
  const [runId, setRunId] = useState("");
  const [cases, setCases] = useState([]);
  const [caseKey, setCaseKey] = useState("");
  const [caseDetail, setCaseDetail] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // telas — a 2ª é opcional, só liga se a pessoa quiser
  const [screen1On, setScreen1On] = useState(false);
  const [screen2On, setScreen2On] = useState(false);
  const [screenError, setScreenError] = useState(null);
  const video1Ref = useRef(null);
  const video2Ref = useRef(null);
  const stream1Ref = useRef(null);
  const stream2Ref = useRef(null);

  // histórico de capturas DESTE caso — um teste real costuma levar vários passos ao longo de
  // vários "confere agora" (login, edição, logout, login de novo...); mandar só o frame ATUAL
  // a cada vez fazia ela dizer "indeterminado" pra sempre, porque nenhuma foto sozinha mostra
  // a sequência toda. Acumula (em ordem cronológica) e reseta quando troca de caso.
  const MAX_HISTORY_FRAMES = 8;
  const frameHistoryRef = useRef([]);
  const [historyFrameCount, setHistoryFrameCount] = useState(0); // só pra mostrar na tela — o ref em si não re-renderiza sozinho

  const [voiceOn, setVoiceOn] = useState(true);
  const [autoWrite, setAutoWrite] = useState(false); // ela grava sozinha? desligado por padrão
  const [autoCheck, setAutoCheck] = useState(false); // modo automático (verifica sozinha de tempos em tempos)
  const [autoIntervalMs, setAutoIntervalMs] = useState(30000);

  const [checking, setChecking] = useState(false);
  const [lastVerdict, setLastVerdict] = useState(null); // { verdict, reasoning, at }
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch("/api/test-mode/projects").then((r) => r.json()).then((d) => { if (d.ok) setProjects(d.projects); }).catch(() => {});
  }, []);

  useEffect(() => {
    setRunId(""); setRuns([]); setCases([]); setCaseKey(""); setCaseDetail(null);
    if (!project) return;
    fetch(`/api/test-mode/runs?project=${encodeURIComponent(project)}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setRuns(d.runs); })
      .catch(() => {});
  }, [project]);

  useEffect(() => {
    setCaseKey(""); setCaseDetail(null); setCases([]);
    if (!runId) return;
    fetch(`/api/test-mode/cases?runId=${encodeURIComponent(runId)}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setCases(d.cases); })
      .catch(() => {});
  }, [runId]);

  useEffect(() => {
    setCaseDetail(null);
    frameHistoryRef.current = []; // trocou de caso — histórico de capturas não faz mais sentido
    setHistoryFrameCount(0);
    setLastVerdict(null);
    if (!runId || !caseKey) return;
    fetch(`/api/test-mode/case?runId=${encodeURIComponent(runId)}&caseKey=${encodeURIComponent(caseKey)}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setCaseDetail(d); else setLoadError(d.error); })
      .catch((err) => setLoadError(err.message));
  }, [runId, caseKey]);

  // ---- captura de tela (1 ou 2, independentes) ----
  const startScreen = useCallback(async (which) => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      setScreenError("este navegador não suporta compartilhamento de tela");
      return;
    }
    setScreenError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const videoRef = which === 1 ? video1Ref : video2Ref;
      const streamRef = which === 1 ? stream1Ref : stream2Ref;
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
      const [track] = stream.getVideoTracks();
      track?.addEventListener("ended", () => { which === 1 ? setScreen1On(false) : setScreen2On(false); });
      which === 1 ? setScreen1On(true) : setScreen2On(true);
    } catch (err) {
      setScreenError(err?.name === "NotAllowedError" ? "permissão de compartilhamento de tela negada" : (err?.message || "não consegui iniciar o compartilhamento"));
    }
  }, []);

  const stopScreen = useCallback((which) => {
    const streamRef = which === 1 ? stream1Ref : stream2Ref;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    which === 1 ? setScreen1On(false) : setScreen2On(false);
  }, []);

  useEffect(() => () => {
    stream1Ref.current?.getTracks().forEach((t) => t.stop());
    stream2Ref.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // ---- checagem (manual "confere agora" ou automática) ----
  const runCheck = useCallback(async () => {
    if (!caseDetail || checking) return;
    const newFrames = [captureFrame(video1Ref.current), captureFrame(video2Ref.current)].filter(Boolean);
    if (!newFrames.length) {
      addLog("[TESTE]", OR, "nenhuma tela ligada ainda — liga o compartilhamento antes de conferir.");
      return;
    }
    // acumula no histórico deste caso (mais antigas primeiro) e manda TUDO, não só o instante
    // atual — um teste de verdade tem passos espalhados no tempo (login, edição, logout,
    // login de novo...), uma foto sozinha quase nunca prova o critério inteiro.
    frameHistoryRef.current = [...frameHistoryRef.current, ...newFrames].slice(-MAX_HISTORY_FRAMES);
    const frames = frameHistoryRef.current;
    setHistoryFrameCount(frames.length);
    setChecking(true);
    try {
      const res = await fetch("/api/test-mode/evaluate", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          itemTestado: caseDetail.testCase.itemTestado,
          descricao: caseDetail.testCase.descricao,
          condicaoAprovacao: caseDetail.testCase.condicaoAprovacao,
          images: frames,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) { addLog("[TESTE]", OR, `falha ao conferir: ${data.error || `HTTP ${res.status}`}`); return; }
      const entry = { verdict: data.verdict, reasoning: data.reasoning, at: new Date().toLocaleTimeString("pt-BR") };
      setLastVerdict(entry);
      setHistory((h) => [entry, ...h].slice(0, 20));
      addLog("[TESTE]", data.verdict === "Aprovado" ? GR : data.verdict === "Reprovado" ? OR : PU, `${data.verdict}: ${data.reasoning}`);

      const jaFalando = isBrowserVoiceAudioPlaying() || (typeof window !== "undefined" && window.speechSynthesis?.speaking);
      if (voiceOn && !jaFalando) speakText(`${data.verdict}. ${data.reasoning}`).catch(() => {});

      if (autoWrite && (data.verdict === "Aprovado" || data.verdict === "Reprovado")) {
        await saveResult(data.verdict);
      }
    } catch (err) {
      addLog("[TESTE]", OR, `falha ao conferir: ${err.message}`);
    } finally {
      setChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseDetail, checking, voiceOn, autoWrite, addLog]);

  const saveResult = useCallback(async (resultado) => {
    if (!caseDetail) return;
    try {
      const res = await fetch("/api/test-mode/write-result", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId, caseKey, resultado, expectedUpdatedAt: caseDetail.run.updated_at }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) { addLog("[TESTE]", OR, `não consegui gravar: ${data.error || `HTTP ${res.status}`}`); return; }
      addLog("[TESTE]", GR, `resultado gravado: ${resultado}`);
      setCaseDetail((prev) => prev && { ...prev, testCase: { ...prev.testCase, resultado }, run: { ...prev.run, updated_at: new Date().toISOString() } });
    } catch (err) {
      addLog("[TESTE]", OR, `não consegui gravar: ${err.message}`);
    }
  }, [caseDetail, runId, caseKey, addLog]);

  // modo automático — verifica sozinha de tempos em tempos, enquanto ligado
  useEffect(() => {
    if (!autoCheck || !caseDetail) return;
    const id = setInterval(() => { runCheck(); }, autoIntervalMs);
    return () => clearInterval(id);
  }, [autoCheck, autoIntervalMs, caseDetail, runCheck]);

  const inputStyle = { ...mono, fontSize: 12, padding: "9px 12px", borderRadius: 6, border: "1px solid rgba(var(--accent-rgb),0.18)", background: "#000", color: "#eafcff", width: "100%" };
  const labelStyle = { ...mono, fontSize: 9, letterSpacing: 2, color: "rgba(var(--accent-rgb),0.5)", marginBottom: 6, marginTop: 14 };
  const toggleStyle = (on) => ({ ...mono, fontSize: 10.5, padding: "9px 12px", borderRadius: 6, border: `1px solid ${on ? GR : "rgba(var(--accent-rgb),0.18)"}`, background: on ? "rgba(123,216,143,0.12)" : "transparent", color: on ? "#eafcff" : "rgba(207,239,251,0.55)", cursor: "pointer" });

  return (
    <div style={{ padding: "24px 28px", height: "100%", overflowY: "auto" }}>
      <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY, marginBottom: 8 }}>◈ MODO ASSISTENTE DE TESTES</div>
      <div style={{ fontSize: 11, color: "rgba(207,239,251,0.5)", marginBottom: 20, lineHeight: 1.5, maxWidth: 680 }}>
        Escolha um projeto, um run e um caso de teste (dados reais da sua plataforma de testes).
        Ligue o compartilhamento de tela e a Lisa compara o que vê com os passos e o critério de
        aprovação do caso. Gravar o resultado de volta é sempre opcional — ela nunca abre ticket
        sozinha, isso continua sendo você quem decide.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px,1fr) minmax(340px,1.6fr)", gap: 20, alignItems: "start" }}>
        {/* ---- coluna esquerda: seleção + controles ---- */}
        <div style={{ border: "1px solid rgba(var(--accent-rgb),0.16)", borderRadius: 8, padding: "16px 18px", background: "rgba(0,0,0,0.2)" }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: "rgba(207,239,251,0.55)" }}>SELEÇÃO</div>

          <div style={labelStyle}>PROJETO DE TESTE</div>
          <select value={project} onChange={(e) => setProject(e.target.value)} style={inputStyle}>
            <option value="">selecione…</option>
            {projects.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <div style={labelStyle}>RUN</div>
          <select value={runId} onChange={(e) => setRunId(e.target.value)} disabled={!project} style={inputStyle}>
            <option value="">{project ? "selecione…" : "escolha um projeto primeiro"}</option>
            {runs.map((r) => <option key={r.id} value={r.id}>{r.run_name}</option>)}
          </select>

          <div style={labelStyle}>CASO DE TESTE</div>
          <select value={caseKey} onChange={(e) => setCaseKey(e.target.value)} disabled={!runId} style={inputStyle}>
            <option value="">{runId ? "selecione…" : "escolha um run primeiro"}</option>
            {cases.map((c) => <option key={c.caseKey} value={c.caseKey}>#{c.displayId} — {c.itemTestado} ({c.resultado})</option>)}
          </select>
          {loadError && <div style={{ ...mono, fontSize: 9.5, color: OR, marginTop: 8 }}>⚠ {loadError}</div>}

          {caseDetail && (
            <div style={{ marginTop: 16, padding: "10px 12px", border: "1px solid rgba(var(--accent-rgb),0.14)", borderRadius: 6, background: "rgba(0,0,0,0.25)" }}>
              <div style={{ fontSize: 12, color: "#eafcff", marginBottom: 6 }}>{caseDetail.testCase.itemTestado}</div>
              <div style={{ fontSize: 11, color: "rgba(207,239,251,0.6)", whiteSpace: "pre-wrap", marginBottom: 8 }}>{caseDetail.testCase.descricao}</div>
              <div style={{ ...mono, fontSize: 9.5, color: PU, marginBottom: 4 }}>CRITÉRIO DE APROVAÇÃO</div>
              <div style={{ fontSize: 11, color: "rgba(207,239,251,0.6)", marginBottom: 8 }}>{caseDetail.testCase.condicaoAprovacao || "(não informado)"}</div>
              <div style={{ ...mono, fontSize: 9.5, color: caseDetail.testCase.resultado === "Aprovado" ? GR : caseDetail.testCase.resultado === "Reprovado" ? OR : CY }}>
                resultado atual: {caseDetail.testCase.resultado} · status: {caseDetail.workflowStatus}
              </div>
            </div>
          )}

          <div style={labelStyle}>TELAS</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button onClick={() => (screen1On ? stopScreen(1) : startScreen(1))} style={{ ...toggleStyle(screen1On), flex: 1 }}>
              🖵 Tela 1: {screen1On ? "ON" : "OFF"}
            </button>
            <button onClick={() => (screen2On ? stopScreen(2) : startScreen(2))} style={{ ...toggleStyle(screen2On), flex: 1 }}>
              🖵 Tela 2: {screen2On ? "ON" : "OFF"}
            </button>
          </div>
          {screenError && <div style={{ ...mono, fontSize: 9.5, color: OR, marginBottom: 8 }}>⚠ {screenError}</div>}
          <div style={{ display: (screen1On || screen2On) ? "flex" : "none", gap: 8, marginBottom: 8 }}>
            <video ref={video1Ref} autoPlay playsInline muted style={{ display: screen1On ? "block" : "none", width: "50%", aspectRatio: "16/9", borderRadius: 6, objectFit: "cover", border: `1px solid ${GR}55` }} />
            <video ref={video2Ref} autoPlay playsInline muted style={{ display: screen2On ? "block" : "none", width: "50%", aspectRatio: "16/9", borderRadius: 6, objectFit: "cover", border: `1px solid ${GR}55` }} />
          </div>

          <div style={labelStyle}>OPÇÕES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={() => setVoiceOn((v) => !v)} style={toggleStyle(voiceOn)}>🔊 Falar veredito: {voiceOn ? "ON" : "OFF"}</button>
            <button onClick={() => setAutoWrite((v) => !v)} style={toggleStyle(autoWrite)}>✍️ Gravar resultado sozinha: {autoWrite ? "ON" : "OFF"}</button>
            <button onClick={() => setAutoCheck((v) => !v)} style={toggleStyle(autoCheck)}>🔁 Modo automático: {autoCheck ? "ON" : "OFF"}</button>
            {autoCheck && (
              <select value={autoIntervalMs} onChange={(e) => setAutoIntervalMs(Number(e.target.value))} style={inputStyle}>
                {AUTO_INTERVAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>a cada {o.label}</option>)}
              </select>
            )}
          </div>

          <button
            onClick={runCheck}
            disabled={!caseDetail || checking || (!screen1On && !screen2On)}
            style={{ ...mono, fontSize: 10.5, letterSpacing: 1.5, padding: "10px 14px", borderRadius: 6, border: `1px solid ${PU}`, background: "rgba(201,166,255,0.1)", color: "#eafcff", cursor: checking ? "wait" : "pointer", width: "100%", marginTop: 16 }}
          >
            {checking ? "CONFERINDO…" : "◈ CONFERE AGORA"}
          </button>
          {historyFrameCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <span style={{ ...mono, fontSize: 9.5, color: "rgba(207,239,251,0.45)" }}>
                {historyFrameCount} captura{historyFrameCount > 1 ? "s" : ""} acumulada{historyFrameCount > 1 ? "s" : ""} deste caso — ela olha todas juntas, não só a última
              </span>
              <button
                onClick={() => { frameHistoryRef.current = []; setHistoryFrameCount(0); addLog("[TESTE]", CY, "histórico de capturas deste caso foi limpo."); }}
                style={{ ...mono, fontSize: 9, color: OR, background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                limpar
              </button>
            </div>
          )}
        </div>

        {/* ---- coluna direita: veredito + histórico ---- */}
        <div>
          <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: "rgba(207,239,251,0.55)", marginBottom: 10 }}>VEREDITO</div>
          {lastVerdict ? (
            <div style={{ border: `1px solid ${lastVerdict.verdict === "Aprovado" ? GR : lastVerdict.verdict === "Reprovado" ? OR : PU}55`, borderRadius: 8, padding: "14px 16px", background: "rgba(0,0,0,0.2)", marginBottom: 16 }}>
              <div style={{ ...mono, fontSize: 12, letterSpacing: 1.5, color: lastVerdict.verdict === "Aprovado" ? GR : lastVerdict.verdict === "Reprovado" ? OR : PU, marginBottom: 8 }}>
                {lastVerdict.verdict.toUpperCase()} · {lastVerdict.at}
              </div>
              <div style={{ fontSize: 13, color: "#eafcff", lineHeight: 1.5 }}>{lastVerdict.reasoning}</div>
              {!autoWrite && (lastVerdict.verdict === "Aprovado" || lastVerdict.verdict === "Reprovado") && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={() => saveResult("Aprovado")} style={{ ...mono, fontSize: 10, padding: "8px 12px", borderRadius: 5, border: `1px solid ${GR}`, background: "rgba(123,216,143,0.12)", color: "#eafcff", cursor: "pointer" }}>salvar como Aprovado</button>
                  <button onClick={() => saveResult("Reprovado")} style={{ ...mono, fontSize: 10, padding: "8px 12px", borderRadius: 5, border: `1px solid ${OR}`, background: "rgba(255,157,61,0.12)", color: "#eafcff", cursor: "pointer" }}>salvar como Reprovado</button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ ...mono, fontSize: 11, color: "rgba(207,239,251,0.4)", marginBottom: 16 }}>nenhuma checagem ainda.</div>
          )}

          <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: "rgba(207,239,251,0.55)", marginBottom: 10 }}>HISTÓRICO DESTA SESSÃO</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {history.map((h, i) => (
              <div key={i} style={{ border: "1px solid rgba(var(--accent-rgb),0.12)", borderRadius: 6, padding: "8px 12px", background: "rgba(0,0,0,0.15)" }}>
                <div style={{ ...mono, fontSize: 9.5, color: h.verdict === "Aprovado" ? GR : h.verdict === "Reprovado" ? OR : PU }}>{h.verdict} · {h.at}</div>
                <div style={{ fontSize: 11, color: "rgba(207,239,251,0.6)", marginTop: 2 }}>{h.reasoning}</div>
              </div>
            ))}
            {!history.length && <div style={{ ...mono, fontSize: 10, color: "rgba(207,239,251,0.35)" }}>—</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
