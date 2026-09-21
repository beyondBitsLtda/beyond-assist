"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Quadro Gen — montar um quadro conversando.
 *
 * A pessoa diz sobre o que é, a Lisa pergunta o que falta, e no fim aparece a PRÉVIA do
 * quadro inteiro: colunas, cards e etiquetas, do jeito que vão ficar.
 *
 * A PRÉVIA É O PONTO DESTA TELA, e não a conversa.
 *
 * Seria mais curto a Lisa criar o quadro direto — ela já sabe. Mas um quadro é a forma de um
 * trabalho, e olhar depois de pronto não é a mesma coisa: ninguém apaga quinze cards para
 * recomeçar, todo mundo se conforma com o que veio. Aqui dá para ler tudo, pedir para mudar,
 * e só então criar.
 *
 * Enquanto não se clica em criar, nada existe no banco.
 */

const EXEMPLOS = [
  "Um quadro para acompanhar as obras dos clientes",
  "Quadro de recrutamento, da vaga aberta até a contratação",
  "Quero organizar a produção de conteúdo do mês",
];

export default function QuadroGen({ aoFechar }) {
  const router = useRouter();
  const [mensagens, setMensagens] = useState([]);
  const [rascunho, setRascunho] = useState("");
  const [proposta, setProposta] = useState(null);
  const [avisos, setAvisos] = useState([]);
  // Quantas vezes a proposta foi refeita. Sem isto, pedir uma mudança e receber um quadro
  // parecido não dá NENHUM sinal de que a mudança foi aplicada — foi exatamente o que
  // aconteceu: a pessoa pediu, a tela não se mexeu de forma visível, e ela ficou sem saber
  // se a Lisa tinha entendido.
  const [versao, setVersao] = useState(0);
  const [pensando, setPensando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");
  const fim = useRef(null);
  const campo = useRef(null);
  const previa = useRef(null);

  useEffect(() => { campo.current?.focus(); }, []);
  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, pensando]);

  // Proposta refeita volta ao topo. Sem isto, quem pediu uma mudança na terceira coluna
  // continuava olhando o meio da prévia anterior, sem sinal nenhum de que algo mudou.
  useEffect(() => {
    if (versao > 1) previa.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [versao]);

  useEffect(() => {
    const tecla = (e) => {
      if (e.key !== "Escape") return;
      // Com uma proposta na tela, Esc não fecha: perder um quadro inteiro que acabou de ser
      // desenhado por causa de uma tecla é caro demais.
      if (proposta || (document.activeElement === campo.current && rascunho)) return;
      aoFechar();
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aoFechar, proposta, rascunho]);

  const perguntar = useCallback(async (texto) => {
    const pergunta = String(texto || "").trim();
    if (!pergunta || pensando) return;

    const historico = [...mensagens, { quem: "pessoa", texto: pergunta }];
    setMensagens(historico);
    setRascunho("");
    setPensando(true);
    setErro("");

    try {
      const r = await fetch("/api/quadro-gen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mensagens: historico, fusoMinutos: new Date().getTimezoneOffset() }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "não consegui responder agora");

      setMensagens([...historico, { quem: "lisa", texto: d.texto }]);
      if (d.proposta) {
        setProposta(d.proposta);
        setAvisos(d.avisos || []);
        setVersao((v) => v + 1);
      }
    } catch (e) {
      setErro(e.message);
    } finally {
      setPensando(false);
    }
  }, [mensagens, pensando]);

  async function criar() {
    if (criando || !proposta) return;
    setCriando(true);
    setErro("");
    try {
      const r = await fetch("/api/quadro-gen/criar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposta, fusoMinutos: new Date().getTimezoneOffset() }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "não consegui criar o quadro");
      // Vai direto para o quadro criado. Voltar para a lista faria a pessoa procurar o que
      // ela acabou de fazer.
      router.push(`/quadros/${d.quadroId}`);
    } catch (e) {
      setErro(e.message);
      setCriando(false);
    }
  }

  const porColuna = proposta
    ? proposta.colunas.map((c) => ({
        nome: c.nome,
        cards: proposta.cards.filter((x) => x.coluna.toLowerCase() === c.nome.toLowerCase()),
      }))
    : [];
  const corDaEtiqueta = new Map((proposta?.etiquetas || []).map((e) => [e.nome.toLowerCase(), e.cor]));
  const resumo = proposta
    ? `${proposta.colunas.length} coluna(s), ${proposta.cards.length} card(s)`
    : "";

  return (
    <div className="abacato-painel" role="dialog" aria-modal="true" aria-label="Montar um quadro com a Lisa">
      <div className="abacato-painel__fundo" onClick={aoFechar} />
      <div className="abacato-painel__caixa abacato-painel__caixa--larga abacato-gen">
        <header className="abacato-painel__cabecalho">
          <h2 className="abacato-painel__titulo abacato-painel__titulo--fixo">Montar um quadro</h2>
          <span className="abacato-dica">com a Lisa</span>
          <div style={{ flex: 1 }} />
          <button type="button" className="abacato-icone" onClick={aoFechar} aria-label="fechar">✕</button>
        </header>

        <div className={`abacato-gen__corpo${proposta ? " abacato-gen__corpo--com-previa" : ""}`}>
          {/* ------------------------------------------------ a conversa */}
          <div className="abacato-gen__conversa">
            {mensagens.length === 0 && (
              <div className="abacato-gen__vazio">
                <p className="abacato-lisa__vazio-titulo">Sobre o que é o quadro?</p>
                <p className="abacato-dica">
                  Ela pergunta o que falta e monta uma proposta. Nada é criado até você aprovar.
                </p>
                <div className="abacato-lisa__sugestoes">
                  {EXEMPLOS.map((s) => (
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

          {/* ------------------------------------------------ a prévia */}
          {proposta && (
            <div className="abacato-gen__previa" ref={previa}>
              <div className="abacato-gen__previa-topo">
                <div className="abacato-gen__previa-nome">
                  <strong>{proposta.nome}</strong>
                  {/* O selo muda a cada versão: é o sinal de que o pedido foi atendido. */}
                  {versao > 1 && (
                    <span className="abacato-etiqueta abacato-etiqueta--ok">
                      atualizada ({versao}ª versão)
                    </span>
                  )}
                </div>
                {proposta.descricao && <span className="abacato-dica">{proposta.descricao}</span>}
              </div>

              {proposta.etiquetas.length > 0 && (
                <div className="abacato-gen__etiquetas">
                  {proposta.etiquetas.map((e) => (
                    <span key={e.nome} className="abacato-gen__etiqueta" style={{ background: e.cor }}>
                      {e.nome}
                    </span>
                  ))}
                </div>
              )}

              <div className="abacato-gen__colunas">
                {porColuna.map((c) => (
                  <div key={c.nome} className="abacato-gen__coluna">
                    <div className="abacato-gen__coluna-nome">
                      {c.nome} <span className="abacato-dica">{c.cards.length}</span>
                    </div>
                    {c.cards.map((card, i) => (
                      <div key={i} className="abacato-gen__card">
                        {card.etiqueta && (
                          <span className="abacato-gen__marca"
                            style={{ background: corDaEtiqueta.get(card.etiqueta.toLowerCase()) }} />
                        )}
                        <span className="abacato-gen__card-titulo">{card.titulo}</span>
                        {card.prazoEmDias != null && (
                          <span className="abacato-dica">
                            {card.prazoEmDias === 0 ? "hoje" : `${card.prazoEmDias}d`}
                          </span>
                        )}
                      </div>
                    ))}
                    {c.cards.length === 0 && <div className="abacato-dica">(vazia)</div>}
                  </div>
                ))}
              </div>

              {avisos.length > 0 && (
                <div className="abacato-aviso" style={{ marginTop: 10 }}>
                  {avisos.join(" · ")}
                </div>
              )}
            </div>
          )}
        </div>

        {/* A BARRA DE CRIAR FICA FORA DA PRÉVIA, e presa embaixo.
            Ela estava no fim da prévia, que rola — num quadro com nove cards o botão caía
            abaixo do corte e a pessoa não via nem que ele existia. O que decide a tela não
            pode depender de rolar até o fim para aparecer. */}
        {proposta && (
          <div className="abacato-gen__acoes">
            <span className="abacato-dica">
              {resumo} · nada disso existe ainda
            </span>
            <button type="button" className="abacato-botao" onClick={criar} disabled={criando || pensando}>
              {criando ? "Criando…" : "Criar o quadro"}
            </button>
          </div>
        )}

        <form className="abacato-lisa__barra" onSubmit={(e) => { e.preventDefault(); perguntar(rascunho); }}>
          <textarea
            ref={campo}
            className="abacato-lisa__campo"
            rows={1}
            value={rascunho}
            placeholder={proposta ? "Peça uma mudança…" : "Sobre o que é o quadro?"}
            onChange={(e) => setRascunho(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); perguntar(rascunho); }
            }}
          />
          <button type="submit" className="abacato-botao abacato-botao--fantasma"
            disabled={pensando || !rascunho.trim()}>
            {pensando ? "…" : "Enviar"}
          </button>
        </form>
      </div>
    </div>
  );
}
