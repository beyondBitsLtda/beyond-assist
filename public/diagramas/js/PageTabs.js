/* =========================================================================
   PageTabs.js — A BARRA DE ABAS (como as páginas do Visio)
   -------------------------------------------------------------------------
   PAPEL NA ARQUITETURA
   Só a INTERFACE das abas, no rodapé do quadro. Os dados (que abas existem,
   o que tem em cada uma, trocar de aba) são do ShapeManager:
     clique na aba      → manager.goToPage(id)
     duplo clique       → renomear (o nome vira um campo de texto)
     botão direito      → menu: renomear, duplicar, mover, excluir
     arrastar a aba     → muda a ordem
     "+"                → manager.addPage()
   No mapa mental a barra some (ele tem uma aba só).

   CONCEITOS DE JAVASCRIPT USADOS AQUI
   - Delegação de eventos: um listener na barra inteira, e closest() descobre
     qual aba foi clicada.
   - Drag & drop do HTML5 (dragstart / dragover / drop) para reordenar.
   ========================================================================= */
window.PM = window.PM || {}; // namespace global do sistema

PM.PageTabs = class PageTabs {
  constructor({ manager, wrap, notify }) {
    this.m = manager;
    this.notify = notify;
    this.el = document.createElement('div');
    this.el.className = 'page-tabs';
    this.el.setAttribute('role', 'tablist');
    this.el.setAttribute('aria-label', 'Abas do documento');
    wrap.appendChild(this.el);
    this.menu = null;
    this.m.on('pages', () => this.render());
    this.m.on('mode', () => this.render());
    this._bind();
    this.render();
  }

  render() {
    const m = this.m;
    this.el.hidden = m.mode === 'mindmap';
    this._fecharMenu();
    // Só trocou a aba aberta? Muda o destaque e mantém os botões - refazer o
    // HTML debaixo do mouse faria o navegador perder o duplo clique (renomear).
    const atuais = [...this.el.querySelectorAll('[data-page]')];
    if (atuais.length === m.pages.length && atuais.every((b, i) => b.dataset.page === m.pages[i].id && b.textContent === m.pages[i].name)) {
      atuais.forEach((b) => { const on = b.dataset.page === m.pageId; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
      return;
    }
    this.el.innerHTML = m.pages.map((p) => `<button type="button" class="pg-tab${p.id === m.pageId ? ' active' : ''}" role="tab" draggable="true"
        aria-selected="${p.id === m.pageId}" data-page="${m.esc(p.id)}" title="${m.esc(p.name)} — duplo clique renomeia · botão direito: mais opções">${m.esc(p.name)}</button>`).join('') +
      '<button type="button" class="pg-add" data-pg-add title="Nova aba" aria-label="Nova aba">+</button>';
  }

  _bind() {
    const m = this.m;
    this.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-pg-add]')) { m.addPage(); return; }
      const t = e.target.closest('[data-page]');
      if (t && !t.querySelector('input')) m.goToPage(t.dataset.page);
    });
    this.el.addEventListener('dblclick', (e) => {
      const t = e.target.closest('[data-page]');
      if (t) this.renomear(t.dataset.page);
    });
    this.el.addEventListener('contextmenu', (e) => {
      const t = e.target.closest('[data-page]');
      if (!t) return;
      e.preventDefault();
      this._abrirMenu(t.dataset.page, t);
    });
    // reordenar arrastando
    this.el.addEventListener('dragstart', (e) => {
      const t = e.target.closest('[data-page]'); if (!t) return;
      e.dataTransfer.setData('application/x-pm-page', t.dataset.page);
      e.dataTransfer.effectAllowed = 'move';
    });
    this.el.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('application/x-pm-page')) e.preventDefault(); });
    this.el.addEventListener('drop', (e) => {
      const id = e.dataTransfer.getData('application/x-pm-page');
      const t = e.target.closest('[data-page]');
      if (!id || !t) return;
      e.preventDefault();
      m.movePage(id, m.pages.findIndex((p) => p.id === t.dataset.page));
    });
    document.addEventListener('pointerdown', (e) => { if (this.menu && !e.target.closest('.pg-menu')) this._fecharMenu(); });
  }

  // O nome vira um campo de texto: Enter confirma, Esc desiste.
  renomear(id) {
    const t = this.el.querySelector(`[data-page="${CSS.escape(id)}"]`);
    const p = this.m.pages.find((x) => x.id === id);
    if (!t || !p) return;
    const inp = document.createElement('input');
    inp.className = 'pg-nome';
    inp.value = p.name;
    inp.maxLength = 60;
    inp.setAttribute('aria-label', 'Nome da aba');
    t.textContent = '';
    t.appendChild(inp);
    t.draggable = false;
    inp.focus(); inp.select();
    let feito = false;
    const fim = (ok) => { if (feito) return; feito = true; if (!(ok && this.m.renamePage(id, inp.value))) this.render(); };
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation(); // as letras não são atalhos do quadro
      if (e.key === 'Enter') { e.preventDefault(); fim(true); }
      if (e.key === 'Escape') { e.preventDefault(); fim(false); }
    });
    inp.addEventListener('blur', () => fim(true));
  }

  _abrirMenu(id, alvo) {
    this._fecharMenu();
    const m = this.m;
    const i = m.pages.findIndex((p) => p.id === id);
    const menu = document.createElement('div');
    menu.className = 'pg-menu';
    menu.setAttribute('role', 'menu');
    const op = (act, txt, off) => `<button type="button" role="menuitem" data-pg-act="${act}"${off ? ' disabled' : ''}>${txt}</button>`;
    menu.innerHTML = op('ren', 'Renomear') + op('dup', 'Duplicar') + op('esq', 'Mover para a esquerda', i === 0) +
      op('dir', 'Mover para a direita', i === m.pages.length - 1) + op('del', 'Excluir a aba', m.pages.length < 2);
    this.el.appendChild(menu);
    menu.style.left = `${alvo.offsetLeft}px`;
    this.menu = menu;
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pg-act]');
      if (!b || b.disabled) return;
      this._fecharMenu();
      const act = b.dataset.pgAct;
      if (act === 'ren') this.renomear(id);
      else if (act === 'dup') m.duplicatePage(id);
      else if (act === 'esq') m.movePage(id, i - 1);
      else if (act === 'dir') m.movePage(id, i + 1);
      else if (act === 'del') this.excluir(id);
    });
  }
  _fecharMenu() { if (this.menu) { this.menu.remove(); this.menu = null; } }

  excluir(id) {
    const m = this.m;
    const p = m.pages.find((x) => x.id === id);
    if (!p) return;
    const st = id === m.pageId ? m : m._store[id];
    const n = st ? st.shapes.length : 0;
    // com conteúdo, pergunta antes (sem conteúdo não há o que perder)
    if (n && !window.confirm(`Excluir a aba "${p.name}" e as ${n} forma(s) dela?`)) return;
    if (m.removePage(id)) this.notify(`Aba "${p.name}" excluída.`);
  }
};
