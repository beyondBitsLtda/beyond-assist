import "./globals.css";
import "./quadro.css";
import "./documentos.css";
import "./painel.css";
import "./pessoas.css";
import "./lisa.css";
import "./plano.css";
import "./abertura.css";
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

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
        <link rel="preload" href="/marca/abacato.png" as="image" />
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_TEMA }} />
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
