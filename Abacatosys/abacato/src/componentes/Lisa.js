"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A Lisa, dentro do Abacato.
 *
 * Um botão que fica no canto e uma janela de conversa. Ela lê os quadros, os documentos e os
 * prazos de quem está falando — e cria tarefas, muda prazos e abre projetos a partir da
 * conversa.
 *
 * DUAS COISAS QUE A TELA PRECISA DEIXAR CLARAS, E NÃO SÃO ENFEITE:
 *
 *   O QUE ELA FEZ. Toda ação aparece marcada na conversa, com o nome do que mudou. Uma
 *   assistente que altera dados sem dizer o que alterou transforma cada resposta num "será?".
 *
 *   O QUE ELA NÃO FAZ. A primeira tela diz, em uma linha, que ela não apaga nada e não dá
 *   acesso a ninguém. Descobrir um limite quando se precisa dele é a pior hora.
 */

const SUGESTOES = [
  "O que está atrasado nos meus quadros?",
  "Crie uma tarefa para revisar o contrato, prazo sexta",
  "Que documentos temos sobre o CRM?",
];

/** Nomes das ferramentas em português, para a linha de "o que foi feito". */
const NOME_DA_ACAO = {
  criar_card: "tarefa criada",
  mudar_card: "tarefa alterada",
  criar_coluna: "coluna criada",
  criar_quadro: "quadro criado",
  criar_projeto: "projeto criado",
  criar_pasta: "pasta criada",
};

function descreverAcao(a) {
  const alvo = a.resultado?.card || a.resultado?.quadro || a.resultado?.projeto ||
    a.resultado?.coluna || a.resultado?.pasta;
  const nome = alvo?.titulo || alvo?.nome || "";
  return `${NOME_DA_ACAO[a.ferramenta] || a.ferramenta}${nome ? `: ${nome}` : ""}`;
}

export default function Lisa() {
  const [aberta, setAberta] = useState(false);
  const [mensagens, setMensagens] = useState([]);
  const [rascunho, setRascunho] = useState("");
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState("");
  const fim = useRef(null);
  const campo = useRef(null);

  // Rolar para o fim a cada mensagem — numa conversa, o que importa é sempre a última linha.
  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, pensando]);

  useEffect(() => {
    if (aberta) campo.current?.focus();
  }, [aberta]);

  // Esc fecha, mas não enquanto se digita: perder um parágrafo por um Esc distraído é o tipo
  // de coisa que faz alguém parar de usar a janela.
  useEffect(() => {
    if (!aberta) return;
    const tecla = (e) => {
      if (e.key !== "Escape") return;
      if (document.activeElement === campo.current && rascunho) return;
      setAberta(false);
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aberta, rascunho]);

  const perguntar = useCallback(async (texto) => {
    const pergunta = String(texto || "").trim();
    if (!pergunta || pensando) return;

    const historico = [...mensagens, { quem: "pessoa", texto: pergunta }];
    setMensagens(historico);
    setRascunho("");
    setPensando(true);
    setErro("");

    try {
      const r = await fetch("/api/lisa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mensagens: historico,
          // O fuso do NAVEGADOR, para "sexta que vem" virar o instante certo. O servidor roda
          // em UTC; sem isto, um prazo de 17h viraria 14h.
          fusoMinutos: new Date().getTimezoneOffset(),
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "não consegui responder agora");

      setMensagens([...historico, { quem: "lisa", texto: d.texto, acoes: d.acoes || [] }]);
      // Quando ela muda alguma coisa, a tela que está atrás está velha. Avisar é melhor que
      // recarregar por conta própria no meio de uma frase que a pessoa está lendo.
      if (d.acoes?.length) window.dispatchEvent(new CustomEvent("abacato:mudou"));
    } catch (e) {
      setErro(e.message);
    } finally {
      setPensando(false);
    }
  }, [mensagens, pensando]);

  if (!aberta) {
    return (
      <button type="button" className="abacato-lisa-botao" onClick={() => setAberta(true)}
        title="Conversar com a Lisa">
        <span className="abacato-lisa-botao__ponto" />
        Lisa
      </button>
    );
  }

  return (
    <div className="abacato-lisa" role="dialog" aria-modal="true" aria-label="Conversa com a Lisa">
      <div className="abacato-lisa__fundo" onClick={() => setAberta(false)} />
      <div className="abacato-lisa__caixa">
        <header className="abacato-lisa__topo">
          <span className="abacato-lisa__ponto" />
          <strong>Lisa</strong>
          <span className="abacato-dica">assistente do Abacato</span>
          <div style={{ flex: 1 }} />
          {mensagens.length > 0 && (
            <button type="button" className="abacato-botao abacato-botao--fantasma abacato-botao--pequeno"
              onClick={() => { setMensagens([]); setErro(""); }}>
              Limpar
            </button>
          )}
          <button type="button" className="abacato-icone" onClick={() => setAberta(false)} aria-label="fechar">✕</button>
        </header>

        <div className="abacato-lisa__conversa">
          {mensagens.length === 0 && (
            <div className="abacato-lisa__vazio">
              <p className="abacato-lisa__vazio-titulo">Pergunte sobre suas tarefas e documentos.</p>
              <p className="abacato-dica">
                Ela vê o que você vê — nada além disso. Não apaga nada e não dá acesso a ninguém.
              </p>
              <div className="abacato-lisa__sugestoes">
                {SUGESTOES.map((s) => (
                  <button key={s} type="button" className="abacato-lisa__sugestao" onClick={() => perguntar(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mensagens.map((m, i) => (
            <div key={i} className={`abacato-fala abacato-fala--${m.quem}`}>
              <div className="abacato-fala__texto">{m.texto}</div>
              {m.acoes?.length > 0 && (
                <div className="abacato-fala__acoes">
                  {m.acoes.map((a, j) => (
                    <span key={j} className="abacato-fala__acao">✓ {descreverAcao(a)}</span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {pensando && (
            <div className="abacato-fala abacato-fala--lisa">
              <div className="abacato-fala__texto abacato-fala__pensando">pensando…</div>
            </div>
          )}
          {erro && <div className="abacato-campo__erro">⚠ {erro}</div>}
          <div ref={fim} />
        </div>

        <form className="abacato-lisa__barra" onSubmit={(e) => { e.preventDefault(); perguntar(rascunho); }}>
          <textarea
            ref={campo}
            className="abacato-lisa__campo"
            rows={1}
            value={rascunho}
            placeholder="Pergunte ou peça alguma coisa…"
            onChange={(e) => setRascunho(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia; Shift+Enter quebra linha. É o que todo mundo espera de um chat,
              // e o contrário faz a pessoa mandar meia frase sem querer.
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); perguntar(rascunho); }
            }}
          />
          <button type="submit" className="abacato-botao" disabled={pensando || !rascunho.trim()}>
            {pensando ? "…" : "Enviar"}
          </button>
        </form>
      </div>
    </div>
  );
}
