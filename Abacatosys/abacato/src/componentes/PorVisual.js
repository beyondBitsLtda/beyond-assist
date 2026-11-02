/**
 * Um texto que muda com o visual: o do Abacato ou o da Lisa Task (src/app/visual-lisa.css).
 *
 * As duas versões vão no HTML e o CSS mostra uma. O visual é decidido no <head>, antes de a
 * página pintar; trocar o texto num efeito do React faria a palavra errada aparecer por um
 * instante a cada carga — e, no servidor, ninguém sabe ainda qual é o visual.
 */
export default function PorVisual({ abacato, lisa }) {
  return (
    <>
      <span className="abacato-so-abacato">{abacato}</span>
      <span className="abacato-so-lisa">{lisa}</span>
    </>
  );
}
