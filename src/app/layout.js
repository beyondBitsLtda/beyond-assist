import "./globals.css";
import Abertura, { SCRIPT_DA_ABERTURA } from "@/components/shell/Abertura.js";
import { SCRIPT_DE_INSTALAR } from "@/lib/instalarApp.js";

// manifest + ícones: o Chrome passa a oferecer "Instalar app" (ver src/lib/instalarApp.js)
export const metadata = {
  title: "Beyond Bits",
  description: "J.A.R.V.I.S. Assistant Interface",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/marca/app-192.png", apple: "/marca/app-apple.png" },
  appleWebApp: { capable: true, title: "Lisa", statusBarStyle: "black-translucent" },
};

// sem isso o celular renderiza a página numa largura virtual de ~980px e só depois
// dá zoom pra caber na tela — nenhum @media (max-width) do CSS funciona sem essa tag.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // usa a tela inteira em telas com notch/cantos arredondados
  themeColor: "#000000", // a barra do app instalado na cor do fundo
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: o script da abertura põe `data-abertura` e a cor de destaque
    // no <html> antes de o React hidratar — o servidor não tem como saber desses dois.
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="preload" href="/marca/lisa.png" as="image" />
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
