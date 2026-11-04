// O MUNDO CURVO (23/10/2026). Pedido: "no modo de exploração fora do espaço, o reino tem que ser um
// planetoide, uma esfera mesmo, e aí os inimigos e as construções tipo Mario Galaxy — como eles se
// locomovem pelo planetoide".
//
// A batalha continua PLANA — o mesmo motor do servidor (src/dominio/combate.js), as mesmas posições.
// Quem curva é o desenho: cada ponto (x, y, z) do mundo plano vira o ponto da esfera à distância
// d = √(x² + z²) do polo (o arco), na direção dele, com a altura y para fora. O chão dobra sobre o
// planeta, e tropas, monstros, tiros e construções andam em volta dele sem o motor saber de nada.
//
// A conta mora no vertex shader de cada material (onBeforeCompile), com um uniforme só para o mundo
// inteiro: 0 = plano (o reino de sempre — a conta vira identidade), 1/R = planeta de raio R. A mesma
// conta existe em JS (curvarPonto) para o que não passa pelo shader: as barras de vida (sprites).
// A sombra do sol não curva (o passe de profundidade é outro material): no planeta, ela desliga.

import * as THREE from "three";

/** 1 / raio do planeta (0 = mundo plano). Compartilhado por todos os materiais curvados. */
export const uniformeDaCurva = { value: 0 };

// o ângulo máximo do polo: perto de π o ponto chega ao polo de baixo (não dá a volta de novo)
const TETO = 3.1;

const FUNCOES = /* glsl */ `
uniform float uCurva;
vec3 curvaPonto(vec3 p) {
  if (uCurva <= 0.0) return p;
  float d = length(p.xz);
  if (d < 1e-4) return p;
  float th = min(d * uCurva, ${TETO.toFixed(2)});
  vec2 dir = p.xz / d;
  float r = 1.0 / uCurva + p.y;
  return vec3(dir.x * r * sin(th), r * cos(th) - 1.0 / uCurva, dir.y * r * sin(th));
}
vec3 curvaNormal(vec3 p, vec3 n) {
  if (uCurva <= 0.0) return n;
  float d = length(p.xz);
  if (d < 1e-4) return n;
  float th = min(d * uCurva, ${TETO.toFixed(2)});
  vec2 dir = p.xz / d;
  vec3 k = vec3(dir.y, 0.0, -dir.x);
  float c = cos(th), s = sin(th);
  return n * c + cross(k, n) * s + k * dot(k, n) * (1.0 - c);
}
`;

const PROJETAR = /* glsl */ `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
vec4 pontoCurvo = modelMatrix * mvPosition;
pontoCurvo.xyz = curvaPonto( pontoCurvo.xyz );
mvPosition = viewMatrix * pontoCurvo;
gl_Position = projectionMatrix * mvPosition;
`;

const POSICAO_NO_MUNDO = /* glsl */ `
#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
  vec4 worldPosition = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    worldPosition = instanceMatrix * worldPosition;
  #endif
  worldPosition = modelMatrix * worldPosition;
  worldPosition.xyz = curvaPonto( worldPosition.xyz );
#endif
`;

const NORMAL = /* glsl */ `
#include <defaultnormal_vertex>
transformedNormal = normalize( mat3( viewMatrix ) * curvaNormal( ( modelMatrix * vec4( position, 1.0 ) ).xyz, inverseTransformDirection( transformedNormal, viewMatrix ) ) );
`;

const curvados = new WeakSet();

/** Ensina um material a curvar (uma vez só; com a curva em 0, nada muda no desenho). */
export function curvarMaterial(material) {
  if (!material || curvados.has(material) || material.isSpriteMaterial || material.isShaderMaterial || material.isLineBasicMaterial) return;
  curvados.add(material);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCurva = uniformeDaCurva;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${FUNCOES}`)
      .replace("#include <defaultnormal_vertex>", NORMAL)
      .replace("#include <project_vertex>", PROJETAR)
      .replace("#include <worldpos_vertex>", POSICAO_NO_MUNDO);
  };
  material.customProgramCacheKey = () => "mundo-curvo-1";
  material.needsUpdate = true;
}

/** Curva tudo o que está debaixo de `raiz` (menos o que pede `userData.semCurva`: as luas, que já são esferas). */
export function curvarTudo(raiz) {
  raiz.traverse((o) => {
    if (!o.isMesh || o.userData.semCurva) return;
    if (Array.isArray(o.material)) o.material.forEach(curvarMaterial);
    else curvarMaterial(o.material);
  });
}

/** A mesma conta do shader, em JS: o ponto plano `v` no planeta (para as barras de vida e o que mais precisar). */
export function curvarPonto(v, alvo = new THREE.Vector3()) {
  const k = uniformeDaCurva.value;
  if (!(k > 0)) return alvo.copy(v);
  const d = Math.hypot(v.x, v.z);
  if (d < 1e-4) return alvo.copy(v);
  const th = Math.min(d * k, TETO);
  const r = 1 / k + v.y;
  return alvo.set((v.x / d) * r * Math.sin(th), r * Math.cos(th) - 1 / k, (v.z / d) * r * Math.sin(th));
}
