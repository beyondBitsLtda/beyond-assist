// Guarda os visuais da Lisa (src/lib/visuaisDaLisa.js): o catálogo completo e coerente, o
// envelope da voz (repouso quieto, fala viva, volume medido seguido), os pesos dos estados e a
// preferência guardada no navegador. O desenho em si (WebGL) só se confere no navegador.

import fs from "node:fs";
import {
  VISUAIS, ESTADOS, VISUAL_PADRAO, CHAVE_DO_VISUAL, EVENTO_DO_VISUAL,
  visualDe, coresDe, criarEnvelope, criarPesos, lerVisual, escolherVisual,
} from "../src/lib/visuaisDaLisa.js";
import { pontosDoRosto, distanciaDoRosto, OLHO, BOCA_Y, INCLINACAO } from "../src/lib/rostoDaLisa.js";

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
  let semente = 7;
  const acaso = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  const r = pontosDoRosto({ linhas: 60, passo: 0.014, angulos: 220, acaso });
  const ys = [];
  const at = (arr, i, k = 3) => Array.from(arr.subarray(i * k, i * k + k));
  for (let i = 0; i < r.total; i++) ys.push(r.posicoes[i * 3 + 1]);
  const amostra = Array.from({ length: 400 }, (_, i) => Math.floor((i * r.total) / 400));
  conferir("um busto inteiro de pontos", r.total > 12000, String(r.total));
  conferir("todos na superfície (distância ~0)", amostra.every((i) => Math.abs(distanciaDoRosto(...at(r.posicoes, i))) < 0.01));
  conferir("do peito ao alto da cabeça", Math.min(...ys) < -1.9 && Math.max(...ys) > 0.95, `${Math.min(...ys).toFixed(2)} ${Math.max(...ys).toFixed(2)}`);
  conferir("as normais têm tamanho 1", amostra.every((i) => Math.abs(Math.hypot(...at(r.normais, i)) - 1) < 1e-3));
  // cada linha é uma fatia inclinada: todos os pontos dela no mesmo plano y + INCLINACAO·z
  conferir("cada linha fica no seu plano", (() => {
    const plano = new Map();
    for (let i = 0; i < r.total; i++) {
      const s = r.posicoes[i * 3 + 1] + INCLINACAO * r.posicoes[i * 3 + 2];
      if (!plano.has(r.linha[i])) plano.set(r.linha[i], s);
      if (Math.abs(plano.get(r.linha[i]) - s) > 1e-3) return false;
    }
    return plano.size > 50;
  })());
  // onde o contorno se parte (atrás dos ombros), a linha vira dois trechos: nenhum ponto no vazio
  conferir("nenhum ponto solto no ar (todos, não só a amostra)", Array.from({ length: r.total }, (_, i) => i).every((i) => Math.abs(distanciaDoRosto(...at(r.posicoes, i))) < 0.02));
  // a cabeça gira sobre o pescoço; os ombros ficam
  conferir("os ombros não giram com a cabeça; a cabeça gira inteira", Array.from({ length: r.total }, (_, i) => i).every((i) => (r.posicoes[i * 3 + 1] < -1.32 ? r.cabeca[i] === 0 : true) && (r.posicoes[i * 3 + 1] > -0.84 ? r.cabeca[i] === 1 : true)));
  conferir("o cabelo fica no alto e atrás, não no rosto", Array.from({ length: r.total }, (_, i) => i).filter((i) => r.cabelo[i] > 0.5).every((i) => r.posicoes[i * 3 + 1] > 0.5 || r.posicoes[i * 3 + 2] < -0.05));
  const parte = (campo) => Array.from({ length: r.total }, (_, i) => i).filter((i) => r[campo][i] > 0.5);
  const olhos = parte("olho");
  conferir("há pontos nos dois olhos", olhos.some((i) => r.posicoes[i * 3] > 0) && olhos.some((i) => r.posicoes[i * 3] < 0) && olhos.length > 40, String(olhos.length));
  conferir("a íris de cada olho é medida no próprio olho (-1..1)", olhos.every((i) => Math.hypot(r.iris[i * 2], r.iris[i * 2 + 1]) <= 1.1));
  // os dois olhos medem a íris no mesmo sentido do mundo (não espelhado): o olhar é um só
  conferir("a íris é medida no mesmo sentido nos dois olhos", olhos.every((i) => {
    const x = r.posicoes[i * 3];
    return Math.abs(r.iris[i * 2] * OLHO.raio - (x - Math.sign(x) * OLHO.x)) < 1e-4 && Math.abs(r.iris[i * 2 + 1] * OLHO.raio - (r.posicoes[i * 3 + 1] - OLHO.y)) < 1e-4;
  }));
  const queixo = parte("mandibula");
  conferir("a mandíbula é só abaixo da boca e acima do pescoço", queixo.length > 100 && queixo.every((i) => r.posicoes[i * 3 + 1] < BOCA_Y && r.posicoes[i * 3 + 1] > -0.95), String(queixo.length));
  conferir("o lábio de cima fica acima da linha da boca, na frente", parte("labio").length > 10 && parte("labio").every((i) => r.posicoes[i * 3 + 1] > BOCA_Y && r.posicoes[i * 3 + 2] > 0.45));
  conferir("as sobrancelhas ficam acima dos olhos", parte("sobrancelha").length > 20 && parte("sobrancelha").every((i) => r.posicoes[i * 3 + 1] > OLHO.y + 0.05));
  conferir("a pálpebra fica logo acima do olho", parte("palpebra").every((i) => r.posicoes[i * 3 + 1] > OLHO.y && r.posicoes[i * 3 + 1] < OLHO.y + 0.16));
  conferir("rosto simétrico", Math.abs(distanciaDoRosto(0.3, -0.2, 0.5) - distanciaDoRosto(-0.3, -0.2, 0.5)) < 1e-12);
  conferir("o nariz é a parte mais da frente", (() => { let iz = 0; for (let i = 0; i < r.total; i++) if (r.posicoes[i * 3 + 2] > r.posicoes[iz * 3 + 2]) iz = i; return Math.abs(r.posicoes[iz * 3]) < 0.08 && r.posicoes[iz * 3 + 1] < 0 && r.posicoes[iz * 3 + 1] > -0.4; })());
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
