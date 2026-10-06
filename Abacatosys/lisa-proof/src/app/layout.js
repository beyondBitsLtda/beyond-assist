import "./globals.css";
import "./neuro.css";
import "./mapa.css";
import "./pratica.css";
import "./festa.css";

export const metadata = {
  title: "Lisa_Proof",
  description: "Estudo de programação com trilhas, metas e ofensiva — em cima dos quadros STUDY do Abacato.",
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
    var s = localStorage.getItem("proof-tema") || "escuro";
    escuro = s === "escuro" || (s === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  } catch (e) { /* sem armazenamento: fica no padrão, escuro */ }
  document.documentElement.setAttribute("data-tema", escuro ? "escuro" : "claro");
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_TEMA }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
