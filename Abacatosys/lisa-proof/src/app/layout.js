import "./globals.css";
import "./neuro.css";
import "./mapa.css";
import "./pratica.css";

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

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
