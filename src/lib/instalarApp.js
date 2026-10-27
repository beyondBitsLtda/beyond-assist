// "Instalar app" pelo Chrome (e Edge, e Chrome do Android).
//
// O navegador avisa que a página pode virar aplicativo com o evento `beforeinstallprompt` —
// uma vez, cedo, às vezes antes de o React montar. Quem o guarda é este script, que roda no
// <head> (ver src/app/layout.js); o botão só lê o que ficou guardado em `window`. Escutar o
// evento num componente perderia o aviso sempre que ele chegasse antes da hidratação.
//
// iPhone e iPad não têm esse evento: lá se instala por Compartilhar → "Adicionar à Tela de
// Início", e o botão só explica isso.
//
// Sem "use client" de propósito: o layout (componente de servidor) importa a string do script,
// e um módulo de cliente entregaria uma referência no lugar dela.

export const SCRIPT_DE_INSTALAR = `
(function () {
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    window.__pedidoDeInstalar = e;
    window.dispatchEvent(new Event("instalar-app"));
  });
  window.addEventListener("appinstalled", function () {
    window.__pedidoDeInstalar = null;
    window.__appInstalado = true;
    window.dispatchEvent(new Event("instalar-app"));
  });
})();
`;

/** Como está a instalação neste aparelho: dá para instalar, já está instalado, ou é iPhone. */
export function estadoDaInstalacao() {
  if (typeof window === "undefined") return { pode: false, instalado: false, ios: false };
  const instalado =
    !!window.__appInstalado ||
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return { pode: !!window.__pedidoDeInstalar && !instalado, instalado, ios: ios && !instalado };
}

// O caminho no iPhone, que não tem o aviso de instalar: mostrado no lugar do botão.
export const DICA_DO_IPHONE = "No iPhone: toque em Compartilhar (o quadrado com a seta para cima) e depois em \"Adicionar à Tela de Início\".";
