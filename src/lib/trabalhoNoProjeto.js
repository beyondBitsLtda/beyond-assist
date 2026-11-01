// A Lisa trabalhando num projeto do ProcessMap (01/11/2026), do lado do navegador: pedir o plano
// (/api/processmap/plano) e executá-lo — cada operação vira um desenho (/api/diagrama, com o projeto
// inteiro como contexto) salvo no projeto na hora. Usado pela conversa do Assistente e pela barra
// "pedir à Lisa" do painel ProcessMap ("de novo, ela só fez as anotações no primeiro fluxograma; ela
// deveria ir em todos os fluxogramas do projeto e todos os mapas mentais, aba por aba": a barra do
// painel só sabia mexer no fluxo aberto). Sem React: `buscar` e `api` vêm de fora (testado com
// servidor falso em scripts/fluxogramas-check.mjs).

import { contextoDoProjeto } from "./processmapNaConversa.js";

const JSON_ = { "content-type": "application/json" };

/** O plano do pedido sobre o projeto: { acao, explicacao, operacoes }. Lança se o servidor falhar. */
export async function pedirPlano({ pedido, projeto, fluxos, aberto = "", conversa = "", buscar = (...a) => fetch(...a) }) {
  const res = await buscar("/api/processmap/plano", {
    method: "POST",
    headers: JSON_,
    body: JSON.stringify({
      pedido,
      projeto: contextoDoProjeto(projeto, fluxos),
      fluxos: fluxos.map(({ id, nome, modo, formas }) => ({ id, nome, modo, formas })),
      aberto, conversa,
    }),
  });
  const r = await res.json().catch(() => ({}));
  if (!res.ok || !r.ok) throw new Error(r.error || `HTTP ${res.status}`);
  return r.plano;
}

const marca = (l) => (l.ok === true ? "✓" : l.ok === false ? "✗" : l.trabalhando ? "◆" : "◇");

/** O andamento em texto: a explicação do plano, uma linha por desenho e o fecho. */
export function textoDoAndamento(plano, linhas, fim = "") {
  return `${plano.explicacao ? `${plano.explicacao}\n\n` : ""}${linhas
    .map((l) => `${marca(l)} "${l.nome}" — ${l.estado}${l.nota ? `: ${l.nota}` : ""}`).join("\n")}${fim ? `\n\n${fim}` : ""}`;
}

/**
 * Executa o plano, uma operação por vez (o modelo e o banco agradecem), e devolve
 * { linhas, feitos, resultados: [{ op, fluxo (salvo), doc, colecao, explicacao, mudou }] }.
 *   docDe(fluxo): o documento de partida (o da tela, quando é o fluxo aberto — tem o que a pessoa
 *   acabou de mexer); `abertoId`: esse fluxo grava por cima (a versão da tela é a que vale).
 *   aoAndar(linhas): a cada passo, para a tela mostrar o andamento.
 */
export async function executarPlano({
  plano, projeto, fluxos, api, conversa = "", abertoId = "",
  docDe = (f) => f.documento, aoAndar = () => {}, buscar = (...a) => fetch(...a),
}) {
  const linhas = plano.operacoes.map((op) => ({
    nome: op.fluxo ? fluxos.find((f) => f.id === op.fluxo)?.nome || "?" : op.nome,
    estado: "na fila", ok: null, nota: "", trabalhando: false,
  }));
  const resultados = [];
  aoAndar(linhas);
  for (const [i, op] of plano.operacoes.entries()) {
    const linha = linhas[i];
    linha.estado = "trabalhando…";
    linha.trabalhando = true;
    aoAndar(linhas);
    try {
      const fluxo = op.fluxo ? fluxos.find((f) => f.id === op.fluxo) : null;
      const res = await buscar("/api/diagrama", {
        method: "POST",
        headers: JSON_,
        body: JSON.stringify({
          pedido: !fluxo && op.tipo === "mapa mental" ? `Monte um mapa mental. ${op.pedido}` : op.pedido,
          atual: fluxo ? docDe(fluxo) : null,
          conversa,
          projeto: contextoDoProjeto(projeto, fluxos, { alvo: fluxo }),
        }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok || !r.ok) throw new Error(r.error || `HTTP ${res.status}`);
      const salvo = fluxo
        ? await api.salvar(fluxo.id, fluxo.id === abertoId ? { documento: r.doc, forcar: true } : { documento: r.doc, versao: fluxo.versao })
        : (await api.criar({ documento: r.doc, nome: op.nome || r.titulo, projetoId: projeto.id, origem: "lisa" })).fluxo;
      linha.nome = salvo.nome;
      linha.estado = fluxo ? "atualizado" : "criado";
      linha.ok = true;
      linha.nota = String(r.explicacao || "").split(/(?<=[.!?])\s/)[0].slice(0, 160);
      resultados.push({ op, fluxo: salvo, doc: r.doc, colecao: r.colecao, explicacao: r.explicacao, mudou: Boolean(fluxo) });
    } catch (err) {
      linha.estado = err.status === 409 ? "não salvei (mudou em outro lugar agora há pouco)" : "não deu";
      linha.nota = err.status === 409 ? "" : err.message;
      linha.ok = false;
    }
    linha.trabalhando = false;
    aoAndar(linhas);
  }
  return { linhas, feitos: resultados.length, resultados };
}
