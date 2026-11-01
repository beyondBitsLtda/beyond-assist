/* =========================================================================
   SqlImport.js — DO SCHEMA SQL AO DIAGRAMA (tabelas e relações sozinhas)
   -------------------------------------------------------------------------
   PAPEL NA ARQUITETURA
   Lê um script SQL (CREATE TABLE, ALTER TABLE ... FOREIGN KEY, CREATE INDEX)
   e desenha o modelo: uma forma "Tabela" por tabela, com as colunas e os
   selos (PK, FK, UQ, IX, NN), e uma linha de relação por chave estrangeira,
   com o "pé de galinha" (muitos) do lado da tabela filha e o "um" do lado da
   tabela referenciada. O layout sai das relações: as tabelas referenciadas
   (pais) ficam à esquerda; as que apontam para elas, à direita.

   DIALETOS
   SQL Server ([colchetes], dbo., GO, IDENTITY, CLUSTERED, WITH CHECK ADD),
   MySQL (`crases`, KEY/INDEX dentro da tabela, AUTO_INCREMENT, ENGINE=),
   PostgreSQL ("aspas", SERIAL, REFERENCES na coluna, ONLY) e Oracle
   (VARCHAR2, NUMBER). Não é um interpretador completo de SQL: só o que
   descreve a ESTRUTURA. O resto do script (INSERT, procedures, GRANT...) é
   ignorado em silêncio, e o que não deu para entender vira aviso.

   SEGURANÇA
   O texto do SQL só vira TEXTO das formas (que o ShapeManager escapa ao
   desenhar). Nada do script é executado.

   PARTES
     PM.SqlImport.parse(sql)            → { tables, avisos }
     PM.SqlImport.diagram(modelo, x, y) → { shapes, connections } prontos
     new PM.SqlImport({ ... }).open()   → a janela (colar o SQL ou abrir .sql)
   ========================================================================= */
window.PM = window.PM || {}; // namespace global do sistema

PM.SqlImport = class SqlImport {
  constructor({ manager, viewport, host, notify }) {
    this.m = manager;
    this.vp = viewport;
    this.host = host;        // onde a janela é pendurada (a raiz do app)
    this.notify = notify;
    this.el = null;
    this.m.on('sql-import', () => this.open());
  }

  /* =====================================================================
     1. LER O SQL
     ===================================================================== */

  // Quebra o texto em "tokens": nomes (com ou sem aspas/colchetes/crases),
  // textos entre aspas simples, números e pontuação. Comentários somem aqui.
  static tokens(sql) {
    const out = [];
    const s = String(sql || '');
    let i = 0;
    const n = s.length;
    while (i < n) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '-' && s[i + 1] === '-') { while (i < n && s[i] !== '\n') i++; continue; }     // -- comentário
      if (c === '#' && (i === 0 || s[i - 1] === '\n')) { while (i < n && s[i] !== '\n') i++; continue; } // # MySQL
      if (c === '/' && s[i + 1] === '*') { const f = s.indexOf('*/', i + 2); i = f < 0 ? n : f + 2; continue; }
      if (c === "'") {                                                   // 'texto' ('' escapa)
        let j = i + 1, v = '';
        while (j < n) { if (s[j] === "'" && s[j + 1] === "'") { v += "'"; j += 2; continue; } if (s[j] === "'") break; v += s[j++]; }
        out.push({ t: 'str', v }); i = j + 1; continue;
      }
      if (c === '"' || c === '`' || c === '[') {                         // nome entre aspas
        const fim = c === '[' ? ']' : c;
        let j = i + 1, v = '';
        while (j < n) { if (s[j] === fim && s[j + 1] === fim && c !== '[') { v += fim; j += 2; continue; } if (s[j] === fim) break; v += s[j++]; }
        out.push({ t: 'id', v, q: true }); i = j + 1; continue;
      }
      if (/[A-Za-z_À-ÿ@#$]/.test(c)) {
        let j = i + 1;
        while (j < n && /[A-Za-z0-9_À-ÿ@#$]/.test(s[j])) j++;
        out.push({ t: 'id', v: s.slice(i, j) }); i = j; continue;
      }
      if (/[0-9]/.test(c)) { let j = i + 1; while (j < n && /[0-9.]/.test(s[j])) j++; out.push({ t: 'num', v: s.slice(i, j) }); i = j; continue; }
      out.push({ t: 'p', v: c }); i++;
    }
    return out;
  }

  // As instruções: separadas por ";", por um GO (SQL Server) - ou por um novo
  // CREATE/ALTER fora de parênteses (script colado sem separador nenhum).
  static statements(tokens) {
    const st = [];
    let cur = [], prof = 0;
    tokens.forEach((t) => {
      if ((t.t === 'p' && t.v === ';') || (t.t === 'id' && !t.q && /^go$/i.test(t.v))) { if (cur.length) st.push(cur); cur = []; prof = 0; return; }
      if (t.t === 'id' && !t.q && prof === 0 && cur.length && /^(CREATE|ALTER)$/i.test(t.v)) { st.push(cur); cur = []; }
      if (t.v === '(') prof++;
      if (t.v === ')') prof = Math.max(0, prof - 1);
      cur.push(t);
    });
    if (cur.length) st.push(cur);
    return st;
  }

  static parse(sql) {
    const KW = (t, w) => t && t.t === 'id' && !t.q && t.v.toUpperCase() === w;
    const tabelas = new Map();   // chave (minúscula) → tabela
    const avisos = [];
    const fksSoltas = [];        // ALTER TABLE ... FOREIGN KEY (resolvidas no fim)
    const chave = (sch, nome) => `${(sch || '').toLowerCase()}.${nome.toLowerCase()}`;
    const PADRAO = /^(dbo|public)$/i;

    // nome qualificado: a.b.c → { schema: b, name: c }
    const lerNome = (tk, i) => {
      const partes = [];
      while (i < tk.length && tk[i].t === 'id') {
        partes.push(tk[i].v); i++;
        if (tk[i] && tk[i].t === 'p' && tk[i].v === '.') { i++; continue; }
        break;
      }
      return { name: partes[partes.length - 1] || '', schema: partes.length > 1 ? partes[partes.length - 2] : '', i };
    };
    // ( a ASC, b ) → ['a','b']
    const lerLista = (tk, i) => {
      const cols = [];
      if (!(tk[i] && tk[i].v === '(')) return { cols, i };
      i++;
      let prof = 0;
      while (i < tk.length && !(prof === 0 && tk[i].v === ')')) {
        const t = tk[i];
        if (t.v === '(') prof++; else if (t.v === ')') prof--;
        else if (prof === 0 && t.t === 'id' && !/^(ASC|DESC)$/i.test(t.v)) cols.push(t.v);
        i++;
      }
      return { cols, i: i + 1 };
    };
    const acharTabela = (sch, nome) => {
      const exata = tabelas.get(chave(sch, nome));
      if (exata) return exata;
      // sem schema (ou schema padrão): pelo nome, se for único
      const iguais = [...tabelas.values()].filter((t) => t.name.toLowerCase() === nome.toLowerCase());
      return iguais.length === 1 ? iguais[0] : null;
    };
    const coluna = (t, nome) => t.columns.find((c) => c.name.toLowerCase() === String(nome).toLowerCase());

    // as restrições de tabela (dentro do CREATE ou num ALTER ... ADD)
    const restricao = (tab, tk, i) => {
      if (KW(tk[i], 'CONSTRAINT')) i += 2;               // CONSTRAINT nome
      if (KW(tk[i], 'PRIMARY') && KW(tk[i + 1], 'KEY')) {
        i += 2;
        while (tk[i] && tk[i].t === 'id' && !tk[i].q && /^(CLUSTERED|NONCLUSTERED|USING|BTREE|HASH)$/i.test(tk[i].v)) i++;
        const l = lerLista(tk, i);
        l.cols.forEach((c) => { const col = coluna(tab, c); if (col) { col.pk = true; col.nn = true; } });
        return true;
      }
      if (KW(tk[i], 'FOREIGN') && KW(tk[i + 1], 'KEY')) {
        const l = lerLista(tk, i + 2);
        let j = l.i;
        if (!KW(tk[j], 'REFERENCES')) return false;
        const ref = lerNome(tk, j + 1);
        const r = lerLista(tk, ref.i);
        fksSoltas.push({ tab, cols: l.cols, refSchema: ref.schema, refName: ref.name, refCols: r.cols });
        return true;
      }
      if (KW(tk[i], 'UNIQUE')) {
        let j = i + 1;
        if (KW(tk[j], 'KEY') || KW(tk[j], 'INDEX')) j++;
        while (tk[j] && tk[j].t === 'id' && !(tk[j + 1] && tk[j + 1].v === '(') ) j++; // nome do índice / CLUSTERED
        if (tk[j] && tk[j].t === 'id' && tk[j + 1] && tk[j + 1].v === '(') j++;
        const l = lerLista(tk, j);
        if (l.cols.length === 1) { const col = coluna(tab, l.cols[0]); if (col) col.uq = true; }
        else l.cols.forEach((c) => { const col = coluna(tab, c); if (col) col.ix = true; });
        return true;
      }
      if (KW(tk[i], 'KEY') || KW(tk[i], 'INDEX') || KW(tk[i], 'FULLTEXT') || KW(tk[i], 'SPATIAL')) {   // MySQL: KEY nome (cols)
        let j = i + 1;
        if (KW(tk[j], 'KEY') || KW(tk[j], 'INDEX')) j++;
        if (tk[j] && tk[j].t === 'id' && !(tk[j].v === '(')) j++;
        lerLista(tk, j).cols.forEach((c) => { const col = coluna(tab, c); if (col) col.ix = true; });
        return true;
      }
      if (KW(tk[i], 'CHECK') || KW(tk[i], 'EXCLUDE') || KW(tk[i], 'PERIOD')) return true;
      return false;
    };

    // as palavras que encerram o tipo da coluna
    const FIM_TIPO = /^(WITHOUT|NOT|NULL|PRIMARY|REFERENCES|UNIQUE|DEFAULT|IDENTITY|CONSTRAINT|CHECK|COLLATE|AUTO_INCREMENT|AUTOINCREMENT|GENERATED|COMMENT|ON|AS|ROWGUIDCOL|SPARSE|FILESTREAM|MASKED|ENCRYPTED|CHARACTER|CHARSET|KEY|UNSIGNED|ZEROFILL|INVISIBLE|VISIBLE|STORAGE|COLUMN_FORMAT|WITH|ENCODE)$/i;

    const coluna_ = (tab, tk) => {
      const nome = tk[0].v;
      let i = 1, tipo = [];
      let prof = 0;
      while (i < tk.length) {
        const t = tk[i];
        if (prof === 0 && t.t === 'id' && !t.q && FIM_TIPO.test(t.v)) {
          // "character varying" / "double precision" / "unsigned": fazem parte do tipo
          if (/^(CHARACTER)$/i.test(t.v) && tk[i + 1] && /^varying$/i.test(tk[i + 1].v)) { tipo.push('character varying'); i += 2; continue; }
          if (/^(UNSIGNED|ZEROFILL)$/i.test(t.v)) { tipo.push(t.v.toLowerCase()); i++; continue; }
          // "timestamp with time zone" / "without time zone"
          if (/^(WITH|WITHOUT)$/i.test(t.v) && tk[i + 1] && /^time$/i.test(tk[i + 1].v)) { tipo.push(`${t.v} time zone`.toLowerCase()); i += 3; continue; }
          break;
        }
        if (t.v === '(') prof++;
        if (t.v === ')') prof--;
        tipo.push(t.v);
        i++;
      }
      const col = { name: nome, type: tipo.join(' ').replace(/\s*\(\s*/g, '(').replace(/\s*\)/g, ')').replace(/\s*,\s*/g, ',').trim() };
      for (; i < tk.length; i++) {
        if (KW(tk[i], 'PRIMARY') && KW(tk[i + 1], 'KEY')) { col.pk = true; col.nn = true; }
        else if (KW(tk[i], 'NOT') && KW(tk[i + 1], 'NULL')) col.nn = true;
        else if (KW(tk[i], 'UNIQUE')) col.uq = true;
        else if (KW(tk[i], 'REFERENCES')) {
          const ref = lerNome(tk, i + 1);
          const r = lerLista(tk, ref.i);
          fksSoltas.push({ tab, cols: [nome], refSchema: ref.schema, refName: ref.name, refCols: r.cols });
          i = r.i - 1;
        }
      }
      return col;
    };

    PM.SqlImport.statements(PM.SqlImport.tokens(sql)).forEach((tk) => {
      let i = 0;
      // ---------------- CREATE TABLE
      if (KW(tk[0], 'CREATE')) {
        i = 1;
        if (KW(tk[i], 'OR') && KW(tk[i + 1], 'REPLACE')) i += 2;
        while (tk[i] && /^(GLOBAL|LOCAL|TEMPORARY|TEMP|UNLOGGED|EXTERNAL|VIRTUAL)$/i.test(tk[i].v) && tk[i].t === 'id') i++;
        if (KW(tk[i], 'TABLE')) {
          i++;
          if (KW(tk[i], 'IF') && KW(tk[i + 1], 'NOT') && KW(tk[i + 2], 'EXISTS')) i += 3;
          const nm = lerNome(tk, i);
          i = nm.i;
          if (!nm.name || !(tk[i] && tk[i].v === '(')) {
            if (nm.name) avisos.push(`CREATE TABLE ${nm.name}: sem a lista de colunas (CREATE TABLE ... AS SELECT?) - ficou de fora.`);
            return;
          }
          if (/^#/.test(nm.name)) return; // tabela temporária do SQL Server
          const tab = { name: nm.name, schema: nm.schema, columns: [] };
          // as definições: separadas por vírgula no nível de cima dos parênteses
          const defs = [];
          let cur = [], prof = 0;
          for (i = i + 1; i < tk.length; i++) {
            const t = tk[i];
            if (t.v === '(') prof++;
            if (t.v === ')') { if (prof === 0) break; prof--; }
            if (prof === 0 && t.v === ',') { defs.push(cur); cur = []; continue; }
            cur.push(t);
          }
          if (cur.length) defs.push(cur);
          const restricoes = [];
          defs.forEach((d) => {
            if (!d.length) return;
            if (d[0].t === 'id' && !d[0].q && /^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|KEY|INDEX|CHECK|FULLTEXT|SPATIAL|EXCLUDE|PERIOD|LIKE)$/i.test(d[0].v)) restricoes.push(d);
            else if (d[0].t === 'id') tab.columns.push(coluna_(tab, d));
          });
          const k = chave(nm.schema, nm.name);
          if (tabelas.has(k)) avisos.push(`A tabela ${nm.name} aparece duas vezes: ficou a última.`);
          tabelas.set(k, tab);
          restricoes.forEach((d) => { if (!restricao(tab, d, 0)) avisos.push(`${nm.name}: restrição não entendida (${d.slice(0, 4).map((t) => t.v).join(' ')}…).`); });
          return;
        }
        // ---------------- CREATE [UNIQUE] INDEX nome ON tabela (cols)
        let j = i, unico = false;
        if (KW(tk[j], 'UNIQUE')) { unico = true; j++; }
        while (tk[j] && tk[j].t === 'id' && /^(CLUSTERED|NONCLUSTERED|BITMAP|FULLTEXT|SPATIAL)$/i.test(tk[j].v)) j++;
        if (KW(tk[j], 'INDEX')) {
          j++;
          if (KW(tk[j], 'IF') && KW(tk[j + 1], 'NOT') && KW(tk[j + 2], 'EXISTS')) j += 3;
          while (tk[j] && !KW(tk[j], 'ON')) j++;
          const nm = lerNome(tk, j + 1);
          let k2 = nm.i;
          if (KW(tk[k2], 'USING')) k2 += 2;
          const l = lerLista(tk, k2);
          const tab = acharTabela(nm.schema, nm.name);
          if (!tab) return;
          l.cols.forEach((c) => { const col = coluna(tab, c); if (col) { if (unico && l.cols.length === 1) col.uq = true; else col.ix = true; } });
        }
        return;
      }
      // ---------------- ALTER TABLE x [WITH CHECK] ADD [CONSTRAINT n] ...
      if (KW(tk[0], 'ALTER') && KW(tk[1], 'TABLE')) {
        i = 2;
        if (KW(tk[i], 'ONLY')) i++;
        if (KW(tk[i], 'IF') && KW(tk[i + 1], 'EXISTS')) i += 2;
        const nm = lerNome(tk, i);
        const tab = acharTabela(nm.schema, nm.name);
        i = nm.i;
        while (tk[i] && /^(WITH|CHECK|NOCHECK)$/i.test(tk[i].v) && tk[i].t === 'id') i++;
        if (!tab || !KW(tk[i], 'ADD')) return;
        i++;
        if (KW(tk[i], 'COLUMN')) i++;
        if (restricao(tab, tk, i)) return;
        if (KW(tk[i], 'CONSTRAINT')) return; // DEFAULT, CHECK... nomeados: não mudam o desenho
        // ADD coluna tipo ...
        if (tk[i] && tk[i].t === 'id') tab.columns.push(coluna_(tab, tk.slice(i)));
      }
    });

    // as chaves estrangeiras, agora que todas as tabelas existem
    const tables = [...tabelas.values()];
    tables.forEach((t) => { t.fks = []; });
    fksSoltas.forEach((f) => {
      const ref = acharTabela(f.refSchema, f.refName);
      f.cols.forEach((c) => { const col = coluna(f.tab, c); if (col) col.fk = true; });
      if (!ref) { avisos.push(`${f.tab.name}.${f.cols.join(',')} aponta para ${f.refName}, que não está no script (a linha ficou de fora).`); return; }
      const nn = f.cols.every((c) => { const col = coluna(f.tab, c); return col && col.nn; });
      f.tab.fks.push({ cols: f.cols, ref, refCols: f.refCols, obrigatoria: nn });
    });
    tables.forEach((t) => {
      t.label = t.schema && !PADRAO.test(t.schema) ? `${t.schema}.${t.name}` : t.name;
    });
    if (!tables.length) avisos.unshift('Nenhum CREATE TABLE encontrado no texto.');
    return { tables, avisos };
  }

  /* =====================================================================
     2. MONTAR O DIAGRAMA
     ===================================================================== */
  // O texto da forma Tabela: 1ª linha o nome; depois "PK FK coluna: tipo".
  static texto(t) {
    return [t.label].concat(t.columns.map((c) => {
      const selos = [c.pk && 'PK', c.fk && 'FK', c.uq && !c.pk && 'UQ', c.ix && !c.pk && !c.uq && 'IX', c.nn && !c.pk && 'NN'].filter(Boolean);
      return `${selos.length ? selos.join(' ') + ' ' : ''}${c.name}${c.type ? `: ${c.type}` : ''}`;
    })).join('\n');
  }

  // Posições: as referenciadas (pais) à esquerda, as filhas à direita; as
  // tabelas sem relação nenhuma, num bloco embaixo.
  static diagram(modelo, x0 = 0, y0 = 0, { rotulo = true } = {}) {
    const lib = PM.ShapeLibrary;
    const T = modelo.tables;
    const largura = (t) => Math.max(200, Math.min(440, Math.round(Math.max(...PM.SqlImport.texto(t).split('\n').map((l) => l.length)) * 7.2 + 56)));
    const altura = (t) => lib.autoHeight({ type: 'dbTable', text: PM.SqlImport.texto(t) });
    // nível = o caminho mais longo até uma tabela sem pai (ciclo: para)
    const nivel = new Map();
    const visitando = new Set();
    const calc = (t) => {
      if (nivel.has(t)) return nivel.get(t);
      if (visitando.has(t)) return 0;
      visitando.add(t);
      const pais = t.fks.map((f) => f.ref).filter((r) => r !== t);
      const n = pais.length ? 1 + Math.max(...pais.map(calc)) : 0;
      visitando.delete(t);
      nivel.set(t, n);
      return n;
    };
    const ligadas = new Set();
    T.forEach((t) => t.fks.forEach((f) => { if (f.ref !== t) { ligadas.add(t); ligadas.add(f.ref); } }));
    const comRel = T.filter((t) => ligadas.has(t));
    const soltas = T.filter((t) => !ligadas.has(t));
    comRel.forEach(calc);
    // colunas por nível; dentro delas, perto dos pais (baricentro), em 2 passadas
    const colunas = [];
    comRel.forEach((t) => { const n = nivel.get(t); (colunas[n] = colunas[n] || []).push(t); });
    const ordem = new Map();
    colunas.forEach((c) => c && c.forEach((t, i) => ordem.set(t, i)));
    for (let passo = 0; passo < 2; passo++) {
      colunas.forEach((c, n) => {
        if (!c || !n) return;
        const peso = (t) => { const p = t.fks.map((f) => f.ref).filter((r) => r !== t && ordem.has(r)); return p.length ? p.reduce((s, r) => s + ordem.get(r), 0) / p.length : ordem.get(t); };
        c.sort((a, b) => peso(a) - peso(b));
        c.forEach((t, i) => ordem.set(t, i));
      });
    }
    // colunas muito altas quebram em subcolunas de até 7 tabelas
    const MAX = 7, GX = 150, GY = 60;
    const pos = new Map();
    let x = x0, alturaMax = 0;
    colunas.forEach((c) => {
      if (!c) return;
      for (let k = 0; k < c.length; k += MAX) {
        const fatia = c.slice(k, k + MAX);
        const w = Math.max(...fatia.map(largura));
        let y = y0;
        fatia.forEach((t) => { pos.set(t, { x, y, w: largura(t), h: altura(t) }); y += altura(t) + GY; });
        alturaMax = Math.max(alturaMax, y - y0);
        x += w + GX;
      }
    });
    // as soltas: em grade, embaixo (ou no lugar, se não houver relação nenhuma)
    const porLinha = Math.max(3, Math.ceil(Math.sqrt(soltas.length)));
    let yS = comRel.length ? y0 + alturaMax + 80 : y0, xS = x0, maiorH = 0;
    soltas.forEach((t, i) => {
      if (i && i % porLinha === 0) { yS += maiorH + GY; xS = x0; maiorH = 0; }
      pos.set(t, { x: xS, y: yS, w: largura(t), h: altura(t) });
      xS += largura(t) + 70; maiorH = Math.max(maiorH, altura(t));
    });
    // as formas e as linhas
    const ids = new Map();
    const shapes = T.map((t, i) => {
      const p = pos.get(t);
      ids.set(t, `sq${i + 1}`);
      return { id: `sq${i + 1}`, type: 'dbTable', x: Math.round(p.x), y: Math.round(p.y), w: p.w, h: p.h, text: PM.SqlImport.texto(t), color: lib.get('dbTable').color || 'purple' };
    });
    const connections = [];
    T.forEach((t) => t.fks.forEach((f) => {
      if (f.ref === t) return; // autorrelação: o selo FK fica, a linha não (uma forma não liga nela mesma)
      connections.push({ id: `cq${connections.length + 1}`, from: ids.get(t), to: ids.get(f.ref), fromPort: 'auto', toPort: 'auto',
        style: 'orthogonal', label: rotulo ? f.cols.join(', ') : '', dashed: false,
        arrowStart: f.obrigatoria ? 'many' : 'zeroMany', arrow: 'oneOnly' });
    }));
    return { shapes, connections };
  }

  /* =====================================================================
     3. A JANELA
     ===================================================================== */
  open() {
    if (this.m.mode === 'mindmap') { this.notify('O schema vira um diagrama de banco: abra um fluxograma (Novo → Fluxograma) antes.', true); return; }
    if (!this.el) this._montar();
    this.el.hidden = false;
    this._previa();
    setTimeout(() => this.ta.focus(), 0);
  }
  close() { if (this.el) this.el.hidden = true; }

  _montar() {
    const el = document.createElement('div');
    el.className = 'modal sql-modal';
    el.hidden = true;
    el.innerHTML = `<div class="modal-card wide" role="dialog" aria-modal="true" aria-label="Diagrama a partir de um schema SQL">
      <h2>Diagrama a partir de um schema SQL</h2>
      <p class="sub">Cole o script (CREATE TABLE, ALTER TABLE … FOREIGN KEY, CREATE INDEX) ou abra um arquivo .sql. As tabelas, colunas e relações são desenhadas sozinhas.</p>
      <textarea class="sql-texto" spellcheck="false" placeholder="CREATE TABLE cliente (&#10;  id INT PRIMARY KEY,&#10;  nome VARCHAR(100) NOT NULL&#10;);&#10;CREATE TABLE pedido (&#10;  id INT PRIMARY KEY,&#10;  cliente_id INT NOT NULL REFERENCES cliente(id)&#10;);"></textarea>
      <div class="sql-linha">
        <button type="button" class="btn" data-sql="arquivo">Abrir arquivo .sql…</button>
        <label class="sql-op"><input type="radio" name="sql-dest" value="aba" checked> Numa aba nova</label>
        <label class="sql-op"><input type="radio" name="sql-dest" value="aqui"> Nesta aba</label>
        <label class="sql-op"><input type="checkbox" data-sql="rotulo" checked> Coluna da chave na linha</label>
      </div>
      <div class="sql-previa" aria-live="polite"></div>
      <div class="sql-acoes"><button type="button" class="btn" data-sql="fechar">Cancelar</button><button type="button" class="btn primary" data-sql="desenhar">Desenhar o diagrama</button></div>
      <input type="file" accept=".sql,.txt,text/plain" hidden />
    </div>`;
    this.host.appendChild(el);
    this.el = el;
    this.ta = el.querySelector('.sql-texto');
    this.previaEl = el.querySelector('.sql-previa');
    this.fileInput = el.querySelector('input[type=file]');
    let relogio = null;
    this.ta.addEventListener('input', () => { clearTimeout(relogio); relogio = setTimeout(() => this._previa(), 250); });
    this.ta.addEventListener('keydown', (e) => {
      e.stopPropagation(); // as teclas são do texto, não atalhos do quadro
      if (e.key === 'Escape') this.close();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.desenhar(); }
    });
    el.addEventListener('click', (e) => {
      if (e.target === el) return this.close();
      const b = e.target.closest('[data-sql]');
      if (!b) return;
      if (b.dataset.sql === 'fechar') this.close();
      if (b.dataset.sql === 'arquivo') this.fileInput.click();
      if (b.dataset.sql === 'desenhar') this.desenhar();
    });
    this.fileInput.addEventListener('change', () => {
      const f = this.fileInput.files[0];
      this.fileInput.value = '';
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) { this.notify('Arquivo grande demais (o limite é 5 MB).', true); return; }
      const r = new FileReader();
      r.onload = () => { this.ta.value = String(r.result || ''); this._previa(); };
      r.onerror = () => this.notify('Não foi possível ler o arquivo.', true);
      r.readAsText(f, 'utf-8');
    });
  }

  // "12 tabelas, 15 relações" enquanto se cola o texto (e os avisos).
  _previa() {
    const txt = this.ta.value;
    if (!txt.trim()) { this.previaEl.textContent = ''; return null; }
    const mod = PM.SqlImport.parse(txt);
    const rel = mod.tables.reduce((n, t) => n + t.fks.filter((f) => f.ref !== t).length, 0);
    this.previaEl.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = `${mod.tables.length} tabela(s), ${rel} relação(ões).`;
    this.previaEl.appendChild(b);
    if (mod.avisos.length) {
      const ul = document.createElement('ul');
      mod.avisos.slice(0, 8).forEach((a) => { const li = document.createElement('li'); li.textContent = a; ul.appendChild(li); });
      if (mod.avisos.length > 8) { const li = document.createElement('li'); li.textContent = `… e mais ${mod.avisos.length - 8} aviso(s).`; ul.appendChild(li); }
      this.previaEl.appendChild(ul);
    }
    return mod;
  }

  desenhar() {
    const mod = this._previa();
    if (!mod || !mod.tables.length) { this.notify('Nenhuma tabela encontrada: cole um script com CREATE TABLE.', true); return; }
    if (mod.tables.length > 400) { this.notify(`Tabelas demais (${mod.tables.length}): divida o script (o limite é 400 por vez).`, true); return; }
    const m = this.m;
    const novaAba = this.el.querySelector('input[name=sql-dest]:checked').value === 'aba';
    const rotulo = this.el.querySelector('[data-sql=rotulo]').checked;
    if (novaAba && m.shapes.length) m.addPage('Schema SQL');
    // nesta aba, com coisa desenhada: o diagrama entra à direita do que já existe
    const b = m.bounds();
    const x0 = b && !novaAba ? b.x + b.w + 200 : 0, y0 = b && !novaAba ? b.y : 0;
    const d = PM.SqlImport.diagram(mod, x0, y0, { rotulo });
    // ids novos (não colidem com o que já existe na aba)
    const map = {};
    d.shapes.forEach((s) => { map[s.id] = m.newId('s'); s.id = map[s.id]; m.shapes.push(s); });
    d.connections.forEach((c) => { c.id = m.newId('c'); c.from = map[c.from]; c.to = map[c.to]; m.conns.push(c); });
    m.sel = new Set();
    m.commit();
    m.emit('selection');
    this.vp.fit(m.bounds(d.shapes));
    this.close();
    this.notify(`Diagrama desenhado: ${d.shapes.length} tabela(s) e ${d.connections.length} relação(ões)${mod.avisos.length ? ` (${mod.avisos.length} aviso(s) na janela)` : ''}.`);
  }
};
