// As ANIMAÇÕES da Lisa — uma pra cada coisa que ela faz.
//
// Antes toda atividade usava três poses (parada, de costas, braço pra cima) e a diferença entre
// regar a horta e varrer o quintal era só o rótulo no canto da tela. Dava pra ler o texto, não
// pra RECONHECER a cena.
//
// Aqui cada ação tem um gesto com ciclo próprio e um objeto que se move junto: a vassoura vai e
// volta levantando poeira, o regador despeja um filete contínuo de água, o martelo bate e solta
// faísca, a roupa sobe do cesto pro varal uma peça por vez. É o movimento do objeto que conta a
// história — o corpo dela só acompanha.
//
// `gesto()` é pura de propósito (só contas), então o teste do node confere que toda ação da
// rotina tem animação e que toda pose citada existe mesmo. O desenho fica em `adereco()`.

const ciclo = (t, ms) => ((t % ms) + ms) % ms / ms;      // 0..1, sempre positivo
const onda = (f) => Math.sin(f * Math.PI * 2);           // -1..1 suave
const pulso = (f) => Math.sin(f * Math.PI);              // 0..1..0
/** Sobe rápido, desce devagar — o tempo de uma martelada, de uma braçada. */
const golpe = (f) => (f < 0.3 ? f / 0.3 : 1 - (f - 0.3) / 0.7);

/**
 * Cada gesto: a pose de base, quanto dura um ciclo, e o que o corpo faz dentro dele.
 *
 * `dx`/`dy` deslocam a figura inteira (em células; `dy` negativo é pra cima). `lean` é o que
 * mais conta: inclina o corpo em torno dos pés — positivo curva pra frente (varrer, colher),
 * negativo joga pra trás (olhar as estrelas, beber). São sete desenhos parados virando uma
 * pessoa que se curva, se agacha e olha pra cima. Meio radiano já é muito: com o eixo nos pés,
 * a cabeça anda mais de um terço da altura dela.
 *
 * `agacha` (0 a 1) encolhe ela com os pés no chão. Agachar com `dy` não funciona: a figura desce
 * inteira e some dentro do terreno em vez de ficar de cócoras.
 */
export const GESTOS = {
  regar:      { pose: "work",  ms: 2600, corpo: (f) => ({ dy: pulso(f) * -0.4, lean: 0.18 + pulso(f) * 0.13 }) },
  varrer:     { pose: "work",  ms: 1500, corpo: (f) => ({ dx: onda(f) * 1.4, agacha: 0.08, lean: 0.32 + onda(f) * 0.1 }) },
  estender:   { pose: "alto",  ms: 3400, corpo: (f) => (f < 0.35
                 ? { agacha: 0.4 * (1 - f / 0.35), lean: 0.34 * (1 - f / 0.35) }
                 : { dy: -1.2, lean: -0.1 }) },
  martelar:   { pose: "armUp", ms: 820,  corpo: (f) => ({ dy: golpe(f) * 0.9, lean: 0.15 + golpe(f) * 0.1 }) },
  lancar:     { pose: "armUp", ms: 2400, corpo: (f) => (f < 0.28
                 ? { dx: -0.8, lean: -0.2 }
                 : { dx: 0.7, lean: 0.2 }) },
  sentar:     { pose: "sit",   ms: 4200, corpo: (f) => ({ dy: pulso(f) * -0.35, lean: -0.06 + pulso(f) * 0.1 }) },
  comer:      { pose: "sit",   ms: 1900, corpo: (f) => ({ dy: pulso(f) * -0.3, lean: 0.16 - pulso(f) * 0.22 }) },
  olharCima:  { pose: "idle",  ms: 5600, corpo: (f) => ({ dx: onda(f) * 0.3, dy: -0.4, lean: -0.2 - pulso(f) * 0.07 }) },
  dormir:     { pose: "sit",   ms: 4600, corpo: (f) => ({ dy: 2 - pulso(f) * 1.1, lean: 1.25 }) },
  espreguicar:{ pose: "alto",  ms: 2800, corpo: (f) => ({ dy: pulso(f) * -1.6, lean: -0.08 - pulso(f) * 0.14 }) },
  beber:      { pose: "idle",  ms: 2800, corpo: (f) => ({ dy: pulso(f) * -0.2, lean: -0.07 - pulso(f) * 0.13 }) },
  abrir:      { pose: "armUp", ms: 2200, corpo: (f) => ({ dx: pulso(f) * 0.8, lean: 0.07 + pulso(f) * 0.13 }) },
  agachar:    { pose: "work",  ms: 2800, corpo: (f) => ({ agacha: 0.18 + pulso(f) * 0.28, lean: 0.26 + pulso(f) * 0.18 }) },
  manivela:   { pose: "work",  ms: 2000, corpo: (f) => ({ dx: Math.cos(f * Math.PI * 2) * 0.5, dy: Math.sin(f * Math.PI * 2) * -0.5, lean: 0.18 }) },
  balancar:   { pose: "idle",  ms: 1250, corpo: (f) => ({ dx: onda(f) * 1.1, dy: Math.abs(onda(f * 2)) * -0.7, lean: onda(f) * 0.16 }) },
  abanar:     { pose: "work",  ms: 640,  corpo: (f) => ({ dy: onda(f) * -0.4, lean: 0.24 + onda(f) * 0.06 }) },
  andar:      { pose: "walk",  ms: 300,  corpo: () => ({}) },
};

/** A pose, o deslocamento e a curvatura do corpo neste instante da ação. */
export function gesto(anim, t = 0) {
  const g = GESTOS[anim] || GESTOS.andar;
  const f = ciclo(t, g.ms);
  const { dx = 0, dy = 0, lean = 0, agacha = 0 } = g.corpo(f);
  const pose = g.pose === "walk" ? (Math.floor(t / g.ms) % 2 ? "walkA" : "walkB") : g.pose;
  return { pose, dx, dy, lean, agacha, f };
}

// ---------- os objetos ----------
//
// Tudo em coordenada de célula, o mesmo sistema do resto do mundo. `p` é o pé dela; a mão fica
// por volta de 12 células acima, deslocada pro lado pra onde ela está virada.

const gira = (o, r, ang) => ({ x: o.x + Math.cos(ang) * r, y: o.y + Math.sin(ang) * r });


/**
 * Desenha o que está na mão dela (e o que esse objeto faz) para a ação em curso.
 * `t` é o tempo desde que a ação começou.
 */
export function adereco(P, anim, t, p, flip) {
  const g = GESTOS[anim];
  if (!g) return;
  const f = ciclo(t, g.ms);
  const s = flip ? -1 : 1;
  const { lean = 0, agacha = 0 } = g.corpo(f);

  // o que está NA MÃO sofre a MESMA transformação do corpo — encolhe com o agachamento e gira
  // no mesmo eixo (os pés). Sem isso o regador fica boiando no ar enquanto ela se curva pra
  // regar, e a cesta continua na altura do peito enquanto ela está de cócoras.
  const ang = flip ? -lean : lean;
  const rot = (q) => {
    const dx = q.x - p.x;
    const dy = (q.y - p.y) * (1 - agacha);
    if (!ang) return { x: p.x + dx, y: p.y + dy };
    return {
      x: p.x + dx * Math.cos(ang) - dy * Math.sin(ang),
      y: p.y + dx * Math.sin(ang) + dy * Math.cos(ang),
    };
  };
  const mao = (alt = 12) => rot({ x: p.x + s * 4.5, y: p.y - alt });

  switch (anim) {
    case "regar": {
      // o regador inclinado e um FILETE contínuo caindo até o chão — é a água que se reconhece
      const h = mao(13);
      P.poli([
        { x: h.x, y: h.y }, { x: h.x + s * 4, y: h.y - 1.2 },
        { x: h.x + s * 4, y: h.y + 2.6 }, { x: h.x, y: h.y + 3.4 },
      ], { a: 0.9, fill: 0.12 });
      P.linha([{ x: h.x + s * 4, y: h.y - 0.6 }, { x: h.x + s * 7.5, y: h.y - 2 }], { a: 0.9 });
      const bico = { x: h.x + s * 7.5, y: h.y - 2 };
      const chao = { x: bico.x + s * 3, y: p.y - 1 };
      const jato = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        jato.push({ x: bico.x + (chao.x - bico.x) * u, y: bico.y + (chao.y - bico.y) * (u * u) });
      }
      P.linha(jato, { a: 0.45, w: 0.8 });
      for (let k = 0; k < 3; k++) {
        const u = (f * 2 + k / 3) % 1;
        P.ponto({ x: bico.x + (chao.x - bico.x) * u, y: bico.y + (chao.y - bico.y) * (u * u) }, { a: 0.95, r: 0.5 });
      }
      // a terra molhada respinga
      for (let k = 0; k < 4; k++) P.ponto({ x: chao.x + (k - 1.5) * 1.6, y: p.y - 0.5 - pulso((f * 2 + k / 4) % 1) * 1.6 }, { a: 0.4, r: 0.4 });
      break;
    }
    case "varrer": {
      // a vassoura varre um arco; a poeira sai na frente dela
      const h = mao(12);
      // o cabo aponta pra baixo e pra frente; o arco do vaivém é o `onda`
      const dir = Math.atan2(1, s * 0.75) + onda(f) * 0.42;
      const ponta = gira(h, 11, dir);
      P.linha([h, ponta], { a: 0.9, w: 1.2 });
      const perp = { x: -(ponta.y - h.y), y: ponta.x - h.x };
      const n = Math.hypot(perp.x, perp.y) || 1;
      const cerda = [
        { x: ponta.x - (perp.x / n) * 2.4, y: ponta.y - (perp.y / n) * 2.4 },
        { x: ponta.x + (perp.x / n) * 2.4, y: ponta.y + (perp.y / n) * 2.4 },
      ];
      P.poli([cerda[0], cerda[1], { x: cerda[1].x + (ponta.x - h.x) * 0.22, y: cerda[1].y + (ponta.y - h.y) * 0.22 }, { x: cerda[0].x + (ponta.x - h.x) * 0.22, y: cerda[0].y + (ponta.y - h.y) * 0.22 }], { a: 0.85, fill: 0.14 });
      for (let k = 0; k < 4; k++) {
        const u = (f + k / 4) % 1;
        P.ponto({ x: ponta.x + s * u * 6, y: ponta.y - pulso(u) * 3 }, { a: (1 - u) * 0.5, r: 0.5 });
      }
      break;
    }
    case "estender": {
      // cesto no chão e a peça subindo até a corda, uma por vez
      P.poli([{ x: p.x - s * 7, y: p.y - 1 }, { x: p.x - s * 2, y: p.y - 1 }, { x: p.x - s * 2.6, y: p.y - 4 }, { x: p.x - s * 6.4, y: p.y - 4 }], { a: 0.8, fill: 0.08 });
      // a peça sobe do cesto até a altura das mãos levantadas, AO LADO dela — subindo por cima
      // do corpo ela some dentro da silhueta e o gesto não lê
      const sobe = Math.min(1, f / 0.75);
      const y = p.y - 4 - sobe * 21;
      const x = p.x - s * 6;
      P.poli([{ x: x - 2, y }, { x: x + 2, y }, { x: x + 2.4, y: y + 5.5 }, { x: x - 2.4, y: y + 5.5 }], { a: 0.9, fill: 0.1 });
      if (sobe >= 1) P.linha([{ x: x - 3, y: y - 0.6 }, { x: x + 3, y: y - 0.6 }], { a: 0.7, w: 0.8 });
      break;
    }
    case "martelar": {
      const h = mao(12);
      const alto = golpe(f);
      const cabo = { x: h.x + s * 2, y: h.y - 2 - (1 - alto) * 6 };
      const cabeca = { x: cabo.x + s * 4.5, y: cabo.y - 3 * (1 - alto) };
      P.linha([h, cabo], { a: 0.85 });
      P.linha([cabo, cabeca], { a: 0.9, w: 1.1 });
      P.poli([{ x: cabeca.x - 1.4, y: cabeca.y - 1.6 }, { x: cabeca.x + 1.4, y: cabeca.y - 1.6 }, { x: cabeca.x + 1.4, y: cabeca.y + 1.6 }, { x: cabeca.x - 1.4, y: cabeca.y + 1.6 }], { a: 0.95, fill: 0.3 });
      if (alto > 0.85) for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI - Math.PI / 2;
        P.ponto({ x: cabeca.x + Math.cos(ang) * 3.5, y: cabeca.y + 2 + Math.sin(ang) * 2 }, { a: 0.9, r: 0.45 });
      }
      break;
    }
    case "lancar": {
      // arremesso: recua, joga, e o disco sai voando num arco
      if (f > 0.28) {
        const u = (f - 0.28) / 0.72;
        const d = { x: p.x + s * (5 + u * 30), y: p.y - 14 - pulso(u) * 9 };
        P.elipse(d.x, d.y, 2.6, 1.1, { a: 0.95, fill: 0.2 });
      } else {
        const h = mao(15);
        P.elipse(h.x, h.y, 2.4, 1, { a: 0.95, fill: 0.2 });
      }
      break;
    }
    case "comer": {
      // prato na frente e a mão indo à boca
      P.elipse(p.x + s * 6, p.y - 7, 3.2, 1.4, { a: 0.85, fill: 0.1 });
      const u = pulso(f);
      P.linha([{ x: p.x + s * 5, y: p.y - 8 }, { x: p.x + s * (5 - u * 2), y: p.y - 8 - u * 5 }], { a: 0.9, w: 0.9 });
      break;
    }
    case "beber": {
      const u = pulso(f);
      const c = { x: p.x + s * 4, y: p.y - 11 - u * 4 };
      P.poli([{ x: c.x - 1.6, y: c.y }, { x: c.x + 1.6, y: c.y }, { x: c.x + 1.2, y: c.y + 3.2 }, { x: c.x - 1.2, y: c.y + 3.2 }], { a: 0.9, fill: 0.14 });
      for (let k = 0; k < 3; k++) {
        const v = (f + k / 3) % 1;
        P.ponto({ x: c.x + onda(v) * 1.6, y: c.y - 1 - v * 5 }, { a: (1 - v) * 0.5, r: 0.4 });
      }
      break;
    }
    case "olharCima": {
      for (let k = 0; k < 5; k++) {
        const v = (f + k / 5) % 1;
        P.ponto({ x: p.x + (k - 2) * 4.5, y: p.y - 27 - onda(v) * 2 }, { a: 0.3 + pulso(v) * 0.5, r: 0.45 });
      }
      break;
    }
    case "abrir": {
      // uma tampa/folha girando — serve pra janela e pra caixa de correio
      const ang = -0.2 - pulso(f) * 0.9;
      const o = { x: p.x + s * 7, y: p.y - 13 };
      const pt = gira(o, 7, ang * s);
      P.linha([o, pt], { a: 0.9 });
      P.poli([o, pt, { x: pt.x, y: pt.y + 5 }, { x: o.x, y: o.y + 5 }], { a: 0.6, fill: 0.08 });
      break;
    }
    case "agachar": {
      // colher: alguma coisa sai do chão e vai pro cesto
      P.poli([{ x: p.x - s * 7, y: p.y - 1 }, { x: p.x - s * 3, y: p.y - 1 }, { x: p.x - s * 3.4, y: p.y - 3.6 }, { x: p.x - s * 6.6, y: p.y - 3.6 }], { a: 0.8, fill: 0.08 });
      const u = f;
      P.elipse(p.x + s * 5 - s * u * 10, p.y - 2 - pulso(u) * 8, 1.4, 1.2, { a: 0.95, fill: 0.22 });
      break;
    }
    case "manivela": {
      // a manivela gira e o balde sobe no ritmo dela
      const o = { x: p.x + s * 7, y: p.y - 12 };
      const ang = f * Math.PI * 2;
      P.elipse(o.x, o.y, 3.4, 3.4, { a: 0.4, w: 0.7 });
      P.linha([o, gira(o, 3.4, ang)], { a: 0.95, w: 1.1 });
      const sobe = (1 - Math.cos(f * Math.PI * 2)) / 2;
      const by = p.y - 2 - sobe * 8;
      P.linha([{ x: o.x + 4, y: o.y }, { x: o.x + 4, y: by }], { a: 0.5, w: 0.7 });
      P.poli([{ x: o.x + 2.2, y: by }, { x: o.x + 5.8, y: by }, { x: o.x + 5.2, y: by + 3.4 }, { x: o.x + 2.8, y: by + 3.4 }], { a: 0.9, fill: 0.12 });
      break;
    }
    case "balancar": {
      for (let k = 0; k < 3; k++) {
        const v = (f / 2 + k / 3) % 1;
        const nx = p.x + s * (4 + onda(v) * 2.5);
        const ny = p.y - 20 - v * 12;
        P.elipse(nx, ny, 1.1, 0.9, { a: (1 - v) * 0.9, fill: 0.3 });
        P.linha([{ x: nx + 1.1, y: ny }, { x: nx + 1.1, y: ny - 3.4 }], { a: (1 - v) * 0.8, w: 0.8 });
      }
      break;
    }
    case "abanar": {
      // o abano e a fumaça saindo em rajada no mesmo ritmo
      const h = mao(11);
      const ang = onda(f) * 0.7;
      const pt = gira(h, 6, (Math.PI / 6) * s + ang);
      P.poli([h, pt, { x: pt.x - s * 1.5, y: pt.y + 3.4 }], { a: 0.9, fill: 0.14 });
      for (let k = 0; k < 4; k++) {
        const v = (f / 3 + k / 4) % 1;
        P.ponto({ x: pt.x + s * v * 9, y: pt.y - 2 - v * 9 + onda(v * 2) * 2 }, { a: (1 - v) * 0.55, r: 0.7 });
      }
      break;
    }
    case "espreguicar": {
      for (let k = 0; k < 3; k++) P.linha(
        [{ x: p.x + (k - 1) * 5, y: p.y - 26 - pulso(f) * 2 }, { x: p.x + (k - 1) * 5, y: p.y - 29 - pulso(f) * 3 }],
        { a: pulso(f) * 0.7, w: 0.8 }
      );
      break;
    }
    case "dormir": {
      for (let k = 0; k < 3; k++) {
        const v = (f + k / 3) % 1;
        P.linha([
          { x: p.x + 5 + v * 5, y: p.y - 16 - v * 10 },
          { x: p.x + 8.5 + v * 5, y: p.y - 16 - v * 10 },
          { x: p.x + 5 + v * 5, y: p.y - 12.5 - v * 10 },
          { x: p.x + 8.5 + v * 5, y: p.y - 12.5 - v * 10 },
        ], { a: (1 - v) * 0.8, w: 0.9 });
      }
      break;
    }
    default:
      break;
  }
}
