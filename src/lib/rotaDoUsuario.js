// O molde das rotas do que é da pessoa (01/11/2026, o MVP — perfil e Lisa Task): o dono vem da sessão
// (o portão já conferiu o token); sem dono, 401; o erro devolve o status dele.

import { sessaoDe } from "./papelNaSessao.js";

export async function comDono(req, fazer) {
  const { dono } = sessaoDe(req);
  if (!dono) return Response.json({ ok: false, error: "sessão sem usuário" }, { status: 401 });
  try {
    return Response.json({ ok: true, ...((await fazer(dono)) || {}) }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return Response.json({ ok: false, error: String(err?.message || err) }, { status: err?.status || 500 });
  }
}
