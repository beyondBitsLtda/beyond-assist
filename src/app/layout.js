import "./globals.css";
import Abertura, { SCRIPT_DA_ABERTURA } from "@/components/shell/Abertura.js";

export const metadata = {
  title: "Beyond Bits",
  description: "J.A.R.V.I.S. Assistant Interface",
};

// sem isso o celular renderiza a página numa largura virtual de ~980px e só depois
// dá zoom pra caber na tela — nenhum @media (max-width) do CSS funciona sem essa tag.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // usa a tela inteira em telas com notch/cantos arredondados
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
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Rajdhani:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="preload" href="/marca/lisa.png" as="image" />
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DA_ABERTURA }} />
      </head>
      <body>
        <Abertura />
        {children}
      </body>
    </html>
  );
}
