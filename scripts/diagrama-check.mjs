// Guarda o diagrama da Lisa (src/lib/diagramaDaLisa.js, BEYOND-0010): conferir o desenho que a IA
// devolve, o layout em camadas (sem formas uma em cima da outra, cada uma na raia dela), manter onde
// a pessoa deixou as formas que continuam, a estrutura e o texto do desenho que voltam para a Lisa, e
// quando a conversa pede para desenhar ou mudar o desenho.

import {
  validarDesenho, camadasDoDesenho, posicoesDoDesenho, montarDocumento, estruturaDoDocumento, descreverDiagrama,
  pedidoDeDesenho, documentoValido, FORMAS, distanciaDeEdicao, pareceDiagramaEmTexto,
  pedeMapaMental, validarMapaMental, montarMapaMental, estruturaDoMapa, LIMITES_DO_MAPA,
} from "../src/lib/diagramaDaLisa.js";
import fs from "node:fs";

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
  // os pedidos de verdade, com erro de digitação (31/10/2026: caíam na conversa e a Lisa escrevia Mermaid)
  conferir("\"quero que desneho ess arquiettrua via processmap\": novo", pedidoDeDesenho("quero que desneho ess arquiettrua via processmap") === "novo");
  conferir("\"desnehe a arquitetura deste repositorio\": novo", pedidoDeDesenho("desnehe a arquitetura deste repositorio") === "novo");
  conferir("citar o quadro já é pedido (process map, quadro de diagramas)", pedidoDeDesenho("mostra isso no process map") === "novo" && pedidoDeDesenho("coloca no quadro de diagramas") === "novo");
  conferir("\"quero um diagrama do processo de vendas\": novo", pedidoDeDesenho("quero um diagrama do processo de vendas") === "novo");
  conferir("pergunta com o verbo de pedir: novo", pedidoDeDesenho("pode desenhar o fluxo do login?") === "novo");
  conferir("pergunta sobre um desenho não é pedido", pedidoDeDesenho("meu desenho de arquitetura está certo?") === null);
  conferir("desenvolva / deseja não viram desenhe", pedidoDeDesenho("desenvolva uma função que valida o processo") === null && pedidoDeDesenho("deseja ver o fluxo?") === null);
  conferir("criar um processo de deploy (código) não é desenho", pedidoDeDesenho("crie um processo de deploy no github actions") === null);
  conferir("card no quadro do Abacato não é desenho", pedidoDeDesenho("crie um card no quadro Notas") === null);
  conferir("com o quadro aberto, desenhar outra coisa é desenho novo", pedidoDeDesenho("desenhe a arquitetura do sistema de pagamentos", { quadroAberto: true }) === "novo");
  conferir("a distância de edição conta a inversão como 1", distanciaDeEdicao("desneho", "desenho") === 1 && distanciaDeEdicao("arquiettrua", "arquitetura") === 2);
}

console.log("\ndiagrama em texto na IDE (o botão de desenhar no quadro)");
{
  conferir("Mermaid (flowchart TD) é diagrama", pareceDiagramaEmTexto("flowchart TD\n    subgraph Entrada\n    A --> B\n    end"));
  conferir("pela linguagem do bloco (mermaid, plantuml)", pareceDiagramaEmTexto("A --> B", "mermaid") && pareceDiagramaEmTexto("x", "plantuml"));
  conferir("PlantUML e Graphviz também", pareceDiagramaEmTexto("@startuml\nA -> B\n@enduml") && pareceDiagramaEmTexto("digraph G { a -> b }"));
  conferir("código comum não é", !pareceDiagramaEmTexto("function soma(a, b) {\n  return a + b;\n}", "javascript") && !pareceDiagramaEmTexto("const graph = {}"));
}

console.log("\no mapa mental (01/11/2026)");
{
  conferir("reconhece o pedido de mapa mental", pedeMapaMental("faça um MAPA MENTAL sobre vendas") && pedeMapaMental("crie mapas mentais") && pedeMapaMental("um mind map do projeto") && !pedeMapaMental("o mapa do site") && !pedeMapaMental("mapa de calor"));
  conferir("\"faça um mapa mental sobre X\" desenha no quadro", pedidoDeDesenho("faça um mapa mental sobre o lançamento do app") === "novo" && pedidoDeDesenho("desenhe um mind map de marketing") === "novo");
  conferir("\"o que é um mapa mental?\" continua conversa", pedidoDeDesenho("o que é um mapa mental?") === null);
  conferir("com o mapa aberto, \"mude esse mapa\" é mudança", pedidoDeDesenho("refaça esse mapa com menos tópicos", { quadroAberto: true }) === "alterar");
  const bruto = {
    titulo: "Lançamento", tema: "App de delivery", explicacao: "Montei o mapa.",
    topicos: [
      { id: "Pesquisa Inicial", texto: "Pesquisa", filhos: [{ id: "publico", texto: "Público", filhos: [{ id: "x", texto: "Idade" }, { texto: "  " }] }, { texto: "" }] },
      { id: "publico", texto: "Marketing", filhos: [] },
      { texto: "Operação" },
      ...Array.from({ length: 10 }, (_, i) => ({ texto: `Extra ${i}` })),
    ],
  };
  const mapa = validarMapaMental(bruto);
  conferir("até 8 tópicos principais", mapa.topicos.length === LIMITES_DO_MAPA.topicos);
  conferir("tópico sem texto sai; ids limpos e sem repetir", mapa.topicos[0].id === "pesquisa-inicial" && mapa.topicos[0].filhos.length === 1 && mapa.topicos[0].filhos[0].filhos.length === 1 && mapa.topicos[1].id !== "publico");
  conferir("três níveis abaixo do tema, no máximo", !("filhos" in mapa.topicos[0].filhos[0].filhos[0]));
  const doc = montarMapaMental(mapa);
  const nos = doc.pages[0].shapes;
  conferir("vira um documento de mapa mental do quadro", doc.mode === "mindmap" && doc.format === "processmap" && doc.version === 4 && nos[0].type === "mmRoot" && nos[0].text === "App de delivery" && doc.pages[0].connections.length === 0);
  const galhos = nos.filter((s) => s.parent === nos[0].id);
  conferir("os galhos se alternam entre direita e esquerda, cada um com uma cor", galhos.length === 8 && galhos[0].side === "right" && galhos[1].side === "left" && new Set(galhos.slice(0, 5).map((s) => s.color)).size === 5);
  conferir("todo tópico pendura num nó que existe", nos.slice(1).every((s) => s.type === "mmNode" && nos.some((p) => p.id === s.parent)));
  conferir("a estrutura volta igual (para a Lisa mudar o mapa)", JSON.stringify(estruturaDoMapa(doc).topicos) === JSON.stringify(mapa.topicos));
  // a pessoa arrumou o primeiro galho (recolheu, arrastou, trocou de lado e de cor) e pendurou um tópico no 4º nível
  const arrumado = JSON.parse(JSON.stringify(doc));
  const g0 = arrumado.pages[0].shapes.find((s) => s.id === "pesquisa-inicial");
  Object.assign(g0, { collapsed: true, ox: 30, oy: -12, side: "left", color: "red" });
  arrumado.pages[0].shapes.push({ id: "fundo", type: "mmNode", text: "Faixa 18-25", parent: "x" });
  const mudado = montarMapaMental(validarMapaMental({ ...bruto, topicos: bruto.topicos.slice(0, 3) }), arrumado);
  const g1 = mudado.pages[0].shapes.find((s) => s.id === "pesquisa-inicial");
  conferir("numa mudança, o que a pessoa arrumou fica (recolhido, posição, lado, cor)", g1.collapsed === true && g1.ox === 30 && g1.oy === -12 && g1.side === "left" && g1.color === "red");
  conferir("e o tópico fundo que a Lisa não vê volta pendurado onde estava", mudado.pages[0].shapes.some((s) => s.id === "fundo" && s.parent === "x"));
  conferir("um fluxograma na tela não empresta nada a um mapa novo", montarMapaMental(mapa, { mode: "diagram", pages: [{ shapes: [{ id: "pesquisa-inicial", ox: 99 }] }] }).pages[0].shapes.find((s) => s.id === "pesquisa-inicial").ox === undefined);
  conferir("a Lisa lê o mapa como árvore (o recuo é o nível)", /MAPA MENTAL "Lançamento"/.test(descreverDiagrama(doc)) && /\n {4}- \[publico\] "Público"/.test(descreverDiagrama(doc)));
  const rota = fs.readFileSync(new URL("../src/app/api/diagrama/route.js", import.meta.url), "utf8");
  conferir("a rota desenha mapa mental quando pedem ou quando há um mapa na tela", /pedeMapaMental\(pedido\)/.test(rota) && /mapaNaTela/.test(rota) && /desenharMapaMental/.test(rota));
  const fm = fs.readFileSync(new URL("../public/diagramas/js/FileManager.js", import.meta.url), "utf8");
  conferir("o quadro reabre o mapa com as cores dos galhos (não tudo roxo)", /def\.mind && !PM\.Palette\.some/.test(fm));
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
