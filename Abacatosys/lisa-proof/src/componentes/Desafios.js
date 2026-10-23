"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { criar } from "@/lib/api.js";
import { formatarDia } from "@/dominio/datas.js";
import { NOTA_DE_APROVACAO, podeReenviar, COMPLEXIDADES, ORDEM_DAS_COMPLEXIDADES } from "@/dominio/pratica.js";
import { execucaoDoExercicio } from "@/dominio/execucao.js";
import { rodarCodigo } from "./codigo/rodar.js";
import Explicacao, { emLinha } from "./Explicacao.js";
import Codigo from "./codigo/Codigo.js";
import EditorDeCodigo from "./codigo/EditorDeCodigo.js";
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
      if (!festejou && final.assunto?.concluido) comemorar(`Assunto concluído: ${final.assunto.titulo}! ✅`);
      else if (!festejou && final.acertos === final.total) comemorar(`Gabaritou! +${final.pontos} pontos 🎉`);
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
            {final?.assunto?.concluido && <div className="pf-aviso pf-aviso--ok">✅ Assunto concluído: <strong>{final.assunto.titulo}</strong> — teoria e quiz em dia.</div>}
            {final?.assunto?.faltaTeoria && <div className="pf-aviso">Quiz aprovado! Agora termine a teoria (as tarefas) de <strong>{final.assunto.titulo}</strong> para concluir o assunto.</div>}
            {final?.assunto?.reprovado && <div className="pf-aviso">Para concluir o assunto, o quiz precisa de {final.assunto.precisa}% de acertos. Dá para tentar outra rodada hoje (na Prática) ou amanhã.</div>}
            <div className="pf-acoes" style={{ justifyContent: "center" }}>
              <button type="button" className="pf-botao pf-botao--sec" onClick={() => setRevendo(true)}>Ver respostas</button>
              <Link className="pf-botao" href="/pratica">Voltar à prática</Link>
            </div>
            {(desafio.rodada || 1) < (desafio.maxRodadas || 1) && (
              <p className="pf-estat__nota" style={{ textAlign: "center" }}>
                Quer mais? Na Prática dá para fazer mais {(desafio.maxRodadas || 1) - (desafio.rodada || 1)} quiz(zes) hoje, valendo metade dos pontos.
              </p>
            )}
          </div>
        )}
        {revendo && (
          <>
            <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={() => setRevendo(false)}>← Resultado</button>
            {perguntas.map((p, i) => (
              <div key={i} className="pf-cartao quiz__revisao">
                <p className="pf-campo__rotulo">Pergunta {i + 1} · {p.escolha === p.correta ? "✓ acertou" : "✗ errou"}</p>
                <Explicacao texto={p.pergunta} className="quiz__pergunta" linguagem={p.linguagem || desafio.tema} />
                {p.codigo && <Codigo texto={p.codigo} linguagem={p.linguagem || desafio.tema} />}
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

      <Explicacao texto={p.pergunta} className="quiz__pergunta" linguagem={p.linguagem || desafio.tema} />
      {p.codigo && <Codigo texto={p.codigo} linguagem={p.linguagem || desafio.tema} />}
      {p.faltouCodigo && (
        <div className="pf-aviso pf-aviso--erro">
          O código desta pergunta não chegou — foi uma falha da Lisa ao montar este quiz (já corrigida
          para os próximos). Se quiser, use “Reportar problema”.
        </div>
      )}

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
      {avaliacao.extras?.length > 0 && (
        <ul className="avaliacao__lista">
          {avaliacao.extras.map((r, i) => (
            <li key={i} className={r.atendido ? "avaliacao__ok" : "avaliacao__falta"}>
              <b aria-hidden="true">{r.atendido ? "✓" : "–"}</b>
              <span>Extra: {r.requisito}{r.observacao && <small>{r.observacao}</small>}</span>
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

function Entrega({ desafio, campo, rotulo, aoEnviar, aoAvaliar, conteudoInicial, placeholder, multilinha, linguagem }) {
  const [valor, setValor] = useState(conteudoInicial || "");
  const [estado, setEstado] = useState({ status: desafio.status, nota: desafio.nota, tentativas: desafio.tentativas, avaliacao: desafio.avaliacao, completo: desafio.completo });
  const projeto = desafio.tipo !== "exercicio";
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [Aviso, avisar] = useAviso();
  const formulario = useRef(null);

  // Encerrado = não dá mais para enviar. O exercício aprovado continua aberto enquanto sobrar
  // tentativa (vale a melhor nota) — ver podeReenviar.
  const encerrado = !podeReenviar({ tipo: desafio.tipo, tentativas: estado.tentativas, status: estado.status, completo: estado.completo });
  const aprovado = (estado.nota ?? 0) >= NOTA_DE_APROVACAO;
  const restantes = Math.max(0, (desafio.maxTentativas || 0) - estado.tentativas);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    reagir("pensando", campo === "repo" ? "Lendo o seu repositório com calma…" : "Lendo o seu código…", 60000);
    try {
      const r = await aoEnviar(valor);
      setEstado({ status: r.concluido ? "concluido" : "em_andamento", nota: r.nota, tentativas: r.tentativas, avaliacao: r.avaliacao, completo: r.completo });
      aoAvaliar?.(r);
      celebrar(r);
      if (projeto) {
        // projeto em partes: o que conta é o que esta entrega garantiu de NOVO
        if (r.completo) comemorar(`Projeto completo! ${r.pontos > 0 ? `+${r.pontos} pontos` : ""}`);
        else if (r.pontos > 0) comemorar(`+${r.pontos} pontos garantidos!`);
        else reagir("pensando", "Nada novo garantido desta vez — veja na avaliação o que faltou.", 6000);
      } else if (r.avaliacao.aprovado) {
        comemorar(`Aprovado com ${r.avaliacao.nota}! ${r.pontos > 0 ? `+${r.pontos} pontos` : ""}`);
        if (r.reenviar && r.avaliacao.nota < 100) setTimeout(() => reagir("feliz", `Quer buscar uma nota maior? Ainda tem ${r.restantes} tentativa(s) — vale a melhor.`, 6000), 4200);
      }
      else reagir("triste", r.restantes ? `Faltou pouco! Você ainda tem ${r.restantes} tentativa(s).` : "Não foi dessa vez, mas olha quanta coisa boa na avaliação.", 6000);
      if (r.pontos > 0 && !r.avaliacao.aprovado) avisar(`+${r.pontos} pontos`);
      // a trilha amarrada: o projeto aprovado abre a semana seguinte; o final fecha a trilha
      if (r.semana?.trilhaConcluida) setTimeout(() => comemorar("Trilha concluída! 🏆"), 4400);
      else if (r.semana?.liberou) setTimeout(() => comemorar(`Semana ${r.semana.liberou} liberada! 🔓`), 4400);
      else if (r.semana?.podeOutro) setTimeout(() => reagir("pensando", "As entregas acabaram sem aprovação — na trilha dá para gerar um projeto novo para esta semana.", 7000), 4400);
    } catch (falha) {
      setErro(falha.message);
      reagir("surpreso", "Ops, algo deu errado no envio.");
    } finally {
      setEnviando(false);
    }
  }

  // Ctrl+Enter no editor envia, como o botão
  function enviarPeloAtalho() {
    if (!encerrado && !enviando && valor.trim()) formulario.current?.requestSubmit();
  }

  return (
    <>
      <form ref={formulario} className="pf-cartao entrega" onSubmit={enviar}>
        {multilinha ? (
          <div className="pf-campo">
            <span className="pf-campo__rotulo">{rotulo}</span>
            <EditorDeCodigo valor={valor} aoMudar={setValor} linguagem={linguagem} placeholder={placeholder}
              desabilitado={encerrado || enviando} aoCtrlEnter={enviarPeloAtalho} rotulo={rotulo} />
            {desafio.tipo === "exercicio" && <Rodar linguagem={desafio.conteudo?.linguagem} tema={desafio.tema} codigo={valor} />}
          </div>
        ) : (
          <label className="pf-campo">
            <span className="pf-campo__rotulo">{rotulo}</span>
            <input className="pf-campo__entrada" type="url" value={valor} onChange={(e) => setValor(e.target.value)}
              placeholder={placeholder} disabled={encerrado || enviando} required />
          </label>
        )}
        {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
        <div className="pf-acoes" style={{ alignItems: "center" }}>
          {!encerrado && (
            <button type="submit" className="pf-botao" disabled={enviando || !valor.trim()}>
              {enviando ? "A Lisa está avaliando…" : !estado.tentativas ? "Enviar para a Lisa avaliar" : projeto ? "Entregar de novo (soma o que for novo)" : aprovado ? "Tentar uma nota maior" : "Enviar de novo"}
            </button>
          )}
          <span className="pf-estat__nota" style={{ margin: 0 }}>
            {projeto
              ? (encerrado
                ? (estado.completo ? "Projeto completo — tudo entregue!" : "As entregas deste projeto acabaram.")
                : `Entrega ${estado.tentativas + 1} de ${desafio.maxTentativas} · cada requisito novo soma os pontos dele`)
              : encerrado
                ? (aprovado ? `Concluído com nota ${estado.nota}.` : "Desafio encerrado.")
                : `${aprovado ? `Aprovado com ${estado.nota} · ` : ""}Tentativa ${estado.tentativas + 1} de ${desafio.maxTentativas} · vale a melhor nota`}
            {!encerrado && restantes <= 1 && estado.tentativas > 0 ? " · última chance!" : ""}
          </span>
        </div>
      </form>
      <Avaliacao avaliacao={estado.avaliacao} nota={estado.nota} />
      {Aviso}
    </>
  );
}

// ================================================================ rodar o código

/**
 * "▶ Rodar": roda o código do exercício e mostra a saída, antes de enviar para a Lisa (pedido de
 * 21/10/2026). JavaScript e SQL rodam no navegador; as outras linguagens, num compilador on-line.
 */
function Rodar({ linguagem, tema, codigo }) {
  const exec = execucaoDoExercicio(linguagem, tema);
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [comEntrada, setComEntrada] = useState(false);
  const [entrada, setEntrada] = useState("");

  if (!exec) return <p className="rodar__nota">O botão Rodar ainda não funciona para esta linguagem.</p>;

  async function rodar() {
    setRodando(true);
    setResultado(await rodarCodigo({ linguagem: linguagem || exec.chave, tema, codigo, entrada: comEntrada ? entrada : "" }));
    setRodando(false);
  }

  return (
    <div className="rodar">
      <div className="rodar__barra">
        <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={rodar} disabled={rodando || !codigo.trim()}>
          {rodando ? "Rodando…" : "▶ Rodar"}
        </button>
        <span className="rodar__onde">{exec.rotulo} · {exec.onde === "navegador" ? "roda aqui no navegador" : "roda num compilador on-line"}</span>
        {exec.onde === "servidor" && (
          <button type="button" className="rodar__link" onClick={() => setComEntrada((v) => !v)} aria-expanded={comEntrada}>
            {comEntrada ? "tirar a entrada" : "+ entrada do teclado"}
          </button>
        )}
      </div>
      {comEntrada && (
        <label className="pf-campo">
          <span className="pf-campo__rotulo">Entrada do programa (o que seria digitado no teclado, uma linha por leitura)</span>
          <textarea className="pf-campo__entrada rodar__entrada" rows={3} value={entrada} onChange={(e) => setEntrada(e.target.value)} />
        </label>
      )}
      {resultado && (
        <div className="rodar__saida" aria-live="polite">
          <div className="rodar__topo">
            <span>Saída</span>
            {resultado.ms > 0 && <span>{(resultado.ms / 1000).toFixed(1).replace(".", ",")} s</span>}
          </div>
          {resultado.linhas.map((l, i) => <pre key={i} className={`rodar__linha rodar__linha--${l.tipo}`}>{l.texto}</pre>)}
          {(resultado.tabelas || []).map((t, i) => (
            <div key={i} className="rodar__tabela-caixa">
              <table className="rodar__tabela">
                <thead><tr>{t.colunas.map((c, k) => <th key={k}>{c}</th>)}</tr></thead>
                <tbody>{t.linhas.map((linha, j) => <tr key={j}>{linha.map((v, k) => <td key={k}>{v === null ? "NULL" : String(v)}</td>)}</tr>)}</tbody>
              </table>
              {t.total > t.linhas.length && <p className="rodar__nota">mostrando {t.linhas.length} de {t.total} linhas</p>}
            </div>
          ))}
        </div>
      )}
    </div>
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
        <Explicacao texto={c.enunciado} className="desafio__texto" linguagem={c.linguagem} />
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
        linguagem={c.linguagem || desafio.tema}
        rotulo="Sua solução"
        placeholder={`// escreva aqui a sua solução${c.linguagem ? ` em ${c.linguagem}` : ""}`}
        conteudoInicial={desafio.resposta?.codigo}
        aoEnviar={(codigo) => criar(`/api/desafios/${desafio.id}/enviar`, { codigo })}
      />
    </div>
  );
}

// ================================================================ dicas da Lisa (projetos)

/**
 * "Dicas da Lisa": travou no projeto? A Lisa monta um passo a passo básico, dicas e o que revisar —
 * guia o caminho, não entrega a solução. Gera uma vez (fica guardado no desafio). Os passos dá para
 * ir marcando; a marcação fica só neste navegador.
 */
function DicasDaLisa({ desafio }) {
  const [guia, setGuia] = useState(desafio.conteudo?.guia || null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [feitos, setFeitos] = useState([]);
  const chave = `proof-guia-${desafio.id}`;

  useEffect(() => {
    try { setFeitos(JSON.parse(localStorage.getItem(chave) || "[]")); } catch { /* sem armazenamento: começa do zero */ }
  }, [chave]);

  function marcar(i) {
    setFeitos((atual) => {
      const marcados = atual.includes(i) ? atual.filter((x) => x !== i) : [...atual, i];
      try { localStorage.setItem(chave, JSON.stringify(marcados)); } catch { /* marcação só nesta visita */ }
      return marcados;
    });
  }

  async function pedir() {
    setCarregando(true);
    setErro("");
    reagir("pensando", "Montando um passo a passo para o seu projeto…", 40000);
    try {
      const r = await criar(`/api/desafios/${desafio.id}/dicas`, {});
      setGuia(r.guia);
      reagir("feliz", "Prontinho! Vai marcando os passos conforme for fazendo.", 5000);
    } catch (falha) {
      setErro(falha.message);
      reagir("surpreso", "Não consegui montar as dicas agora.");
    } finally {
      setCarregando(false);
    }
  }

  const feitosNoGuia = guia ? feitos.filter((i) => i < guia.passos.length).length : 0;
  return (
    <section className="pf-cartao dicas-lisa" aria-label="Dicas da Lisa">
      <div className="dicas-lisa__topo">
        <Neuro humor={guia ? "feliz" : "pensando"} tamanho={64} />
        <div>
          <p className="dicas-lisa__titulo">💡 Dicas da Lisa</p>
          <p className="dicas-lisa__sub">
            {guia
              ? `Passo a passo básico · ${feitosNoGuia} de ${guia.passos.length} feito(s)`
              : "Não sabe por onde começar? A Lisa monta um passo a passo básico e dicas para você — sem entregar a solução."}
          </p>
        </div>
      </div>
      {!guia && (
        <div className="pf-acoes">
          <button type="button" className="pf-botao" onClick={pedir} disabled={carregando}>
            {carregando ? "A Lisa está montando…" : "Quero as dicas da Lisa"}
          </button>
        </div>
      )}
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      {guia && (
        <>
          <p className="pf-campo__rotulo">Passo a passo</p>
          <ol className="dicas-lisa__passos">
            {guia.passos.map((p, i) => (
              <li key={i} className={`dicas-lisa__passo${feitos.includes(i) ? " dicas-lisa__passo--feito" : ""}`}>
                <label>
                  <input type="checkbox" checked={feitos.includes(i)} onChange={() => marcar(i)} />
                  <span><strong>{i + 1}.</strong> {emLinha(p)}</span>
                </label>
              </li>
            ))}
          </ol>
          {guia.dicas.length > 0 && (
            <>
              <p className="pf-campo__rotulo">Dicas</p>
              <div className="desafio__dicas">
                {guia.dicas.map((d, i) => (
                  <details key={i}><summary>Dica {i + 1}</summary><p>{emLinha(d)}</p></details>
                ))}
              </div>
            </>
          )}
          {guia.estudar.length > 0 && (
            <>
              <p className="pf-campo__rotulo">Vale revisar antes</p>
              <div className="pf-assunto__chips">{guia.estudar.map((t, i) => <span key={i} className="pf-pilula">{emLinha(t)}</span>)}</div>
            </>
          )}
        </>
      )}
    </section>
  );
}

// ================================================================ projeto

/**
 * A complexidade do projeto (pedido de 21/10/2026): mais simples NÃO tira pontos; desafiador vale
 * 1,5×. Só dá para trocar antes da primeira entrega — a Lisa reescreve o projeto no nível pedido.
 */
function Complexidade({ desafio, aoMudar }) {
  const [mudando, setMudando] = useState("");
  const [erro, setErro] = useState("");
  const travada = desafio.tentativas > 0;
  const semTrocas = desafio.trocasRestantes <= 0;

  async function escolher(nivel) {
    if (nivel === desafio.complexidade || mudando) return;
    setMudando(nivel);
    setErro("");
    reagir("pensando", nivel === "padrao" ? "Voltando para a versão padrão…" : nivel === "simples" ? "Deixando o projeto mais simples…" : "Deixando o projeto mais desafiador…", 40000);
    try {
      const r = await criar(`/api/desafios/${desafio.id}/complexidade`, { nivel });
      aoMudar(r.desafio);
      reagir("feliz", nivel === "desafiador" ? "Desafio aceito! Agora ele vale 1,5× os pontos." : "Pronto! Os pontos continuam os mesmos.", 5000);
    } catch (falha) {
      setErro(falha.message);
      reagir("surpreso", "Não consegui mudar a complexidade agora.");
    } finally {
      setMudando("");
    }
  }

  return (
    <div className="complexidade">
      <span className="pf-campo__rotulo">Complexidade</span>
      <div className="complexidade__opcoes" role="group" aria-label="Complexidade do projeto">
        {ORDEM_DAS_COMPLEXIDADES.map((n) => {
          const atual = desafio.complexidade === n;
          return (
            <button key={n} type="button" aria-pressed={atual} onClick={() => escolher(n)}
              className={`complexidade__opcao${atual ? " complexidade__opcao--atual" : ""}`}
              disabled={!atual && (travada || semTrocas || !!mudando)}>
              <span>{mudando === n ? "ajustando…" : COMPLEXIDADES[n].nome}</span>
              <small>{n === "desafiador" ? "1,5× os pontos" : n === "simples" ? "mesmos pontos" : "o original"}</small>
            </button>
          );
        })}
      </div>
      <p className="complexidade__nota">
        {travada
          ? "A complexidade fica fixa depois da primeira entrega."
          : semTrocas
            ? "As trocas de complexidade deste projeto já foram usadas."
            : `Mais simples não tira pontos; desafiador vale 1,5×. Dá para trocar antes da primeira entrega (${desafio.trocasRestantes} troca(s) restante(s)).`}
      </p>
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
    </div>
  );
}

/** Quanto do projeto já está garantido, e o que cada entrega somou. */
function PlacarDoProjeto({ pontuacao }) {
  if (!pontuacao) return null;
  const { garantidos, tabela, entregas, completo } = pontuacao;
  const partes = (lista, nome) => (lista?.length ? ` · ${nome} ${lista.map((n) => n + 1).join(", ")}` : "");
  return (
    <div className="projeto__placar">
      <div className="projeto__placar-topo">
        <strong>{garantidos} de {tabela.maximo} pontos garantidos</strong>
        {completo && <span className="pf-pilula pf-pilula--verde">completo!</span>}
      </div>
      <Barra valor={garantidos} total={tabela.maximo} rotulo="Pontos garantidos no projeto" />
      <p className="projeto__nota">
        Pode entregar em partes: cada requisito cumprido vale os pontos dele na hora, e o que você já
        garantiu não se perde nas próximas entregas.
      </p>
      {entregas.length > 0 && (
        <ul className="projeto__entregas">
          {entregas.map((e, i) => (
            <li key={i}>
              <b>Entrega {e.tentativa || i + 1}:</b> {e.pontos > 0 ? `+${e.pontos} pontos` : "nada novo"}
              {partes(e.requisitos, "requisito(s)")}{partes(e.extras, "extra(s)")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Projeto({ desafio: inicial }) {
  const [desafio, setDesafio] = useState(inicial);
  const [pontuacao, setPontuacao] = useState(inicial.pontuacao || null);
  const c = desafio.conteudo;
  const tabela = pontuacao?.tabela || { requisitos: [], extras: [], maximo: 0 };
  const feitos = new Set(pontuacao?.cumpridos?.requisitos || []);
  const extrasFeitos = new Set(pontuacao?.cumpridos?.extras || []);
  const valor = (pts, feito, bonus) => (
    <span className={`projeto__valor${feito ? " projeto__valor--feito" : ""}`}>{feito ? "✓ " : "+"}{pts ?? 0} pts{bonus ? " bônus" : ""}</span>
  );

  return (
    <div className="desafio">
      <div className="pf-cartao">
        <div className="pf-assunto__chips">
          <span className="pf-pilula pf-pilula--tema">{desafio.tema}</span>
          <span className="pf-pilula">{desafio.nome}</span>
          <span className="pf-pilula pf-pilula--atencao">até {formatarDia(desafio.ate, { comSemana: true })}</span>
          {tabela.maximo > 0 && <span className="pf-pilula pf-pilula--verde">vale até {tabela.maximo} pontos</span>}
        </div>
        {desafio.complexidade && (
          <Complexidade desafio={desafio} aoMudar={(d) => { setDesafio(d); setPontuacao(d.pontuacao || null); }} />
        )}
        {c.contexto && <Explicacao texto={c.contexto} className="desafio__texto" />}
        <p className="pf-campo__rotulo">Requisitos · cada um vale os pontos dele</p>
        <ol className="desafio__requisitos">
          {c.requisitos.map((t, i) => (
            <li key={i} className={feitos.has(i) ? "projeto__parte--feita" : undefined}>
              <div className="projeto__parte"><span>{emLinha(t)}</span>{valor(tabela.requisitos[i], feitos.has(i))}</div>
            </li>
          ))}
        </ol>
        {c.extras.length > 0 && (
          <>
            <p className="pf-campo__rotulo">Desafios extras (opcionais, valem bônus)</p>
            <ul className="avaliacao__simples">
              {c.extras.map((t, i) => (
                <li key={i} className={extrasFeitos.has(i) ? "projeto__parte--feita" : undefined}>
                  <div className="projeto__parte"><span>{emLinha(t)}</span>{valor(tabela.extras[i], extrasFeitos.has(i), true)}</div>
                </li>
              ))}
            </ul>
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
        <PlacarDoProjeto pontuacao={pontuacao} />
        {(desafio.tipo === "projeto_semanal" || desafio.tipo === "projeto_final") && (
          <p className="pf-estat__nota projeto__trava">
            {desafio.tipo === "projeto_final"
              ? `🏆 Projeto final da trilha: aprovado (nota ${NOTA_DE_APROVACAO}+), a trilha está concluída.`
              : `🔓 Fecha a semana ${desafio.semana || ""} do plano: aprovado (nota ${NOTA_DE_APROVACAO}+), a semana seguinte abre.`}
          </p>
        )}
      </div>
      <DicasDaLisa key={`dicas-${desafio.complexidade}-${desafio.titulo}`} desafio={desafio} />
      <Entrega
        desafio={desafio}
        aoAvaliar={(r) => { if (r.pontuacao) setPontuacao(r.pontuacao); setDesafio((d) => ({ ...d, tentativas: r.tentativas })); }}
        campo="repo"
        rotulo="Link do repositório público no GitHub"
        placeholder="https://github.com/seu-usuario/seu-projeto"
        conteudoInicial={desafio.resposta?.repo}
        aoEnviar={(repo) => criar(`/api/desafios/${desafio.id}/enviar`, { repo })}
      />
    </div>
  );
}
