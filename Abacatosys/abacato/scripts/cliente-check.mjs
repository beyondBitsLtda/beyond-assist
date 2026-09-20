// O painel do cliente: o que ele vê, e o que ele NUNCA pode ver.
//
// Roda sem banco e sem rede — é só domínio. O link público é a única porta do
// Abacato que não pede senha, então o que sai por ele precisa de teste próprio:
// um campo a mais aqui não vaza para um colega, vaza para quem tiver o endereço.
//
// A data é fixa. Uma função que lê o relógio por dentro só dá para testar
// torcendo, e este teste precisa dizer "atrasado há 3 dias" com certeza.

import { Quadro } from "../src/dominio/Quadro.js";
import { emAndamento, proximasEntregas, entreguesRecentes, painelDoQuadro } from "../src/dominio/painel.js";

const AGORA = new Date("2026-03-10T12:00:00Z");
const dia = (n) => new Date(AGORA.getTime() + n * 86400000).toISOString();

let falhas = 0;
const conferir = (titulo, ok, detalhe = "") => {
  console.log(`  ${ok ? "ok    " : "FALHOU"}  ${titulo}${detalhe ? `  — ${detalhe}` : ""}`);
  if (!ok) falhas += 1;
};

console.log("\nO painel que o cliente vê\n");

// Um quadro parecido com os de verdade: uma fila, duas etapas de trabalho e o fim.
const quadro = new Quadro({
  id: "q", nome: "Obra do cliente", donoId: "u",
  colunas: [
    {
      id: "c0", nome: "A fazer", posicao: 1, cards: [
        { id: "1", titulo: "Ainda na fila", fimEm: dia(20) },
        { id: "2", titulo: "Outro na fila", fimEm: null },
      ],
    },
    {
      id: "c1", nome: "Fazendo", posicao: 2, cards: [
        { id: "3", titulo: "Montagem do painel elétrico", fimEm: dia(2) },
        { id: "4", titulo: "Solda da base", fimEm: dia(-3) },
        { id: "5", titulo: "Pintura", fimEm: null },
      ],
    },
    {
      id: "c2", nome: "Revisão", posicao: 3, cards: [
        { id: "6", titulo: "Conferência dimensional", fimEm: dia(0) },
        { id: "7", titulo: "Já entregue", fimEm: dia(-8), concluido: true },
      ],
    },
    {
      id: "c3", nome: "Feito", posicao: 4, cards: [
        { id: "8", titulo: "Projeto aprovado", fimEm: dia(-15), concluido: true },
        { id: "9", titulo: "Compra do material", fimEm: dia(-30), concluido: true },
      ],
    },
  ],
});
const cards = quadro.todosOsCards();

// ---------------------------------------------------------------- em andamento

console.log("1) o que está em andamento");
{
  const andando = emAndamento(quadro, AGORA);
  const titulos = andando.map((c) => c.titulo);

  // A PRIMEIRA COLUNA É FILA, e fila não é andamento. Sem esta regra, um quadro
  // com duzentos itens de backlog diria ao cliente que há duzentas frentes abertas.
  conferir("o que está na fila NÃO conta como andamento",
    !titulos.includes("Ainda na fila") && !titulos.includes("Outro na fila"));
  conferir("o que está nas etapas de trabalho conta",
    titulos.includes("Montagem do painel elétrico") && titulos.includes("Pintura"));
  conferir("o que já foi concluído não aparece como andamento",
    !titulos.includes("Já entregue"));
  conferir("são 4 frentes abertas", andando.length === 4, titulos.join(" · "));

  // Ordem: quem tem prazo primeiro, o mais apertado na frente.
  conferir("o mais atrasado vem primeiro", andando[0].titulo === "Solda da base", andando[0].titulo);
  conferir("quem não tem prazo vai para o fim",
    andando[andando.length - 1].titulo === "Pintura", andando[andando.length - 1].titulo);
  conferir("cada linha diz em que etapa está", andando[0].etapa === "Fazendo", andando[0].etapa);

  // Num quadro de uma coluna só não existe fila — tudo que está aberto está andando.
  const umaColuna = new Quadro({
    id: "u", nome: "x", donoId: "u",
    colunas: [{ id: "c", nome: "Tarefas", posicao: 1, cards: [{ id: "a", titulo: "Única" }] }],
  });
  conferir("num quadro de uma coluna só, nada é tratado como fila",
    emAndamento(umaColuna, AGORA).length === 1);

  // O caso que apareceu num quadro DE VERDADE: a fila não era a primeira coluna.
  // O painel do cliente anunciou doze itens de backlog como doze frentes em execução.
  const filaNoMeio = new Quadro({
    id: "f", nome: "CRM", donoId: "u",
    colunas: [
      { id: "a", nome: "Entrada", posicao: 1, cards: [{ id: "1", titulo: "Chegou" }] },
      { id: "b", nome: "🎯 Alvos (Backlog da Semana):", posicao: 2, cards: [{ id: "2", titulo: "Lead parado" }] },
      { id: "c", nome: "Em contato", posicao: 3, cards: [{ id: "3", titulo: "Negociando" }] },
    ],
  });
  const t = emAndamento(filaNoMeio, AGORA).map((c) => c.titulo);
  conferir("uma coluna de backlog NO MEIO do quadro também é fila",
    !t.includes("Lead parado"), t.join(" · "));
  conferir("e o que está de fato em contato aparece", t.includes("Negociando"));
  conferir("só uma frente aberta, e não três", t.length === 1, String(t.length));

  // O outro extremo, também visto num quadro real: uma coluna de trabalho TERMINADO cujos
  // cards ninguem marcou como concluidos. O painel anunciava doze tickets fechados como
  // doze frentes em execucao.
  const comFechados = new Quadro({
    id: "x", nome: "CRM", donoId: "u",
    colunas: [
      { id: "a", nome: "Entrada", posicao: 1, cards: [{ id: "1", titulo: "Chegou" }] },
      { id: "b", nome: "Em contato", posicao: 2, cards: [{ id: "2", titulo: "Negociando" }] },
      { id: "c", nome: "Tickecks fechados (Valores)", posicao: 3, cards: [{ id: "3", titulo: "Site entregue" }] },
    ],
  });
  const f = emAndamento(comFechados, AGORA).map((c) => c.titulo);
  conferir("coluna de 'fechados' não conta como andamento", !f.includes("Site entregue"), f.join(" · "));
  conferir("mesmo com os cards sem a marca de concluído", f.length === 1, String(f.length));

  // E a ponta de tras nao pode virar regra de posicao: num quadro de tres colunas a ULTIMA
  // pode ser trabalho de verdade.
  conferir("a ultima coluna, se for trabalho, continua contando",
    emAndamento(filaNoMeio, AGORA).some((c) => c.titulo === "Negociando"));
}

// ---------------------------------------------------------------- próximas entregas

console.log("\n2) o que vem a seguir");
{
  const proximas = proximasEntregas(cards, AGORA);
  const titulos = proximas.map((c) => c.titulo);

  conferir("traz o que tem prazo à frente", titulos.includes("Montagem do painel elétrico"));
  conferir("inclui o que vence HOJE", titulos.includes("Conferência dimensional"));
  // O que venceu é "atrasado", e tem seção própria. Misturar faria o cliente ler
  // uma dívida como se fosse um plano.
  conferir("NÃO traz o que já venceu", !titulos.includes("Solda da base"));
  conferir("não traz o que já foi entregue", !titulos.includes("Já entregue"));
  conferir("vem em ordem de data", proximas[0].titulo === "Conferência dimensional", proximas[0].titulo);
  conferir("o que vence hoje diz 0 dias", proximas[0].emDias === 0, String(proximas[0].emDias));
  conferir("e o de daqui a dois dias diz 2", proximas[1].emDias === 2, String(proximas[1].emDias));
  conferir("inclui o que está na fila com prazo", titulos.includes("Ainda na fila"));
}

// ---------------------------------------------------------------- entregues

console.log("\n3) o que já ficou pronto");
{
  const feitos = entreguesRecentes(cards);
  const titulos = feitos.map((c) => c.titulo);
  conferir("traz só o que está concluído", feitos.length === 3, titulos.join(" · "));
  conferir("o mais recente primeiro", titulos[0] === "Já entregue", titulos[0]);
  conferir("não traz nada que esteja aberto", !titulos.includes("Pintura"));
}

// ---------------------------------------------------------------- o que NÃO sai

console.log("\n4) o que o link público não entrega");
{
  const p = painelDoQuadro(quadro, AGORA);
  const tudo = [...p.emAndamento, ...p.proximasEntregas, ...p.entregues];

  // Esta é a parte que importa mais que todas as outras juntas: o link não pede
  // senha. Cada campo a mais aqui é um campo que vaza para quem tiver o endereço.
  const permitidos = new Set(["titulo", "etapa", "estado", "fimEm", "emDias"]);
  const vazados = new Set();
  for (const item of tudo) {
    for (const campo of Object.keys(item)) if (!permitidos.has(campo)) vazados.add(campo);
  }
  conferir("nenhum campo além de título, etapa, estado e data",
    vazados.size === 0, [...vazados].join(", "));
  conferir("nenhum id de card sai", !tudo.some((c) => "id" in c));
  conferir("nenhum responsável sai", !tudo.some((c) => "responsaveis" in c));
  conferir("nenhuma descrição sai", !tudo.some((c) => "descricao" in c));

  // O painel continua somando tudo, mesmo o que ele não detalha.
  conferir("o painel ainda conta o quadro inteiro", p.total === 9, String(p.total));
  conferir("e sabe quantos estão em andamento", p.emAndamento.length === 4);
}

// ---------------------------------------------------------------- quadro vazio

console.log("\n5) um quadro vazio não inventa nada");
{
  const vazio = new Quadro({ id: "v", nome: "Novo", donoId: "u", colunas: [] });
  const p = painelDoQuadro(vazio, AGORA);
  conferir("sem cards, nada em andamento", p.emAndamento.length === 0);
  conferir("sem cards, nenhuma entrega à frente", p.proximasEntregas.length === 0);
  conferir("sem cards, nada entregue", p.entregues.length === 0);
  // Um quadro vazio está em 0%, e não em 100%: ele não terminou, ele nem começou.
  conferir("o progresso de um quadro vazio é 0%", p.progresso === 0, `${p.progresso}%`);
}

console.log(falhas === 0 ? "\nTUDO PASSOU\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
