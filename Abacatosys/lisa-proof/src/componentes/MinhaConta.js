"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { obter, mudar } from "@/lib/api.js";
import { chaveDeLogin, guardarSenha } from "@/lib/auth.js";
import Folha from "./Folha.js";
import { definirPersonagem } from "./Neuro.js";

/**
 * "Minha conta": nome, e-mail e trocar a senha (chamado de 20/10/2026). A conta é a do Abacato,
 * então a senha nova vale também no Abacato e na Lisa. Ao montar, também veste o Neuro do app
 * com o personagem que a pessoa escolheu no Reino.
 */
export default function MinhaConta({ comTexto = true }) {
  const [aberta, setAberta] = useState(false);
  const [eu, setEu] = useState(null);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [repetida, setRepetida] = useState("");
  const [erro, setErro] = useState("");
  const [pronto, setPronto] = useState(false);
  const [trabalhando, setTrabalhando] = useState(false);

  useEffect(() => {
    obter("/api/perfil").then((r) => { setEu(r); definirPersonagem(r.personagem); }).catch(() => {});
  }, []);

  function fechar() {
    setAberta(false);
    setErro(""); setPronto(false); setAtual(""); setNova(""); setRepetida("");
  }

  async function trocar(e) {
    e.preventDefault();
    setErro("");
    setPronto(false);
    if (!eu?.email) return setErro("não consegui saber o seu e-mail — recarregue a página");
    if (nova.length < 10) return setErro("a senha nova precisa de pelo menos 10 caracteres");
    if (nova !== repetida) return setErro("as duas senhas novas não são iguais");
    if (nova === atual) return setErro("a senha nova é igual à atual");
    setTrabalhando(true);
    try {
      // o e-mail entra no cálculo das duas (é o mesmo cálculo do login e do Abacato)
      const chaveAtual = await chaveDeLogin(eu.email, atual);
      const guardada = await guardarSenha(eu.email, nova);
      await mudar("/api/auth/senha", { chaveAtual, hash: guardada.hash, sal: guardada.sal, iteracoes: guardada.iteracoes });
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
      <button type="button" className="pf-reportar pf-conta" onClick={() => setAberta(true)} aria-label="Minha conta">
        <span aria-hidden="true">👤</span>{comTexto && " Minha conta"}
      </button>
      <Folha aberta={aberta} aoFechar={fechar} titulo="Minha conta">
        <div className="pf-reporte">
          <h2 className="pf-reporte__titulo">Minha conta</h2>
          {eu && <p className="pf-reporte__dica">{eu.nome} · {eu.email}</p>}
          <form className="pf-reporte" onSubmit={trocar} style={{ padding: 0 }}>
            <strong>Trocar a senha</strong>
            <p className="pf-reporte__dica" style={{ marginTop: -6 }}>A conta é a mesma do Abacato e da Lisa: a senha nova vale nos três.</p>
            <label className="pf-campo">
              <span className="pf-campo__rotulo">Senha atual</span>
              <input className="pf-campo__entrada" type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} required disabled={trabalhando} />
            </label>
            <label className="pf-campo">
              <span className="pf-campo__rotulo">Senha nova (pelo menos 10 caracteres)</span>
              <input className="pf-campo__entrada" type="password" autoComplete="new-password" minLength={10} value={nova} onChange={(e) => setNova(e.target.value)} required disabled={trabalhando} />
            </label>
            <label className="pf-campo">
              <span className="pf-campo__rotulo">Repita a senha nova</span>
              <input className="pf-campo__entrada" type="password" autoComplete="new-password" minLength={10} value={repetida} onChange={(e) => setRepetida(e.target.value)} required disabled={trabalhando} />
            </label>
            {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
            {pronto && <div className="pf-aviso pf-aviso--ok">Senha trocada! Use a nova da próxima vez que entrar (aqui, no Abacato e na Lisa).</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="submit" className="pf-botao" disabled={trabalhando}>{trabalhando ? "Trocando…" : "Trocar a senha"}</button>
              <button type="button" className="pf-botao pf-botao--sec" onClick={fechar}>Fechar</button>
            </div>
          </form>
          <p className="pf-reporte__dica">🎭 O personagem do Neuro se escolhe no <Link href="/reino#personagens" onClick={fechar}>Reino</Link>.</p>
        </div>
      </Folha>
    </>
  );
}
