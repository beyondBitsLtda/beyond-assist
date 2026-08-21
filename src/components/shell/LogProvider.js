"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CY } from "@/lib/theme.js";

const LogContext = createContext(null);

const pad = (n) => String(n).padStart(2, "0");
const fmtClock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/**
 * Histórico de logs de sistema, compartilhado entre o Topbar (SYNC roda aqui agora)
 * e o painel Assistente (que mostra a coluna SYSTEM_LOGS) — assim o SYNC disparado
 * de qualquer painel continua visível no Assistente.
 */
export function LogProvider({ children }) {
  const [logs, setLogs] = useState([
    { id: 1, t: fmtClock(new Date()), tag: "[BOOT]", color: CY, msg: "core online · pgvector ready" },
    { id: 2, t: fmtClock(new Date()), tag: "[RAG]", color: CY, msg: "index warm · dim=768" },
  ]);
  const logIdRef = useRef(100);

  const addLog = useCallback((tag, color, msg) => {
    const line = { id: ++logIdRef.current, t: fmtClock(new Date()), tag, color, msg };
    setLogs((s) => [...s, line].slice(-11));
  }, []);

  return <LogContext.Provider value={{ logs, addLog }}>{children}</LogContext.Provider>;
}

export function useLog() {
  const ctx = useContext(LogContext);
  if (!ctx) throw new Error("useLog precisa estar dentro de <LogProvider>");
  return ctx;
}
