/* =========================================================================
   App.js — PONTO DE ENTRADA: CRIA E CONECTA TODOS OS MÓDULOS
   -------------------------------------------------------------------------
   PAPEL NA ARQUITETURA ("composition root")
   É o "maestro": não desenha formas nem calcula linhas; apenas cria cada
   módulo, entrega a ele o que precisa (injeção de dependências) e cuida
   das funções "globais" da tela:
     • barra de status e mensagens (toast)
     • editor de texto sobre a forma (duplo clique / Enter)
     • atalhos de teclado
     • janela de ajuda
     • exemplo carregado ao abrir

   DIAGRAMA DE DEPENDÊNCIAS
       App
        ├─ Viewport ............ câmera / quadro infinito
        ├─ History ............. desfazer / refazer
        ├─ ShapeManager ........ usa Viewport + History + ShapeLibrary + ConnectionRouter
        ├─ ImagePaste .......... usa ShapeManager + Viewport (Ctrl+C / Ctrl+V / imagens)
        ├─ ThemeManager ........ troca o tema (data-theme no <html>)
        ├─ FileManager ......... usa ShapeManager + Viewport + ThemeManager
        ├─ Toolbar ............. usa ShapeManager + Viewport
        ├─ PropertiesPanel ..... usa ShapeManager
        ├─ PageTabs ............ a barra de abas (usa ShapeManager)
        └─ SqlImport ........... schema SQL → diagrama de tabelas (usa ShapeManager + Viewport)
   Os módulos de baixo não conhecem o App; comunicam-se por EVENTOS
   (manager.on / emit) e por funções recebidas (ex.: notify).
   ========================================================================= */
window.PM = window.PM || {}; // namespace global do sistema

PM.App = class App {
  constructor() {
    // Atalho: $('#id') = document.querySelector('#id') (busca 1 elemento pelo seletor CSS)
    const $ = (s) => document.querySelector(s);
    this.$ = $;
    this.svg = $('#canvas');
    this.wrap = $('#canvasWrap');
    // Função de mensagem compartilhada com os módulos.
    // (m, e) => this.toast(m, e): passamos uma FUNÇÃO para o módulo poder exibir
    // mensagens sem conhecer o App (baixo acoplamento).
    const notify = (m, e) => this.toast(m, e);

    // Ordem importa: quem é usado precisa ser criado antes de quem usa.
    this.viewport = new PM.Viewport(this.svg, $('#world'));
    this.history = new PM.History();
    this.manager = new PM.ShapeManager({ svg: this.svg, wrap: this.wrap, viewport: this.viewport, history: this.history });
    this.images = new PM.ImagePaste({ manager: this.manager, viewport: this.viewport, wrap: this.wrap, notify });
    this.theme = new PM.ThemeManager({ button: $('#themeAction'), modal: $('#themeModal'), notify });
    this.files = new PM.FileManager({ manager: this.manager, viewport: this.viewport, theme: this.theme, container: $('#fileActions'), nameInput: $('#docName'), tags: $('#docTags'), notify });
    this.toolbar = new PM.Toolbar({ el: $('#toolbar'), manager: this.manager, viewport: this.viewport, notify, onHelp: () => this.help() });
    this.props = new PM.PropertiesPanel({ el: $('#propsPanel'), manager: this.manager });
    this.tabs = new PM.PageTabs({ manager: this.manager, wrap: this.wrap, notify });
    // a janela do SQL fica ao lado das outras janelas (a raiz do app)
    this.sql = new PM.SqlImport({ manager: this.manager, viewport: this.viewport, host: $('#helpModal').parentElement, notify });
    this.manager.on('notice', (t) => this.toast(t)); // avisos do quadro (forma travada, link)

    this._status();      // barra de status
    this._keys();        // atalhos
    this._textEditor();  // edição de texto in-place

    // Ao fechar/recarregar a aba com alterações não exportadas, o navegador pede confirmação.
    // (Como nada é salvo automaticamente, isso evita perder o trabalho sem querer.)
    // No Lisa_Proof (modo embutido), quem guarda o desenho é a página do exercício: sem aviso de
    // saída e sem o fluxo de exemplo (o quadro abre vazio ou com o desenho que a página mandar).
    const embutido = document.documentElement.classList.contains('embutido');
    if (!embutido) {
      window.addEventListener('beforeunload', (e) => {
        if (this.manager.dirty && this.manager.totals().shapes) { e.preventDefault(); e.returnValue = ''; }
      });
      this.loadSample(); // abre com o fluxo de exemplo
    }
  }

  /* ---------------- status e dicas ---------------- */
  // Rodapé: contadores, seleção e coordenadas do mouse.
  _status() {
    const m = this.manager;
    const upd = () => {
      this.$('#stCount').textContent = `${m.shapes.length} formas · ${m.conns.length} conexões`;
      const n = m.sel.size;
      this.$('#stSel').textContent = n ? `${n} selecionado(s)` : '';
      // Mensagem "Comece seu fluxograma" só aparece com o quadro vazio
      this.$('#emptyHint').classList.toggle('hidden', m.shapes.length > 0);
    };
    m.on('render', upd); m.on('selection', upd); // atualiza ao redesenhar ou selecionar
    m.on('pointer', (p) => { this.$('#stPos').textContent = `x ${Math.round(p.x)} · y ${Math.round(p.y)}`; });
  }

  // Mensagem temporária no rodapé. error=true usa o estilo vermelho.
  toast(msg, error = false) {
    const t = this.$('#toast');
    t.textContent = msg;
    t.classList.toggle('error', !!error);
    t.classList.add('show');
    // Se outra mensagem chegar antes de sumir, reinicia o cronômetro
    clearTimeout(this._tt);
    // setTimeout agenda uma função para daqui a 2600 ms (2,6 s)
    this._tt = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------------- editor de texto in-place ---------------- */
  // Liga os eventos que abrem/fecham o editor de texto.
  _textEditor() {
    const m = this.manager;
    m.on('edit-shape', (id) => this.editText('shape', id));
    m.on('edit-conn', (id) => this.editText('conn', id));
    // Clicou no quadro ou moveu/zoom a câmera → fecha (salvando) o editor aberto.
    // "this.ed && this.ed.blur()" = só chama blur se existir editor (curto-circuito do &&).
    m.on('pointerdown', () => this.ed && this.ed.blur());
    this.viewport.onChange(() => this.ed && this.ed.blur());
  }

  // Abre uma <textarea> posicionada EXATAMENTE sobre a forma (ou sobre o rótulo da linha).
  // kind = 'shape' ou 'conn'.
  editText(kind, id) {
    const m = this.manager, vp = this.viewport;
    const obj = kind === 'shape' ? m.getShape(id) : m.getConn(id);
    if (!obj) return;
    const def = kind === 'shape' ? PM.ShapeLibrary.get(obj.type) : {};
    if (kind === 'shape' && (obj.type === 'image' || def.noText)) return; // imagem e nó inicial não têm texto
    if (kind === 'shape' && def.render === 'code') return this._editCode(obj); // código: editor colorido no próprio bloco
    if (this.ed) this.ed.blur();
    const wr = this.wrap.getBoundingClientRect(); // posição da área do quadro na tela
    const ta = document.createElement('textarea');
    ta.className = 'text-editor';
    // Formas de várias linhas (anotação, tabela, classe, código): Enter quebra a
    // linha e Ctrl+Enter confirma. Nas demais, Enter confirma (Shift+Enter quebra).
    const multi = !!def.multiline;
    let x, y, w, h;
    if (kind === 'shape') {
      // Converte a posição da forma (mundo) para pixels de tela e aplica o zoom no tamanho
      const p = vp.toScreen(obj.x, obj.y);
      if (multi || def.align === 'left') {
        // o editor fica EXATAMENTE sobre a caixa (digitar "dentro" da anotação)
        w = Math.max(160, obj.w * vp.scale); h = Math.max(60, obj.h * vp.scale + (def.autoHeight ? 40 : 0));
        x = p.x - wr.left; y = p.y - wr.top;
        ta.classList.add('left');
        if (def.render === 'code' || def.render === 'table' || def.render === 'class') ta.classList.add('mono');
        if (obj.type === 'note') ta.classList.add('note');
      } else {
        w = Math.max(120, obj.w * vp.scale); h = Math.max(46, obj.h * vp.scale);
        x = p.x - wr.left + (obj.w * vp.scale - w) / 2; y = p.y - wr.top + (obj.h * vp.scale - h) / 2;
      }
      ta.value = obj.text;
      if (multi) ta.title = 'Enter quebra a linha · Ctrl+Enter confirma · Esc cancela';
    } else {
      // Linha: editor pequeno centralizado no ponto médio (calculado no render)
      const mid = obj._mid || { x: 0, y: 0 };
      const p = vp.toScreen(mid.x, mid.y);
      w = 160; h = 40; x = p.x - wr.left - w / 2; y = p.y - wr.top - h / 2;
      ta.value = obj.label || '';
    }
    // Object.assign copia várias propriedades de estilo de uma vez
    const letra = kind === 'shape' && obj.fs ? obj.fs : 13; // caixa de texto: o tamanho escolhido
    Object.assign(ta.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, fontSize: `${Math.max(11, letra * vp.scale)}px` });
    if (kind === 'shape' && obj.fb) ta.style.fontWeight = '700';
    this.wrap.appendChild(ta);
    this.ed = ta;
    ta.focus();
    // "+ campo": seleciona só a linha nova; texto de várias linhas: cursor no fim;
    // os demais: seleciona tudo (digitar já substitui)
    const dica = m.editHint && m.editHint.id === id ? m.editHint : null;
    m.editHint = null;
    if (dica) ta.setSelectionRange(dica.start, dica.end);
    else if (multi) ta.setSelectionRange(ta.value.length, ta.value.length);
    else ta.select();

    let done = false; // evita finalizar duas vezes (blur + Escape)
    // CLOSURE: "finish" lembra das variáveis ta, obj, kind mesmo depois que editText terminou.
    const finish = (save) => {
      if (done) return; done = true;
      if (save) {
        // código e anotação guardam o texto como está (só tira o fim em branco)
        const v = ta.value.replace(/\s+$/, ''); // remove espaços/quebras no final
        if (kind === 'shape' && v !== obj.text) { obj.text = v; m.commit(); }
        if (kind === 'conn' && v !== (obj.label || '')) { obj.label = v; m.commit(); }
      }
      ta.remove(); this.ed = null; // tira a textarea da tela
    };
    ta.addEventListener('blur', () => finish(true));
    ta.addEventListener('keydown', (e) => {
      // stopPropagation: impede que as teclas digitadas cheguem aos atalhos globais
      // (senão digitar "L" endireitaria as linhas!)
      e.stopPropagation();
      if (e.key === 'Enter' && (multi ? (e.ctrlKey || e.metaKey) : !e.shiftKey)) { e.preventDefault(); ta.blur(); }
      if (e.key === 'Escape') { finish(false); }
      // Tab no código e na tabela insere 2 espaços (em vez de sair do campo)
      if (e.key === 'Tab' && multi) {
        e.preventDefault();
        const a = ta.selectionStart, b = ta.selectionEnd;
        ta.value = ta.value.slice(0, a) + '  ' + ta.value.slice(b);
        ta.selectionStart = ta.selectionEnd = a + 2;
      }
    });
    // Clique dentro do editor não deve ser tratado como clique no quadro
    ta.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  // Editor do bloco de código: fica EXATAMENTE sobre o corpo do bloco (abaixo da
  // faixa com a linguagem), no mesmo tamanho de letra, e o texto aparece já com
  // o realce de sintaxe enquanto se digita. Truque: uma <textarea> transparente
  // (cursor e seleção) por cima de um <pre> que é repintado a cada tecla.
  _editCode(obj) {
    const m = this.manager, vp = this.viewport, H = PM.SyntaxHighlighter;
    if (this.ed) this.ed.blur();
    const k = vp.scale, cab = 30 * k;               // 30 = altura da faixa do bloco
    const wr = this.wrap.getBoundingClientRect();
    const p = vp.toScreen(obj.x, obj.y);
    const box = document.createElement('div');
    box.className = 'code-editor';
    const pre = document.createElement('pre');
    pre.className = 'ce-pre';
    pre.setAttribute('aria-hidden', 'true');
    const ta = document.createElement('textarea');
    ta.className = 'ce-ta';
    ta.spellcheck = false;
    ta.setAttribute('wrap', 'off');
    ta.setAttribute('aria-label', 'Código');
    ta.title = 'Ctrl+Enter confirma · Esc cancela · Tab recua 2 espaços';
    const fonte = { fontSize: `${12.5 * k}px`, lineHeight: `${17 * k}px`, padding: `${9 * k}px ${12 * k}px` };
    Object.assign(pre.style, fonte);
    Object.assign(ta.style, fonte);
    box.append(pre, ta);
    const h0 = Math.max(40, obj.h * k - cab);
    Object.assign(box.style, { left: `${p.x - wr.left}px`, top: `${p.y - wr.top + cab}px`, width: `${Math.max(140, obj.w * k)}px`, height: `${h0}px` });

    // repinta o realce e cresce para baixo junto com as linhas
    const pintar = () => {
      pre.innerHTML = H.highlight(ta.value, obj.lang) + '\n'; // o "\n" mostra a última linha vazia
      const precisa = (ta.value.split('\n').length * 17 + 18) * k;
      box.style.height = `${Math.max(h0, precisa)}px`;
      pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft;
    };
    ta.value = obj.text;
    pintar();
    this.wrap.appendChild(box);
    this.ed = ta;
    ta.focus();
    const dica = m.editHint && m.editHint.id === obj.id ? m.editHint : null;
    m.editHint = null;
    if (dica) ta.setSelectionRange(dica.start, dica.end);
    else ta.setSelectionRange(ta.value.length, ta.value.length);

    let done = false;
    const finish = (save) => {
      if (done) return; done = true;
      if (save) {
        const v = ta.value.replace(/\s+$/, '');
        if (v !== obj.text) { obj.text = v; m.commit(); }
      }
      box.remove(); this.ed = null;
    };
    const inserir = (txt) => {
      const a = ta.selectionStart, b = ta.selectionEnd;
      ta.value = ta.value.slice(0, a) + txt + ta.value.slice(b);
      ta.selectionStart = ta.selectionEnd = a + txt.length;
      pintar();
    };
    ta.addEventListener('input', pintar);
    ta.addEventListener('scroll', () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; });
    ta.addEventListener('blur', () => finish(true));
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation(); // as teclas não chegam aos atalhos do quadro
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ta.blur(); return; }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); return; }
      if (e.key === 'Tab') { e.preventDefault(); inserir('  '); return; }
      // Enter mantém o recuo da linha de cima
      if (e.key === 'Enter') {
        e.preventDefault();
        const ini = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
        inserir('\n' + /^[ \t]*/.exec(ta.value.slice(ini, ta.selectionStart))[0]);
      }
    });
    // cliques e a rodinha dentro do editor não são do quadro
    box.addEventListener('pointerdown', (e) => e.stopPropagation());
    box.addEventListener('wheel', (e) => e.stopPropagation());
  }

  /* ---------------- atalhos de teclado ---------------- */
  // A maioria apenas chama toolbar.run(...) — mesma ação do botão.
  // Ctrl+C / Ctrl+X / Ctrl+V NÃO estão aqui: são tratados pelo ImagePaste
  // nos eventos "copy/cut/paste" do navegador (necessário para ler imagens).
  _keys() {
    const m = this.manager, tb = this.toolbar;
    // Está digitando em algum campo? Então os atalhos não devem disparar.
    const typing = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable); };

    window.addEventListener('keydown', (e) => {
      // Shift durante o redimensionamento → trava/destrava a proporção na hora
      if (e.key === 'Shift') m.setModifiers(true);
      // Ctrl segurado: o cursor vira "mãozinha" sobre os elementos com link
      if (e.key === 'Control' || e.key === 'Meta') this.wrap.classList.add('ctrl');
      if (typing()) return;
      const k = e.key.toLowerCase();          // tecla pressionada, em minúsculo
      const ctrl = e.ctrlKey || e.metaKey;    // metaKey = tecla Command no Mac

      // Espaço segurado = modo "mover quadro" (solta no keyup)
      if (e.code === 'Space') { if (!m.spaceDown) { m.spaceDown = true; this.wrap.classList.add('space'); } e.preventDefault(); return; }
      // Combinações com Ctrl. preventDefault() evita a ação padrão do navegador
      // (ex.: Ctrl+S abriria "Salvar página", Ctrl+D criaria favorito).
      if (ctrl) {
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); m.undo(); }
        else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); m.redo(); }
        else if (k === 'd') { e.preventDefault(); m.duplicate(); }
        else if (k === 'a') { e.preventDefault(); m.selectAll(); }
        else if (k === 's') { e.preventDefault(); this.files.exportJSON(); }
        else if (k === 'o') { e.preventDefault(); this.files.openPicker(); }
        else if (k === 'l' && e.shiftKey) { e.preventDefault(); const t = m.toggleLock(); if (t !== null) this.toast(t ? 'Posição travada.' : 'Posição destravada.'); }
        return;
      }
      // MAPA MENTAL: Tab = filho, Enter = irmão, setas = navegar, Delete = tópico e descendência
      if (m.mode === 'mindmap' && this._mindKeys(e, k)) return;
      // Setas: move a seleção 10px (passo da grade) ou 1px com Shift
      const arrows = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
      if (arrows[k]) { e.preventDefault(); const st = e.shiftKey ? 1 : m.grid; m.nudge(arrows[k][0] * st, arrows[k][1] * st); return; }

      // Teclas simples
      switch (k) {
        case 'delete': case 'backspace': e.preventDefault(); m.deleteSelection(); break;
        // Esc: volta para Selecionar, limpa seleção e fecha janelas
        case 'escape': m.setTool('select'); m.clearSelection(); this.$('#helpModal').hidden = true; this.theme.close(); break;
        // Enter: edita o texto da forma selecionada
        // Lisa_Proof (05/11/2026): Enter ou F2 com UMA linha selecionada edita o rótulo dela (Sim/Não…)
        case 'enter': case 'f2': {
          const s = m.selectedShapes(), c = m.selectedConns();
          if (s.length === 1) { e.preventDefault(); this.editText('shape', s[0].id); }
          else if (!s.length && c.length === 1) { e.preventDefault(); this.editText('conn', c[0].id); }
          break;
        }
        case 'v': tb.run('select'); break;
        case 'h': tb.run('hand'); break;
        case 'p': tb.run('pen'); break;
        case 'l': tb.run('straighten'); break;
        case 'g': tb.run('snap'); break;
        case 'f': tb.run('fit'); break;
        case 'c': tb.run('focus'); break;
        case 't': this.theme.isOpen() ? this.theme.close() : this.theme.open(); break; // modal de temas
        case '+': case '=': tb.run('zoom-in'); break;
        case '-': tb.run('zoom-out'); break;
        case '0': tb.run('zoom-reset'); break;
        case '?': this.help(); break;
        default: {
          // 1..9 => formas da barra
          const n = parseInt(k, 10); // converte "3" em 3 (base 10); letras viram NaN
          if (n >= 1 && n <= 9) m.setTool(PM.ShapeLibrary.order[n - 1]);
        }
      }
    });
    // Soltou o Espaço → sai do modo mover quadro; soltou Shift → destrava a proporção
    window.addEventListener('blur', () => this.wrap.classList.remove('ctrl'));
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') m.setModifiers(false);
      if (e.key === 'Control' || e.key === 'Meta') this.wrap.classList.remove('ctrl');
      if (e.code === 'Space') { m.spaceDown = false; this.wrap.classList.remove('space'); }
    });
  }

  // Atalhos que só existem no mapa mental. Devolve true se tratou a tecla.
  _mindKeys(e, k) {
    const m = this.manager, MM = PM.MindMap;
    const sel = m.selectedShapes()[0];
    if (k === 'tab') {
      e.preventDefault();
      const n = MM.addChild(m, sel ? sel.id : (MM.root(m) || {}).id);
      if (n) this.editText('shape', n.id);
      return true;
    }
    if (k === 'enter' && sel) {
      e.preventDefault();
      // Enter no tópico: novo irmão. Para editar o texto: F2 ou duplo clique.
      const n = MM.addSibling(m, sel.id);
      if (n) this.editText('shape', n.id);
      return true;
    }
    if (k === 'f2' && sel) { e.preventDefault(); this.editText('shape', sel.id); return true; }
    const dir = { arrowleft: 'left', arrowright: 'right', arrowup: 'up', arrowdown: 'down' }[k];
    if (dir) { e.preventDefault(); MM.navigate(m, dir); return true; }
    if (k === 'r' && sel) { e.preventDefault(); MM.toggle(m, sel.id); return true; } // R = recolher/expandir
    return false;
  }

  // Janela modal com a lista de atalhos. Cada linha é [descrição, teclas].
  help() {
    const rows = [
      ['Adicionar forma', 'Clique na forma da barra e no quadro, ou arraste; <kbd>1</kbd>–<kbd>9</kbd>'],
      ['Nova etapa rápida', 'Duplo clique no vazio'],
      ['Conectar formas', 'Arraste um ponto da borda até outra forma (a porta escolhida fica destacada)'],
      ['Criar etapa conectada', 'Arraste um ponto da borda e solte no vazio'],
      ['Redimensionar proporcional', 'Segure <kbd>Shift</kbd> ao arrastar uma alça'],
      ['Colar imagem', 'Copie uma imagem e use <kbd>Ctrl</kbd>+<kbd>V</kbd> (vira base64 no JSON)'],
      ['Editar texto / rótulo', 'Duplo clique ou <kbd>Enter</kbd> (Shift+Enter quebra linha)'],
      ['Rolar o quadro', 'Roda do mouse / <kbd>Shift</kbd>+roda (lateral)'],
      ['Mover o quadro', '<kbd>Espaço</kbd>+arrastar, botão do meio ou <kbd>H</kbd>'],
      ['Zoom', '<kbd>Ctrl</kbd>+roda, <kbd>+</kbd> <kbd>-</kbd>, <kbd>0</kbd> = 100%'],
      ['Enquadrar / centralizar', '<kbd>F</kbd> todo o fluxo · <kbd>C</kbd> seleção'],
      ['Endireitar linhas', '<kbd>L</kbd> (seleção ou fluxo inteiro)'],
      ['Encaixe grade/guias', '<kbd>G</kbd> liga/desliga · <kbd>Alt</kbd> movimento livre'],
      ['Mover com precisão', 'Setas (10px) · <kbd>Shift</kbd>+setas (1px)'],
      ['Desfazer / refazer', '<kbd>Ctrl</kbd>+<kbd>Z</kbd> · <kbd>Ctrl</kbd>+<kbd>Y</kbd>'],
      ['Copiar / recortar / colar / duplicar', '<kbd>Ctrl</kbd>+<kbd>C</kbd> <kbd>X</kbd> <kbd>V</kbd> <kbd>D</kbd>'],
      ['Tema', '<kbd>T</kbd>'],
      ['Coleções de figuras', 'Seletor na barra: Fluxograma, UML, Caso de uso, Banco de dados, Arquitetura'],
      ['Religar uma seta', 'Selecione a linha e arraste a bolinha da ponta até outra forma'],
      ['Texto de várias linhas', 'Anotação, tabela, classe e código: <kbd>Enter</kbd> quebra · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> confirma'],
      ['Mapa mental', '<kbd>Tab</kbd> filho · <kbd>Enter</kbd> irmão · <kbd>F2</kbd> editar · setas navegam · <kbd>R</kbd> recolhe/expande'],
      ['Abas', '<b>+</b> no rodapé do quadro cria · duplo clique renomeia · botão direito: duplicar, mover, excluir · arraste para reordenar'],
      ['Link para uma aba', 'No painel, "Link para a aba"; depois <kbd>Ctrl</kbd>+clique no elemento abre a aba'],
      ['Raias (baias)', 'Coleção Fluxograma: raia horizontal e vertical. Arrastar a raia leva o que está dentro'],
      ['Travar / destravar posição', '<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd> (ou no painel): a travada não move nem entra na seleção por área'],
      ['Desenhar à mão livre', '<kbd>P</kbd> (lápis) · arraste no quadro · <kbd>Esc</kbd> volta a Selecionar'],
      ['Caixa de texto', 'Na barra de formas: texto livre, sem contorno (tamanho e negrito no painel)'],
      ['Diagrama de um schema SQL', 'Novo → Diagrama de um schema SQL: cole o script (ou abra o .sql) e as tabelas e relações se desenham'],
      ['Exportar / importar JSON', '<kbd>Ctrl</kbd>+<kbd>S</kbd> · <kbd>Ctrl</kbd>+<kbd>O</kbd>'],
    ];
    const md = this.$('#helpModal');
    md.innerHTML = `<div class="modal-card"><h2>Atalhos do ProcessMap</h2><table>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>
      <p style="color:var(--ink-3);font-size:12px;margin-top:14px">Nada é salvo automaticamente: use <b>Exportar JSON</b> para guardar o processo.</p>
      <button class="btn primary" data-close>Fechar</button></div>`;
    md.hidden = false; // mostra o modal
    // Fecha ao clicar fora do cartão ou no botão "Fechar"
    md.onclick = (e) => { if (e.target === md || e.target.closest('[data-close]')) md.hidden = true; };
  }

  /* ---------------- exemplo inicial ---------------- */
  // Monta o fluxo de exemplo (chamados DevOps) usando duas "fábricas":
  //   S(...) cria uma forma posicionada pelo CENTRO (cx, cy)
  //   C(...) cria uma conexão entre os números das formas (1 = s1, 2 = s2...)
  loadSample() {
    const L = PM.ShapeLibrary;
    let i = 0; // contador de ids das formas (++i incrementa ANTES de usar)
    const S = (type, cx, cy, text, color) => {
      const d = L.get(type);
      return { id: `s${++i}`, type, x: cx - d.w / 2, y: cy - d.h / 2, w: d.w, h: d.h, text, color: color || (type === 'terminal' ? 'deep' : type === 'decision' ? 'lilac' : type === 'note' ? 'graphite' : 'purple') };
    };
    const shapes = [
      S('terminal', 400, 40, 'Início'),
      S('process', 400, 150, 'Área de negócio abre chamado'),
      S('process', 400, 270, 'Triagem DevOps'),
      S('decision', 400, 400, 'É melhoria de processo?'),
      S('process', 400, 540, 'Levantamento com a área de negócio'),
      S('subprocess', 400, 660, 'Desenvolvimento'),
      S('process', 400, 780, 'Testes / QA'),
      S('terminal', 400, 900, 'Fim'),
      S('process', 680, 400, 'Atendimento de sustentação'),
      S('document', 680, 540, 'Chamado solucionado'),
      S('database', 130, 660, 'FLUIG / TOTVS RM', 'graphite'),
      S('note', 140, 540, 'Entender o negócio antes de desenvolver'),
    ];
    let j = 0; // contador de ids das conexões
    const C = (from, to, label = '', extra = {}) => ({ id: `c${++j}`, from: `s${from}`, to: `s${to}`, fromPort: 'auto', toPort: 'auto', style: 'orthogonal', label, dashed: false, ...extra });
    const connections = [
      C(1, 2), C(2, 3), C(3, 4),
      C(4, 5, 'Sim', { fromPort: 'bottom' }), C(5, 6), C(6, 7), C(7, 8),
      C(4, 9, 'Não', { fromPort: 'right' }), C(9, 10),
      C(10, 8, '', { fromPort: 'bottom', toPort: 'right' }),
      C(11, 6, '', { dashed: true }),
    ];
    this.$('#docName').value = 'Exemplo · Fluxo de chamados DevOps';
    this.manager.load({ shapes, connections });   // carrega (zera histórico; não conta como alteração)
    this.viewport.fit(this.manager.bounds());     // enquadra o exemplo na tela
  }
};

// DOMContentLoaded = o HTML terminou de carregar (todos os elementos existem).
// Só então criamos o App. "window.app" deixa a instância acessível no console
// do navegador (F12) — útil para estudar: experimente digitar app.manager.shapes
window.addEventListener('DOMContentLoaded', () => { window.app = new PM.App(); });
