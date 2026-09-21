import BarraLateral from "@/componentes/BarraLateral.js";
import BarraDoTopo from "@/componentes/BarraDoTopo.js";
import Lisa from "@/componentes/Lisa.js";

/**
 * A moldura de tudo que exige login.
 *
 * Fica num grupo de rotas `(sistema)` e não num caminho: o `/quadros` continua sendo
 * `/quadros` na URL, e as telas públicas (o link que o cliente abre sem conta) ficam fora
 * desta moldura sem precisar de exceção nenhuma.
 *
 * A coluna da direita é uma pilha: faixa do topo com altura fixa, conteúdo ocupando o resto.
 * Quem rola é o conteúdo, nunca a página — assim a barra lateral e a faixa do topo ficam
 * paradas, inclusive no meio de um arrasto de card.
 */
export default function LayoutDoSistema({ children }) {
  return (
    <div className="abacato-quadro-geral">
      <BarraLateral />
      <div className="abacato-principal">
        <BarraDoTopo />
        <main className="abacato-conteudo">{children}</main>
      </div>
      {/* Fora da coluna que rola, e por isso flutua por cima de qualquer tela do sistema.
          Fica só aqui dentro: as telas públicas não têm sessão, e uma assistente sem sessão
          não teria o que ler nem em nome de quem agir. */}
      <Lisa />
    </div>
  );
}
