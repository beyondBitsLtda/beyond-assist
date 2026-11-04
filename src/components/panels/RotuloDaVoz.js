"use client";

import { useEffect, useState } from "react";

const ROTULOS = { pronta: "Pronta", pensando: "Pensando", ouvindo: "Ouvindo", falando: "Falando" };

/**
 * O nome do estado da esfera, embaixo dela. Lê o mesmo `obterSinal` da EsferaDaVoz, só que 4
 * vezes por segundo (é texto, não animação) — "falando" vem do áudio tocando, que não é estado
 * do React, e por isso não daria para derivar só das variáveis da página.
 */
export default function RotuloDaVoz({ obterSinal }) {
  const [estado, setEstado] = useState("pronta");
  useEffect(() => {
    const id = setInterval(() => {
      try { setEstado(obterSinal()?.estado || "pronta"); } catch { /* o rótulo nunca quebra a tela */ }
    }, 250);
    return () => clearInterval(id);
  }, [obterSinal]);
  return <div className={`bb-estado-da-voz bb-estado-da-voz--${estado}`}>{ROTULOS[estado] || "Pronta"}</div>;
}
