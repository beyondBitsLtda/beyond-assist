// Exercita o elo entre o arquivo aberto no editor e o que existe no Beyond Bits.
//
// O risco desta funcionalidade não é quebrar — é FUNCIONAR DEMAIS. Se todo arquivo aberto
// trouxer algum card, relacionado ou não, a pessoa aprende a ignorar o bloco em uma semana e a
// funcionalidade morre sem nunca ter dado erro. Por isso metade deste arquivo testa o que ela
// NÃO deve trazer.

import { termosDoArquivo, pontuar, itensRelevantes, blocoDeContexto } from "../src/lib/relevanciaDoArquivo.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

// Cards de verdade deste projeto, como seriam escritos por uma pessoa — nunca com o nome do
// arquivo, sempre com o assunto em português.
const CARDS = [
  { title: "Revisar o rodízio de chaves do Gemini", board: "Quarto de Guerra" },
  { title: "Ajustar a voz da Lisa que cai pro navegador", description: "o fallback está disparando demais" },
  { title: "Montar a tela do servidor no iMac", due: "2026-09-20" },
  { title: "Proposta comercial SATILOG", board: "Comercial" },
  { title: "Comprar café", board: "Pessoal" },
  { title: "Estudo de mercado para o app do montador de móveis" },
];

console.log("\n1) o caminho do arquivo vira termos úteis");
{
  conferir("nome simples", JSON.stringify(termosDoArquivo("src/lib/gemini.js")) === '["gemini"]');
  // Contém, e não é idêntico: a lista traz também as traduções (key→chave, health→saude), e
  // fixar o conteúdo exato transformaria cada palavra nova do glossário numa falha falsa.
  const camel = termosDoArquivo("src/lib/geminiKeyHealth.js");
  conferir("camelCase é separado", ["gemini", "key", "health"].every((t) => camel.includes(t)), JSON.stringify(camel));
  conferir("e a tradução entra junto", camel.includes("chave") && camel.includes("saude"), JSON.stringify(camel));
  conferir("hífen é separado", termosDoArquivo("app/gemini-keys/page.js").includes("keys"),
           JSON.stringify(termosDoArquivo("app/gemini-keys/page.js")));
  conferir("parênteses de rota do Next somem", !termosDoArquivo("src/app/(panels)/x/page.js").some((t) => t.includes("(")));
  conferir("pastas genéricas não viram termo", !termosDoArquivo("src/lib/utils/index.js").length,
           JSON.stringify(termosDoArquivo("src/lib/utils/index.js")));
  conferir("extensão não vira termo", !termosDoArquivo("servidor/montar-tela.sh").includes("sh"));
  conferir("caminho vazio não quebra", termosDoArquivo("").length === 0);
  conferir("nulo não quebra", termosDoArquivo(null).length === 0);
}

console.log("\n2) acha o que tem a ver");
{
  const achados = itensRelevantes(termosDoArquivo("src/lib/gemini.js"), CARDS);
  conferir("gemini.js acha o card do rodízio de chaves",
           achados.some((c) => c.title.includes("rodízio de chaves")), JSON.stringify(achados.map((c) => c.title)));

  const tela = itensRelevantes(termosDoArquivo("servidor/montar-tela.sh"), CARDS);
  conferir("montar-tela.sh acha o card da tela do servidor",
           tela.some((c) => c.title.includes("tela do servidor")), JSON.stringify(tela.map((c) => c.title)));

  const voz = itensRelevantes(termosDoArquivo("src/lib/browserVoice.js"), CARDS);
  conferir("browserVoice.js acha o card da voz",
           voz.some((c) => c.title.includes("voz da Lisa")), JSON.stringify(voz.map((c) => c.title)));
}

console.log("\n3) e, principalmente, NÃO acha o que não tem");
{
  // Este é o teste que decide se a funcionalidade sobrevive ao uso. Um arquivo sem relação
  // nenhuma precisa devolver LISTA VAZIA, não "o mais parecido que eu achei".
  for (const arquivo of ["src/components/shell/Sidebar.js", "src/lib/base64.js", "next.config.mjs"]) {
    const achados = itensRelevantes(termosDoArquivo(arquivo), CARDS);
    conferir(`${arquivo} não traz nada`, achados.length === 0, `trouxe ${JSON.stringify(achados.map((c) => c.title))}`);
  }
  conferir("arquivo sem termo nenhum não traz nada", itensRelevantes(termosDoArquivo("src/lib/index.js"), CARDS).length === 0);
  conferir("lista de itens vazia não quebra", itensRelevantes(["gemini"], []).length === 0);
  conferir("itens indefinidos não quebram", itensRelevantes(["gemini"], undefined).length === 0);
}

console.log("\n4) o título pesa mais que a descrição");
{
  const noTitulo = { title: "mexer no gemini" };
  const naDescricao = { title: "outra coisa", description: "de passagem, citei o gemini aqui" };
  conferir("título vale mais", pontuar(["gemini"], noTitulo) > pontuar(["gemini"], naDescricao),
           `${pontuar(["gemini"], noTitulo)} contra ${pontuar(["gemini"], naDescricao)}`);
  // Uma menção solta na descrição NÃO alcança o piso sozinha — é o que impede o card de
  // aparecer só porque alguém citou a palavra uma vez.
  conferir("menção solta na descrição não passa do piso", itensRelevantes(["gemini"], [naDescricao]).length === 0);
  conferir("mas duas menções na descrição passam",
           itensRelevantes(["gemini", "chaves", "rodizio"], [{ title: "x", description: "gemini chaves rodizio" }]).length === 1);
}

console.log("\n5) ordem e limite");
{
  const muitos = Array.from({ length: 20 }, (_, i) => ({ title: `card gemini número ${i}` }));
  const achados = itensRelevantes(["gemini"], muitos, { max: 4 });
  conferir("respeita o teto de 4", achados.length === 4, `veio ${achados.length}`);

  const mistos = [
    { title: "só gemini" },
    { title: "gemini chaves health" },
  ];
  const ordenados = itensRelevantes(["gemini", "chaves", "health"], mistos);
  conferir("o mais relacionado vem primeiro", ordenados[0].title === "gemini chaves health", ordenados[0]?.title);
}

console.log("\n6) o bloco que chega na conversa");
{
  const bloco = blocoDeContexto([
    { rotulo: "Cards do Trello", itens: [{ title: "Revisar rodízio", due: "2026-09-20" }] },
    { rotulo: "Chamados", itens: [{ title: "Erro no login", status: "aberto" }] },
  ]);
  conferir("traz os dois grupos", bloco.includes("Cards do Trello") && bloco.includes("Chamados"));
  conferir("mostra o prazo quando existe", bloco.includes("prazo: 2026-09-20"));
  conferir("mostra o status quando existe", bloco.includes("[aberto]"));

  // Silêncio é informação; "(nada encontrado)" em toda mensagem é ruído.
  conferir("sem itens, não inventa bloco", blocoDeContexto([{ rotulo: "Cards", itens: [] }]) === "");
  conferir("grupos vazios não quebram", blocoDeContexto([]) === "");
  conferir("nulo não quebra", blocoDeContexto(null) === "");
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
