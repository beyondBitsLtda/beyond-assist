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
 * Aparece UMA vez por sessão do navegador: abrir a Lisa merece a cerimônia, um F5 no meio do
 * trabalho não.
 *
 * Também aplica a cor de destaque salva, antes da pintura: sem isso a abertura sairia sempre em
 * ciano e trocaria de cor na cara da pessoa quando o Shell montasse.
 *
 * O tempo mínimo existe porque, com cache quente, o `load` chega em menos de 200 ms e a
 * abertura piscaria — o que parece defeito, não acabamento. O teto de 8 s é o contrário: um
 * recurso pendurado na rede não pode segurar ninguém fora do sistema.
 */
export const SCRIPT_DA_ABERTURA = `
(function () {
  var html = document.documentElement;
  try {
    var tema = JSON.parse(localStorage.getItem("accentTheme") || "null");
    if (tema && tema.hex && tema.rgb) {
      html.style.setProperty("--accent-hex", tema.hex);
      html.style.setProperty("--accent-rgb", tema.rgb);
    }
  } catch (e) { /* sem armazenamento: fica o ciano padrão */ }

  try {
    if (sessionStorage.getItem("lisa-abertura")) return;
    sessionStorage.setItem("lisa-abertura", "1");
  } catch (e) { /* armazenamento bloqueado: mostra, que é o comportamento de primeira visita */ }

  var inicio = Date.now();
  var encerrada = false;
  html.setAttribute("data-abertura", "ativa");

  function encerrar() {
    if (encerrada) return;
    encerrada = true;
    setTimeout(function () {
      html.setAttribute("data-abertura", "saindo");
      setTimeout(function () { html.setAttribute("data-abertura", "fim"); }, 700);
    }, Math.max(0, 2000 - (Date.now() - inicio)));
  }

  if (document.readyState === "complete") encerrar();
  else window.addEventListener("load", encerrar, { once: true });
  setTimeout(encerrar, 8000);
})();
`;
