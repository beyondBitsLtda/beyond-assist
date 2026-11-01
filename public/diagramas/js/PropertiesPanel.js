/* =========================================================================
   PropertiesPanel.js — PAINEL LATERAL DE PROPRIEDADES
   -------------------------------------------------------------------------
   PAPEL NA ARQUITETURA
   Mostra e edita os dados do que está selecionado:
     • Forma(s): texto, largura/altura, cor, ordem (frente/trás), excluir
     • Imagem:   miniatura, tamanho, restaurar proporção/tamanho original
     • Linha(s): rótulo, traçado (ortogonal/reta/curva), contínua/tracejada,
                 pontas (seta, herança, pé de galinha...), rótulos das pontas,
                 atalhos prontos (associação, «include», 1:N...), portas
                 automáticas, inverter direção
     • Código:   a linguagem do realce de sintaxe
     • Mapa mental: novo filho/irmão, recolher, cor do galho
     • Nada selecionado: dicas de uso
   Funciona como um "formulário reativo": sempre que a seleção muda, o
   painel é redesenhado (render). Quando o usuário altera um campo, o
   painel atualiza os DADOS no ShapeManager, que redesenha o quadro.
   ========================================================================= */
window.PM = window.PM || {}; // namespace global do sistema

PM.PropertiesPanel = class PropertiesPanel {
  constructor({ el, manager }) {
    this.el = el;
    this.m = manager;
    // Redesenha quando a seleção muda
    this.m.on('selection', () => this.render());
    // Redesenha quando o diagrama muda (ex.: desfazer), EXCETO se o usuário estiver
    // digitando em um campo do painel — senão o cursor "pularia" a cada tecla.
    // document.activeElement = elemento que está com o foco no momento.
    this.m.on('change', () => { if (!this.el.contains(document.activeElement)) this.render(); });
    // o lápis mostra a cor e a espessura; as abas entram na lista de links
    this.m.on('tool', () => this.render());
    this.m.on('pages', () => this.render());
    // Delegação de eventos (um listener para o painel inteiro):
    this.el.addEventListener('input', (e) => this._input(e));   // a cada tecla digitada
    this.el.addEventListener('change', (e) => this._change(e)); // ao sair do campo / confirmar valor
    this.el.addEventListener('click', (e) => this._click(e));   // botões e amostras de cor
    this.render();
  }

  // Monta o HTML do painel conforme o que está selecionado.
  render() {
    const shapes = this.m.selectedShapes();
    const conns = this.m.selectedConns();
    const esc = (t) => this.m.esc(t);
    // Nada selecionado → painel de dicas (ou o do lápis, se ele estiver ativo)
    if (!shapes.length && !conns.length) { this.el.innerHTML = this.m.tool === 'pen' ? this._lapis() : this._empty(); return; }

    let h = ''; // HTML acumulado
    // ===== Seção de FORMAS =====
    if (shapes.length) {
      const s = shapes[0];
      const one = shapes.length === 1;            // texto e tamanho só são editáveis com 1 forma
      const isImg = one && s.type === 'image';    // imagem tem um painel próprio
      const allImg = shapes.every((k) => k.type === 'image');
      const def = PM.ShapeLibrary.get(s.type);
      const mind = this.m.mode === 'mindmap';
      h += `<h3>${one ? def.label : `${shapes.length} formas`}</h3>`;
      if (isImg) {
        // Miniatura + tamanho real + peso aproximado do base64 no JSON
        const src = this.m.assets.get(s.asset) || '';
        const kb = Math.round(src.length * 0.75 / 1024);
        h += `${src ? `<img class="img-preview" src="${src}" alt=""/>` : ''}
          <p class="muted" style="margin-top:0">Original: ${s.iw}×${s.ih}px · ~${kb} KB no JSON</p>`;
      } else if (one && def.render === 'code') {
        // o código se escreve no próprio bloco (com o realce enquanto digita)
        h += '<button class="btn" data-a="edit-code">Editar o código no quadro</button>';
        h += '<p class="muted hint">Ou dê <b>dois cliques</b> no bloco (ou <b>Enter</b> com ele selecionado). Ctrl+Enter confirma, Esc cancela.</p>';
      } else if (one && !def.noText) {
        h += `<div class="field"><label>Texto</label><textarea data-f="text"${def.render === 'table' || def.render === 'class' ? ' class="mono" spellcheck="false"' : ''}>${esc(s.text)}</textarea></div>`;
        // dicas do formato das formas estruturadas
        if (def.render === 'table') h += '<button class="btn" data-a="add-row">+ Adicionar coluna</button>';
        if (def.render === 'class') h += '<div class="field row"><button class="btn" data-a="add-row">+ Atributo</button><button class="btn" data-a="add-metodo">+ Método</button></div>';
        if (def.render === 'table') h += '<p class="muted hint">1ª linha: nome da tabela. Uma coluna por linha, <b>nome: tipo</b>. No início, <b>PK</b>, <b>FK</b>, <b>UQ</b>, <b>IX</b> ou <b>NN</b> viram selos.</p>';
        if (def.render === 'class') h += '<p class="muted hint">1ª seção: o nome (uma linha <b>«estereótipo»</b> antes, se quiser). Uma linha só com <b>--</b> separa atributos e métodos.</p>';
        if (def.container) h += '<p class="muted hint">Agrupador: arraste pela borda ou pela faixa do título e o que estiver dentro vai junto.</p>';
      }
      if (one && def.render === 'code') {
        const L = PM.SyntaxHighlighter.languages;
        h += `<div class="field"><label>Linguagem</label><select data-f="lang">${Object.keys(L).map((k) => `<option value="${k}"${(s.lang || 'javascript') === k ? ' selected' : ''}>${L[k].label}</option>`).join('')}</select></div>`;
      }
      if (mind && one) {
        const MM = PM.MindMap;
        const filhos = MM.children(this.m, s.id).length;
        h += `<button class="btn" data-a="mm-child">Novo tópico filho (Tab)</button>
          ${s.type === 'mmRoot' ? '' : '<button class="btn" data-a="mm-sibling">Novo tópico irmão (Enter)</button>'}
          ${filhos && s.type !== 'mmRoot' ? `<button class="btn" data-a="mm-toggle">${s.collapsed ? `Expandir (${MM.descendants(this.m, s.id).length} escondidos)` : 'Recolher (R)'}</button>` : ''}
          ${s.ox || s.oy ? '<button class="btn" data-a="mm-auto" title="Desfaz a posição manual deste tópico">Voltar à posição automática</button>' : ''}`;
      }
      // Desenho à mão: a espessura do traço
      if (shapes.every((k) => k.type === 'ink')) {
        h += `<div class="field"><label>Espessura do traço</label><select data-f="sw">${PropertiesPanel.ESPESSURAS.map((v) => `<option value="${v}"${shapes.every((k) => +k.sw === v) ? ' selected' : ''}>${v} px</option>`).join('')}</select></div>`;
      }
      // Caixa de texto: tamanho da letra e negrito
      if (one && s.type === 'freeText') {
        h += `<div class="field row">
                <div><label>Tamanho da letra</label><select data-f="fs">${PropertiesPanel.LETRAS.map((v) => `<option value="${v}"${(+s.fs || 14) === v ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
                <div><label>Estilo</label><div class="seg"><button data-a="bold" class="${s.fb ? 'active' : ''}" title="Negrito"><b>N</b></button></div></div>
              </div>`;
      }
      if (one && !mind) {
        h += `<div class="field row">
                <div><label>Largura</label><input type="number" data-f="w" value="${s.w}" min="20" step="10"/></div>
                <div><label>Altura</label><input type="number" data-f="h" value="${s.h}" min="20" step="10"/></div>
              </div>`;
      }
      if (isImg) {
        h += `<button class="btn" data-a="img-ratio" title="Corrige a distorção mantendo a largura atual">Restaurar proporção</button>
              <button class="btn" data-a="img-orig">Tamanho original</button>`;
      }
      // cor: não no código (cartão fixo); no mapa mental, só no tema central e no 1º nível (a cor do galho)
      const semCor = shapes.some((k) => PM.ShapeLibrary.get(k.type).noColor) ||
        (mind && shapes.some((k) => k.type === 'mmNode' && PM.MindMap.depth(this.m, k) > 1));
      if (!allImg && !semCor) {
        // Amostras de cor geradas a partir da paleta; "active" marca a cor em uso
        // (every = "todas as formas selecionadas têm esta cor?")
        h += `<div class="field"><label>Cor</label><div class="swatches">
          ${PM.Palette.map((p) => `<span class="swatch${shapes.every((k) => k.color === p.id) ? ' active' : ''}" data-color="${p.id}" title="${p.name}" style="background:${p.id === 'graphite' && shapes.every((k) => k.type === 'ink' || k.type === 'freeText') ? 'var(--ink)' : p.solid}"></span>`).join('')}
        </div></div>`;
      }
      if (!mind) {
        // Link para uma aba: Ctrl+clique no elemento abre a aba
        if (one && this.m.pages.length > 1) {
          const outras = this.m.pages.filter((p) => p.id !== this.m.pageId);
          h += `<div class="field"><label>Link para a aba</label><select data-f="link"><option value="">(nenhum)</option>
            ${outras.map((p) => `<option value="${esc(p.id)}"${s.link === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}
            ${s.link && !this.m.pages.some((p) => p.id === s.link) ? '<option value="" selected>(aba excluída)</option>' : ''}</select></div>`;
          if (s.link && this.m.pages.some((p) => p.id === s.link)) h += '<button class="btn" data-a="follow">Ir para a aba (Ctrl+clique)</button>';
        } else if (one && this.m.pages.length === 1) {
          h += '<p class="muted hint">Crie outra aba (no <b>+</b> lá embaixo) para ligar este elemento a ela: Ctrl+clique abre a aba.</p>';
        }
        // Travar: não move, não redimensiona, não sai na seleção por área
        const travadas = shapes.every((k) => k.locked);
        h += `<button class="btn${travadas ? ' active' : ''}" data-a="lock" title="Ctrl+Shift+L">${travadas ? '🔒 Destravar posição' : 'Travar posição'}</button>`;
        if (travadas) h += '<p class="muted hint">Travada: não move nem redimensiona e fica de fora da seleção por área. O que está dentro dela continua livre.</p>';
        h += `<button class="btn" data-a="front">Trazer para frente</button>
      <button class="btn" data-a="back">Enviar para trás</button>`;
      }
      if (!(mind && one && s.type === 'mmRoot')) h += `<button class="btn danger" data-a="del">${mind ? 'Excluir tópico e descendência' : 'Excluir'}</button>`;
    }
    // ===== Seção de CONEXÕES =====
    if (conns.length) {
      const c = conns[0];
      const one = conns.length === 1;
      // Função auxiliar: devolve ' active' se TODAS as conexões usam o estilo v
      const st = (v) => (conns.every((k) => (k.style || 'orthogonal') === v) ? ' active' : '');
      const R = PM.ConnectionRouter;
      h += `<h3 style="margin-top:${shapes.length ? 18 : 0}px">${one ? 'Conexão' : `${conns.length} conexões`}</h3>
        ${one && c._ends ? `<p class="muted" style="margin-top:0">Saída: <b>${R.NAMES[c._ends.ports[0]]}</b>${c.fromPort === 'auto' ? ' (auto)' : ''} · Entrada: <b>${R.NAMES[c._ends.ports[1]]}</b>${c.toPort === 'auto' ? ' (auto)' : ''}</p>` : ''}
        ${one ? `<div class="field"><label>Rótulo da linha</label><input type="text" data-f="label" value="${esc(c.label)}" placeholder="ex.: Sim / Não"/></div>` : ''}
        <div class="field"><label>Traçado</label><div class="seg">
          <button data-style="orthogonal" class="${st('orthogonal')}">Ortogonal</button>
          <button data-style="straight" class="${st('straight')}">Reta</button>
          <button data-style="curve" class="${st('curve')}">Curva</button></div></div>
        <div class="field"><label>Linha</label><div class="seg">
          <button data-dash="0" class="${conns.every((k) => !k.dashed) ? 'active' : ''}">Contínua</button>
          <button data-dash="1" class="${conns.every((k) => k.dashed) ? 'active' : ''}">Tracejada</button></div></div>
        <div class="field row">
          <div><label>Ponta da origem</label><select data-f="arrowStart">${this._pontas(conns, 'arrowStart', 'none')}</select></div>
          <div><label>Ponta do destino</label><select data-f="arrow">${this._pontas(conns, 'arrow', 'arrow')}</select></div>
        </div>
        ${one ? `<div class="field row">
          <div><label>Rótulo na origem</label><input type="text" data-f="labelFrom" value="${esc(c.labelFrom || '')}" placeholder="ex.: 1"/></div>
          <div><label>Rótulo no destino</label><input type="text" data-f="labelTo" value="${esc(c.labelTo || '')}" placeholder="ex.: 0..*"/></div>
        </div>` : ''}
        <div class="field"><label>Modelos de ligação</label><div class="presets">
          ${Object.keys(PropertiesPanel.PRESETS).map((k) => `<button data-preset="${k}" title="${PropertiesPanel.PRESETS[k].tip}">${PropertiesPanel.PRESETS[k].nome}</button>`).join('')}
        </div></div>
        <p class="muted hint">Para religar uma ponta, arraste a bolinha dela até outra forma.</p>
        <button class="btn" data-a="autoports" title="Recalcula os lados de saída/chegada conforme a posição das formas">Portas automáticas</button>
        ${one ? '<button class="btn" data-a="reverse">Inverter direção</button>' : ''}
        ${shapes.length ? '' : '<button class="btn danger" data-a="del">Excluir</button>'}`;
    }
    this.el.innerHTML = h;
  }

  // As opções de ponta de linha, com a atual marcada (vazio se a seleção mistura pontas).
  _pontas(conns, campo, padrao) {
    const atual = conns.map((c) => c[campo] || padrao);
    const igual = atual.every((v) => v === atual[0]) ? atual[0] : '';
    const M = PM.ShapeLibrary.markers;
    return `${igual ? '' : '<option value="" selected>(várias)</option>'}<option value="none"${igual === 'none' ? ' selected' : ''}>Nenhuma</option>` +
      Object.keys(M).map((k) => `<option value="${k}"${igual === k ? ' selected' : ''}>${M[k].label}</option>`).join('');
  }

  // Modelos prontos de ligação para UML, caso de uso e banco de dados.
  // Cada um é só um "patch" de campos da conexão.
  static PRESETS = {
    flow: { nome: 'Fluxo', tip: 'Seta cheia, linha contínua', p: { arrow: 'arrow', arrowStart: 'none', dashed: false, label: '' } },
    assoc: { nome: 'Associação', tip: 'Linha sem pontas (ator ↔ caso de uso)', p: { arrow: 'none', arrowStart: 'none', dashed: false } },
    include: { nome: '«include»', tip: 'Tracejada, seta aberta, rótulo «include»', p: { arrow: 'open', arrowStart: 'none', dashed: true, label: '«include»' } },
    extend: { nome: '«extend»', tip: 'Tracejada, seta aberta, rótulo «extend»', p: { arrow: 'open', arrowStart: 'none', dashed: true, label: '«extend»' } },
    heranca: { nome: 'Herança', tip: 'Triângulo vazado no destino (generalização)', p: { arrow: 'triangle', arrowStart: 'none', dashed: false } },
    realiza: { nome: 'Realização', tip: 'Tracejada com triângulo vazado (implementa interface)', p: { arrow: 'triangle', arrowStart: 'none', dashed: true } },
    depend: { nome: 'Dependência', tip: 'Tracejada com seta aberta', p: { arrow: 'open', arrowStart: 'none', dashed: true } },
    agrega: { nome: 'Agregação', tip: 'Losango vazado na origem', p: { arrow: 'none', arrowStart: 'diamond', dashed: false } },
    compoe: { nome: 'Composição', tip: 'Losango cheio na origem', p: { arrow: 'none', arrowStart: 'diamondFill', dashed: false } },
    r11: { nome: '1 : 1', tip: 'Um para um (banco de dados)', p: { arrow: 'oneOnly', arrowStart: 'oneOnly', dashed: false } },
    r1n: { nome: '1 : N', tip: 'Um para muitos (banco de dados)', p: { arrow: 'many', arrowStart: 'oneOnly', dashed: false } },
    r0n: { nome: '1 : 0..N', tip: 'Um para zero ou muitos (banco de dados)', p: { arrow: 'zeroMany', arrowStart: 'oneOnly', dashed: false } },
    rnn: { nome: 'N : N', tip: 'Muitos para muitos (banco de dados)', p: { arrow: 'many', arrowStart: 'many', dashed: false } },
  };

  static ESPESSURAS = [1, 2, 3, 5, 8, 12, 18];
  static LETRAS = [11, 12, 14, 16, 18, 22, 28, 36, 48];

  // O lápis ativo e nada selecionado: a cor e a espessura do próximo traço.
  _lapis() {
    const m = this.m;
    return `<h3>Desenhar à mão</h3>
      <p class="muted">Arraste no quadro para desenhar. Cada traço vira um desenho que dá para mover, esticar, travar e excluir. <kbd>Esc</kbd> volta a Selecionar.</p>
      <div class="field"><label>Cor</label><div class="swatches">
        ${PM.Palette.map((p) => `<span class="swatch${m.inkColor === p.id ? ' active' : ''}" data-pen-color="${p.id}" title="${p.name}" style="background:${p.id === 'graphite' ? 'var(--ink)' : p.solid}"></span>`).join('')}
      </div></div>
      <div class="field"><label>Espessura</label><select data-f="pen-sw">${PropertiesPanel.ESPESSURAS.map((v) => `<option value="${v}"${m.inkWidth === v ? ' selected' : ''}>${v} px</option>`).join('')}</select></div>`;
  }

  // Conteúdo exibido quando não há seleção (dicas e atalhos).
  _empty() {
    const n = this.m.shapes.length;
    return `<h3>Propriedades</h3>
      <p class="muted">${n ? 'Selecione uma forma ou linha para editar.' : 'O quadro está vazio.'}</p>
      <p class="muted"><b>Conectar:</b> passe o mouse sobre uma forma e arraste um dos pontos até outra forma. A porta de entrada escolhida fica destacada com o nome do lado. Soltando no vazio, uma nova etapa é criada já alinhada.</p>
      <p class="muted"><b>Redimensionar:</b> segure <kbd>Shift</kbd> nas alças para manter a proporção.</p>
      <p class="muted"><b>Imagens:</b> copie uma imagem (print, Teams, navegador) e cole com <kbd>Ctrl</kbd>+<kbd>V</kbd>.</p>
      <p class="muted"><b>Abas:</b> o <b>+</b> no rodapé do quadro cria outra aba; duplo clique renomeia e o botão direito tem mais opções. Ligue um elemento a uma aba no painel e use <kbd>Ctrl</kbd>+clique para abri-la.</p>
      <p class="muted"><b>Raias:</b> trave a raia (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>) para mexer no que está dentro sem arrastá-la sem querer.</p>
      ${this.m.mode === 'mindmap'
        ? '<p class="muted"><b>Mapa mental:</b> <kbd>Tab</kbd> cria um tópico filho, <kbd>Enter</kbd> um irmão, <kbd>R</kbd> recolhe/expande. Arraste um tópico sobre outro para mudar o pai.</p>'
        : '<p class="muted"><b>Figuras:</b> troque a coleção na barra (Fluxograma, UML, Caso de uso, Banco de dados, Arquitetura, BPMN, Nuvem e infraestrutura, Modelo C4).</p>'}
      <div class="legend">
        <div><span>Editar texto</span><span><kbd>Duplo clique</kbd> / <kbd>Enter</kbd></span></div>
        <div><span>Copiar / colar</span><span><kbd>Ctrl</kbd>+<kbd>C</kbd> <kbd>V</kbd></span></div>
        <div><span>Movimento livre</span><span><kbd>Alt</kbd> + arrastar</span></div>
        <div><span>Seleção múltipla</span><span><kbd>Shift</kbd> + clique</span></div>
        <div><span>Tema</span><span><kbd>T</kbd></span></div>
        <div><span>Exportar</span><span><kbd>Ctrl</kbd>+<kbd>S</kbd></span></div>
      </div>`;
  }

  // Digitação em tempo real: altera o dado e redesenha, SEM gravar no histórico
  // (senão cada letra viraria um passo de Ctrl+Z). O commit acontece no _change.
  _input(e) {
    const f = e.target.dataset.f; if (!f) return; // data-f indica qual campo é
    if (f === 'text') { const s = this.m.selectedShapes()[0]; s.text = e.target.value; this.m.render(); }
    if (f === 'label' || f === 'labelFrom' || f === 'labelTo') { const c = this.m.selectedConns()[0]; c[f] = e.target.value; this.m.render(); }
  }

  // Valor confirmado (saiu do campo): aplica tamanho e grava no histórico.
  _change(e) {
    const f = e.target.dataset.f; if (!f) return;
    // listas (selects): linguagem do código e pontas das linhas
    if (f === 'lang') { this.m.updateShapes(this.m.selectedShapes().map((s) => s.id), { lang: e.target.value }); return; }
    if (f === 'link') {
      const s = this.m.selectedShapes()[0];
      if (e.target.value) s.link = e.target.value; else delete s.link;
      this.m.commit(); return this.render();
    }
    if (f === 'sw') { const v = +e.target.value; this.m.inkWidth = v; this.m.updateShapes(this.m.selectedShapes().map((s) => s.id), { sw: v }); return; }
    if (f === 'pen-sw') { this.m.inkWidth = +e.target.value; return; }
    if (f === 'fs') { this.m.updateShapes(this.m.selectedShapes().map((s) => s.id), { fs: +e.target.value }); return; }
    if (f === 'arrow' || f === 'arrowStart') {
      if (!e.target.value) return;
      this.m.updateConns(this.m.selectedConns().map((c) => c.id), { [f]: e.target.value }); return this.render();
    }
    if (f === 'w' || f === 'h') {
      const s = this.m.selectedShapes()[0];
      const v = Math.max(20, Math.round(+e.target.value || 20)); // mínimo 20; "+" converte texto em número
      // redimensiona mantendo o centro (preserva alinhamento das linhas)
      if (f === 'w') { s.x += (s.w - v) / 2; s.w = v; } else { s.y += (s.h - v) / 2; s.h = v; }
    }
    this.m.commit(); // registra no histórico (texto, rótulo ou tamanho)
  }

  // Cliques em amostras de cor, botões de estilo e ações.
  _click(e) {
    const m = this.m;
    // Lápis: a cor do próximo traço
    const pc = e.target.closest('[data-pen-color]');
    if (pc) { m.inkColor = pc.dataset.penColor; return this.render(); }
    // Amostra de cor → aplica em todas as formas selecionadas (imagens não têm cor)
    const sw = e.target.closest('[data-color]');
    if (sw) {
      const alvo = m.selectedShapes().filter((s) => s.type !== 'image');
      if (alvo.length && alvo.every((s) => s.type === 'ink')) m.inkColor = sw.dataset.color; // o lápis segue a última cor usada
      m.updateShapes(alvo.map((s) => s.id), { color: sw.dataset.color }); return this.render();
    }
    // Traçado da linha (ortogonal/reta/curva)
    const st = e.target.closest('[data-style]');
    if (st) { m.updateConns(m.selectedConns().map((c) => c.id), { style: st.dataset.style }); return this.render(); }
    // Contínua / tracejada
    const da = e.target.closest('[data-dash]');
    if (da) { m.updateConns(m.selectedConns().map((c) => c.id), { dashed: da.dataset.dash === '1' }); return this.render(); }
    // Modelo de ligação (associação, «include», 1:N...)
    const pr = e.target.closest('[data-preset]');
    if (pr) { m.updateConns(m.selectedConns().map((c) => c.id), { ...PropertiesPanel.PRESETS[pr.dataset.preset].p }); return this.render(); }
    const a = e.target.closest('[data-a]'); if (!a) return;
    const s = m.selectedShapes()[0];
    switch (a.dataset.a) {
      case 'front': m.bringToFront(); break;
      case 'back': m.sendToBack(); break;
      case 'del': m.deleteSelection(); break;
      // mapa mental
      case 'mm-child': { const n = PM.MindMap.addChild(m, s.id); if (n) m.emit('edit-shape', n.id); break; }
      case 'mm-sibling': { const n = PM.MindMap.addSibling(m, s.id); if (n) m.emit('edit-shape', n.id); break; }
      case 'mm-toggle': PM.MindMap.toggle(m, s.id); break;
      case 'mm-auto': delete s.ox; delete s.oy; m.commit(); break;
      case 'add-row': m.addRow(s.id, 'atributo'); return;
      case 'lock': m.toggleLock(); break;
      case 'follow': m.followLink(s.link); return;
      case 'bold': m.updateShapes([s.id], { fb: !s.fb }); break;
      case 'edit-code': setTimeout(() => m.emit('edit-shape', s.id), 0); return; // depois do clique, o foco fica no editor
      case 'add-metodo': m.addRow(s.id, 'metodo'); return;
      // Imagem: mantém a largura e recalcula a altura pela proporção original (iw/ih)
      case 'img-ratio': {
        const h = Math.round(s.w * s.ih / s.iw);
        m.updateShapes([s.id], { y: s.y + (s.h - h) / 2, h });
        break;
      }
      // Imagem: volta ao tamanho real em pixels, mantendo o centro
      case 'img-orig':
        m.updateShapes([s.id], { x: s.x + (s.w - s.iw) / 2, y: s.y + (s.h - s.ih) / 2, w: s.iw, h: s.ih });
        break;
      // volta as portas para "auto" (o roteador escolhe o melhor lado)
      case 'autoports': m.updateConns(m.selectedConns().map((c) => c.id), { fromPort: 'auto', toPort: 'auto' }); break;
      // troca origem ↔ destino (a seta passa a apontar para o outro lado)
      case 'reverse': {
        const c = m.selectedConns()[0];
        m.updateConns([c.id], { from: c.to, to: c.from, fromPort: c.toPort, toPort: c.fromPort });
        break;
      }
    }
    this.render();
  }
};
