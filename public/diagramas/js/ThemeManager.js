/* =========================================================================
   ThemeManager.js — TEMAS VISUAIS (modal de seleção)
   -------------------------------------------------------------------------
   PAPEL NA ARQUITETURA
   Cria o botão "Tema" no cabeçalho e o modal com os temas disponíveis.
   Aplicar um tema é só trocar o atributo data-theme do <html>:
       <html data-theme="proof-escuro">
   O style.css tem um bloco de VARIÁVEIS CSS para cada tema. Como toda a
   interface E o SVG do quadro usam essas variáveis, tudo muda de cor na
   hora — nenhum outro módulo precisa redesenhar nada.

   Temas (no Lisa_Proof, 31/10/2026):
     • proof-escuro → o verde do Proof no fundo escuro (padrão)
     • proof-claro  → o verde do Proof no fundo claro
     • processmap   → roxo escuro (o tema original do quadro)
   O tema escolhido vai junto no JSON exportado (campo "theme") e é
   reaplicado ao importar. Nada é salvo no navegador.
   ========================================================================= */
window.PM = window.PM || {}; // namespace global do sistema

PM.ThemeManager = class ThemeManager {
  /**
   * @param button  <div> do cabeçalho onde o botão "Tema" será criado
   * @param modal   <div class="modal"> usado para a janela de temas
   * @param notify  função de mensagem (toast)
   */
  constructor({ button, modal, notify }) {
    this.btnBox = button;
    this.modal = modal;
    this.notify = notify;
    // Catálogo de temas. "preview" alimenta a miniatura do card no modal.
    this.themes = [
      {
        id: 'lisa', name: 'Lisa', desc: 'O azul da Lisa no fundo escuro',
        preview: { bg: '#050B10', bar: '#08121A', s1: 'linear-gradient(135deg,#5AA9FF,#2563A8)', s2: '#EAF4FF', line: '#9CCBFF', logo: '/marca/lisa.png' },
        dots: ['#050B10', '#1E3A5F', '#2563A8', '#5AA9FF', '#EAF4FF'],
      },
      {
        id: 'proof-escuro', name: 'Proof escuro', desc: 'O verde do Lisa_Proof no fundo escuro',
        preview: { bg: '#0D1310', bar: '#111814', s1: 'linear-gradient(135deg,#22C55E,#15803D)', s2: '#F7F3EA', line: '#6EE7A0', logo: '/marca/lisa.png' },
        dots: ['#0D1310', '#14532D', '#16A34A', '#22C55E', '#F7F3EA'],
      },
      {
        id: 'proof-claro', name: 'Proof claro', desc: 'O verde do Lisa_Proof no fundo claro',
        preview: { bg: '#F4F6F5', bar: '#FFFFFF', s1: 'linear-gradient(135deg,#22C55E,#16A34A)', s2: '#1F2937', line: '#374151', logo: '/marca/lisa.png' },
        dots: ['#FFFFFF', '#F4F6F5', '#22C55E', '#15803D', '#1F2937'],
      },
      {
        id: 'processmap', name: 'ProcessMap', desc: 'Roxo escuro · o tema original do quadro',
        preview: { bg: '#0b0710', bar: '#120c19', s1: 'linear-gradient(135deg,#8b3fd1,#5e1f8e)', s2: '#c9a6ef', line: '#b48ae0', logo: '/marca/lisa.png' },
        dots: ['#0b0710', '#431465', '#6f27a5', '#8b3fd1', '#d6bff3'],
      },
    ];
    this.current = document.documentElement.dataset.theme || 'lisa'; // tema atual
    this._renderButton();
  }

  // O ícone do título do modal: uma paleta simples.
  static CHAPA = `<svg class="theme-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.6 0-1.3-1-1.7-1-2.9 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/></svg>`;

  // Botão "Tema" no cabeçalho (ícone de paleta).
  _renderButton() {
    this.btnBox.innerHTML = `<button class="btn" title="Escolher tema (T)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.6 0-1.3-1-1.7-1-2.9 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7.5" r="1.2" fill="currentColor"/></svg>Tema</button>`;
    this.btnBox.querySelector('button').addEventListener('click', () => this.open());
  }

  // Verifica se um id de tema existe (usado ao importar JSON).
  has(id) { return this.themes.some((t) => t.id === id); }

  // Aplica um tema: troca o atributo do <html>. O CSS faz o resto.
  apply(id, silent = false) {
    if (!this.has(id)) return;
    this.current = id;
    document.documentElement.dataset.theme = id; // dataset.theme ↔ atributo data-theme
    // Atualiza o destaque do card, se o modal estiver aberto
    this.modal.querySelectorAll('[data-theme-id]').forEach((c) => c.classList.toggle('active', c.dataset.themeId === id));
    if (!silent) this.notify(`Tema aplicado: ${this.themes.find((t) => t.id === id).name}`);
  }

  // Abre o modal com um card por tema (miniatura + nome + amostras de cor).
  open() {
    const cards = this.themes.map((t) => {
      const p = t.preview;
      return `<button class="theme-card${t.id === this.current ? ' active' : ''}" data-theme-id="${t.id}">
        <div class="theme-prev" style="background:${p.bg}">
          <div class="bar" style="background:${p.bar}"></div>
          <div class="shapes">
            <div class="s1" style="background:${p.s1}"></div>
            <div class="arr" style="background:${p.line}"></div>
            <div class="s2" style="background:${p.s2}"></div>
          </div>
          <img src="${p.logo}" alt="" style="height:22px" />
        </div>
        <div class="theme-info"><b>${t.name}</b><span>${t.desc}</span>
          <div class="theme-dots">${t.dots.map((c) => `<i style="background:${c}"></i>`).join('')}</div>
        </div>
      </button>`;
    }).join('');
    this.modal.innerHTML = `<div class="modal-card wide">
      <h2>${ThemeManager.CHAPA}Temas</h2>
      <p class="sub">O tema muda a interface e as cores "Principal" das formas. Ele é salvo junto no JSON exportado.</p>
      <div class="theme-grid">${cards}</div>
      <button class="btn primary" data-close>Fechar</button></div>`;
    this.modal.hidden = false;
    // Delegação: um clique em qualquer card aplica o tema; fora do cartão ou "Fechar" fecha.
    this.modal.onclick = (e) => {
      const card = e.target.closest('[data-theme-id]');
      if (card) return this.apply(card.dataset.themeId);
      if (e.target === this.modal || e.target.closest('[data-close]')) this.close();
    };
  }

  close() { this.modal.hidden = true; }
  isOpen() { return !this.modal.hidden; }
};
