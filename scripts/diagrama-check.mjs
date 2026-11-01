// Guarda o diagrama da Lisa (src/lib/diagramaDaLisa.js, BEYOND-0010): conferir o desenho que a IA
// devolve, o layout em camadas (sem formas uma em cima da outra, cada uma na raia dela), manter onde
// a pessoa deixou as formas que continuam, a estrutura e o texto do desenho que voltam para a Lisa, e
// quando a conversa pede para desenhar ou mudar o desenho.

import {
  validarDesenho, camadasDoDesenho, posicoesDoDesenho, montarDocumento, estruturaDoDocumento, descreverDiagrama,
  pedidoDeDesenho, documentoValido, FORMAS, distanciaDeEdicao, pareceDiagramaEmTexto,
  pedeMapaMental, validarMapaMental, montarMapaMental, estruturaDoMapa, LIMITES_DO_MAPA,
  CORES, NOMES_DAS_CORES, corPeloNome, nomeDaCor, vaiSerMapaMental, semPerdas, PEDE_PARA_TIRAR, estruturaQueCabe,
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
  const est = estruturaDoDocumento(doc).abas[0];
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
  const semCor = (lista) => JSON.parse(JSON.stringify(lista, (k, v) => (k === "cor" ? undefined : v)));
  conferir("a estrutura volta igual (para a Lisa mudar o mapa)", JSON.stringify(semCor(estruturaDoMapa(doc).topicos)) === JSON.stringify(mapa.topicos));
  conferir("e leva a cor de cada galho, pelo nome", estruturaDoMapa(doc).topicos.slice(0, 3).map((t) => t.cor).join() === "verde,azul-escuro,âmbar");
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
  conferir("a rota desenha mapa mental quando pedem ou quando há um mapa na tela", /vaiSerMapaMental\(pedido, atual\)/.test(rota) && /mapaNaTela/.test(rota) && /desenharMapaMental/.test(rota));
  const mapaNaTela = { mode: "mindmap", pages: [{ shapes: [] }] };
  conferir("mapa na tela continua mapa, mesmo com \"processo\" no pedido (antes, virava fluxograma e o mapa sumia)",
    vaiSerMapaMental("adicione um tópico explicando as decisões do processo", mapaNaTela) && vaiSerMapaMental("inclua um galho de riscos", mapaNaTela));
  conferir("só deixa de ser mapa se o pedido for transformar em fluxograma", !vaiSerMapaMental("transforme esse mapa em um fluxograma", mapaNaTela) && !vaiSerMapaMental("refaça como diagrama BPMN", mapaNaTela));
  conferir("sem mapa na tela, só quando o pedido fala em mapa mental", vaiSerMapaMental("faça um mapa mental", null) && !vaiSerMapaMental("desenhe o processo", { mode: "diagram" }));
  const fm = fs.readFileSync(new URL("../public/diagramas/js/FileManager.js", import.meta.url), "utf8");
  conferir("o quadro reabre o mapa com as cores dos galhos (não tudo roxo)", /def\.mind && !PM\.Palette\.some/.test(fm));
}

console.log("\nas cores (01/11/2026: \"limpe as atividades da cor vermelha\")");
{
  conferir("cada cor do quadro tem um nome, sem repetir", Object.keys(CORES).join() === "purple,deep,lilac,graphite,white,green,amber,red" && new Set(NOMES_DAS_CORES).size === 8);
  conferir("o nome, o id e os jeitos de dizer viram a cor do quadro", corPeloNome("vermelho") === "red" && corPeloNome("Vermelha") === "red" && corPeloNome("Âmbar") === "amber" && corPeloNome("laranja") === "amber" && corPeloNome("azul-escuro") === "deep" && corPeloNome("azul escuro") === "deep" && corPeloNome("green") === "green");
  conferir("o que não é cor fica de fora", corPeloNome("rosa") === null && corPeloNome("") === null && corPeloNome(null) === null);
  conferir("sem cor, a forma é azul (a principal do tema da Lisa)", nomeDaCor(undefined) === "azul" && nomeDaCor("purple") === "azul" && nomeDaCor("red") === "vermelho");

  // um fluxo com duas atividades vermelhas
  const tela = montarDocumento(validarDesenho({
    titulo: "Pedido", colecao: "flow", explicacao: "",
    formas: [
      { id: "ini", tipo: "terminal", texto: "Início" }, { id: "a", tipo: "process", texto: "Registrar" },
      { id: "b", tipo: "process", texto: "Conferir estoque" }, { id: "c", tipo: "process", texto: "Pedir ao fornecedor" },
      { id: "d", tipo: "process", texto: "Pagar" }, { id: "fim", tipo: "terminal", texto: "Fim" },
    ],
    ligacoes: [{ de: "ini", para: "a" }, { de: "a", para: "b" }, { de: "b", para: "c" }, { de: "c", para: "d" }, { de: "d", para: "fim" }],
  }));
  for (const s of tela.pages[0].shapes) if (s.id === "b" || s.id === "c") s.color = "red";
  const pos = Object.fromEntries(tela.pages[0].shapes.map((s) => [s.id, s.x + "," + s.y]));
  const estDoc = estruturaDoDocumento(tela);
  const est = estDoc.abas[0];
  conferir("a Lisa recebe a cor de cada forma", est.formas.find((f) => f.id === "b").cor === "vermelho" && est.formas.find((f) => f.id === "a").cor === "azul" && est.formas.find((f) => f.id === "ini").cor === "azul-escuro");
  conferir("e lê as cores na conversa (\"quais estão em vermelho?\")", /\[b\] [^\n]*, vermelho: "Conferir estoque"/.test(descreverDiagrama(tela)));
  conferir("validar: o nome vira a cor do quadro; cor inventada fica de fora", validarDesenho({ formas: [{ id: "x", tipo: "process", texto: "X", cor: "verde" }, { id: "y", tipo: "process", texto: "Y", cor: "rosa" }], ligacoes: [] }).formas.map((f) => f.cor ?? "-").join() === "green,-");
  // o que a IA devolve para "limpe as atividades da cor vermelha do fluxo": sem b e c, religado
  const limpo = montarDocumento(validarDesenho({
    titulo: "Pedido", colecao: "flow", explicacao: "Tirei as duas vermelhas.",
    formas: est.formas.filter((f) => f.cor !== "vermelho"),
    ligacoes: [{ de: "ini", para: "a" }, { de: "a", para: "d" }, { de: "d", para: "fim" }],
  }), tela);
  const ficaram = limpo.pages[0].shapes;
  conferir("limpar as vermelhas: elas saem, o fluxo fica religado", !ficaram.some((s) => s.id === "b" || s.id === "c") && limpo.pages[0].connections.some((c) => c.from === "a" && c.to === "d"));
  conferir("e o resto fica onde e da cor que estava", ficaram.every((s) => pos[s.id] === s.x + "," + s.y) && ficaram.find((s) => s.id === "ini").color === "deep" && ficaram.find((s) => s.id === "a").color === "purple");
  // "pinte as vermelhas de verde"
  const pintado = montarDocumento(validarDesenho({ ...estDoc, colecao: "flow", abas: [{ ...est, formas: est.formas.map((f) => (f.cor === "vermelho" ? { ...f, cor: "verde" } : f)) }] }), tela);
  conferir("pintar: a cor pedida vale, sem sair do lugar", pintado.pages[0].shapes.filter((s) => s.id === "b" || s.id === "c").every((s) => s.color === "green" && pos[s.id] === s.x + "," + s.y));
  conferir("a lista \"pintar\" vale por cima da cor da forma (o modelo às vezes só conta a troca)", validarDesenho({ formas: [{ id: "x", tipo: "process", texto: "X", cor: "azul" }, { id: "y", tipo: "process", texto: "Y" }], ligacoes: [], pintar: [{ id: "x", cor: "verde" }, { id: "nao-existe", cor: "verde" }, { id: "y", cor: "rosa" }] }).formas.map((f) => f.cor ?? "-").join() === "green,-");
  conferir("e nos galhos do mapa mental", validarMapaMental({ tema: "T", topicos: [{ id: "a", texto: "A", cor: "azul" }], pintar: [{ id: "a", cor: "vermelho" }] }).topicos[0].cor === "red");
  conferir("devolver a mesma cor não muda nada", montarDocumento(validarDesenho({ ...estDoc, colecao: "flow" }), tela).pages[0].shapes.every((s) => s.color === tela.pages[0].shapes.find((x) => x.id === s.id).color));

  conferir("\"limpe as atividades da cor vermelha do fluxo\", com o quadro aberto, muda o desenho", pedidoDeDesenho("limpe as atividades da cor vermelha do fluxo", { quadroAberto: true }) === "alterar");
  conferir("\"pinte as etapas de aprovação de verde\" também", pedidoDeDesenho("pinte as etapas de aprovação de verde", { quadroAberto: true }) === "alterar" && pedidoDeDesenho("deixe tudo que está em âmbar em vermelho", { quadroAberto: true }) === "alterar");
  conferir("sem quadro aberto, não vira desenho", pedidoDeDesenho("limpe as atividades da cor vermelha do fluxo") === null);
  conferir("galho do mapa mental: a cor pedida vale", montarMapaMental(validarMapaMental({ tema: "T", topicos: [{ texto: "A", cor: "vermelho" }, { texto: "B" }] })).pages[0].shapes.filter((s) => s.parent === "raiz").map((s) => s.color).join() === "red,deep");
}

console.log("\nas abas (01/11/2026: \"a Lisa deve poder criar abas dentro dos fluxogramas\")");
{
  // um documento de duas abas: o processo principal e o de pagamento, com uma imagem, um rabisco,
  // uma forma travada e uma ligação com estilo escolhido pela pessoa
  const principal = montarDocumento(validarDesenho({
    titulo: "Compras", colecao: "flow",
    formas: [{ id: "ini", tipo: "terminal", texto: "Início" }, { id: "pedir", tipo: "process", texto: "Pedir" }, { id: "aprovar", tipo: "process", texto: "Aprovar" }, { id: "fim", tipo: "terminal", texto: "Fim" }],
    ligacoes: [{ de: "ini", para: "pedir" }, { de: "pedir", para: "aprovar" }, { de: "aprovar", para: "fim" }],
  })).pages[0];
  principal.id = "p1"; principal.name = "Principal";
  principal.shapes.push({ id: "img1", type: "image", x: 900, y: 40, w: 100, h: 80, src: "data:image/png;base64,AAAA" }, { id: "tinta", type: "ink", x: 0, y: 0, w: 10, h: 10, pts: [0, 0, 5, 5] });
  principal.shapes.find((x) => x.id === "pedir").locked = true;
  principal.connections.find((c) => c.from === "pedir").style = "curve";
  const pagamento = { id: "pag", name: "Pagamento", shapes: [{ id: "x", type: "process", x: 10, y: 10, w: 160, h: 70, text: "Pagar", color: "purple" }], connections: [] };
  const tela = { format: "processmap", version: 4, name: "Compras", mode: "diagram", activePage: "p1", pages: [principal, pagamento] };

  const est = estruturaDoDocumento(tela);
  conferir("a Lisa vê todas as abas, com a aberta marcada", est.abas.map((a) => `${a.id}:${a.nome}`).join() === "p1:Principal,pag:Pagamento" && est.abaAtiva === "p1");
  conferir("e a imagem e o rabisco não entram como formas", !est.abas[0].formas.some((f) => f.id === "img1" || f.id === "tinta"));
  conferir("na conversa, cada aba aparece com o id e a marca da aberta", /ABA "Principal" \[aba p1\] \(a que está aberta\)/.test(descreverDiagrama(tela)) && /ABA "Pagamento" \[aba pag\]/.test(descreverDiagrama(tela)));

  // "crie uma aba com o detalhe da aprovação": a principal muda (a etapa ganha o link), o pagamento fica
  const resposta = validarDesenho({
    titulo: "Compras", colecao: "flow", explicacao: "Criei a aba.", abaAtiva: "aprovacao",
    abas: [
      { ...est.abas[0], formas: est.abas[0].formas.map((f) => (f.id === "aprovar" ? { ...f, link: "aprovacao" } : f)) },
      { id: "pag", nome: "Pagamento", manter: true },
      { id: "aprovacao", nome: "Detalhe da aprovação", formas: [{ id: "a1", tipo: "process", texto: "Conferir valor" }, { id: "a2", tipo: "decision", texto: "Acima do limite?" }], ligacoes: [{ de: "a1", para: "a2" }] },
    ],
  });
  const novo = montarDocumento(resposta, tela);
  const [p1, pag, aprov] = novo.pages;
  conferir("a aba nova entra no fim, e a pessoa vê ela", novo.pages.map((x) => x.id).join() === "p1,pag,aprovacao" && novo.activePage === "aprovacao" && aprov.shapes.length === 2 && aprov.connections.length === 1);
  conferir("a etapa detalhada abre a aba nova (link)", p1.shapes.find((x) => x.id === "aprovar").link === "aprovacao");
  conferir("a aba mantida fica exatamente igual", JSON.stringify(pag) === JSON.stringify(pagamento));
  conferir("a imagem e o rabisco da aba mudada ficam", p1.shapes.some((x) => x.id === "img1" && x.src) && p1.shapes.some((x) => x.id === "tinta"));
  conferir("a forma travada continua travada, no lugar", p1.shapes.find((x) => x.id === "pedir").locked === true && p1.shapes.find((x) => x.id === "pedir").x === principal.shapes.find((x) => x.id === "pedir").x);
  conferir("a ligação que continua guarda o estilo escolhido", p1.connections.find((c) => c.from === "pedir").style === "curve");

  // o modelo esqueceu a aba de pagamento: ela fica (apagar é só pela lista)
  const esqueceu = montarDocumento(validarDesenho({ titulo: "Compras", abas: [{ ...est.abas[0] }] }), tela);
  conferir("aba que some da resposta não é apagada", esqueceu.pages.map((x) => x.id).join() === "p1,pag");
  // "apague a aba de pagamento"; e um link para ela some junto
  const comLink = JSON.parse(JSON.stringify(tela));
  comLink.pages[0].shapes.find((x) => x.id === "fim").link = "pag";
  const apagou = montarDocumento(validarDesenho({ titulo: "Compras", abas: [{ id: "p1", nome: "Principal", manter: true }], abasRemovidas: ["pag"] }), comLink);
  conferir("apagar aba: só pela lista \"abasRemovidas\", e o link para ela sai", apagou.pages.map((x) => x.id).join() === "p1" && apagou.pages[0].shapes.find((x) => x.id === "fim").link === undefined);
  // renomear sem mexer no resto
  const renomeou = montarDocumento(validarDesenho({ titulo: "Compras", abas: [{ id: "p1", nome: "Principal", manter: true }, { id: "pag", nome: "Contas a pagar", manter: true }] }), tela);
  conferir("renomear aba: só o nome muda", renomeou.pages[1].name === "Contas a pagar" && JSON.stringify(renomeou.pages[1].shapes) === JSON.stringify(pagamento.shapes));
  // o formato de uma aba (sem "abas") sobre um documento de uma aba de id qualquer: é a mesma aba
  const umaAba = { ...tela, activePage: "zz", pages: [{ ...principal, id: "zz" }] };
  const legado = montarDocumento(validarDesenho({ titulo: "Compras", formas: est.abas[0].formas, ligacoes: est.abas[0].ligacoes }), umaAba);
  conferir("formato antigo (uma aba): continua sendo a mesma aba", legado.pages.length === 1 && legado.pages[0].id === "zz" && legado.pages[0].shapes.find((x) => x.id === "pedir").locked === true);
  const repetidas = validarDesenho({ titulo: "X", formas: [{ id: "ini", tipo: "terminal", texto: "Início" }, { id: "ini", tipo: "terminal", texto: "Início" }, { id: "ini", tipo: "process", texto: "Outra" }], ligacoes: [] });
  conferir("a mesma forma repetida pelo modelo sai; id repetido com outra forma vira outro id", repetidas.formas.map((f) => f.id).join() === "ini,ini-2");
  const comBarraN = validarDesenho({ titulo: "X", formas: [{ id: "n", tipo: "note", texto: "• Conceito: A\\n• Decisão: B" }], ligacoes: [] });
  conferir("\"\\n\" escrito ao pé da letra vira quebra de linha (a anotação saía com \"\\n•\" no texto)", comBarraN.formas[0].texto === "• Conceito: A\n• Decisão: B");
  conferir("na anotação, cada tópico \"•\" começa numa linha", validarDesenho({ titulo: "X", formas: [{ id: "n", tipo: "note", texto: "• Conceito: A. • Decisão: B. • Motivo: C." }], ligacoes: [] }).formas[0].texto === "• Conceito: A.\n• Decisão: B.\n• Motivo: C.");
  conferir("e no mapa mental vira espaço", validarMapaMental({ tema: "T", topicos: [{ texto: "Linha um\\nlinha dois" }] }).topicos[0].texto === "Linha um linha dois");
  conferir("link para aba que não existe sai", montarDocumento(validarDesenho({ titulo: "X", formas: [{ id: "a", tipo: "process", texto: "A", link: "inventada" }], ligacoes: [] })).pages[0].shapes[0].link === undefined);
  conferir("\"crie uma aba com o detalhe da aprovação\", com o quadro aberto, muda o desenho", pedidoDeDesenho("crie uma aba com o detalhe da aprovação", { quadroAberto: true }) === "alterar" && pedidoDeDesenho("separe o processo em abas por área", { quadroAberto: true }) === "alterar");
}

console.log("\na trava contra perda (01/11/2026: pediram notas e a aba \"Fluxo Desktop\" ficou só com a raia e o início)");
{
  // a aba Desktop: duas raias, oito formas; a aba Mobile com ids repetidos ("ini" existe nas duas)
  const desktop = montarDocumento(validarDesenho({
    titulo: "Fluxo de Uso MVP",
    formas: [
      { id: "ini", tipo: "terminal", texto: "Acesso via Browser Desktop", raia: "Usuário" },
      { id: "admin", tipo: "decision", texto: "É admin?", raia: "Sistema / Lisa" },
      { id: "completo", tipo: "process", texto: "Acesso Completo (Código, 3D, Sentinela, Painéis)", raia: "Sistema / Lisa", cor: "verde" },
      { id: "primeiro", tipo: "decision", texto: "É o Primeiro Acesso?", raia: "Sistema / Lisa" },
      { id: "entrevista", tipo: "process", texto: "Lisa realiza Entrevista de Perfil e Contexto", raia: "Sistema / Lisa" },
      { id: "responde", tipo: "process", texto: "Responde perguntas da Lisa", raia: "Usuário" },
      { id: "uso", tipo: "process", texto: "Uso MVP: Chat e Voz com Lisa", raia: "Usuário" },
      { id: "fim", tipo: "terminal", texto: "Sessão Concluída", raia: "Usuário" },
    ],
    ligacoes: [
      { de: "ini", para: "admin" }, { de: "admin", para: "completo", rotulo: "Sim" }, { de: "admin", para: "primeiro", rotulo: "Não" },
      { de: "primeiro", para: "entrevista", rotulo: "Sim" }, { de: "entrevista", para: "responde" }, { de: "responde", para: "uso" },
      { de: "primeiro", para: "uso", rotulo: "Não" }, { de: "completo", para: "uso" }, { de: "uso", para: "fim" },
    ],
  })).pages[0];
  desktop.id = "desk"; desktop.name = "Fluxo Desktop";
  const mobile = { id: "mob", name: "Fluxo Mobile", shapes: [{ id: "ini", type: "terminal", x: 10, y: 10, w: 160, h: 60, text: "Acesso via App" }, { id: "fimm", type: "terminal", x: 300, y: 10, w: 160, h: 60, text: "Fim" }], connections: [{ id: "c1", from: "ini", to: "fimm" }] };
  const tela = { format: "processmap", version: 4, name: "Fluxo de Uso MVP", mode: "diagram", activePage: "desk", pages: [desktop, mobile] };
  const formasDe = (pg) => pg.shapes.filter((s) => !["lane", "pool", "frame", "group"].includes(s.type));

  // o que o modelo devolveu: a aba Desktop só com o início e a nota nova
  const metade = validarDesenho({
    titulo: "Fluxo de Uso MVP",
    abas: [
      { id: "desk", nome: "Fluxo Desktop", formas: [{ id: "ini", tipo: "terminal", texto: "Acesso via Browser Desktop", raia: "Usuário" }, { id: "nota", tipo: "note", texto: "• Conceito: entrada pelo navegador" }], ligacoes: [] },
      { id: "mob", nome: "Fluxo Mobile", formas: [{ id: "ini", tipo: "terminal", texto: "Acesso via App" }, { id: "fimm", tipo: "terminal", texto: "Fim" }, { id: "nota", tipo: "note", texto: "• Conceito: app" }], ligacoes: [{ de: "ini", para: "fimm" }] },
    ],
  });
  const { desenho, devolvidas } = semPerdas(metade, tela, "crie uma nota detalhada em cada aba explicando o conceito");
  const doc = montarDocumento(desenho, tela);
  const [d] = doc.pages;
  conferir("num pedido de acrescentar, as 7 formas esquecidas voltam", devolvidas === 7 && formasDe(d).length === 9, `devolvidas ${devolvidas}, formas ${formasDe(d).length}`);
  conferir("e voltam com o texto e a cor de antes", d.shapes.find((s) => s.id === "completo")?.text === "Acesso Completo (Código, 3D, Sentinela, Painéis)" && d.shapes.find((s) => s.id === "completo")?.color === desktop.shapes.find((s) => s.id === "completo").color);
  conferir("as ligações delas voltam (com o rótulo)", d.connections.length === 9 && d.connections.some((c) => c.from === "admin" && c.to === "primeiro" && c.label === "Não"), `ligações ${d.connections.length}`);
  conferir("as duas raias continuam", d.shapes.filter((s) => s.type === "lane").map((s) => s.text).sort().join() === "Sistema / Lisa,Usuário");
  conferir("no lugar onde estavam", d.shapes.find((s) => s.id === "entrevista").x === desktop.shapes.find((s) => s.id === "entrevista").x && d.shapes.find((s) => s.id === "entrevista").y === desktop.shapes.find((s) => s.id === "entrevista").y);
  conferir("e a nota nova entra", d.shapes.some((s) => s.id === "nota" && s.type === "note"));
  const soNota = validarDesenho({
    titulo: "Fluxo de Uso MVP",
    abas: [
      { id: "desk", nome: "Fluxo Desktop", formas: [{ id: "nota", tipo: "note", texto: "• Conceito" }], ligacoes: [] },
      { id: "mob", nome: "Fluxo Mobile", formas: [{ id: "ini", tipo: "terminal", texto: "Acesso via App" }, { id: "fimm", tipo: "terminal", texto: "Fim" }], ligacoes: [{ de: "ini", para: "fimm" }] },
    ],
  });
  const r2 = semPerdas(soNota, tela, "crie uma nota em cada aba");
  const doc2 = montarDocumento(r2.desenho, tela);
  conferir("o id repetido em outra aba (\"ini\" no Mobile) não impede a volta do \"ini\" do Desktop", r2.devolvidas === 8 && doc2.pages[0].shapes.find((s) => s.id === "ini")?.text === "Acesso via Browser Desktop" && doc2.pages[1].shapes.filter((s) => s.id === "ini").length === 1, `devolvidas ${r2.devolvidas}`);

  // pedido que manda tirar: aí a forma pode sumir
  const tirar = validarDesenho({ titulo: "Fluxo de Uso MVP", abas: [{ id: "desk", nome: "Fluxo Desktop", formas: est2(desktop).filter((f) => f.id !== "completo"), ligacoes: [] }] });
  conferir("\"remova o acesso completo\": a forma sai mesmo", semPerdas(tirar, tela, "remova o acesso completo").devolvidas === 0);
  conferir("o pedido de tirar é reconhecido (remova, apague, limpe, tire, refaça)", ["remova a etapa", "apague a nota", "limpe as vermelhas", "tire o fim", "refaça o fluxo", "simplifique"].every((p) => PEDE_PARA_TIRAR.test(p)) && !["crie uma nota", "adicione comentários", "pinte de verde", "detalhe as etapas"].some((p) => PEDE_PARA_TIRAR.test(p)));

  // forma levada para uma aba nova não é duplicada na aba de onde saiu
  const levou = validarDesenho({
    titulo: "Fluxo de Uso MVP",
    abas: [
      { id: "desk", nome: "Fluxo Desktop", formas: est2(desktop).filter((f) => f.id !== "entrevista"), ligacoes: [] },
      { id: "onb", nome: "Onboarding", formas: [{ id: "entrevista", tipo: "process", texto: "Lisa realiza Entrevista de Perfil e Contexto" }], ligacoes: [] },
    ],
  });
  const levado = semPerdas(levou, tela, "crie uma aba de onboarding com a entrevista");
  conferir("forma que foi para uma aba nova não volta para a antiga", levado.devolvidas === 0 && montarDocumento(levado.desenho, tela).pages.flatMap((p) => p.shapes).filter((s) => s.id === "entrevista").length === 1);

  // a aba de um documento de uma aba volta pelo formato antigo, com id diferente
  const sozinha = { ...tela, activePage: "zz", pages: [{ ...desktop, id: "zz" }] };
  const legado = semPerdas(validarDesenho({ titulo: "X", formas: [{ id: "ini", tipo: "terminal", texto: "Acesso via Browser Desktop" }], ligacoes: [] }), sozinha, "acrescente uma nota");
  conferir("documento de uma aba, resposta no formato antigo: também volta", legado.devolvidas === 7);

  // "crie uma nota" e o modelo reescreveu a nota que a pessoa já tinha: a dela fica, a nova entra ao lado
  const comNotaDaPessoa = { ...tela, pages: [{ ...desktop, shapes: [...desktop.shapes, { id: "minha", type: "note", x: 0, y: 0, w: 360, h: 120, text: "• Minha decisão: começar pelo desktop" }] }, mobile] };
  const reescreveu = validarDesenho({ titulo: "X", abas: [{ id: "desk", nome: "Fluxo Desktop", formas: [...est2(comNotaDaPessoa.pages[0]).filter((f) => f.id !== "minha"), { id: "minha", tipo: "note", texto: "• Conceito novo da Lisa" }], ligacoes: [] }] });
  const r3 = semPerdas(reescreveu, comNotaDaPessoa, "crie uma nota detalhada em cada aba");
  const notas = montarDocumento(r3.desenho, comNotaDaPessoa).pages[0].shapes.filter((s) => s.type === "note");
  conferir("\"crie uma nota\": a nota da pessoa não é reescrita — a nova entra ao lado", notas.find((s) => s.id === "minha")?.text === "• Minha decisão: começar pelo desktop" && notas.some((s) => s.id === "minha-nova" && s.text === "• Conceito novo da Lisa"));
  const r4 = semPerdas(validarDesenho({ titulo: "X", abas: [{ id: "desk", nome: "Fluxo Desktop", formas: [...est2(comNotaDaPessoa.pages[0]).filter((f) => f.id !== "minha"), { id: "minha", tipo: "note", texto: "• Atualizada" }], ligacoes: [] }] }), comNotaDaPessoa, "atualize a nota com as decisões de hoje");
  conferir("\"atualize a nota\": aí a nota muda mesmo", montarDocumento(r4.desenho, comNotaDaPessoa).pages[0].shapes.filter((s) => s.type === "note").map((s) => s.text).join() === "• Atualizada");

  // a anotação longa não é cortada no caminho de ida e volta
  const longa = "• Conceito: " + "a".repeat(900);
  const comNota = { ...tela, pages: [{ ...desktop, shapes: [...desktop.shapes, { id: "n1", type: "note", x: 0, y: 0, w: 360, h: 200, text: longa }] }, mobile] };
  conferir("a anotação vai inteira para a Lisa (não volta cortada)", estruturaDoDocumento(comNota).abas[0].formas.find((f) => f.id === "n1").texto === longa);

  // o desenho grande vai para o modelo sem ser cortado no meio (antes: JSON cortado em 24 mil letras)
  const grande = estruturaDoDocumento(tela);
  grande.abas.push(...Array.from({ length: 6 }, (_, i) => ({ id: `extra${i}`, nome: `Extra ${i}`, formas: [{ id: "n", tipo: "note", texto: "x".repeat(1400) }], ligacoes: [] })));
  const cabe = JSON.parse(estruturaQueCabe(grande, 5000));
  conferir("desenho grande: o JSON vai inteiro (não cortado), a aba aberta completa e as que não cabem marcadas", cabe.abas.length === 8 && cabe.abas[0].formas.length === 8 && cabe.abas.some((a) => a.naoCoube && a.quantasFormas === 1) && estruturaQueCabe(estruturaDoDocumento(tela)) === JSON.stringify(estruturaDoDocumento(tela)));

  // mapa mental: num pedido de acrescentar, galho esquecido volta com os filhos
  const mapa = montarMapaMental(validarMapaMental({
    titulo: "Produto Lisa", tema: "Lisa",
    topicos: [{ id: "voz", texto: "Voz", filhos: [{ id: "stt", texto: "Reconhecer fala" }] }, { id: "ide", texto: "Editor", filhos: [{ id: "abas", texto: "Abas de código" }] }],
  }));
  const novo = validarMapaMental({ titulo: "Produto Lisa", tema: "Lisa", topicos: [{ id: "voz", texto: "Voz", filhos: [{ id: "stt", texto: "Reconhecer fala" }, { id: "tts", texto: "Falar" }] }] });
  const ficou = montarMapaMental(novo, mapa, { manterTudo: true });
  conferir("mapa mental: o galho esquecido volta com os filhos (manterTudo)", ["ide", "abas", "tts"].every((id) => ficou.pages[0].shapes.some((s) => s.id === id)) && ficou.pages[0].shapes.find((s) => s.id === "abas").parent === "ide");
  const tirou = montarMapaMental(novo, mapa, { manterTudo: false });
  conferir("mapa mental: com pedido de tirar, o galho sai", !tirou.pages[0].shapes.some((s) => s.id === "ide"));
}

function est2(pg) {
  return estruturaDoDocumento({ pages: [pg] }).abas[0].formas;
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
