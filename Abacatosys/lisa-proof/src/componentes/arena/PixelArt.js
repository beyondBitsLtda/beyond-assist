// Os desenhos de pixel da Arena Lúdica (03/11/2026, BEYOND-0023): cada sprite é uma grade 8×8 de letras e cada
// letra é uma cor da paleta (o ponto é transparente). Sai em SVG com bordas retas, nítido em qualquer tamanho.

const PALETA = {
  k: "#1f2937", w: "#f8fafc", s: "#f2d3b1", b: "#2563eb", B: "#1e3a8a", r: "#dc2626", R: "#7f1d1d", y: "#fde047",
  g: "#16a34a", G: "#86efac", m: "#8a5a2b", M: "#5d3a1a", o: "#f97316", c: "#94a3b8", C: "#475569", p: "#a855f7",
};

const SPRITES = {
  heroi: ["...kk...", "..kssk..", "..kssk..", ".kbbbbk.", "kbbybbbk", ".kbbbbk.", "..kBBk..", ".kk..kk."],
  porta: [".kkkkkk.", "kmmmmmmk", "kmMmmMmk", "kmmmmmmk", "kmmmmymk", "kmMmmMmk", "kmmmmmmk", "kkkkkkkk"],
  armadilha: ["........", ".k...k..", ".ck..ck.", "kcck.cck", "kccckccc", "kkkkkkkk", "rRrRrRrR", "RrRrRrRr"],
  inimigo: ["k.k..k.k", ".kggggk.", "kgGggGgk", "kggggggk", "kgkggkgk", ".kggggk.", "k.k..k.k", "........"],
  escada: ["......kk", "......cc", "....kkcc", "....cccc", "..kkcccc", "..cccccc", "kkcccccc", "CCCCCCCC"],
  mascote: ["..yyyy..", ".yyyyyy.", "yyyykyyo", "yyyyyyoo", "yyyyyyy.", ".yyyyyy.", "..o..o..", "........"],
  comida: ["...mg...", "...m....", ".rrrrrr.", "rrwrrrrr", "rrrrrrrr", "rrrrrrrr", ".rrrrrr.", "..rrrr.."],
  brilho: ["...y....", "...y....", "y.yyy.y.", ".yywyy..", "y.yyy.y.", "...y....", "...y....", "........"],
};

/** Um sprite em pixel art. `girar`: graus (o mascote olha para onde anda). */
export default function Sprite({ nome, tamanho = 32, girar = 0, titulo }) {
  const grade = SPRITES[nome];
  if (!grade) return null;
  const pixels = [];
  grade.forEach((linha, y) => [...linha].forEach((letra, x) => {
    const cor = PALETA[letra];
    if (cor) pixels.push(<rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={cor} />);
  }));
  return (
    <svg className="ar-sprite" viewBox="0 0 8 8" width={tamanho} height={tamanho} shapeRendering="crispEdges"
      style={girar ? { transform: `rotate(${girar}deg)` } : undefined} role={titulo ? "img" : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}>
      {pixels}
    </svg>
  );
}

