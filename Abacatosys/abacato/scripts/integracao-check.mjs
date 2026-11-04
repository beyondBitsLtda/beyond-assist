// Confere as regras das integrações, sem rede e sem banco.
//
// O token de integração é a única chave do Abacato que não passa por uma pessoa: ninguém digita
// senha, ninguém vê a tela. Se ela deixar passar o que não devia, nada na interface mostra. Por
// isso, como no auth-check, metade dos casos é sobre o que NÃO pode passar.

import { gerarToken, hashDoToken, tokenDoCabecalho, acharDuplicado, normalizarSite, PREFIXO_TOKEN }
  from "../src/dominio/integracao.js";
import { ehLivre } from "../src/lib/abacatoAuth.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

console.log("\n1) o token");
{
  const a = gerarToken();
  const b = gerarToken();
  conferir("nasce com o prefixo", a.startsWith(PREFIXO_TOKEN));
  conferir("dois tokens nunca se repetem", a !== b);
  conferir("tem comprimento de segredo", a.length === PREFIXO_TOKEN.length + 40, `veio com ${a.length}`);
  const h = await hashDoToken(a);
  conferir("o hash é SHA-256 em hex", /^[0-9a-f]{64}$/.test(h));
  conferir("o hash não contém o token", !h.includes(a.slice(PREFIXO_TOKEN.length)));
  conferir("o mesmo token dá o mesmo hash (é assim que ele é achado)", h === (await hashDoToken(a)));
  conferir("tokens diferentes dão hashes diferentes", h !== (await hashDoToken(b)));
}

console.log("\n2) o cabeçalho");
{
  const t = gerarToken();
  conferir("Bearer + token passa", tokenDoCabecalho(`Bearer ${t}`) === t);
  conferir("bearer minúsculo passa", tokenDoCabecalho(`bearer ${t}`) === t);
  conferir("sem cabeçalho não", tokenDoCabecalho(null) === null);
  conferir("vazio não", tokenDoCabecalho("") === null);
  conferir("sem 'Bearer' não", tokenDoCabecalho(t) === null);
  conferir("sem o prefixo não", tokenDoCabecalho(`Bearer ${t.slice(PREFIXO_TOKEN.length)}`) === null);
  conferir("prefixo sozinho não", tokenDoCabecalho(`Bearer ${PREFIXO_TOKEN}`) === null);
  conferir("curto demais não", tokenDoCabecalho(`Bearer ${PREFIXO_TOKEN}abc123`) === null);
  conferir("dois tokens colados não", tokenDoCabecalho(`Bearer ${t} ${t}`) === null);
}

console.log("\n3) o portão de sessão");
{
  conferir("/api/integracoes/quadro fica fora do portão", ehLivre("/api/integracoes/quadro"));
  conferir("/api/integracoes/cards fica fora do portão", ehLivre("/api/integracoes/cards"));
  conferir("/api/integracoesX NÃO", !ehLivre("/api/integracoesX/quadro"));
  conferir("/api/integracoes sem barra NÃO (não existe rota ali)", !ehLivre("/api/integracoes"));
  conferir("as rotas de pessoa continuam trancadas", !ehLivre("/api/quadros") && !ehLivre("/api/cards/1"));
}

console.log("\n4) duplicado");
{
  const cards = [
    { id: "1", titulo: "Clínica Sorriso LTDA", descricao: "📞 (41) 99999-0000", origem: "trello", origem_id: "t1" },
    { id: "2", titulo: "Padaria Pão Quente", descricao: "🌐 **Site:** https://www.paoquente.com.br/", origem: null, origem_id: null },
    { id: "3", titulo: "Oficina do Zé", descricao: "", origem: "Beyond-Lead", origem_id: "ChIJ123" },
  ];
  const achar = (lead) => acharDuplicado(cards, { origem: "Beyond-Lead", ...lead });

  conferir("mesmo placeId é duplicado", achar({ titulo: "Outro nome", origemId: "ChIJ123" })?.id === "3");
  conferir("mesmo título, com acento e caixa diferentes", achar({ titulo: "clinica sorriso ltda." })?.id === "1");
  conferir("o site aparece na descrição", achar({ titulo: "Pão Quente Matriz", site: "http://paoquente.com.br" })?.id === "2");
  conferir("empresa nova não é duplicada", achar({ titulo: "Mercado Bom Preço", site: "https://bompreco.com" }) === null);
  conferir("id de OUTRA origem não conta", achar({ titulo: "X", origemId: "t1" }) === null,
           "um id do Trello e um placeId do Google podem coincidir por acaso");
  conferir("título vazio não casa com nada", achar({ titulo: "" }) === null);
  conferir("site curto demais não casa com tudo", normalizarSite("a.b") === "");
}

console.log(falhas ? `\n${falhas} falha(s).\n` : "\nTudo certo.\n");
process.exit(falhas ? 1 : 0);
