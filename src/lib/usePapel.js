"use client";

// O papel de quem está na tela (01/11/2026, o MVP): "admin", "usuario" ou null enquanto não se sabe.
// Vem do cookie que o portão grava (lisa_papel) — sem ele, de /api/auth/eu. Serve só para esconder o
// que o usuário não usa e não chamar o que ele não alcança; quem barra de verdade é o portão.

import { useEffect, useState } from "react";
import { COOKIE_PAPEL } from "./authSession.js";

/** O papel escrito no cookie, ou null. */
export function lerPapelDoCookie(cookie = typeof document !== "undefined" ? document.cookie : "") {
  const m = String(cookie || "").match(new RegExp(`(?:^|;\\s*)${COOKIE_PAPEL}=([^;]+)`));
  return m && (m[1] === "admin" || m[1] === "usuario") ? m[1] : null;
}

export default function usePapel() {
  const [papel, setPapel] = useState(null);
  useEffect(() => {
    const doCookie = lerPapelDoCookie();
    if (doCookie) { setPapel(doCookie); return undefined; }
    let vivo = true;
    fetch("/api/auth/eu")
      .then((r) => r.json())
      .then((j) => { if (vivo) setPapel(j?.papel === "usuario" ? "usuario" : "admin"); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);
  return papel;
}
