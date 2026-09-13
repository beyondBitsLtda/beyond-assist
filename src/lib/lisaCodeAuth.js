// Trava de acesso das rotas da Lisa Code (extensão do VS Code, ver src/app/api/lisa-code/*).
// Diferente do resto do app (que não pede autenticação nenhuma hoje), essas rotas dão à Lisa
// permissão de PROPOR mudanças no código do usuário — por pedido explícito dele, precisam ficar
// fechadas com um token pessoal que só ele conhece (guardado no SecretStorage da extensão no VS
// Code, nunca versionado), mesmo que o .vsix da extensão nunca seja publicado/distribuído.

/**
 * Compara em tempo constante: percorre os bytes todos sempre, mesmo depois de já saber que
 * diferem.
 *
 * Sair no primeiro byte diferente parece otimização e é um vazamento: o tempo de resposta
 * revelaria quantos caracteres do token alguém já acertou, e daria pra descobrir o segredo
 * inteiro um caractere por vez.
 *
 * Substitui o `crypto.timingSafeEqual` do Node, que não existe no Edge runtime do Cloudflare.
 * O comprimento é comparado antes porque ele não é segredo — o que precisa ser protegido é o
 * CONTEÚDO.
 */
function iguaisEmTempoConstante(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diferenca = 0;
  for (let i = 0; i < x.length; i++) diferenca |= x[i] ^ y[i];
  return diferenca === 0;
}

/** true só se o header `x-lisa-token` bater com LISA_EXTENSION_TOKEN. Se a variável de ambiente
 * não estiver configurada, nega por padrão (fail-closed) — melhor pedir pra configurar do que
 * deixar a rota aberta sem querer. */
export function checkLisaCodeToken(req) {
  const expected = process.env.LISA_EXTENSION_TOKEN;
  if (!expected) return false;
  const got = req.headers.get("x-lisa-token") || "";
  return iguaisEmTempoConstante(got, expected);
}
