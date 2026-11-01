/* =========================================================================
   Toolbar.js — BARRA DE FERRAMENTAS SUPERIOR
   -------------------------------------------------------------------------
   PAPEL NA ARQUITETURA
   Camada de INTERFACE: desenha os botões e traduz cliques em chamadas aos
   outros módulos. Ela não sabe COMO alinhar ou dar zoom; apenas pede:
     clique "Alinhar à esquerda" → manager.align('left')
     clique "+"                  → viewport.zoomCenter(1.2)
   O método run(acao) concentra todas as ações e também é usado pelos
   atalhos de teclado (App.js) — assim botão e tecla fazem exatamente a
   mesma coisa, sem código duplicado.

   Grupos da barra: Seleção/Mão · Coleção + Formas · Editar · Alinhar ·
                    Linhas · Zoom · Ajuda
   No MAPA MENTAL a barra troca as formas e o alinhamento pelos comandos do
   mapa (novo tópico, irmão, recolher/expandir tudo): o layout é automático.
   ========================================================================= */
window.PM = window.PM || {}; // namespace global do sistema

PM.Toolbar = class Toolbar {
  /**
   * @param el       <nav id="toolbar"> onde os botões serão criados
   * @param manager  ShapeManager (ações sobre formas/linhas)
   * @param viewport Viewport (zoom/enquadrar)
   * @param notify   função de mensagem (toast)
   * @param onHelp   função que abre a janela de atalhos
   */
  constructor({ el, manager, viewport, notify, onHelp }) {
    this.el = el;
    this.m = manager;
    this.vp = viewport;
    this.notify = notify;
    this.onHelp = onHelp;
    this._render(); // cria o HTML dos botões
    this._bind();   // liga cliques e arrastes
    // Se inscreve em eventos para manter os botões coerentes com o estado:
    this.m.on('tool', () => this.refresh());           // ferramenta mudou → destaca botão
    this.m.on('mode', () => { this._render(); this.refresh(); }); // fluxograma ↔ mapa mental: outra barra
    this.m.on('selection', () => this.refresh());      // seleção mudou → habilita/desabilita alinhar
    this.m.history.onChange(() => this.refresh());     // histórico mudou → Desfazer/Refazer
    this.vp.onChange(() => { this.zoomLabel.textContent = `${Math.round(this.vp.scale * 100)}%`; }); // mostra o % do zoom
    this.refresh();
  }

  // "static" = propriedade da CLASSE (não de cada objeto). Acesso: Toolbar.I.undo
  // Guarda o desenho SVG (apenas o miolo) de cada ícone da barra.
  static I = {
    select: '<path d="M5 3l14 8-6 1.5L10 19z" fill="currentColor" fill-opacity=".2" stroke-linejoin="round"/>',
    hand: '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6.5 7S5 17.5 4 15l-1-3a1.5 1.5 0 0 1 2.7-1.2L8 13"/>',
    pen: '<path d="M4 20l1.5-5L16 4.5a2.1 2.1 0 0 1 3 3L8.5 18z"/><path d="M14 6.5l3 3"/><path d="M4 20c3-1 5 1 8-1" stroke-opacity=".6"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
    dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    alLeft: '<path d="M4 3v18"/><rect x="7" y="6" width="12" height="4" rx="1"/><rect x="7" y="14" width="7" height="4" rx="1"/>',
    alCenter: '<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>',
    alRight: '<path d="M20 3v18"/><rect x="5" y="6" width="12" height="4" rx="1"/><rect x="10" y="14" width="7" height="4" rx="1"/>',
    alTop: '<path d="M3 4h18"/><rect x="6" y="7" width="4" height="12" rx="1"/><rect x="14" y="7" width="4" height="7" rx="1"/>',
    alMiddle: '<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>',
    alBottom: '<path d="M3 20h18"/><rect x="6" y="5" width="4" height="12" rx="1"/><rect x="14" y="10" width="4" height="7" rx="1"/>',
    distH: '<path d="M3 3v18M21 3v18"/><rect x="9" y="7" width="6" height="10" rx="1"/>',
    distV: '<path d="M3 3h18M3 21h18"/><rect x="7" y="9" width="10" height="6" rx="1"/>',
    straight: '<rect x="3" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="16" width="8" height="5" rx="1.5"/><path d="M7 8v5h10v3" stroke-dasharray="2 2"/><path d="M17 8v8"/>',
    snap: '<path d="M4 4h16v16H4zM4 12h16M12 4v16" stroke-opacity=".5"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>',
    zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M8 11h6M20 20l-4-4"/>',
    zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6M20 20l-4-4"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
    focus: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17.5v.01"/>',
    mmChild: '<rect x="2" y="9" width="8" height="6" rx="2"/><rect x="15" y="4" width="7" height="5" rx="2"/><path d="M10 12c3 0 3-5.5 5-5.5M18.5 13v6M15.5 16h6"/>',
    mmSibling: '<rect x="10" y="3" width="10" height="6" rx="2"/><rect x="10" y="15" width="10" height="6" rx="2" stroke-dasharray="2 2"/><path d="M4 6h6M4 6v12h6"/>',
    mmCollapse: '<rect x="3" y="9" width="8" height="6" rx="2"/><circle cx="17" cy="12" r="4"/><path d="M15 12h4"/>',
    mmExpand: '<rect x="3" y="9" width="8" height="6" rx="2"/><circle cx="17" cy="12" r="4"/><path d="M15 12h4M17 10v4"/>',
    mmReset: '<rect x="9" y="3" width="6" height="4" rx="1.5"/><rect x="2" y="17" width="6" height="4" rx="1.5"/><rect x="16" y="17" width="6" height="4" rx="1.5"/><path d="M12 7v5M5 17v-3h14v3"/>',
  };

  // Gera o HTML de um botão de ação.
  //   act  → nome da ação (data-act), usado pelo run()
  //   icon → chave em Toolbar.I
  //   tip  → texto da dica (data-tip, exibida via CSS ::after)
  btn(act, icon, tip, extra = '') {
    return `<button class="tb-btn" data-act="${act}" data-tip="${tip}" ${extra}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${Toolbar.I[icon]}</svg></button>`;
  }

  // Monta toda a barra. Os botões de forma são gerados a partir do catálogo
  // (ShapeLibrary.order), então uma forma nova aparece aqui automaticamente.
  _render() {
    const lib = PM.ShapeLibrary;
    if (this.m.mode === 'mindmap') return this._renderMind();
    // map transforma cada tipo em HTML de botão; join('') junta tudo em uma string.
    // draggable="true" permite arrastar o botão para o quadro (HTML5 drag & drop).
    const shapes = this._shapeButtons();
    // Seletor de coleção: troca os botões de forma (o diagrama pode misturar todas)
    const colecoes = lib.collections.map((c) => `<option value="${c.id}"${c.id === lib.collection ? ' selected' : ''}>${c.label}</option>`).join('');
    this.el.innerHTML = `
      <div class="tb-group">${this.btn('select', 'select', 'Selecionar (V)')}${this.btn('hand', 'hand', 'Mover quadro (H / Espaço)')}${this.btn('pen', 'pen', 'Desenhar à mão livre (P) — Esc volta a Selecionar')}</div>
      <div class="tb-group"><select class="tb-collection" title="Coleção de figuras" aria-label="Coleção de figuras">${colecoes}</select><span class="tb-shapes">${shapes}</span></div>
      <div class="tb-group">${this.btn('undo', 'undo', 'Desfazer (Ctrl+Z)')}${this.btn('redo', 'redo', 'Refazer (Ctrl+Y)')}${this.btn('dup', 'dup', 'Duplicar (Ctrl+D)')}${this.btn('del', 'del', 'Excluir (Delete)')}</div>
      <div class="tb-group"><span class="tb-label">Alinhar</span>
        ${this.btn('al-left', 'alLeft', 'Alinhar à esquerda')}${this.btn('al-center', 'alCenter', 'Centralizar na vertical (eixo X)')}${this.btn('al-right', 'alRight', 'Alinhar à direita')}
        ${this.btn('al-top', 'alTop', 'Alinhar ao topo')}${this.btn('al-middle', 'alMiddle', 'Centralizar na horizontal (eixo Y)')}${this.btn('al-bottom', 'alBottom', 'Alinhar à base')}
        ${this.btn('dist-h', 'distH', 'Distribuir horizontalmente')}${this.btn('dist-v', 'distV', 'Distribuir verticalmente')}</div>
      <div class="tb-group"><span class="tb-label">Linhas</span>
        ${this.btn('straighten', 'straight', 'Endireitar / centralizar linhas (L)')}${this.btn('snap', 'snap', 'Encaixe na grade e guias (G)')}</div>
      <div class="tb-group">${this.btn('zoom-out', 'zoomOut', 'Diminuir zoom (-)')}<span class="zoom-label" data-act="zoom-reset" title="Voltar a 100% (0)">100%</span>${this.btn('zoom-in', 'zoomIn', 'Aumentar zoom (+)')}
        ${this.btn('fit', 'fit', 'Enquadrar todo o fluxo (F)')}${this.btn('focus', 'focus', 'Centralizar a seleção na tela (C)')}</div>
      <div class="tb-group">${this.btn('help', 'help', 'Atalhos (?)')}</div>`;
    this.zoomLabel = this.el.querySelector('.zoom-label'); // texto "100%" atualizado no zoom
  }

  // Os botões de forma da coleção ativa.
  _shapeButtons() {
    const lib = PM.ShapeLibrary;
    return lib.order.map((t, i) =>
      `<button class="tb-btn shape" draggable="true" data-shape="${t}" data-tip="${lib.get(t).label}${i < 9 ? ` (${i + 1})` : ''} — clique ou arraste">${lib.icon(t)}</button>`).join('');
  }

  // Barra do MAPA MENTAL: o layout é automático, então não há formas nem alinhamento.
  _renderMind() {
    this.el.innerHTML = `
      <div class="tb-group">${this.btn('select', 'select', 'Selecionar (V)')}${this.btn('hand', 'hand', 'Mover quadro (H / Espaço)')}</div>
      <div class="tb-group"><span class="tb-label">Mapa mental</span>
        ${this.btn('mm-child', 'mmChild', 'Novo tópico filho (Tab)')}${this.btn('mm-sibling', 'mmSibling', 'Novo tópico irmão (Enter)')}
        ${this.btn('mm-collapse', 'mmCollapse', 'Recolher todos os tópicos')}${this.btn('mm-expand', 'mmExpand', 'Expandir todos os tópicos')}
        ${this.btn('mm-reset', 'mmReset', 'Reorganizar: todos os tópicos voltam à posição automática')}</div>
      <div class="tb-group">${this.btn('undo', 'undo', 'Desfazer (Ctrl+Z)')}${this.btn('redo', 'redo', 'Refazer (Ctrl+Y)')}${this.btn('del', 'del', 'Excluir tópico e descendência (Delete)')}</div>
      <div class="tb-group">${this.btn('zoom-out', 'zoomOut', 'Diminuir zoom (-)')}<span class="zoom-label" data-act="zoom-reset" title="Voltar a 100% (0)">100%</span>${this.btn('zoom-in', 'zoomIn', 'Aumentar zoom (+)')}
        ${this.btn('fit', 'fit', 'Enquadrar o mapa (F)')}${this.btn('focus', 'focus', 'Centralizar a seleção (C)')}</div>
      <div class="tb-group">${this.btn('help', 'help', 'Atalhos (?)')}</div>`;
    this.zoomLabel = this.el.querySelector('.zoom-label');
    this.zoomLabel.textContent = `${Math.round(this.vp.scale * 100)}%`;
  }

  // Delegação de eventos: um listener só para a barra inteira.
  _bind() {
    this.el.addEventListener('click', (e) => {
      const s = e.target.closest('[data-shape]');
      // Clique em forma: ativa a ferramenta; clicar de novo na mesma desativa (volta para Selecionar).
      if (s) { const t = s.dataset.shape; this.m.setTool(this.m.tool === t ? 'select' : t); return; }
      const b = e.target.closest('[data-act]');
      if (b) this.run(b.dataset.act);
    });
    // Troca de coleção: só os botões de forma são refeitos
    this.el.addEventListener('change', (e) => {
      if (!e.target.classList.contains('tb-collection')) return;
      PM.ShapeLibrary.setCollection(e.target.value);
      this.el.querySelector('.tb-shapes').innerHTML = this._shapeButtons();
      this.m.setTool('select');
      e.target.blur(); // devolve as teclas (1..9) ao quadro
    });
    // Início do arraste de uma forma: grava o tipo no "pacote" do drag & drop.
    // O ShapeManager lê esse valor no evento "drop" do quadro.
    this.el.addEventListener('dragstart', (e) => {
      const s = e.target.closest('[data-shape]'); if (!s) return;
      e.dataTransfer.setData('application/x-pm-shape', s.dataset.shape);
      e.dataTransfer.effectAllowed = 'copy';
    });
  }

  /** Executa uma ação (também usada pelos atalhos de teclado)
   *  Ponto central de "comandos": cada string corresponde a um botão. */
  run(act) {
    const m = this.m, vp = this.vp;
    // Mensagem padrão quando a ação exige mais formas selecionadas
    const needs = (n) => { this.notify(`Selecione pelo menos ${n} formas.`, true); };
    // switch: compara "act" com cada "case"; "break" encerra o caso.
    // Vários "case" seguidos sem break compartilham o mesmo código (alinhamentos).
    switch (act) {
      case 'select': m.setTool('select'); break;                            // ferramenta Selecionar
      case 'hand': m.setTool(m.tool === 'hand' ? 'select' : 'hand'); break; // alterna Mão ↔ Selecionar
      case 'pen': if (m.mode !== 'mindmap') m.setTool(m.tool === 'pen' ? 'select' : 'pen'); break; // lápis
      case 'undo': m.undo(); break;           // Ctrl+Z
      case 'redo': m.redo(); break;           // Ctrl+Y
      case 'dup': m.duplicate(); break;       // Ctrl+D
      case 'del': m.deleteSelection(); break; // Delete
      case 'al-left': case 'al-center': case 'al-right': case 'al-top': case 'al-middle': case 'al-bottom':
        // 'al-left'.slice(3) = 'left' → recorta o prefixo "al-"
        if (!m.align(act.slice(3))) needs(2); break;
      // Distribuir com espaçamento igual (exige 3+ formas)
      case 'dist-h': if (!m.distribute('h')) needs(3); break;
      case 'dist-v': if (!m.distribute('v')) needs(3); break;
      // Endireitar linhas: chama o ShapeManager e informa quantas foram ajustadas
      case 'straighten': {
        if (!m.conns.length) { this.notify('Não há conexões para ajustar.', true); break; }
        const n = m.straighten();
        this.notify(n ? `${n} conexão(ões) endireitada(s).` : 'As linhas já estão centralizadas.');
        break;
      }
      // Liga/desliga o encaixe (grade + guias)
      case 'snap': m.snap = !m.snap; this.notify(m.snap ? 'Encaixe ativado.' : 'Encaixe desativado (movimento livre).'); this.refresh(); break;
      case 'zoom-in': vp.zoomCenter(1.2); break;      // +20%
      case 'zoom-out': vp.zoomCenter(1 / 1.2); break; // -20% (inverso)
      case 'zoom-reset': vp.setScale(1); break;       // volta a 100%
      case 'fit': vp.fit(m.bounds()); break;          // enquadra todas as formas
      // Centraliza a tela na seleção (ou no fluxo inteiro, se nada estiver selecionado)
      case 'focus': {
        const b = m.bounds(m.selectedShapes().length ? m.selectedShapes() : m.shapes);
        if (b) vp.centerOn(b.x + b.w / 2, b.y + b.h / 2);
        break;
      }
      case 'help': this.onHelp(); break;              // abre a janela de atalhos
      // ----- mapa mental -----
      case 'mm-child': case 'mm-sibling': {
        const MM = PM.MindMap, sel = m.selectedShapes()[0];
        const n = act === 'mm-child' ? MM.addChild(m, sel ? sel.id : (MM.root(m) || {}).id) : MM.addSibling(m, sel ? sel.id : '');
        if (n) m.emit('edit-shape', n.id);
        break;
      }
      case 'mm-collapse': PM.MindMap.setAll(m, true); break;
      case 'mm-expand': PM.MindMap.setAll(m, false); break;
      case 'mm-reset': this.notify(PM.MindMap.resetPositions(m) ? 'Tópicos reorganizados.' : 'Os tópicos já estão na posição automática.'); break;
    }
  }

  // Atualiza o visual dos botões: destaque (active) e habilitado/desabilitado (disabled).
  refresh() {
    const m = this.m;
    // qsa: só mexe no botão se ele existir (a barra do mapa mental tem menos botões)
    const q = (sel) => this.el.querySelector(sel) || {};
    // destaca a forma ativa
    this.el.querySelectorAll('[data-shape]').forEach((b) => b.classList.toggle('active', m.tool === b.dataset.shape));
    this.el.querySelector('[data-act=select]').classList.toggle('active', m.tool === 'select');
    this.el.querySelector('[data-act=hand]').classList.toggle('active', m.tool === 'hand');
    if (q('[data-act=pen]').classList) q('[data-act=pen]').classList.toggle('active', m.tool === 'pen');
    if (q('[data-act=snap]').classList) q('[data-act=snap]').classList.toggle('active', m.snap);
    // desabilita Desfazer/Refazer quando não há para onde ir
    q('[data-act=undo]').disabled = !m.history.canUndo();
    q('[data-act=redo]').disabled = !m.history.canRedo();
    const hasSel = m.sel.size > 0; // há algo selecionado?
    q('[data-act=del]').disabled = !hasSel;
    q('[data-act=dup]').disabled = !m.selectedShapes().length;
    const n = m.selectedShapes().length;
    // ^= no seletor CSS significa "começa com": todos os botões al-* e dist-*
    this.el.querySelectorAll('[data-act^=al-]').forEach((b) => (b.disabled = n < 2));
    this.el.querySelectorAll('[data-act^=dist-]').forEach((b) => (b.disabled = n < 3));
  }
};
