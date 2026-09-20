import "./globals.css";
import "./quadro.css";
import "./documentos.css";
import "./painel.css";
import "./pessoas.css";

export const metadata = {
  title: "Abacato System",
  description: "Quadros, documentação e acompanhamento — da Beyond Bits.",
};

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
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_TEMA }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
