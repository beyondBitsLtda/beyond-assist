"use client";

import { useState } from "react";
import { chaveDeLogin, guardarSenha } from "@/lib/abacatoAuth.js";
import { mudar } from "@/lib/api.js";

/**
 * Trocar a própria senha.
 *
 * Tudo acontece neste navegador: a senha atual e a nova são esticadas aqui, e o servidor recebe
 * só as chaves. Nem a atual, nem a nova, nem por um instante.
 *
 * Pedir a senha atual não é burocracia: sem ela, uma sessão esquecida aberta num computador
 * trocaria a senha e trancaria o dono para fora, em silêncio. Quem tem só o cookie não sabe a
 * senha — e é exatamente isso que esta exigência cobra.
 */
export default function MinhaConta() {
  const [email, setEmail] = useState("");
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [repetida, setRepetida] = useState("");
  const [erro, setErro] = useState("");
  const [pronto, setPronto] = useState(false);
  const [trabalhando, setTrabalhando] = useState(false);

  async function trocar(e) {
    e.preventDefault();
    setErro("");
    setPronto(false);

    if (!email.trim()) return setErro("informe o seu e-mail — ele entra no cálculo da senha");
    if (nova.length < 10) return setErro("a senha nova precisa de pelo menos 10 caracteres");
    if (nova !== repetida) return setErro("as duas senhas novas não são iguais");
    if (nova === atual) return setErro("a senha nova é igual à atual");

    setTrabalhando(true);
    try {
      // O e-mail entra no cálculo das duas: é ele que faz a mesma senha em contas diferentes
      // dar chaves diferentes.
      const chaveAtual = await chaveDeLogin(email.trim(), atual);
      const guardada = await guardarSenha(email.trim(), nova);
      await mudar("/api/conta/senha", {
        chaveAtual,
        hash: guardada.hash,
        sal: guardada.sal,
        iteracoes: guardada.iteracoes,
      });
      setPronto(true);
      setAtual(""); setNova(""); setRepetida("");
    } catch (x) {
      setErro(x.message);
    } finally {
      setTrabalhando(false);
    }
  }

  return (
    <>
      <header className="abacato-conteudo__cabecalho">
        <h1 className="abacato-conteudo__titulo">Minha conta</h1>
      </header>

      <form className="abacato-bloco" onSubmit={trocar} style={{ maxWidth: 520 }}>
        <h3 className="abacato-bloco__titulo">Trocar a senha</h3>

        {erro && <div className="abacato-campo__erro">⚠ {erro}</div>}
        {pronto && (
          <p className="abacato-recado">✓ Senha trocada. Da próxima vez que entrar, use a nova.</p>
        )}

        <label className="abacato-campo">
          <span className="abacato-campo__rotulo">Seu e-mail</span>
          <input className="abacato-campo__entrada" type="email" autoComplete="username"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        <label className="abacato-campo">
          <span className="abacato-campo__rotulo">Senha atual</span>
          <input className="abacato-campo__entrada" type="password" autoComplete="current-password"
            value={atual} onChange={(e) => setAtual(e.target.value)} />
        </label>

        <label className="abacato-campo">
          <span className="abacato-campo__rotulo">Senha nova</span>
          <input className="abacato-campo__entrada" type="password" autoComplete="new-password"
            value={nova} onChange={(e) => setNova(e.target.value)} />
          <span className="abacato-dica">
            Pelo menos 10 caracteres. Uma frase que só você diria é mais forte e mais fácil de
            lembrar que oito caracteres com símbolos.
          </span>
        </label>

        <label className="abacato-campo">
          <span className="abacato-campo__rotulo">Repita a senha nova</span>
          <input className="abacato-campo__entrada" type="password" autoComplete="new-password"
            value={repetida} onChange={(e) => setRepetida(e.target.value)} />
        </label>

        <button className="abacato-botao" type="submit" disabled={trabalhando}>
          {trabalhando ? "Trocando…" : "Trocar a senha"}
        </button>

        <p className="abacato-dica abacato-dica--bloco">
          O cálculo acontece neste navegador. O servidor nunca recebe a sua senha — nem a atual,
          nem a nova.
        </p>
      </form>
    </>
  );
}
