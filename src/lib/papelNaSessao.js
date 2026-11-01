// O papel de quem fez o pedido, para as rotas (01/11/2026, o MVP — ver papelDe em authSession.js).
// O portão (src/middleware.js) já conferiu a assinatura do token antes de a rota rodar; aqui ele só
// é lido. Rotas que mudam de comportamento para o usuário (a conversa, o Modo Tela, os repositórios)
// perguntam aqui.

import { COOKIE_SESSAO, lerPayload, papelDe } from "./authSession.js";

/** { dono (o sub), papel ("admin" | "usuario") } da sessão do pedido. */
export function sessaoDe(req) {
  const payload = lerPayload(req?.cookies?.get?.(COOKIE_SESSAO)?.value);
  return { dono: payload?.sub || null, papel: papelDe(payload, process.env.LISA_ADMINS) };
}

export const ehUsuario = (req) => sessaoDe(req).papel === "usuario";
