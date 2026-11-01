/* =========================================================================
   ShapeLibrary.js — CATÁLOGO DE FORMAS, COLEÇÕES, PONTAS DE LINHA E PALETA
   -------------------------------------------------------------------------
   PAPEL NA ARQUITETURA
   Este arquivo NÃO desenha nem manipula nada: ele só DESCREVE as formas.
   É um "dicionário" consultado pelos outros módulos:
     • ShapeManager     → pega o contorno (path) para desenhar cada forma
     • ConnectionRouter → pega as portas (pontos onde as linhas se ligam)
     • Toolbar          → pega o ícone de cada forma e as COLEÇÕES da barra
   Para criar uma forma nova, basta adicionar uma entrada em "types" e
   incluir o nome dela na coleção desejada ("collections"). Nenhum outro
   arquivo precisa mudar.

   COLEÇÕES
   A barra mostra uma coleção por vez (Fluxograma, UML, Caso de uso, Banco
   de dados, Arquitetura). A coleção só muda a BARRA: um diagrama pode
   misturar formas de várias coleções. As teclas 1..9 seguem a coleção ativa.

   SVG PATH EM 30 SEGUNDOS (a "linguagem" dos contornos abaixo)
     M x,y  → move a caneta até (x,y) sem desenhar
     L x,y  → linha reta até (x,y)
     H x    → linha horizontal até x      V y → linha vertical até y
     A rx,ry rot arcoGrande sentido x,y → arco (cantos arredondados, círculos)
     C x1,y1 x2,y2 x,y → curva de Bézier (a "onda" do Documento)
     Z      → fecha o contorno
   O ponto (0,0) é o canto superior esquerdo da forma; (w,h) o inferior direito.

   CONCEITO DE JAVASCRIPT: IIFE
   "(function () { ... })()" é uma função que se executa imediatamente.
   Tudo que é declarado dentro dela (rr, midPorts, types) fica "privado";
   só o objeto do "return" é exposto como PM.ShapeLibrary.
   ========================================================================= */

// "window" é o objeto global do navegador. PM ("ProcessMap") é o NAMESPACE
// onde todas as classes do sistema ficam (PM.History, PM.Viewport...).
// "||" = se window.PM já existir, reaproveita; senão, cria um objeto vazio.
window.PM = window.PM || {};

PM.ShapeLibrary = (function () {
  // ---------- funções auxiliares privadas ----------

  // Gera o path de um retângulo com cantos arredondados de raio r.
  // "=>" é uma arrow function (função curta) que retorna a template string.
  const rr = (w, h, r) => {
    r = Math.min(r, w / 2, h / 2); // o raio nunca pode passar da metade do lado
    // Sequência: topo → canto sup. dir. → lado dir. → canto inf. dir. → base → ... → fecha
    return `M${r},0 H${w - r} A${r},${r} 0 0 1 ${w},${r} V${h - r} A${r},${r} 0 0 1 ${w - r},${h} H${r} A${r},${r} 0 0 1 0,${h - r} V${r} A${r},${r} 0 0 1 ${r},0 Z`;
  };
  // Elipse que ocupa a caixa inteira (dois arcos de 180°).
  const ellipse = (w, h) => `M0,${h / 2} A${w / 2},${h / 2} 0 1 1 ${w},${h / 2} A${w / 2},${h / 2} 0 1 1 0,${h / 2} Z`;
  // Círculo pequeno de raio r centrado em (cx, cy) — usado em decorações.
  const dot = (cx, cy, r) => `M${cx - r},${cy} A${r},${r} 0 1 0 ${cx + r},${cy} A${r},${r} 0 1 0 ${cx - r},${cy} Z`;

  // Portas padrão: o ponto central de cada lado da forma.
  // Cada porta é um array [x, y] em coordenadas locais (relativas à forma).
  const midPorts = (w, h) => ({ top: [w / 2, 0], right: [w, h / 2], bottom: [w / 2, h], left: [0, h / 2] });

  // Quantas linhas de texto (usado para a altura automática).
  const lines = (t) => String(t ?? '').split('\n');
  // Seções da classe UML: separadas por uma linha só com "--" (ou mais traços).
  const sections = (t) => {
    const out = [[]];
    lines(t).forEach((l) => { if (/^\s*-{2,}\s*$/.test(l)) out.push([]); else out[out.length - 1].push(l); });
    return out;
  };


  // ---------- ajudantes das formas técnicas (Lisa_Proof, 31/10/2026) ----------
  // Um anel dentro do círculo da forma, a `d` da borda (o contorno duplo dos eventos BPMN).
  const anel = (w, h, d) => `M${d},${h / 2} A${w / 2 - d},${h / 2 - d} 0 1 1 ${w - d},${h / 2} A${w / 2 - d},${h / 2 - d} 0 1 1 ${d},${h / 2} Z`;
  // O losango que ocupa a caixa (os gateways BPMN).
  const losango = (w, h) => `M${w / 2},0 L${w},${h / 2} L${w / 2},${h} L0,${h / 2} Z`;
  // Uma engrenagem simples: o círculo e oito dentes.
  const engrenagem = (cx, cy, r) => {
    let d = dot(cx, cy, r);
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a);
      d += ` M${cx + c * r},${cy + s * r} L${cx + c * (r + 3.5)},${cy + s * (r + 3.5)}`;
    }
    return `${d} ${dot(cx, cy, r * 0.35)}`;
  };
  // Os ícones dos cartões de nuvem e infraestrutura: cada um desenha numa caixa de 28×28 a partir de (x, y).
  const icones = {
    balanceador: (x, y) => `${dot(x + 8, y + 14, 5)} M${x + 13},${y + 14} L${x + 26},${y + 4} M${x + 13},${y + 14} H${x + 26} M${x + 13},${y + 14} L${x + 26},${y + 24}`,
    gateway: (x, y) => `M${x + 4},${y + 26} V${y + 12} A10,10 0 0 1 ${x + 24},${y + 12} V${y + 26} M${x + 9},${y + 26} V${y + 14} A5,5 0 0 1 ${x + 19},${y + 14} V${y + 26} M${x + 2},${y + 26} H${x + 26}`,
    cache: (x, y) => `M${x + 17},${y + 2} L${x + 6},${y + 16} H${x + 14} L${x + 11},${y + 26} L${x + 23},${y + 11} H${x + 15} Z`,
    globo: (x, y) => `${dot(x + 14, y + 14, 11)} M${x + 3},${y + 14} H${x + 25} M${x + 14},${y + 3} A6,11 0 0 1 ${x + 14},${y + 25} A6,11 0 0 1 ${x + 14},${y + 3}`,
    dns: (x, y) => `${dot(x + 14, y + 12, 9)} M${x + 5},${y + 12} H${x + 23} M${x + 14},${y + 3} A5,9 0 0 1 ${x + 14},${y + 21} A5,9 0 0 1 ${x + 14},${y + 3} M${x + 6},${y + 26} H${x + 22}`,
    conteiner: (x, y) => `M${x + 2},${y + 14} h8 v8 h-8 Z M${x + 10},${y + 14} h8 v8 h-8 Z M${x + 18},${y + 14} h8 v8 h-8 Z M${x + 6},${y + 6} h8 v8 h-8 Z M${x + 14},${y + 6} h8 v8 h-8 Z`,
    lambda: (x, y) => `M${x + 6},${y + 4} H${x + 11} L${x + 23},${y + 26} M${x + 15},${y + 12} L${x + 6},${y + 26}`,
    balde: (x, y) => `M${x + 4},${y + 8} L${x + 7},${y + 26} H${x + 21} L${x + 24},${y + 8} M${x + 4},${y + 8} A10,3.5 0 0 0 ${x + 24},${y + 8} A10,3.5 0 0 0 ${x + 4},${y + 8}`,
    topico: (x, y) => `M${x + 2},${y + 7} H${x + 24} M${x + 20},${y + 3} L${x + 24},${y + 7} L${x + 20},${y + 11} M${x + 2},${y + 14} H${x + 24} M${x + 20},${y + 10} L${x + 24},${y + 14} L${x + 20},${y + 18} M${x + 2},${y + 21} H${x + 24} M${x + 20},${y + 17} L${x + 24},${y + 21} L${x + 20},${y + 25}`,
    monitor: (x, y) => `M${x + 2},${y + 4} H${x + 26} V${y + 21} H${x + 2} Z M${x + 10},${y + 26} H${x + 18} M${x + 5},${y + 13} H${x + 9} L${x + 12},${y + 7} L${x + 16},${y + 18} L${x + 19},${y + 11} H${x + 23}`,
    muro: (x, y) => `M${x + 2},${y + 4} H${x + 26} V${y + 25} H${x + 2} Z M${x + 2},${y + 11} H${x + 26} M${x + 2},${y + 18} H${x + 26} M${x + 14},${y + 4} V${y + 11} M${x + 8},${y + 11} V${y + 18} M${x + 20},${y + 11} V${y + 18} M${x + 14},${y + 18} V${y + 25}`,
    pessoas: (x, y) => `${dot(x + 10, y + 9, 4)} M${x + 3},${y + 22} A7,7 0 0 1 ${x + 17},${y + 22} ${dot(x + 20, y + 11, 3.5)} M${x + 16},${y + 17} A6,6 0 0 1 ${x + 26},${y + 22}`,
    armazem: (x, y) => `M${x + 4},${y + 6} A10,3 0 0 1 ${x + 24},${y + 6} A10,3 0 0 1 ${x + 4},${y + 6} V${y + 22} A10,3 0 0 0 ${x + 24},${y + 22} V${y + 6} M${x + 4},${y + 12} A10,3 0 0 0 ${x + 24},${y + 12} M${x + 4},${y + 17} A10,3 0 0 0 ${x + 24},${y + 17}`,
    lago: (x, y) => `M${x + 2},${y + 10} Q${x + 6},${y + 6} ${x + 10},${y + 10} T${x + 18},${y + 10} T${x + 26},${y + 10} M${x + 2},${y + 16} Q${x + 6},${y + 12} ${x + 10},${y + 16} T${x + 18},${y + 16} T${x + 26},${y + 16} M${x + 2},${y + 22} Q${x + 6},${y + 18} ${x + 10},${y + 22} T${x + 18},${y + 22} T${x + 26},${y + 22}`,
    pipeline: (x, y) => `M${x + 1},${y + 10} h7 v8 h-7 Z M${x + 10.5},${y + 10} h7 v8 h-7 Z M${x + 20},${y + 10} h7 v8 h-7 Z M${x + 8},${y + 14} h2.5 M${x + 17.5},${y + 14} h2.5`,
    rede: (x, y) => `${dot(x + 5, y + 7, 2.5)} ${dot(x + 5, y + 21, 2.5)} ${dot(x + 14, y + 4, 2.5)} ${dot(x + 14, y + 14, 2.5)} ${dot(x + 14, y + 24, 2.5)} ${dot(x + 23, y + 14, 2.5)} M${x + 7},${y + 7} L${x + 12},${y + 4} M${x + 7},${y + 7} L${x + 12},${y + 14} M${x + 7},${y + 21} L${x + 12},${y + 14} M${x + 7},${y + 21} L${x + 12},${y + 24} M${x + 16},${y + 4} L${x + 21},${y + 14} M${x + 16},${y + 14} H${x + 21} M${x + 16},${y + 24} L${x + 21},${y + 14}`,
    git: (x, y) => `${dot(x + 8, y + 5, 3)} ${dot(x + 8, y + 23, 3)} ${dot(x + 20, y + 11, 3)} M${x + 8},${y + 8} V${y + 20} M${x + 20},${y + 14} Q${x + 20},${y + 20} ${x + 10},${y + 21}`,
    ciclo: (x, y) => `M${x + 4},${y + 14} A10,10 0 0 1 ${x + 22},${y + 8} M${x + 22},${y + 3} V${y + 8} H${x + 17} M${x + 24},${y + 14} A10,10 0 0 1 ${x + 6},${y + 20} M${x + 6},${y + 25} V${y + 20} H${x + 11}`,
    chip: (x, y) => `M${x + 7},${y + 7} H${x + 21} V${y + 21} H${x + 7} Z M${x + 11},${y + 11} H${x + 17} V${y + 17} H${x + 11} Z M${x + 11},${y + 3} V${y + 7} M${x + 17},${y + 3} V${y + 7} M${x + 11},${y + 21} V${y + 25} M${x + 17},${y + 21} V${y + 25} M${x + 3},${y + 11} H${x + 7} M${x + 3},${y + 17} H${x + 7} M${x + 21},${y + 11} H${x + 25} M${x + 21},${y + 17} H${x + 25}`,
  };
  // O cartão técnico: retângulo arredondado com o ícone à esquerda e o nome ao lado; o ícone da
  // barra é o próprio desenho do ícone.
  const cartaoComIcone = (label, text, icone, extra = {}) => ({
    label, w: 170, h: 64, text, minW: 110, minH: 46,
    path: (w, h) => rr(w, h, 10),
    deco: (w, h) => icone(8, h / 2 - 14),
    textBox: (w, h) => ({ x: 40, y: 0, w: w - 46, h }),
    icon: () => `<path d="${icone(6, 1)}" fill="${extra.decoFill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    ...extra,
  });

  // ---------- definição de cada tipo de forma ----------
  // Campos possíveis:
  //   label       nome exibido na dica da barra e no painel
  //   w, h        tamanho padrão ao criar
  //   text        texto inicial
  //   color       cor inicial (id da paleta)
  //   path(w,h)   função que devolve o contorno SVG para aquele tamanho
  //   deco(w,h)   (opcional) traços extras de decoração (ex.: barras do subprocesso)
  //   decoFill    (opcional) a decoração é preenchida (ex.: o miolo do nó final UML)
  //   ports(w,h)  (opcional) portas personalizadas, quando o centro do lado não serve
  //   textPad     (opcional) margem interna proporcional (o losango precisa de mais)
  //   textBox(w,h)(opcional) área do texto {x,y,w,h} — pode sair da forma (o nome do ator)
  //   transparent (opcional) forma sem preenchimento (anotação, ator)
  //   inkStroke   (opcional) o traço usa a cor do texto do tema, e não a da paleta
  //   dashed      (opcional) contorno tracejado (view, sistema externo)
  //   hit(w,h)    (opcional) área clicável invisível, usada quando a forma é vazada
  //   align       (opcional) alinhamento do texto ('left')
  //   noText      (opcional) forma sem texto (nó inicial, barra de fork/join)
  //   container   (opcional) agrupador: fica atrás, arrasta o conteúdo junto e o
  //               interior vazio deixa o clique passar (raia, limite do sistema)
  //   header(w,h) (opcional) faixa preenchida do agrupador (onde fica o título)
  //   render      (opcional) desenho estruturado: 'table' | 'class' | 'code'
  //   autoHeight  (opcional) a altura sai do conteúdo (não do arraste)
  //   multiline   (opcional) Enter quebra linha no editor (Ctrl+Enter confirma)
  //   editOnCreate(opcional) abre o editor de texto assim que a forma nasce
  //   minW, minH  (opcional) tamanho mínimo ao redimensionar
  //   noColor     (opcional) sem amostras de cor no painel (o bloco de código)
  //   icon(...)   (opcional) desenho próprio do ícone na barra
  //   image       (opcional) forma que exibe uma imagem colada (ImagePaste.js)
  //   mind        (opcional) nó do mapa mental (MindMap.js)
  //   rotText     (opcional) o título do agrupador fica de lado (raia horizontal)
  //   noBorder    (opcional) forma vazada sem contorno (a caixa de texto livre)
  //   top, padL   (opcional) texto alinhado no topo / margem esquerda do texto
  //   textAuto    (opcional) a altura mínima sai das linhas do texto (caixa de texto)
  //   ink         (opcional) traço livre (desenho à mão): pontos em "pts"
  //   noPorts     (opcional) sem portas de conexão
  const types = {
    /* ======================= FLUXOGRAMA ======================= */
    // Início/Fim: "pílula" (raio = metade da altura)
    terminal: {
      label: 'Início / Fim', w: 140, h: 50, text: 'Início', color: 'deep',
      path: (w, h) => rr(w, h, h / 2),
    },
    // Processo: retângulo com cantos levemente arredondados (como na logo)
    process: {
      label: 'Processo', w: 160, h: 70, text: 'Processo',
      path: (w, h) => rr(w, h, 10),
    },
    // Decisão: losango ligando os pontos médios de cada lado
    decision: {
      label: 'Decisão', w: 180, h: 110, text: 'Decisão?', color: 'lilac',
      path: (w, h) => `M${w / 2},0 L${w},${h / 2} L${w / 2},${h} L0,${h / 2} Z`,
      textPad: 0.17, // o texto usa só a área central, para não "vazar" do losango
    },
    // Entrada/Saída de dados: paralelogramo (inclinação s)
    data: {
      label: 'Entrada / Saída', w: 160, h: 70, text: 'Dados',
      path: (w, h) => { const s = Math.min(22, w * 0.2); return `M${s},0 L${w},0 L${w - s},${h} L0,${h} Z`; },
      // as portas laterais ficam no meio da borda inclinada, e não na quina
      ports: (w, h) => { const s = Math.min(22, w * 0.2); return { top: [w / 2, 0], right: [w - s / 2, h / 2], bottom: [w / 2, h], left: [s / 2, h / 2] }; },
    },
    // Documento: base em "onda"
    document: {
      label: 'Documento', w: 160, h: 80, text: 'Documento',
      path: (w, h) => {
        const v = h * 0.13; // altura da onda proporcional à forma
        // C = curva de Bézier com 2 pontos de controle, formando a onda
        return `M0,0 H${w} V${h - v * 1.6} C${w * 0.62},${h - v * 2} ${w * 0.42},${h + v * 0.35} 0,${h - v * 0.4} Z`;
      },
      // porta de baixo sobe um pouco para encostar na onda
      ports: (w, h) => ({ top: [w / 2, 0], right: [w, h / 2], bottom: [w / 2, h - h * 0.1], left: [0, h / 2] }),
    },
    // Subprocesso: retângulo com duas barras verticais internas
    subprocess: {
      label: 'Subprocesso', w: 160, h: 70, text: 'Subprocesso',
      path: (w, h) => rr(w, h, 6),
      deco: (w, h) => `M12,0 V${h} M${w - 12},0 V${h}`,
    },
    // Banco de dados / Sistema: cilindro (dois arcos elípticos)
    database: {
      label: 'Banco de dados / Sistema', w: 120, h: 90, text: 'Sistema', color: 'graphite',
      path: (w, h) => { const e = Math.min(14, h * 0.16); return `M0,${e} A${w / 2},${e} 0 0 1 ${w},${e} V${h - e} A${w / 2},${e} 0 0 1 0,${h - e} Z`; },
      // arco inferior da "tampa" do cilindro
      deco: (w, h) => { const e = Math.min(14, h * 0.16); return `M0,${e} A${w / 2},${e} 0 0 0 ${w},${e}`; },
      textBox: (w, h) => { const e = Math.min(14, h * 0.16); return { x: 0, y: e * 2, w, h: h - e * 3 }; },
    },
    // Espera: lado direito em semicírculo
    delay: {
      label: 'Espera', w: 130, h: 70, text: 'Espera',
      path: (w, h) => { const r = Math.min(h / 2, w / 2); return `M0,0 H${w - r} A${r},${r} 0 0 1 ${w - r},${h} H0 Z`; },
    },
    // Operação manual: trapézio invertido
    manual: {
      label: 'Operação manual', w: 160, h: 70, text: 'Manual',
      path: (w, h) => { const s = Math.min(22, w * 0.15); return `M0,0 H${w} L${w - s},${h} H${s} Z`; },
    },
    // Conector: círculo (dois arcos de 180°)
    connector: {
      label: 'Conector', w: 56, h: 56, text: 'A', minW: 24, minH: 24,
      path: ellipse,
    },
    // Anotação: apenas um colchete "[" à esquerda, sem fundo.
    // editOnCreate: nasce com o editor aberto DENTRO da caixa, para digitar ali mesmo.
    note: {
      label: 'Anotação', w: 170, h: 60, text: 'Anotação', transparent: true, color: 'graphite',
      path: (w, h) => `M16,0 H0 V${h} H16`,
      hit: (w, h) => `M0,0 H${w} V${h} H0 Z`, // retângulo invisível para poder clicar no texto
      align: 'left', multiline: true, editOnCreate: true,
    },

    /* ======================= UML (atividades e classes) ======================= */
    umlInitial: {
      label: 'Nó inicial', w: 34, h: 34, text: '', color: 'deep', noText: true, minW: 16, minH: 16,
      path: ellipse,
    },
    umlFinal: {
      label: 'Nó final', w: 38, h: 38, text: '', color: 'lilac', noText: true, minW: 18, minH: 18,
      path: ellipse,
      deco: (w, h) => { const r = Math.min(w, h) * 0.3; return dot(w / 2, h / 2, r); },
      decoFill: true,
    },
    umlAction: {
      label: 'Ação', w: 160, h: 60, text: 'Ação',
      path: (w, h) => rr(w, h, Math.min(18, h / 2)),
    },
    umlDecision: {
      label: 'Decisão / junção (UML)', w: 64, h: 64, text: '', color: 'lilac', minW: 24, minH: 24,
      path: (w, h) => `M${w / 2},0 L${w},${h / 2} L${w / 2},${h} L0,${h / 2} Z`,
      textPad: 0.2,
    },
    // Barra de fork/join: um retângulo fino. Vertical? Redimensione (mínimo 6px).
    umlBar: {
      label: 'Barra fork / join', w: 160, h: 10, text: '', color: 'deep', noText: true, minW: 6, minH: 6,
      path: (w, h) => rr(w, h, 2),
    },
    umlObject: {
      label: 'Objeto', w: 150, h: 56, text: 'objeto : Classe',
      path: (w, h) => `M0,0 H${w} V${h} H0 Z`,
    },
    umlSend: {
      label: 'Enviar sinal', w: 160, h: 56, text: 'Enviar sinal',
      path: (w, h) => { const s = Math.min(24, w * 0.18); return `M0,0 H${w - s} L${w},${h / 2} L${w - s},${h} H0 Z`; },
    },
    umlAccept: {
      label: 'Receber evento', w: 160, h: 56, text: 'Receber evento',
      path: (w, h) => { const s = Math.min(24, w * 0.18); return `M0,0 H${w} V${h} H0 L${s},${h / 2} Z`; },
      textBox: (w, h) => ({ x: Math.min(24, w * 0.18), y: 0, w: w - Math.min(24, w * 0.18), h }),
    },
    // Raia (partição): agrupador com o nome na faixa de cima.
    umlSwimlane: {
      label: 'Raia (partição)', w: 340, h: 440, text: 'Raia', color: 'graphite', container: true, minW: 120, minH: 120,
      path: (w, h) => `M0,0 H${w} V${h} H0 Z`,
      header: (w) => `M0,0 H${w} V34 H0 Z`,
      textBox: (w) => ({ x: 0, y: 0, w, h: 34 }),
    },
    umlNote: {
      label: 'Nota UML', w: 170, h: 70, text: 'Nota', color: 'white', align: 'left', multiline: true, editOnCreate: true,
      path: (w, h) => { const f = Math.min(16, w * 0.2, h * 0.3); return `M0,0 H${w - f} L${w},${f} V${h} H0 Z`; },
      deco: (w, h) => { const f = Math.min(16, w * 0.2, h * 0.3); return `M${w - f},0 V${f} H${w}`; },
    },
    // Classe: 1ª seção = nome (uma linha «estereótipo» antes, opcional);
    // depois "--" separa atributos de métodos.
    umlClass: {
      label: 'Classe', w: 220, h: 120, color: 'white', render: 'class', autoHeight: true, multiline: true, editOnCreate: true, minW: 100,
      text: 'NomeDaClasse\n--\n- id: int\n- nome: String\n--\n+ salvar(): void',
      path: (w, h) => `M0,0 H${w} V${h} H0 Z`,
      icon: () => '<rect x="4" y="2" width="32" height="26" rx="2" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="2"/><path d="M4 10H36M4 19H36" stroke="currentColor" stroke-width="2"/>',
    },
    umlInterface: {
      label: 'Interface', w: 220, h: 90, color: 'lilac', render: 'class', autoHeight: true, multiline: true, editOnCreate: true, minW: 100,
      text: '«interface»\nNomeDaInterface\n--\n+ executar(): void',
      path: (w, h) => `M0,0 H${w} V${h} H0 Z`,
      icon: () => '<rect x="4" y="2" width="32" height="26" rx="2" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/><path d="M4 12H36" stroke="currentColor" stroke-width="2"/><text x="20" y="9" font-size="7" text-anchor="middle" fill="currentColor">«i»</text>',
    },
    umlPackage: {
      label: 'Pacote', w: 300, h: 220, text: 'pacote', color: 'graphite', container: true, minW: 120, minH: 80,
      path: (w, h) => { const t = Math.min(110, w * 0.45); return `M0,0 H${t} L${t + 10},22 H${w} V${h} H0 Z`; },
      header: (w) => { const t = Math.min(110, w * 0.45); return `M0,0 H${t} L${t + 10},22 H0 Z`; },
      textBox: (w) => ({ x: 6, y: 0, w: Math.min(110, w * 0.45) - 6, h: 22 }),
    },

    /* ======================= CASO DE USO ======================= */
    // Ator: boneco de palito; o nome fica embaixo e pode ser mais largo que ele.
    ucActor: {
      label: 'Ator / usuário', w: 60, h: 110, text: 'Ator', transparent: true, inkStroke: true, minW: 30, minH: 60,
      path: (w, h) => {
        const r = Math.min(w * 0.18, h * 0.1), cx = w / 2, hy = r + 2; // cabeça
        const neck = hy + r, hip = h * 0.52, arm = h * 0.3, foot = h * 0.76;
        return `${dot(cx, hy, r)} M${cx},${neck} V${hip} M${w * 0.1},${arm} H${w * 0.9} M${cx},${hip} L${w * 0.15},${foot} M${cx},${hip} L${w * 0.85},${foot}`;
      },
      hit: (w, h) => `M0,0 H${w} V${h} H0 Z`,
      textBox: (w, h) => ({ x: -40, y: h * 0.78, w: w + 80, h: h * 0.22 + 4 }),
      ports: (w, h) => ({ top: [w / 2, 0], right: [w * 0.9, h * 0.3], bottom: [w / 2, h * 0.78], left: [w * 0.1, h * 0.3] }),
      icon: () => '<circle cx="20" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 10V20M12 14H28M20 20L14 28M20 20L26 28" stroke="currentColor" stroke-width="2" fill="none"/>',
    },
    ucCase: {
      label: 'Caso de uso', w: 180, h: 80, text: 'Caso de uso', color: 'lilac',
      path: ellipse,
      textPad: 0.12,
    },
    ucSystem: {
      label: 'Limite do sistema', w: 420, h: 380, text: 'Sistema', color: 'graphite', container: true, minW: 160, minH: 120,
      path: (w, h) => rr(w, h, 8),
      textBox: (w) => ({ x: 0, y: 4, w, h: 30 }),
    },

    /* ======================= BANCO DE DADOS ======================= */
    // Tabela: 1ª linha = nome; cada linha seguinte = uma coluna.
    // "PK", "FK", "UQ", "IX", "NN" no início viram selos; "nome: tipo" separa o tipo.
    dbTable: {
      label: 'Tabela', w: 240, h: 120, render: 'table', autoHeight: true, multiline: true, editOnCreate: true, minW: 120,
      text: 'CLIENTE\nPK id: int\nnome: varchar(120)\nUQ email: varchar(200)\nFK id_cidade: int',
      path: (w, h) => rr(w, h, 6),
      icon: () => '<rect x="4" y="2" width="32" height="26" rx="2" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="2"/><path d="M4 9H36" stroke="currentColor" stroke-width="3"/><path d="M4 16H36M4 22H36" stroke="currentColor" stroke-width="1.2"/>',
    },
    dbView: {
      label: 'View', w: 240, h: 100, render: 'table', autoHeight: true, multiline: true, editOnCreate: true, dashed: true, color: 'lilac', minW: 120,
      text: 'VW_CLIENTES_ATIVOS\nid: int\nnome: varchar(120)',
      path: (w, h) => rr(w, h, 6),
      icon: () => '<rect x="4" y="2" width="32" height="26" rx="2" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/><path d="M4 9H36" stroke="currentColor" stroke-width="3"/><path d="M4 16H36M4 22H36" stroke="currentColor" stroke-width="1.2"/>',
    },
    dbSchema: {
      label: 'Esquema (agrupador)', w: 520, h: 360, text: 'dbo', color: 'graphite', container: true, dashed: true, minW: 160, minH: 120,
      path: (w, h) => rr(w, h, 8),
      header: (w) => `M8,0 H${w - 8} A8,8 0 0 1 ${w},8 V30 H0 V8 A8,8 0 0 1 8,0 Z`,
      textBox: (w) => ({ x: 0, y: 0, w, h: 30 }),
    },

    /* ======================= ARQUITETURA DE SOFTWARE ======================= */
    archBrowser: {
      label: 'Aplicação web / navegador', w: 170, h: 110, text: 'Aplicação web',
      path: (w, h) => rr(w, h, 8),
      deco: (w) => `M0,22 H${w} ${dot(12, 11, 3)} ${dot(23, 11, 3)} ${dot(34, 11, 3)}`,
      textBox: (w, h) => ({ x: 0, y: 22, w, h: h - 22 }),
    },
    archMobile: {
      label: 'Aplicativo mobile', w: 76, h: 124, text: 'App', minW: 50, minH: 80,
      path: (w, h) => rr(w, h, 12),
      deco: (w, h) => `M${w * 0.36},10 H${w * 0.64} ${dot(w / 2, h - 12, 4.5)}`,
      textBox: (w, h) => ({ x: 4, y: 20, w: w - 8, h: h - 42 }),
    },
    archService: {
      label: 'Serviço / API', w: 170, h: 74, text: 'Serviço',
      path: (w, h) => { const s = Math.min(22, w * 0.16); return `M${s},0 H${w - s} L${w},${h / 2} L${w - s},${h} H${s} L0,${h / 2} Z`; },
      textPad: 0.08,
    },
    archComponent: {
      label: 'Componente', w: 170, h: 74, text: 'Componente',
      path: (w, h) => rr(w, h, 6),
      deco: (w) => `M${w - 30},9 h20 v16 h-20 Z M${w - 35},12 h10 v4 h-10 Z M${w - 35},19 h10 v4 h-10 Z`,
      textBox: (w, h) => ({ x: 0, y: 0, w: w - 34, h }),
    },
    archQueue: {
      label: 'Fila / mensageria', w: 180, h: 58, text: 'Fila',
      path: (w, h) => { const e = Math.min(16, w * 0.12); return `M${e},0 H${w - e} A${e},${h / 2} 0 0 1 ${w - e},${h} H${e} A${e},${h / 2} 0 0 1 ${e},0 Z`; },
      deco: (w, h) => { const e = Math.min(16, w * 0.12); return `M${w - e},0 A${e},${h / 2} 0 0 0 ${w - e},${h}`; },
      textBox: (w, h) => { const e = Math.min(16, w * 0.12); return { x: e, y: 0, w: w - e * 3, h }; },
    },
    archServer: {
      label: 'Servidor', w: 120, h: 120, text: 'Servidor', color: 'graphite',
      path: (w, h) => rr(w, h, 6),
      deco: (w, h) => `M0,${h * 0.2} H${w} M0,${h * 0.4} H${w} ${dot(w - 14, h * 0.1, 3)} ${dot(w - 14, h * 0.3, 3)}`,
      textBox: (w, h) => ({ x: 0, y: h * 0.4, w, h: h * 0.6 }),
    },
    archCloud: {
      label: 'Nuvem / serviço externo', w: 180, h: 110, text: 'Nuvem', color: 'lilac',
      path: (w, h) => `M${w * 0.26},${h * 0.9} A${w * 0.16},${h * 0.2} 0 0 1 ${w * 0.1},${h * 0.52} A${w * 0.18},${h * 0.22} 0 0 1 ${w * 0.34},${h * 0.24} A${w * 0.22},${h * 0.26} 0 0 1 ${w * 0.76},${h * 0.26} A${w * 0.16},${h * 0.22} 0 0 1 ${w * 0.9},${h * 0.62} A${w * 0.14},${h * 0.18} 0 0 1 ${w * 0.76},${h * 0.9} Z`,
      ports: (w, h) => ({ top: [w / 2, h * 0.14], right: [w * 0.93, h * 0.6], bottom: [w / 2, h * 0.9], left: [w * 0.08, h * 0.6] }),
      textBox: (w, h) => ({ x: w * 0.16, y: h * 0.32, w: w * 0.68, h: h * 0.5 }),
    },
    archExternal: {
      label: 'Sistema externo', w: 170, h: 74, text: 'Sistema externo', color: 'graphite', dashed: true,
      path: (w, h) => rr(w, h, 6),
    },
    archBoundary: {
      label: 'Fronteira / contêiner', w: 460, h: 320, text: 'Contêiner', color: 'graphite', container: true, dashed: true, minW: 160, minH: 100,
      path: (w, h) => rr(w, h, 10),
      textBox: (w) => ({ x: 12, y: 4, w: w - 24, h: 28 }),
      align: 'left',
    },

    /* ======================= BPMN (Lisa_Proof, 31/10/2026) ======================= */
    // Eventos e gateways como no BPMN: contorno na cor do tema, o nome embaixo.
    bpmnStart: {
      label: 'Evento de início', w: 46, h: 46, text: 'Início', transparent: true, inkStroke: true, minW: 24, minH: 24,
      path: ellipse, hit: ellipse,
      textBox: (w, h) => ({ x: -50, y: h + 2, w: w + 100, h: 30 }),
    },
    bpmnIntermediate: {
      label: 'Evento intermediário', w: 46, h: 46, text: 'Evento', transparent: true, inkStroke: true, minW: 24, minH: 24,
      path: ellipse, hit: ellipse,
      deco: (w, h) => anel(w, h, 4),
      textBox: (w, h) => ({ x: -50, y: h + 2, w: w + 100, h: 30 }),
    },
    bpmnTimer: {
      label: 'Evento de tempo (timer)', w: 46, h: 46, text: 'Esperar', transparent: true, inkStroke: true, minW: 24, minH: 24,
      path: ellipse, hit: ellipse,
      deco: (w, h) => `${anel(w, h, 4)} ${anel(w, h, w * 0.22)} M${w / 2},${h * 0.3} V${h / 2} L${w * 0.64},${h * 0.58}`,
      textBox: (w, h) => ({ x: -50, y: h + 2, w: w + 100, h: 30 }),
    },
    bpmnMessageEvent: {
      label: 'Evento de mensagem', w: 46, h: 46, text: 'Mensagem', transparent: true, inkStroke: true, minW: 24, minH: 24,
      path: ellipse, hit: ellipse,
      deco: (w, h) => `${anel(w, h, 4)} M${w * 0.27},${h * 0.34} H${w * 0.73} V${h * 0.66} H${w * 0.27} Z M${w * 0.27},${h * 0.34} L${w / 2},${h * 0.52} L${w * 0.73},${h * 0.34}`,
      textBox: (w, h) => ({ x: -50, y: h + 2, w: w + 100, h: 30 }),
    },
    bpmnEnd: {
      label: 'Evento de fim', w: 46, h: 46, text: 'Fim', transparent: true, inkStroke: true, minW: 24, minH: 24,
      path: ellipse, hit: ellipse,
      deco: (w, h) => `${anel(w, h, 1.5)} ${anel(w, h, 3)}`,
      textBox: (w, h) => ({ x: -50, y: h + 2, w: w + 100, h: 30 }),
    },
    bpmnTask: {
      label: 'Tarefa', w: 150, h: 70, text: 'Tarefa',
      path: (w, h) => rr(w, h, 12),
    },
    bpmnUserTask: {
      label: 'Tarefa de usuário', w: 150, h: 70, text: 'Tarefa de usuário',
      path: (w, h) => rr(w, h, 12),
      deco: () => `${dot(16, 13, 4.5)} M8,27 A8,7 0 0 1 24,27`,
      textBox: (w, h) => ({ x: 0, y: 8, w, h: h - 8 }),
    },
    bpmnServiceTask: {
      label: 'Tarefa de serviço (automática)', w: 150, h: 70, text: 'Tarefa de serviço',
      path: (w, h) => rr(w, h, 12),
      deco: () => engrenagem(16, 16, 6),
      textBox: (w, h) => ({ x: 0, y: 8, w, h: h - 8 }),
    },
    bpmnSubprocess: {
      label: 'Subprocesso (BPMN)', w: 160, h: 76, text: 'Subprocesso',
      path: (w, h) => rr(w, h, 12),
      deco: (w, h) => `M${w / 2 - 7},${h - 17} h14 v14 h-14 Z M${w / 2},${h - 14} v8 M${w / 2 - 4},${h - 10} h8`,
      textBox: (w, h) => ({ x: 0, y: 0, w, h: h - 16 }),
    },
    bpmnGatewayX: {
      label: 'Gateway exclusivo (XOR)', w: 56, h: 56, text: '', transparent: true, inkStroke: true, minW: 30, minH: 30,
      path: losango, hit: losango,
      deco: (w, h) => `M${w * 0.36},${h * 0.36} L${w * 0.64},${h * 0.64} M${w * 0.64},${h * 0.36} L${w * 0.36},${h * 0.64}`,
      textBox: (w, h) => ({ x: -55, y: h + 2, w: w + 110, h: 30 }),
    },
    bpmnGatewayParallel: {
      label: 'Gateway paralelo (AND)', w: 56, h: 56, text: '', transparent: true, inkStroke: true, minW: 30, minH: 30,
      path: losango, hit: losango,
      deco: (w, h) => `M${w / 2},${h * 0.3} V${h * 0.7} M${w * 0.3},${h / 2} H${w * 0.7}`,
      textBox: (w, h) => ({ x: -55, y: h + 2, w: w + 110, h: 30 }),
    },
    bpmnGatewayInclusive: {
      label: 'Gateway inclusivo (OR)', w: 56, h: 56, text: '', transparent: true, inkStroke: true, minW: 30, minH: 30,
      path: losango, hit: losango,
      deco: (w, h) => anel(w, h, w * 0.3),
      textBox: (w, h) => ({ x: -55, y: h + 2, w: w + 110, h: 30 }),
    },
    bpmnDataObject: {
      label: 'Objeto de dados', w: 50, h: 64, text: 'Dados', transparent: true, inkStroke: true, minW: 30, minH: 36,
      path: (w, h) => { const d = Math.min(14, w * 0.3); return `M0,0 H${w - d} L${w},${d} V${h} H0 Z`; },
      hit: (w, h) => `M0,0 H${w} V${h} H0 Z`,
      deco: (w) => { const d = Math.min(14, w * 0.3); return `M${w - d},0 V${d} H${w}`; },
      textBox: (w, h) => ({ x: -50, y: h + 2, w: w + 100, h: 30 }),
    },

    /* ======================= NUVEM E INFRAESTRUTURA (Lisa_Proof, 31/10/2026) ======================= */
    // Um cartão com o ícone à esquerda e o nome ao lado (cartaoComIcone, abaixo).
    cloudLoadBalancer: cartaoComIcone('Balanceador de carga', 'Balanceador', icones.balanceador),
    cloudGateway: cartaoComIcone('API Gateway', 'API Gateway', icones.gateway),
    cloudCache: cartaoComIcone('Cache (Redis, Memcached)', 'Cache', icones.cache, { decoFill: true }),
    cloudCdn: cartaoComIcone('CDN', 'CDN', icones.globo),
    cloudDns: cartaoComIcone('DNS', 'DNS', icones.dns),
    cloudContainer: cartaoComIcone('Contêiner (Docker)', 'Contêiner', icones.conteiner),
    cloudFunction: cartaoComIcone('Função serverless', 'Função', icones.lambda),
    cloudBucket: cartaoComIcone('Armazenamento de arquivos (bucket)', 'Bucket', icones.balde),
    cloudTopic: cartaoComIcone('Tópico / barramento de eventos', 'Tópico de eventos', icones.topico),
    cloudMonitor: cartaoComIcone('Monitoramento / observabilidade', 'Monitoramento', icones.monitor),
    cloudFirewall: cartaoComIcone('Firewall / segurança', 'Firewall', icones.muro, { color: 'red' }),
    cloudUsers: cartaoComIcone('Grupo de usuários', 'Usuários', icones.pessoas, { color: 'deep' }),
    cloudWarehouse: cartaoComIcone('Data warehouse', 'Data warehouse', icones.armazem, { color: 'graphite' }),
    cloudLake: cartaoComIcone('Data lake', 'Data lake', icones.lago, { color: 'graphite' }),
    cloudEtl: cartaoComIcone('ETL / pipeline de dados', 'Pipeline de dados', icones.pipeline),
    cloudMl: cartaoComIcone('Modelo de IA / ML', 'Modelo de IA', icones.rede, { color: 'lilac' }),
    cloudRepo: cartaoComIcone('Repositório de código (Git)', 'Repositório', icones.git, { color: 'graphite' }),
    cloudCicd: cartaoComIcone('CI/CD (integração e entrega contínuas)', 'CI/CD', icones.ciclo),
    cloudIot: cartaoComIcone('Dispositivo IoT', 'Sensor IoT', icones.chip, { color: 'amber' }),
    cloudCluster: {
      label: 'Cluster / VPC / região', w: 480, h: 320, text: 'Cluster', color: 'graphite', container: true, dashed: true, minW: 160, minH: 100,
      path: (w, h) => rr(w, h, 14),
      deco: (w) => `M${w - 30},6 h20 v14 h-20 Z M${w - 24},11 h8 M${w - 24},15 h8`,
      textBox: (w) => ({ x: 12, y: 4, w: w - 48, h: 28 }),
      align: 'left',
    },

    /* ======================= MODELO C4 (Lisa_Proof, 31/10/2026) ======================= */
    // Os cartões do C4: o nome na 1ª linha e, embaixo, o tipo e a descrição (Enter quebra a linha).
    c4Person: {
      label: 'Pessoa (C4)', w: 150, h: 140, text: 'Pessoa\n[usuário]', color: 'deep', multiline: true, minW: 90, minH: 90,
      path: (w, h) => { const r = Math.min(w, h) * 0.2; const t = r * 2 + 4; return `${dot(w / 2, r + 1, r)} M14,${t} H${w - 14} A14,14 0 0 1 ${w},${t + 14} V${h - 14} A14,14 0 0 1 ${w - 14},${h} H14 A14,14 0 0 1 0,${h - 14} V${t + 14} A14,14 0 0 1 14,${t} Z`; },
      textBox: (w, h) => { const t = Math.min(w, h) * 0.4 + 4; return { x: 0, y: t, w, h: h - t }; },
      ports: (w, h) => ({ top: [w / 2, 0], right: [w, h * 0.66], bottom: [w / 2, h], left: [0, h * 0.66] }),
    },
    c4System: {
      label: 'Sistema de software (C4)', w: 210, h: 110, text: 'Sistema\n[sistema de software]', color: 'purple', multiline: true,
      path: (w, h) => rr(w, h, 10),
    },
    c4Container: {
      label: 'Contêiner (C4): app, API, banco', w: 200, h: 104, text: 'Contêiner\n[tecnologia]', color: 'lilac', multiline: true,
      path: (w, h) => rr(w, h, 10),
    },
    c4Component: {
      label: 'Componente (C4)', w: 190, h: 96, text: 'Componente\n[tecnologia]', color: 'white', multiline: true,
      path: (w, h) => rr(w, h, 10),
    },
    c4External: {
      label: 'Sistema externo (C4)', w: 210, h: 110, text: 'Sistema externo\n[de terceiros]', color: 'graphite', dashed: true, multiline: true,
      path: (w, h) => rr(w, h, 10),
    },

    /* ======================= RAIAS (BAIAS) ======================= */
    // Raia horizontal: o título fica de lado, numa faixa à esquerda (estilo
    // fluxograma multifuncional do Visio). Empilhe várias para formar as baias.
    lane: {
      label: 'Raia horizontal (baia)', w: 960, h: 200, text: 'Área', color: 'graphite', container: true, minW: 200, minH: 60, rotText: true,
      path: (w, h) => `M0,0 H${w} V${h} H0 Z`,
      header: (w, h) => `M0,0 H38 V${h} H0 Z`,
      textBox: (w, h) => ({ x: 0, y: 0, w: 38, h }),
      icon: () => '<rect x="2" y="5" width="36" height="20" rx="1.5" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-width="2"/><rect x="2" y="5" width="7" height="20" fill="currentColor" fill-opacity=".45"/>',
    },
    // Raia vertical: o título fica na faixa de cima.
    laneV: {
      label: 'Raia vertical (baia)', w: 280, h: 720, text: 'Área', color: 'graphite', container: true, minW: 120, minH: 200,
      path: (w, h) => `M0,0 H${w} V${h} H0 Z`,
      header: (w) => `M0,0 H${w} V38 H0 Z`,
      textBox: (w) => ({ x: 0, y: 0, w, h: 38 }),
      icon: () => '<rect x="11" y="1" width="18" height="28" rx="1.5" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-width="2"/><rect x="11" y="1" width="18" height="6" fill="currentColor" fill-opacity=".45"/>',
    },

    /* ======================= TEXTO E DESENHO LIVRES ======================= */
    // Caixa de texto: só o texto, sem contorno - para escrever livremente no quadro.
    freeText: {
      label: 'Caixa de texto', w: 240, h: 40, text: 'Escreva aqui', color: 'graphite',
      transparent: true, noBorder: true, align: 'left', top: true, padL: 6, textAuto: true, autoHeight: true,
      multiline: true, editOnCreate: true, minW: 40, minH: 24,
      path: (w, h) => rr(w, h, 4),
      icon: () => '<path d="M7 6h26M20 6v19M14 25h12" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    },
    // Desenho à mão livre: criado pela ferramenta Lápis (P). Não aparece na barra
    // de formas. Os pontos ficam em "pts", de 0 a 1000 dentro da caixa da forma:
    // esticar a forma estica o desenho junto.
    ink: {
      label: 'Desenho à mão', w: 100, h: 100, text: '', noText: true, ink: true, noPorts: true, minW: 4, minH: 4,
      path: (w, h) => `M0,0 H${w} V${h} H0 Z`,
    },

    /* ======================= ANOTAÇÃO TÉCNICA ======================= */
    // Bloco de código: escolha a linguagem no painel; o realce é do SyntaxHighlighter.
    code: {
      label: 'Bloco de código', w: 380, h: 160, render: 'code', autoHeight: true, multiline: true, editOnCreate: true, noColor: true, minW: 140,
      text: 'function somar(a, b) {\n  // soma dois números\n  return a + b;\n}', color: 'graphite',
      path: (w, h) => rr(w, h, 8),
      icon: () => '<rect x="3" y="2" width="34" height="26" rx="3" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="2"/><path d="M15 10L10 15L15 20M25 10L30 15L25 20" stroke="currentColor" stroke-width="2" fill="none"/>',
    },

    /* ======================= MAPA MENTAL (MindMap.js) ======================= */
    mmRoot: {
      label: 'Tema central', w: 200, h: 56, text: 'Tema central', mind: true, color: 'purple',
      path: (w, h) => rr(w, h, h / 2),
    },
    mmNode: {
      label: 'Tópico', w: 120, h: 36, text: 'Tópico', mind: true,
      path: (w, h) => rr(w, h, 10),
    },

    // Imagem: criada ao colar (Ctrl+V) uma imagem. Não aparece na barra de formas.
    image: {
      label: 'Imagem', w: 240, h: 160, text: '', image: true,
      path: (w, h) => rr(w, h, 6),
    },
  };

  // ---------- coleções da barra ----------
  // A anotação e o bloco de código aparecem em todas: são anotações técnicas.
  const collections = [
    { id: 'flow', label: 'Fluxograma', order: ['terminal', 'process', 'decision', 'data', 'document', 'subprocess', 'database', 'manual', 'delay', 'connector', 'lane', 'laneV', 'note', 'freeText', 'code'] },
    { id: 'uml', label: 'UML', order: ['umlInitial', 'umlAction', 'umlDecision', 'umlBar', 'umlFinal', 'umlSend', 'umlAccept', 'umlObject', 'umlSwimlane', 'umlClass', 'umlInterface', 'umlPackage', 'umlNote', 'freeText', 'code'] },
    { id: 'usecase', label: 'Caso de uso', order: ['ucActor', 'ucCase', 'ucSystem', 'umlNote', 'note', 'freeText', 'code'] },
    { id: 'db', label: 'Banco de dados', order: ['dbTable', 'dbView', 'dbSchema', 'database', 'umlNote', 'note', 'freeText', 'code'] },
    { id: 'arch', label: 'Arquitetura', order: ['ucActor', 'archBrowser', 'archMobile', 'archService', 'archComponent', 'database', 'archQueue', 'archServer', 'archCloud', 'archExternal', 'archBoundary', 'note', 'freeText', 'code'] },
    // Lisa_Proof (31/10/2026): BPMN, nuvem e infraestrutura e o modelo C4
    { id: 'bpmn', label: 'BPMN', order: ['bpmnStart', 'bpmnIntermediate', 'bpmnTimer', 'bpmnMessageEvent', 'bpmnEnd', 'bpmnTask', 'bpmnUserTask', 'bpmnServiceTask', 'bpmnSubprocess', 'bpmnGatewayX', 'bpmnGatewayParallel', 'bpmnGatewayInclusive', 'bpmnDataObject', 'database', 'lane', 'laneV', 'note', 'freeText'] },
    { id: 'cloud', label: 'Nuvem e infraestrutura', order: ['cloudUsers', 'archBrowser', 'archMobile', 'cloudDns', 'cloudCdn', 'cloudFirewall', 'cloudLoadBalancer', 'cloudGateway', 'archService', 'cloudFunction', 'cloudContainer', 'cloudCache', 'database', 'cloudBucket', 'archQueue', 'cloudTopic', 'cloudEtl', 'cloudWarehouse', 'cloudLake', 'cloudMl', 'cloudMonitor', 'cloudRepo', 'cloudCicd', 'cloudIot', 'archExternal', 'cloudCluster', 'note', 'freeText', 'code'] },
    { id: 'c4', label: 'Modelo C4', order: ['c4Person', 'c4System', 'c4Container', 'c4Component', 'c4External', 'database', 'archQueue', 'archBoundary', 'note', 'freeText'] },
  ];
  let current = collections[0];

  // ---------- pontas de linha ----------
  // Cada ponta é desenhada num <marker> de 20×20 cuja ponta (x=20, y=10) encosta
  // na forma. "fill: bg" = preenchida com a cor do quadro (ponta vazada).
  //   arrow       seta cheia (fluxo)              open      seta aberta (dependência)
  //   triangle    triângulo vazado (herança)      diamond   losango vazado (agregação)
  //   diamondFill losango cheio (composição)      one       um (|)
  //   many        muitos (pé de galinha)          oneMany   um ou muitos
  //   zeroMany    zero ou muitos                  zeroOne   zero ou um
  //   oneOnly     um e somente um (||)
  const markers = {
    arrow: { label: 'Seta', d: 'M2,4 L20,10 L2,16 L6,10 Z', fill: 'line' },
    open: { label: 'Seta aberta', d: 'M3,3 L19,10 L3,17', fill: 'none' },
    triangle: { label: 'Herança (triângulo)', d: 'M2,2 L20,10 L2,18 Z', fill: 'bg' },
    diamond: { label: 'Agregação (losango)', d: 'M0,10 L10,4 L20,10 L10,16 Z', fill: 'bg' },
    diamondFill: { label: 'Composição (losango cheio)', d: 'M0,10 L10,4 L20,10 L10,16 Z', fill: 'line' },
    one: { label: 'Um', d: 'M13,3 V17 M0,10 H20', fill: 'none' },
    oneOnly: { label: 'Um e somente um', d: 'M13,3 V17 M8,3 V17 M0,10 H20', fill: 'none' },
    many: { label: 'Muitos', d: 'M20,3 L7,10 L20,17 M0,10 H20', fill: 'none' },
    oneMany: { label: 'Um ou muitos', d: 'M20,3 L9,10 L20,17 M5,3 V17 M0,10 H20', fill: 'none' },
    zeroMany: { label: 'Zero ou muitos', d: 'M20,3 L9,10 L20,17 M0,10 H20', fill: 'none', circle: true },
    zeroOne: { label: 'Zero ou um', d: 'M13,3 V17 M0,10 H20', fill: 'none', circle: true },
  };

  // ---------- API pública (o que os outros módulos enxergam) ----------
  return {
    types,  // atalho de sintaxe: equivale a "types: types"
    collections,
    markers,
    // Ordem dos botões na barra (também define as teclas 1..9): a da coleção ativa.
    // "get" faz order parecer um campo comum, mas calculado na hora.
    get order() { return current.order; },
    get collection() { return current.id; },
    setCollection(id) { current = collections.find((c) => c.id === id) || collections[0]; },
    // Devolve a definição do tipo; se não existir, usa "process" como padrão.
    get(type) { return types[type] || types.process; },
    // Verifica se o tipo existe. hasOwnProperty evita falsos positivos
    // com propriedades herdadas (ex.: "toString").
    has(type) { return Object.prototype.hasOwnProperty.call(types, type); },
    /** Portas em coordenadas locais da forma */
    ports(type, w, h) { const t = this.get(type); return t.noPorts ? {} : t.ports ? t.ports(w, h) : midPorts(w, h); },
    /** Altura calculada pelo conteúdo (formas com autoHeight) */
    autoHeight(s) {
      const t = this.get(s.type);
      if (t.render === 'table') return 34 + Math.max(1, lines(s.text).length - 1) * 22 + 8;
      if (t.render === 'class') {
        const sec = sections(s.text);
        return sec.reduce((h, l, i) => h + (i === 0 ? Math.max(1, l.length) * 19 + 14 : Math.max(1, l.length) * 18 + 10), 0);
      }
      if (t.render === 'code') return 30 + lines(s.text).length * 17 + 18;
      // caixa de texto: as linhas escritas (a quebra automática pode pedir mais: estique)
      if (t.textAuto) return Math.ceil(lines(s.text).length * (s.fs || 14) * 1.4 + 12);
      return s.h;
    },
    sections,
    /** Mini-ícone SVG para a barra de ferramentas */
    icon(type) {
      const t = this.get(type);
      if (t.icon) return `<svg viewBox="-2 -2 44 34">${t.icon()}</svg>`;
      // Tamanho do desenho dentro do ícone (algumas formas precisam ser mais altas)
      const round = type === 'connector' || type === 'umlInitial' || type === 'umlFinal' || type === 'umlDecision' || /^bpmn(Start|Intermediate|Timer|MessageEvent|End|Gateway)/.test(type);
      const h = round ? 30 : (type === 'decision' || type === 'database' || type === 'archServer' || type === 'archCloud' || type === 'archBrowser' ? 30 : (type === 'umlBar' ? 8 : 24));
      const ww = round ? 30 : (type === 'archMobile' ? 18 : 40); // formas redondas: largura = altura
      const hh = type === 'archMobile' ? 30 : h;
      const ox = (40 - ww) / 2, oy = (30 - hh) / 2; // deslocamento para centralizar no ícone
      const fill = t.transparent || t.container ? 'none' : 'currentColor'; // currentColor = herda a cor do texto do botão (CSS)
      // Reaproveita a MESMA função path() da forma real, só que em tamanho reduzido
      return `<svg viewBox="-2 -2 44 34"><g transform="translate(${ox},${oy})">
        <path d="${t.path(ww, hh)}" fill="${fill}" fill-opacity=".22" stroke="currentColor" stroke-width="2" stroke-linejoin="round"${t.dashed ? ' stroke-dasharray="4 3"' : ''}/>
        ${t.header ? `<path d="${t.header(ww, hh)}" fill="currentColor" fill-opacity=".35"/>` : ''}
        ${t.deco ? `<path d="${t.deco(ww, hh)}" fill="${t.decoFill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6"/>` : ''}
      </g></svg>`;
    },
  };
})(); // ← os "()" finais executam a função imediatamente

/** Paleta de preenchimento das formas
 *  id     → valor salvo no JSON (mantido estável para os arquivos antigos abrirem)
 *  fill   → preenchimento real: um degradê (url(#gMain)) ou uma variável CSS do tema
 *  solid  → cor usada na amostra do painel
 *  text   → cor do texto sobre essa cor (garante contraste)
 *  stroke → cor da borda
 *  As cores "var(--...)" são definidas por tema no style.css: ao trocar o tema,
 *  a cor "Principal" vira roxa (ProcessMap) ou verde (Proof) automaticamente.
 */
PM.Palette = [
  { id: 'purple', name: 'Principal (cor do tema)', fill: 'url(#gMain)', solid: 'var(--sh-main-a)', text: 'var(--sh-main-text)', stroke: 'var(--sh-main-stroke)' },
  { id: 'deep', name: 'Principal escuro', fill: 'url(#gDeep)', solid: 'var(--sh-deep-a)', text: 'var(--sh-deep-text)', stroke: 'var(--sh-deep-stroke)' },
  { id: 'lilac', name: 'Principal claro', fill: 'url(#gSoft)', solid: 'var(--sh-soft-a)', text: 'var(--sh-soft-text)', stroke: 'var(--sh-soft-stroke)' },
  { id: 'graphite', name: 'Grafite', fill: 'var(--sh-graphite)', solid: 'var(--sh-graphite)', text: 'var(--sh-graphite-text)', stroke: 'var(--sh-graphite-stroke)' },
  { id: 'white', name: 'Branco', fill: '#f4f0f8', solid: '#f4f0f8', text: '#1f0b33', stroke: '#bdb6c6' },
  { id: 'green', name: 'Verde (concluído)', fill: '#1f6f4a', solid: '#1f6f4a', text: '#ffffff', stroke: '#35a874' },
  { id: 'amber', name: 'Âmbar (atenção)', fill: '#9a6512', solid: '#9a6512', text: '#ffffff', stroke: '#d79a2b' },
  { id: 'red', name: 'Vermelho (problema)', fill: '#8e1f2a', solid: '#8e1f2a', text: '#ffffff', stroke: '#d4444f' },
];

// Busca uma cor pelo id; se não achar (ex.: JSON editado à mão), usa a primeira.
// Array.find devolve o primeiro item que satisfaz a condição, ou undefined.
PM.paletteById = (id) => PM.Palette.find((p) => p.id === id) || PM.Palette[0];
