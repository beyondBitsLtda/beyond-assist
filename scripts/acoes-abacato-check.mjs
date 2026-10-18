// As regras das ações da Lisa no Abacato (src/lib/acoesNoAbacato.js). Sem rede nem banco.
import {
  pareceAcao, respostaDeConfirmacao, candidatosDoPedido, pendenteValida, prazoEmPalavras, resumoDaAcao, relatoDaAcao, previaDoTexto, pedeTextoEscrito,
} from "../src/lib/acoesNoAbacato.js";

let falhas = 0;
const conferir = (titulo, ok, detalhe = "") => {
  console.log(`  ${ok ? "ok    " : "FALHOU"}  ${titulo}${detalhe ? `  — ${detalhe}` : ""}`);
  if (!ok) falhas += 1;
};

console.log("\nO que parece pedido de ação\n");
for (const f of [
  "Você consegue criar um card lá no abacate exatamente com esse texto que você vai sugerir?",
  "cria um card no Quarto de Guerra para revisar o backup",
  "marca a tarefa do backup como concluída",
  "exclui o card de teste",
  "muda o prazo do card do Abacato para sexta",
  "move a tarefa do client id para Fazendo",
  "renomeia esse card para Publicar comentários",
  "adiciona uma tarefa de ligar para o contador amanhã",
]) conferir(`ação: "${f}"`, pareceAcao(f));
for (const f of ["quais tarefas eu tenho hoje?", "me fala do card de backup", "o que você acha do meu dia?", "bom dia Lisa"]) {
  conferir(`não é ação: "${f}"`, !pareceAcao(f));
}
conferir("com ação pendente, qualquer resposta vale", pareceAcao("o segundo", true));

console.log("\nPedido de texto escrito na descrição\n");
for (const f of [
  "cria um card com um pitch de vendas para a Beyond",
  "cria um card com o e-mail de cobrança para o cliente",
  "adiciona uma tarefa com um roteiro da reunião de segunda",
  "cria um card com um passo a passo de como publicar a Lisa",
]) conferir(`pede texto: "${f}"`, pedeTextoEscrito(f));
for (const f of ["cria um card para revisar o pitch de vendas", "cria um card de ligar para o contador"]) {
  conferir(`não pede texto: "${f}"`, !pedeTextoEscrito(f));
}

console.log("\nSim e não\n");
for (const f of ["sim", "pode", "pode criar", "isso mesmo", "confirmo", "manda"]) conferir(`"${f}" = sim`, respostaDeConfirmacao(f) === "sim");
for (const f of ["não", "nao", "cancela", "deixa pra lá", "esquece"]) conferir(`"${f}" = não`, respostaDeConfirmacao(f) === "nao");
conferir("frase longa não é decidida aqui (vai pro modelo)", respostaDeConfirmacao("sim mas coloca no quadro da Lisa e com prazo para sexta-feira") === null);

console.log("\nAchar o card do pedido\n");
const cards = [
  { id: "1", title: "Publicar comentários do Abacato" },
  { id: "2", title: "Client ID próprio do Google para o backup" },
  { id: "3", title: "Revisão visual da Lisa" },
  { id: "4", title: "Backup semanal conferido" },
];
const c1 = candidatosDoPedido("marca o card do client id do google como feito", cards);
conferir("acha pelo título, sem acento e sem as palavras de comando", c1[0]?.id === "2", c1.map((c) => c.id).join(","));
const c2 = candidatosDoPedido("conclui ele", cards, [cards[2]]);
conferir("\"ele\" = o card da conversa recente", c2[0]?.id === "3");
conferir("nada em comum → só os recentes", candidatosDoPedido("xyz", cards).length === 0);

console.log("\nAção pendente vinda do navegador\n");
conferir("criar precisa de coluna e título", pendenteValida({ type: "abacato", acao: "criar", titulo: "X" }) === null);
conferir("editar precisa de card", pendenteValida({ type: "abacato", acao: "editar", titulo: "X" }) === null);
conferir("mover precisa de coluna", pendenteValida({ type: "abacato", acao: "mover", card_id: "1" }) === null);
conferir("ação desconhecida é descartada", pendenteValida({ type: "abacato", acao: "apagar_tudo", card_id: "1" }) === null);
conferir("tipo de outro fluxo é descartado", pendenteValida({ type: "confirm", card_id: "1", field: "due" }) === null);
const ok = pendenteValida({ type: "abacato", acao: "arquivar", card_id: "1", card_titulo: "T", extra: "lixo" });
conferir("campos estranhos somem", ok && !("extra" in ok) && ok.card_id === "1");
const esc = pendenteValida({ type: "abacato_escolha", acao: "concluir", candidatos: [{ id: "1", titulo: "A" }, { id: 2 }, null] });
conferir("escolha guarda só candidatos válidos", esc?.candidatos.length === 1);

console.log("\nO que ela fala\n");
conferir("prazo por extenso", prazoEmPalavras("2026-10-16") === "16 de outubro");
conferir("prazo com hora", prazoEmPalavras("2026-10-16T14:30") === "16 de outubro às 14h30");
const LONGO = "Olá Ricardo, a equipe de atendimento notou que os clientes chegam pelo Instagram procurando imóveis que já foram vendidos, e sugerimos revisar os anúncios toda segunda-feira e responder em até duas horas.";
const r1 = resumoDaAcao({ acao: "criar", titulo: "E-mail para o CEO", destino: "Quarto de Guerra, coluna A fazer", descricao: LONGO, prazo: "2026-10-20" });
conferir("criar: título, destino, começo do texto e prazo, e pede confirmação", r1.includes("E-mail para o CEO") && r1.includes("Quarto de Guerra") && r1.includes("Olá Ricardo, a equipe") && r1.includes("…") && r1.includes("20 de outubro") && r1.endsWith("Confirma?"), r1);
const p = previaDoTexto(LONGO);
conferir("a prévia corta numa palavra e termina em …", p.length <= 141 && p.endsWith("…") && !/\s…$/.test(p), p);
conferir("texto curto não ganha …", previaDoTexto("ligar às 10h") === "ligar às 10h");
const r1b = resumoDaAcao({ acao: "criar", titulo: "Pitch de vendas", destino: "Quarto de Guerra, coluna A fazer", descricao: LONGO }, { textoNovo: true });
conferir("texto que ela acabou de escrever aparece inteiro antes do Confirma", r1b.startsWith("Escrevi este texto") && r1b.includes(LONGO) && r1b.endsWith("Confirma?"), r1b.slice(-90));
const r1c = resumoDaAcao({ acao: "editar", card_titulo: "Pitch", descricao: LONGO }, { textoNovo: true });
conferir("editar com texto novo também mostra o texto", r1c.includes(LONGO) && r1c.includes('"Pitch"'), r1c.slice(-70));
const esc2 = pendenteValida({ type: "abacato_escolha", acao: "editar", candidatos: [{ id: "1", titulo: "A" }], mudancas: { descricao: "x", texto_novo: true, lixo: 1 } });
conferir("escolha pendente lembra que o texto é novo (e só isso)", esc2.mudancas.texto_novo === true && !("lixo" in esc2.mudancas));
const r2 = resumoDaAcao({ acao: "arquivar", card_titulo: "Teste" });
conferir("excluir avisa que dá para recuperar", r2.includes("arquivado") && r2.endsWith("Confirma?"));
const r3 = relatoDaAcao({ acao: "concluir", card_titulo: "Backup" }, { reprogramado: true, fim_em: "2026-10-22T02:59:59.000Z", titulo: "Backup" });
conferir("concluir recorrente conta a próxima data", r3.includes("se repete"), r3);

console.log(falhas ? `\n${falhas} falha(s).\n` : "\nTudo certo.\n");
process.exit(falhas ? 1 : 0);
