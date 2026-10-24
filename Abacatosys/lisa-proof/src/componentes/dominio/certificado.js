// O certificado do Modo Domínio (24/10/2026): "no fim de cada torre, ao cumprir o desafio, o
// sistema entrega um certificado personalizado e estilizado para baixar em PDF, comprovando as
// habilidades e os domínios nos assuntos que compunham o repositório".
//
// Desenhado num canvas (A4 deitado) e embrulhado num PDF de uma página por src/dominio/pdf.js —
// nada de biblioteca de PDF no navegador. Só navegador.

import { pdfDeJpeg } from "@/dominio/pdf.js";
import { urlDoMonstro } from "@/componentes/reino/monstrosDePapel.js";
import { chefaoPorId } from "@/dominio/modoDominio.js";
import { retanguloRedondo } from "./canvas.js";

const L = 2000, A = 1414; // proporção do A4
const TINTA = "#111814", VERDE = "#16A34A", OURO = "#C9A227", CINZA = "#4B5563", FUNDO = "#FBF7EE";

function carregar(src) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

/** O maior tamanho de fonte (até `maximo`) em que o texto cabe na largura. */
function caber(x, texto, peso, maximo, largura) {
  let t = maximo;
  for (; t > 24; t -= 2) {
    x.font = `${peso} ${t}px Inter, system-ui, sans-serif`;
    if (x.measureText(texto).width <= largura) break;
  }
  return t;
}

function linhas(x, texto, largura) {
  const saida = [];
  let atual = "";
  for (const palavra of String(texto).split(/\s+/)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (x.measureText(tentativa).width > largura && atual) { saida.push(atual); atual = palavra; } else atual = tentativa;
  }
  if (atual) saida.push(atual);
  return saida;
}

function centro(x, texto, y, fonte, cor) {
  x.font = fonte;
  x.fillStyle = cor;
  x.textAlign = "center";
  x.fillText(texto, L / 2, y);
}

/** A data em português (24 de outubro de 2026). */
const dataPorExtenso = (iso) => new Date(iso || Date.now()).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

/**
 * Desenha o certificado. `d`: { nome, repo, provedor, nivel, nomeDoNivel, andares, media,
 * tecnologias, assuntos, concluidoEm, codigo, link, chefaoFinal }.
 */
export async function desenharCertificado(canvas, d) {
  try {
    await Promise.all(["700 80px Inter", "600 32px Inter", "400 32px Inter"].map((f) => document.fonts.load(f)));
  } catch { /* sem a fonte, vale a do sistema */ }
  const chefao = d.chefaoFinal ? await carregar(urlDoMonstro(d.chefaoFinal)) : null;
  canvas.width = L;
  canvas.height = A;
  const x = canvas.getContext("2d");

  // fundo, molduras e cantos
  x.fillStyle = FUNDO;
  x.fillRect(0, 0, L, A);
  const brilho = x.createRadialGradient(L / 2, A * 0.42, 100, L / 2, A * 0.42, L * 0.62);
  brilho.addColorStop(0, "rgba(201,162,39,0.10)");
  brilho.addColorStop(1, "rgba(201,162,39,0)");
  x.fillStyle = brilho;
  x.fillRect(0, 0, L, A);
  x.strokeStyle = TINTA; x.lineWidth = 16; x.strokeRect(42, 42, L - 84, A - 84);
  x.strokeStyle = OURO; x.lineWidth = 5; x.strokeRect(76, 76, L - 152, A - 152);
  x.strokeStyle = OURO; x.lineWidth = 2; x.strokeRect(92, 92, L - 184, A - 184);
  for (const [cx, cy] of [[76, 76], [L - 76, 76], [76, A - 76], [L - 76, A - 76]]) {
    x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4);
    x.fillStyle = OURO; x.fillRect(-18, -18, 36, 36);
    x.fillStyle = TINTA; x.fillRect(-8, -8, 16, 16);
    x.restore();
  }

  // cabeçalho
  x.letterSpacing = "10px";
  centro(x, "LISA_PROOF · MODO DOMÍNIO", 168, "600 30px Inter, system-ui, sans-serif", VERDE);
  x.letterSpacing = "0px";
  centro(x, "Certificado de Domínio", 268, "700 96px Inter, system-ui, sans-serif", TINTA);
  centro(x, "Certificamos que", 345, "400 36px Inter, system-ui, sans-serif", CINZA);

  // o nome
  const nome = String(d.nome || "Estudante").trim();
  const tNome = caber(x, nome, 700, 92, L - 520);
  centro(x, nome, 440, `700 ${tNome}px Inter, system-ui, sans-serif`, TINTA);
  x.strokeStyle = OURO; x.lineWidth = 4;
  x.beginPath(); x.moveTo(L / 2 - 520, 474); x.lineTo(L / 2 + 520, 474); x.stroke();

  centro(x, `conquistou os ${d.andares} andares da torre do repositório`, 535, "400 36px Inter, system-ui, sans-serif", CINZA);
  const repo = `${d.repo}${d.provedor ? `  (${d.provedor === "gitlab" ? "GitLab" : "GitHub"})` : ""}`;
  const tRepo = caber(x, repo, 700, 52, L - 400);
  centro(x, repo, 600, `700 ${tRepo}px Inter, system-ui, sans-serif`, VERDE);
  centro(x, `Nível ${d.nivel} — ${d.nomeDoNivel}  ·  média final ${d.media}/100`, 660, "600 34px Inter, system-ui, sans-serif", TINTA);

  // tecnologias (selos) e assuntos dominados — tudo acima do selo, que começa em A - 360
  centro(x, "e demonstrou domínio em", 728, "600 28px Inter, system-ui, sans-serif", CINZA);
  const selos = (d.tecnologias || []).slice(0, 10);
  x.font = "600 28px Inter, system-ui, sans-serif";
  const larguras = selos.map((t) => x.measureText(t).width + 48);
  const linhasDeSelos = [[]];
  let soma = 0;
  larguras.forEach((w, i) => {
    if (soma + w > L - 500 && linhasDeSelos.at(-1).length) { linhasDeSelos.push([]); soma = 0; }
    linhasDeSelos.at(-1).push(i);
    soma += w + 16;
  });
  let y = 752;
  for (const linha of linhasDeSelos.slice(0, 2)) {
    const total = linha.reduce((s, i) => s + larguras[i] + 16, -16);
    let cx = L / 2 - total / 2;
    for (const i of linha) {
      x.fillStyle = TINTA;
      retanguloRedondo(x, cx, y, larguras[i], 52, 26); x.fill();
      x.fillStyle = "#FFFFFF"; x.textAlign = "center";
      x.fillText(selos[i], cx + larguras[i] / 2, y + 36);
      cx += larguras[i] + 16;
    }
    y += 66;
  }
  x.font = "400 26px Inter, system-ui, sans-serif";
  const todas = linhas(x, (d.assuntos || []).slice(0, 16).join("  ·  "), L - 520);
  const assuntos = todas.slice(0, 2);
  if (todas.length > 2) assuntos[1] = `${assuntos[1].replace(/\s*·?\s*$/, "")} …`;
  assuntos.forEach((l, i) => centro(x, l, y + 32 + i * 38, "400 26px Inter, system-ui, sans-serif", "#374151"));

  // o selo, com o guardião do topo
  const sx = L / 2, sy = A - 232;
  x.fillStyle = OURO;
  x.beginPath();
  for (let k = 0; k < 48; k++) {
    const r = k % 2 ? 112 : 128;
    const a = (k / 48) * Math.PI * 2;
    x.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
  }
  x.closePath(); x.fill();
  x.fillStyle = TINTA;
  x.beginPath(); x.arc(sx, sy, 98, 0, Math.PI * 2); x.fill();
  x.strokeStyle = OURO; x.lineWidth = 3;
  x.beginPath(); x.arc(sx, sy, 88, 0, Math.PI * 2); x.stroke();
  if (chefao) x.drawImage(chefao, sx - 70, sy - 82, 140, 140);
  centro(x, "TOPO", sy + 78, "700 20px Inter, system-ui, sans-serif", OURO);

  // a data e a assinatura (à esquerda); o código de conferência (à direita) — dentro da moldura
  x.textAlign = "left";
  x.fillStyle = CINZA; x.font = "400 26px Inter, system-ui, sans-serif";
  x.fillText("Concluído em", 220, A - 318);
  x.fillStyle = TINTA; x.font = "600 32px Inter, system-ui, sans-serif";
  x.fillText(dataPorExtenso(d.concluidoEm), 220, A - 276);
  x.fillStyle = TINTA; x.font = "italic 600 54px Inter, system-ui, sans-serif";
  x.fillText("Lisa", 220, A - 200);
  x.strokeStyle = TINTA; x.lineWidth = 2;
  x.beginPath(); x.moveTo(220, A - 186); x.lineTo(640, A - 186); x.stroke();
  x.fillStyle = CINZA; x.font = "400 24px Inter, system-ui, sans-serif";
  x.fillText("Lisa, tutora da Lisa_Proof", 220, A - 154);
  const guardiao = chefaoPorId(d.chefaoFinal)?.nome;
  if (guardiao) x.fillText(`Guardião vencido: ${guardiao}`, 220, A - 124);

  x.textAlign = "right";
  x.fillStyle = CINZA; x.font = "400 26px Inter, system-ui, sans-serif";
  x.fillText("Código de conferência", L - 220, A - 318);
  x.fillStyle = TINTA; x.font = "700 40px Inter, system-ui, sans-serif";
  x.fillText(d.codigo || "", L - 220, A - 272);
  const link = String(d.link || "").replace(/^https?:\/\//, "");
  const tLink = caber(x, link, 600, 24, 560);
  x.fillStyle = VERDE; x.font = `600 ${tLink}px Inter, system-ui, sans-serif`;
  x.fillText(link, L - 220, A - 232);
  x.fillStyle = CINZA; x.font = "400 22px Inter, system-ui, sans-serif";
  x.fillText("confira a autenticidade neste endereço", L - 220, A - 200);
  return canvas;
}

/** Desenha e baixa o certificado em PDF. */
export async function baixarCertificado(d) {
  const canvas = await desenharCertificado(document.createElement("canvas"), d);
  const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.92));
  if (!blob) throw new Error("não consegui desenhar o certificado");
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  const pdf = pdfDeJpeg(jpeg, canvas.width, canvas.height, { titulo: `Certificado de Dominio - ${d.repo}` });
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `certificado-dominio-${String(d.repo || "torre").split("/").pop().toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
