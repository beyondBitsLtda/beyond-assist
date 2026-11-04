/**
 * A tela de abertura: o mascote do Abacato sobre fundo escuro, enquanto o sistema carrega.
 *
 * NÃO é componente de cliente, de propósito. Ela precisa estar na PRIMEIRA pintura — é o que
 * cobre a página montando por baixo —, e um componente de cliente só apareceria depois de o
 * JavaScript chegar, justamente quando ela já deveria estar saindo.
 *
 * Quem liga e desliga é o SCRIPT_DA_ABERTURA, no `<head>`, mexendo só no atributo
 * `data-abertura` do `<html>`. O elemento nunca sai do DOM: removê-lo por fora faria o React
 * encontrar na hidratação uma árvore diferente da que o servidor mandou. O `<html>` já tem
 * `suppressHydrationWarning` por causa do tema, então mexer no atributo dele é seguro.
 *
 * O atributo é VIGIADO, e não só posto uma vez. Um descompasso de hidratação em qualquer tela
 * faz o React refazer a raiz, e ao refazer ele limpa todos os atributos do `<html>`. Na Lisa isso
 * foi medido — a abertura entrava aos 0,5 s e sumia aos 0,6 s por causa de um relógio —, e aqui
 * o mecanismo é o mesmo.
 *
 * A marca é o `public/marca/abacato.png` usado como MÁSCARA, não como imagem: o desenho original
 * é preto sobre branco, e pintar pela máscara é o que deixa o traço claro no fundo escuro com o
 * verde do sistema passando por ele.
 */
export default function Abertura() {
  return (
    <div className="abacato-abertura" role="status" aria-label="Carregando o Abacato System">
      <div className="abacato-abertura__centro">
        <div className="abacato-abertura__marca" aria-hidden="true" />
        <div className="abacato-abertura__sistema">System</div>
        <div className="abacato-abertura__trilho" aria-hidden="true">
          <div className="abacato-abertura__carga" />
        </div>
        <div className="abacato-abertura__texto">Preparando seus quadros</div>
      </div>
    </div>
  );
}

/**
 * Roda de forma síncrona no `<head>`, antes da primeira pintura. Sem JavaScript a abertura
 * simplesmente não aparece, em vez de ficar presa na tela para sempre.
 *
 * Aparece em TODO carregamento de página, inclusive no F5 — decisão do dono do produto: a marca
 * entra em cena sempre. Navegar entre telas não recarrega a página, então não passa por aqui.
 *
 * O tempo mínimo existe porque, com cache quente, o `load` chega em menos de 200 ms e a
 * abertura piscaria — o que parece defeito, não acabamento. São 3,5 s: a entrada do mascote leva
 * 1 s, e com 2 s ele mal terminava de aparecer e já saía. O teto de 8 s é o contrário: um
 * recurso pendurado na rede não pode segurar ninguém fora do sistema.
 */
export const SCRIPT_DA_ABERTURA = `
(function () {
  var html = document.documentElement;
  var fase = "ativa";
  function aplicar() {
    if (html.getAttribute("data-abertura") !== fase) html.setAttribute("data-abertura", fase);
  }
  var vigia = window.MutationObserver ? new MutationObserver(aplicar) : null;
  if (vigia) vigia.observe(html, { attributes: true, attributeFilter: ["data-abertura"] });
  aplicar();

  var inicio = Date.now();
  var encerrada = false;

  function encerrar() {
    if (encerrada) return;
    encerrada = true;
    setTimeout(function () {
      fase = "saindo"; aplicar();
      setTimeout(function () {
        fase = "fim"; aplicar();
        if (vigia) vigia.disconnect();
      }, 700);
    }, Math.max(0, 3500 - (Date.now() - inicio)));
  }

  if (document.readyState === "complete") encerrar();
  else window.addEventListener("load", encerrar, { once: true });
  setTimeout(encerrar, 8000);
})();
`;
