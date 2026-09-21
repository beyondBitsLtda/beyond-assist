/**
 * A proposta de um quadro, antes de ele existir.
 *
 * ==========================================================================================
 * POR QUE EXISTE UMA PROPOSTA, EM VEZ DE A LISA SIMPLESMENTE CRIAR
 *
 * A assistente já sabe criar quadro, coluna e card. Seria mais curto deixá-la criar tudo no
 * meio da conversa. Duas razões para não:
 *
 *   QUEM DECIDE É QUEM PEDIU. Um quadro é a forma de um trabalho — as etapas, o que entra em
 *   cada uma, o que se repete. Vale a pena olhar antes, e olhar DEPOIS de pronto não é a mesma
 *   coisa: ninguém apaga quinze cards para recomeçar, todo mundo se conforma com o que veio.
 *
 *   O MODELO NÃO ESCREVE NO BANCO. Ele devolve uma estrutura; o servidor confere e monta. Se
 *   ele inventar uma cor, uma coluna vazia ou quarenta cards, isso é recusado AQUI, e não vira
 *   quarenta linhas que alguém terá de limpar à mão.
 *
 * Este arquivo é puro: nenhuma dependência, nenhum banco. É o contrato entre o que o modelo
 * diz e o que o sistema aceita.
 * ==========================================================================================
 */

import { VALORES_DE_COR } from "./cores.js";

/* Os limites existem porque um modelo sem limite propõe quadros grandes demais para serem
   lidos. Um quadro de trinta cards em oito colunas não é um plano, é uma parede. */
export const LIMITES = {
  colunas: 10,
  cards: 40,
  etiquetas: 8,
  tamanhoNome: 80,
  tamanhoTitulo: 200,
  tamanhoDescricao: 2000,
};

function texto(valor, maximo) {
  return String(valor == null ? "" : valor).trim().slice(0, maximo);
}

/**
 * Confere e normaliza o que o modelo propôs.
 *
 * Devolve `{ ok, erros, proposta }`. Nunca lança: uma proposta malformada é um caso comum —
 * o modelo erra — e precisa virar uma mensagem que a conversa possa ler e corrigir, não uma
 * exceção que derruba a rota.
 *
 * O que não dá para consertar vira erro. O que dá — uma cor fora da paleta, um card apontando
 * para coluna que não existe — é CORRIGIDO, e a correção é dita em `avisos`: o modelo erra
 * nessas duas coisas com frequência, e recusar a proposta inteira por causa de um tom de azul
 * faria a pessoa refazer a conversa por nada.
 */
export function validarProposta(bruta) {
  const erros = [];
  const avisos = [];

  if (!bruta || typeof bruta !== "object") {
    return { ok: false, erros: ["a proposta veio vazia"], avisos, proposta: null };
  }

  const nome = texto(bruta.nome, LIMITES.tamanhoNome);
  if (!nome) erros.push("o quadro precisa de um nome");

  // ------------------------------------------------------------------ colunas
  const colunasBrutas = Array.isArray(bruta.colunas) ? bruta.colunas : [];
  const colunas = [];
  const vistas = new Set();
  for (const c of colunasBrutas) {
    const n = texto(typeof c === "string" ? c : c?.nome, LIMITES.tamanhoNome);
    if (!n) continue;
    // Duas colunas com o mesmo nome deixam o quadro impossível de explicar, e os cards
    // apontam para elas pelo nome — a segunda nunca receberia nada.
    const chave = n.toLowerCase();
    if (vistas.has(chave)) { avisos.push(`a coluna "${n}" apareceu duas vezes; ficou uma`); continue; }
    vistas.add(chave);
    colunas.push({ nome: n });
  }
  if (!colunas.length) erros.push("o quadro precisa de pelo menos uma coluna");
  if (colunas.length > LIMITES.colunas) {
    erros.push(`${colunas.length} colunas é demais para um quadro (o limite é ${LIMITES.colunas})`);
  }

  // ---------------------------------------------------------------- etiquetas
  const etiquetasBrutas = Array.isArray(bruta.etiquetas) ? bruta.etiquetas : [];
  const etiquetas = [];
  const nomesDeEtiqueta = new Set();
  for (const e of etiquetasBrutas) {
    const n = texto(e?.nome, LIMITES.tamanhoNome);
    if (!n || nomesDeEtiqueta.has(n.toLowerCase())) continue;
    nomesDeEtiqueta.add(n.toLowerCase());

    // Cor inventada não derruba a proposta: gira na paleta. O modelo acerta o conceito da
    // etiqueta e erra o tom o tempo todo, e o tom é a parte que menos importa.
    let cor = e?.cor;
    if (!VALORES_DE_COR.includes(cor)) {
      cor = VALORES_DE_COR[etiquetas.length % VALORES_DE_COR.length];
      if (e?.cor) avisos.push(`a cor "${e.cor}" não é da paleta; "${n}" ficou com ${cor}`);
    }
    etiquetas.push({ nome: n, cor });
  }
  if (etiquetas.length > LIMITES.etiquetas) {
    erros.push(`${etiquetas.length} etiquetas é demais (o limite é ${LIMITES.etiquetas})`);
  }

  // -------------------------------------------------------------------- cards
  const cardsBrutos = Array.isArray(bruta.cards) ? bruta.cards : [];
  const cards = [];
  for (const c of cardsBrutos) {
    const titulo = texto(c?.titulo, LIMITES.tamanhoTitulo);
    if (!titulo) continue;

    // O card diz em que coluna vai PELO NOME, porque quando ele é proposto nenhuma coluna
    // tem id ainda. Nome que não existe cai na primeira coluna — a fila —, que é o lugar
    // menos errado para uma tarefa que ninguém sabe onde fica.
    let coluna = texto(c?.coluna, LIMITES.tamanhoNome);
    if (!coluna || !vistas.has(coluna.toLowerCase())) {
      if (coluna) avisos.push(`"${titulo}" apontava para a coluna "${coluna}", que não existe; foi para "${colunas[0]?.nome}"`);
      coluna = colunas[0]?.nome || "";
    }

    const etiqueta = texto(c?.etiqueta, LIMITES.tamanhoNome);
    const temEtiqueta = etiqueta && nomesDeEtiqueta.has(etiqueta.toLowerCase());

    // Prazo em DIAS a partir de hoje, e não data: o modelo não sabe que dia é hoje com
    // confiança, e "daqui a 7 dias" é o que ele consegue dizer sem errar.
    const dias = Number(c?.prazoEmDias);

    cards.push({
      titulo,
      coluna,
      descricao: texto(c?.descricao, LIMITES.tamanhoDescricao) || null,
      etiqueta: temEtiqueta ? etiqueta : null,
      prazoEmDias: Number.isFinite(dias) && dias >= 0 && dias <= 730 ? Math.round(dias) : null,
    });
  }
  if (cards.length > LIMITES.cards) {
    erros.push(`${cards.length} cards é demais para um quadro novo (o limite é ${LIMITES.cards})`);
  }

  if (erros.length) return { ok: false, erros, avisos, proposta: null };

  return {
    ok: true,
    erros,
    avisos,
    proposta: {
      nome,
      descricao: texto(bruta.descricao, LIMITES.tamanhoDescricao) || null,
      colunas,
      etiquetas,
      cards,
    },
  };
}

/** Um resumo em uma linha, para a conversa e para os testes. */
export function resumirProposta(p) {
  if (!p) return "nada";
  return `${p.colunas.length} coluna(s), ${p.cards.length} card(s), ${p.etiquetas.length} etiqueta(s)`;
}
