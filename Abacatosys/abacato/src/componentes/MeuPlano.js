"use client";

import { useEffect, useState } from "react";
import { emTamanho } from "@/dominio/planos.js";

/**
 * Quanto a minha conta já usou.
 *
 * Existe por uma razão só: um limite que a pessoa não vê não é um limite, é uma surpresa. Sem
 * esta tela, a conta descobre o teto de 10 quadros ao tentar criar o décimo primeiro, no meio
 * de um trabalho, com uma mensagem vermelha.
 *
 * A barra fica laranja em 80% e vermelha no teto — o aviso chega antes do "não".
 *
 * Quem não tem limite nenhum (conta interna) vê o mesmo painel com "sem limite" no lugar do
 * número. Esconder a caixa inteira seria mais limpo e deixaria a pergunta "eu tenho limite?"
 * sem resposta na tela.
 */
export default function MeuPlano() {
  const [uso, setUso] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/conta/plano")
      .then((r) => r.json())
      .then((d) => (d.ok ? setUso(d.uso) : setErro(d.error || "não consegui ler o seu plano")))
      .catch(() => setErro("não consegui ler o seu plano"));
  }, []);

  if (erro) return <p className="abacato-plano__nota">{erro}</p>;
  if (!uso) return <p className="abacato-plano__nota">carregando…</p>;

  const medidas = [
    { nome: "Quadros de tarefas", m: uso.quadros },
    { nome: "Projetos de documentação", m: uso.projetos },
    { nome: "Quadros compartilhados", m: uso.quadrosCompartilhados },
    { nome: "Projetos compartilhados", m: uso.projetosCompartilhados },
    { nome: "Arquivos", m: uso.armazenamento, tamanho: true },
  ];

  return (
    <section>
      <div className="abacato-plano" style={{ marginBottom: 16 }}>
        <div className="abacato-plano__titulo">
          Sua conta é <span className={`abacato-selo abacato-selo--${uso.tipo}`}>{uso.plano}</span>
        </div>
        <p className="abacato-plano__nota" style={{ margin: 0 }}>
          {uso.tipo === "cliente" ? (
            <>
              Você vê apenas o que criou e o que alguém compartilhou com você. Cada quadro seu
              aceita até <strong>{uso.membrosPorQuadro}</strong> pessoas além de você, e cada
              projeto, até <strong>{uso.membrosPorProjeto}</strong>. Precisa de mais espaço?
              Fale com quem administra o Abacato.
            </>
          ) : (
            <>Conta interna: sem teto de quadros, projetos ou arquivos.</>
          )}
        </p>
      </div>

      <div className="abacato-medidas">
        {medidas.map(({ nome, m, tamanho }) => {
          const quase = !m.ilimitado && m.porcentagem >= 80 && !m.cheio;
          const classe = m.cheio ? " abacato-medida--cheio" : quase ? " abacato-medida--quase" : "";
          return (
            <div key={nome} className={`abacato-medida${classe}`}>
              <div className="abacato-medida__topo">
                <span className="abacato-medida__nome">{nome}</span>
                <span className="abacato-medida__valor">
                  {tamanho ? emTamanho(m.usado) : m.usado}
                  {m.ilimitado ? "" : ` / ${tamanho ? emTamanho(m.teto) : m.teto}`}
                </span>
              </div>
              <div className="abacato-medida__trilho">
                <div className="abacato-medida__barra" style={{ "--parte": `${m.ilimitado ? 0 : m.porcentagem}%` }} />
              </div>
              <p className="abacato-medida__nota">
                {m.ilimitado
                  ? "sem limite"
                  : m.cheio
                    ? "no limite — libere espaço para criar mais"
                    : tamanho
                      ? `${emTamanho(Math.max(0, m.restam))} livres`
                      : `${Math.max(0, m.restam)} restantes`}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
