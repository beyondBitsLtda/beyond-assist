// Exercita o papel de parede: os prontos, a imagem enviada e — principalmente — o que NÃO pode
// ser gravado.
//
// O valor guardado vai direto para o atributo `style` da tela do quadro. Isso faz dele um canal
// de saída se qualquer texto for aceito: `url("https://servidor-de-alguem/x.png")` é CSS
// válido, e o navegador o BUSCA toda vez que alguém abre o quadro. Ninguém veria nada estranho
// na tela; do outro lado, apareceria um registro com a hora e o endereço de quem abriu.
//
// Metade das conferências aqui é sobre recusar.

import { paredeValida, paredeDeImagem, urlDaParede, GRADIENTES } from "../src/dominio/paredes.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));

const BASE = "https://banco.beyond.dev.br";
const BUCKET = `${BASE}/storage/v1/object/public/abacato-paredes`;

console.log("\n1) o que PODE ser gravado");
{
  conferir("nulo (sem papel de parede)", paredeValida(null, BASE));
  conferir("texto vazio também", paredeValida("", BASE));
  for (const g of GRADIENTES.filter((x) => x.valor)) {
    conferir(`o gradiente "${g.nome}"`, paredeValida(g.valor, BASE));
  }
  const nossa = paredeDeImagem(`${BUCKET}/abc/imagem.jpg`);
  conferir("uma imagem do nosso armazenamento", paredeValida(nossa, BASE), nossa);
}

console.log("\n2) o que NÃO pode — o canal de saída");
{
  const recusa = (valor, oQue) =>
    conferir(`recusa ${oQue}`, !paredeValida(valor, BASE), `aceitou: ${String(valor).slice(0, 70)}`);

  recusa('url("https://servidor-de-alguem.com/x.png") center / cover no-repeat', "imagem de outro servidor");
  recusa('url("http://192.168.1.99/x.png") center / cover no-repeat', "imagem de um endereço da rede local");

  // O truque clássico: um domínio que COMEÇA com o nosso e termina em outro lugar.
  recusa(`url("${BASE}.servidor-de-alguem.com/storage/v1/object/public/abacato-paredes/x.jpg") center / cover no-repeat`,
    "domínio que só começa igual ao nosso");

  // Bucket errado dentro do nosso próprio servidor: o de documentos é privado, e apontar o
  // fundo para lá não vazaria a imagem, mas gravaria um caminho que não é o desta função.
  recusa(`url("${BASE}/storage/v1/object/public/abacato-documentos/x.jpg") center / cover no-repeat`,
    "outro bucket do nosso servidor");

  recusa(`url("${BUCKET}/../../outro/x.jpg") center / cover no-repeat`, "caminho que sobe de pasta");
  recusa(`url("${BUCKET}/x.jpg") center / cover no-repeat; background-image: url("https://fora/y.png")`,
    "um segundo fundo grudado no fim");
  recusa('url(javascript:alert(1))', "javascript:");
  recusa("red; position: fixed; inset: 0", "CSS solto tentando cobrir a tela");
  recusa(`${BUCKET}/x.jpg`, "a URL crua, fora do formato");
  recusa("linear-gradient(135deg, #000, #fff)", "um gradiente que não está na lista");
  recusa(paredeDeImagem(`${BUCKET}/`), "caminho vazio dentro do bucket");
}

console.log("\n3) sem servidor configurado, nada de imagem passa");
{
  // Se `SUPABASE_URL` sumir do ambiente, a conferência não pode virar "aceita tudo".
  const nossa = paredeDeImagem(`${BUCKET}/abc/imagem.jpg`);
  conferir("imagem é recusada quando não se sabe qual é o servidor", !paredeValida(nossa, null));
  conferir("mas os gradientes continuam passando", paredeValida(GRADIENTES[1].valor, null));
}

console.log("\n4) ler o endereço de volta");
{
  const url = `${BUCKET}/abc/imagem.jpg`;
  conferir("extrai a URL de uma parede de imagem", urlDaParede(paredeDeImagem(url)) === url);
  conferir("gradiente não tem URL", urlDaParede(GRADIENTES[1].valor) === null);
  conferir("nulo não quebra", urlDaParede(null) === null);
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
