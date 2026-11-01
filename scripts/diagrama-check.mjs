// Guarda o diagrama da Lisa (src/lib/diagramaDaLisa.js, BEYOND-0010): conferir o desenho que a IA
// devolve, o layout em camadas (sem formas uma em cima da outra, cada uma na raia dela), manter onde
// a pessoa deixou as formas que continuam, a estrutura e o texto do desenho que voltam para a Lisa, e
// quando a conversa pede para desenhar ou mudar o desenho.

import {
  validarDesenho, camadasDoDesenho, posicoesDoDesenho, montarDocumento, estruturaDoDocumento, descreverDiagrama,
  pedidoDeDesenho, documentoValido, FORMAS,
} from "../src/lib/diagramaDaLisa.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));
const seSobrepoem = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// o processo de compras do exemplo: pedido → aprovação (decisão) → compra ou recusa, com um laço
const bruto = {
  titulo: "Compras", colecao: "flow", explicacao: "O pedido passa pela aprovação.",
  formas: [
    { id: "inicio", tipo: "terminal", texto: "Início" },
    { id: "Pedido de Compra", tipo: "process", texto: "Registrar o pedido" },
    { id: "aprova", tipo: "decision", texto: "Aprovado?" },
    { id: "compra", tipo: "process", texto: "Comprar" },
    { id: "ajusta", tipo: "inventado", texto: "Ajustar o pedido" },
    { id: "fim", tipo: "terminal", texto: "Fim" },
    { id: "fim", tipo: "note", texto: "id repetido" },
  ],
  ligacoes: [
    { de: "inicio", para: "Pedido de Compra" }, { de: "pedido-de-compra", para: "aprova" },
    { de: "aprova", para: "compra", rotulo: "Sim" }, { de: "aprova", para: "ajusta", rotulo: "Não" },
    { de: "ajusta", para: "pedido-de-compra", rotulo: "refazer", tracejada: true },
    { de: "compra", para: "fim" }, { de: "compra", para: "nao-existe" }, { de: "fim", para: "fim" },
  ],
};

console.log("\no desenho que a IA devolve");
{
  const d = validarDesenho(bruto);
  conferir("ids viram slug (sem acento, sem espaço)", d.formas[1].id === "pedido-de-compra");
  conferir("tipo desconhecido vira processo", d.formas.find((f) => f.id === "ajusta").tipo === "process");
  conferir("id repetido ganha sufixo", d.formas.filter((f) => f.id.startsWith("fim")).length === 2 && d.formas.some((f) => f.id === "fim-2"));
  conferir("ligação para forma que não existe e laço na mesma forma saem", d.ligacoes.length === 6, JSON.stringify(d.ligacoes.map((l) => `${l.de}>${l.para}`)));
  conferir("rótulo e tracejado ficam", d.ligacoes.some((l) => l.rotulo === "refazer" && l.tracejada));
  let erro = null;
  try { validarDesenho({ formas: [] }); } catch (e) { erro = e; }
  conferir("sem forma nenhuma: erro com motivo", erro && /nenhuma forma/.test(erro.message));
}

console.log("\no layout em camadas");
{
  const d = validarDesenho(bruto);
  const camadas = camadasDoDesenho(d.formas, d.ligacoes);
  const camadaDe = (id) => camadas.findIndex((c) => c.includes(id));
  conferir("cada forma vem depois de quem aponta para ela", camadaDe("inicio") < camadaDe("pedido-de-compra") && camadaDe("pedido-de-compra") < camadaDe("aprova") && camadaDe("aprova") < camadaDe("compra") && camadaDe("compra") < camadaDe("fim"));
  conferir("o laço de volta (refazer) não quebra as camadas", camadaDe("ajusta") === camadaDe("compra"));
  const { pos } = posicoesDoDesenho(d);
  const caixas = d.formas.map((f) => ({ id: f.id, ...pos.get(f.id), w: FORMAS[f.tipo].w, h: FORMAS[f.tipo].h }));
  let sobreposicao = null;
  for (let i = 0; i < caixas.length; i++) for (let j = i + 1; j < caixas.length; j++) if (seSobrepoem(caixas[i], caixas[j])) sobreposicao = `${caixas[i].id} × ${caixas[j].id}`;
  conferir("nenhuma forma em cima da outra (de cima para baixo)", !sobreposicao, sobreposicao);
  conferir("de cima para baixo: o início acima do fim", pos.get("inicio").y < pos.get("fim").y);
}

console.log("\nraias");
{
  const d = validarDesenho({
    titulo: "Pedido", formas: [
      { id: "a", tipo: "bpmnStart", texto: "Pedido", raia: "Cliente" }, { id: "b", tipo: "bpmnUserTask", texto: "Conferir", raia: "Loja" },
      { id: "c", tipo: "bpmnGatewayX", texto: "Tem estoque?", raia: "Loja" }, { id: "d", tipo: "bpmnServiceTask", texto: "Cobrar", raia: "Financeiro" },
      { id: "e", tipo: "bpmnUserTask", texto: "Avisar falta", raia: "Loja" }, { id: "f", tipo: "bpmnEnd", texto: "Fim", raia: "Cliente" },
    ],
    ligacoes: [{ de: "a", para: "b" }, { de: "b", para: "c" }, { de: "c", para: "d", rotulo: "sim" }, { de: "c", para: "e", rotulo: "não" }, { de: "d", para: "f" }, { de: "e", para: "f" }],
  });
  const { pos, raias } = posicoesDoDesenho(d);
  conferir("uma faixa por raia, na ordem em que apareceram", raias.map((r) => r.nome).join(",") === "Cliente,Loja,Financeiro");
  const dentroDaFaixa = d.formas.every((f) => { const r = raias.find((x) => x.nome === f.raia); const p = pos.get(f.id); return p.y >= r.y && p.y + FORMAS[f.tipo].h <= r.y + r.h; });
  conferir("cada forma dentro da faixa da raia dela", dentroDaFaixa);
  conferir("com raias, da esquerda para a direita", pos.get("a").x < pos.get("b").x && pos.get("c").x < pos.get("d").x);
  const doc = montarDocumento(d);
  const lanes = doc.pages[0].shapes.filter((s) => s.type === "lane");
  conferir("o documento traz as raias como formas do quadro", lanes.length === 3 && lanes[0].text === "Cliente");
  const est = estruturaDoDocumento(doc);
  conferir("a estrutura de volta sabe a raia de cada forma (pelo desenho)", est.formas.find((f) => f.id === "d").raia === "Financeiro" && est.formas.every((f) => f.tipo !== "lane"));
  const texto = descreverDiagrama(doc);
  conferir("o texto para a Lisa diz o que está dentro de cada raia e as ligações", /\[d\] tarefa de serviço.*"Cobrar" \(dentro de \[raia-financeiro\]\)/.test(texto) && /\[c\].*→ \[d\].*rótulo "sim"/.test(texto), texto.slice(0, 400));
}

console.log("\nmudar o desenho que a pessoa mexeu");
{
  const d1 = validarDesenho(bruto);
  const doc1 = montarDocumento(d1);
  // a pessoa arrastou o "Comprar" para outro lugar
  const comprar = doc1.pages[0].shapes.find((s) => s.id === "compra");
  comprar.x = 900; comprar.y = 50;
  const d2 = validarDesenho({ ...bruto, formas: [...bruto.formas.slice(0, 6), { id: "nf", tipo: "document", texto: "Nota fiscal" }], ligacoes: [...bruto.ligacoes, { de: "compra", para: "nf" }] });
  const doc2 = montarDocumento(d2, doc1);
  const comprar2 = doc2.pages[0].shapes.find((s) => s.id === "compra");
  conferir("a forma que continua fica onde a pessoa deixou", comprar2.x === 900 && comprar2.y === 50);
  const nf = doc2.pages[0].shapes.find((s) => s.id === "nf");
  const encosta = doc1.pages[0].shapes.find((s) => s.id !== "nf" && seSobrepoem(nf, s));
  conferir("a forma nova não cai em cima de nenhuma antiga", !encosta, encosta?.id);
  // uma raia nova entra logo abaixo das que já estavam (sem um vão enorme) e as formas dela vão junto
  const comRaias = (extra) => validarDesenho({ titulo: "R", formas: [{ id: "a", tipo: "process", texto: "A", raia: "Um" }, { id: "b", tipo: "process", texto: "B", raia: "Dois" }, ...extra], ligacoes: [{ de: "a", para: "b" }, ...(extra.length ? [{ de: "b", para: "c" }] : [])] });
  const r1 = montarDocumento(comRaias([]));
  const r2 = montarDocumento(comRaias([{ id: "c", tipo: "process", texto: "C", raia: "Três" }]), r1);
  const fundoDasRaias = Math.max(...r1.pages[0].shapes.filter((s) => s.type === "lane").map((s) => s.y + s.h));
  const tres = r2.pages[0].shapes.find((s) => s.id === "raia-tres");
  const c = r2.pages[0].shapes.find((s) => s.id === "c");
  conferir("a raia nova entra logo abaixo das antigas", tres.y >= fundoDasRaias && tres.y - fundoDasRaias < 40, `${tres.y} vs ${fundoDasRaias}`);
  conferir("e a forma nova fica dentro da raia nova", c.y >= tres.y && c.y + c.h <= tres.y + tres.h);
  conferir("o documento tem o formato do quadro", doc2.format === "processmap" && doc2.version === 4 && doc2.pages[0].connections.every((c) => c.from && c.to));
  conferir("documento grande demais ou sem formas não passa", documentoValido({ pages: [{ shapes: [{ text: "x".repeat(400_000) }] }] }) === null && documentoValido("x") === null && documentoValido(doc2) === doc2);
}

console.log("\nquando a conversa pede desenho");
{
  conferir("desenhar um processo: novo", pedidoDeDesenho("Lisa, desenhe o processo de compras da empresa") === "novo");
  conferir("fluxograma: novo", pedidoDeDesenho("faça um fluxograma do login") === "novo");
  conferir("mudar o desenho com o quadro aberto: alterar", pedidoDeDesenho("adicione uma etapa de aprovação do gerente", { quadroAberto: true }) === "alterar");
  conferir("o mesmo pedido sem o quadro: conversa normal", pedidoDeDesenho("adicione uma etapa de aprovação do gerente") === null);
  conferir("pergunta sobre o processo não é pedido de desenho", pedidoDeDesenho("como funciona o processo de compras?") === null);
  conferir("pergunta de código não é desenho", pedidoDeDesenho("crie uma função que soma dois números") === null);
  conferir("redesenhar este fluxo com o quadro aberto: alterar", pedidoDeDesenho("refaça esse fluxo separando em raias", { quadroAberto: true }) === "alterar");
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
