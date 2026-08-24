import "./globals.css";

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
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Rajdhani:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
