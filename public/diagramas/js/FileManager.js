/* =========================================================================
   FileManager.js — BOTÕES DE IMPORTAR / EXPORTAR JSON (e "Novo")
   -------------------------------------------------------------------------
   PAPEL NA ARQUITETURA
   Única "porta de entrada e saída" de dados do sistema.
   Nada é gravado em banco ou Local Storage: o arquivo .json
   baixado é a única forma de guardar o processo desenhado.

   EXPORTAR:  ShapeManager.serialize(true) → JSON → Blob → link de download
              (true = imagens vão com o base64 completo no campo "src")
   IMPORTAR:  <input type=file> → FileReader lê o texto → JSON.parse
              → validate() confere/normaliza → ShapeManager.load()

   CATEGORIA (etiqueta no cabeçalho)
   Todo desenho pode ser catalogado como Anotação pessoal, Documentação
   oficial de processo ou Anotação técnica. A categoria vai no JSON
   ("category") e aparece como etiqueta ao lado do nome.

   CONCEITOS DE NAVEGADOR USADOS
   • Blob: "arquivo em memória" criado pelo JavaScript.
   • URL.createObjectURL: gera um endereço temporário para o Blob,
     permitindo baixá-lo por um link <a download>. Tudo acontece
     localmente, sem servidor (por isso funciona offline).
   • FileReader: lê o conteúdo de um arquivo escolhido pelo usuário.
   ========================================================================= */
window.PM = window.PM || {}; // namespace global do sistema

PM.FileManager = class FileManager {
  /**
   * @param manager   ShapeManager (dados do diagrama)
   * @param viewport  Viewport (para salvar/enquadrar a câmera)
   * @param theme     ThemeManager (o tema vai junto no arquivo)
   * @param container <div> onde os botões serão criados
   * @param nameInput <input> com o nome do processo (vira o nome do arquivo)
   * @param tags      <div> das etiquetas do cabeçalho (categoria)
   * @param notify    função para exibir mensagens (toast) — injetada pelo App
   */
  constructor({ manager, viewport, theme, container, nameInput, tags, notify }) {
    this.m = manager;
    this.vp = viewport;
    this.theme = theme;
    this.el = container;
    this.nameInput = nameInput;
    this.tagsEl = tags || null;
    this.notify = notify;
    this.FORMAT = 'processmap'; // "assinatura" gravada no JSON para reconhecer o arquivo
    this.VERSION = 4;           // versão do formato (4 = abas, travar, link, desenho à mão; 3 = mapa mental, categoria, pontas). v1 a v3 continuam abrindo.
    this.category = '';         // '' (sem categoria) | 'pessoal' | 'oficial' | 'tecnica'
    this._render();
    this.renderTags();
  }

  // As categorias do desenho. "aprovacao" diz quem precisa de aprovação
  // quando há um fluxo de aprovação (a versão do ProcessMap no Fluig).
  static CATEGORIAS = [
    { id: 'pessoal', nome: 'Anotação pessoal', curto: 'Anotação pessoal', desc: 'Rascunho seu: só você vê (no Fluig).' },
    { id: 'oficial', nome: 'Documentação oficial de processo', curto: 'Documentação oficial', desc: 'Documento oficial: cada versão passa por aprovação (no Fluig).', aprovacao: true },
    { id: 'tecnica', nome: 'Anotação técnica', curto: 'Anotação técnica', desc: 'Registro técnico da equipe.' },
  ];
  static categoria(id) { return FileManager.CATEGORIAS.find((c) => c.id === id) || null; }

  /* ---------------- etiquetas do cabeçalho ---------------- */
  // A etiqueta da categoria. Clicar abre a lista para escolher.
  renderTags() {
    if (!this.tagsEl) return;
    const c = FileManager.categoria(this.category);
    let box = this.tagsEl.querySelector('.cat-box');
    if (!box) {
      box = document.createElement('span');
      box.className = 'cat-box';
      this.tagsEl.prepend(box);
      box.addEventListener('click', (e) => {
        const op = e.target.closest('[data-cat]');
        if (op) { this.setCategory(op.dataset.cat); this._catMenu(false); return; }
        if (e.target.closest('.doc-tag')) this._catMenu(box.querySelector('.tag-menu').hidden);
      });
      document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.cat-box')) this._catMenu(false); });
    }
    box.innerHTML = `<button type="button" class="doc-tag cat-${c ? c.id : 'nenhuma'}" title="${c ? c.nome + '. ' + c.desc + ' Clique para trocar.' : 'Clique para catalogar este desenho'}">${c ? c.curto : 'Sem categoria'}<i>▾</i></button>
      <div class="tag-menu" role="menu" hidden>${FileManager.CATEGORIAS.map((k) =>
        `<button type="button" role="menuitem" data-cat="${k.id}"${k.id === this.category ? ' class="active"' : ''}><b>${k.nome}</b><span>${k.desc}</span></button>`).join('')}</div>`;
  }
  _catMenu(abrir) {
    const menu = this.tagsEl && this.tagsEl.querySelector('.tag-menu');
    if (menu) menu.hidden = !abrir;
  }
  // Trocar a categoria é alteração do documento (vai no próximo salvamento).
  setCategory(id, silencioso) {
    const novo = FileManager.categoria(id) ? id : '';
    if (novo === this.category) return;
    this.category = novo;
    this.renderTags();
    if (!silencioso) { this.m.dirty = true; this.m.emit('change'); this.notify(`Categoria: ${FileManager.categoria(novo).nome}.`); }
  }

  // Cria os botões no cabeçalho e liga os eventos.
  _render() {
    // Ícones SVG inline (não dependem de arquivos ou internet)
    const ic = {
      novo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M12 12v6M9 15h6"/></svg>',
      imp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/></svg>',
      exp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 17v3h16v-3"/></svg>',
    };
    // data-act identifica a ação de cada botão. O <input type=file> fica oculto:
    // o botão "Importar" apenas "clica" nele via código.
    this.el.innerHTML = `
      <span class="fm-novo"><button class="btn" data-act="new-menu" title="Novo fluxograma ou mapa mental">${ic.novo}Novo</button>
        <span class="tag-menu fm-menu" role="menu" hidden>
          <button type="button" role="menuitem" data-act="new"><b>Fluxograma</b><span>Formas e conexões, com todas as coleções de figuras.</span></button>
          <button type="button" role="menuitem" data-act="new-mind"><b>Mapa mental</b><span>Tema central e tópicos em árvore, com galhos retráteis.</span></button>
          <button type="button" role="menuitem" data-act="sql"><b>Diagrama de um schema SQL</b><span>Cole o CREATE TABLE (ou abra o .sql): tabelas e relações se desenham sozinhas.</span></button>
        </span></span>
      <button class="btn" data-act="import" title="Importar arquivo .json (Ctrl+O)">${ic.imp}Importar JSON</button>
      <button class="btn primary" data-act="export" title="Exportar para .json (Ctrl+S)">${ic.exp}Exportar JSON</button>
      <input type="file" accept=".json,application/json" hidden />`;
    this.fileInput = this.el.querySelector('input[type=file]');

    // DELEGAÇÃO DE EVENTOS: um único listener no container trata os 3 botões.
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const menu = this.el.querySelector('.fm-menu');
      if (b.dataset.act === 'new-menu') { menu.hidden = !menu.hidden; return; }
      if (menu) menu.hidden = true;
      if (b.dataset.act === 'new') this.newDocument();
      if (b.dataset.act === 'new-mind') this.newDocument('mindmap');
      if (b.dataset.act === 'sql') this.m.emit('sql-import'); // a janela é do SqlImport (App)
      if (b.dataset.act === 'import') this.openPicker();
      if (b.dataset.act === 'export') this.exportJSON();
    });
    // Disparado quando o usuário escolhe um arquivo na janela do sistema.
    this.fileInput.addEventListener('change', () => {
      const f = this.fileInput.files[0];
      if (f) this.importFile(f);
      this.fileInput.value = ''; // limpa, para permitir escolher o MESMO arquivo de novo
    });
  }

  // Pergunta antes de descartar alterações não exportadas.
  // confirm() abre a caixa nativa do navegador e retorna true (OK) ou false (Cancelar).
  confirmDiscard() {
    if (!this.m.dirty || !this.m.totals().shapes) return true; // nada a perder (em nenhuma aba)
    return confirm('Há alterações que não foram exportadas e serão perdidas.\nDeseja continuar?');
  }

  // Botão "Novo": limpa o quadro. mode = 'mindmap' começa um mapa mental.
  newDocument(mode) {
    if (!this.confirmDiscard()) return;
    this.m.clear(mode);
    this.nameInput.value = mode === 'mindmap' ? 'Novo mapa mental' : 'Novo processo';
    this.setCategory('', true);
    this.vp.fit(mode === 'mindmap' ? this.m.bounds() : null); // câmera volta ao centro
    this.notify(mode === 'mindmap' ? 'Novo mapa mental: Tab cria um tópico.' : 'Novo processo iniciado.');
  }

  // Abre a janela de escolha de arquivo (após confirmar o descarte).
  openPicker() { if (this.confirmDiscard()) this.fileInput.click(); }

  /* ---------------- exportação ---------------- */

  // Monta o objeto completo que vai para o arquivo.
  buildPayload() {
    return {
      format: this.FORMAT,
      version: this.VERSION,
      name: this.nameInput.value.trim() || 'Processo', // trim() tira espaços das pontas
      exportedAt: new Date().toISOString(),            // data/hora no padrão ISO (ex.: 2026-10-13T15:00:00Z)
      theme: this.theme ? this.theme.current : undefined, // tema ativo
      category: this.category || undefined,            // categoria (etiqueta do cabeçalho)
      viewport: this.vp.toJSON(),                      // posição/zoom da câmera
      ...this.m.serializeDoc(true),                    // spread: "pages" (cada aba com "shapes" - imagens em base64 - e "connections"), "activePage" e "mode"
    };
  }

  // Gera e baixa o arquivo .json.
  exportJSON() {
    const data = this.buildPayload();
    // JSON.stringify(obj, null, 2) → texto JSON indentado com 2 espaços (legível).
    // O base64 de cada imagem fica em UMA linha (é uma string só).
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); // endereço temporário (blob:...)
    // Cria um link invisível com o atributo "download" e simula o clique.
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.slug(data.name)}.processmap.json`; // nome do arquivo
    document.body.appendChild(a); a.click(); a.remove();
    // Libera a memória do endereço temporário depois de 1 segundo.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.m.dirty = false; // considera "salvo"
    this.notify(`Exportado: ${a.download}`);
  }

  // Transforma o nome em algo seguro para arquivo: sem acentos, sem espaços, minúsculo.
  // "Fluxo de Reserva · Ação" → "fluxo-de-reserva-acao"
  slug(t) {
    return t.normalize('NFD')                  // separa letras de acentos (á → a + ´)
      .replace(/[\u0300-\u036f]/g, '')         // remove os acentos
      .replace(/[^\w-]+/g, '-')                // troca tudo que não é letra/número/_/- por "-"
      .replace(/-+/g, '-')                     // junta hífens repetidos
      .replace(/^-|-$/g, '')                   // tira hífen do começo/fim
      .toLowerCase() || 'processo';            // se sobrar vazio, usa "processo"
  }

  /* ---------------- importação ---------------- */

  // Lê o arquivo escolhido. FileReader é ASSÍNCRONO: a leitura termina
  // "depois", e o resultado chega na função onload (callback).
  importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      // try/catch: se qualquer passo lançar erro, cai no catch e avisa o usuário.
      try {
        const data = this.validate(JSON.parse(reader.result)); // texto → objeto → validado
        this.m.load(data);                                    // carrega no quadro
        if (data.theme && this.theme) this.theme.apply(data.theme, true); // reaplica o tema salvo
        this.setCategory(data.category || '', true);                       // a categoria do arquivo
        // Nome: o salvo no JSON, ou o nome do arquivo sem a extensão
        this.nameInput.value = data.name || file.name.replace(/(\.processmap)?\.json$/i, '');
        const b = this.m.bounds();
        if (b) this.vp.fit(b); else this.vp.fit(null); // enquadra o fluxo importado
        const todas = [].concat(...data.pages.map((pg) => pg.shapes));
        const linhas = data.pages.reduce((t, pg) => t + pg.connections.length, 0);
        const imgs = todas.filter((s) => s.type === 'image').length;
        this.notify(`Importado: ${todas.length} formas${imgs ? ` (${imgs} imagens)` : ''} e ${linhas} conexões${data.pages.length > 1 ? ` em ${data.pages.length} abas` : ''}.`);
      } catch (err) {
        this.notify(`Arquivo inválido: ${err.message}`, true); // true = estilo de erro
      }
    };
    reader.onerror = () => this.notify('Não foi possível ler o arquivo.', true);
    reader.readAsText(file, 'utf-8'); // inicia a leitura (mantém acentos corretamente)
  }

  /** Valida e normaliza o JSON importado
   *  Programação defensiva: o arquivo pode ter sido editado à mão ou estar
   *  corrompido. Aqui garantimos tipos corretos e valores padrão, e
   *  "throw new Error" interrompe a importação com uma mensagem clara.   */
  validate(d) {
    if (!d || typeof d !== 'object') throw new Error('conteúdo não é um objeto JSON.');
    if (d.format && d.format !== this.FORMAT) throw new Error(`formato "${d.format}" não reconhecido.`);
    // As abas (formato 4). O arquivo antigo, sem "pages", é uma aba só.
    const brutas = Array.isArray(d.pages) && d.pages.length ? d.pages
      : [{ id: 'p1', name: 'Página 1', shapes: d.shapes, connections: d.connections, viewport: d.viewport }];
    if (brutas.length > 100) throw new Error(`abas demais (${brutas.length}).`);
    const idsAba = new Set();
    const pages = brutas.map((pg, i) => {
      if (!pg || typeof pg !== 'object') throw new Error(`aba #${i + 1} inválida.`);
      let id = /^[A-Za-z0-9_-]{1,40}$/.test(String(pg.id)) ? String(pg.id) : `p${i + 1}`;
      while (idsAba.has(id)) id = `${id}_`;
      idsAba.add(id);
      if (!Array.isArray(pg.shapes)) throw new Error(brutas.length > 1 ? `aba "${pg.name || i + 1}" sem a lista "shapes".` : 'lista "shapes" ausente.');
      const name = String(pg.name ?? '').trim().slice(0, 60) || `Página ${i + 1}`;
      return { id, name, viewport: pg.viewport && typeof pg.viewport === 'object' ? pg.viewport : null, ...this._validarAba(pg.shapes, pg.connections) };
    });
    // link só para uma aba que existe
    pages.forEach((pg) => pg.shapes.forEach((s) => { if (s.link && !idsAba.has(s.link)) delete s.link; }));
    const activePage = idsAba.has(String(d.activePage)) ? String(d.activePage) : pages[0].id;
    const theme = this.theme && this.theme.has(d.theme) ? d.theme : null;
    const mode = d.mode === 'mindmap' ? 'mindmap' : 'diagram';
    const category = FileManager.categoria(d.category) ? d.category : '';
    const ativa = pages.find((pg) => pg.id === activePage);
    return { name: d.name, viewport: ativa.viewport || d.viewport, theme, mode, category, pages, activePage,
             shapes: ativa.shapes, connections: ativa.connections };
  }

  // As formas e linhas de UMA aba, conferidas e normalizadas.
  _validarAba(listaFormas, listaLinhas) {
    const conns = Array.isArray(listaLinhas) ? listaLinhas : [];
    const ids = new Set(); // para detectar ids repetidos
    // Converte para número; se não for número válido, usa o padrão "def".
    const num = (v, def) => (Number.isFinite(+v) ? +v : def);
    const shapes = listaFormas.map((s, i) => {
      if (!s || !s.id) throw new Error(`forma #${i + 1} sem "id".`);
      if (ids.has(String(s.id))) throw new Error(`id duplicado "${s.id}".`);
      ids.add(String(s.id));
      const type = PM.ShapeLibrary.has(s.type) ? s.type : 'process'; // tipo desconhecido vira Processo
      const def = PM.ShapeLibrary.get(type);
      const out = {
        id: String(s.id), type,
        x: num(s.x, 0), y: num(s.y, 0),
        // tamanho mínimo 20 (o desenho à mão pode ser fininho: 4)
        w: Math.max(def.ink ? 4 : 20, num(s.w, def.w)), h: Math.max(def.ink ? 4 : 20, num(s.h, def.h)),
        text: String(s.text ?? ''), color: PM.paletteById(s.color).id,     // cor inválida vira a principal
      };
      // mapa mental: sem cor escolhida, o galho fica com a cor automática dele (MindMap.color). Antes,
      // a cor padrão entrava em todo tópico ao abrir, e o mapa reaberto saía todo roxo.
      if (def.mind && !PM.Palette.some((p) => p.id === s.color)) delete out.color;
      if (type === 'image') {
        // Só aceita data URLs de imagem em base64 PURO (segurança: nada de endereços
        // externos, scripts ou aspas que fechariam o atributo no HTML)
        if (typeof s.src === 'string' && /^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml);base64,[A-Za-z0-9+\/=]+$/i.test(s.src)) out.src = s.src;
        out.iw = Math.max(1, num(s.iw, out.w)); out.ih = Math.max(1, num(s.ih, out.h));
      }
      // campos de alguns tipos: só o que é conhecido passa
      if (type === 'code') out.lang = PM.SyntaxHighlighter.has(s.lang) ? s.lang : 'javascript';
      if (s.locked === true) out.locked = true;
      if (s.link != null && /^[A-Za-z0-9_-]{1,40}$/.test(String(s.link))) out.link = String(s.link);
      if (def.ink) {
        // os pontos: pares de inteiros de 0 a 1000 (no máximo 3000 pontos)
        const pts = Array.isArray(s.pts) ? s.pts.slice(0, 6000).map((v) => Math.max(0, Math.min(1000, Math.round(+v) || 0))) : [];
        out.pts = pts.length % 2 ? pts.slice(0, -1) : pts;
        out.sw = Math.max(1, Math.min(24, Math.round(num(s.sw, 3))));
      }
      if (type === 'freeText') {
        if (num(s.fs, 0)) out.fs = Math.max(8, Math.min(96, Math.round(num(s.fs, 14))));
        if (s.fb === true) out.fb = true;
      }
      if (PM.ShapeLibrary.get(type).mind) {
        if (s.parent != null) out.parent = String(s.parent);
        if (s.side === 'left' || s.side === 'right') out.side = s.side;
        if (s.collapsed === true) out.collapsed = true;
        ['ox', 'oy'].forEach((k) => { const v = num(s[k], 0); if (v && Math.abs(v) < 100000) out[k] = Math.round(v); });
      }
      return out;
    });
    const ports = ['auto', 'top', 'right', 'bottom', 'left'];   // valores aceitos
    const styles = ['orthogonal', 'straight', 'curve'];
    const pontas = ['none', ...Object.keys(PM.ShapeLibrary.markers)];
    const ponta = (v, padrao) => (pontas.includes(v) ? v : padrao);
    const connections = conns
      // descarta conexões que apontam para formas inexistentes
      .filter((c) => c && ids.has(String(c.from)) && ids.has(String(c.to)))
      .map((c, i) => ({
        id: String(c.id || `c_imp${i}`),
        from: String(c.from), to: String(c.to),
        fromPort: ports.includes(c.fromPort) ? c.fromPort : 'auto',
        toPort: ports.includes(c.toPort) ? c.toPort : 'auto',
        style: styles.includes(c.style) ? c.style : 'orthogonal',
        label: String(c.label ?? ''), dashed: !!c.dashed,
        arrow: ponta(c.arrow, 'arrow'), arrowStart: ponta(c.arrowStart, 'none'),
        labelFrom: String(c.labelFrom ?? ''), labelTo: String(c.labelTo ?? ''),
      }));
    return { shapes, connections };
  }
};
