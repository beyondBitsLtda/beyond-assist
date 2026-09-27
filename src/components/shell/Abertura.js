/**
 * A tela de abertura da Lisa: a marca dela sobre o preto do HUD, enquanto o sistema carrega.
 *
 * NÃO é componente de cliente, de propósito. Ela precisa estar na PRIMEIRA pintura — é o que
 * cobre a página montando por baixo —, e um componente de cliente só apareceria depois de o
 * JavaScript chegar, justamente quando ela já deveria estar saindo.
 *
 * Quem liga e desliga é o SCRIPT_DA_ABERTURA, no `<head>`, mexendo só no atributo
 * `data-abertura` do `<html>`. O elemento nunca sai do DOM: removê-lo por fora faria o React
 * encontrar na hidratação uma árvore diferente da que o servidor mandou.
 *
 * O atributo é VIGIADO, e não só posto uma vez. Qualquer descompasso de hidratação em qualquer
 * painel faz o React refazer a raiz, e ao refazer ele limpa todos os atributos do `<html>` —
 * foi medido: a abertura entrava aos 0,5 s e sumia aos 0,6 s. Sem a vigia, a abertura dependeria
 * de nenhum painel, nunca, ter um descompasso.
 *
 * A marca é o `public/marca/lisa.png` usado como MÁSCARA, não como imagem: o arquivo original é
 * preto sobre branco, e pintar pela máscara é o que deixa o traço claro no fundo escuro e com a
 * cor de destaque que a pessoa escolheu passando por ele.
 */
export default function Abertura() {
  return (
    <div className="bb-abertura" role="status" aria-label="Carregando a Lisa">
      <div className="bb-abertura__centro">
        <div className="bb-abertura__marca" aria-hidden="true" />
        <div className="bb-abertura__trilho" aria-hidden="true">
          <div className="bb-abertura__carga" />
        </div>
        <div className="bb-abertura__texto">
          inicializando<span className="bb-abertura__cursor">_</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Roda de forma síncrona no `<head>`, antes da primeira pintura. Sem JavaScript a abertura
 * simplesmente não aparece, em vez de ficar presa na tela para sempre.
 *
 * Aparece em TODO carregamento de página, inclusive no F5 — decisão do dono do produto: a marca
 * é a assinatura da Lisa, e ela entra em cena sempre. Navegar entre painéis não recarrega a
 * página, então não passa por aqui.
 *
 * Também aplica a cor de destaque salva, antes da pintura: sem isso a abertura sairia sempre em
 * ciano e trocaria de cor na cara da pessoa quando o Shell montasse.
 *
 * O tempo mínimo existe porque, com cache quente, o `load` chega em menos de 200 ms e a
 * abertura piscaria — o que parece defeito, não acabamento. São 3,5 s: a entrada da marca leva
 * 1 s, e com 2 s ela mal terminava de aparecer e já saía. O teto de 8 s é o contrário: um
 * recurso pendurado na rede não pode segurar ninguém fora do sistema.
 */
export const SCRIPT_DA_ABERTURA = `
(function () {
  var html = document.documentElement;
  var tema = null;
  try {
    tema = JSON.parse(localStorage.getItem("accentTheme") || "null");
    if (!tema || !tema.hex || !tema.rgb) tema = null;
  } catch (e) { /* sem armazenamento: fica o ciano padrão */ }

  var fase = "ativa";
  function aplicar() {
    if (html.getAttribute("data-abertura") !== fase) html.setAttribute("data-abertura", fase);
    if (tema && html.style.getPropertyValue("--accent-hex") !== tema.hex) {
      html.style.setProperty("--accent-hex", tema.hex);
      html.style.setProperty("--accent-rgb", tema.rgb);
    }
  }
  var vigia = window.MutationObserver ? new MutationObserver(aplicar) : null;
  if (vigia) vigia.observe(html, { attributes: true, attributeFilter: ["data-abertura", "style"] });
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
