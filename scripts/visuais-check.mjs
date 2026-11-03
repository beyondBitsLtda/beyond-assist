// Guarda os visuais da Lisa (src/lib/visuaisDaLisa.js): o catálogo completo e coerente, o
// envelope da voz (repouso quieto, fala viva, volume medido seguido), os pesos dos estados e a
// preferência guardada no navegador. O desenho em si (WebGL) só se confere no navegador.

import fs from "node:fs";
import {
  VISUAIS, ESTADOS, VISUAL_PADRAO, CHAVE_DO_VISUAL, EVENTO_DO_VISUAL,
  visualDe, coresDe, criarEnvelope, criarPesos, lerVisual, escolherVisual,
} from "../src/lib/visuaisDaLisa.js";
import {
  FORMA, RAIO, CENTRO_Y, CAIXA, resolucaoDoRosto, criarMovimentoDoRosto,
  CABELOS_DO_ROSTO, PALETAS_DO_ROSTO, AJUSTES_PADRAO, CHAVE_DO_ROSTO, EVENTO_DO_ROSTO,
  ajustesValidos, lerAjustesDoRosto, escolherAjustesDoRosto, coresDoRosto, enquadramentoDoRosto,
} from "../src/lib/rostoDaLisa.js";
import {
  BRINCADEIRAS, TEMPOS, criarOcio, poseDaBrincadeira, uvDoPonto, naTela, frenteDaCaixa, COISAS, apertoDaTela,
} from "../src/lib/brincadeirasDoRosto.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));
const ler = (caminho) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

console.log("catálogo");
const ids = VISUAIS.map((v) => v.id);
conferir("os seis visuais, sem id repetido", ids.join() === "esfera,lente,orbe,plasma,anel,rosto" && new Set(ids).size === ids.length, ids.join());
conferir("cada visual tem nome e descrição", VISUAIS.every((v) => v.nome && v.descricao.length > 20));
conferir("cada visual tem 3 cores válidas para cada estado", VISUAIS.every((v) => ESTADOS.every((e) => v.cores[e]?.length === 3 && v.cores[e].every((c) => /^#[0-9a-f]{6}$/i.test(c)))));
conferir("id desconhecido cai no padrão", visualDe("nao-existe").id === VISUAL_PADRAO && coresDe("nao-existe", "falando").join() === visualDe(VISUAL_PADRAO).cores.falando.join());
conferir("estado desconhecido usa as cores de repouso", coresDe("lente", "dormindo").join() === visualDe("lente").cores.pronta.join());
const seletor = ler("src/components/panels/visuais/VisualDaLisa.js");
conferir("todo visual do catálogo tem componente no seletor", ids.every((id) => new RegExp(`\\b${id}: dynamic\\(`).test(seletor)));
conferir("e cada componente novo tem o seu arquivo", ["Lente", "Orbe", "Plasma", "Anel", "Rosto"].every((n) => fs.existsSync(new URL(`../src/components/panels/visuais/${n}.js`, import.meta.url))));
conferir("o painel está na lista de painéis", /href: "\/visual"/.test(ler("src/lib/navegacao.js")));

console.log("envelope da voz");
{
  const rodar = (sinal, segundos, acaso) => {
    const env = criarEnvelope(acaso);
    const amostras = [];
    for (let t = 0; t < segundos; t += 1 / 60) amostras.push(env(sinal, t, 1 / 60));
    return amostras.slice(60); // depois de acomodar
  };
  const pronta = rodar({ estado: "pronta", nivel: null }, 4);
  conferir("em repouso, quase parado", Math.max(...pronta) < 0.14 && Math.min(...pronta) > 0.03);
  let semente = 1;
  const acaso = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  const falando = rodar({ estado: "falando", nivel: null }, 6, acaso);
  conferir("falando sem volume medido, simula sílabas (sobe e desce bastante)", Math.max(...falando) > 0.6 && Math.min(...falando) < 0.25);
  const medido = rodar({ estado: "falando", nivel: 0.5 }, 3);
  conferir("com volume medido, segue o volume", Math.abs(medido.at(-1) - (0.08 + 0.5 * 0.95)) < 0.01);
  const forte = rodar({ estado: "ouvindo", nivel: 7 }, 2);
  conferir("volume fora da faixa não estoura", forte.at(-1) <= 1.04);
  const pensando = rodar({ estado: "pensando", nivel: null }, 4);
  conferir("pensando respira entre a calma e a fala", Math.max(...pensando) < 0.25 && Math.min(...pensando) > 0.05);
}

console.log("pesos dos estados");
{
  const pesos = criarPesos();
  let p = pesos("pronta", 0.016);
  conferir("começa em repouso", p.pronta > 0.99);
  for (let i = 0; i < 10; i++) p = pesos("falando", 0.016);
  conferir("troca de estado desliza (não pula)", p.falando > 0.2 && p.falando < 0.9 && p.pronta > 0.1);
  for (let i = 0; i < 200; i++) p = pesos("falando", 0.016);
  conferir("e chega lá", p.falando > 0.99);
  conferir("os pesos somam 1", Math.abs(ESTADOS.reduce((s, e) => s + p[e], 0) - 1) < 1e-9);
}

console.log("o rosto");
{
  // a forma é GLSL (o navegador compila); aqui, o que dá para conferir sem placa de vídeo
  const contar = (c) => FORMA.split(c).length - 1;
  conferir("a forma define forma(p, orelha, fio) e usa a cabeça, a boca, a respiração e o cabelo", /float forma\(vec3 p, out float orelha, out float fio\)/.test(FORMA) && ["uCabeca", "uBoca", "uRespira", "uCabelo"].every((u) => FORMA.includes(u)));
  conferir("sem cabelo, a forma nem calcula o cabelo (raspado não custa nada a mais)", /if \(uCabelo < 0\.01\) return 9\.0;/.test(FORMA));
  conferir("a forma fecha chaves e parênteses", contar("{") === contar("}") && contar("(") === contar(")"));
  conferir("os números da forma saem como float do GLSL (sem 'NaN', sem inteiro solto em vec3)", !/NaN|undefined/.test(FORMA) && !/vec3\(\s*-?\d+\s*,/.test(FORMA));
  conferir("o componente injeta a forma no shader", /\$\{FORMA\}/.test(ler("src/components/panels/visuais/Rosto.js")));
  conferir("o busto cabe na caixa marchada (topo da cabeça e ombros)", CAIXA.max[1] > 1.05 && CAIXA.min[1] < CENTRO_Y - RAIO && CAIXA.max[0] >= 1.8);

  // a resolução de desenho: a da tela, com teto no lado MENOR (o que dá o tamanho do busto)
  conferir("tela cheia larga (1700 × 794): resolução inteira, não 1/3 (a captura pixelada)", resolucaoDoRosto(1700, 794, 1) === 1);
  conferir("tela densa: até o teto no lado menor", Math.abs(794 * resolucaoDoRosto(1700, 794, 2) - 1100) < 0.5);
  conferir("celular de densidade 3: no teto do celular, não 9× a conta", Math.abs(390 * resolucaoDoRosto(390, 844, 3, 820) - 820) < 0.5);
  conferir("miniatura: resolução inteira", resolucaoDoRosto(190, 190, 1) === 1);
  conferir("o teto mais baixo (aparelho lento) vale", 760 * resolucaoDoRosto(760, 760, 1, 420) <= 420.5);

  // o movimento: cada estado faz o seu
  const pesosDe = (e) => ({ pronta: 0, ouvindo: 0, pensando: 0, falando: 0, [e]: 1 });
  const rodar = (estado, amp, segundos = 1.5, extra = {}) => {
    const mov = criarMovimentoDoRosto();
    let r;
    for (let t = 0; t < segundos; t += 1 / 60) r = mov({ pesos: pesosDe(estado), amp, t, dt: 1 / 60, ...extra });
    return r;
  };
  const falandoAlto = rodar("falando", 0.9);
  const falandoBaixo = rodar("falando", 0.1);
  const pronta = rodar("pronta", 0.1);
  conferir("falando alto, a mandíbula abre", falandoAlto.boca > 0.8, falandoAlto.boca.toFixed(2));
  conferir("falando baixo (pausa), a boca fecha", falandoBaixo.boca < 0.05);
  conferir("parada, a boca fica fechada e fria", pronta.boca < 0.01 && pronta.calorBoca < 0.01);
  conferir("falando, a boca e a garganta esquentam com a voz", falandoAlto.calorBoca > falandoBaixo.calorBoca && falandoBaixo.calorBoca > 0.1);
  const ouvindo = rodar("ouvindo", 0.6);
  conferir("ouvindo, as orelhas esquentam (e mais com mais som)", ouvindo.calorOrelha > 0.9 && rodar("ouvindo", 0.1).calorOrelha < ouvindo.calorOrelha && pronta.calorOrelha < 0.01);
  conferir("ouvindo, a cabeça inclina", ouvindo.roll > 0.08);
  conferir("pensando, a onda de calor liga e olha para cima", rodar("pensando", 0.2, 3).onda > 0.95 && rodar("pensando", 0.2, 3).pitch < -0.08);
  const segue = (x) => rodar("pronta", 0.1, 2, { ponteiro: { x, y: 0, quando: 0.5 } }).yaw;
  conferir("parada, a cabeça segue o ponteiro (para os dois lados)", segue(1) > 0.15 && segue(-1) < -0.15);
  conferir("ponteiro parado há mais de 4s não conta", Math.abs(rodar("pronta", 0.1, 6, { ponteiro: { x: 1, y: 0, quando: 0 } }).yaw) < 0.13);
  const calmo = rodar("ouvindo", 0.6, 1.5, { reduzido: true });
  conferir("com \"reduzir movimento\", a cabeça mexe bem menos", Math.abs(calmo.roll) < Math.abs(ouvindo.roll) * 0.5 && Math.abs(calmo.respira) <= 0.35);
}

console.log("o cabelo e as cores do rosto");
{
  const hex = (c) => /^#[0-9a-f]{6}$/i.test(c);
  conferir("cabelo longo e raspado; o padrão é o longo", CABELOS_DO_ROSTO.map((c) => c.id).join() === "longo,raspado" && AJUSTES_PADRAO.cabelo === "longo");
  conferir("seis paletas, sem id repetido, a térmica primeiro (o padrão)", PALETAS_DO_ROSTO.length === 6 && new Set(PALETAS_DO_ROSTO.map((p) => p.id)).size === 6 && PALETAS_DO_ROSTO[0].id === "termico" && AJUSTES_PADRAO.paleta === "termico");
  conferir("cada paleta tem as cinco cores válidas", PALETAS_DO_ROSTO.every((p) => ["profundo", "meio", "borda", "halo", "haloPensando"].every((k) => hex(p[k]))));
  conferir("as cores do shader: borda, meio, halo e profundo", coresDoRosto("neon", "pronta").join() === ["#ffe0f3", "#ff3fa4", "#46c8ff", "#4d0a4f"].join());
  conferir("pensando, o halo muda", coresDoRosto("termico", "pensando")[2] !== coresDoRosto("termico", "pronta")[2]);
  conferir("paleta que não existe usa a térmica", coresDoRosto("xyz", "pronta").join() === coresDoRosto("termico", "pronta").join());
  conferir("ajustes estragados voltam ao padrão", JSON.stringify(ajustesValidos({ cabelo: "moicano", paleta: 3 })) === JSON.stringify(AJUSTES_PADRAO) && JSON.stringify(ajustesValidos(null)) === JSON.stringify(AJUSTES_PADRAO));
  const guardado = new Map();
  const avisos = [];
  globalThis.localStorage = { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => guardado.set(k, String(v)) };
  globalThis.window = { dispatchEvent: (e) => avisos.push(e) };
  globalThis.CustomEvent ??= class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  conferir("sem escolha guardada, o padrão", JSON.stringify(lerAjustesDoRosto()) === JSON.stringify(AJUSTES_PADRAO));
  escolherAjustesDoRosto({ paleta: "aurora" });
  const a = escolherAjustesDoRosto({ cabelo: "raspado" });
  conferir("escolher muda só a parte pedida e guarda", a.paleta === "aurora" && a.cabelo === "raspado" && JSON.parse(guardado.get(CHAVE_DO_ROSTO)).paleta === "aurora");
  conferir("e avisa o rosto aberto", avisos.at(-1)?.type === EVENTO_DO_ROSTO && avisos.at(-1)?.detail?.cabelo === "raspado");
  globalThis.localStorage = { getItem() { throw new Error("bloqueado"); }, setItem() { throw new Error("bloqueado"); } };
  conferir("navegador sem armazenamento: não quebra", lerAjustesDoRosto().paleta === "termico" && escolherAjustesDoRosto({ paleta: "ouro" }).paleta === "ouro");
  const rosto = ler("src/components/panels/visuais/Rosto.js");
  conferir("o rosto escuta a troca (evento e outras abas) e solta ao sair", /addEventListener\(EVENTO_DO_ROSTO/.test(rosto) && /removeEventListener\(EVENTO_DO_ROSTO/.test(rosto) && /removeEventListener\("storage"/.test(rosto));
  conferir("o painel /visual e o menu do Assistente oferecem cabelo e cores", /<AjustesDoRosto \/>/.test(ler("src/app/(panels)/visual/page.js")) && /escolherAjustesDoRosto\(\{ cabelo/.test(ler("src/app/(panels)/assistant/page.js")) && /escolherAjustesDoRosto\(\{ paleta/.test(ler("src/app/(panels)/assistant/page.js")));
}

console.log("a cena do Assistente (janela da resposta, hologramas, zoom)");
{
  const e1 = enquadramentoDoRosto(1);
  const e12 = enquadramentoDoRosto(1.2);
  conferir("zoom 1: o busto inteiro, como sempre", e1.raio === RAIO && e1.centroY === CENTRO_Y);
  conferir("zoom maior: chega perto e sobe para o rosto", e12.raio < e1.raio && e12.centroY > e1.centroY && Math.abs(e12.raio - RAIO / 1.2) < 1e-9);
  conferir("zoom fora da faixa fica dentro dela", enquadramentoDoRosto(0.2).raio === RAIO && enquadramentoDoRosto(9).raio === RAIO / 1.8 && enquadramentoDoRosto("lixo").raio === RAIO);
  const rosto = ler("src/components/panels/visuais/Rosto.js");
  conferir("o rosto recebe o zoom e o enquadramento desliza", /zoom = 1, brincadeiras = false \}\)/.test(rosto) &&/uRaio/.test(rosto) && /uCentroY/.test(rosto) && /enquadramentoDoRosto\(zoomRef\.current\)/.test(rosto));
  const seletor = ler("src/components/panels/visuais/VisualDaLisa.js");
  conferir("o seletor passa o zoom (os outros visuais crescem na tela)", /zoom=\{zoom\}/.test(seletor) && /0\.78 \* zoom/.test(seletor));
  const pagina = ler("src/app/(panels)/assistant/page.js");
  conferir("o Assistente põe a Lisa na cena, mais perto, e a resposta na janela", /<CenaDaLisa ativa=\{janelaNaTela\}/.test(pagina) && /zoom=\{1\.2\}/.test(pagina) && /<JanelaDaResposta key=\{numeroDaResposta\}/.test(pagina));
  conferir("o × fecha até a próxima pergunta", /aoFechar=\{\(\) => setJanelaFechada\(true\)\}/.test(pagina) && /if \(!busy\) return;\s*setJanelaFechada\(false\)/.test(pagina));
  const css = ler("src/app/globals.css");
  conferir("com \"reduzir movimento\": sem paralaxe, sem giros, sem o surgir", /prefers-reduced-motion: reduce\) \{\s*\.bb-cena-mundo \{ transform: none !important; \}/.test(css) && /\.bb-jr-surge, \.bb-cena--hud \.bb-holo--barras i \{ animation: none !important; \}/.test(css));
  conferir("os hologramas e a janela existem", ["CenaDaLisa", "HologramasDaLisa", "JanelaDaResposta"].every((n) => fs.existsSync(new URL(`../src/components/panels/hud/${n}.js`, import.meta.url))));
}

console.log("as brincadeiras do Rosto (02/11/2026: \"bater no vidro e falar toc toc, pegar um gameboy e jogar, cantarolar\")");
{
  const ids = BRINCADEIRAS.map((b) => b.id);
  conferir("as três brincadeiras (o mímico saiu, BEYOND-0021), cada uma com a sua duração", ids.join() === "vidro,jogo,cantarola" && BRINCADEIRAS.every((b) => b.duracao > 5 && b.nome));

  // o relógio da ociosidade, com o acaso fixo (sempre a primeira opção que sobra)
  const ocio = criarOcio({ acaso: () => 0 });
  conferir("parada há menos de 30 s: nada", ocio.passo(0) === null && ocio.passo(TEMPOS.primeira - 0.1) === null);
  const primeira = ocio.passo(TEMPOS.primeira);
  conferir("aos 30 s sem ninguém mexer, começa uma", primeira?.id === "vidro" && primeira.s === 0 && primeira.peso === 1, JSON.stringify(primeira));
  conferir("e segue com o tempo dela", ocio.passo(TEMPOS.primeira + 2)?.s === 2);
  ocio.gesto(TEMPOS.primeira + 3);
  const saindo = ocio.passo(TEMPOS.primeira + 3 + TEMPOS.saida / 2);
  conferir("um gesto encerra devagar (o peso cai até 0 na saída)", saindo?.id === "vidro" && saindo.peso > 0.4 && saindo.peso < 0.6, JSON.stringify(saindo));
  conferir("e some de vez no fim da saída", ocio.passo(TEMPOS.primeira + 3 + TEMPOS.saida + 0.01) === null);
  const depois = TEMPOS.primeira + 3;
  conferir("depois do gesto, o relógio recomeça (de novo 30 s)", ocio.passo(depois + TEMPOS.primeira - 0.1) === null && ocio.passo(depois + TEMPOS.primeira)?.id !== undefined);
  conferir("e não repete a última", ocio.passo(depois + TEMPOS.primeira + 0.1)?.id === "jogo");

  const fala = criarOcio({ acaso: () => 0 });
  fala.passo(0);
  conferir("ouvindo, pensando ou falando: não brinca (e o relógio recomeça)", fala.passo(TEMPOS.primeira, "falando") === null && fala.passo(TEMPOS.primeira + 5) === null && fala.passo(2 * TEMPOS.primeira)?.id === "vidro");
  const mouse = criarOcio({ acaso: () => 0 });
  mouse.passo(0);
  mouse.gesto(20, { fraco: true });
  conferir("o mouse andando também conta como gesto (adia a próxima)", mouse.passo(TEMPOS.primeira) === null && mouse.passo(20 + TEMPOS.primeira)?.id === "vidro");
  const parada = criarOcio({ acaso: () => 0.5 });
  parada.passo(0);
  const ate = parada.passo(TEMPOS.primeira);
  const dura = BRINCADEIRAS.find((b) => b.id === ate.id).duracao;
  conferir("inteira até o fim, e a próxima só depois do intervalo (45 a 90 s)",
    parada.passo(TEMPOS.primeira + dura) === null && parada.passo(TEMPOS.primeira + dura + TEMPOS.entre[0] - 1) === null
    && parada.passo(TEMPOS.primeira + dura + TEMPOS.entre[1])?.id !== undefined);
  const pedida = criarOcio();
  pedida.pedir("cantarola", 5);
  pedida.gesto(5.5, { fraco: true });
  conferir("a pedida (no /visual) começa na hora e o mouse andando não a encerra", pedida.passo(6)?.id === "cantarola" && pedida.passo(6).peso === 1);
  pedida.gesto(6.5);
  conferir("um clique encerra até a pedida", pedida.passo(6.5 + TEMPOS.saida + 0.01) === null);
  pedida.pedir("lixo", 10);
  conferir("pedir uma que não existe não faz nada", pedida.passo(10.1) === null);

  // o roteiro: números de verdade o tempo todo, e começa e termina com tudo fora da tela
  const numeros = (o) => JSON.stringify(o, (k, v) => (typeof v === "number" && !Number.isFinite(v) ? "NaN!" : v)).includes("NaN!") === false;
  let tudoNumero = true;
  for (const b of BRINCADEIRAS) for (let s = 0; s <= b.duracao; s += 0.05) for (const peso of [1, 0.5, 0]) tudoNumero &&= numeros(poseDaBrincadeira(b.id, s, peso));
  conferir("todas as poses, a cada 50 ms e com qualquer peso, só com números de verdade", tudoNumero);
  const foraDaTela = (pose) => (!pose.mao || pose.mao.centro[1] < -2.5) && (!pose.mao2 || pose.mao2.centro[1] < -2.5) && (!pose.jogo || (pose.jogo.pos[1] < -2.5 && pose.jogo.tela === 0));
  conferir("começa e termina com as mãos e o videogame fora da tela", BRINCADEIRAS.every((b) => foraDaTela(poseDaBrincadeira(b.id, 0)) && foraDaTela(poseDaBrincadeira(b.id, b.duracao))));
  conferir("peso 0 (fim da saída): tudo fora, cabeça e boca no lugar, nada escrito",
    BRINCADEIRAS.every((b) => { const p = poseDaBrincadeira(b.id, 3, 0); return foraDaTela(p) && !p.cabeca.yaw && !p.cabeca.pitch && !p.cabeca.roll && !p.boca && p.falas.every((f) => !f.opacidade) && p.notas.every((n) => !n.opacidade); }));

  const quadro = enquadramentoDoRosto(1.2);
  const noVidro = poseDaBrincadeira("vidro", 1.45);
  conferir("vidro: o punho chega perto da tela (bem na frente do rosto) e bate", noVidro.mao.centro[2] > 2.1 && poseDaBrincadeira("vidro", 1.3).mao.centro[2] < noVidro.mao.centro[2]);
  const [u, v] = uvDoPonto(noVidro.mao.centro, quadro);
  conferir("vidro: o punho aparece ao lado do rosto, perto da altura dos olhos, dentro do quadro", u < -0.45 && u > -1.05 && v > -0.2 && v < 0.5, `${u.toFixed(2)}, ${v.toFixed(2)}`);
  // a mão (02/11/2026: "está pequena para o tamanho do corpo e nada parecida com uma mão humana")
  const [po, de, co] = noVidro.mao.eixos;
  const unitario = (a) => Math.abs(Math.hypot(...a) - 1) < 1e-9;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  conferir("vidro: os eixos da mão (polegar, dedos, costas) são perpendiculares e de tamanho 1", [po, de, co].every(unitario) && Math.abs(dot(po, de)) < 1e-9 && Math.abs(dot(po, co)) < 1e-9 && Math.abs(dot(de, co)) < 1e-9);
  // (02/11/2026: "ela faz como se fosse um murro na tela, ao invés de bater como em portas")
  const emPe = poseDaBrincadeira("vidro", 2.2);
  const armando = poseDaBrincadeira("vidro", 1.3);
  conferir("vidro: batida de porta, e não soco — a mão em pé, a palma para o vidro e o polegar do lado do rosto", emPe.mao.eixos[1][1] > 0.9 && emPe.mao.eixos[2][2] < -0.9 && po[0] > 0.7);
  conferir("vidro: quem bate é o pulso (a mão dobra para o vidro e volta; o pulso quase não sai do lugar)",
    de[2] > armando.mao.eixos[1][2] + 0.4 && de[2] > emPe.mao.eixos[1][2] + 0.25 && Math.hypot(...noVidro.mao.pulso.map((c, i) => c - emPe.mao.pulso[i])) < 0.08);
  conferir("vidro: o que encosta no vidro são os nós do meio dos dedos (a onda nasce na frente do punho, mais perto da câmera)", noVidro.batidas[0].ponto[2] > noVidro.mao.centro[2] + 0.2);
  const doPulso = noVidro.mao.centro.map((c, i) => c - noVidro.mao.pulso[i]);
  conferir("vidro: o pulso fica atrás do punho (mais longe da câmera) e o cotovelo, fora da tela", doPulso[2] > 0.4 && noVidro.mao.cotovelo[1] < -2.5);
  const palma = COISAS.match(/caixinha\(l - vec3\(0\.0, 0\.45, -0\.02\), vec3\(([\d.]+), ([\d.]+), ([\d.]+)\)/);
  conferir("vidro: a palma tem o tamanho de uma de verdade para a cabeça dela (quase metade da largura do rosto)", palma && Number(palma[1]) * 2 >= 0.55 && Number(palma[2]) * 2 >= 0.7, palma?.slice(1).join());
  const maoFechada = COISAS.slice(COISAS.indexOf("float maoFechada("), COISAS.indexOf("float dedoReto("));
  conferir("vidro: a mão fechada tem palma, quatro dedos de três falanges e o polegar em três partes",
    (maoFechada.match(/dedo\(l, /g) || []).length === 4 && (maoFechada.match(/po = (min\(po, )?cone\(/g) || []).length === 3 && /float dedo\(vec3 l, vec3 b, vec3 c, float r, vec3 a\)/.test(COISAS));
  const ondas = poseDaBrincadeira("vidro", 2).batidas;
  conferir("vidro: duas batidas, cada uma com a sua onda", ondas.length === 2 && ondas[0].idade > ondas[1].idade && ondas[1].idade > 0);
  conferir("vidro: \"toc toc\" e depois \"tem alguém aí?\"", poseDaBrincadeira("vidro", 2).falas[0].opacidade === 1 && poseDaBrincadeira("vidro", 4).falas[1].opacidade === 1 && poseDaBrincadeira("vidro", 4).falas[0].opacidade === 0);
  const jogando = poseDaBrincadeira("jogo", 5);
  conferir("jogo: o videogame nas mãos, a tela acesa e ela olhando para baixo", jogando.jogo.pos[1] > -1.1 && jogando.jogo.tela > 0.5 && jogando.cabeca.pitch > 0.2);
  conferir("jogo: na vitória ela levanta o rosto e comemora", poseDaBrincadeira("jogo", 9).cabeca.pitch < jogando.cabeca.pitch && poseDaBrincadeira("jogo", 9.4).falas[1].opacidade === 1);
  conferir("jogo: os bipes saem de cima do aparelho", jogando.notas.length > 0 && jogando.notas.every((n) => n.ponto[1] > jogando.jogo.pos[1]));
  const cancao = poseDaBrincadeira("cantarola", 4);
  conferir("cantarola: a cabeça balança, a garganta esquenta e as notas sobem", Math.abs(poseDaBrincadeira("cantarola", 3.3).cabeca.roll) > 0.05 && cancao.calorBoca > 0.2 && cancao.notas.length >= 2 && cancao.notas.every((n) => n.deriva[1] < 0));
  conferir("cantarola: sem punho e sem videogame", !cancao.mao && !cancao.jogo);

  // o mímico saiu (03/11/2026, BEYOND-0021: "tire a animação da Lisa pondo as mãos na tela")
  conferir("o mímico com as mãos no vidro não está mais entre as brincadeiras (nem no ócio, nem no /visual)",
    BRINCADEIRAS.every((b) => b.id !== "preso") && !poseDaBrincadeira("preso", 2).mao && !poseDaBrincadeira("preso", 2).mao2);
  conferir("no celular em pé, as mãos chegam mais perto do rosto (não saem pela borda); na tela deitada, nada muda",
    apertoDaTela(390 / 760) < 0.8 && apertoDaTela(1.6) === 1 && poseDaBrincadeira("vidro", 1.45, 1, { proporcao: 0.5 }).mao.centro[0] > noVidro.mao.centro[0]);
  conferir("a caixa marchada vai até a segunda mão também", frenteDaCaixa({ mao2: { centro: [0, 0, 2.4] } }) > 3);

  conferir("a câmera da projeção é a do shader: o centro do quadro cai no meio do visual",
    naTela([0, quadro.centroY, 0], quadro, 800, 600, 0.78).every((c, i) => Math.abs(c - [400, 300][i]) < 1e-9));
  conferir("e mais perto da câmera, maior (o punho no vidro sai mais longe do centro que o mesmo ponto lá atrás)",
    Math.abs(uvDoPonto([-0.6, 0, 2.7], quadro)[0]) > Math.abs(uvDoPonto([-0.6, 0, 0], quadro)[0]));
  conferir("a caixa marchada vai até o punho no vidro, e só nessa hora", frenteDaCaixa(null) === CAIXA.max[2] && frenteDaCaixa(noVidro) > noVidro.mao.centro[2] + 0.5 &&frenteDaCaixa(poseDaBrincadeira("cantarola", 3)) === CAIXA.max[2]);

  conferir("o desenho do punho e do videogame em GLSL, sem número solto em vec3", /float punho\(vec3 p\)/.test(COISAS) && /float aparelho\(vec3 p, out float maos\)/.test(COISAS) && !/NaN|undefined/.test(COISAS) && !/vec3\(\s*-?\d+\s*,/.test(COISAS));
  conferir("longe das mãos, os dedos não são calculados (só a esfera que contém a mão)", /esfera > 0\.12 \? esfera : maoFechada\(l\)/.test(COISAS) && /esfera > 0\.1 \? esfera : maoNoJogo\(m\)/.test(COISAS) && /esfera > 0\.12 \? esfera : maoAberta\(a\)/.test(COISAS));
  const maoAberta = COISAS.slice(COISAS.indexOf("float maoAberta("), COISAS.indexOf("float palmaNoVidro("));
  conferir("a mão aberta do mímico: palma, quatro dedos esticados de três falanges e o polegar em três partes, menor que a fechada",
    (maoAberta.match(/dedoReto\(l, /g) || []).length === 4 && (maoAberta.match(/po = (min\(po, )?cone\(/g) || []).length === 3 && /vec3 a = l \/ 0\.84;/.test(COISAS) && /float outraMao\(vec3 p\)/.test(COISAS) && /if \(uMaoAberta > 0\.5\) return uniao\(palmaNoVidro\(l\), braco, 0\.1\)/.test(COISAS));
  conferir("jogo: as mãos seguram as pontas, com três dedos nas costas, o indicador em cima e o polegar na frente",
    /float maoNoJogo\(vec3 m\)/.test(COISAS) && /vec3 m = vec3\(abs\(l\.x\), l\.y, l\.z\)/.test(COISAS));
  const rosto = ler("src/components/panels/visuais/Rosto.js");
  conferir("o Rosto injeta as coisas, marcha a cena inteira e ondula o vidro",
    /\$\{COISAS\}/.test(rosto) && /d = cena\(ro \+ rd \* t, orelha, fio, coisa\)/.test(rosto) && /batida\(uBatida1, uv, desvio, luzDoVidro\)/.test(rosto) && /uFrente\) - ro\) \* inv/.test(rosto));
  conferir("o Rosto escuta os gestos, o pedido do /visual, e solta tudo ao sair",
    /\["pointerdown", "keydown", "wheel", "touchstart"\]/.test(rosto) && /ocio\.gesto\(agora\(\), \{ fraco: true \}\)/.test(rosto) && /addEventListener\(EVENTO_DA_BRINCADEIRA/.test(rosto) && /removeEventListener\(EVENTO_DA_BRINCADEIRA/.test(rosto) && /camada\.remove\(\)/.test(rosto));
  conferir("com \"reduzir movimento\", não brinca", /brincarRef\.current && !reduzido \? ocio\.passo/.test(rosto));
  conferir("o Rosto desenha a segunda mão, a mão aberta e passa a proporção da tela",
    /uniform vec4 uMao2;/.test(rosto) && /uniform float uMaoAberta;/.test(rosto) && /min\(min\(punho\(p\), outraMao\(p\)\), maos\)/.test(rosto) && /porAMao\(pose\?\.mao2, \[uniforms\.uMao2/.test(rosto) && /poseDaBrincadeira\(b\.id, b\.s, b\.peso, \{ proporcao \}\)/.test(rosto));
  conferir("a onda do vidro é leve (batida de porta, não soco)", /\* 0\.007 \* some/.test(rosto) && !/\* 0\.012 \* some/.test(rosto));
  const pagina = ler("src/app/(panels)/assistant/page.js");
  conferir("o Assistente liga as brincadeiras (no computador e no celular); a galeria do /visual, não",
    (pagina.match(/<VisualDaLisa [^>]*brincadeiras \/>/g) || []).length === 2 && /<VisualDaLisa key=\{`grande-\$\{naPrevia\}`\}[^>]*brincadeiras \/>/.test(ler("src/app/(panels)/visual/page.js")) && /<VisualDaLisa modo=\{x\.id\} obterSinal=\{obterSinal\} ocupacao=\{0\.82\} \/>/.test(ler("src/app/(panels)/visual/page.js")));
  conferir("o seletor passa adiante", /brincadeiras=\{brincadeiras\}/.test(ler("src/components/panels/visuais/VisualDaLisa.js")));
  // BEYOND-0012: abrir o Assistente com o Rosto travava a página (30 s medidos no Edge com WebGL por
  // software): o primeiro render() esperava compilar um shader com nove cópias da cena
  const chamadasDaCena = (rosto.match(/cena\(/g) || []).length - 1; // menos a declaração
  conferir("o shader chama a cena só duas vezes (a marcha e o laço da normal), e a normal uma vez",
    chamadasDaCena === 2 && (rosto.match(/normalEm\(p, /g) || []).length === 1, `cena: ${chamadasDaCena}`);
  conferir("os laços começam num uniform (o compilador não os desenrola)",
    /uniform int uZero;/.test(rosto) && /for \(int i = uZero; i < 80; i\+\+\)/.test(rosto) && /for \(int i = uZero; i < 4; i\+\+\)/.test(rosto) && /uZero: \{ value: 0 \}/.test(rosto) && !/for \(int i = 0;/.test(rosto));
  conferir("a normal do tetraedro tem os mesmos quatro cantos de antes", (() => {
    const canto = (i) => [((i + 3) >> 1) & 1, (i >> 1) & 1, i & 1].map((b) => 2 * b - 1).join();
    return [0, 1, 2, 3].map(canto).join(" ") === "1,-1,-1 -1,-1,1 -1,1,-1 1,1,1";
  })());
  conferir("compila em paralelo antes do primeiro quadro, sem travar a página",
    /renderer\.compileAsync\(cena, camera\)\.then\(comecar, comecar\)/.test(rosto) && !/\n    quadro = requestAnimationFrame\(animar\);\n/.test(rosto) && /vivo = false;/.test(rosto));
}

console.log("preferência no navegador");
{
  const guardado = new Map();
  const avisos = [];
  globalThis.localStorage = { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => guardado.set(k, String(v)) };
  globalThis.window = { dispatchEvent: (e) => avisos.push(e) };
  globalThis.CustomEvent ??= class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  conferir("sem escolha guardada, o padrão", lerVisual() === VISUAL_PADRAO);
  conferir("escolher guarda e devolve o id", escolherVisual("plasma") === "plasma" && guardado.get(CHAVE_DO_VISUAL) === "plasma" && lerVisual() === "plasma");
  conferir("e avisa a aba aberta", avisos.at(-1)?.type === EVENTO_DO_VISUAL && avisos.at(-1)?.detail === "plasma");
  guardado.set(CHAVE_DO_VISUAL, "lixo");
  conferir("valor estragado no navegador volta ao padrão", lerVisual() === VISUAL_PADRAO);
  conferir("escolher um id que não existe fica no padrão", escolherVisual("xyz") === VISUAL_PADRAO);
  globalThis.localStorage = { getItem() { throw new Error("bloqueado"); }, setItem() { throw new Error("bloqueado"); } };
  conferir("navegador sem armazenamento: não quebra", lerVisual() === VISUAL_PADRAO && escolherVisual("anel") === "anel");
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
