/* =========================================================================
   MindMap.js — O MODO MAPA MENTAL
   -------------------------------------------------------------------------
   PAPEL NA ARQUITETURA
   No modo mapa mental o documento é uma ÁRVORE: um tema central (mmRoot) e
   tópicos (mmNode), cada um com o campo "parent" apontando para o pai.
   Os nós são formas comuns do ShapeManager — seleção, edição de texto,
   desfazer, copiar, salvar e temas continuam funcionando — mas:
     • a POSIÇÃO e o TAMANHO saem do layout automático (não do arraste);
     • as LIGAÇÕES não são guardadas: são desenhadas a partir do "parent";
     • cada galho tem a sua cor e cada tópico com filhos tem um botão de
       recolher/expandir (o número diz quantos tópicos estão escondidos).

   LAYOUT (tree layout para os dois lados)
     1. mede cada nó pelo texto (com quebra de linha) → largura e altura;
     2. calcula a altura de cada SUBÁRVORE (um nó recolhido conta só ele);
     3. os filhos do tema central se dividem entre direita e esquerda
        (campo "side"); os de cada nó ficam empilhados, centrados no pai.

   CAMPOS EXTRAS DE UM NÓ (vão no JSON)
     parent    id do pai (o tema central não tem)
     side      'left' | 'right' — só nos filhos diretos do tema central
     collapsed true quando os filhos estão escondidos
     ox, oy    posição MANUAL: deslocamento sobre a posição automática. Arrastar
               um tópico para o vazio grava isto; os filhos acompanham. Soltar
               sobre outro tópico muda o pai. "Reorganizar" apaga os deslocamentos.
   ========================================================================= */
window.PM = window.PM || {}; // namespace global do sistema

PM.MindMap = {
  // Cor de cada galho (filhos do tema central), em ordem: o verde do Proof e
  // mais quatro. Texto preto no laranja: branco não passa no contraste.
  COLORS: [
    { fill: '#16A34A', text: '#FFFFFF' },
    { fill: '#2362D3', text: '#FFFFFF' },
    { fill: '#0B861D', text: '#FFFFFF' },
    { fill: '#FF6B05', text: '#000000' },
    { fill: '#213D75', text: '#FFFFFF' },
  ],
  GAP_ROOT: 90,   // distância horizontal do tema central aos primeiros tópicos
  GAP: 56,        // distância horizontal entre um nó e os filhos
  VGAP: 14,       // espaço vertical entre irmãos

  /* ---------------- consultas na árvore ---------------- */
  root(m) { return m.shapes.find((s) => s.type === 'mmRoot'); },
  children(m, id) { return m.shapes.filter((s) => s.parent === id); },
  depth(m, s) { let d = 0, p = s; while (p && p.parent) { p = m.getShape(p.parent); d++; } return d; },
  // O filho do tema central de quem "s" descende: ele define a cor do galho.
  branch(m, s) { let p = s; while (p && p.parent && m.getShape(p.parent) && m.getShape(p.parent).type !== 'mmRoot') p = m.getShape(p.parent); return p; },
  descendants(m, id) {
    const out = [], fila = [id];
    while (fila.length) { const atual = fila.shift(); m.shapes.forEach((s) => { if (s.parent === atual) { out.push(s.id); fila.push(s.id); } }); }
    return out;
  },
  // Lado em que o nó fica (o do galho a que pertence).
  sideOf(m, s) { const b = this.branch(m, s); return b && b.side === 'left' ? 'left' : 'right'; },
  color(m, s) {
    const b = this.branch(m, s);
    if (b && b.color) { const p = PM.paletteById(b.color); return { fill: p.solid, text: p.text }; }
    const irmaos = this.children(m, (this.root(m) || {}).id);
    const i = Math.max(0, irmaos.indexOf(b));
    return this.COLORS[i % this.COLORS.length];
  },

  /* ---------------- medida do texto ---------------- */
  // Um <canvas> fora da tela mede o texto na fonte certa (como o navegador desenha).
  _ctx: null,
  _measure(text, font, maxW) {
    if (!this._ctx) { try { this._ctx = document.createElement('canvas').getContext('2d'); } catch (_) { this._ctx = null; } }
    const ctx = this._ctx;
    const largura = (t) => (ctx ? (ctx.font = font, ctx.measureText(t).width) : t.length * 7.2);
    let linhas = 0, maior = 0;
    String(text || ' ').split('\n').forEach((par) => {
      let linha = '';
      par.split(/\s+/).forEach((pal) => {
        const tenta = linha ? `${linha} ${pal}` : pal;
        if (linha && largura(tenta) > maxW) { maior = Math.max(maior, largura(linha)); linhas++; linha = pal; } else linha = tenta;
      });
      maior = Math.max(maior, largura(linha)); linhas++;
    });
    return { w: Math.min(maxW, maior), lines: linhas };
  },
  // Estilo de cada nível: fonte, folgas e largura máxima do texto.
  style(level) {
    if (level === 0) return { size: 17, weight: 700, padX: 28, padY: 16, line: 21, max: 260, minW: 150 };
    if (level === 1) return { size: 14, weight: 600, padX: 18, padY: 10, line: 18, max: 220, minW: 80 };
    return { size: 13, weight: 400, padX: 14, padY: 8, line: 17, max: 220, minW: 60 };
  },

  /* ---------------- layout ---------------- */
  layout(m) {
    const root = this.root(m);
    m._hidden = new Set();
    if (!root) return;
    let fam = 'sans-serif';
    try { fam = getComputedStyle(m.svg).fontFamily || fam; } catch (_) { /* fora do navegador */ }
    // 1) tamanhos
    const nivel = {};
    const medir = (s, lvl) => {
      nivel[s.id] = lvl;
      const st = this.style(lvl);
      const r = this._measure(s.text, `${st.weight} ${st.size}px ${fam}`, st.max);
      s.w = Math.ceil(Math.max(st.minW, r.w + st.padX * 2));
      s.h = Math.ceil(r.lines * st.line + st.padY * 2);
      this.children(m, s.id).forEach((k) => medir(k, lvl + 1));
    };
    const cx = root.x + root.w / 2, cy = root.y + root.h / 2; // o centro do tema fica parado
    medir(root, 0);
    root.x = Math.round(cx - root.w / 2); root.y = Math.round(cy - root.h / 2);
    // 2) escondidos (descendentes de nós recolhidos) e altura das subárvores
    const esconder = (id) => this.children(m, id).forEach((k) => { m._hidden.add(k.id); esconder(k.id); });
    m.shapes.forEach((s) => { if (s.collapsed && s.type === 'mmNode') esconder(s.id); });
    const memo = {};
    const sub = (s) => {
      if (memo[s.id] != null) return memo[s.id];
      const kids = s.collapsed ? [] : this.children(m, s.id);
      const soma = kids.reduce((t, k) => t + sub(k), 0) + this.VGAP * Math.max(0, kids.length - 1);
      return (memo[s.id] = Math.max(s.h, soma));
    };
    // 3) posições
    const colocar = (pai, kids, lado, gap) => {
      const total = kids.reduce((t, k) => t + sub(k), 0) + this.VGAP * Math.max(0, kids.length - 1);
      let y = pai.y + pai.h / 2 - total / 2;
      kids.forEach((k) => {
        // a posição automática + o deslocamento manual (se o tópico foi arrastado)
        k.y = Math.round(y + sub(k) / 2 - k.h / 2) + (k.oy || 0);
        k.x = Math.round(lado === 'right' ? pai.x + pai.w + gap : pai.x - gap - k.w) + (k.ox || 0);
        if (!k.collapsed) colocar(k, this.children(m, k.id), lado, this.GAP);
        y += sub(k) + this.VGAP;
      });
    };
    const primeiros = this.children(m, root.id);
    colocar(root, primeiros.filter((k) => k.side !== 'left'), 'right', this.GAP_ROOT);
    colocar(root, primeiros.filter((k) => k.side === 'left'), 'left', this.GAP_ROOT);
    m._levels = nivel;
  },

  /* ---------------- desenho ---------------- */
  render(m) {
    const esc = (t) => m.esc(t);
    const vis = m.shapes.filter((s) => (s.type === 'mmRoot' || s.type === 'mmNode') && !m._hidden.has(s.id));
    let links = '', nodes = '';
    vis.forEach((s) => {
      if (!s.parent) return;
      const p = m.getShape(s.parent);
      if (!p) return;
      const dir = this.sideOf(m, s) === 'left' ? -1 : 1;
      const a = { x: dir > 0 ? p.x + p.w : p.x, y: p.y + p.h / 2 };
      const b = { x: dir > 0 ? s.x : s.x + s.w, y: s.y + s.h / 2 };
      const k = (b.x - a.x) * 0.55;
      const lvl = (m._levels || {})[s.id] || 1;
      links += `<path class="mm-link" d="M${a.x},${a.y} C${a.x + k},${a.y} ${b.x - k},${b.y} ${b.x},${b.y}" style="stroke:${this.color(m, s).fill}" stroke-width="${lvl === 1 ? 3.5 : lvl === 2 ? 2.5 : 1.8}"/>`;
    });
    vis.forEach((s) => {
      const lvl = (m._levels || {})[s.id] || 0;
      const st = this.style(lvl);
      const d = PM.ShapeLibrary.get(s.type).path(s.w, s.h);
      let corpo, cor;
      if (lvl === 0) {
        const pal = PM.paletteById(s.color || 'purple');
        corpo = `<path class="shadow" d="${d}" transform="translate(6,6)"/><path class="body" d="${d}" style="fill:${pal.fill};stroke:${pal.stroke}" stroke-width="1.2"/>`;
        cor = pal.text;
      } else if (lvl === 1) {
        const c = this.color(m, s);
        corpo = `<path class="shadow" d="${d}" transform="translate(4,4)"/><path class="body" d="${d}" style="fill:${c.fill};stroke:${c.fill}" stroke-width="1"/>`;
        cor = c.text;
      } else {
        const c = this.color(m, s);
        corpo = `<path class="body" d="${d}" style="fill:var(--pm-900);stroke:${c.fill}" stroke-width="1.6"/>`;
        cor = 'var(--ink)';
      }
      // botão de recolher/expandir: na borda de fora, só em quem tem filhos
      let toggle = '';
      const filhos = s.type === 'mmNode' ? this.children(m, s.id).length : 0;
      if (filhos) {
        const dir = this.sideOf(m, s) === 'left' ? -1 : 1;
        const tx = dir > 0 ? s.w + 11 : -11, ty = s.h / 2;
        const escondidos = s.collapsed ? this.descendants(m, s.id).length : 0;
        toggle = `<g class="mm-toggle${s.collapsed ? ' closed' : ''}" data-toggle="${esc(s.id)}" transform="translate(${tx},${ty})">
          <title>${s.collapsed ? 'Expandir' : 'Recolher'}</title>
          <circle r="9" style="stroke:${this.color(m, s).fill}"/>
          <text>${s.collapsed ? escondidos : '−'}</text></g>`;
      }
      nodes += `<g class="shape mm${lvl === 0 ? ' mm-root' : ''}" data-id="${esc(s.id)}" transform="translate(${s.x},${s.y})">
        ${corpo}
        <foreignObject x="0" y="0" width="${s.w}" height="${s.h}">
          <div class="label mm-label" style="color:${cor};font-size:${st.size}px;font-weight:${st.weight};line-height:${st.line}px;padding:0 ${st.padX}px;white-space:pre-wrap">${esc(s.text)}</div>
        </foreignObject>
        ${toggle}
      </g>`;
    });
    return { links, nodes };
  },

  /* ---------------- operações ---------------- */
  // Novo tópico filho. Filho do tema central: vai para o lado com menos tópicos.
  addChild(m, parentId) {
    const root = this.root(m);
    const p = m.getShape(parentId) || root;
    if (!p) return null;
    if (p.collapsed) p.collapsed = false;
    const n = { id: m.newId('s'), type: 'mmNode', parent: p.id, text: 'Novo tópico', x: p.x, y: p.y, w: 120, h: 36 };
    if (p.type === 'mmRoot') {
      const kids = this.children(m, p.id);
      n.side = kids.filter((k) => k.side !== 'left').length <= kids.filter((k) => k.side === 'left').length ? 'right' : 'left';
    }
    m.shapes.push(n);
    m.sel = new Set([n.id]);
    m.commit();
    m.emit('selection');
    return n;
  },
  // Novo irmão logo depois do nó (no tema central, vira filho).
  addSibling(m, id) {
    const s = m.getShape(id);
    if (!s || s.type === 'mmRoot' || !s.parent) return this.addChild(m, (this.root(m) || {}).id);
    const n = { id: m.newId('s'), type: 'mmNode', parent: s.parent, text: 'Novo tópico', x: s.x, y: s.y, w: 120, h: 36 };
    if (s.side) n.side = s.side;
    m.shapes.splice(m.shapes.indexOf(s) + 1, 0, n);
    m.sel = new Set([n.id]);
    m.commit();
    m.emit('selection');
    return n;
  },
  // Apaga os nós e TODA a descendência. O tema central não sai.
  remove(m, ids) {
    const fora = new Set();
    ids.forEach((id) => { const s = m.getShape(id); if (!s || s.type === 'mmRoot') return; fora.add(id); this.descendants(m, id).forEach((d) => fora.add(d)); });
    if (!fora.size) return false;
    const pai = m.getShape([...fora][0]) && m.getShape([...fora][0]).parent;
    m.shapes = m.shapes.filter((s) => !fora.has(s.id));
    m.sel = new Set(pai && m.getShape(pai) ? [pai] : []);
    m.commit();
    m.emit('selection');
    return true;
  },
  toggle(m, id) {
    const s = m.getShape(id);
    if (!s || !this.children(m, id).length) return;
    s.collapsed = !s.collapsed;
    // quem estava selecionado dentro do que sumiu passa a ser o próprio nó
    if (s.collapsed) { const dentro = new Set(this.descendants(m, id)); if ([...m.sel].some((x) => dentro.has(x))) m.sel = new Set([id]); }
    m.commit();
    m.emit('selection');
  },
  // Volta todos os tópicos à posição automática.
  resetPositions(m) {
    let mudou = false;
    m.shapes.forEach((s) => { if (s.ox || s.oy) { delete s.ox; delete s.oy; mudou = true; } });
    if (mudou) m.commit();
    return mudou;
  },
  setAll(m, recolher) {
    m.shapes.forEach((s) => { if (s.type === 'mmNode' && this.children(m, s.id).length) s.collapsed = !!recolher; });
    m.commit();
  },
  // Muda o pai (arrastar um tópico sobre outro). Não aceita virar filho de si mesmo.
  reparent(m, id, alvoId, pt) {
    const s = m.getShape(id), alvo = m.getShape(alvoId);
    if (!s || !alvo || s.type === 'mmRoot' || id === alvoId || this.descendants(m, id).includes(alvoId)) return false;
    s.parent = alvo.id;
    delete s.ox; delete s.oy; // no pai novo, volta à posição automática
    if (alvo.type === 'mmRoot') s.side = pt && pt.x < alvo.x + alvo.w / 2 ? 'left' : 'right';
    else delete s.side;
    alvo.collapsed = false;
    m.commit();
    return true;
  },
  // Primeiro nível arrastado para o outro lado do tema central.
  setSide(m, id, lado) {
    const s = m.getShape(id);
    if (!s || !s.parent || m.getShape(s.parent).type !== 'mmRoot' || s.side === lado) return false;
    s.side = lado;
    m.commit();
    return true;
  },
  // Setas: vai para o nó visível mais próximo naquela direção.
  navigate(m, dir) {
    const s = m.selectedShapes()[0] || this.root(m);
    if (!s) return;
    const c = { x: s.x + s.w / 2, y: s.y + s.h / 2 };
    let melhor = null, nota = Infinity;
    m.shapes.forEach((o) => {
      if (o === s || m._hidden.has(o.id) || !PM.ShapeLibrary.get(o.type).mind) return;
      const dx = o.x + o.w / 2 - c.x, dy = o.y + o.h / 2 - c.y;
      const ok = { right: dx > 5, left: dx < -5, down: dy > 5, up: dy < -5 }[dir];
      if (!ok) return;
      const n = dir === 'left' || dir === 'right' ? Math.abs(dx) + Math.abs(dy) * 2.5 : Math.abs(dy) + Math.abs(dx) * 2.5;
      if (n < nota) { nota = n; melhor = o; }
    });
    if (melhor) m.setSelection([melhor.id]);
  },

  /* ---------------- dados ---------------- */
  // Um mapa novo: só o tema central.
  blank(text) {
    return { mode: 'mindmap', shapes: [{ id: 's1', type: 'mmRoot', x: -100, y: -28, w: 200, h: 56, text: text || 'Tema central', color: 'purple' }], connections: [] };
  },
  // Deixa a árvore consistente: um tema central, todo pai existindo, sem ciclo,
  // e os primeiros tópicos com lado definido. Formas que não são do mapa saem.
  normalize(shapes) {
    let lista = shapes.filter((s) => s.type === 'mmRoot' || s.type === 'mmNode');
    let root = lista.find((s) => s.type === 'mmRoot');
    if (!root) { root = { id: 'mm_root', type: 'mmRoot', x: -100, y: -28, w: 200, h: 56, text: 'Tema central', color: 'purple' }; lista.unshift(root); }
    lista.forEach((s) => { if (s !== root && s.type === 'mmRoot') s.type = 'mmNode'; });
    delete root.parent; delete root.side; delete root.collapsed;
    const ids = new Map(lista.map((s) => [s.id, s]));
    lista.forEach((s) => {
      if (s === root) return;
      if (!ids.has(s.parent) || s.parent === s.id) s.parent = root.id;
      // ciclo: sobe até o tema central; se der volta, pendura no tema
      const vistos = new Set([s.id]); let p = ids.get(s.parent);
      while (p && p !== root) { if (vistos.has(p.id)) { s.parent = root.id; break; } vistos.add(p.id); p = ids.get(p.parent); }
    });
    let alterna = 0;
    lista.forEach((s) => {
      if (s.parent === root.id) { if (s.side !== 'left' && s.side !== 'right') s.side = alterna++ % 2 ? 'left' : 'right'; }
      else delete s.side;
      if (s.collapsed !== true) delete s.collapsed;
      ['ox', 'oy'].forEach((k) => { const v = Math.round(+s[k]); if (Number.isFinite(v) && v && Math.abs(v) < 100000) s[k] = v; else delete s[k]; });
    });
    return lista;
  },
};
