// Trava de acesso das rotas da Lisa Code (extensão do VS Code, ver src/app/api/lisa-code/*).
// Diferente do resto do app (que não pede autenticação nenhuma hoje), essas rotas dão à Lisa
// permissão de PROPOR mudanças no código do usuário — por pedido explícito dele, precisam ficar
// fechadas com um token pessoal que só ele conhece (guardado no SecretStorage da extensão no VS
// Code, nunca versionado), mesmo que o .vsix da extensão nunca seja publicado/distribuído.
import { timingSafeEqual } from "crypto";

/** true só se o header `x-lisa-token` bater com LISA_EXTENSION_TOKEN (comparação em tempo
 * constante, pra não vazar por timing quantos caracteres bateram). Se a variável de ambiente
 * não estiver configurada, nega por padrão (fail-closed) — melhor pedir pra configurar do que
 * deixar a rota aberta sem querer. */
export function checkLisaCodeToken(req) {
  const expected = process.env.LISA_EXTENSION_TOKEN;
  if (!expected) return false;
  const got = req.headers.get("x-lisa-token") || "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
