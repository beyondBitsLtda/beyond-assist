"use client";

import { use, useEffect, useState } from "react";
import { guardarSenha } from "@/lib/abacatoAuth.js";
import { emailValido } from "@/dominio/papeis.js";

/**
 * Criar a própria conta a partir de um link de convite.
 *
 * É a única tela do Abacato que alguém sem conta abre e que escreve no banco. Duas coisas que
 * ela faz questão de dizer ANTES de qualquer campo:
 *
 *   1. OS LIMITES, vindos do servidor. Descobrir depois de se cadastrar que a conta cabe 10
 *      quadros é descobrir tarde.
 *   2. A APROVAÇÃO. A pessoa termina o cadastro e ainda não entra. Dizer isso só no fim seria
 *      deixá-la tentar entrar, falhar, e achar que digitou a senha errada.
 *
 * A senha é esticada AQUI, como em todo o resto do sistema: o servidor recebe o selo, nunca a
 * senha. Reaproveita as classes da tela de entrada — é a mesma moldura, e um segundo conjunto
 * de estilos para a mesma caixa divergiria na primeira mudança de tema.
 */
export default function Cadastro({ params }) {
  const { token } = use(params);

  const [convite, setConvite] = useState(null);
  const [erroDoLink, setErroDoLink] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [repetida, setRepetida] = useState("");
  const [erro, setErro] = useState("");
  const [trabalhando, setTrabalhando] = useState(false);
  const [pronto, setPronto] = useState("");

  useEffect(() => {
    fetch(`/api/cadastro/${token}`)
      .then((r) => r.json())
      .then((d) => (d.ok ? setConvite(d) : setErroDoLink(d.error || "este link não vale mais")))
      .catch(() => setErroDoLink("não consegui conferir este link"));
  }, [token]);

  async function enviar(e) {
    e.preventDefault();
    if (trabalhando) return;
    setErro("");
    if (!nome.trim()) return setErro("falta o seu nome");
    if (!emailValido(email)) return setErro("esse e-mail não parece certo");
    if (senha.length < 10) return setErro("a senha precisa de pelo menos 10 caracteres");
    if (senha !== repetida) return setErro("as duas senhas não são iguais");

    setTrabalhando(true);
    try {
      const guardada = await guardarSenha(email.trim(), senha);
      const res = await fetch(`/api/cadastro/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim(),
          hash: guardada.hash,
          sal: guardada.sal,
          iteracoes: guardada.iteracoes,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!d.ok) throw new Error(d.error || "não consegui concluir o cadastro");
      setPronto(d.mensagem);
    } catch (x) {
      // Mesma armadilha da tela de entrada: sem HTTPS o `crypto.subtle` não existe, e a falha
      // aparece aqui com o servidor perfeitamente no ar.
      const semCripto = typeof window !== "undefined" && !window.crypto?.subtle;
      setErro(semCripto
        ? "abra esta página por HTTPS — neste endereço o navegador não libera a criptografia da senha"
        : x.message);
    } finally {
      setTrabalhando(false);
    }
  }

  function moldura(miolo) {
    return (
      <main className="abacato-entrada">
        <div className="abacato-entrada__cartao">
          <div className="abacato-entrada__marca">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" width={40} height={40} style={{ borderRadius: 10 }} />
            <div>
              <div className="abacato-entrada__nome">Abacato</div>
              <p className="abacato-entrada__sub">Quadros, documentação e acompanhamento</p>
            </div>
          </div>
          {miolo}
        </div>
      </main>
    );
  }

  if (erroDoLink) {
    return moldura(
      <>
        <div className="abacato-campo__erro">{erroDoLink}</div>
        <p className="abacato-entrada__sub">
          Peça um link novo a quem te enviou este — cada link tem prazo e um número de usos.
        </p>
        <a className="abacato-botao" href="/entrar">Já tenho conta</a>
      </>
    );
  }

  if (pronto) {
    return moldura(
      <>
        <div className="abacato-plano">
          <div className="abacato-plano__titulo">Cadastro recebido</div>
          <p className="abacato-plano__nota">{pronto}</p>
        </div>
        <a className="abacato-botao" href="/entrar">Ir para a entrada</a>
      </>
    );
  }

  if (!convite) return moldura(<p className="abacato-entrada__sub">conferindo o link…</p>);

  const p = convite.plano;
  return moldura(
    <form onSubmit={enviar} style={{ display: "contents" }}>
      {convite.convite.rotulo ? (
        <p className="abacato-entrada__sub">Convite: {convite.convite.rotulo}</p>
      ) : null}

      {/* Os limites, antes do primeiro campo. */}
      <div className="abacato-plano">
        <div className="abacato-plano__titulo">O que a conta {p.rotulo} inclui</div>
        <ul className="abacato-plano__lista">
          <li>Até <strong>{p.quadros}</strong> quadros de tarefas</li>
          <li>Até <strong>{p.projetos}</strong> projetos de documentação</li>
          <li>
            Compartilhar <strong>{p.quadrosCompartilhados}</strong> quadros, com até{" "}
            <strong>{p.membrosPorQuadro}</strong> pessoas em cada
          </li>
          <li>Até <strong>4 GB</strong> de arquivos</li>
        </ul>
        <p className="abacato-plano__nota">
          Você começa sem acesso a nada que já exista aqui dentro: vê apenas o que criar e o que
          alguém compartilhar com você.
        </p>
      </div>

      <label className="abacato-campo">
        <span className="abacato-campo__rotulo">Seu nome</span>
        <input className="abacato-campo__entrada" value={nome} onChange={(e) => setNome(e.target.value)}
               autoComplete="name" required />
      </label>

      <label className="abacato-campo">
        <span className="abacato-campo__rotulo">E-mail</span>
        <input className="abacato-campo__entrada" type="email" value={email}
               onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
      </label>

      <label className="abacato-campo">
        <span className="abacato-campo__rotulo">Senha</span>
        <input className="abacato-campo__entrada" type="password" value={senha}
               onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" required />
      </label>

      <label className="abacato-campo">
        <span className="abacato-campo__rotulo">Repita a senha</span>
        <input className="abacato-campo__entrada" type="password" value={repetida}
               onChange={(e) => setRepetida(e.target.value)} autoComplete="new-password" required />
      </label>

      {erro ? <div className="abacato-campo__erro">{erro}</div> : null}

      <button className="abacato-botao" type="submit" disabled={trabalhando}>
        {trabalhando ? "Enviando…" : "Pedir minha conta"}
      </button>

      <p className="abacato-entrada__sub" style={{ marginTop: 2 }}>
        Seu cadastro passa por aprovação — você poderá entrar assim que a equipe liberar.
      </p>
    </form>
  );
}
