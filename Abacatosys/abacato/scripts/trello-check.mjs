// Exercita o leitor da exportação do Trello.
//
// Uma migração só acontece uma vez por quadro, e quando ela erra ninguém percebe na hora:
// percebe três semanas depois, quando a conta do Trello já foi fechada e o card que faltava
// não existe em lugar nenhum. É o tipo de código que precisa estar certo na primeira vez.
//
// O arquivo de exemplo aqui é sintético e tem de propósito tudo que costuma dar errado numa
// exportação de verdade: cor com sufixo de tom, lista arquivada, card arquivado, card já
// concluído, anexo que é upload, card apontando para lista que não veio, pessoa sem conta
// aqui, checklist com itens fora de ordem.

import { lerExportacaoDoTrello, corDoTrello, paredeDoTrello, enxugarExportacao } from "../src/dominio/trello.js";
import { VALORES_DE_COR } from "../src/dominio/cores.js";
import { exportacaoDeExemplo } from "./exemplo-trello.mjs";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

const EXPORTACAO = exportacaoDeExemplo("fixo");

console.log("\n1) cores do Trello viram cores da paleta");
{
  conferir("red vira o vermelho daqui", corDoTrello("red") === "#EF4444");
  conferir("o sufixo de tom é ignorado", corDoTrello("blue_dark") === corDoTrello("blue"));
  conferir("sky não colide com blue", corDoTrello("sky") !== corDoTrello("blue"));
  conferir("cor inventada cai no cinza", corDoTrello("arco-iris") === "#6B7280");
  conferir("sem cor cai no cinza", corDoTrello(null) === "#6B7280");

  // A paleta fechada é a regra do sistema. Uma cor vinda de fora que escapasse dela apareceria
  // no quadro e não poderia ser editada pelo seletor, que só conhece as dez.
  for (const nome of ["green", "lime", "yellow", "orange", "red", "purple", "pink", "blue", "sky", "black"]) {
    conferir(`"${nome}" cai dentro da paleta`, VALORES_DE_COR.includes(corDoTrello(nome)), corDoTrello(nome));
  }
}

console.log("\n2) papel de parede");
{
  conferir("fundo azul vira o gradiente azul", paredeDoTrello({ background: "blue" })?.includes("#21456F"));
  conferir("fundo verde vira o gradiente verde", paredeDoTrello({ background: "green" })?.includes("#1B4332"));
  conferir("sem fundo nenhum, não inventa", paredeDoTrello({}) === null);
  conferir("sem prefs não quebra", paredeDoTrello(null) === null);

  // O hex do Trello escolhe a FAMÍLIA, não vira o fundo: metade dos fundos dele é clara, e a
  // tela do quadro escreve em branco por cima do papel de parede.
  const claro = paredeDoTrello({ backgroundColor: "#F2D600" });
  conferir("hex personalizado vira um gradiente escuro da casa", Boolean(claro) && !claro.includes("F2D600"), claro);
}

console.log("\n3) ler a exportação inteira");
const { quadro, avisos, resumo } = lerExportacaoDoTrello(EXPORTACAO);
{
  conferir("o nome veio", quadro.nome.startsWith("Obra — Delp Engenharia"), quadro.nome);
  conferir("a origem é o id do Trello", quadro.origemId === EXPORTACAO.id);
  conferir("o papel de parede foi escolhido", Boolean(quadro.papelDeParede));
  conferir("as quatro etiquetas vieram", quadro.etiquetas.length === 4);
  conferir("a etiqueta de cor inventada virou cinza",
    quadro.etiquetas.find((e) => e.nome === "Inventada")?.cor === "#6B7280");
}

console.log("\n4) colunas e ordem");
{
  conferir("três colunas", quadro.colunas.length === 3, `${quadro.colunas.length}`);
  conferir("na ordem do pos do Trello",
    quadro.colunas.map((c) => c.nome).join(" > ") === "A fazer > Fazendo > Arquivada de 2024",
    quadro.colunas.map((c) => c.nome).join(" > "));
  // Arquivada no Trello chega arquivada aqui: é histórico, e a migração é a última chance de
  // trazê-lo antes de a conta de lá ser fechada.
  conferir("a lista fechada vem marcada como arquivada",
    quadro.colunas.find((c) => c.nome === "Arquivada de 2024")?.arquivada === true);
}

console.log("\n5) cards");
{
  const aFazer = quadro.colunas.find((c) => c.nome === "A fazer");
  const fazendo = quadro.colunas.find((c) => c.nome === "Fazendo");

  conferir("dois cards em 'A fazer'", aFazer.cards.length === 2, `${aFazer.cards.length}`);
  conferir("o card órfão não entrou em coluna nenhuma",
    !quadro.colunas.some((c) => c.cards.some((k) => k.titulo === "Órfão")));

  const art = aFazer.cards.find((c) => c.titulo === "Renovar ART");
  conferir("descrição veio", art.descricao === "Vence este mês.");
  conferir("prazo veio como ISO", art.fimEm?.startsWith("2026-10-15"));
  conferir("data de início veio", art.inicioEm?.startsWith("2026-10-01"));
  conferir("duas etiquetas", art.etiquetas.length === 2);
  conferir("a capa virou cor da paleta", art.capa === "#F97316", art.capa);

  // Sem trazer o `dueComplete`, todo card já resolvido no Trello chegaria aqui vermelho de
  // atrasado — a pior primeira impressão possível de uma migração.
  const medicao = aFazer.cards.find((c) => c.titulo.startsWith("Medição"));
  conferir("o card com dueComplete chega concluído", medicao.concluido === true);
  conferir("o outro não", art.concluido === false);

  const semTitulo = fazendo.cards.find((c) => c.titulo === "(sem título)");
  conferir("título só de espaços vira '(sem título)'", Boolean(semTitulo));
  conferir("data inválida vira nulo, não quebra a importação", semTitulo.fimEm === null);
}

console.log("\n6) anexos");
{
  const art = quadro.colunas.flatMap((c) => c.cards).find((c) => c.titulo === "Renovar ART");
  conferir("o link externo virou link", art.links.length === 1, JSON.stringify(art.links));
  conferir("com o nome do anexo", art.links[0]?.titulo === "Planta");
  // Um arquivo enviado ao Trello mora atrás da sessão do Trello. Trazer um link quebrado é
  // pior que dizer que ele não veio.
  conferir("o upload do Trello não virou link", !art.links.some((l) => l.url.includes("trello.com")));
  conferir("e virou aviso", avisos.some((a) => a.tipo === "anexos" && a.quantos === 1));
}

console.log("\n7) checklists");
{
  const art = quadro.colunas.flatMap((c) => c.cards).find((c) => c.titulo === "Renovar ART");
  conferir("duas checklists", art.checklists.length === 2, `${art.checklists.length}`);
  conferir("ordenadas pelo pos", art.checklists[0].titulo === "Checklist", art.checklists[0].titulo);
  conferir("checklist sem nome vira 'Checklist'", art.checklists.some((c) => c.titulo === "Checklist"));

  const docs = art.checklists.find((c) => c.titulo === "Documentos");
  conferir("itens em ordem de pos, não de arquivo",
    docs.itens.map((i) => i.texto).join(" | ") === "Cópia do contrato | Assinatura do responsável",
    docs.itens.map((i) => i.texto).join(" | "));
  conferir("o estado de cada item veio", docs.itens[0].feito === true && docs.itens[1].feito === false);
  conferir("item vazio não entra", docs.itens.length === 2);
}

console.log("\n8) o que a importação AVISA que não trouxe");
{
  const pessoas = avisos.find((a) => a.tipo === "pessoas");
  conferir("avisa sobre as pessoas sem conta aqui", Boolean(pessoas));
  conferir("e diz os nomes", pessoas?.texto.includes("Ana Souza") && pessoas.texto.includes("Carlos Lima"), pessoas?.texto);

  conferir("avisa sobre o que estava arquivado", avisos.some((a) => a.tipo === "arquivados"));
  const orfaos = avisos.find((a) => a.tipo === "orfaos");
  conferir("avisa sobre cards de listas que não vieram", orfaos?.quantos === 1, JSON.stringify(orfaos));
}

console.log("\n9) o resumo que a prévia mostra");
{
  conferir("conta as colunas", resumo.colunas === 3, `${resumo.colunas}`);
  // Cinco, e não quatro: são os seis do arquivo menos o órfão. O card da lista arquivada
  // ENTRA na conta — ele vem junto, arquivado, e a prévia tem de prometer o que vai gravar.
  conferir("conta os cards que vão entrar", resumo.cards === 5, `${resumo.cards}`);
  conferir("conta as checklists", resumo.checklists === 2, `${resumo.checklists}`);
  conferir("conta os itens", resumo.itens === 2, `${resumo.itens}`);
  conferir("conta os links", resumo.links === 1, `${resumo.links}`);
  conferir("conta os concluídos", resumo.concluidos === 1, `${resumo.concluidos}`);
  conferir("conta os arquivados", resumo.arquivados === 1, `${resumo.arquivados}`);
}

console.log("\n10) enxugar antes de enviar");
{
  const enxuto = enxugarExportacao(EXPORTACAO);
  // O `actions` é o histórico de cada movimento de cada card, e é o que faz uma exportação de
  // um ano passar de cinquenta megabytes. Mandar isso pela rede para o servidor jogar fora do
  // outro lado é o que faz a importação parecer travada.
  conferir("o histórico não vai junto", !("actions" in enxuto));
  conferir("o que importa continua lá", enxuto.cards.length === 6 && enxuto.lists.length === 3);
  conferir("o enxuto dá o mesmo resultado que o inteiro",
    JSON.stringify(lerExportacaoDoTrello(enxuto).resumo) === JSON.stringify(resumo));
}

console.log("\n11) arquivo errado");
{
  const tenta = (valor, oQue) => {
    try { lerExportacaoDoTrello(valor); return falha(`${oQue} devia ser recusado`); }
    catch (e) { return ok(`${oQue} é recusado — "${e.message.slice(0, 60)}…"`); }
  };
  tenta(null, "nulo");
  tenta("texto", "um texto");
  tenta({ name: "x" }, "um JSON sem listas e cards");
  tenta({ lists: [] }, "um JSON sem cards");
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
