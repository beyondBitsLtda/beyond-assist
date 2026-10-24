// Guarda os visuais da Lisa (src/lib/visuaisDaLisa.js): o catálogo completo e coerente, o
// envelope da voz (repouso quieto, fala viva, volume medido seguido), os pesos dos estados e a
// preferência guardada no navegador. O desenho em si (WebGL) só se confere no navegador.

import fs from "node:fs";
import {
  VISUAIS, ESTADOS, VISUAL_PADRAO, CHAVE_DO_VISUAL, EVENTO_DO_VISUAL,
  visualDe, coresDe, criarEnvelope, criarPesos, lerVisual, escolherVisual,
} from "../src/lib/visuaisDaLisa.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));
const ler = (caminho) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

console.log("catálogo");
const ids = VISUAIS.map((v) => v.id);
conferir("os cinco visuais, sem id repetido", ids.join() === "esfera,lente,orbe,plasma,anel" && new Set(ids).size === ids.length, ids.join());
conferir("cada visual tem nome e descrição", VISUAIS.every((v) => v.nome && v.descricao.length > 20));
conferir("cada visual tem 3 cores válidas para cada estado", VISUAIS.every((v) => ESTADOS.every((e) => v.cores[e]?.length === 3 && v.cores[e].every((c) => /^#[0-9a-f]{6}$/i.test(c)))));
conferir("id desconhecido cai no padrão", visualDe("nao-existe").id === VISUAL_PADRAO && coresDe("nao-existe", "falando").join() === visualDe(VISUAL_PADRAO).cores.falando.join());
conferir("estado desconhecido usa as cores de repouso", coresDe("lente", "dormindo").join() === visualDe("lente").cores.pronta.join());
const seletor = ler("src/components/panels/visuais/VisualDaLisa.js");
conferir("todo visual do catálogo tem componente no seletor", ids.every((id) => new RegExp(`\\b${id}: dynamic\\(`).test(seletor)));
conferir("e cada componente novo tem o seu arquivo", ["Lente", "Orbe", "Plasma", "Anel"].every((n) => fs.existsSync(new URL(`../src/components/panels/visuais/${n}.js`, import.meta.url))));
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
