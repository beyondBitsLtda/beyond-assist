import BarraLateral from "@/componentes/BarraLateral.js";

/**
 * A moldura de tudo que exige login.
 *
 * Fica num grupo de rotas `(sistema)` e não num caminho: o `/quadros` continua sendo
 * `/quadros` na URL, e as telas públicas (o link que o cliente abre sem conta) ficam fora
 * desta moldura sem precisar de exceção nenhuma.
 */
export default function LayoutDoSistema({ children }) {
  return (
    <div className="abacato-quadro-geral">
      <BarraLateral />
      <main className="abacato-conteudo">{children}</main>
    </div>
  );
}
