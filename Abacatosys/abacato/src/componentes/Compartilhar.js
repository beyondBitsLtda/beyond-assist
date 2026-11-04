"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { obter, criar, remover } from "@/lib/api.js";
import { PAPEIS, PAPEL_PADRAO, descreverPapel } from "@/dominio/papeis.js";
import { Usuario } from "@/dominio/Quadro.js";

/**
 * Quem participa daqui, e com qual papel.
 *
 * Um painel só para quadro e para projeto de documentação: a pergunta é a mesma, e duas telas
 * quase iguais para a mesma tarefa é o que faz alguém aprender uma e estranhar a outra.
 *
 * O papel aparece com o que ele SIGNIFICA embaixo, e não só com o nome. "Comentarista" não diz
 * a ninguém que a pessoa não vai poder mudar um prazo — e descobrir isso depois, quando o
 * prazo não mudou, é o jeito ruim de aprender.
 */
export default function Compartilhar({ tipo, id, nome, aoFechar }) {
  const base = tipo === "projeto" ? "projetos" : "quadros";
  const [membros, setMembros] = useState(null);
  const [poderes, setPoderes] = useState({});
  const [pessoas, setPessoas] = useState([]);
  const [busca, setBusca] = useState("");
  const [papel, setPapel] = useState(PAPEL_PADRAO);
  const [erro, setErro] = useState("");
  const [trabalhando, setTrabalhando] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const [m, u] = await Promise.all([
        obter(`/api/${base}/${id}/membros`),
        obter("/api/usuarios"),
      ]);
      setMembros(m.membros);
      setPoderes(m.poderes || {});
      setPessoas(u.usuarios || []);
      setErro("");
    } catch (e) { setErro(e.message); }
  }, [base, id]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const tecla = (e) => {
      if (e.key !== "Escape") return;
      if (!["INPUT", "SELECT"].includes(document.activeElement?.tagName)) aoFechar();
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aoFechar]);

  // Quem ainda não está, e bate com o que foi digitado. Contas desativadas ficam de fora:
  // convidá-las criaria um acesso que não funciona e parece que funciona.
  const candidatos = useMemo(() => {
    const jaEstao = new Set((membros || []).map((m) => m.id));
    const termo = busca.trim().toLowerCase();
    return pessoas
      .filter((p) => p.ativo && !jaEstao.has(p.id))
      .filter((p) => !termo || p.nome.toLowerCase().includes(termo) || p.email.toLowerCase().includes(termo))
      .slice(0, 6);
  }, [pessoas, membros, busca]);

  async function convidar(pessoa) {
    setTrabalhando(pessoa.id);
    setErro("");
    try {
      const d = await criar(`/api/${base}/${id}/membros`, { usuarioId: pessoa.id, papel });
      setMembros(d.membros);
      setBusca("");
    } catch (e) { setErro(e.message); }
    finally { setTrabalhando(null); }
  }

  async function mudarPapel(pessoa, novo) {
    setTrabalhando(pessoa.id);
    setErro("");
    try {
      const d = await criar(`/api/${base}/${id}/membros`, { usuarioId: pessoa.id, papel: novo });
      setMembros(d.membros);
    } catch (e) { setErro(e.message); }
    finally { setTrabalhando(null); }
  }

  async function tirar(pessoa) {
    if (!window.confirm(`Tirar ${pessoa.nome} daqui?\n\nEla perde o acesso na hora. Nada do que ela escreveu é apagado.`)) return;
    setTrabalhando(pessoa.id);
    setErro("");
    try {
      const d = await remover(`/api/${base}/${id}/membros?usuario=${pessoa.id}`);
      setMembros(d.membros);
    } catch (e) { setErro(e.message); }
    finally { setTrabalhando(null); }
  }

  const podeConvidar = poderes.convidar;

  return (
    <div className="abacato-painel" role="dialog" aria-modal="true" aria-label={`Quem acessa ${nome}`}>
      <div className="abacato-painel__fundo" onClick={aoFechar} />
      <div className="abacato-painel__caixa abacato-painel__caixa--estreita">
        <header className="abacato-painel__cabecalho">
          <h2 className="abacato-painel__titulo abacato-painel__titulo--fixo">Quem acessa</h2>
          <button type="button" className="abacato-icone" onClick={aoFechar} aria-label="fechar">✕</button>
        </header>
        <p className="abacato-dica abacato-dica--bloco">
          {tipo === "projeto" ? "Projeto de documentação" : "Quadro"} <strong>{nome}</strong>.
          O acesso vale só para {tipo === "projeto" ? "este projeto" : "este quadro"} — cada um
          tem a sua lista.
        </p>

        {erro && <div className="abacato-campo__erro">⚠ {erro}</div>}

        <div className="abacato-painel__corpo">
          {podeConvidar && (
            <section className="abacato-bloco">
              <h3 className="abacato-bloco__titulo">Dar acesso a alguém</h3>

              <div className="abacato-campo">
                <span className="abacato-campo__rotulo">Com qual papel</span>
                <div className="abacato-papeis">
                  {PAPEIS.map((p) => (
                    <button
                      key={p.valor}
                      type="button"
                      className={`abacato-papel${papel === p.valor ? " abacato-papel--ativo" : ""}`}
                      onClick={() => setPapel(p.valor)}
                      aria-pressed={papel === p.valor}
                    >
                      <strong>{p.nome}</strong>
                      <span>{p.resumo}</span>
                    </button>
                  ))}
                </div>
                <p className="abacato-dica">{PAPEIS.find((p) => p.valor === papel)?.detalhe}</p>
              </div>

              <label className="abacato-campo">
                <span className="abacato-campo__rotulo">Quem</span>
                <input
                  className="abacato-campo__entrada"
                  placeholder="nome ou e-mail"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </label>

              {candidatos.map((p) => {
                const u = new Usuario(p);
                return (
                  <button key={p.id} type="button" className="abacato-pessoa-linha"
                    disabled={trabalhando === p.id} onClick={() => convidar(p)}>
                    <span className="abacato-avatar">{u.iniciais}</span>
                    <span className="abacato-pessoa-linha__meio">
                      <strong>{p.nome}</strong>
                      <span className="abacato-dica">{p.email}</span>
                    </span>
                    <span className="abacato-dica">{trabalhando === p.id ? "…" : "+ dar acesso"}</span>
                  </button>
                );
              })}

              {busca && !candidatos.length && (
                <p className="abacato-dica">
                  ninguém com esse nome. Pessoas novas são criadas em <strong>Pessoas</strong>, na
                  barra lateral.
                </p>
              )}
            </section>
          )}

          <section className="abacato-bloco">
            <h3 className="abacato-bloco__titulo">Com acesso ({membros?.length ?? "…"})</h3>
            {membros?.map((m) => {
              const u = new Usuario(m);
              const papelDele = descreverPapel(m.papel);
              return (
                <div key={m.id} className="abacato-pessoa-linha abacato-pessoa-linha--fixa">
                  <span className="abacato-avatar">{u.iniciais}</span>
                  <span className="abacato-pessoa-linha__meio">
                    <strong>{m.nome}{!m.ativo && " (desativada)"}</strong>
                    <span className="abacato-dica">{m.email}</span>
                  </span>

                  {m.ehDono ? (
                    <span className="abacato-etiqueta abacato-etiqueta--ok">{papelDele.nome}</span>
                  ) : podeConvidar ? (
                    <>
                      <select
                        className="abacato-selecao"
                        value={m.papel}
                        disabled={trabalhando === m.id}
                        onChange={(e) => mudarPapel(m, e.target.value)}
                        aria-label={`papel de ${m.nome}`}
                      >
                        {PAPEIS.map((p) => <option key={p.valor} value={p.valor}>{p.nome}</option>)}
                      </select>
                      <button type="button" className="abacato-icone" title={`tirar ${m.nome}`}
                        disabled={trabalhando === m.id} onClick={() => tirar(m)}>✕</button>
                    </>
                  ) : (
                    <span className="abacato-dica">{papelDele.nome}</span>
                  )}
                </div>
              );
            })}

            {membros?.length === 1 && (
              <p className="abacato-dica">
                Só você por enquanto. {podeConvidar ? "Use o campo acima para dar acesso a alguém." : ""}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
