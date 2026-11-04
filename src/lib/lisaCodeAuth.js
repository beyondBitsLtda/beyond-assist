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
  return conferirTokenDaExtensao(req).ok;
}

/**
 * Como acima, mas dizendo QUAL dos dois problemas aconteceu.
 *
 * A mensagem antiga era "token inválido ou LISA_EXTENSION_TOKEN não configurado no servidor" —
 * dois problemas com consertos opostos numa frase só. Um se resolve no VS Code, o outro no
 * servidor, e a frase não dizia para qual lado ir. Custou uma rodada inteira de investigação
 * em 18/09/2026, olhando o lado errado.
 *
 * Distinguir os dois não vaza nada: "este servidor não tem token configurado" é uma verdade
 * sobre a CONFIGURAÇÃO, não sobre o segredo. Quem não tem o token continua sem saber qual é.
 */
export function conferirTokenDaExtensao(req) {
  const expected = process.env.LISA_EXTENSION_TOKEN;
  if (!expected) {
    return { ok: false, motivo: "LISA_EXTENSION_TOKEN não está configurado NESTE servidor — configure lá, não no VS Code" };
  }
  const got = req.headers.get("x-lisa-token") || "";
  if (!got) {
    return { ok: false, motivo: "a extensão não mandou token — rode \"Lisa Code: Configurar token pessoal\"" };
  }
  if (!iguaisEmTempoConstante(got, expected)) {
    return { ok: false, motivo: "o token da extensão não bate com o deste servidor — rode \"Lisa Code: Configurar token pessoal\" com o valor certo" };
  }
  return { ok: true };
}
