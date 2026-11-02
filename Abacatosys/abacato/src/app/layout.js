import "./globals.css";
import "./quadro.css";
import "./documentos.css";
import "./painel.css";
import "./pessoas.css";
import "./lisa.css";
import "./plano.css";
import "./abertura.css";
import "./visual-lisa.css";
import Abertura, { SCRIPT_DA_ABERTURA } from "@/componentes/Abertura.js";
import { SCRIPT_DE_INSTALAR } from "@/lib/instalarApp.js";

// manifest + ícones: o Chrome passa a oferecer "Instalar app" (ver src/lib/instalarApp.js)
export const metadata = {
  title: "Abacato System",
  description: "Quadros, documentação e acompanhamento — da Beyond Bits.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/marca/app-192.png", apple: "/marca/app-apple.png" },
  appleWebApp: { capable: true, title: "Abacato", statusBarStyle: "default" },
};

// A barra do app instalado na cor da barra lateral.
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#111814" };

/**
 * O tema é decidido ANTES de a página pintar, por um script que roda de forma síncrona no
 * `<head>`.
 *
 * Fazer isso num `useEffect` custaria um flash branco a cada carregamento no modo escuro —
 * a página pinta clara, o React monta, e só então o tema troca. É pequeno, é visível, e
 * acontece em toda navegação.
 *
 * `system` é o padrão e não é um terceiro tema: é "obedeça ao sistema operacional". Quem nunca
 * escolheu nada recebe o que já escolheu no aparelho.
 */
const SCRIPT_DO_TEMA = `
(function () {
  try {
    var salvo = localStorage.getItem("abacato-tema");
    var escuro = salvo === "escuro" ||
      (salvo !== "claro" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (escuro) document.documentElement.setAttribute("data-tema", "escuro");
  } catch (e) {
    /* modo anônimo, armazenamento bloqueado — segue no claro, que é o padrão */
  }
})();
`;

/**
 * O visual da Lisa Task (src/app/visual-lisa.css), decidido como o tema: ANTES de pintar. Quem
 * grava o cookie é o middleware, pelo tipo da conta e pelo endereço.
 *
 * A aba também vira Lisa Task: título e ícone. O Next devolve o título e o ícone do `metadata` a
 * cada troca de tela, e por isso um observador no <head> põe os da Lisa de volta sempre que
 * mudam — trocar uma vez só, no carregamento, durava até o primeiro clique.
 */
const SCRIPT_DO_VISUAL = `
(function () {
  if (!/(?:^|;\\s*)abacato_visual=lisa(?:;|$)/.test(document.cookie)) return;
  document.documentElement.setAttribute("data-visual", "lisa");
  function acertar() {
    if (document.title !== "Lisa Task") document.title = "Lisa Task";
    var icones = document.head.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]');
    for (var i = 0; i < icones.length; i++) {
      var certo = icones[i].getAttribute("rel") === "icon" ? "/marca/lisa-192.png" : "/marca/lisa-apple.png";
      if (icones[i].getAttribute("href") !== certo) icones[i].setAttribute("href", certo);
    }
  }
  new MutationObserver(acertar).observe(document.head, {
    childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["href"]
  });
  acertar();
  document.addEventListener("DOMContentLoaded", acertar);
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
        />
        <link rel="preload" href="/marca/abacato.png" as="image" />
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_TEMA }} />
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_VISUAL }} />
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DA_ABERTURA }} />
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DE_INSTALAR }} />
      </head>
      <body>
        <Abertura />
        {children}
      </body>
    </html>
  );
}
