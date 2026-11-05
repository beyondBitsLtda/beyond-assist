// Conferência do painel "Uso dos usuários" (src/lib/usoDosUsuarios.js): a batida, as telas, o resumo e as travas.
// Uso: npm run uso-check
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PRESENCA, somarBatida, telaDoCaminho, aparelhoDe, contagemDaAcao, resumoDoUso, duracaoLegivel,
} from "../src/lib/usoDosUsuarios.js";
import { podeAcessar } from "../src/lib/authSession.js";

let passou = 0;
const caso = (nome, fn) => {
  try { fn(); passou++; console.log(`  ok    ${nome}`); } catch (e) { console.error(`  FALHOU ${nome}\n        ${e.message}`); process.exitCode = 1; }
};
const ler = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");

caso("a batida soma o minuto e a tela; mais de 5 min parada abre outro acesso", () => {
  const aberto = { ultimo: "2026-11-04T10:00:00Z", segundos: 120, paginas: { assistant: 2 } };
  assert.deepEqual(somarBatida(aberto, "2026-11-04T10:01:00Z", "assistant"), { segundos: 180, paginas: { assistant: 3 }, ultimo: "2026-11-04T10:01:00.000Z" });
  assert.equal(somarBatida(aberto, "2026-11-04T10:04:00Z", "fluxogramas").segundos, 120 + PRESENCA.tetoPorBatida, "a aba que dormiu não conta o sono");
  assert.equal(somarBatida(aberto, "2026-11-04T10:06:00Z", "assistant"), null);
  assert.equal(somarBatida(aberto, "2026-11-04T10:03:00Z", "assistant", { semTempo: true }).segundos, 120, "a aba que voltou não soma o tempo escondida");
  assert.equal(somarBatida(null, "2026-11-04T10:00:00Z", "assistant"), null);
});

caso("as telas, o aparelho, a contagem e a duração", () => {
  assert.deepEqual(["/assistant", "/fluxogramas/abc", "/", "/sentinel"].map(telaDoCaminho), ["assistant", "fluxogramas", "paineis", "paineis"]);
  assert.deepEqual(["Mozilla/5.0 (iPhone) Mobile", "Mozilla/5.0 (Windows NT 10.0)"].map(aparelhoDe), ["celular", "computador"]);
  assert.deepEqual([contagemDaAcao("pergunta", 1), contagemDaAcao("pergunta", 12), contagemDaAcao("tela", 2)], ["1 pergunta", "12 perguntas", "2 comentários de tela"]);
  assert.deepEqual([duracaoLegivel(40), duracaoLegivel(720), duracaoLegivel(3900)], ["40 s", "12 min", "1 h 05 min"]);
});

caso("o resumo: uma linha por pessoa, o admin no fim e fora dos totais", () => {
  const r = resumoDoUso({
    pessoas: [{ id: "a", email: "ana@x", nome: "Ana" }, { id: "b", email: "bia@x", ultimoLogin: "2026-11-04T09:00:00Z" }, { id: "z", email: "eu@x", admin: true }],
    acessos: [
      { dono_id: "a", inicio: "2026-11-04T10:00:00Z", ultimo: "2026-11-04T10:30:00Z", segundos: 1800, paginas: { assistant: 25, fluxogramas: 5 }, aparelho: "celular", entrou: true },
      { dono_id: "z", inicio: "2026-11-04T11:00:00Z", ultimo: "2026-11-04T11:20:00Z", segundos: 1200, paginas: { paineis: 20 } },
    ],
    usos: [{ dono_id: "a", dia: "2026-11-04", tipo: "pergunta", quantos: 14 }, { dono_id: "a", dia: "2026-11-04", tipo: "voz", quantos: 3 }, { dono_id: "a", dia: "2026-11-04", tipo: "outro", quantos: 9 }],
    desenhos: [{ dono_id: "a", criado_em: "2026-11-04T10:10:00Z" }],
  });
  assert.deepEqual(r.totais, { pessoas: 2, ativas: 1, acessos: 1, segundos: 1800, acoes: 18 });
  assert.deepEqual(r.pessoas.map((p) => p.email), ["ana@x", "bia@x", "eu@x"], "quem usou primeiro, o admin no fim");
  const ana = r.pessoas[0];
  assert.deepEqual(ana.acoes.map((a) => a.texto), ["14 perguntas", "3 falas", "1 fluxograma criado"]);
  assert.deepEqual(ana.telas.map((t) => t.rotulo), ["Assistente", "ProcessMap"]);
  assert.equal(r.pessoas[1].ultimoAcesso, "2026-11-04T09:00:00Z", "sem batida, o último login do autenticador vale como último acesso");
});

caso("as travas: só o admin abre o painel; o usuário manda a batida; o login abre um acesso; o aviso na entrada", () => {
  assert.equal(podeAcessar("usuario", "/uso"), false, "o usuário não abre o painel");
  assert.equal(podeAcessar("usuario", "/api/uso-dos-usuarios"), false, "nem a rota");
  assert.equal(podeAcessar("usuario", "/api/presenca"), true, "mas manda a batida");
  assert.match(ler("../src/app/api/uso-dos-usuarios/route.js"), /if \(sessaoDe\(req\)\.papel !== "admin"\) return Response\.json\(\{ ok: false, error: "só o admin vê o uso" \}, \{ status: 403 \}\)/);
  assert.match(ler("../src/app/api/presenca/route.js"), /registrarPresenca\(dono, \{[\s\S]*?\}\)\.catch\(/, "a batida que falha não vira erro");
  assert.match(ler("../src/app/api/auth/login/route.js"), /registrarPresenca\(lerPayload\(dados\.access_token\)\?\.sub, \{ entrou: true[^}]*\}\)\s*\.catch\(/, "o login abre um acesso, sem derrubar o login");
  assert.match(ler("../src/app/login/page.js"), /A Lisa registra os seus acessos, o tempo de uso/, "quem entra sabe que o uso é registrado");
  assert.match(ler("../src/app/layout.js"), /<Presenca \/>/, "a batida em todas as telas");
  assert.doesNotMatch(ler("../src/app/(panels)/uso/page.js"), /from "@\/lib\/usoDosUsuarios\.js"/, "a tela não puxa o módulo do banco para o navegador");
  assert.match(ler("../db/uso_dos_usuarios.sql"), /create table if not exists public\.lisa_presenca/);
});

console.log(`\n${passou} caso(s) do uso passaram${process.exitCode ? ", com falhas acima" : ""}.`);
