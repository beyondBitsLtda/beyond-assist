import "./globals.css";
import "./neuro.css";
import "./mapa.css";
import "./pratica.css";
import "./festa.css";
import "./agenda.css";
import "./codigo.css";
import "./raiox.css";
import "./reino.css";
import "./novidades.css";
import "./bolsa.css";
import "./dominio.css";
import "./caderno.css";
import "./biblioteca.css";
import "./estante.css";
import "./acervo.css";
import "./marca.css";
import "./cartoes.css";
import "./chamados.css";
import "./lisa.css";
import "./correio.css";
import "./jogos.css";
import { SCRIPT_DE_INSTALAR } from "@/lib/instalarApp.js";

export const metadata = {
  title: "Lisa_Proof",
  description: "Estudo diário de qualquer tema — programação, música, idiomas, matemática — com trilhas, prática e ofensiva.",
  icons: { icon: "/icone.svg", apple: "/icone-apple.png" },
  // Instalável como app: é o que libera notificação push no iPhone (só funciona em app instalado
  // na tela de início) e tira a barra do navegador no Android.
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Lisa_Proof", statusBarStyle: "black-translucent" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#111814",
};

/**
 * O tema é decidido ANTES de a página pintar, por um script síncrono no <head> (mesma solução do
 * Abacato). Num efeito do React, a página pintaria clara e só depois escureceria — um flash a
 * cada carregamento. O escuro é o padrão; "sistema" segue o aparelho.
 */
const SCRIPT_DO_TEMA = `
(function () {
  var escuro = true;
  try {
    // o visual premium (03/11/2026) é escuro: quem tinha o claro salvo volta ao escuro uma vez (dá para trocar de novo)
    if (localStorage.getItem("proof-visual") !== "premium") { localStorage.setItem("proof-tema", "escuro"); localStorage.setItem("proof-visual", "premium"); }
    var s = localStorage.getItem("proof-tema") || "escuro";
    escuro = s === "escuro" || (s === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  } catch (e) { /* sem armazenamento: fica no padrão, escuro */ }
  document.documentElement.setAttribute("data-tema", escuro ? "escuro" : "claro");
  // a tela de abertura só na primeira página da sessão (src/componentes/marca/TelaDeAbertura.js)
  try { if (sessionStorage.getItem("proof-abertura")) document.documentElement.setAttribute("data-abertura", "vista"); } catch (e) { /* sem armazenamento */ }
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_TEMA }} />
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DE_INSTALAR }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@500;600;700;800;900&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
