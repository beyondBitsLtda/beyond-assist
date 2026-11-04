/* =========================================================================
   Viewport.js — QUADRO INFINITO (rolagem ilimitada + zoom + grade)
   -------------------------------------------------------------------------
   PAPEL NA ARQUITETURA
   Existem dois sistemas de coordenadas no ProcessMap:
     • TELA  (pixels do monitor, ex.: posição do mouse: clientX / clientY)
     • MUNDO (posição "real" das formas no diagrama, ex.: forma em x=400)
   O Viewport é a "câmera" que olha para o mundo. Ele guarda:
     x, y   → qual ponto do mundo aparece no canto superior esquerdo da tela
     scale  → zoom (1 = 100%, 2 = 200%...)
   Mover o quadro = mudar x/y. Dar zoom = mudar scale.
   Como x/y podem ser QUALQUER número, o quadro não tem fim (scroll ilimitado).

   FÓRMULAS-CHAVE
     mundo = (tela  - bordaDoSvg) / scale + origem
     tela  = (mundo - origem) * scale + bordaDoSvg
   ========================================================================= */
window.PM = window.PM || {}; // namespace global do sistema

PM.Viewport = class Viewport {
  /**
   * @param {SVGSVGElement} svg   elemento <svg id="canvas"> da página
   * @param {SVGGElement}  world  grupo <g id="world"> que contém todo o desenho
   */
  constructor(svg, world) {
    this.svg = svg;
    this.world = world;
    this.x = -80;          // origem do mundo visível (canto superior esquerdo)
    this.y = -60;          // valores negativos deixam uma margem antes do ponto (0,0)
    this.scale = 1;        // zoom inicial 100%
    this.min = 0.15;       // zoom mínimo 15%
    this.max = 3;          // zoom máximo 300%
    this.listeners = [];   // ouvintes avisados a cada mudança de câmera
    this._buildGrid();     // cria os padrões SVG da grade de fundo
    this.apply();          // aplica a posição/zoom inicial na tela
  }

  // Padrão Observer: registra função chamada sempre que a câmera muda.
  onChange(fn) { this.listeners.push(fn); }

  // Cria dois <pattern> SVG (grade fina de 20px e grade grossa de 100px).
  // Um <pattern> é um "ladrilho" que o SVG repete para preencher uma área.
  // As cores vêm de variáveis CSS (style="stroke:var(...)"), então mudam com o tema.
  _buildGrid() {
    const defs = this.svg.querySelector('defs'); // <defs> guarda recursos reutilizáveis
    // insertAdjacentHTML insere um trecho de marcação no fim de <defs>.
    // As crases (`...`) são "template strings": permitem texto em várias linhas.
    defs.insertAdjacentHTML('beforeend', `
      <pattern id="gridMinor" patternUnits="userSpaceOnUse" width="20" height="20">
        <path d="M20,0 H0 V20" fill="none" style="stroke:var(--grid-minor)" stroke-width="1"/>
      </pattern>
      <pattern id="gridMajor" patternUnits="userSpaceOnUse" width="100" height="100">
        <rect width="100" height="100" fill="url(#gridMinor)"/>
        <path d="M100,0 H0 V100" fill="none" style="stroke:var(--grid-major)" stroke-width="1"/>
      </pattern>`);
    // Guarda referências para alterar tamanho/posição dos padrões no apply().
    this.pMinor = defs.querySelector('#gridMinor');
    this.pMajor = defs.querySelector('#gridMajor');
  }

  // Aplica a câmera atual: move/escala o desenho e ajusta a grade.
  apply() {
    const s = this.scale;
    // transform do SVG: primeiro desloca (translate), depois amplia (scale).
    // Deslocamos por -x*s para que o ponto (x,y) do mundo caia no canto da tela.
    this.world.setAttribute('transform', `translate(${-this.x * s},${-this.y * s}) scale(${s})`);
    // grade acompanha o deslocamento/zoom => sensação de quadro infinito
    const m = 20 * s, M = 100 * s;            // tamanho em tela da célula fina e da grossa
    const ox = -this.x * s, oy = -this.y * s; // deslocamento do ladrilho
    // Atualiza o ladrilho fino
    this.pMinor.setAttribute('width', m); this.pMinor.setAttribute('height', m);
    this.pMinor.querySelector('path').setAttribute('d', `M${m},0 H0 V${m}`);
    // Atualiza o ladrilho grosso (e seu deslocamento, para "andar" junto com o desenho)
    this.pMajor.setAttribute('width', M); this.pMajor.setAttribute('height', M);
    this.pMajor.setAttribute('x', ox); this.pMajor.setAttribute('y', oy);
    this.pMinor.setAttribute('x', 0); this.pMinor.setAttribute('y', 0);
    const r = this.pMajor.querySelector('rect'); r.setAttribute('width', M); r.setAttribute('height', M);
    this.pMajor.querySelector('path').setAttribute('d', `M${M},0 H0 V${M}`);
    // Com zoom muito pequeno a grade fina vira "ruído": escondemos.
    // Operador ternário: condição ? valorSeVerdadeiro : valorSeFalso
    this.pMinor.style.display = s < 0.45 ? 'none' : '';
    // Avisa os ouvintes (ex.: ShapeManager redesenha alças de seleção, Toolbar atualiza o "%").
    this.listeners.forEach((fn) => fn(this));
  }

  // Retângulo do <svg> na tela (posição e tamanho em pixels).
  rect() { return this.svg.getBoundingClientRect(); }

  // Converte uma posição de TELA (mouse) para coordenadas do MUNDO.
  toWorld(clientX, clientY) {
    const r = this.rect();
    return { x: (clientX - r.left) / this.scale + this.x, y: (clientY - r.top) / this.scale + this.y };
  }

  // Converte uma posição do MUNDO para a TELA (usado para posicionar o editor de texto).
  toScreen(wx, wy) {
    const r = this.rect();
    return { x: (wx - this.x) * this.scale + r.left, y: (wy - this.y) * this.scale + r.top };
  }

  // Move a câmera a partir de um deslocamento em pixels de tela.
  // Dividimos pelo zoom: com zoom 200%, arrastar 100px move só 50 unidades do mundo.
  panBy(dxScreen, dyScreen) {
    this.x -= dxScreen / this.scale;
    this.y -= dyScreen / this.scale;
    this.apply();
  }

  // Zoom mantendo FIXO o ponto sob o mouse (como no Visio/Google Maps).
  zoomAt(factor, clientX, clientY) {
    const before = this.toWorld(clientX, clientY); // ponto do mundo sob o cursor antes do zoom
    // Math.min/Math.max "prendem" o zoom entre os limites (clamp).
    this.scale = Math.min(this.max, Math.max(this.min, this.scale * factor));
    const r = this.rect();
    // Recalcula a origem para que o mesmo ponto do mundo continue sob o cursor.
    this.x = before.x - (clientX - r.left) / this.scale;
    this.y = before.y - (clientY - r.top) / this.scale;
    this.apply();
  }

  // Zoom tendo como referência o centro da área visível (botões +/-).
  zoomCenter(factor) {
    const r = this.rect();
    this.zoomAt(factor, r.left + r.width / 2, r.top + r.height / 2);
  }

  // Define um zoom absoluto (ex.: 1 = 100%) calculando o fator relativo.
  setScale(s) { this.zoomCenter(s / this.scale); }

  /** Enquadra uma área do mundo na tela (botão "Enquadrar", tecla F) */
  fit(b, pad = 60) {
    const r = this.rect();
    // Sem área (quadro vazio): centraliza o ponto (0,0) com zoom 100%.
    if (!b || b.w <= 0) { this.x = -r.width / 2; this.y = -r.height / 2; this.scale = 1; return this.apply(); }
    // Maior zoom que faz a área caber (com margem "pad"), limitado a 120%.
    this.scale = Math.min(1.2, Math.max(this.min, Math.min((r.width - pad * 2) / b.w, (r.height - pad * 2) / b.h)));
    // Posiciona a câmera para que o centro da área fique no centro da tela.
    this.x = b.x + b.w / 2 - r.width / 2 / this.scale;
    this.y = b.y + b.h / 2 - r.height / 2 / this.scale;
    this.apply();
  }

  // Centraliza a tela em um ponto do mundo, sem mudar o zoom (tecla C).
  centerOn(wx, wy) {
    const r = this.rect();
    this.x = wx - r.width / 2 / this.scale;
    this.y = wy - r.height / 2 / this.scale;
    this.apply();
  }

  // Retorna o ponto do mundo que está no centro da tela.
  visibleCenter() {
    const r = this.rect();
    return { x: this.x + r.width / 2 / this.scale, y: this.y + r.height / 2 / this.scale };
  }

  // Versão "salvável" da câmera (vai no JSON exportado).
  // toFixed(3) limita a 3 casas; o "+" na frente converte a string de volta em número.
  toJSON() { return { x: Math.round(this.x), y: Math.round(this.y), scale: +this.scale.toFixed(3) }; }

  // Restaura a câmera a partir de um objeto (com valores padrão se vierem inválidos).
  load(v) { if (!v) return; this.x = +v.x || 0; this.y = +v.y || 0; this.scale = Math.min(this.max, Math.max(this.min, +v.scale || 1)); this.apply(); }
};
