"use client";

import { useState } from "react";
import Link from "next/link";
import { criar } from "@/lib/api.js";
import { formatarDia } from "@/dominio/datas.js";
import { NOTA_DE_APROVACAO } from "@/dominio/pratica.js";
import Explicacao, { emLinha } from "./Explicacao.js";
import Neuro, { reagir, comemorar, celebrar } from "./Neuro.js";
import { Barra, useAviso } from "./Pecas.js";

const LETRAS = ["A", "B", "C", "D"];

// ================================================================ quiz

/**
 * O quiz, uma pergunta por vez, como no Duolingo: escolhe, vê na hora se acertou (com a
 * explicação) e segue. A correção é do servidor — a tela só fica sabendo da resposta certa
 * depois de responder.
 */
export function Quiz({ desafio }) {
  const [perguntas, setPerguntas] = useState(desafio.perguntas);
  const primeiraAberta = perguntas.findIndex((p) => !p.respondida);
  const [indice, setIndice] = useState(primeiraAberta === -1 ? perguntas.length : primeiraAberta);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null); // resposta do servidor da pergunta atual
  const [final, setFinal] = useState(null);
  const [erro, setErro] = useState("");
  const [revendo, setRevendo] = useState(false);
  const [Aviso, avisar] = useAviso();

  const respondidas = perguntas.filter((p) => p.respondida).length;
  const acabou = indice >= perguntas.length;

  async function escolher(opcao) {
    if (enviando || resultado) return;
    setEnviando(true);
    setErro("");
    try {
      const r = await criar(`/api/desafios/${desafio.id}/responder`, { indice, escolha: opcao });
      setPerguntas((ps) => ps.map((p, i) => (i === indice ? { ...p, respondida: true, escolha: opcao, correta: r.correta, explicacao: r.explicacao } : p)));
      setResultado(r);
      if (r.acertou) reagir("feliz", ["Isso aí!", "Mandou bem!", "Certinho! 🎯", "Você sabe das coisas!"][indice % 4]);
      else reagir("triste", "Quase! Lê a explicação que fica fácil.");
      if (r.terminou) setFinal(r);
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  function continuar() {
    setResultado(null);
    const proximo = indice + 1;
    setIndice(proximo);
    if (proximo >= perguntas.length && final) {
      // Ofensiva, meta e conquistas abrem a festa em tela cheia; sem nada disso, a comemoração
      // do gabarito (ou só os pontos) fica no próprio Neuro.
      const festejou = celebrar(final);
      if (!festejou && final.acertos === final.total) comemorar(`Gabaritou! +${final.pontos} pontos 🎉`);
      else if (!festejou && final.pontos > 0) avisar(`+${final.pontos} pontos`);
    }
  }

  if (acabou || revendo) {
    const acertos = perguntas.filter((p) => p.escolha === p.correta).length;
    const pct = Math.round((acertos / perguntas.length) * 100);
    return (
      <div className="quiz">
        {!revendo && (
          <div className="pf-cartao quiz__fim">
            <Neuro
              humor={pct === 100 ? "comemorando" : pct >= NOTA_DE_APROVACAO ? "feliz" : "pensando"}
              fala={pct === 100 ? "Perfeito! Gabaritou!" : pct >= NOTA_DE_APROVACAO ? "Muito bom! Amanhã tem mais." : "Errar faz parte. Revisa as explicações e amanhã você arrasa!"}
              tamanho={130}
              lado="cima"
              ouvir
            />
            <div className="quiz__placar">{acertos}<small>/{perguntas.length}</small></div>
            <p className="pf-estat__nota">acertos · {final ? final.pontos : desafio.pontos} pontos</p>
            <div className="pf-acoes" style={{ justifyContent: "center" }}>
              <button type="button" className="pf-botao pf-botao--sec" onClick={() => setRevendo(true)}>Ver respostas</button>
              <Link className="pf-botao" href="/pratica">Voltar à prática</Link>
            </div>
          </div>
        )}
        {revendo && (
          <>
            <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setRevendo(false)}>← Resultado</button>
            {perguntas.map((p, i) => (
              <div key={i} className="pf-cartao quiz__revisao">
                <p className="pf-campo__rotulo">Pergunta {i + 1} · {p.escolha === p.correta ? "✓ acertou" : "✗ errou"}</p>
                <Explicacao texto={p.pergunta} className="quiz__pergunta" />
                <ul className="quiz__lista-revisao">
                  {p.opcoes.map((o, j) => (
                    <li key={j} className={j === p.correta ? "quiz__ok" : j === p.escolha ? "quiz__erro" : ""}>
                      <b>{LETRAS[j]}</b> {emLinha(o)}
                    </li>
                  ))}
                </ul>
                {p.explicacao && <p className="pf-estat__nota">{emLinha(p.explicacao)}</p>}
              </div>
            ))}
          </>
        )}
        {Aviso}
      </div>
    );
  }

  const p = perguntas[indice];
  return (
    <div className="quiz">
      <div className="quiz__topo">
        <Link href="/pratica" className="quiz__sair" aria-label="Sair do quiz">✕</Link>
        <div style={{ flex: 1 }}><Barra valor={respondidas} total={perguntas.length} rotulo="Progresso do quiz" /></div>
        <span className="quiz__contador">{indice + 1}/{perguntas.length}</span>
      </div>

      <div className="quiz__neuro"><Neuro humor="pensando" tamanho={84} ouvir lado="direita" /></div>

      <Explicacao texto={p.pergunta} className="quiz__pergunta" />

      <div className="quiz__opcoes" role="group" aria-label="Opções">
        {p.opcoes.map((o, j) => {
          let classe = "quiz__opcao";
          if (resultado) {
            if (j === resultado.correta) classe += " quiz__opcao--certa";
            else if (j === p.escolha) classe += " quiz__opcao--errada";
          }
          return (
            <button key={j} type="button" className={classe} onClick={() => escolher(j)} disabled={enviando || Boolean(resultado)}>
              <span className="quiz__letra">{LETRAS[j]}</span>
              <span>{emLinha(o)}</span>
            </button>
          );
        })}
      </div>

      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}

      {resultado && (
        <div className={`quiz__retorno ${resultado.acertou ? "quiz__retorno--certo" : "quiz__retorno--errado"}`}>
          <div>
            <strong>{resultado.acertou ? "Correto! 🎉" : `Resposta certa: ${LETRAS[resultado.correta]}`}</strong>
            {resultado.explicacao && <p>{emLinha(resultado.explicacao)}</p>}
          </div>
          <button type="button" className="pf-botao" onClick={continuar}>
            {indice + 1 >= perguntas.length ? "Ver resultado" : "Continuar"}
          </button>
        </div>
      )}
      {Aviso}
    </div>
  );
}

// ================================================================ avaliação

export function Avaliacao({ avaliacao, nota }) {
  if (!avaliacao) return null;
  const valor = nota ?? avaliacao.nota;
  const ok = valor >= NOTA_DE_APROVACAO;
  return (
    <div className="pf-cartao avaliacao">
      <div className="avaliacao__topo">
        <div className={`avaliacao__nota${ok ? " avaliacao__nota--ok" : ""}`}>{valor}</div>
        <div>
          <span className={`pf-pilula ${ok ? "pf-pilula--verde" : "pf-pilula--atencao"}`}>{ok ? "Aprovado" : `Ainda não (mínimo ${NOTA_DE_APROVACAO})`}</span>
          {avaliacao.comentario && <p style={{ margin: "8px 0 0" }}>{avaliacao.comentario}</p>}
        </div>
      </div>
      {avaliacao.requisitos?.length > 0 && (
        <ul className="avaliacao__lista">
          {avaliacao.requisitos.map((r, i) => (
            <li key={i} className={r.atendido ? "avaliacao__ok" : "avaliacao__falta"}>
              <b aria-hidden="true">{r.atendido ? "✓" : "✗"}</b>
              <span>{r.requisito}{r.observacao && <small>{r.observacao}</small>}</span>
            </li>
          ))}
        </ul>
      )}
      {avaliacao.pontosFortes?.length > 0 && (
        <>
          <p className="pf-campo__rotulo">O que ficou bom</p>
          <ul className="avaliacao__simples">{avaliacao.pontosFortes.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </>
      )}
      {avaliacao.melhorias?.length > 0 && (
        <>
          <p className="pf-campo__rotulo">Para melhorar</p>
          <ul className="avaliacao__simples">{avaliacao.melhorias.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </>
      )}
    </div>
  );
}

function Entrega({ desafio, campo, rotulo, aoEnviar, conteudoInicial, placeholder, multilinha }) {
  const [valor, setValor] = useState(conteudoInicial || "");
  const [estado, setEstado] = useState({ status: desafio.status, nota: desafio.nota, tentativas: desafio.tentativas, avaliacao: desafio.avaliacao });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [Aviso, avisar] = useAviso();

  const encerrado = estado.status === "concluido";
  const restantes = Math.max(0, (desafio.maxTentativas || 0) - estado.tentativas);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    reagir("pensando", campo === "repo" ? "Lendo o seu repositório com calma…" : "Lendo o seu código…", 60000);
    try {
      const r = await aoEnviar(valor);
      setEstado({ status: r.concluido ? "concluido" : "em_andamento", nota: r.nota, tentativas: r.tentativas, avaliacao: r.avaliacao });
      celebrar(r);
      if (r.avaliacao.aprovado) comemorar(`Aprovado com ${r.avaliacao.nota}! ${r.pontos > 0 ? `+${r.pontos} pontos` : ""}`);
      else reagir("triste", r.restantes ? `Faltou pouco! Você ainda tem ${r.restantes} tentativa(s).` : "Não foi dessa vez, mas olha quanta coisa boa na avaliação.", 6000);
      if (r.pontos > 0 && !r.avaliacao.aprovado) avisar(`+${r.pontos} pontos`);
    } catch (falha) {
      setErro(falha.message);
      reagir("surpreso", "Ops, algo deu errado no envio.");
    } finally {
      setEnviando(false);
    }
  }

  function tecla(e) {
    // Tab no editor escreve dois espaços em vez de pular para o próximo campo.
    if (!multilinha || e.key !== "Tab") return;
    e.preventDefault();
    const el = e.target;
    const { selectionStart: a, selectionEnd: b } = el;
    const novo = `${valor.slice(0, a)}  ${valor.slice(b)}`;
    setValor(novo);
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = a + 2; });
  }

  return (
    <>
      <form className="pf-cartao entrega" onSubmit={enviar}>
        <label className="pf-campo">
          <span className="pf-campo__rotulo">{rotulo}</span>
          {multilinha ? (
            <textarea className="entrega__codigo" value={valor} onChange={(e) => setValor(e.target.value)} onKeyDown={tecla}
              placeholder={placeholder} spellCheck={false} disabled={encerrado || enviando} rows={14} />
          ) : (
            <input className="pf-campo__entrada" type="url" value={valor} onChange={(e) => setValor(e.target.value)}
              placeholder={placeholder} disabled={encerrado || enviando} required />
          )}
        </label>
        {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
        <div className="pf-acoes" style={{ alignItems: "center" }}>
          {!encerrado && (
            <button type="submit" className="pf-botao" disabled={enviando || !valor.trim()}>
              {enviando ? "A Lisa está avaliando…" : estado.tentativas ? "Enviar de novo" : "Enviar para a Lisa avaliar"}
            </button>
          )}
          <span className="pf-estat__nota" style={{ margin: 0 }}>
            {encerrado ? "Desafio encerrado." : `Tentativa ${estado.tentativas + 1} de ${desafio.maxTentativas} · vale a melhor nota`}
            {!encerrado && restantes <= 1 && estado.tentativas > 0 ? " · última chance!" : ""}
          </span>
        </div>
      </form>
      <Avaliacao avaliacao={estado.avaliacao} nota={estado.nota} />
      {Aviso}
    </>
  );
}

// ================================================================ exercício

export function Exercicio({ desafio }) {
  const c = desafio.conteudo;
  return (
    <div className="desafio">
      <div className="pf-cartao">
        <div className="pf-assunto__chips">
          <span className="pf-pilula pf-pilula--tema">{desafio.tema}</span>
          {c.linguagem && <span className="pf-pilula">{c.linguagem}</span>}
          <span className="pf-pilula">{formatarDia(desafio.periodo, { comSemana: true })}</span>
        </div>
        <Explicacao texto={c.enunciado} className="desafio__texto" />
        {c.exemplo && (
          <>
            <p className="pf-campo__rotulo">Exemplo</p>
            <pre className="desafio__exemplo">{c.exemplo}</pre>
          </>
        )}
        {c.dicas.length > 0 && (
          <div className="desafio__dicas">
            {c.dicas.map((d, i) => (
              <details key={i}><summary>Dica {i + 1}</summary><p>{emLinha(d)}</p></details>
            ))}
          </div>
        )}
        {c.criterios.length > 0 && (
          <>
            <p className="pf-campo__rotulo">Como a Lisa vai corrigir</p>
            <ul className="avaliacao__simples">{c.criterios.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </>
        )}
      </div>
      <Entrega
        desafio={desafio}
        campo="codigo"
        multilinha
        rotulo="Sua solução"
        placeholder={`// escreva aqui a sua solução${c.linguagem ? ` em ${c.linguagem}` : ""}`}
        conteudoInicial={desafio.resposta?.codigo}
        aoEnviar={(codigo) => criar(`/api/desafios/${desafio.id}/enviar`, { codigo })}
      />
    </div>
  );
}

// ================================================================ projeto

export function Projeto({ desafio }) {
  const c = desafio.conteudo;
  return (
    <div className="desafio">
      <div className="pf-cartao">
        <div className="pf-assunto__chips">
          <span className="pf-pilula pf-pilula--tema">{desafio.tema}</span>
          <span className="pf-pilula">{desafio.nome}</span>
          <span className="pf-pilula pf-pilula--atencao">até {formatarDia(desafio.ate, { comSemana: true })}</span>
        </div>
        {c.contexto && <Explicacao texto={c.contexto} className="desafio__texto" />}
        <p className="pf-campo__rotulo">Requisitos</p>
        <ol className="desafio__requisitos">{c.requisitos.map((t, i) => <li key={i}>{emLinha(t)}</li>)}</ol>
        {c.extras.length > 0 && (
          <>
            <p className="pf-campo__rotulo">Desafios extras (opcionais)</p>
            <ul className="avaliacao__simples">{c.extras.map((t, i) => <li key={i}>{emLinha(t)}</li>)}</ul>
          </>
        )}
        {c.entrega && (
          <>
            <p className="pf-campo__rotulo">Entrega</p>
            <p style={{ margin: 0 }}>{emLinha(c.entrega)}</p>
          </>
        )}
        {c.criterios.length > 0 && (
          <>
            <p className="pf-campo__rotulo">Como a Lisa vai avaliar</p>
            <ul className="avaliacao__simples">{c.criterios.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </>
        )}
      </div>
      <Entrega
        desafio={desafio}
        campo="repo"
        rotulo="Link do repositório público no GitHub"
        placeholder="https://github.com/seu-usuario/seu-projeto"
        conteudoInicial={desafio.resposta?.repo}
        aoEnviar={(repo) => criar(`/api/desafios/${desafio.id}/enviar`, { repo })}
      />
    </div>
  );
}
