"use client";

import { useEffect, useRef, useState } from "react";
import { destinoSeguro, chaveDeLogin } from "@/lib/auth.js";
import { Marca } from "@/componentes/Icones.js";

/**
 * A porta da Lisa_Proof. A conta é a do Abacato — e a tela diz isso, porque a pergunta "qual
 * senha?" aparece logo, com três sistemas vizinhos (Lisa, Abacato e este).
 */
export default function Entrar() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const campoEmail = useRef(null);

  useEffect(() => { campoEmail.current?.focus(); }, []);

  async function entrar(e) {
    e.preventDefault();
    if (enviando) return;
    setErro("");
    setEnviando(true);
    try {
      // A senha é esticada AQUI (PBKDF2, mesmo cálculo do Abacato) e não sai deste aparelho.
      const chave = await chaveDeLogin(email.trim(), senha);
      const res = await fetch("/api/auth/entrar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), chave }),
      });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok || !dados.ok) {
        setErro(dados.error || "não foi possível entrar");
        setEnviando(false);
        return;
      }
      window.location.href = destinoSeguro(new URLSearchParams(window.location.search).get("de"));
    } catch {
      const semCripto = typeof window !== "undefined" && !window.crypto?.subtle;
      setErro(semCripto ? "abra por HTTPS — neste endereço o navegador não libera a criptografia do login" : "sem resposta do servidor");
      setEnviando(false);
    }
  }

  return (
    <main className="pf-entrada">
      <form className="pf-entrada__cartao" onSubmit={entrar}>
        <div className="pf-entrada__marca">
          <Marca className="pf-marca__icone" />
          <div>
            <h1>Lisa_Proof</h1>
            <p>Seu estudo diário de programação</p>
          </div>
        </div>

        <label className="pf-campo">
          <span className="pf-campo__rotulo">E-mail</span>
          <input
            ref={campoEmail}
            className="pf-campo__entrada"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="pf-campo">
          <span className="pf-campo__rotulo">Senha</span>
          <input
            className="pf-campo__entrada"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
        </label>

        {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}

        <button className="pf-botao" type="submit" disabled={enviando}>
          {enviando ? "Verificando…" : "Entrar"}
        </button>

        <p className="pf-entrada__nota">Use a mesma conta do Abacato.</p>
      </form>
    </main>
  );
}
