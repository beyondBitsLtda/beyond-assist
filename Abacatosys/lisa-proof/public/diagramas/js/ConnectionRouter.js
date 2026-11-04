/* =========================================================================
   ConnectionRouter.js — TRAÇADO DAS LINHAS (CONEXÕES)
   -------------------------------------------------------------------------
   PAPEL NA ARQUITETURA
   Recebe uma conexão + a forma de origem + a forma de destino e calcula
   POR ONDE a linha passa. Não guarda estado e não mexe no HTML: é um
   módulo de "cálculo puro" (entra dado, sai resultado). Quem desenha a
   linha na tela é o ShapeManager, usando o "d" (path SVG) devolvido aqui.

   VOCABULÁRIO
   • Porta   : ponto da borda onde a linha encosta (top/right/bottom/left).
   • Direção : vetor [dx, dy] que aponta "para fora" da porta.
               top = [0,-1] (para cima), right = [1,0] (para a direita)...
   • Toco (stub): pequeno trecho reto que sai da porta antes de virar,
               para a seta não "grudar" na forma.
   • Ortogonal: linha só com trechos horizontais e verticais (padrão Visio).

   CONCEITO DE JAVASCRIPT: OBJETO LITERAL
   Aqui não usamos "class" porque não precisamos criar várias instâncias:
   um único objeto { ... } com métodos basta (padrão "módulo utilitário").
   ========================================================================= */
window.PM = window.PM || {}; // namespace global do sistema

PM.ConnectionRouter = {
  // Vetor de direção de cada porta (para onde a linha "sai").
  // Lembre: no SVG o eixo Y cresce PARA BAIXO.
  DIRS: { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] },
  // Nome de cada porta em português (usado nos indicadores visuais da conexão).
  NAMES: { top: 'Superior', right: 'Direita', bottom: 'Inferior', left: 'Esquerda', auto: 'Automático' },
  // Comprimento do "toco" reto na saída/chegada (em unidades do mundo).
  STUB: 22,

  // Converte (forma + nome da porta) em coordenada ABSOLUTA do mundo.
  portPoint(shape, port) {
    // Portas vêm em coordenadas locais [x, y]; somamos a posição da forma.
    const p = PM.ShapeLibrary.ports(shape.type, shape.w, shape.h)[port];
    return { x: shape.x + p[0], y: shape.y + p[1] };
  },

  /** Escolhe as portas pela posição relativa entre as formas */
  autoPorts(a, b) {
    // Centros das duas formas
    const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const dx = bc.x - ac.x, dy = bc.y - ac.y; // distância entre centros
    // prioriza fluxo vertical quando houver sobreposição horizontal
    // "Sobreposição" > 0 significa que as formas se cruzam naquele eixo.
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    let vertical; // let = variável que pode ser reatribuída
    if (overlapX > 0 && overlapY <= 0) vertical = true;        // uma em cima da outra
    else if (overlapY > 0 && overlapX <= 0) vertical = false;  // uma ao lado da outra
    else vertical = Math.abs(dy) >= Math.abs(dx);              // diagonal: vence o eixo de maior distância
    // Retorna [portaDeSaída, portaDeChegada]
    if (vertical) return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
    return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
  },

  // Usa as portas fixadas pelo usuário; se forem "auto", calcula automaticamente.
  resolvePorts(conn, a, b) {
    const auto = this.autoPorts(a, b);
    return [conn.fromPort && conn.fromPort !== 'auto' ? conn.fromPort : auto[0],
            conn.toPort && conn.toPort !== 'auto' ? conn.toPort : auto[1]];
  },

  /** Retorna { points, d, mid, ports }
   *  points → vértices da linha (o primeiro e o último são as portas)
   *  d      → string do path SVG pronta para desenhar
   *  mid    → ponto central (onde fica o rótulo "Sim/Não")
   *  ports  → portas efetivamente usadas
   */
  route(conn, a, b) {
    // Desestruturação de array: pega as 2 posições do array em 2 variáveis.
    const [pa, pb] = this.resolvePorts(conn, a, b);
    const p1 = this.portPoint(a, pa), p2 = this.portPoint(b, pb); // pontos inicial e final
    const d1 = this.DIRS[pa], d2 = this.DIRS[pb];                  // direções de saída/chegada
    const style = conn.style || 'orthogonal';

    // --- Estilo RETA: liga direto os dois pontos ---
    if (style === 'straight') {
      const pts = [p1, p2];
      return { points: pts, d: `M${p1.x},${p1.y} L${p2.x},${p2.y}`, mid: this.midOf(pts), ports: [pa, pb] };
    }
    // --- Estilo CURVA: Bézier cúbica com pontos de controle "empurrados" na direção das portas ---
    if (style === 'curve') {
      // k = quão longe ficam os pontos de controle (mínimo 40, ou 40% da distância)
      const k = Math.max(40, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.4); // Math.hypot = distância (Pitágoras)
      const c1 = { x: p1.x + d1[0] * k, y: p1.y + d1[1] * k };
      const c2 = { x: p2.x + d2[0] * k, y: p2.y + d2[1] * k };
      const mid = this.bezierPoint(p1, c1, c2, p2, 0.5); // ponto no meio da curva (t = 0,5)
      return { points: [p1, p2], d: `M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`, mid, ports: [pa, pb] };
    }

    // --- Estilo ORTOGONAL (padrão): calcula vértices e arredonda os cantos ---
    const pts = this.orthogonal(p1, d1, p2, d2);
    return { points: pts, d: this.roundedPath(pts, 10), mid: this.midOf(pts), ports: [pa, pb] };
  },

  // Calcula os vértices de uma rota só com trechos horizontais/verticais.
  orthogonal(p1, d1, p2, d2) {
    const S = this.STUB;
    // Alinhadas => linha reta (centralização de linhas)
    // Caso 1: saída e chegada verticais, mesmo X, e o destino está "à frente" da saída.
    if (d1[0] === 0 && d2[0] === 0 && Math.abs(p1.x - p2.x) < 0.5 && (p2.y - p1.y) * d1[1] > 0) return [p1, p2];
    // Caso 2: o mesmo raciocínio para linhas horizontais (mesmo Y).
    if (d1[1] === 0 && d2[1] === 0 && Math.abs(p1.y - p2.y) < 0.5 && (p2.x - p1.x) * d1[0] > 0) return [p1, p2];

    // s = fim do toco de saída; e = início do toco de chegada
    const s = { x: p1.x + d1[0] * S, y: p1.y + d1[1] * S };
    const e = { x: p2.x + d2[0] * S, y: p2.y + d2[1] * S };
    const h1 = d1[1] === 0, h2 = d2[1] === 0; // true quando a porta é lateral (sai na horizontal)
    let mids; // vértices intermediários entre s e e

    if (h1 && h2 && d1[0] === d2[0]) {
      // As duas portas apontam para o MESMO lado (ex.: right → right):
      // contorna por fora, usando o X mais extremo.
      const mx = d1[0] > 0 ? Math.max(s.x, e.x) : Math.min(s.x, e.x);
      mids = [{ x: mx, y: s.y }, { x: mx, y: e.y }];
    } else if (!h1 && !h2 && d1[1] === d2[1]) {
      // Mesmo caso, na vertical (ex.: bottom → bottom).
      const my = d1[1] > 0 ? Math.max(s.y, e.y) : Math.min(s.y, e.y);
      mids = [{ x: s.x, y: my }, { x: e.x, y: my }];
    } else if (h1 && h2) {
      // Horizontal → horizontal com lados opostos (ex.: right → left).
      // forward = o destino está na frente; então faz um "Z" com dobra no meio do X.
      const forward = (e.x - s.x) * d1[0] >= 0 && d1[0] === -d2[0];
      if (forward) { const mx = (s.x + e.x) / 2; mids = [{ x: mx, y: s.y }, { x: mx, y: e.y }]; }
      else { const my = (s.y + e.y) / 2; mids = [{ x: s.x, y: my }, { x: e.x, y: my }]; } // destino "atrás": dobra no meio do Y
    } else if (!h1 && !h2) {
      // Vertical → vertical com lados opostos (ex.: bottom → top). Mesma lógica girada.
      const forward = (e.y - s.y) * d1[1] >= 0 && d1[1] === -d2[1];
      if (forward) { const my = (s.y + e.y) / 2; mids = [{ x: s.x, y: my }, { x: e.x, y: my }]; }
      else { const mx = (s.x + e.x) / 2; mids = [{ x: mx, y: s.y }, { x: mx, y: e.y }]; }
    } else if (h1) {
      // Sai na horizontal e chega na vertical: um único canto (formato "L").
      mids = [{ x: e.x, y: s.y }];
    } else {
      // Sai na vertical e chega na horizontal: "L" invertido.
      mids = [{ x: s.x, y: e.y }];
    }
    // "...mids" (spread) espalha os itens do array dentro do novo array.
    const pts = [p1, s, ...mids, e, p2];
    return this.simplify(pts);
  },

  // Limpa a lista de vértices: remove pontos repetidos e pontos no meio de uma reta.
  simplify(pts) {
    const out = [];
    // for...of percorre cada item do array
    for (const p of pts) {
      const last = out[out.length - 1];
      // ponto praticamente igual ao anterior (< 0,5) → descarta
      if (last && Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5) continue;
      out.push({ x: p.x, y: p.y });
    }
    // remove pontos colineares (três pontos na mesma vertical ou horizontal)
    // Percorremos de trás para frente porque "splice" remove itens e mudaria os índices à frente.
    for (let i = out.length - 2; i > 0; i--) {
      const a = out[i - 1], b = out[i], c = out[i + 1];
      const col = (Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5) || (Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5);
      if (col) out.splice(i, 1); // splice(i, 1) remove 1 item na posição i
    }
    return out;
  },

  // Transforma a lista de vértices em um path SVG com cantos arredondados (raio r).
  roundedPath(pts, r) {
    // Com só 2 pontos não há canto: linha reta.
    if (pts.length < 3) return `M${pts[0].x},${pts[0].y} L${pts[pts.length - 1].x},${pts[pts.length - 1].y}`;
    let d = `M${pts[0].x},${pts[0].y}`;
    // Para cada vértice intermediário, para um pouco antes (a), faz uma curva e continua depois (b).
    for (let i = 1; i < pts.length - 1; i++) {
      const p0 = pts[i - 1], p = pts[i], p1 = pts[i + 1];
      const l1 = Math.hypot(p.x - p0.x, p.y - p0.y), l2 = Math.hypot(p1.x - p.x, p1.y - p.y); // tamanho dos trechos
      const rr = Math.min(r, l1 / 2, l2 / 2); // raio não pode ser maior que metade do trecho
      // a = ponto antes do canto; b = ponto depois do canto (andando "rr" pelo trecho)
      const a = { x: p.x - ((p.x - p0.x) / l1) * rr, y: p.y - ((p.y - p0.y) / l1) * rr };
      const b = { x: p.x + ((p1.x - p.x) / l2) * rr, y: p.y + ((p1.y - p.y) / l2) * rr };
      // L até "a", depois curva quadrática (Q) usando o próprio canto como ponto de controle
      d += ` L${a.x},${a.y} Q${p.x},${p.y} ${b.x},${b.y}`;
    }
    const L = pts[pts.length - 1];
    return d + ` L${L.x},${L.y}`; // termina no último ponto (onde fica a seta)
  },

  // Encontra o ponto que fica exatamente na metade do comprimento total da linha.
  midOf(pts) {
    let total = 0; const segs = [];
    // Mede cada trecho e soma o total
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push(l); total += l; }
    let half = total / 2;
    // Anda trecho por trecho até "consumir" metade do comprimento
    for (let i = 0; i < segs.length; i++) {
      if (half <= segs[i]) {
        const t = segs[i] ? half / segs[i] : 0; // fração dentro do trecho (0..1)
        // interpolação linear entre o início e o fim do trecho
        return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t };
      }
      half -= segs[i];
    }
    return pts[0];
  },

  // Fórmula matemática da curva de Bézier cúbica no instante t (0 = início, 1 = fim).
  bezierPoint(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    };
  },
};
