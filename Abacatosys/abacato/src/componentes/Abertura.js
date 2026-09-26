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
 * Aparece UMA vez por sessão do navegador: abrir o sistema merece a cerimônia, um F5 no meio do
 * trabalho não.
 *
 * O tempo mínimo existe porque, com cache quente, o `load` chega em menos de 200 ms e a
 * abertura piscaria — o que parece defeito, não acabamento. O teto de 8 s é o contrário: um
 * recurso pendurado na rede não pode segurar ninguém fora do sistema.
 */
export const SCRIPT_DA_ABERTURA = `
(function () {
  try {
    if (sessionStorage.getItem("abacato-abertura")) return;
    sessionStorage.setItem("abacato-abertura", "1");
  } catch (e) {
    /* armazenamento bloqueado: mostra, que é o comportamento de primeira visita */
  }
  var html = document.documentElement;
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
