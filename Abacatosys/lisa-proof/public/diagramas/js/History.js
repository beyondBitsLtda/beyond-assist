/* =========================================================================
   History.js — DESFAZER / REFAZER (Ctrl+Z / Ctrl+Y)
   -------------------------------------------------------------------------
   PAPEL NA ARQUITETURA
   Guarda "fotografias" (snapshots) do diagrama em memória. Cada snapshot é
   uma STRING JSON com todas as formas e conexões naquele momento.
   Nada é gravado em disco, banco ou Local Storage: ao fechar a aba, some.
   (As imagens coladas NÃO entram no snapshot — só uma referência curta a
   elas. Ver "assets" no ShapeManager. Isso mantém o histórico leve.)

   COMO FUNCIONA (duas pilhas)
     undoStack: [estado1, estado2, estado3]  <- o topo é o estado ATUAL
     redoStack: []                           <- estados "desfeitos"
   - Desfazer: tira o topo da undoStack e coloca na redoStack.
   - Refazer : tira o topo da redoStack e devolve para a undoStack.
   - Qualquer ação nova apaga a redoStack (não dá mais para "refazer").

   CONCEITOS DE JAVASCRIPT USADOS AQUI
   - class / constructor: forma moderna (ES6) de criar "moldes" de objetos.
   - this: referência ao próprio objeto criado a partir da classe.
   - Parâmetro padrão (limit = 150): usado quando nenhum valor é informado.
   - Array.push / pop / shift: inserir no fim, remover do fim, remover do início.
   ========================================================================= */
window.PM = window.PM || {}; // namespace global do sistema (ver ShapeLibrary.js)

// Declaração da classe e registro dela dentro do namespace PM.
PM.History = class History {
  // O constructor roda automaticamente quando fazemos: new PM.History()
  constructor(limit = 150) {
    this.limit = limit;       // máximo de estados guardados (evita consumir memória demais)
    this.undoStack = [];      // pilha de estados para "desfazer"
    this.redoStack = [];      // pilha de estados para "refazer"
    this.listeners = [];      // funções que querem ser avisadas quando o histórico mudar
  }

  // Padrão "Observer": outra classe (ex.: Toolbar) registra uma função aqui
  // para ser chamada sempre que o histórico mudar (ex.: habilitar o botão Desfazer).
  onChange(fn) { this.listeners.push(fn); }

  // Método "privado" por convenção (o _ no início indica uso interno).
  // Percorre todos os ouvintes e chama cada um, passando o próprio histórico.
  _emit() { this.listeners.forEach((fn) => fn(this)); }

  // Zera o histórico e define um estado inicial (usado ao abrir/importar/novo).
  reset(snapshot) {
    this.undoStack = [snapshot]; // o estado inicial vira a base (não pode ser desfeito)
    this.redoStack = [];         // nada para refazer
    this._emit();                // avisa a interface
  }

  // Registra um novo estado após uma alteração do usuário.
  push(snapshot) {
    // Se o novo estado é idêntico ao atual (=== compara as strings), ignora.
    // Isso evita "passos vazios" no Ctrl+Z (ex.: clicar sem mover nada).
    if (this.undoStack[this.undoStack.length - 1] === snapshot) return;
    this.undoStack.push(snapshot);                                   // adiciona no topo
    if (this.undoStack.length > this.limit) this.undoStack.shift();  // passou do limite? descarta o mais antigo
    this.redoStack = [];                                             // ação nova invalida o "refazer"
    this._emit();
  }

  // Só é possível desfazer se houver mais de 1 estado (o primeiro é a base).
  canUndo() { return this.undoStack.length > 1; }
  // Só é possível refazer se houver algo na pilha de refazer.
  canRedo() { return this.redoStack.length > 0; }

  // Desfaz: move o estado atual para a pilha de refazer e devolve o anterior.
  undo() {
    if (!this.canUndo()) return null;                 // nada a fazer
    this.redoStack.push(this.undoStack.pop());        // pop() remove e retorna o topo
    this._emit();
    return this.undoStack[this.undoStack.length - 1]; // novo estado atual
  }

  // Refaz: pega o último estado desfeito e o recoloca como atual.
  redo() {
    if (!this.canRedo()) return null;
    const s = this.redoStack.pop(); // const = variável que não será reatribuída
    this.undoStack.push(s);
    this._emit();
    return s;
  }

  // ABAS: cada aba tem o seu Ctrl+Z. Ao sair de uma aba, as pilhas dela são
  // guardadas (stash); ao voltar, devolvidas (restore). Os ouvintes (a barra)
  // continuam os mesmos - só o conteúdo das pilhas troca.
  stash() { return { u: this.undoStack, r: this.redoStack }; }
  restore(st) { this.undoStack = st.u; this.redoStack = st.r; this._emit(); }
};
