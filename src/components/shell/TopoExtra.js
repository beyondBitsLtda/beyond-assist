"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Põe menus de um painel no topo do app, ao lado de "Painéis" — o Assistente usa para "Modos"
 * e os ajustes dele. O topo é desenhado pelo Shell, fora da página; o portal é o jeito de a
 * página continuar dona do estado desses menus sem subir tudo para um contexto global.
 *
 * Fora do Shell (o Assistente no celular é tela cheia, sem topo) o lugar não existe e nada é
 * desenhado — quem chama decide onde mostrar os mesmos controles nesse caso.
 */
export default function TopoExtra({ children }) {
  const [lugar, setLugar] = useState(null);
  useEffect(() => { setLugar(document.getElementById("bb-topo-extra")); }, []);
  return lugar ? createPortal(children, lugar) : null;
}
