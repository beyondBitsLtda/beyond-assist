// Exercita as regras de domínio do Abacato — as perguntas que o card, a coluna e o quadro
// sabem responder sozinhos.
//
// Estas regras vão ser lidas por três telas e pela Lisa. "Atrasado" precisa significar a mesma
// coisa nas quatro, e a única forma de garantir isso é ter uma resposta só, testada aqui, em
// vez de quatro implementações que concordam por enquanto.

import { Quadro, Coluna, Card, Checklist, Usuario, posicaoEntre, poderesDo } from "../src/dominio/Quadro.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

const AGORA = new Date("2026-09-20T12:00:00Z");
const daquiA = (h) => new Date(AGORA.getTime() + h * 3600 * 1000).toISOString();

console.log("\n1) arrastar: a posição entre dois vizinhos");
{
  conferir("entre 1024 e 2048 dá 1536", posicaoEntre(1024, 2048) === 1536);
  conferir("no fim, soma o passo", posicaoEntre(1024, null) === 2048);
  conferir("no começo, subtrai", posicaoEntre(null, 1024) === 0);
  conferir("lista vazia começa em 1024", posicaoEntre(null, null) === 1024);

  // O que faz a escolha do número real valer a pena: mover mil vezes entre os mesmos dois
  // vizinhos continua cabendo, sem renumerar a lista inteira a cada arrastar.
  let a = 0, b = 1024;
  for (let i = 0; i < 40; i++) { const m = posicaoEntre(a, b); conferir; b = m; }
  conferir("40 inserções seguidas no mesmo ponto ainda cabem", b > a && Number.isFinite(b), `chegou a ${b}`);
}

console.log("\n2) o estado do prazo, que três telas vão mostrar");
{
  const semPrazo = new Card({ id: "1", titulo: "x" });
  conferir("sem prazo é sem-prazo", semPrazo.estadoDoPrazo(AGORA) === "sem-prazo");

  const atrasado = new Card({ id: "2", titulo: "x", fimEm: daquiA(-2) });
  conferir("prazo no passado é atrasado", atrasado.estadoDoPrazo(AGORA) === "atrasado");

  const hoje = new Card({ id: "3", titulo: "x", fimEm: daquiA(5) });
  conferir("vence em 5h é hoje", hoje.estadoDoPrazo(AGORA) === "hoje");

  const proximo = new Card({ id: "4", titulo: "x", fimEm: daquiA(40) });
  conferir("vence em 40h é próximo", proximo.estadoDoPrazo(AGORA) === "proximo");

  const longe = new Card({ id: "5", titulo: "x", fimEm: daquiA(200) });
  conferir("vence em 200h está no prazo", longe.estadoDoPrazo(AGORA) === "no-prazo");
}

console.log("\n3) a regra que evita vermelho no que já está feito");
{
  // Card vencido, mas com todas as checklists completas: o trabalho acabou, só ninguém moveu o
  // card. Marcá-lo de vermelho ensina a ignorar o vermelho.
  const feito = new Card({
    id: "6", titulo: "x", fimEm: daquiA(-48),
    checklists: [new Checklist({ id: "c", itens: [{ id: "i1", texto: "a", feito: true }, { id: "i2", texto: "b", feito: true }] })],
  });
  conferir("vencido com tudo marcado é concluído, não atrasado", feito.estadoDoPrazo(AGORA) === "concluido");

  const pelaMetade = new Card({
    id: "7", titulo: "x", fimEm: daquiA(-48),
    checklists: [new Checklist({ id: "c", itens: [{ id: "i1", texto: "a", feito: true }, { id: "i2", texto: "b" }] })],
  });
  conferir("vencido pela metade continua atrasado", pelaMetade.estadoDoPrazo(AGORA) === "atrasado");

  // E o caso que a regra NÃO pode pegar: a maioria dos cards não tem checklist nenhuma.
  const semChecklist = new Card({ id: "8", titulo: "x", fimEm: daquiA(-48) });
  conferir("sem checklist, vencido é atrasado", semChecklist.estadoDoPrazo(AGORA) === "atrasado");
  conferir("e não conta como concluído", !semChecklist.concluidoPelasChecklists);
}

console.log("\n4) checklist: vazia não é completa");
{
  const vazia = new Checklist({ id: "c", itens: [] });
  conferir("progresso de checklist vazia é 0", vazia.progresso === 0, `veio ${vazia.progresso}`);
  conferir("e ela não está completa", !vazia.completa, "checklist vazia marcada como pronta faria o card parecer feito");

  const cheia = new Checklist({ id: "c", itens: [{ id: "1", texto: "a", feito: true }] });
  conferir("com tudo marcado, completa", cheia.completa && cheia.progresso === 1);

  const meio = new Checklist({ id: "c", itens: [{ id: "1", texto: "a", feito: true }, { id: "2", texto: "b" }] });
  conferir("metade dá 0,5", meio.progresso === 0.5);
  conferir("itens saem em ordem de posição",
           new Checklist({ id: "c", itens: [{ id: "2", texto: "b", posicao: 2 }, { id: "1", texto: "a", posicao: 1 }] })
             .itens.map((i) => i.texto).join("") === "ab");
}

console.log("\n5) permissões: o desconhecido não pode nada");
{
  conferir("dono pode convidar", poderesDo("dono").convidar);
  conferir("editor NÃO pode convidar", !poderesDo("editor").convidar);
  conferir("comentarista não edita", !poderesDo("comentarista").editar && poderesDo("comentarista").comentar);
  conferir("leitor só vê", poderesDo("leitor").ver && !poderesDo("leitor").comentar);

  // Um typo no papel não pode virar acesso total. O padrão de uma trava é fechado.
  const inventado = poderesDo("editorr");
  conferir("papel desconhecido não pode nada", Object.values(inventado).every((v) => v === false),
           JSON.stringify(inventado));
  conferir("papel vazio também não", Object.values(poderesDo("")).every((v) => v === false));
  conferir("papel nulo também não", Object.values(poderesDo(null)).every((v) => v === false));
}

console.log("\n6) o quadro sabe quem manda nele");
{
  const q = new Quadro({
    id: "q", nome: "Projeto", donoId: "u-dono",
    membros: [{ usuario_id: "u-editor", papel: "editor" }, { usuario_id: "u-leitor", papel: "leitor" }],
  });
  conferir("o dono é dono", q.papelDe("u-dono") === "dono");
  // Sem esta regra, apagar a linha de membro do criador o expulsaria do proprio quadro.
  conferir("e é dono sem precisar de linha em membros", q.podeQue("u-dono", "apagar"));
  conferir("o editor edita", q.podeQue("u-editor", "editar"));
  conferir("mas não convida", !q.podeQue("u-editor", "convidar"));
  conferir("o leitor não cria", !q.podeQue("u-leitor", "criar"));
  conferir("quem não é membro não vê", !q.podeQue("u-estranho", "ver"));
  conferir("nem sem usuário nenhum", !q.podeQue(null, "ver"));
}

console.log("\n7) coluna e quadro contam o que a Lisa vai perguntar");
{
  const coluna = new Coluna({
    id: "c1", nome: "Fazendo", posicao: 1,
    cards: [
      { id: "1", titulo: "atrasado", posicao: 1, fimEm: daquiA(-5) },
      { id: "2", titulo: "hoje", posicao: 2, fimEm: daquiA(3) },
      { id: "3", titulo: "sem prazo", posicao: 3 },
      { id: "4", titulo: "arquivado", posicao: 4, arquivado: true },
    ],
  });
  conferir("card arquivado não entra na coluna", coluna.total === 3, `veio ${coluna.total}`);
  const c = coluna.contarPorPrazo(AGORA);
  conferir("conta 1 atrasado e 1 para hoje", c.atrasado === 1 && c.hoje === 1, JSON.stringify(c));

  const q = new Quadro({ id: "q", nome: "x", donoId: "u", colunas: [coluna] });
  conferir("o quadro soma os cards", q.totalDeCards === 3);
  conferir("e o resumo bate", q.resumo(AGORA).porPrazo.atrasado === 1);
  conferir("coluna arquivada não entra no quadro",
           new Quadro({ id: "q", nome: "x", donoId: "u", colunas: [{ id: "z", nome: "velha", arquivada: true }] }).colunas.length === 0);
}

console.log("\n8) ordem e posição de destino ao soltar");
{
  const coluna = new Coluna({
    id: "c", nome: "x",
    cards: [
      { id: "b", titulo: "b", posicao: 2048 },
      { id: "a", titulo: "a", posicao: 1024 },
      { id: "c", titulo: "c", posicao: 3072 },
    ],
  });
  conferir("cards saem em ordem de posição", coluna.cards.map((c) => c.id).join("") === "abc");
  conferir("soltar no topo fica antes do primeiro", coluna.posicaoPara(0) < 1024);
  conferir("soltar no meio fica entre os dois", coluna.posicaoPara(1) === 1536);
  conferir("soltar no fim fica depois do último", coluna.posicaoPara(3) > 3072);
}

console.log("\n9) iniciais do avatar");
{
  conferir("nome completo dá duas letras", new Usuario({ nome: "Brayan Rodrigues" }).iniciais === "BR");
  conferir("nome do meio não conta", new Usuario({ nome: "Brayan Henrique Rodrigues" }).iniciais === "BR");
  conferir("um nome só dá uma letra", new Usuario({ nome: "Bryan" }).iniciais === "B");
  conferir("sem nome, cai no e-mail", new Usuario({ nome: "", email: "abc@x.com" }).iniciais === "A");
  conferir("sem nada não quebra", typeof new Usuario({}).iniciais === "string");
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
