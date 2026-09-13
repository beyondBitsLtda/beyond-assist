// persona.md fica na raiz do repo (não em src/) — de propósito, pra ser fácil de editar sem
// mexer em código.
//
// O texto entra no BUNDLE em tempo de build (ver a regra `asset/source` no next.config.mjs), e
// não é mais lido do disco em runtime. A troca aconteceu por causa do Cloudflare Pages: o Edge
// runtime não tem sistema de arquivos, e o `fs.readFileSync` que estava aqui falhava em
// silêncio — o catch devolvia string vazia, então a Lisa subiria sem personalidade nenhuma e
// sem nenhum erro aparecer no log. É o tipo de defeito que leva semanas pra ser notado.
//
// Continua pegando qualquer edição no persona.md a cada novo deploy, igual antes; o que mudou
// é que agora é o build que lê o arquivo, não o servidor.
import texto from "../../persona.md";

export function getPersonaText() {
  return typeof texto === "string" ? texto : "";
}
