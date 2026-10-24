"use client";

// O visual do centro do Assistente, escolhido no painel "Visual da Lisa" (/visual) ou no menu
// "Aparência da Lisa". Cada um é carregado só quando é usado (WebGL pesa).

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { lerVisual, EVENTO_DO_VISUAL, CHAVE_DO_VISUAL, VISUAL_PADRAO } from "@/lib/visuaisDaLisa.js";

// (o Next exige as opções do dynamic escritas em cada chamada, não numa variável)
const COMPONENTES = {
  esfera: dynamic(() => import("../EsferaDaVoz.js"), { ssr: false, loading: () => null }),
  lente: dynamic(() => import("./Lente.js"), { ssr: false, loading: () => null }),
  orbe: dynamic(() => import("./Orbe.js"), { ssr: false, loading: () => null }),
  plasma: dynamic(() => import("./Plasma.js"), { ssr: false, loading: () => null }),
  anel: dynamic(() => import("./Anel.js"), { ssr: false, loading: () => null }),
};

/** O visual `modo`, ligado ao sinal da voz (`obterSinal`, chamado a cada quadro). */
export default function VisualDaLisa({ modo, obterSinal, ocupacao }) {
  const Componente = COMPONENTES[modo] || COMPONENTES[VISUAL_PADRAO];
  return <Componente key={modo} obterSinal={obterSinal} ocupacao={ocupacao} />;
}

/** O visual escolhido neste navegador — e acompanha a troca na hora (nesta aba e nas outras). */
export function usarVisualEscolhido() {
  const [modo, setModo] = useState(VISUAL_PADRAO);
  useEffect(() => {
    setModo(lerVisual());
    const aoEscolher = (e) => setModo(e.detail || lerVisual());
    const aoGuardar = (e) => { if (e.key === CHAVE_DO_VISUAL) setModo(lerVisual()); };
    window.addEventListener(EVENTO_DO_VISUAL, aoEscolher);
    window.addEventListener("storage", aoGuardar);
    return () => {
      window.removeEventListener(EVENTO_DO_VISUAL, aoEscolher);
      window.removeEventListener("storage", aoGuardar);
    };
  }, []);
  return modo;
}
