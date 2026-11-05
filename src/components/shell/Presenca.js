"use client";

// A batida de presença do painel "Uso dos usuários" (src/lib/usoDosUsuarios.js): com a aba visível, uma por minuto,
// com a tela em que a pessoa está; quando a aba volta a ficar visível, uma que marca a presença sem somar o tempo
// escondida. Fora das telas sem sessão (a entrada). Não desenha nada.

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const SEM_SESSAO = ["/login", "/auth-check", "/pair"];

export default function Presenca() {
  const caminho = usePathname() || "/";
  const onde = useRef(caminho);
  onde.current = caminho;
  const fora = SEM_SESSAO.some((p) => caminho === p || caminho.startsWith(p + "/"));

  useEffect(() => {
    if (fora) return undefined;
    const bater = (voltou = false) => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/presenca", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caminho: onde.current, voltou }) }).catch(() => {});
    };
    bater();
    const relogio = setInterval(() => bater(), 60_000);
    const voltou = () => { if (document.visibilityState === "visible") bater(true); };
    document.addEventListener("visibilitychange", voltou);
    return () => { clearInterval(relogio); document.removeEventListener("visibilitychange", voltou); };
  }, [fora]);

  return null;
}
