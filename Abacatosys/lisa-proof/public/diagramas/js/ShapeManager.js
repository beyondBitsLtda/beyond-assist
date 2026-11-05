/* =========================================================================
   ShapeManager.js — FORMAS, CONEXÕES E SUAS MANIPULAÇÕES (o "coração")
   -------------------------------------------------------------------------
   PAPEL NA ARQUITETURA
   É o dono do ESTADO do diagrama e o responsável por:
     • Guardar as listas de formas (this.shapes) e conexões (this.conns)
     • Guardar as imagens coladas (this.assets) — ver "IMAGENS" abaixo
     • Criar, selecionar, mover, redimensionar, copiar, excluir
     • Conectar formas arrastando as "portas" (com indicador visual da porta)
     • Alinhar, distribuir, centralizar e endireitar linhas
     • Desenhar tudo no SVG (render) e tratar o mouse
   Ele NÃO cuida de botões, arquivos, temas ou painel: esses módulos chamam
   os métodos públicos daqui e "escutam" os eventos que ele emite.

   COMO UMA FORMA É REPRESENTADA (objeto simples, igual ao JSON exportado)
     { id:'s1', type:'process', x:100, y:50, w:160, h:70, text:'Etapa', color:'purple' }
   COMO UMA CONEXÃO É REPRESENTADA
     { id:'c1', from:'s1', to:'s2', fromPort:'auto', toPort:'auto',
       style:'orthogonal', label:'Sim', dashed:false }

   IMAGENS (base64)
   Uma imagem colada vira um texto "data:image/png;base64,iVBOR..." (pode ter
   centenas de KB). Para o histórico (Ctrl+Z) não guardar essa string enorme
   a cada passo, ela fica UMA vez em this.assets (id → texto) e a forma guarda
   só a referência: { type:'image', asset:'img1', iw, ih }.
   Na EXPORTAÇÃO a referência é trocada pelo texto completo ("src"), então o
   JSON fica autossuficiente: a imagem vira uma linha de código no arquivo.

   CICLO DE UMA ALTERAÇÃO (fluxo de dados unidirecional)
     usuário age → altera this.shapes/this.conns → commit()
       → History guarda snapshot → render() redesenha → emit('change')
   Ou seja: a tela é sempre um REFLEXO dos dados. Nunca editamos o SVG
   "na mão"; mudamos os dados e mandamos redesenhar.

   ABAS (como as páginas do Visio)
   O documento tem uma ou mais abas (this.pages). As listas this.shapes e
   this.conns são SEMPRE as da aba aberta; as das outras ficam guardadas em
   this._store (com a câmera e o Ctrl+Z de cada uma). Trocar de aba = guardar
   a atual e trazer a outra. Uma forma pode ter "link" para uma aba: Ctrl+clique
   nela abre a aba.

   TRAVAR (locked)
   Forma travada não move, não redimensiona, não sai na seleção por área e não
   é excluída por engano. Feito para as raias (baias): trava a raia e mexe à
   vontade no que está dentro dela.

   CAMADAS DO SVG (definidas no index.html, de baixo para cima)
     #layerConnections → linhas      #layerShapes → formas
     #layerOverlay     → seleção, alças, guias, indicadores de porta
   ========================================================================= */
window.PM = window.PM || {}; // namespace global do sistema

PM.ShapeManager = class ShapeManager {
  // Recebe um objeto e já "desestrutura" as propriedades em variáveis:
  // new ShapeManager({ svg, wrap, viewport, history })
  constructor({ svg, wrap, viewport, history }) {
    this.svg = svg;             // elemento <svg> onde tudo é desenhado
    this.wrap = wrap;           // <div> em volta do svg (usado para classes CSS de cursor)
    this.vp = viewport;         // câmera (conversão tela ↔ mundo)
    this.history = history;     // desfazer/refazer
    // Referências às 3 camadas do desenho (L = "layers")
    this.L = {
      conns: svg.querySelector('#layerConnections'),
      shapes: svg.querySelector('#layerShapes'),
      overlay: svg.querySelector('#layerOverlay'),
    };
    this.shapes = [];           // lista de formas (a ordem define quem fica por cima)
    this.conns = [];            // lista de conexões
    this.assets = new Map();    // imagens: id → "data:image/...;base64,..." (Map = dicionário chave→valor)
    this.assetIndex = new Map();// caminho inverso: texto → id (evita guardar a mesma imagem duas vezes)
    this.assetSeq = 1;          // contador dos ids de imagem (img1, img2...)
    this.sel = new Set();       // ids de formas e conexões selecionadas
                                // (Set = coleção sem itens repetidos, com busca rápida via .has())
    this.tool = 'select';       // 'select' | 'hand' | tipo de forma
    this.grid = 10;             // tamanho do passo da grade de encaixe
    this.snap = true;           // encaixe (grade + guias) ligado?
    this.seq = 1;               // contador para gerar ids únicos (s1, s2, c3...)
    this.drag = null;           // informações do arraste em andamento (ou null)
    this.guides = [];           // guias de alinhamento visíveis durante o arraste
    this.clipboard = null;      // área de transferência interna (texto JSON)
    this.dirty = false;         // há alterações não exportadas?
    this.spaceDown = false;     // tecla Espaço pressionada (modo mover quadro)
    this.PORT_SNAP = 24;        // raio (px de tela) em que a linha "gruda" numa porta
    this.listeners = {};        // ouvintes de eventos: { nomeDoEvento: [funções] }
    this.mode = 'diagram';      // 'diagram' (fluxograma e afins) | 'mindmap' (mapa mental, MindMap.js)
    this._hidden = new Set();   // nós do mapa mental escondidos por um pai recolhido
    this.pages = [{ id: 'p1', name: 'Página 1' }]; // as abas, na ordem da barra de abas
    this.pageId = 'p1';         // a aba aberta
    this._store = {};           // as outras abas: { id: { shapes, conns, vp, hist } }
    this.inkColor = 'graphite'; // lápis: cor e espessura do próximo traço
    this.inkWidth = 3;
    this._defs();               // cria degradês e setas no <defs>
    this._bind();               // liga os eventos de mouse
    this.history.reset(this.snapshot()); // estado inicial do histórico
    this.render();              // primeiro desenho
  }

  /* ---------------- eventos internos ----------------
     Mini sistema de eventos (padrão "pub/sub"):
       manager.on('selection', fn) → inscreve fn
       manager.emit('selection')   → chama todas as fn inscritas
     Eventos usados: selection, change, render, tool, pointer,
                     pointerdown, edit-shape, edit-conn                  */
  on(evt, fn) {
    // Se ainda não existe lista para o evento, cria []; depois adiciona fn.
    (this.listeners[evt] = this.listeners[evt] || []).push(fn);
  }
  emit(evt, data) {
    // Chama cada ouvinte do evento (|| [] evita erro se ninguém se inscreveu).
    (this.listeners[evt] || []).forEach((fn) => fn(data));
  }

  /* ---------------- definições SVG ----------------
     Recursos reutilizáveis referenciados por id:
       gMain/gDeep/gSoft → degradês das cores "Principal" (cores vindas do TEMA via var(--...))
       arrow / arrowSel  → ponta de seta das linhas (normal e selecionada)
     Usamos style="stop-color:var(--x)" porque variáveis CSS funcionam em
     propriedades de estilo, mas não em atributos SVG comuns.              */
  _defs() {
    const grad = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style="stop-color:var(${a})"/><stop offset="1" style="stop-color:var(${b})"/></linearGradient>`;
    this.svg.querySelector('defs').insertAdjacentHTML('beforeend', `
      ${grad('gMain', '--sh-main-a', '--sh-main-b')}
      ${grad('gDeep', '--sh-deep-a', '--sh-deep-b')}
      ${grad('gSoft', '--sh-soft-a', '--sh-soft-b')}
      ${this._markers()}`);
  }

  // Uma ponta de linha por tipo do catálogo (PM.ShapeLibrary.markers), em duas
  // versões: normal e selecionada. "orient=auto-start-reverse" faz a MESMA ponta
  // servir no início da linha (virada ao contrário).
  _markers() {
    let out = '';
    for (const [nome, mk] of Object.entries(PM.ShapeLibrary.markers)) {
      [false, true].forEach((sel) => {
        const tam = nome === 'arrow' ? 13 : 18;
        const cls = `mk-line${sel ? ' sel' : ''} f-${mk.fill}`;
        out += `<marker id="mk-${nome}${sel ? '-s' : ''}" viewBox="-1 -1 22 22" refX="20" refY="10" markerWidth="${tam}" markerHeight="${tam}" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path class="${cls}" d="${mk.d}"/>${mk.circle ? `<circle class="mk-line${sel ? ' sel' : ''} f-bg" cx="4.5" cy="10" r="3.5"/>` : ''}</marker>`;
      });
    }
    return out;
  }

  /* ---------------- utilidades ---------------- */

  // Gera um id que ainda não existe (ex.: 's12'). O laço do...while executa
  // pelo menos uma vez e repete enquanto o id gerado já estiver em uso.
  newId(prefix) {
    let id;
    do { id = `${prefix}${this.seq++}`; } while (this.getShape(id) || this.getConn(id));
    return id;
  }
  // Busca uma forma / conexão pelo id (undefined se não achar).
  getShape(id) { return this.shapes.find((s) => s.id === id); }
  getConn(id) { return this.conns.find((c) => c.id === id); }
  // Filtram apenas os itens cujo id está no Set de seleção.
  selectedShapes() { return this.shapes.filter((s) => this.sel.has(s.id)); }
  selectedConns() { return this.conns.filter((c) => this.sel.has(c.id)); }
  // Arredonda um valor para o múltiplo da grade mais próximo (se o encaixe estiver ligado).
  snapV(v) { return this.snap ? Math.round(v / this.grid) * this.grid : Math.round(v); }
  // "Escapa" caracteres especiais antes de inserir texto no HTML.
  // Evita que um texto como "<b>" quebre o desenho (e protege contra injeção de código).
  // ?? (nullish) usa '' quando t é null/undefined. A regex /[&<>"]/g acha todos esses caracteres.
  esc(t) { return String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // Retângulo que envolve todas as formas da lista (bounding box).
  // Usado para alinhar, distribuir, enquadrar a tela etc.
  // Formas que aparecem na tela (no mapa mental, um pai recolhido esconde os filhos).
  visibleShapes() { return this._hidden.size ? this.shapes.filter((s) => !this._hidden.has(s.id)) : this.shapes; }

  bounds(list = this.visibleShapes()) {
    if (!list.length) return null;
    // Começa com valores "impossíveis" e vai ajustando com o mínimo/máximo de cada forma.
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    list.forEach((s) => { x1 = Math.min(x1, s.x); y1 = Math.min(y1, s.y); x2 = Math.max(x2, s.x + s.w); y2 = Math.max(y2, s.y + s.h); });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  // Qual forma está sob o ponto pt? Percorre de trás para frente porque a
  // última da lista é a que está desenhada por cima. "exclude" ignora uma forma.
  shapeAt(pt, exclude) {
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const s = this.shapes[i];
      if (s.id === exclude || this._hidden.has(s.id)) continue; // continue = pula para a próxima volta do laço
      if (pt.x >= s.x && pt.x <= s.x + s.w && pt.y >= s.y && pt.y <= s.y + s.h) return s;
    }
    return null;
  }

  // A forma sob o ponto que aceita linha (o desenho à mão não tem portas).
  _ligavelEm(pt, exclude) {
    const s = this.shapeAt(pt, exclude);
    return s && !PM.ShapeLibrary.get(s.type).noPorts ? s : null;
  }

  // Porta da forma mais próxima do ponto, desde que a distância seja <= maxDist.
  nearestPort(shape, pt, maxDist) {
    const ports = PM.ShapeLibrary.ports(shape.type, shape.w, shape.h);
    let best = null, bd = Infinity; // bd = melhor distância encontrada até agora
    // Object.entries transforma {top:[x,y],...} em [['top',[x,y]], ...]
    for (const [name, p] of Object.entries(ports)) {
      const d = Math.hypot(shape.x + p[0] - pt.x, shape.y + p[1] - pt.y);
      if (d < bd) { bd = d; best = name; }
    }
    return bd <= maxDist ? best : null;
  }

  /* ---------------- imagens (assets) ---------------- */

  // Registra o texto base64 de uma imagem e devolve um id curto (ex.: 'img3').
  // Se a mesma imagem já existe, reaproveita o id (não duplica memória).
  addAsset(src) {
    if (this.assetIndex.has(src)) return this.assetIndex.get(src);
    const id = `img${this.assetSeq++}`;
    this.assets.set(id, src);
    this.assetIndex.set(src, id);
    return id;
  }

  // Cria uma forma de imagem centralizada em (cx, cy).
  //   src    → "data:image/...;base64,..."
  //   iw, ih → tamanho real da imagem em pixels (para manter a proporção)
  addImage(src, iw, ih, cx, cy) {
    const asset = this.addAsset(src);
    // Tamanho inicial: cabe em 360 × 280 sem distorcer (k = fator de redução, nunca amplia)
    const k = Math.min(1, 360 / iw, 280 / ih);
    const w = Math.max(40, Math.round(iw * k)), h = Math.max(30, Math.round(ih * k));
    return this.addShape('image', cx, cy, { asset, iw, ih, w, h, text: '', color: 'graphite' });
  }

  /* ---------------- estado / histórico ---------------- */

  // Converte UMA forma em objeto "limpo" (só os campos que importam).
  //   inline=true → imagens levam o base64 completo ("src") — usado na exportação/cópia
  //   inline=false → imagens levam só a referência ("asset") — usado no histórico
  serializeShape(s, inline = false) {
    const o = { id: s.id, type: s.type, x: s.x, y: s.y, w: s.w, h: s.h, text: s.text, color: s.color };
    if (s.type === 'image') {
      o.iw = s.iw; o.ih = s.ih;
      if (inline) o.src = this.assets.get(s.asset) || ''; else o.asset = s.asset;
    }
    // campos que só alguns tipos usam: só entram no JSON quando existem
    if (s.lang) o.lang = s.lang;                 // bloco de código: a linguagem
    if (s.parent) o.parent = s.parent;           // mapa mental: o pai
    if (s.side) o.side = s.side;                 // mapa mental: lado do galho
    if (s.collapsed) o.collapsed = true;         // mapa mental: filhos escondidos
    if (s.ox) o.ox = s.ox;                       // mapa mental: posição manual (deslocamento
    if (s.oy) o.oy = s.oy;                       //   sobre a posição automática)
    if (s.locked) o.locked = true;               // travada no lugar
    if (s.link) o.link = s.link;                 // link para uma aba (Ctrl+clique)
    if (s.type === 'ink') { o.pts = (s.pts || []).slice(); o.sw = s.sw; } // desenho à mão
    if (s.fs) o.fs = s.fs;                       // caixa de texto: tamanho da letra
    if (s.fb) o.fb = true;                       //   e negrito
    return o;
  }

  // Estado completo. A desestruturação no map ({ id, from, ... }) descarta campos
  // internos como "_mid"/"_ends" (calculados a cada render).
  serialize(inline = false) {
    return {
      shapes: this.shapes.map((s) => this.serializeShape(s, inline)),
      connections: this.conns.map((c) => this.serializeConn(c)),
      mode: this.mode,
    };
  }
  // Uma conexão "limpa". As pontas e os rótulos das pontas só entram quando
  // fogem do padrão (seta no destino, nada na origem) - o JSON antigo continua igual.
  serializeConn({ id, from, to, fromPort, toPort, style, label, dashed, arrow, arrowStart, labelFrom, labelTo }) {
    const o = { id, from, to, fromPort, toPort, style, label, dashed: !!dashed }; // !!valor converte qualquer coisa em true/false
    if (arrow && arrow !== 'arrow') o.arrow = arrow;
    if (arrowStart && arrowStart !== 'none') o.arrowStart = arrowStart;
    if (labelFrom) o.labelFrom = labelFrom;
    if (labelTo) o.labelTo = labelTo;
    return o;
  }
  // O documento inteiro: todas as abas, cada uma com as suas formas, linhas e câmera.
  serializeDoc(inline = false) {
    const pages = this.pages.map((p) => {
      const st = p.id === this.pageId
        ? { shapes: this.shapes, conns: this.conns, vp: this.vp.toJSON() }
        : (this._store[p.id] || { shapes: [], conns: [] });
      return { id: p.id, name: p.name, viewport: st.vp || null,
               shapes: st.shapes.map((s) => this.serializeShape(s, inline)), connections: st.conns.map((c) => this.serializeConn(c)) };
    });
    return { mode: this.mode, activePage: this.pageId, pages };
  }
  // Quantas formas e linhas o documento tem, somando todas as abas.
  totals() {
    let f = this.shapes.length, c = this.conns.length;
    Object.keys(this._store).forEach((id) => { f += this._store[id].shapes.length; c += this._store[id].conns.length; });
    return { shapes: f, connections: c };
  }

  // Snapshot = estado como texto JSON (fácil de comparar e de guardar no histórico).
  snapshot() { return JSON.stringify(this.serialize(false)); }

  // Transforma "src" (base64) em referência "asset". Usado ao importar e ao colar.
  _absorbImage(s) {
    if (s.src) { s.asset = this.addAsset(s.src); delete s.src; } // delete remove a propriedade do objeto
    return s;
  }

  // Carrega um diagrama inteiro (exemplo inicial, importação, "Novo").
  // "{ resetHistory = true } = {}" → parâmetro opcional com valor padrão.
  load(data, { resetHistory = true } = {}) {
    if (resetHistory) { this.assets.clear(); this.assetIndex.clear(); } // documento novo: esquece imagens antigas
    const antes = this.mode;
    this.mode = data.mode === 'mindmap' ? 'mindmap' : 'diagram';
    // As abas: o arquivo novo traz "pages"; o antigo (sem abas) vira uma aba só.
    let pgs = Array.isArray(data.pages) && data.pages.length ? data.pages
      : [{ id: 'p1', name: 'Página 1', shapes: data.shapes, connections: data.connections }];
    if (this.mode === 'mindmap') pgs = pgs.slice(0, 1); // o mapa mental tem uma aba só
    this.pages = pgs.map((p, i) => ({ id: String(p.id || `p${i + 1}`), name: String(p.name || `Página ${i + 1}`) }));
    this._store = {};
    pgs.forEach((p, i) => {
      // { ...s } cria uma CÓPIA de cada objeto (spread), evitando alterar o original.
      this._store[this.pages[i].id] = { shapes: (p.shapes || []).map((s) => this._absorbImage({ ...s })),
                                         conns: (p.connections || []).map((c) => ({ ...c })), vp: p.viewport || null };
    });
    this.pageId = this.pages.some((p) => p.id === data.activePage) ? String(data.activePage) : this.pages[0].id;
    const ativa = this._store[this.pageId];
    delete this._store[this.pageId];
    this.shapes = ativa.shapes;
    this.conns = ativa.conns;
    // mapa mental: árvore consistente e sem ligações guardadas (elas saem do "parent")
    if (this.mode === 'mindmap') { this.shapes = PM.MindMap.normalize(this.shapes); this.conns = []; }
    this._prepare();
    if (antes !== this.mode) this.emit('mode', this.mode);
    this.sel.clear();
    this.seq = 1 + this.shapes.length + this.conns.length; // continua a numeração dos ids
    if (resetHistory) { this.history.reset(this.snapshot()); this.dirty = false; }
    this.render();
    this.emit('pages');
    this.emit('selection');
    this.emit('change');
  }

  /* ---------------- abas ---------------- */
  // Guarda a aba aberta (formas, linhas, câmera e o Ctrl+Z dela) e abre outra.
  goToPage(id) {
    if (id === this.pageId || !this.pages.some((p) => p.id === id)) return false;
    this._store[this.pageId] = { shapes: this.shapes, conns: this.conns, vp: this.vp.toJSON(), hist: this.history.stash() };
    this._abrirAba(id);
    return true;
  }
  _abrirAba(id) {
    const st = this._store[id] || { shapes: [], conns: [] };
    delete this._store[id];
    this.pageId = id;
    this.shapes = st.shapes; this.conns = st.conns;
    this.sel.clear();
    this.drag = null;
    this._prepare();
    this.seq = Math.max(this.seq, 1 + this.shapes.length + this.conns.length);
    if (st.hist) this.history.restore(st.hist); else this.history.reset(this.snapshot());
    if (st.vp) this.vp.load(st.vp); else this.vp.fit(this.bounds());
    this.render();
    this.emit('pages');
    this.emit('selection');
  }
  _novoIdAba() { let n = this.pages.length + 1, id; do { id = `p${n++}`; } while (this.pages.some((p) => p.id === id)); return id; }
  _abaAlterada() { this.dirty = true; this.emit('pages'); this.emit('change'); }
  // Uma aba nova, em branco, logo depois da aberta (e já aberta).
  addPage(name) {
    if (this.mode === 'mindmap') return null;
    const id = this._novoIdAba();
    const i = this.pages.findIndex((p) => p.id === this.pageId);
    this.pages.splice(i + 1, 0, { id, name: String(name || `Página ${this.pages.length + 1}`).slice(0, 60) });
    this._store[id] = { shapes: [], conns: [] };
    this.goToPage(id);
    this._abaAlterada();
    return id;
  }
  // Cópia de uma aba (formas, linhas, imagens), logo depois dela.
  duplicatePage(id) {
    const orig = this.pages.find((p) => p.id === id);
    if (!orig || this.mode === 'mindmap') return null;
    const st = id === this.pageId ? { shapes: this.shapes, conns: this.conns } : this._store[id];
    const novo = this._novoIdAba();
    this.pages.splice(this.pages.indexOf(orig) + 1, 0, { id: novo, name: `${orig.name} (cópia)`.slice(0, 60) });
    this._store[novo] = { shapes: st.shapes.map((s) => JSON.parse(JSON.stringify(this.serializeShape(s)))),
                          conns: st.conns.map((c) => this.serializeConn(c)) };
    this.goToPage(novo);
    this._abaAlterada();
    return novo;
  }
  renamePage(id, name) {
    const p = this.pages.find((x) => x.id === id);
    const n = String(name || '').trim().slice(0, 60);
    if (!p || !n || n === p.name) return false;
    p.name = n;
    this._abaAlterada();
    this.render(); // as dicas dos links mostram o nome da aba
    return true;
  }
  // Exclui uma aba (sempre sobra pelo menos uma). Os links para ela somem.
  removePage(id) {
    if (this.pages.length < 2) return false;
    const i = this.pages.findIndex((p) => p.id === id);
    if (i < 0) return false;
    if (id === this.pageId) this.goToPage((this.pages[i + 1] || this.pages[i - 1]).id); // abre a vizinha antes
    this.pages.splice(i, 1);
    delete this._store[id];
    const tira = (lista) => lista.forEach((s) => { if (s.link === id) delete s.link; });
    tira(this.shapes);
    Object.keys(this._store).forEach((k) => tira(this._store[k].shapes));
    this._abaAlterada();
    this.render();
    return true;
  }
  // Muda a aba de lugar na barra (índice novo).
  movePage(id, para) {
    const i = this.pages.findIndex((p) => p.id === id);
    if (i < 0) return false;
    const j = Math.max(0, Math.min(this.pages.length - 1, para));
    if (i === j) return false;
    const [p] = this.pages.splice(i, 1);
    this.pages.splice(j, 0, p);
    this._abaAlterada();
    return true;
  }
  // Ctrl+clique num elemento com link: abre a aba ligada.
  followLink(id) {
    const p = this.pages.find((x) => x.id === id);
    if (!p) { this.emit('notice', 'A aba deste link não existe mais.'); return false; }
    this.goToPage(id);
    this.emit('notice', `Aba "${p.name}"`);
    return true;
  }

  // "Confirma" uma alteração: registra no histórico, marca como não salvo e redesenha.
  // TODA ação que muda o diagrama termina chamando commit().
  commit() {
    this._prepare();
    this.history.push(this.snapshot());
    this.dirty = true;
    this.render();
    this.emit('change');
  }

  // Desfazer/refazer: pede o snapshot ao History e restaura.
  undo() { const s = this.history.undo(); if (s) this._restore(s); }
  redo() { const s = this.history.redo(); if (s) this._restore(s); }
  _restore(json) {
    const keep = new Set(this.sel);  // lembra a seleção atual
    const d = JSON.parse(json);      // texto JSON → objeto
    const antes = this.mode;
    this.mode = d.mode === 'mindmap' ? 'mindmap' : 'diagram';
    this.shapes = d.shapes; this.conns = d.connections;
    if (antes !== this.mode) this.emit('mode', this.mode);
    // mantém selecionado só o que ainda existe depois de desfazer
    this.sel = new Set([...keep].filter((id) => this.getShape(id) || this.getConn(id)));
    this.dirty = true;
    this.render(); this.emit('selection'); this.emit('change');
  }

  // Limpa o quadro (botão "Novo"). mode = 'mindmap' começa um mapa mental.
  clear(mode) { this.load(mode === 'mindmap' ? PM.MindMap.blank() : { shapes: [], connections: [] }); }

  // Antes de desenhar ou guardar: o mapa mental refaz o layout; o diagrama
  // ajusta a altura das formas que crescem com o conteúdo (tabela, classe, código).
  _prepare() {
    if (this.mode === 'mindmap') { PM.MindMap.layout(this); return; }
    this._hidden = new Set();
    for (const s of this.shapes) {
      // tabela, classe, código: a altura do conteúdo é o MÍNIMO - pode esticar para baixo
      if (PM.ShapeLibrary.get(s.type).autoHeight) s.h = Math.max(s.h || 0, PM.ShapeLibrary.autoHeight(s));
    }
  }

  /* ---------------- criação ---------------- */

  // Cria uma forma centralizada em (cx, cy).
  //   extra  → propriedades para sobrescrever (ex.: { color: 'red' })
  //   commit → false quando quem chamou ainda vai fazer mais alterações antes de confirmar
  addShape(type, cx, cy, extra = {}, commit = true) {
    const def = PM.ShapeLibrary.get(type); // definição do catálogo (tamanho/texto padrão)
    const s = {
      id: this.newId('s'), type, w: def.w, h: def.h, text: def.text,
      color: def.color || 'purple', // cor padrão do tipo (o catálogo diz), ou a principal do tema
      ...extra, // spread: copia/sobrescreve com as propriedades extras
    };
    if (type === 'code' && !s.lang) s.lang = 'javascript';
    if (def.autoHeight) s.h = PM.ShapeLibrary.autoHeight(s);
    // Converte o centro em canto superior esquerdo, já encaixado na grade.
    s.x = this.snapV(cx - s.w / 2);
    s.y = this.snapV(cy - s.h / 2);
    // agrupador (raia, limite do sistema) nasce ATRÁS de tudo; o resto, na frente
    if (def.container) this.shapes.unshift(s); else this.shapes.push(s);
    this.sel = new Set([s.id]); // a forma nova fica selecionada
    this.emit('selection');
    if (commit) this.commit();
    return s;
  }

  // Cria uma conexão entre duas formas (ids).
  addConnection(from, to, fromPort = 'auto', toPort = 'auto') {
    if (from === to) return null; // não conecta uma forma nela mesma
    const c = { id: this.newId('c'), from, to, fromPort, toPort, style: 'orthogonal', label: '', dashed: false };
    // rótulos padrão para saídas de decisão
    // 1ª saída de um losango recebe "Sim", a 2ª "Não", as demais ficam sem rótulo.
    const src = this.getShape(from);
    if (src && src.type === 'decision') {
      const n = this.conns.filter((k) => k.from === from).length;
      c.label = n === 0 ? 'Sim' : n === 1 ? 'Não' : '';
    }
    this.conns.push(c);
    this.commit();
    return c;
  }

  /* ---------------- seleção ---------------- */
  // Substitui a seleção pela lista de ids informada.
  setSelection(ids) { this.sel = new Set(ids); this.render(); this.emit('selection'); }
  // Shift/Ctrl+clique: se já está selecionado, remove; senão, adiciona.
  toggleSelection(id) { this.sel.has(id) ? this.sel.delete(id) : this.sel.add(id); this.render(); this.emit('selection'); }
  // Desmarca tudo (se já está vazio, não faz nada para evitar redesenho à toa).
  clearSelection() { if (!this.sel.size) return; this.sel.clear(); this.render(); this.emit('selection'); }
  // Ctrl+A: junta (spread) os ids de todas as formas e conexões.
  selectAll() { this.setSelection([...this.visibleShapes().map((s) => s.id), ...this.conns.map((c) => c.id)]); }

  /* ---------------- edição ---------------- */
  // Aplica um "patch" (objeto com campos a mudar) em várias formas.
  // Object.assign(destino, origem) copia os campos da origem para o destino.
  updateShapes(ids, patch) {
    ids.forEach((id) => { const s = this.getShape(id); if (s) Object.assign(s, patch); });
    this.commit();
  }
  // Mesmo raciocínio para conexões (ex.: { style: 'curve' }).
  updateConns(ids, patch) {
    ids.forEach((id) => { const c = this.getConn(id); if (c) Object.assign(c, patch); });
    this.commit();
  }

  // Exclui o que estiver selecionado. Ao apagar uma forma, apaga também
  // as conexões ligadas a ela (senão sobrariam linhas "soltas").
  deleteSelection() {
    if (!this.sel.size) return;
    // mapa mental: sai o tópico com toda a descendência (o tema central fica)
    if (this.mode === 'mindmap') { PM.MindMap.remove(this, [...this.sel]); return; }
    const travadas = this.selectedShapes().filter((s) => s.locked);
    if (travadas.length) {
      travadas.forEach((s) => this.sel.delete(s.id));
      this.emit('notice', travadas.length === 1 ? 'Forma travada: destrave para excluir.' : `${travadas.length} formas travadas ficaram (destrave para excluir).`);
      if (!this.sel.size) { this.render(); this.emit('selection'); return; }
    }
    const removed = new Set(this.selectedShapes().map((s) => s.id));
    this.shapes = this.shapes.filter((s) => !removed.has(s.id));
    this.conns = this.conns.filter((c) => !this.sel.has(c.id) && !removed.has(c.from) && !removed.has(c.to));
    this.sel.clear();
    this.commit();
    this.emit('selection');
  }

  // Copiar: guarda as formas selecionadas e as conexões ENTRE elas, como texto JSON.
  // As imagens vão com o base64 completo (inline), para poderem ser coladas
  // até em outra aba do ProcessMap (o ImagePaste também coloca esse texto
  // na área de transferência do sistema).
  copy() {
    const shapes = this.selectedShapes();
    if (!shapes.length) return false;
    const ids = new Set(shapes.map((s) => s.id));
    this.clipboard = JSON.stringify({
      shapes: shapes.map((s) => this.serializeShape(s, true)),
      conns: this.conns.filter((c) => ids.has(c.from) && ids.has(c.to)),
    });
    this.pasteCount = 0; // reinicia o deslocamento das colagens
    return true;
  }

  // Colar: cria cópias com ids novos, deslocadas 20px a cada colagem.
  // "json" permite colar um conteúdo vindo de fora (área de transferência do sistema).
  paste(json = this.clipboard) {
    if (!json) return false;
    let data;
    try { data = JSON.parse(json); } catch (_) { return false; } // texto inválido: ignora
    if (!data || !Array.isArray(data.shapes)) return false;
    if (json !== this.clipboard) { this.clipboard = json; this.pasteCount = 0; } // conteúdo novo
    if (this.mode === 'mindmap') return this._pasteMind(data);
    this.pasteCount = (this.pasteCount || 0) + 1;
    const off = 20 * this.pasteCount;
    const map = {};      // "de-para" id antigo → id novo (para religar as conexões)
    const newIds = [];
    data.shapes.forEach((s) => {
      if (!PM.ShapeLibrary.has(s.type) || PM.ShapeLibrary.get(s.type).mind) return; // tipo desconhecido (ou do mapa mental): ignora
      const n = this._absorbImage({ ...s, id: this.newId('s'), x: (+s.x || 0) + off, y: (+s.y || 0) + off });
      map[s.id] = n.id; newIds.push(n.id); this.shapes.push(n);
    });
    (data.conns || []).forEach((c) => {
      if (!map[c.from] || !map[c.to]) return; // ponta sem forma: ignora
      const n = { ...c, id: this.newId('c'), from: map[c.from], to: map[c.to] };
      newIds.push(n.id); this.conns.push(n);
    });
    this.sel = new Set(newIds); // seleciona o que foi colado
    this.commit();
    this.emit('selection');
    return newIds.length > 0;
  }

  // Colar no mapa mental: os tópicos copiados entram como filhos do selecionado
  // (ou do tema central), com a mesma estrutura entre eles.
  _pasteMind(data) {
    const alvo = this.selectedShapes()[0] || PM.MindMap.root(this);
    if (!alvo) return false;
    const map = {}, novos = [];
    data.shapes.forEach((s) => { if (PM.ShapeLibrary.get(s.type).mind) map[s.id] = this.newId('s'); });
    data.shapes.forEach((s) => {
      if (!map[s.id]) return;
      const n = { id: map[s.id], type: 'mmNode', text: String(s.text ?? ''), x: alvo.x, y: alvo.y, w: s.w || 120, h: s.h || 36,
                  parent: map[s.parent] || alvo.id };
      if (n.parent === alvo.id && alvo.type === 'mmRoot') n.side = s.side === 'left' ? 'left' : 'right';
      if (s.collapsed) n.collapsed = true;
      novos.push(n.id); this.shapes.push(n);
    });
    if (!novos.length) return false;
    alvo.collapsed = false;
    this.sel = new Set(novos);
    this.commit();
    this.emit('selection');
    return true;
  }

  // Ctrl+D = copiar + colar em um passo.
  duplicate() { if (this.copy()) this.paste(); }

  // Ordem de empilhamento: o fim da lista é desenhado por último (fica por cima).
  // concat junta arrays: [demais] + [selecionadas] → selecionadas vão para frente.
  bringToFront() { const s = this.selectedShapes(); this.shapes = this.shapes.filter((x) => !this.sel.has(x.id)).concat(s); this.commit(); }
  sendToBack() { const s = this.selectedShapes(); this.shapes = s.concat(this.shapes.filter((x) => !this.sel.has(x.id))); this.commit(); }

  // Move a seleção alguns pixels (setas do teclado).
  nudge(dx, dy) {
    const s = this.selectedShapes().filter((k) => !k.locked); // travada não sai do lugar
    if (!s.length) return;
    s.forEach((k) => { k.x += dx; k.y += dy; });
    this.commit();
  }

  // Trava/destrava as formas selecionadas (todas ficam iguais à primeira, invertida).
  toggleLock() {
    const list = this.selectedShapes();
    if (!list.length) return null;
    const travar = !list[0].locked;
    list.forEach((s) => { if (travar) s.locked = true; else delete s.locked; });
    this.commit();
    this.emit('selection');
    return travar;
  }

  /* ---------------- alinhamento / centralização ---------------- */

  // Alinha as formas selecionadas tomando como referência o retângulo que envolve todas.
  // mode: left | center | right (eixo X) e top | middle | bottom (eixo Y).
  align(mode) {
    const list = this.selectedShapes().filter((k) => !k.locked);
    if (list.length < 2) return false; // alinhar exige pelo menos 2 formas
    const b = this.bounds(list);
    list.forEach((s) => {
      if (mode === 'left') s.x = b.x;
      if (mode === 'center') s.x = Math.round(b.x + b.w / 2 - s.w / 2); // centros na mesma vertical
      if (mode === 'right') s.x = b.x + b.w - s.w;
      if (mode === 'top') s.y = b.y;
      if (mode === 'middle') s.y = Math.round(b.y + b.h / 2 - s.h / 2); // centros na mesma horizontal
      if (mode === 'bottom') s.y = b.y + b.h - s.h;
    });
    this.commit();
    return true;
  }

  // Distribui as formas com o MESMO espaço entre elas (axis 'h' ou 'v').
  distribute(axis) {
    const list = this.selectedShapes().filter((k) => !k.locked);
    if (list.length < 3) return false; // com 2 formas não há o que distribuir
    const b = this.bounds(list);
    if (axis === 'h') {
      list.sort((a, c) => a.x - c.x); // ordena da esquerda para a direita
      // espaço livre = largura total - soma das larguras; dividido pelos vãos
      // reduce acumula um valor percorrendo o array (aqui: soma das larguras)
      const gap = (b.w - list.reduce((t, s) => t + s.w, 0)) / (list.length - 1);
      let x = b.x; list.forEach((s) => { s.x = Math.round(x); x += s.w + gap; });
    } else {
      list.sort((a, c) => a.y - c.y); // de cima para baixo
      const gap = (b.h - list.reduce((t, s) => t + s.h, 0)) / (list.length - 1);
      let y = b.y; list.forEach((s) => { s.y = Math.round(y); y += s.h + gap; });
    }
    this.commit();
    return true;
  }

  /**
   * Endireita as linhas: move a forma de destino para que a
   * porta de chegada fique no mesmo eixo da porta de saída.
   * Atua na seleção; se nada estiver selecionado, no diagrama todo.
   * Retorna quantas conexões foram ajustadas.
   */
  straighten() {
    let list; // conexões que serão analisadas
    if (this.sel.size) {
      const sids = new Set(this.selectedShapes().map((s) => s.id));
      // conexões selecionadas OU que ligam duas formas selecionadas
      list = this.conns.filter((c) => this.sel.has(c.id) || (sids.has(c.from) && sids.has(c.to)));
      // só 1 forma selecionada: ajusta as linhas que CHEGAM nela
      if (!list.length && sids.size === 1) { const id = [...sids][0]; list = this.conns.filter((c) => c.to === id); }
    } else list = [...this.conns]; // nada selecionado: todas
    if (!list.length) return 0;

    const R = PM.ConnectionRouter;
    const OPP = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }; // lado oposto
    const MAX = 80; // só ajusta desalinhamentos pequenos (não "teleporta" formas)
    const moved = new Set(); // cada forma é movida no máximo uma vez
    // Verifica se a forma s ficou por cima de alguma outra (some = "existe algum?")
    const overlaps = (s) => this.shapes.some((o) => o !== s && s.x < o.x + o.w && s.x + s.w > o.x && s.y < o.y + o.h && s.y + s.h > o.y);
    // ordem do fluxo: de cima para baixo, da esquerda para a direita
    // (assim o ajuste "propaga" do início do fluxo para o fim)
    list.sort((a, b) => { const A = this.getShape(a.from), B = this.getShape(b.from); return (A.y - B.y) || (A.x - B.x); });
    let n = 0;
    list.forEach((c) => {
      const a = this.getShape(c.from), b = this.getShape(c.to);
      if (!a || !b || moved.has(b.id)) return; // return dentro do forEach = pula este item
      const [pa, pb] = R.resolvePorts(c, a, b);
      if (OPP[pa] !== pb) return; // apenas saídas e chegadas opostas formam linha reta
      const A = R.portPoint(a, pa), B = R.portPoint(b, pb);
      const vertical = pa === 'top' || pa === 'bottom';
      const delta = vertical ? A.x - B.x : A.y - B.y; // quanto falta para alinhar
      if (!delta || Math.abs(delta) > MAX) return;     // já alinhado ou longe demais
      const ox = b.x, oy = b.y;                         // guarda a posição original
      if (vertical) b.x += delta; else b.y += delta;    // move o destino
      if (overlaps(b)) { b.x = ox; b.y = oy; return; }  // se colidiu, desfaz
      moved.add(b.id); n++;
    });
    this.commit();
    return n;
  }

  /* ---------------- renderização ----------------
     Gera o SVG a partir dos dados. Monta uma string grande com todo o
     conteúdo e atribui de uma vez via innerHTML (simples e rápido para
     o tamanho de um fluxograma). As cores usam style="...var(--x)..."
     para acompanhar o tema ativo.                                       */
  render() {
    // ===== mapa mental: layout e desenho próprios (MindMap.js) =====
    if (this.mode === 'mindmap') {
      PM.MindMap.layout(this);
      const r = PM.MindMap.render(this);
      this.L.conns.innerHTML = r.links;
      this.L.shapes.innerHTML = r.nodes;
      this.renderOverlay();
      this.emit('render');
      return;
    }
    this._prepare();
    // ===== conexões =====
    const R = PM.ConnectionRouter;
    let ch = '';
    for (const c of this.conns) {
      const a = this.getShape(c.from), b = this.getShape(c.to);
      if (!a || !b) continue; // conexão órfã: ignora
      const r = R.route(c, a, b); // calcula o traçado
      c._mid = r.mid;             // guarda o meio (usado pelo editor do rótulo)
      // guarda as pontas e as portas usadas (indicador ao selecionar a linha)
      c._ends = { a: r.points[0], b: r.points[r.points.length - 1], ports: r.ports };
      const sel = this.sel.has(c.id);
      // As pontas: a do destino é seta por padrão; a da origem, nenhuma.
      const fim = c.arrow || 'arrow', ini = c.arrowStart || 'none';
      const mk = (n) => `url(#mk-${PM.ShapeLibrary.markers[n] ? n : 'arrow'}${sel ? '-s' : ''})`;
      // Cada linha tem 2 paths: "hit" (grosso e invisível, facilita o clique) e "line" (o visível).
      // data-cid guarda o id da conexão no HTML para identificarmos o clique depois.
      ch += `<g class="conn${sel ? ' selected' : ''}" data-cid="${this.esc(c.id)}">
        <path class="hit" d="${r.d}"/>
        <path class="line" d="${r.d}"${fim !== 'none' ? ` marker-end="${mk(fim)}"` : ''}${ini !== 'none' ? ` marker-start="${mk(ini)}"` : ''} ${c.dashed ? 'stroke-dasharray="7 5"' : ''}/>
        ${c.label ? `<text class="clabel" x="${r.mid.x}" y="${r.mid.y}">${this.esc(c.label)}</text>` : ''}
        ${c.labelFrom ? this._endLabel(r.points[0], r.points[1], c.labelFrom) : ''}
        ${c.labelTo ? this._endLabel(r.points[r.points.length - 1], r.points[r.points.length - 2], c.labelTo) : ''}
      </g>`;
    }
    this.L.conns.innerHTML = ch;

    // ===== formas =====
    let sh = '';
    for (const s of this.shapes) {
      const def = PM.ShapeLibrary.get(s.type);  // definição do tipo
      const ports = PM.ShapeLibrary.ports(s.type, s.w, s.h);
      // As bolinhas de conexão (portas) — aparecem no hover via CSS
      const portsSvg = Object.entries(ports).map(([n, p]) => `<circle class="port" data-port="${n}" cx="${p[0]}" cy="${p[1]}" r="5"/>`).join('');
      // <g transform="translate(x,y)"> posiciona o grupo; dentro dele tudo usa coordenadas locais.
      if (def.ink) { sh += this._extras(s, this._renderInk(s)); continue; }
      if (def.image) { sh += this._extras(s, this._renderImage(s, def, portsSvg)); continue; }
      const pal = PM.paletteById(s.color);      // cores
      if (def.container) { sh += this._extras(s, this._renderContainer(s, def, pal, portsSvg)); continue; }
      if (def.render) { sh += this._extras(s, this._renderRich(s, def, pal, portsSvg)); continue; }

      const d = def.path(s.w, s.h);             // contorno
      const stroke = def.inkStroke ? 'var(--ink)' : pal.stroke;
      const dash = def.dashed ? ' stroke-dasharray="7 5"' : '';
      // Área do texto: a do catálogo (textBox) ou a forma inteira com a margem do losango
      const tp = def.textPad ? def.textPad : 0;
      const box = def.textBox ? def.textBox(s.w, s.h) : { x: s.w * tp, y: s.h * tp, w: s.w - s.w * tp * 2, h: s.h - s.h * tp * 2 };
      // vazada: o texto na cor do tema; a caixa de texto usa a cor escolhida (grafite = a do tema)
      const textColor = def.transparent ? (def.noBorder && s.color !== 'graphite' ? pal.solid : 'var(--ink)') : pal.text;
      sh += this._extras(s, `<g class="shape" data-id="${this.esc(s.id)}" transform="translate(${s.x},${s.y})">
        ${def.transparent
          // Vazada (anotação, ator, caixa de texto): área clicável invisível + o traço (a caixa de texto não tem)
          ? `<path d="${def.hit ? def.hit(s.w, s.h) : d}" fill="rgba(0,0,0,0.001)"/>${def.noBorder ? '' : `<path class="body" d="${d}" fill="none" style="stroke:${stroke}" stroke-width="2"${dash}/>`}`
          // Demais: sombra deslocada 6px (identidade da logo) + corpo colorido
          : `<path class="shadow" d="${d}" transform="translate(6,6)"/>
             <path class="body" d="${d}" style="fill:${pal.fill};stroke:${stroke}" stroke-width="${def.dashed ? 1.6 : 1.2}" stroke-opacity="${def.dashed ? 1 : 0.7}"${dash}/>`}
        ${def.deco ? `<path d="${def.deco(s.w, s.h)}" style="fill:${def.decoFill ? stroke : 'none'};stroke:${stroke}" stroke-width="1.5"/>` : ''}
        ${def.noText ? '' : `<foreignObject x="${box.x}" y="${box.y}" width="${Math.max(1, box.w)}" height="${Math.max(1, box.h)}">
          <div class="label" style="color:${textColor};white-space:pre-wrap;${tp ? 'padding:2px;font-size:12px;' : ''}${def.align === 'left' ? `justify-content:flex-start;text-align:left;padding-left:${def.padL ?? 22}px;` : ''}${def.top ? 'align-items:flex-start;' : ''}${s.fs ? `font-size:${+s.fs}px;` : ''}${s.fb ? 'font-weight:700;' : ''}">${this.esc(s.text)}</div>
        </foreignObject>`}
        ${portsSvg}
      </g>`);
      // foreignObject permite colocar HTML (<div>) dentro do SVG → quebra de linha automática do texto.
    }
    this.L.shapes.innerHTML = sh;
    this.renderOverlay();  // seleção/alças/guias por cima
    this.emit('render');   // avisa (ex.: barra de status atualiza contadores)
  }

  // Rótulo de uma PONTA da linha (multiplicidade "1", "0..*"...): perto da
  // ponta P, recuado na direção da linha e afastado para o lado.
  _endLabel(P, Q, texto) {
    if (!P || !Q) return '';
    const len = Math.hypot(P.x - Q.x, P.y - Q.y) || 1;
    const dx = (P.x - Q.x) / len, dy = (P.y - Q.y) / len; // direção que chega na ponta
    const x = P.x - dx * 26 - dy * 12, y = P.y - dy * 26 + dx * 12; // recua 26 e desloca 12 para o lado
    return `<text class="clabel cl-end" x="${x}" y="${y}">${this.esc(texto)}</text>`;
  }

  // Agrupador (raia, limite do sistema, fronteira): só o contorno e a faixa do
  // título pegam o clique; o interior vazio deixa passar (seleção por área funciona dentro).
  _renderContainer(s, def, pal, portsSvg) {
    const d = def.path(s.w, s.h);
    const box = def.textBox ? def.textBox(s.w, s.h) : { x: 0, y: 0, w: s.w, h: 30 };
    const cabeca = def.header ? def.header(s.w, s.h) : '';
    const cor = cabeca ? pal.text : 'var(--ink)';
    // raia horizontal: o título corre de baixo para cima, na faixa da esquerda
    const lado = def.rotText ? 'writing-mode:vertical-rl;transform:rotate(180deg);justify-content:center;text-align:center;padding:10px 4px;' : '';
    return `<g class="shape container" data-id="${this.esc(s.id)}" transform="translate(${s.x},${s.y})">
      <path d="${d}" style="fill:${pal.solid}" fill-opacity=".08" pointer-events="none"/>
      <path class="ct-hit" d="${d}"/>
      <path class="body ct-body" d="${d}" fill="none" style="stroke:${pal.stroke}" stroke-width="1.6"${def.dashed ? ' stroke-dasharray="8 5"' : ''}/>
      ${cabeca ? `<path class="ct-head" d="${cabeca}" style="fill:${pal.fill};stroke:${pal.stroke}" stroke-width="1"/>` : ''}
      <foreignObject x="${box.x}" y="${box.y}" width="${Math.max(1, box.w)}" height="${Math.max(1, box.h)}">
        <div class="label ct-label" style="color:${cor};${def.align === 'left' ? 'justify-content:flex-start;text-align:left;' : ''}${lado}">${this.esc(s.text)}</div>
      </foreignObject>
      ${portsSvg}
    </g>`;
  }

  // Formas com conteúdo estruturado: tabela (banco), classe (UML) e código.
  // O desenho é HTML dentro do foreignObject; o contorno de baixo é a área clicável.
  _renderRich(s, def, pal, portsSvg) {
    const d = def.path(s.w, s.h);
    const esc = (t) => this.esc(t);
    const linhas = String(s.text ?? '').split('\n');
    let corpo, html;
    if (def.render === 'code') {
      corpo = `<path class="shadow" d="${d}" transform="translate(6,6)"/><path class="body code-bg" d="${d}"/>`;
      const H = PM.SyntaxHighlighter;
      html = `<div class="code-card"><div class="code-head"><i></i><i></i><i></i><span>${esc(H.label(s.lang))}</span></div>
        <pre class="code-pre">${H.highlight(s.text, s.lang)}</pre></div>`;
    } else if (def.render === 'table') {
      corpo = `<path class="shadow" d="${d}" transform="translate(6,6)"/>
        <path class="body" d="${d}" style="fill:var(--pm-900);stroke:${pal.stroke}" stroke-width="1.4"${def.dashed ? ' stroke-dasharray="7 5"' : ''}/>`;
      const linha = (l) => {
        // selos no início (PK, FK, UQ, IX, NN) e "nome: tipo"
        const m = /^\s*((?:(?:PK|FK|UQ|IX|NN)[\s,]+)*)(.*)$/i.exec(l);
        const selos = (m[1].match(/PK|FK|UQ|IX|NN/gi) || []).map((x) => `<b class="tb-key tb-${x.toLowerCase()}">${x.toUpperCase()}</b>`).join('');
        const k = m[2].indexOf(':');
        const nome = k >= 0 ? m[2].slice(0, k) : m[2], tipo = k >= 0 ? m[2].slice(k + 1) : '';
        return `<div class="tb-row"><span class="tb-keys">${selos}</span><span class="tb-name">${esc(nome.trim())}</span><span class="tb-type">${esc(tipo.trim())}</span></div>`;
      };
      html = `<div class="tb-card"><div class="tb-head" style="background:${pal.solid};color:${pal.text}">${esc(linhas[0] || '')}</div>
        ${linhas.slice(1).map(linha).join('')}</div>`;
    } else {
      // classe UML: seções separadas por "--"; a 1ª é o nome (com «estereótipo» opcional)
      corpo = `<path class="shadow" d="${d}" transform="translate(6,6)"/>
        <path class="body" d="${d}" style="fill:${pal.fill};stroke:${pal.stroke}" stroke-width="1.4"/>`;
      const secoes = PM.ShapeLibrary.sections(s.text);
      html = `<div class="cl-card" style="color:${pal.text}">${secoes.map((sec, i) => (i === 0
        ? `<div class="cl-sec cl-name">${sec.map((l) => (/^\s*«.*»\s*$/.test(l) ? `<i>${esc(l.trim())}</i>` : `<b>${esc(l)}</b>`)).join('')}</div>`
        : `<div class="cl-sec" style="border-color:${pal.stroke}">${sec.map((l) => `<div>${esc(l) || '&nbsp;'}</div>`).join('')}</div>`)).join('')}</div>`;
    }
    return `<g class="shape rich" data-id="${this.esc(s.id)}" transform="translate(${s.x},${s.y})">
      ${corpo}
      <foreignObject x="0" y="0" width="${s.w}" height="${s.h}">${html}</foreignObject>
      ${portsSvg}
    </g>`;
  }

  // O que vai por cima de qualquer forma: o cadeado (travada) e a seta (link
  // para uma aba), e a dica do link. Classes "locked"/"linked" para o CSS.
  _extras(s, html) {
    if (this.mode === 'mindmap' || (!s.locked && !s.link)) return html;
    const pg = s.link ? this.pages.find((p) => p.id === s.link) : null;
    let dentro = '';
    if (s.locked) dentro += `<g class="badge b-lock" transform="translate(${Math.max(0, s.w - 18)},4)"><rect width="14" height="14" rx="3"/><path d="M4.5 6.5V5a2.5 2.5 0 0 1 5 0v1.5M3.5 6.5h7v5h-7z"/></g>`;
    if (s.link) dentro += `<g class="badge b-link" transform="translate(${Math.max(0, s.w - 18)},${Math.max(0, s.h - 18)})"><rect width="14" height="14" rx="3"/><path d="M4.5 9.5l5-5M6 4.5h3.5V8"/></g>`;
    const dica = s.link ? `<title>${this.esc(pg ? `Ctrl+clique: abre a aba "${pg.name}"` : 'Link para uma aba que não existe mais')}</title>` : '';
    return html.replace('class="shape', `class="shape${s.locked ? ' locked' : ''}${s.link ? ' linked' : ''}`)
      .replace('>', `>${dica}`).replace(/<\/g>\s*$/, `${dentro}</g>`);
  }

  // Desenho à mão: o traço passa pelo meio dos pontos (curvas suaves); por
  // baixo, um traço largo e invisível facilita o clique.
  _inkPath(pts, w, h) {
    const n = Math.floor(pts.length / 2);
    if (!n) return '';
    const X = (i) => +(pts[2 * i] / 1000 * w).toFixed(1), Y = (i) => +(pts[2 * i + 1] / 1000 * h).toFixed(1);
    if (n === 1) return `M${X(0)},${Y(0)} l0.01,0`;
    let d = `M${X(0)},${Y(0)}`;
    for (let i = 1; i < n - 1; i++) d += ` Q${X(i)},${Y(i)} ${+((X(i) + X(i + 1)) / 2).toFixed(1)},${+((Y(i) + Y(i + 1)) / 2).toFixed(1)}`;
    return `${d} L${X(n - 1)},${Y(n - 1)}`;
  }
  _renderInk(s) {
    const cor = s.color === 'graphite' ? 'var(--ink)' : PM.paletteById(s.color).solid; // grafite = a cor do texto do tema
    const sw = Math.max(1, Math.min(24, +s.sw || 3));
    const d = this._inkPath(s.pts || [], s.w, s.h);
    return `<g class="shape ink" data-id="${this.esc(s.id)}" transform="translate(${s.x},${s.y})">
      <path class="ink-hit" d="${d}" stroke-width="${sw + 12}"/>
      <path class="ink-line" d="${d}" style="stroke:${cor}" stroke-width="${sw}"/>
    </g>`;
  }
  // Fim do traço: simplifica, calcula a caixa e grava os pontos de 0 a 1000 dentro dela.
  _finishInk(flat) {
    let p = [];
    for (let i = 0; i + 1 < flat.length; i += 2) p.push([flat[i], flat[i + 1]]);
    if (!p.length) return null;
    if (p.length === 1) p.push([p[0][0] + 0.5, p[0][1] + 0.5]); // um toque vira um ponto
    p = this._simplify(p, 0.9 / this.vp.scale);
    if (p.length > 2500) { const k = Math.ceil(p.length / 2500); p = p.filter((_, i) => i % k === 0 || i === p.length - 1); }
    const sw = this.inkWidth, pad = Math.max(2, sw / 2 + 1);
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    p.forEach(([a, b]) => { x1 = Math.min(x1, a); y1 = Math.min(y1, b); x2 = Math.max(x2, a); y2 = Math.max(y2, b); });
    const x = Math.floor(x1 - pad), y = Math.floor(y1 - pad);
    const w = Math.max(4, Math.ceil(x2 + pad - x)), h = Math.max(4, Math.ceil(y2 + pad - y));
    const pts = [];
    p.forEach(([a, b]) => pts.push(Math.round((a - x) / w * 1000), Math.round((b - y) / h * 1000)));
    const s = { id: this.newId('s'), type: 'ink', x, y, w, h, text: '', color: this.inkColor, pts, sw };
    this.shapes.push(s);
    this.commit();
    return s;
  }
  // Douglas-Peucker: tira os pontos que quase não mudam o desenho.
  _simplify(p, eps) {
    if (p.length < 3) return p;
    const keep = new Array(p.length).fill(false);
    keep[0] = keep[p.length - 1] = true;
    const pilha = [[0, p.length - 1]];
    while (pilha.length) {
      const [a, b] = pilha.pop();
      const [ax, ay] = p[a], [bx, by] = p[b];
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
      let idx = -1, md = eps;
      for (let i = a + 1; i < b; i++) {
        const dd = L < 1e-6 ? Math.hypot(p[i][0] - ax, p[i][1] - ay) : Math.abs(dy * p[i][0] - dx * p[i][1] + bx * ay - by * ax) / L;
        if (dd > md) { md = dd; idx = i; }
      }
      if (idx >= 0) { keep[idx] = true; pilha.push([a, idx], [idx, b]); }
    }
    return p.filter((_, i) => keep[i]);
  }

  // Desenha uma forma de imagem: <image> com o base64 + moldura fina + portas.
  // (Sem a sombra sólida: em PNGs com fundo transparente ela apareceria atrás da imagem.)
  // preserveAspectRatio="none" faz a imagem ocupar exatamente a forma
  // (use Shift ao redimensionar para não distorcer).
  _renderImage(s, def, portsSvg) {
    const src = this.assets.get(s.asset);
    const body = src
      ? `<image class="body" href="${this.esc(src)}" width="${s.w}" height="${s.h}" preserveAspectRatio="none"/>`
      : `<rect class="body" width="${s.w}" height="${s.h}" style="fill:var(--pm-850)"/>
         <text x="${s.w / 2}" y="${s.h / 2}" text-anchor="middle" style="fill:var(--ink-3);font-size:12px">Imagem indisponível</text>`;
    return `<g class="shape" data-id="${this.esc(s.id)}" transform="translate(${s.x},${s.y})">
      ${body}
      <rect class="img-frame" width="${s.w}" height="${s.h}"/>
      ${portsSvg}
    </g>`;
  }

  // Cria uma "etiqueta" (retângulo arredondado + texto) no overlay.
  // z compensa o zoom: a etiqueta tem sempre o mesmo tamanho na tela.
  _tag(x, y, text, z, muted = false) {
    const fs = 11 * z;                                   // tamanho da fonte
    const w = (text.length * 6.6 + 16) * z, h = 19 * z;  // largura estimada pelo nº de letras
    return `<g class="ov">
      <rect class="tag-bg${muted ? ' muted' : ''}" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${h / 2}"/>
      <text class="tag-tx" x="${x}" y="${y + 0.5 * z}" style="font-size:${fs}px">${this.esc(text)}</text>
    </g>`;
  }

  // Posição da etiqueta de uma porta: deslocada para o LADO da linha (nunca em cima dela).
  //   portas laterais (left/right) → acima (entrada) ou abaixo (saída) da porta
  //   portas superior/inferior    → à direita da porta
  _tagPos(p, port, z, role) {
    if (port === 'left' || port === 'right') return [p.x, p.y + (role === 'in' ? -24 : 24) * z];
    return [p.x + 62 * z, p.y];
  }

  // Desenha a camada de sobreposição: caixas de seleção, alças de redimensionar,
  // guias, retângulo de seleção por área e os INDICADORES DE CONEXÃO.
  renderOverlay() {
    let o = '';
    // z compensa o zoom: alças e traços mantêm o mesmo tamanho na tela em qualquer zoom.
    const z = 1 / this.vp.scale;
    const R = PM.ConnectionRouter;
    const d = this.drag;
    const sel = this.selectedShapes();
    // Contorno tracejado em volta de cada forma selecionada
    sel.forEach((s) => { o += `<rect class="sel-box${s.locked ? ' travada' : ''}" x="${s.x - 4 * z}" y="${s.y - 4 * z}" width="${s.w + 8 * z}" height="${s.h + 8 * z}" stroke-width="${1.5 * z}"/>`; });
    // O traço que está sendo desenhado com o lápis
    if (d && d.kind === 'ink' && d.pts.length >= 4) {
      let pd = `M${d.pts[0]},${d.pts[1]}`;
      for (let i = 2; i + 1 < d.pts.length; i += 2) pd += ` L${d.pts[i]},${d.pts[i + 1]}`;
      const cor = this.inkColor === 'graphite' ? 'var(--ink)' : PM.paletteById(this.inkColor).solid;
      o += `<path class="ink-temp" d="${pd}" style="stroke:${cor}" stroke-width="${this.inkWidth}"/>`;
    }
    // Alças de redimensionamento: só com UMA forma selecionada e sem arraste em andamento
    // (no mapa mental o tamanho sai do texto: sem alças)
    if (sel.length === 1 && !d && this.mode !== 'mindmap' && !sel[0].locked) { // travada: sem alças
      const s = sel[0], hs = 8 * z; // hs = tamanho da alça
      // Posição de cada alça como fração da largura/altura (pontos cardeais: n, ne, e...)
      const pos = { nw: [0, 0], n: [.5, 0], ne: [1, 0], e: [1, .5], se: [1, 1], s: [.5, 1], sw: [0, 1], w: [0, .5] };
      // Cursor CSS de cada alça
      const cur = { nw: 'nwse', se: 'nwse', ne: 'nesw', sw: 'nesw', n: 'ns', s: 'ns', e: 'ew', w: 'ew' };
      // [k, [fx, fy]] = desestruturação aninhada
      for (const [k, [fx, fy]] of Object.entries(pos)) {
        o += `<rect class="handle" data-handle="${k}" x="${s.x + s.w * fx - hs / 2}" y="${s.y + s.h * fy - hs / 2}" width="${hs}" height="${hs}" rx="${2 * z}" stroke-width="${1.5 * z}" style="cursor:${cur[k]}-resize"/>`;
      }
    }
    // Tabela, view, classe e interface selecionadas: o "+" embaixo acrescenta um campo
    if (sel.length === 1 && !d && this.mode !== 'mindmap') {
      const s = sel[0], def = PM.ShapeLibrary.get(s.type);
      if (def.render === 'table' || def.render === 'class') {
        const cx = s.x + s.w / 2, cy = s.y + s.h + 16 * z;
        o += `<g class="add-row" data-addrow="${this.esc(s.id)}" transform="translate(${cx},${cy}) scale(${z})">
          <title>${def.render === 'table' ? 'Adicionar coluna' : 'Adicionar atributo'}</title>
          <circle r="11"/><path d="M-5,0 H5 M0,-5 V5"/></g>`;
      }
    }
    // Durante o redimensionamento: etiqueta com o tamanho e se a proporção está travada (Shift)
    if (d && d.kind === 'resize') {
      const s = d.s;
      o += this._tag(s.x + s.w / 2, s.y + s.h + 18 * z, `${Math.round(s.w)} × ${Math.round(s.h)}${d.keep ? '  · proporcional' : '  · Shift = proporcional'}`, z, !d.keep);
    }
    // Guias de alinhamento
    this.guides.forEach((g) => { o += `<line class="guide" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" stroke-width="${z}"/>`; });
    // Retângulo de seleção por área (arrastar no vazio)
    if (d && d.kind === 'marquee' && d.rect) {
      const r = d.rect;
      o += `<rect class="marquee" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" stroke-width="${z}"/>`;
    }

    // ===== MAPA MENTAL: o tópico sendo arrastado e o novo pai =====
    if (d && d.kind === 'mmDrag' && d.moved && d.cur) {
      if (d.target) {
        const t = d.target;
        o += `<rect class="ov target-outline" x="${t.x - 6 * z}" y="${t.y - 6 * z}" width="${t.w + 12 * z}" height="${t.h + 12 * z}" rx="${8 * z}" stroke-width="${1.5 * z}"/>`;
        o += this._tag(t.x + t.w / 2, t.y + t.h + 18 * z, 'Soltar aqui: vira filho deste tópico', z);
      }
    }

    // ===== INDICADOR DE CONEXÃO (linha nova, ou uma ponta sendo religada) =====
    if (d && (d.kind === 'connect' || d.kind === 'reconnect') && d.cur) {
      const a = d.start, b = d.cur;
      // religando a ORIGEM: a ponta fixa é a de chegada (os nomes se invertem)
      const fixo = d.kind === 'reconnect' && d.end === 'from' ? 'Entrada' : 'Saída';
      const novo = fixo === 'Saída' ? 'Entrada' : 'Saída';
      // Linha temporária: tracejada; fica sólida e colorida quando "trava" em uma porta
      o += `<path class="temp-line${d.tport ? ' locked' : ''}" d="M${a.x},${a.y} L${b.x},${b.y}" stroke-width="${2 * z}"/>`;
      // Porta de SAÍDA destacada + etiqueta com o lado
      o += `<circle class="ov port-src" cx="${a.x}" cy="${a.y}" r="${6 * z}" stroke-width="${2 * z}"/>`;
      const [sx, sy] = this._tagPos(a, d.port, z, 'out');
      o += this._tag(sx, sy, `${fixo}: ${R.NAMES[d.port]}`, z);
      if (d.target) {
        const t = d.target;
        // Contorno da forma de destino
        o += `<rect class="ov target-outline" x="${t.x - 6 * z}" y="${t.y - 6 * z}" width="${t.w + 12 * z}" height="${t.h + 12 * z}" rx="${8 * z}" stroke-width="${1.5 * z}"/>`;
        // Todas as portas do destino visíveis; a escolhida fica grande, colorida e "pulsando"
        const ports = PM.ShapeLibrary.ports(t.type, t.w, t.h);
        for (const [n, p] of Object.entries(ports)) {
          const px = t.x + p[0], py = t.y + p[1];
          if (n === d.tport) {
            o += `<circle class="ov port-ring" cx="${px}" cy="${py}" r="${12 * z}" stroke-width="${2 * z}"/>`;
            o += `<circle class="ov port-hot" cx="${px}" cy="${py}" r="${7 * z}" stroke-width="${2 * z}"/>`;
            const [tx, ty] = this._tagPos({ x: px, y: py }, n, z, 'in');
            o += this._tag(tx, ty, `${novo}: ${R.NAMES[n]}`, z);
          } else {
            o += `<circle class="ov port-dot" cx="${px}" cy="${py}" r="${4.5 * z}" stroke-width="${1.5 * z}"/>`;
          }
        }
        // Sobre a forma, mas longe das portas: o sistema escolherá o lado sozinho
        if (!d.tport) o += this._tag(t.x + t.w / 2, t.y + t.h + 22 * z, `${novo}: Automático`, z, true);
      }
    }

    // ===== PONTAS DA LINHA SELECIONADA (por quais portas ela está ligada) =====
    // As bolinhas são ALÇAS: arraste uma até outra forma (ou outra porta) para religar.
    const sc = this.selectedConns();
    if (!d && sc.length === 1 && !sel.length && sc[0]._ends) {
      const e = sc[0]._ends;
      [[e.a, e.ports[0], 'Saída', 'from'], [e.b, e.ports[1], 'Entrada', 'to']].forEach(([p, port, lbl, ponta]) => {
        o += `<circle class="end-handle" data-end="${ponta}" cx="${p.x}" cy="${p.y}" r="${9 * z}" stroke-width="${2 * z}"><title>Arraste para religar a ${lbl === 'Saída' ? 'origem' : 'ponta de destino'}</title></circle>`;
        const [tx, ty] = this._tagPos(p, port, z, lbl === 'Saída' ? 'out' : 'in');
        o += this._tag(tx, ty, `${lbl}: ${R.NAMES[port]}`, z, true);
      });
    }
    this.L.overlay.innerHTML = o;
  }

  /* ---------------- ferramentas ---------------- */
  // Troca a ferramenta ativa e ajusta o cursor via classes CSS.
  // classList.toggle(classe, condição) adiciona se true, remove se false.
  setTool(t) {
    this.tool = t;
    this.wrap.classList.toggle('placing', PM.ShapeLibrary.has(t)); // cursor em cruz
    this.wrap.classList.toggle('panning', t === 'hand');           // cursor de mão
    this.wrap.classList.toggle('drawing', t === 'pen');            // lápis
    this.emit('tool', t); // Toolbar destaca o botão ativo
  }

  /* ---------------- interação com mouse ----------------
     Usamos "Pointer Events" (pointerdown/move/up), que funcionam para
     mouse, caneta e toque com o mesmo código.
     Todo arraste segue 3 fases:
       _down → descobre O QUE foi clicado e cria this.drag = { kind: ... }
       _move → atualiza conforme o kind (pan, move, resize, connect, marquee)
       _up   → finaliza (commit) e limpa this.drag                         */
  _bind() {
    const svg = this.svg;
    // As arrow functions (e) => this._down(e) preservam o "this" da classe.
    svg.addEventListener('pointerdown', (e) => this._down(e));
    svg.addEventListener('pointermove', (e) => this._move(e));
    svg.addEventListener('pointerup', (e) => this._up(e));
    svg.addEventListener('pointercancel', (e) => this._up(e)); // ex.: janela perdeu o foco
    svg.addEventListener('dblclick', (e) => this._dbl(e));
    // passive:false permite chamar preventDefault() e impedir o scroll da página
    svg.addEventListener('wheel', (e) => this._wheel(e), { passive: false });
    svg.addEventListener('contextmenu', (e) => e.preventDefault()); // desativa o menu do botão direito

    // arrastar formas da barra (HTML5 drag & drop)
    // dragover: precisamos chamar preventDefault para "permitir" soltar aqui.
    this.wrap.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('application/x-pm-shape')) e.preventDefault(); });
    // drop: lê o tipo da forma (gravado pela Toolbar no dragstart) e cria no ponto solto.
    this.wrap.addEventListener('drop', (e) => {
      const type = e.dataTransfer.getData('application/x-pm-shape');
      if (!PM.ShapeLibrary.has(type)) return;
      e.preventDefault();
      const p = this.vp.toWorld(e.clientX, e.clientY);
      const nova = this.addShape(type, p.x, p.y);
      this.setTool('select');
      this._editarAoCriar(nova);
    });
    // Quando a câmera muda (zoom), redesenha alças para manter o tamanho em tela.
    this.vp.onChange(() => this.renderOverlay());
  }

  // Roda do mouse: Ctrl = zoom, Shift = rolagem lateral, normal = rolagem vertical.
  _wheel(e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Math.exp transforma o deltaY em um fator suave (>1 aproxima, <1 afasta)
      this.vp.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    } else if (e.shiftKey) {
      this.vp.panBy(-(e.deltaY || e.deltaX), 0);
    } else {
      this.vp.panBy(-e.deltaX, -e.deltaY); // deltaX existe em touchpads (rolagem com 2 dedos)
    }
  }

  // Botão do mouse pressionado.
  _down(e) {
    this.emit('pointerdown');                         // App fecha o editor de texto, se aberto
    const pt = this.vp.toWorld(e.clientX, e.clientY); // posição no mundo
    const t = e.target;                               // elemento exato clicado

    // 1) MOVER O QUADRO: botão do meio (1), ou esquerdo (0) com Espaço / ferramenta Mão
    if (e.button === 1 || (e.button === 0 && (this.spaceDown || this.tool === 'hand'))) {
      e.preventDefault();
      this.drag = { kind: 'pan', lx: e.clientX, ly: e.clientY }; // lx/ly = última posição
      this.wrap.classList.add('panning');
      svg_capture(this.svg, e);
      return;
    }
    if (e.button !== 0) return; // qualquer outro botão: ignora

    // MAPA MENTAL: clicar seleciona; arrastar um tópico muda o pai; o tema central move o mapa
    if (this.mode === 'mindmap') { this._downMind(e, pt, t); return; }

    // 1b) LÁPIS: começa um traço (cada traço vira uma forma "ink")
    if (this.tool === 'pen') {
      e.preventDefault();
      this.drag = { kind: 'ink', pts: [pt.x, pt.y] };
      try { this.svg.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
      return;
    }

    // 2) FERRAMENTA DE FORMA ATIVA: clicou no quadro → cria a forma ali
    if (PM.ShapeLibrary.has(this.tool)) {
      const nova = this.addShape(this.tool, pt.x, pt.y);
      if (!e.shiftKey) this.setTool('select'); // Shift mantém a ferramenta para criar várias
      this._editarAoCriar(nova);
      return;
    }

    // closest() sobe na árvore do HTML até achar um elemento que combine com o seletor.
    // Assim, clicar no texto de uma forma ainda encontra o <g class="shape"> pai.
    const handle = t.closest('[data-handle]');
    const port = t.closest('[data-port]');
    const shapeEl = t.closest('.shape');
    const connEl = t.closest('.conn');
    const endH = t.closest('[data-end]');
    const addRow = t.closest('[data-addrow]');

    if (addRow) {
      // 2a) NOVO CAMPO: o "+" embaixo da tabela/classe. preventDefault: o clique
      // não pode tirar o foco do editor que vai abrir.
      e.preventDefault();
      this.addRow(addRow.dataset.addrow);
      return;
    } else if (endH) {
      // 2b) RELIGAR: arrastar uma ponta da linha selecionada até outra forma/porta
      const c = this.selectedConns()[0];
      const fim = endH.dataset.end; // 'from' (origem) ou 'to' (destino)
      const outra = fim === 'to' ? 'from' : 'to';
      const p = c._ends[fim === 'to' ? 'a' : 'b'];
      this.drag = { kind: 'reconnect', conn: c, end: fim, fixedShape: c[outra], port: c._ends.ports[fim === 'to' ? 0 : 1], start: p, cur: null };
      this.wrap.classList.add('show-ports');
    } else if (handle) {
      // 3) REDIMENSIONAR: guarda a forma e uma cópia do tamanho original ("o")
      const s = this.selectedShapes()[0];
      this.drag = { kind: 'resize', dir: handle.dataset.handle, s, o: { ...s }, p0: pt, keep: e.shiftKey };
      // dataset.handle lê o atributo HTML data-handle="..."
    } else if (port && shapeEl) {
      // 4) CONECTAR: começou a arrastar a partir de uma porta
      const s = this.getShape(shapeEl.dataset.id);
      if (!s) return;
      this.drag = { kind: 'connect', from: s, port: port.dataset.port, start: PM.ConnectionRouter.portPoint(s, port.dataset.port) };
      this.wrap.classList.add('show-ports'); // mostra as portas de todas as formas
    } else if (shapeEl) {
      // 5) MOVER FORMA(S)
      const id = shapeEl.dataset.id;
      const alvo = this.getShape(id);
      // Ctrl+clique num elemento com link: abre a aba ligada (Shift continua somando à seleção)
      if (alvo && alvo.link && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); this.followLink(alvo.link); return; }
      if (e.shiftKey || e.ctrlKey) this.toggleSelection(id);
      else if (!this.sel.has(id)) this.setSelection([id]); // se já estava selecionada, mantém o grupo
      const list = this.selectedShapes().filter((k) => !k.locked); // travada fica onde está
      // Agrupador (raia, limite do sistema) leva junto o que está inteiro dentro dele.
      const junto = [];
      list.filter((k) => PM.ShapeLibrary.get(k.type).container).forEach((ct) => {
        this.shapes.forEach((o) => {
          if (o === ct || o.locked || list.includes(o) || junto.includes(o)) return;
          if (o.x >= ct.x && o.y >= ct.y && o.x + o.w <= ct.x + ct.w && o.y + o.h <= ct.y + ct.h) junto.push(o);
        });
      });
      const todos = list.concat(junto);
      // Guarda a posição inicial de cada forma (items) e a caixa do grupo (b0).
      // moved:false → só vira "movimento" depois de alguns pixels (evita mover em um simples clique).
      if (list.length) this.drag = { kind: 'move', p0: pt, items: todos.map((s) => ({ s, x: s.x, y: s.y })), b0: this.bounds(list), moved: false };
    } else if (connEl) {
      // 6) SELECIONAR LINHA
      const id = connEl.dataset.cid;
      if (e.shiftKey || e.ctrlKey) this.toggleSelection(id);
      // Lisa_Proof (05/11/2026): já é a única selecionada, não redesenha. Trocar o DOM debaixo do ponteiro a cada
      // clique fazia o navegador engolir o duplo clique — e o rótulo da seta (Sim/Não) não abria para editar.
      else if (!(this.sel.size === 1 && this.sel.has(id))) this.setSelection([id]);
    } else {
      // 7) CLIQUE NO VAZIO: limpa a seleção e inicia seleção por área
      if (!e.shiftKey && !e.ctrlKey) this.clearSelection();
      this.drag = { kind: 'marquee', p0: pt, add: e.shiftKey || e.ctrlKey };
    }
    svg_capture(this.svg, e);

    // "Captura" o ponteiro: o SVG continua recebendo pointermove/pointerup
    // mesmo se o mouse sair da área durante o arraste.
    // (função declarada dentro do método — "hoisting" permite usá-la antes desta linha)
    function svg_capture(svg, ev) { try { svg.setPointerCapture(ev.pointerId); } catch (_) { /* noop */ } }
  }

  // Acrescenta um campo: coluna na tabela; atributo (ou método) na classe.
  // Abre o editor com a linha nova JÁ SELECIONADA, para digitar por cima.
  addRow(id, tipo) {
    const s = this.getShape(id);
    if (!s) return;
    const def = PM.ShapeLibrary.get(s.type);
    const linhas = String(s.text ?? '').split('\n');
    let nova, pos;
    if (def.render === 'table') {
      nova = 'nova_coluna: varchar(50)';
      linhas.push(nova);
      pos = linhas.length - 1;
    } else if (def.render === 'class') {
      // as seções da classe: [nome] -- [atributos] -- [métodos]
      const seps = linhas.map((l, i) => (/^\s*-{2,}\s*$/.test(l) ? i : -1)).filter((i) => i >= 0);
      if (tipo === 'metodo') {
        nova = '+ novoMetodo(): void';
        if (seps.length < 2) { linhas.push('--'); if (!seps.length) linhas.push('--'); }
        linhas.push(nova); pos = linhas.length - 1;
      } else {
        nova = '- novoAtributo: Tipo';
        if (!seps.length) { linhas.push('--', nova); pos = linhas.length - 1; }
        else { const fim = seps.length > 1 ? seps[1] : linhas.length; linhas.splice(fim, 0, nova); pos = fim; }
      }
    } else return;
    s.text = linhas.join('\n');
    // onde a linha nova começa e termina no texto (o App seleciona esse trecho)
    const ini = linhas.slice(0, pos).reduce((n, l) => n + l.length + 1, 0);
    this.editHint = { id, start: ini, end: ini + nova.length };
    this.commit();
    setTimeout(() => this.emit('edit-shape', id), 0); // depois do clique, para o foco ficar no editor
  }

  // Abre o editor de texto da forma recém-criada, se o catálogo pedir (anotação,
  // tabela, código...). O setTimeout espera o clique terminar: sem ele, o foco
  // que o navegador dá ao clique tiraria o cursor do editor.
  _editarAoCriar(s) {
    if (!s || !PM.ShapeLibrary.get(s.type).editOnCreate) return;
    // forma nova: o texto padrão vem selecionado (digitar substitui)
    this.editHint = { id: s.id, start: 0, end: String(s.text ?? '').length };
    setTimeout(() => this.emit('edit-shape', s.id), 0);
  }

  // Clique no modo mapa mental.
  _downMind(e, pt, t) {
    const MM = PM.MindMap;
    const tg = t.closest('[data-toggle]');
    if (tg) { MM.toggle(this, tg.dataset.toggle); return; }
    const shapeEl = t.closest('.shape');
    if (shapeEl) {
      const s = this.getShape(shapeEl.dataset.id);
      if (!s) return;
      if (e.shiftKey || e.ctrlKey) this.toggleSelection(s.id);
      else if (!this.sel.has(s.id)) this.setSelection([s.id]);
      this.drag = s.type === 'mmRoot'
        ? { kind: 'move', p0: pt, items: [{ s, x: s.x, y: s.y }], b0: this.bounds([s]), moved: false }
        : { kind: 'mmDrag', node: s, p0: pt, moved: false, ox0: s.ox || 0, oy0: s.oy || 0 };
    } else {
      if (!e.shiftKey && !e.ctrlKey) this.clearSelection();
      this.drag = { kind: 'marquee', p0: pt, add: e.shiftKey || e.ctrlKey };
    }
    try { this.svg.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
  }

  // Mouse em movimento.
  _move(e) {
    const pt = this.vp.toWorld(e.clientX, e.clientY);
    this.emit('pointer', pt); // barra de status mostra x/y (e o ImagePaste guarda a posição)
    const d = this.drag;
    if (!d) return; // nenhum arraste em andamento

    if (d.kind === 'pan') {
      // move a câmera pela diferença desde o último movimento
      this.vp.panBy(e.clientX - d.lx, e.clientY - d.ly);
      d.lx = e.clientX; d.ly = e.clientY;
      return;
    }
    if (d.kind === 'ink') {
      // um ponto novo a cada 2px de tela (menos pontos, traço igual)
      const n = d.pts.length;
      if (Math.hypot(pt.x - d.pts[n - 2], pt.y - d.pts[n - 1]) * this.vp.scale >= 2) { d.pts.push(pt.x, pt.y); this.renderOverlay(); }
      return;
    }
    if (d.kind === 'move') {
      let dx = pt.x - d.p0.x, dy = pt.y - d.p0.y; // deslocamento desde o clique
      // tolerância de 3px de tela antes de considerar arraste
      if (!d.moved && Math.hypot(dx, dy) * this.vp.scale < 3) return;
      d.moved = true;
      // Ajusta o deslocamento com guias/grade (Alt = movimento livre).
      // [dx, dy] = ... → desestruturação reatribuindo duas variáveis de uma vez.
      [dx, dy] = this.mode === 'mindmap' ? [Math.round(dx), Math.round(dy)] : this._snapMove(d, dx, dy, e.altKey);
      // Posição nova = posição original + deslocamento (evita acumular erros)
      d.items.forEach((it) => { it.s.x = it.x + dx; it.s.y = it.y + dy; });
      this.render(); // redesenha (sem commit: só confirma no _up)
      return;
    }
    if (d.kind === 'resize') {
      // Guarda o último ponto/teclas: se o usuário apertar ou soltar Shift SEM mexer
      // o mouse, setModifiers() recalcula usando esses valores.
      d.last = pt; d.lastAlt = e.altKey;
      this._resize(d, pt, e.altKey, e.shiftKey);
      this.render();
      return;
    }
    if (d.kind === 'mmDrag') {
      if (!d.moved && Math.hypot(pt.x - d.p0.x, pt.y - d.p0.y) * this.vp.scale < 4) return;
      d.moved = true;
      d.cur = pt;
      // o tópico (com os filhos) acompanha o mouse: a posição manual é um
      // deslocamento sobre a posição automática (ox, oy)
      d.node.ox = Math.round(d.ox0 + pt.x - d.p0.x);
      d.node.oy = Math.round(d.oy0 + pt.y - d.p0.y);
      // novo pai: um tópico visível sob o mouse que não seja o próprio nem um descendente dele
      const alvo = this.shapeAt(pt, d.node.id);
      d.target = alvo && PM.ShapeLibrary.get(alvo.type).mind && !PM.MindMap.descendants(this, d.node.id).includes(alvo.id) ? alvo : null;
      this.render();
      return;
    }
    if (d.kind === 'connect' || d.kind === 'reconnect') {
      d.cur = pt; // ponta da linha temporária
      // forma sob o mouse (exceto a de origem / a da outra ponta)
      d.target = this._ligavelEm(pt, d.kind === 'connect' ? d.from.id : d.fixedShape);
      d.tport = null;                          // porta "travada" (nenhuma por enquanto)
      // remove o destaque anterior
      this.L.shapes.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target'));
      if (d.target) {
        // "gruda" a ponta na porta mais próxima (raio de PORT_SNAP px de tela)
        d.tport = this.nearestPort(d.target, pt, this.PORT_SNAP / this.vp.scale);
        if (d.tport) d.cur = PM.ConnectionRouter.portPoint(d.target, d.tport);
        // ?. (optional chaining): só chama classList se o elemento existir
        this.L.shapes.querySelector(`[data-id="${d.target.id}"]`)?.classList.add('drop-target');
      }
      this.renderOverlay(); // só a camada de cima precisa mudar
      return;
    }
    if (d.kind === 'marquee') {
      // retângulo entre o ponto inicial e o atual (funciona arrastando em qualquer direção)
      d.rect = { x: Math.min(d.p0.x, pt.x), y: Math.min(d.p0.y, pt.y), w: Math.abs(pt.x - d.p0.x), h: Math.abs(pt.y - d.p0.y) };
      this.renderOverlay();
    }
  }

  // Botão do mouse solto: finaliza a ação.
  _up(e) {
    const d = this.drag;
    this.drag = null;  // encerra o arraste
    this.guides = [];  // apaga as guias
    this.wrap.classList.remove('show-ports');
    if (this.tool !== 'hand') this.wrap.classList.remove('panning');
    if (!d) return;
    const pt = this.vp.toWorld(e.clientX, e.clientY);

    // Movimento/redimensionamento: confirma no histórico (um único passo de Ctrl+Z)
    // Clique sem arrastar: NÃO redesenha as formas (só a camada de seleção). Trocar
    // o DOM debaixo do ponteiro aqui faz o navegador engolir o click e o dblclick
    // (era o que impedia os "dois cliques para editar").
    if (d.kind === 'ink') { this._finishInk(d.pts); return; }
    if (d.kind === 'move') { if (d.moved) this.commit(); else this.renderOverlay(); return; }
    if (d.kind === 'resize') { this.commit(); return; }

    if (d.kind === 'mmDrag') {
      if (!d.moved) { this.renderOverlay(); return; } // idem: preserva o dblclick (editar o tópico)
      const MM = PM.MindMap;
      const root = MM.root(this);
      const n = d.node;
      // solto SOBRE outro tópico: muda o pai (a posição manual não vale mais)
      if (d.target) { n.ox = d.ox0; n.oy = d.oy0; if (!MM.reparent(this, n.id, d.target.id, pt)) this.render(); return; }
      // solto no vazio: fica onde foi solto. Um tópico do 1º nível que cruzou o
      // tema central troca de lado (e a posição horizontal volta a ser automática).
      if (root && n.parent === root.id) {
        const lado = n.x + n.w / 2 < root.x + root.w / 2 ? 'left' : 'right';
        if (lado !== (n.side || 'right')) { n.side = lado; n.ox = 0; }
      }
      if (!n.ox) delete n.ox;
      if (!n.oy) delete n.oy;
      this.commit();
      return;
    }
    if (d.kind === 'reconnect') {
      const c = d.conn;
      const alvo = this._ligavelEm(pt, d.fixedShape);
      if (alvo && this.getConn(c.id)) {
        const porta = this.nearestPort(alvo, pt, this.PORT_SNAP / this.vp.scale) || 'auto';
        if (d.end === 'to') { c.to = alvo.id; c.toPort = porta; } else { c.from = alvo.id; c.fromPort = porta; }
        this.commit();
      } else this.render(); // solto no vazio: a linha fica como estava
      return;
    }
    if (d.kind === 'connect') {
      const target = this._ligavelEm(pt, d.from.id);
      if (target) {
        // Soltou sobre uma forma: cria a conexão (porta mais próxima, ou automática)
        const p = this.nearestPort(target, pt, this.PORT_SNAP / this.vp.scale) || 'auto';
        this.addConnection(d.from.id, target.id, d.port, p);
      } else if (Math.hypot(pt.x - d.start.x, pt.y - d.start.y) * this.vp.scale > 30) {
        // soltou no vazio: cria um novo "Processo" já conectado (estilo Visio)
        // Ex.: saiu pela porta "right" → a nova forma recebe a linha pela "left".
        const opp = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[d.port];
        const def = PM.ShapeLibrary.get('process');
        const dir = PM.ConnectionRouter.DIRS[d.port];
        const isV = dir[0] === 0; // saída vertical (top/bottom)?
        // mantém a nova forma alinhada à porta de origem => linha reta
        const cx = isV ? d.start.x : pt.x + dir[0] * def.w / 2;
        const cy = isV ? pt.y + dir[1] * def.h / 2 : d.start.y;
        const s = this.addShape('process', cx, cy, {}, false); // false: o commit vem depois
        const c = { id: this.newId('c'), from: d.from.id, to: s.id, fromPort: d.port, toPort: opp, style: 'orthogonal', label: '', dashed: false };
        if (d.from.type === 'decision') { const n = this.conns.filter((k) => k.from === d.from.id).length; c.label = n === 0 ? 'Sim' : n === 1 ? 'Não' : ''; }
        // corrige arredondamento do snap para manter a linha centralizada
        const P = PM.ConnectionRouter.portPoint(s, opp);
        if (isV) s.x += d.start.x - P.x; else s.y += d.start.y - P.y;
        this.conns.push(c);
        this.commit();                 // forma + conexão = um único passo no histórico
        this.emit('edit-shape', s.id); // já abre o editor de texto da nova etapa
      } else this.render(); // arraste muito curto: cancela
      return;
    }
    if (d.kind === 'marquee') {
      const r = d.rect;
      if (r && r.w > 2 && r.h > 2) {
        // seleciona formas TOTALMENTE dentro do retângulo...
        // (as travadas não entram: selecionar o que está DENTRO de uma raia travada não pega a raia)
        const ids = this.visibleShapes().filter((s) => !s.locked && s.x >= r.x && s.y >= r.y && s.x + s.w <= r.x + r.w && s.y + s.h <= r.y + r.h).map((s) => s.id);
        const set = new Set(ids);
        // ...e as conexões entre elas
        const cids = this.conns.filter((c) => set.has(c.from) && set.has(c.to)).map((c) => c.id);
        // com Shift/Ctrl soma à seleção anterior
        this.setSelection(d.add ? [...this.sel, ...ids, ...cids] : [...ids, ...cids]);
      } else this.renderOverlay();
    }
  }

  // Duplo clique: editar texto da forma/linha, ou criar um Processo no vazio.
  _dbl(e) {
    // Com o ponteiro "capturado" pelo SVG (setPointerCapture no pointerdown), o
    // dblclick chega com o alvo = o próprio SVG. O que está debaixo do mouse é
    // perguntado ao documento (elementFromPoint).
    // Lisa_Proof (05/11/2026): olha a PILHA debaixo do mouse, não só o de cima. Com a linha selecionada, as
    // alças da sobreposição (as pontas e os nomes "Saída"/"Entrada") ficam por cima dela e roubavam o duplo
    // clique — em vez de editar o rótulo da seta, nascia um Processo novo no lugar.
    const pilha = document.elementsFromPoint(e.clientX, e.clientY).filter((el) => this.svg.contains(el));
    const t = pilha.find((el) => el.closest('.shape') || el.closest('.conn')) || pilha[0] || e.target;
    const shapeEl = t.closest('.shape');
    const connEl = t.closest('.conn');
    if (this.mode === 'mindmap') {
      if (t.closest('[data-toggle]')) return;
      if (shapeEl) return this.emit('edit-shape', shapeEl.dataset.id);
      // duplo clique no vazio: novo tópico no selecionado (ou no tema central)
      const sel = this.selectedShapes()[0];
      const n = PM.MindMap.addChild(this, sel ? sel.id : (PM.MindMap.root(this) || {}).id);
      if (n) this.emit('edit-shape', n.id);
      return;
    }
    // O ShapeManager só AVISA; quem abre o editor é o App (separação de responsabilidades).
    if (shapeEl) return this.emit('edit-shape', shapeEl.dataset.id);
    if (connEl) return this.emit('edit-conn', connEl.dataset.cid);
    const p = this.vp.toWorld(e.clientX, e.clientY);
    const s = this.addShape('process', p.x, p.y);
    this.emit('edit-shape', s.id);
  }

  // Chamado pelo App quando Shift é pressionado/solto durante um redimensionamento.
  // Recalcula na hora, sem precisar mexer o mouse.
  setModifiers(shift) {
    const d = this.drag;
    if (!d || d.kind !== 'resize' || !d.last) return;
    this._resize(d, d.last, d.lastAlt, shift);
    this.render();
  }

  /* --- snap: guias inteligentes (centros/bordas) ou grade ---
     Compara 3 linhas do grupo em movimento (borda inicial, centro, borda final)
     com as mesmas 3 linhas de cada outra forma, nos eixos X e Y.
     Se alguma ficar a menos de "tol" pixels, "puxa" até alinhar e mostra
     a guia. Se nada estiver perto, encaixa o CENTRO na grade.            */
  _snapMove(d, dx, dy, noSnap) {
    this.guides = [];
    if (!this.snap || noSnap) return [Math.round(dx), Math.round(dy)]; // encaixe desligado / Alt
    const b = d.b0;                    // caixa do grupo na posição original
    const tol = 7 / this.vp.scale;     // tolerância: 7px de tela
    const moving = new Set(d.items.map((i) => i.s.id));
    const others = this.shapes.filter((s) => !moving.has(s.id)); // formas paradas
    // Linhas candidatas do grupo já deslocado: [início, centro, fim]
    const bx = [b.x + dx, b.x + dx + b.w / 2, b.x + dx + b.w];
    const by = [b.y + dy, b.y + dy + b.h / 2, b.y + dy + b.h];
    // Melhor alinhamento encontrado (sx/sy = "pontuação": quanto menor, melhor)
    let best = { x: null, y: null, dx: tol + 1, dy: tol + 1, sx: Infinity, sy: Infinity };
    for (const o of others) {
      const ox = [o.x, o.x + o.w / 2, o.x + o.w], oy = [o.y, o.y + o.h / 2, o.y + o.h];
      // Dois laços: compara cada linha do grupo (i) com cada linha da outra forma (j)
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        // prioriza centro-com-centro (i=j=1) para centralizar formas e linhas
        const bonus = i === 1 && j === 1 ? 0.6 : 1;
        const ddx = (ox[j] - bx[i]); // quanto falta no eixo X
        if (Math.abs(ddx) <= tol && Math.abs(ddx) * bonus < best.sx) best = { ...best, sx: Math.abs(ddx) * bonus, dx: ddx, x: { v: ox[j], o } };
        const ddy = (oy[j] - by[i]); // quanto falta no eixo Y
        if (Math.abs(ddy) <= tol && Math.abs(ddy) * bonus < best.sy) best = { ...best, sy: Math.abs(ddy) * bonus, dy: ddy, y: { v: oy[j], o } };
      }
    }
    let ndx, ndy; // deslocamentos finais
    if (best.x && Math.abs(best.dx) <= tol) {
      // Achou alinhamento em X: aplica e cria guia VERTICAL cobrindo as duas formas
      ndx = dx + best.dx;
      const o = best.x.o, y1 = Math.min(o.y, b.y + dy), y2 = Math.max(o.y + o.h, b.y + dy + b.h);
      this.guides.push({ x1: best.x.v, x2: best.x.v, y1: y1 - 20, y2: y2 + 20 });
    } else {
      // Sem alinhamento: encaixa o centro X na grade
      const cx = b.x + dx + b.w / 2; ndx = dx + (Math.round(cx / this.grid) * this.grid - cx);
    }
    if (best.y && Math.abs(best.dy) <= tol) {
      // Alinhamento em Y: guia HORIZONTAL
      ndy = dy + best.dy;
      const o = best.y.o, x1 = Math.min(o.x, b.x + ndx), x2 = Math.max(o.x + o.w, b.x + ndx + b.w);
      this.guides.push({ y1: best.y.v, y2: best.y.v, x1: x1 - 20, x2: x2 + 20 });
    } else {
      const cy = b.y + dy + b.h / 2; ndy = dy + (Math.round(cy / this.grid) * this.grid - cy);
    }
    return [ndx, ndy]; // retorna um array com os dois valores
  }

  // Redimensiona a forma conforme a alça arrastada.
  // d.dir contém letras: n (norte/cima), s (sul/baixo), e (leste/direita), w (oeste/esquerda).
  // keepRatio (Shift pressionado) mantém a proporção largura/altura original:
  //   • alça de CANTO → cresce/diminui por igual, ancorada no canto oposto
  //   • alça de LADO  → o outro eixo acompanha, mantendo a forma centralizada
  _resize(d, pt, noSnap, keepRatio = false) {
    const o = d.o, s = d.s, dir = d.dir; // o = tamanho original, s = forma sendo alterada
    d.keep = keepRatio;                  // usado pela etiqueta "proporcional" no overlay
    const sv = (v) => (this.snap && !noSnap ? Math.round(v / this.grid) * this.grid : Math.round(v));
    const def = PM.ShapeLibrary.get(s.type);
    const min = def.minW || 40;                 // largura mínima
    // altura mínima; tabela/classe/código não ficam menores que o conteúdo
    const minH = Math.max(def.minH || min * 0.6, def.autoHeight ? PM.ShapeLibrary.autoHeight({ ...s, h: 0 }) : 0);
    // Trabalha com as 4 bordas (x1,y1 = canto sup. esq.; x2,y2 = canto inf. dir.)
    let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
    // includes('w') → a alça mexe na borda esquerda, e assim por diante
    if (dir.includes('w')) x1 = Math.min(sv(pt.x), x2 - min);
    if (dir.includes('e')) x2 = Math.max(sv(pt.x), x1 + min);
    if (dir.includes('n')) y1 = Math.min(sv(pt.y), y2 - minH);
    if (dir.includes('s')) y2 = Math.max(sv(pt.y), y1 + minH);

    if (!keepRatio) { s.x = x1; s.y = y1; s.w = x2 - x1; s.h = y2 - y1; return; } // livre

    // ---- modo proporcional ----
    const ratio = o.w / o.h; // proporção original (ex.: 160/70 ≈ 2,29)
    let w = x2 - x1, h = y2 - y1;
    if (dir.length === 2) {
      // Canto: usa o maior fator de escala entre os dois eixos (segue o mouse de forma natural)
      const k = Math.max(w / o.w, h / o.h, min / o.w, minH / o.h);
      w = o.w * k; h = o.h * k;
      // Ancoragem: o canto oposto à alça fica parado
      x1 = dir.includes('w') ? o.x + o.w - w : o.x;
      y1 = dir.includes('n') ? o.y + o.h - h : o.y;
    } else if (dir === 'e' || dir === 'w') {
      // Lado esquerdo/direito: altura acompanha a largura, centralizada verticalmente
      h = Math.max(minH, w / ratio); w = h * ratio;
      if (dir === 'w') x1 = o.x + o.w - w;
      y1 = o.y + o.h / 2 - h / 2;
    } else {
      // Topo/base: largura acompanha a altura, centralizada horizontalmente
      w = Math.max(min, h * ratio); h = w / ratio;
      if (dir === 'n') y1 = o.y + o.h - h;
      x1 = o.x + o.w / 2 - w / 2;
    }
    s.x = Math.round(x1); s.y = Math.round(y1); s.w = Math.round(w); s.h = Math.round(h);
  }
};
