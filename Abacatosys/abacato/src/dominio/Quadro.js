// O modelo do Abacato, em objetos com comportamento.
//
// A regra que este arquivo segue: quem sabe responder uma pergunta sobre um card é o card, não
// a tela nem a rota. "Está atrasado?", "onde ele entra se eu soltar aqui?", "quem pode mexer
// nele?" são perguntas de domínio, e espalhá-las pela interface é como elas passam a ter três
// respostas diferentes dependendo de onde você olha.
//
// Nenhuma classe aqui fala com o banco. Elas recebem dados prontos e devolvem decisões — é o
// que permite `npm run dominio-check` exercitar todas as regras sem subir nada.

/** Distância entre posições vizinhas ao acrescentar no fim de uma lista. */
const PASSO = 1024;

/**
 * Onde um item entra quando você o solta entre outros dois.
 *
 * A posição é um NÚMERO REAL, não um índice. Soltar entre 1024 e 2048 vira 1536 — uma linha
 * alterada no banco. Com índices inteiros, mover o primeiro card de uma lista de duzentos
 * reescreveria duzentas linhas a cada arrastar, e o quadro travaria com o uso.
 *
 * `antes` e `depois` são as posições dos vizinhos; `null` significa "não há vizinho desse
 * lado", ou seja, a ponta da lista.
 */
export function posicaoEntre(antes, depois) {
  if (antes == null && depois == null) return PASSO;
  if (antes == null) return depois - PASSO;
  if (depois == null) return antes + PASSO;
  return (antes + depois) / 2;
}

/** O que cada papel pode fazer. Um lugar só — espalhar isto pelas telas é como um botão acaba
 *  escondido para quem pode e visível para quem não pode. */
const PODERES = {
  dono:         { ver: true, comentar: true, editar: true, criar: true, apagar: true, convidar: true },
  editor:       { ver: true, comentar: true, editar: true, criar: true, apagar: true, convidar: false },
  comentarista: { ver: true, comentar: true, editar: false, criar: false, apagar: false, convidar: false },
  leitor:       { ver: true, comentar: false, editar: false, criar: false, apagar: false, convidar: false },
};

/** Papel desconhecido não vira "pode tudo" — vira "não pode nada". O padrão de uma trava é
 *  fechado; um typo em 'editorr' não pode abrir o quadro inteiro. */
export function poderesDo(papel) {
  return PODERES[papel] || { ver: false, comentar: false, editar: false, criar: false, apagar: false, convidar: false };
}

export class Usuario {
  constructor({ id, nome, email }) {
    this.id = id;
    this.nome = nome || "";
    this.email = email || "";
  }

  /** As iniciais para o avatar. "Brayan Rodrigues" vira "BR"; um nome só vira uma letra. */
  get iniciais() {
    const partes = this.nome.trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return (this.email[0] || "?").toUpperCase();
    if (partes.length === 1) return partes[0][0].toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }
}

export class Etiqueta {
  constructor({ id, nome, cor }) {
    this.id = id;
    this.nome = nome || "";
    this.cor = cor || "#6B7280";
  }
}

export class ItemDeChecklist {
  constructor({ id, texto, feito = false, posicao = 0 }) {
    this.id = id;
    this.texto = texto || "";
    this.feito = Boolean(feito);
    this.posicao = Number(posicao) || 0;
  }
}

export class Checklist {
  constructor({ id, titulo, posicao = 0, itens = [] }) {
    this.id = id;
    this.titulo = titulo || "Checklist";
    this.posicao = Number(posicao) || 0;
    this.itens = itens.map((i) => (i instanceof ItemDeChecklist ? i : new ItemDeChecklist(i)))
      .sort((a, b) => a.posicao - b.posicao);
  }

  get feitos() { return this.itens.filter((i) => i.feito).length; }
  get total() { return this.itens.length; }
  /** Sem itens, o progresso é 0 e não 100: uma checklist vazia não está concluída, está vazia.
   *  Mostrar 100% faria o card parecer pronto sem nada ter sido feito. */
  get progresso() { return this.total ? this.feitos / this.total : 0; }
  get completa() { return this.total > 0 && this.feitos === this.total; }
}

export class Card {
  constructor({
    id, colunaId = null, titulo, descricao, posicao = 0, inicioEm = null, fimEm = null, capa = null,
    arquivado = false, concluido = false, recorrenciaRegra = null,
    etiquetas = [], responsaveis = [], checklists = [], links = [],
    origem = null, origemId = null,
  }) {
    this.colunaId = colunaId;
    this.concluido = Boolean(concluido);
    this.recorrenciaRegra = recorrenciaRegra;
    this.id = id;
    this.titulo = titulo || "";
    this.descricao = descricao || "";
    this.posicao = Number(posicao) || 0;
    this.inicioEm = inicioEm ? new Date(inicioEm) : null;
    this.fimEm = fimEm ? new Date(fimEm) : null;
    this.capa = capa;
    this.arquivado = Boolean(arquivado);
    this.etiquetas = etiquetas.map((e) => (e instanceof Etiqueta ? e : new Etiqueta(e)));
    this.responsaveis = responsaveis.map((u) => (u instanceof Usuario ? u : new Usuario(u)));
    this.checklists = checklists.map((c) => (c instanceof Checklist ? c : new Checklist(c)));
    this.links = links;
    this.origem = origem;
    this.origemId = origemId;
  }

  /**
   * O estado do prazo, em uma palavra.
   *
   * Existe aqui, e não na tela, porque três telas precisam da mesma resposta — o card, a lista
   * e o dashboard — e "atrasado" precisa significar a mesma coisa nas três.
   *
   * Um card COM checklists, todas completas, não conta como atrasado: o trabalho acabou, só
   * ninguém moveu o card. Marcar de vermelho o que já está feito ensina a ignorar o vermelho.
   *
   * O `concluido` marcado à mão vale o mesmo. Ele existe porque a maioria dos cards não tem
   * checklist nenhuma, e porque o Trello guarda essa informação separada da checklist — sem
   * ela, todo card já resolvido lá chegaria aqui vermelho de atrasado.
   */
  estadoDoPrazo(agora = new Date()) {
    if (this.concluido) return "concluido";
    if (!this.fimEm) return "sem-prazo";
    if (this.concluidoPelasChecklists) return "concluido";
    const faltam = this.fimEm.getTime() - agora.getTime();
    if (faltam < 0) return "atrasado";
    if (faltam < 24 * 3600 * 1000) return "hoje";
    if (faltam < 3 * 24 * 3600 * 1000) return "proximo";
    return "no-prazo";
  }

  /** Só conta quando EXISTE checklist: um card sem nenhuma não está concluído, está sem
   *  checklist. A diferença importa porque a maioria dos cards não tem nenhuma. */
  get concluidoPelasChecklists() {
    return this.checklists.length > 0 && this.checklists.every((c) => c.completa);
  }

  get progressoDasChecklists() {
    const total = this.checklists.reduce((s, c) => s + c.total, 0);
    if (!total) return null;
    const feitos = this.checklists.reduce((s, c) => s + c.feitos, 0);
    return { feitos, total, fracao: feitos / total };
  }

  temEtiqueta(id) { return this.etiquetas.some((e) => e.id === id); }
  temResponsavel(id) { return this.responsaveis.some((u) => u.id === id); }
}

export class Coluna {
  constructor({ id, nome, posicao = 0, capa = null, arquivada = false, cards = [] }) {
    this.id = id;
    this.nome = nome || "";
    this.posicao = Number(posicao) || 0;
    this.capa = capa;
    this.arquivada = Boolean(arquivada);
    this.cards = cards
      .map((c) => (c instanceof Card ? c : new Card(c)))
      .filter((c) => !c.arquivado)
      .sort((a, b) => a.posicao - b.posicao);
  }

  get total() { return this.cards.length; }

  /** A posição que um card receberia ao ser solto no índice `destino` desta coluna. */
  posicaoPara(destino) {
    const antes = destino > 0 ? this.cards[destino - 1]?.posicao ?? null : null;
    const depois = this.cards[destino]?.posicao ?? null;
    return posicaoEntre(antes, depois);
  }

  contarPorPrazo(agora = new Date()) {
    const contagem = { atrasado: 0, hoje: 0, proximo: 0, "no-prazo": 0, "sem-prazo": 0, concluido: 0 };
    for (const c of this.cards) contagem[c.estadoDoPrazo(agora)]++;
    return contagem;
  }
}

export class Quadro {
  constructor({ id, nome, descricao, papelDeParede = null, donoId, arquivado = false, colunas = [], membros = [], etiquetas = [] }) {
    this.id = id;
    this.nome = nome || "";
    this.descricao = descricao || "";
    this.papelDeParede = papelDeParede;
    this.donoId = donoId;
    this.arquivado = Boolean(arquivado);
    this.colunas = colunas
      .map((c) => (c instanceof Coluna ? c : new Coluna(c)))
      .filter((c) => !c.arquivada)
      .sort((a, b) => a.posicao - b.posicao);
    this.membros = membros;
    this.etiquetas = etiquetas.map((e) => (e instanceof Etiqueta ? e : new Etiqueta(e)));
  }

  get totalDeCards() { return this.colunas.reduce((s, c) => s + c.total, 0); }

  /** O papel de alguém neste quadro. O dono é dono mesmo sem linha na tabela de membros —
   *  depender daquela linha faria o criador perder o próprio quadro se ela sumisse. */
  papelDe(usuarioId) {
    if (usuarioId && usuarioId === this.donoId) return "dono";
    return this.membros.find((m) => m.usuario_id === usuarioId || m.usuarioId === usuarioId)?.papel || null;
  }

  podeQue(usuarioId, acao) {
    const papel = this.papelDe(usuarioId);
    if (!papel) return false;
    return Boolean(poderesDo(papel)[acao]);
  }

  /** Todos os cards do quadro, em ordem de coluna e posição. Serve ao dashboard e à busca,
   *  que não se importam com colunas. */
  todosOsCards() {
    return this.colunas.flatMap((c) => c.cards);
  }

  /** O resumo que alimenta o dashboard e — mais importante — a Lisa, que vai perguntar
   *  "quantas tarefas eu tenho hoje" para o Abacato em vez do Trello. */
  resumo(agora = new Date()) {
    const cards = this.todosOsCards();
    const contagem = { atrasado: 0, hoje: 0, proximo: 0, "no-prazo": 0, "sem-prazo": 0, concluido: 0 };
    for (const c of cards) contagem[c.estadoDoPrazo(agora)]++;
    return { total: cards.length, colunas: this.colunas.length, porPrazo: contagem };
  }
}
