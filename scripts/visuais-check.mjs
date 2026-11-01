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
  ajustesValidos, lerAjustesDoRosto, escolherAjustesDoRosto, coresDoRosto,
} from "../src/lib/rostoDaLisa.js";

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
