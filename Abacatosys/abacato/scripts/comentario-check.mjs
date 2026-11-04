// Comentários de card (BEYOND-0004): o que pode ser enviado e quem mexe em quê.
//
// Roda sem banco e sem rede — é só domínio. A rota confere estas regras ANTES de subir
// qualquer imagem; se uma delas falhar aqui, o Storage ganha arquivo órfão lá.

import {
  conferirComentario, caminhoDaImagem, podeEditarComentario, podeApagarComentario,
  MAXIMO_DE_IMAGENS, TETO_DA_IMAGEM, TETO_DO_TEXTO,
} from "../src/dominio/comentarios.js";
import { poderesDo } from "../src/dominio/Quadro.js";

let falhas = 0;
const conferir = (titulo, ok, detalhe = "") => {
  console.log(`  ${ok ? "ok    " : "FALHOU"}  ${titulo}${detalhe ? `  — ${detalhe}` : ""}`);
  if (!ok) falhas += 1;
};
const png = (tamanho = 2048, nome = "print.png") => ({ tipo: "image/png", tamanho, nome });

console.log("\nO que um comentário pode levar\n");

let r = conferirComentario({ texto: "  combinado, sigo amanhã \r\n" });
conferir("texto é aparado e o \\r\\n vira \\n", r.ok && r.texto === "combinado, sigo amanhã", JSON.stringify(r.texto));

r = conferirComentario({ texto: "linha 1\r\nlinha 2" });
conferir("quebra de linha do meio fica", r.ok && r.texto === "linha 1\nlinha 2");

r = conferirComentario({ texto: "   ", imagens: [] });
conferir("vazio dos dois lados é recusado", !r.ok && /escreva algo/.test(r.erro), r.erro);

r = conferirComentario({ texto: "", imagens: [png()] });
conferir("só imagem, sem texto, vale", r.ok && r.texto === "");

r = conferirComentario({ texto: "x".repeat(TETO_DO_TEXTO + 1) });
conferir(`texto acima de ${TETO_DO_TEXTO} caracteres é recusado`, !r.ok && /limite/.test(r.erro), r.erro);

r = conferirComentario({ texto: "ok", imagens: Array.from({ length: MAXIMO_DE_IMAGENS }, () => png()) });
conferir(`${MAXIMO_DE_IMAGENS} imagens passam`, r.ok);

r = conferirComentario({ texto: "ok", imagens: Array.from({ length: MAXIMO_DE_IMAGENS + 1 }, () => png()) });
conferir(`${MAXIMO_DE_IMAGENS + 1} imagens são recusadas`, !r.ok && /no máximo/.test(r.erro), r.erro);

r = conferirComentario({ texto: "", imagens: [{ tipo: "application/pdf", tamanho: 100, nome: "contrato.pdf" }] });
conferir("PDF não é imagem aceita, e o nome aparece no erro", !r.ok && /contrato\.pdf/.test(r.erro), r.erro);

r = conferirComentario({ texto: "", imagens: [{ tipo: "image/svg+xml", tamanho: 100, nome: "logo.svg" }] });
conferir("SVG é recusado (é código, não só imagem)", !r.ok, r.erro);

r = conferirComentario({ texto: "", imagens: [png(TETO_DA_IMAGEM + 1, "enorme.png")] });
conferir("imagem acima de 10 MB é recusada", !r.ok && /10\.0 MB/.test(r.erro), r.erro);

r = conferirComentario({ texto: "", imagens: [png(0, "vazia.png")] });
conferir("imagem vazia é recusada", !r.ok && /vazia/.test(r.erro), r.erro);

for (const tipo of ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]) {
  r = conferirComentario({ texto: "", imagens: [{ tipo, tamanho: 10, nome: "x" }] });
  conferir(`${tipo} é aceito`, r.ok);
}

console.log("\nOnde a imagem mora\n");

const caminho = caminhoDaImagem({ quadroId: "q1", cardId: "c1", tipo: "image/webp", sorteio: "abc" });
conferir("caminho é quadro/card/sorteio.extensão", caminho === "q1/c1/abc.webp", caminho);
conferir("o nome original não entra no caminho", !caminhoDaImagem({ quadroId: "q", cardId: "c", tipo: "image/png", sorteio: "s" }).includes("print"));

console.log("\nQuem edita e quem apaga\n");

conferir("autor edita o próprio", podeEditarComentario({ autorId: "a", usuarioId: "a" }));
conferir("outra pessoa não edita", !podeEditarComentario({ autorId: "a", usuarioId: "b" }));
conferir("comentário de conta removida (autor nulo) ninguém edita", !podeEditarComentario({ autorId: null, usuarioId: null }));

conferir("autor apaga o próprio, mesmo sendo só comentarista",
  podeApagarComentario({ autorId: "a", usuarioId: "a", poderes: poderesDo("comentarista") }));
conferir("editor apaga o de outra pessoa",
  podeApagarComentario({ autorId: "a", usuarioId: "b", poderes: poderesDo("editor") }));
conferir("dono apaga o de conta removida",
  podeApagarComentario({ autorId: null, usuarioId: "d", poderes: poderesDo("dono") }));
conferir("comentarista não apaga o de outra pessoa",
  !podeApagarComentario({ autorId: "a", usuarioId: "b", poderes: poderesDo("comentarista") }));
conferir("leitor não apaga o de outra pessoa",
  !podeApagarComentario({ autorId: "a", usuarioId: "b", poderes: poderesDo("leitor") }));

console.log("\nQuem comenta (poderes do quadro)\n");

conferir("dono, editor e comentarista comentam",
  ["dono", "editor", "comentarista"].every((p) => poderesDo(p).comentar));
conferir("leitor só lê", !poderesDo("leitor").comentar && poderesDo("leitor").ver);

console.log(falhas ? `\n${falhas} falha(s).\n` : "\nTudo certo.\n");
process.exit(falhas ? 1 : 0);
