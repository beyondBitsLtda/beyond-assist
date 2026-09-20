"use client";

import { useEffect, useRef, useState } from "react";
import { destinoSeguro, chaveDeLogin } from "@/lib/abacatoAuth.js";

/**
 * A porta do Abacato.
 *
 * O login é PRÓPRIO, separado do da Lisa por exigência — e a tela diz isso, porque os dois
 * sistemas vivem em subdomínios vizinhos e a pergunta "é a mesma senha?" vai aparecer.
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
      // O cálculo pesado acontece AQUI, neste aparelho, e a senha em texto puro não sai dele.
      // São 210 mil iterações de PBKDF2 — alguns décimos de segundo num computador, talvez um
      // segundo num celular antigo. É por isso que o botão diz "Verificando…" desde o primeiro
      // clique, e não só a partir da resposta do servidor: sem isso a tela pareceria travada.
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
      // `destinoSeguro` é a MESMA função que o servidor usa. Uma segunda cópia da regra escrita
      // à mão aqui foi exatamente o que travou o login da Lisa em "VERIFICANDO…" para sempre.
      window.location.href = destinoSeguro(new URLSearchParams(window.location.search).get("de"));
    } catch (falha) {
      // Agora que a senha é calculada aqui, este `catch` pega duas coisas muito diferentes, e
      // chamar as duas de "sem resposta do servidor" mandaria procurar no lugar errado.
      //
      // `crypto.subtle` só existe em página segura: HTTPS, ou localhost. Abrir o sistema por
      // um endereço de rede local tipo http://192.168.x.x faz ele sumir — e a falha aparece
      // exatamente aqui, com o servidor perfeitamente no ar.
      const semCripto = typeof window !== "undefined" && !window.crypto?.subtle;
      setErro(semCripto
        ? "abra o sistema por HTTPS — neste endereço o navegador não libera a criptografia do login"
        : "sem resposta do servidor");
      setEnviando(false);
    }
  }

  return (
    <main className="abacato-entrada">
      <form className="abacato-entrada__cartao" onSubmit={entrar}>
        <div className="abacato-entrada__marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={40} height={40} style={{ borderRadius: 10 }} />
          <div>
            <div className="abacato-entrada__nome">Abacato</div>
            <p className="abacato-entrada__sub">Quadros, documentação e acompanhamento</p>
          </div>
        </div>

        <label className="abacato-campo">
          <span className="abacato-campo__rotulo">E-mail</span>
          <input
            ref={campoEmail}
            className="abacato-campo__entrada"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="abacato-campo">
          <span className="abacato-campo__rotulo">Senha</span>
          <input
            className="abacato-campo__entrada"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
        </label>

        {erro && <div className="abacato-campo__erro">{erro}</div>}

        <button className="abacato-botao" type="submit" disabled={enviando}>
          {enviando ? "Verificando…" : "Entrar"}
        </button>

        <p className="abacato-entrada__sub" style={{ marginTop: 2 }}>
          Esta conta é só do Abacato — não é a mesma da Lisa.
        </p>
      </form>
    </main>
  );
}
