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
  itensDeChecklist: 12,
  tamanhoItem: 200,
};

/** Uma descrição menor que isto não é descrição, é o título repetido. */
const DESCRICAO_MINIMA = 25;

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
  const semDescricao = [];
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

    // TODO CARD PRECISA DE DESCRIÇÃO, e isto é uma exigência, não um desejo.
    //
    // Um card que diz só "Arrays e métodos" não ajuda ninguém: quem abre não sabe o que
    // fazer, nem quando considerar aquilo pronto. Um quadro cheio de títulos soltos parece
    // organizado e não é — e o trabalho de preencher trinta descrições depois nunca acontece.
    //
    // O comprimento mínimo existe porque o modelo, pressionado a preencher, repete o título
    // com outras palavras. Vinte e cinco caracteres não garantem qualidade, mas barram o
    // "Arrays." que cumpriria a regra sem cumprir o propósito.
    const descricao = texto(c?.descricao, LIMITES.tamanhoDescricao);
    if (descricao.length < DESCRICAO_MINIMA) semDescricao.push(titulo);

    // A checklist vem como lista de textos. Cada item é um passo, e passo é frase curta.
    const checklist = (Array.isArray(c?.checklist) ? c.checklist : [])
      .map((i) => texto(typeof i === "string" ? i : i?.texto, LIMITES.tamanhoItem))
      .filter(Boolean)
      .slice(0, LIMITES.itensDeChecklist);

    cards.push({
      titulo,
      coluna,
      descricao: descricao || null,
      checklist,
      etiqueta: temEtiqueta ? etiqueta : null,
      prazoEmDias: Number.isFinite(dias) && dias >= 0 && dias <= 730 ? Math.round(dias) : null,
    });
  }
  if (cards.length > LIMITES.cards) {
    erros.push(`${cards.length} cards é demais para um quadro novo (o limite é ${LIMITES.cards})`);
  }
  if (semDescricao.length) {
    // Erro, e não aviso. A rota devolve isto ao modelo e pede de novo — uma vez. É o que
    // faz "obrigatório" querer dizer obrigatório em vez de "pedimos com jeitinho".
    erros.push(
      `${semDescricao.length} card(s) sem descrição de verdade: ${semDescricao.slice(0, 6).join(", ")}` +
      (semDescricao.length > 6 ? "…" : "")
    );
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

/* ==========================================================================================
 * QUADRO DE ESTUDO PEDE MATERIAL COM NOME
 *
 * "Estude arrays" não é um plano de estudo: é o título repetido com um verbo na frente. O que
 * faz um card de estudo servir é apontar ONDE estudar — o livro com autor, o capítulo, a
 * documentação oficial, o curso.
 *
 * Pedir isso na instrução não bastou: medido contra o modelo de verdade, ele cumpria uma vez e
 * esquecia na outra. Então vira conferência, e a rota devolve e pede de novo quando falta.
 *
 * As duas funções abaixo são HEURÍSTICA, e assumidamente. "Parece estudo" e "cita material"
 * não são coisas que se decidem por regra — mas a alternativa é não conferir nada, e aí a
 * exigência vale só nos dias em que o modelo está atento.
 * ========================================================================================== */

const PALAVRAS_DE_ESTUDO = [
  "estud", "aprend", "curso", "formaç", "formac", "faculdade", "concurso", "certificaç",
  "certificac", "prova", "materia", "matéria", "disciplina", "treinament", "capacitaç",
  "leitura", "idioma", "ingl", "espanhol",
];

/** Este quadro é sobre aprender alguma coisa? */
export function pareceEstudo(...textos) {
  const tudo = textos.filter(Boolean).join(" ").toLowerCase();
  return PALAVRAS_DE_ESTUDO.some((p) => tudo.includes(p));
}

/* Sinais de que uma descrição aponta para algo que existe fora dela. Não é a lista de fontes
   do mundo — é a lista de palavras que aparecem quando alguém REALMENTE indica material. */
const SINAIS_DE_MATERIAL = [
  "livro", "autor", "capítulo", "capitulo", "cap.", "documentaç", "documentac", "docs",
  "curso", "aula", "artigo", "vídeo", "video", "playlist", "apostila", "mdn", "w3c",
  "manual", "referência", "referencia", "tutorial", "página oficial", "site oficial",
];

/** A descrição aponta para algum material concreto? */
export function citaMaterial(texto) {
  const t = String(texto || "").toLowerCase();
  return SINAIS_DE_MATERIAL.some((s) => t.includes(s));
}

/**
 * Quantos cards de um quadro de estudo ficaram sem indicar material.
 *
 * Devolve os títulos, para a mensagem de volta ao modelo poder dizer quais refazer em vez de
 * mandá-lo reescrever o quadro inteiro.
 */
export function cardsSemMaterial(proposta) {
  if (!proposta) return [];
  return proposta.cards
    .filter((c) => !citaMaterial(c.descricao))
    .map((c) => c.titulo);
}

/** Um resumo em uma linha, para a conversa e para os testes. */
export function resumirProposta(p) {
  if (!p) return "nada";
  return `${p.colunas.length} coluna(s), ${p.cards.length} card(s), ${p.etiquetas.length} etiqueta(s)`;
}
