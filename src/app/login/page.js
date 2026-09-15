"use client";

import { useEffect, useRef, useState } from "react";
import { destinoSeguro } from "@/lib/authSession.js";

/**
 * A tela de entrada da Lisa.
 *
 * Vive fora de `(panels)` de propósito: o layout dos painéis traz barra lateral, topo e os
 * laços de consulta ao servidor — tudo coisa de quem já entrou. Pendurar o login ali faria a
 * própria tela de bloqueio chamar rotas bloqueadas.
 *
 * O visual segue o resto do app (fundo escuro, ciano, monoespaçada), mas sem nenhum dos
 * enfeites animados: esta página tem uma função só, e ela é ser rápida.
 */
export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const campoEmail = useRef(null);

  useEffect(() => {
    campoEmail.current?.focus();
  }, []);

  async function entrar(e) {
    e.preventDefault();
    if (enviando) return;
    setErro("");
    setEnviando(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), senha }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setErro(j.error || "não foi possível entrar");
        setEnviando(false);
        return;
      }
      // `de` é para onde a pessoa tentava ir quando foi barrada, e quem decide se aquele
      // destino presta é destinoSeguro — a MESMA função que o servidor usa.
      //
      // Aqui havia uma segunda cópia da regra, escrita à mão, e ela não conhecia /auth-check.
      // O resultado: o login dava certo, a página mandava o navegador para /auth-check, que
      // responde 204 — e navegador que recebe 204 não sai do lugar. A tela ficava em
      // "VERIFICANDO…" para sempre, sem erro nenhum, esperando uma navegação que não vinha.
      // Duas cópias da mesma regra é uma a mais.
      window.location.href = destinoSeguro(new URLSearchParams(window.location.search).get("de"));
    } catch {
      setErro("sem resposta do servidor");
      setEnviando(false);
    }
  }

  return (
    <main style={estilos.tela}>
      <form onSubmit={entrar} style={estilos.caixa}>
        <div style={estilos.marca}>BEYOND BITS</div>
        <h1 style={estilos.titulo}>LISA</h1>
        <p style={estilos.sub}>acesso restrito</p>

        <label htmlFor="email" style={estilos.rotulo}>E-MAIL</label>
        <input
          id="email"
          ref={campoEmail}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          style={estilos.campo}
        />

        <label htmlFor="senha" style={estilos.rotulo}>SENHA</label>
        <input
          id="senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
          required
          style={estilos.campo}
        />

        {erro ? (
          <div role="alert" style={estilos.erro}>{erro}</div>
        ) : null}

        <button type="submit" disabled={enviando} style={{ ...estilos.botao, opacity: enviando ? 0.55 : 1 }}>
          {enviando ? "VERIFICANDO…" : "ENTRAR"}
        </button>
      </form>
    </main>
  );
}

const CIANO = "rgb(var(--accent-rgb, 56 225 255))";

const estilos = {
  tela: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    background: "radial-gradient(circle at 50% 0%, #06202a 0%, #03080c 60%)",
  },
  caixa: {
    width: "100%",
    maxWidth: 380,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "34px 30px 30px",
    border: "1px solid rgba(56,225,255,0.22)",
    borderRadius: 10,
    background: "rgba(4,14,20,0.82)",
    boxShadow: "0 0 40px rgba(56,225,255,0.07)",
  },
  marca: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    letterSpacing: 3,
    color: "rgba(56,225,255,0.55)",
  },
  titulo: {
    fontFamily: "Rajdhani, 'JetBrains Mono', monospace",
    fontSize: 42,
    lineHeight: 1,
    letterSpacing: 8,
    margin: "6px 0 2px",
    color: "#eafcff",
    fontWeight: 700,
  },
  sub: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    letterSpacing: 2,
    color: "rgba(207,239,251,0.45)",
    margin: "0 0 22px",
  },
  rotulo: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    letterSpacing: 2,
    color: "rgba(207,239,251,0.6)",
    marginTop: 14,
  },
  campo: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 15,
    padding: "11px 12px",
    marginTop: 6,
    color: "#eafcff",
    background: "rgba(0,0,0,0.45)",
    border: "1px solid rgba(56,225,255,0.25)",
    borderRadius: 5,
    outlineColor: CIANO,
  },
  erro: {
    marginTop: 16,
    padding: "9px 12px",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12.5,
    color: "#ffd9d9",
    background: "rgba(204,15,16,0.16)",
    border: "1px solid rgba(232,34,31,0.5)",
    borderRadius: 5,
  },
  botao: {
    marginTop: 24,
    padding: "12px 16px",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    letterSpacing: 3,
    fontWeight: 600,
    color: "#03121a",
    background: CIANO,
    border: 0,
    borderRadius: 5,
    cursor: "pointer",
  },
};
