// Exercita a decisão do Modo Escuta sem microfone e sem navegador.
//
// Este é o tipo de código que parece trivial e erra em silêncio: acordar com "analisa",
// mandar "toca pink floyd" para o Gemini como se fosse pergunta, ou tocar a música errada
// porque o pedido casou por uma palavra qualquer. Nada disso levanta exceção — só faz a Lisa
// parecer burra, e aí não dá para saber se foi o reconhecimento de fala ou a lógica.

import { detectarAcordar, interpretarComando, escolherMusica, normalizar } from "../src/lib/escutaPorPalavra.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

console.log("\n1) acordar: o que deve e o que não deve");
{
  for (const frase of ["Lisa", "lisa", "LISA", "ei Lisa", "Liza", "lise", "ô lisinha"]) {
    conferir(`acorda com "${frase}"`, detectarAcordar(frase).acordou);
  }
  // Estas são as que causam dano: acordar sozinha no meio de uma conversa.
  for (const frase of ["a gente analisa isso depois", "ele alisa o cabelo", "vou pedir na Alexa", "paralisa tudo"]) {
    conferir(`NÃO acorda com "${frase}"`, !detectarAcordar(frase).acordou);
  }
}

console.log("\n2) acordar e mandar o comando no mesmo fôlego");
{
  const r = detectarAcordar("Lisa, que horas são?");
  conferir("pega o que veio depois da palavra", r.acordou && r.resto === "que horas sao", `veio "${r.resto}"`);

  const so = detectarAcordar("Lisa");
  conferir("só a palavra deixa o resto vazio", so.acordou && so.resto === "", `veio "${so.resto}"`);

  // Correção no meio da fala: vale a ÚLTIMA ocorrência, não a primeira.
  const c = detectarAcordar("lisa... não, Lisa toca rock");
  conferir("com duas ocorrências, vale a última", c.resto === "toca rock", `veio "${c.resto}"`);
}

console.log("\n3) separar pedido de música de pergunta");
{
  const casos = [
    ["toca pink floyd", "tocar", "pink floyd"],
    ["põe uma música do metallica", "tocar", "metallica"],
    ["coloca aquele som do pink floyd no youtube", "tocar", "aquele pink floyd"],
    ["bota rock aí pra mim", "tocar", "rock"],
    ["para", "parar", null],
    ["pausa a música", "parar", null],
    ["pula essa", "pular", null],
    ["próxima", "pular", null],
  ];
  for (const [frase, tipo, alvo] of casos) {
    const r = interpretarComando(frase);
    conferir(`"${frase}" → ${tipo}`, r.tipo === tipo, `veio ${r.tipo}`);
    if (alvo !== null) conferir(`  e o alvo é "${alvo}"`, r.alvo === alvo, `veio "${r.alvo}"`);
  }

  // Tudo que não é comando conhecido vira pergunta — inclusive coisas que CITAM música.
  for (const frase of ["que horas são", "quantas tarefas eu tenho hoje", "quem compôs essa música", "como está o tempo"]) {
    conferir(`"${frase}" → perguntar`, interpretarComando(frase).tipo === "perguntar");
  }
  conferir("comando vazio é reconhecido como vazio", interpretarComando("   ").tipo === "vazio");
}

console.log("\n4) achar a música certa na playlist");
{
  const playlist = [
    { title: "Pink Floyd - Wish You Were Here" },
    { title: "Metallica - Nothing Else Matters" },
    { title: "Legião Urbana - Tempo Perdido" },
    { title: "Djavan - Se..." },
  ];
  conferir("acha pelo artista", escolherMusica("pink floyd", playlist)?.title.includes("Pink Floyd"));
  conferir("acha pelo trecho do título", escolherMusica("nothing else matters", playlist)?.title.includes("Metallica"));
  conferir("acha com acento diferente do escrito", escolherMusica("legiao urbana", playlist)?.title.includes("Legião"));
  conferir("acha com palavra a mais no pedido", escolherMusica("aquela do pink floyd", playlist)?.title.includes("Pink Floyd"));

  // O caso que destrói a confiança no modo: tocar qualquer coisa quando não achou.
  conferir("não inventa quando não tem", escolherMusica("beethoven quinta sinfonia", playlist) === null,
           `devolveu ${escolherMusica("beethoven quinta sinfonia", playlist)?.title}`);
  conferir("pedido vazio não devolve nada", escolherMusica("", playlist) === null);
  conferir("playlist vazia não quebra", escolherMusica("pink floyd", []) === null);
  conferir("playlist ausente não quebra", escolherMusica("pink floyd", undefined) === null);
  // "se" e "do" têm 2 letras e são descartados — senão casariam com meio mundo.
  conferir("palavras curtas demais não contam", escolherMusica("se do", playlist) === null);
}

console.log("\n5) normalizar aguenta o que o reconhecimento entrega");
{
  conferir("tira acento", normalizar("MÚSICA") === "musica");
  conferir("tira pontuação", normalizar("Lisa, toca!") === "lisa toca");
  conferir("junta espaços", normalizar("  a    b  ") === "a b");
  conferir("nulo não quebra", normalizar(null) === "");
}

console.log("\n6) o caminho inteiro, como acontece na vida");
{
  const playlist = [{ title: "Pink Floyd - Wish You Were Here" }];
  const dito = "ei Lisa, toca aquela do pink floyd";
  const acordou = detectarAcordar(dito);
  conferir("acordou", acordou.acordou);
  const cmd = interpretarComando(acordou.resto);
  conferir("entendeu que é música", cmd.tipo === "tocar", `veio ${cmd.tipo}`);
  conferir("achou a faixa", escolherMusica(cmd.alvo, playlist)?.title === "Pink Floyd - Wish You Were Here");

  const dito2 = "Lisa quantas tarefas eu tenho hoje";
  const cmd2 = interpretarComando(detectarAcordar(dito2).resto);
  conferir("pergunta sobre os assuntos vira pergunta", cmd2.tipo === "perguntar" && cmd2.texto === "quantas tarefas eu tenho hoje",
           `veio ${cmd2.tipo} "${cmd2.texto}"`);
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
