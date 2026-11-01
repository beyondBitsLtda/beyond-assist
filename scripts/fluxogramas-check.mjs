// Guarda o ProcessMap na Lisa (01/11/2026): projetos e fluxogramas salvos (src/lib/fluxogramas.js),
// o salvamento automático do navegador (src/lib/fluxogramasNoNavegador.js) e as peças que ligam o
// painel /fluxogramas e o "salvar" do quadro da Lisa. O banco em si não entra aqui: as funções puras
// e o salvador são conferidos com relógio e servidor falsos.

import fs from "node:fs";
import {
  LIMITES, idValido, nomeLimpo, donoDe, documentoParaGuardar, resumoDoFluxo, arvoreDeProjetos,
} from "../src/lib/fluxogramas.js";
import { apiDosFluxos, assinaturaDoDesenho, criarSalvador, enderecoDoFluxo } from "../src/lib/fluxogramasNoNavegador.js";
import { GRUPOS_DE_PAINEIS } from "../src/lib/navegacao.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));
const ler = (caminho) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");
const microtarefas = () => new Promise((r) => setImmediate(r));

const UUID = "3f2a9c1e-7b4d-4e8a-9c1f-2d3e4f5a6b7c";
const doc = (formas = 2, extra = {}) => ({
  format: "processmap", version: 4, name: "Compras", exportedAt: "2026-11-01T10:00:00Z", viewport: { x: 0, y: 0, scale: 1 },
  mode: "diagram", activePage: "p1",
  pages: [{ id: "p1", name: "Página 1", viewport: { x: 1 }, shapes: Array.from({ length: formas }, (_, i) => ({ id: `s${i}`, type: "process", x: i * 10, y: 0, text: `etapa ${i}` })), connections: [] }],
  ...extra,
});

console.log("o que se guarda");
{
  conferir("id de linha: só uuid", idValido(UUID) && !idValido("1; drop table") && !idValido("") && !idValido(null));
  conferir("nome numa linha, sem sobra, no limite", nomeLimpo("  Fluxo \n de   compras  ", 80) === "Fluxo de compras" && nomeLimpo("x".repeat(200), 80).length === 80 && nomeLimpo("   ", 80) === "");
  const g = documentoParaGuardar(doc(3));
  conferir("documento do ProcessMap: guarda como veio e conta as formas", g && g.documento.name === "Compras" && g.formas === 3 && g.modo === "diagram");
  conferir("conta as formas de todas as abas", documentoParaGuardar(doc(1, { pages: [doc(2).pages[0], { id: "p2", shapes: [{ id: "a" }], connections: [] }] })).formas === 3);
  conferir("mapa mental é mapa mental", documentoParaGuardar(doc(1, { mode: "mindmap" })).modo === "mindmap");
  conferir("o formato antigo (sem abas) também entra", documentoParaGuardar({ shapes: [{ id: "a" }], connections: [] })?.formas === 1);
  conferir("outro formato não entra", documentoParaGuardar(doc(1, { format: "drawio" })) === null);
  conferir("sem formas não entra", documentoParaGuardar({ pages: [{ id: "p1" }] }) === null && documentoParaGuardar({}) === null && documentoParaGuardar([]) === null && documentoParaGuardar(null) === null);
  const enorme = doc(1);
  enorme.pages[0].shapes[0].src = "x".repeat(LIMITES.documento);
  conferir("acima de 4 MB não entra", documentoParaGuardar(enorme) === null);
  const circular = doc(1);
  circular.eu = circular;
  conferir("documento que não vira JSON não entra (nem derruba a rota)", documentoParaGuardar(circular) === null);
}

console.log("a lista de projetos");
{
  const projetos = [
    { id: "p1", nome: "Compras", descricao: null, atualizado_em: "2026-10-30T10:00:00Z" },
    { id: "p2", nome: "RH", descricao: "gente", atualizado_em: "2026-11-01T09:00:00Z" },
  ];
  const linha = (id, projeto, quando, origem = "pessoa") => ({ id, projeto_id: projeto, nome: id, origem, modo: "diagram", formas: 1, versao: 2, atualizado_em: quando, criado_em: quando });
  const arvore = arvoreDeProjetos(projetos, [
    linha("a", "p1", "2026-10-29T10:00:00Z"), linha("b", "p1", "2026-10-30T10:00:00Z", "lisa"),
    linha("c", "p2", "2026-11-01T09:00:00Z"), linha("orfao", "p9", "2026-11-01T11:00:00Z"),
  ]);
  conferir("o projeto mexido por último primeiro", arvore.map((p) => p.id).join() === "p2,p1");
  conferir("cada fluxo no seu projeto, o mais recente primeiro", arvore[1].fluxos.map((f) => f.id).join() === "b,a" && arvore[0].fluxos.map((f) => f.id).join() === "c");
  conferir("fluxo de projeto que não está na lista fica de fora", !arvore.some((p) => p.fluxos.some((f) => f.id === "orfao")));
  conferir("a linha vira o formato da tela (sem o documento)", JSON.stringify(resumoDoFluxo(linha("b", "p1", "x", "lisa"))) === JSON.stringify({ id: "b", projetoId: "p1", nome: "b", origem: "lisa", modo: "diagram", formas: 1, versao: 2, atualizadoEm: "x", criadoEm: "x" }));
  conferir("descrição vazia vira texto vazio", arvore[1].descricao === "");
}

console.log("o dono da sessão");
{
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const req = (token) => ({ cookies: { get: (n) => (n === "lisa_sessao" && token ? { value: token } : undefined) } });
  conferir("o sub do token é o dono", donoDe(req(`x.${b64({ sub: UUID, email: "a@b" })}.y`)) === UUID);
  conferir("sem cookie, ninguém", donoDe(req(null)) === null && donoDe({}) === null);
  conferir("sub que não é uuid, ninguém (não vira filtro do banco)", donoDe(req(`x.${b64({ sub: "*" })}.y`)) === null);
}

console.log("o que conta como mudança");
{
  const a = doc(2);
  const b = { ...doc(2), exportedAt: "2027-01-01T00:00:00Z", viewport: { x: 99 }, pages: [{ ...doc(2).pages[0], viewport: { x: 500 } }] };
  conferir("rolar, dar zoom e a hora da exportação não são mudança", assinaturaDoDesenho(a) === assinaturaDoDesenho(b));
  const c = doc(2);
  c.pages[0].shapes[0].text = "outra";
  conferir("mudar um texto é", assinaturaDoDesenho(a) !== assinaturaDoDesenho(c));
  conferir("sem documento, assinatura vazia", assinaturaDoDesenho(null) === "");
}

// um relógio que só anda quando o teste manda (os timers do salvador ficam na mão)
function relogioFalso() {
  let agora = 0;
  let seq = 0;
  const fila = new Map();
  return {
    setTimeout(fn, ms) { const id = ++seq; fila.set(id, { fn, quando: agora + ms }); return id; },
    clearTimeout(id) { fila.delete(id); },
    async andar(ms) {
      const alvo = agora + ms;
      for (;;) {
        // antes de olhar a fila, deixa as promessas resolverem: elas podem agendar timers
        await microtarefas();
        const proximo = [...fila.entries()].filter(([, t]) => t.quando <= alvo).sort((x, y) => x[1].quando - y[1].quando)[0];
        if (!proximo) break;
        fila.delete(proximo[0]);
        agora = proximo[1].quando;
        proximo[1].fn();
        await microtarefas();
      }
      agora = alvo;
      await microtarefas();
    },
    pendentes: () => fila.size,
  };
}

// um servidor falso: guarda o que chegou e responde quando o teste mandar (ou na hora)
function servidorFalso({ automatico = true, versaoInicial = 1 } = {}) {
  let versao = versaoInicial;
  const chamadas = [];
  const esperando = [];
  const gravar = (d, opcoes) => {
    chamadas.push({ d, ...opcoes });
    const responder = (erro) => (erro ? Promise.reject(erro) : Promise.resolve({ id: "f1", versao: ++versao }));
    if (automatico) return responder();
    return new Promise((ok_, falhou) => esperando.push((erro) => responder(erro).then(ok_, falhou)));
  };
  return { gravar, chamadas, soltar: (erro) => esperando.shift()?.(erro), versao: () => versao };
}

console.log("o salvamento automático");
{
  const rel = relogioFalso();
  const srv = servidorFalso();
  const estados = [];
  const base = doc(2);
  const s = criarSalvador({ gravar: srv.gravar, versao: 1, assinatura: assinaturaDoDesenho(base), aoEstado: (e) => estados.push(e.estado), esperaMs: 1000, relogio: rel });
  s.mudou(doc(2));
  await rel.andar(5000);
  conferir("abrir sem mexer não grava", srv.chamadas.length === 0);
  s.mudou(doc(3));
  s.mudou(doc(4));
  await rel.andar(500);
  conferir("espera a calma antes de gravar", srv.chamadas.length === 0 && estados.at(-1) === "pendente");
  s.mudou(doc(5));
  await rel.andar(1000);
  conferir("várias mudanças seguidas viram uma gravação só, com a última", srv.chamadas.length === 1 && srv.chamadas[0].d.pages[0].shapes.length === 5);
  conferir("leva a versão em que a tela se baseou", srv.chamadas[0].versao === 1 && srv.chamadas[0].forcar === false);
  conferir("e avisa: salvando, salvo", estados.includes("salvando") && estados.at(-1) === "salvo");
  conferir("a versão nova fica guardada para a próxima", s.versao() === 2);
  s.mudou(doc(5));
  await rel.andar(2000);
  conferir("voltar ao que já está salvo não grava de novo", srv.chamadas.length === 1);
  s.ajustarVersao(7);
  s.mudou(doc(6));
  await s.agora();
  conferir("\"agora\" grava sem esperar, com a versão ajustada por fora (renomear)", srv.chamadas.length === 2 && srv.chamadas[1].versao === 7);
}
{
  const rel = relogioFalso();
  const srv = servidorFalso({ automatico: false });
  const s = criarSalvador({ gravar: srv.gravar, versao: 1, assinatura: assinaturaDoDesenho(doc(1)), esperaMs: 100, relogio: rel });
  s.mudou(doc(2));
  await rel.andar(100);
  s.mudou(doc(3)); // durante a gravação
  await rel.andar(1000);
  conferir("uma gravação por vez", srv.chamadas.length === 1 && s.temPendente());
  srv.soltar();
  await rel.andar(10);
  conferir("o que mudou durante a gravação sai em seguida, com a versão nova", srv.chamadas.length === 2 && srv.chamadas[1].d.pages[0].shapes.length === 3 && srv.chamadas[1].versao === 2);
  srv.soltar();
  await rel.andar(10);
  conferir("e para", srv.chamadas.length === 2 && !s.temPendente());
}
{
  const rel = relogioFalso();
  const srv = servidorFalso({ automatico: false });
  const estados = [];
  const s = criarSalvador({ gravar: srv.gravar, versao: 1, assinatura: "", aoEstado: (e) => estados.push(e), esperaMs: 100, relogio: rel });
  s.mudou(doc(2));
  await rel.andar(100);
  const conflito = Object.assign(new Error("mudou em outro lugar"), { status: 409, fluxo: { versao: 5 } });
  srv.soltar(conflito);
  await rel.andar(10);
  conferir("conflito: avisa com o fluxo de lá", estados.at(-1).estado === "conflito" && estados.at(-1).fluxo.versao === 5);
  s.mudou(doc(3));
  await rel.andar(5000);
  conferir("e não grava mais sozinho até a pessoa escolher", srv.chamadas.length === 1);
  const forcado = s.ficarComAMinha();
  await microtarefas();
  conferir("\"ficar com a minha\" grava por cima, com a última mudança", srv.chamadas.length === 2 && srv.chamadas[1].forcar === true && srv.chamadas[1].d.pages[0].shapes.length === 3);
  srv.soltar();
  await forcado;
  conferir("e volta ao normal", estados.at(-1).estado === "salvo");
}
{
  const rel = relogioFalso();
  const srv = servidorFalso({ automatico: false });
  const estados = [];
  const s = criarSalvador({ gravar: srv.gravar, versao: 1, assinatura: "", aoEstado: (e) => estados.push(e.estado), esperaMs: 100, relogio: rel });
  s.mudou(doc(2));
  await rel.andar(100);
  srv.soltar(new TypeError("Failed to fetch"));
  await rel.andar(10);
  conferir("caiu a rede: avisa e não perde a mudança", estados.at(-1) === "erro" && s.temPendente());
  await rel.andar(8000);
  conferir("e tenta de novo sozinho", srv.chamadas.length === 2);
  srv.soltar(Object.assign(new Error("estragado"), { status: 400 }));
  await rel.andar(60000);
  conferir("erro do pedido (400) não fica repetindo", srv.chamadas.length === 2 && estados.at(-1) === "erro");
}
{
  const rel = relogioFalso();
  const srv = servidorFalso();
  const s = criarSalvador({ gravar: srv.gravar, versao: 3, assinatura: "", esperaMs: 1000, relogio: rel });
  s.mudou(doc(2));
  s.sair();
  conferir("fechar a página: manda já, marcado como saída (keepalive)", srv.chamadas.length === 1 && srv.chamadas[0].saindo === true && srv.chamadas[0].versao === 3);
  s.mudou(doc(4));
  s.parar();
  await rel.andar(5000);
  conferir("parado (o fluxo fechou), não grava mais nada", srv.chamadas.length === 1 && rel.pendentes() === 0);
}

console.log("a API do navegador");
{
  const pedidos = [];
  const respostas = [];
  const buscar = async (url, init) => {
    pedidos.push({ url, ...init });
    const [status, corpo] = respostas.shift() || [200, { ok: true }];
    return { ok: status < 400, status, json: async () => corpo };
  };
  const api = apiDosFluxos(buscar);
  respostas.push([200, { ok: true, projetos: [{ id: "p1" }] }]);
  conferir("listar devolve os projetos", (await api.listar())[0].id === "p1" && pedidos[0].url === "/api/fluxogramas" && pedidos[0].method === "GET");
  respostas.push([200, { ok: true, fluxo: { id: "f1", versao: 3 } }]);
  const f = await api.salvar("f1", { documento: doc(1), versao: 2 }, { keepalive: true });
  conferir("salvar é PUT no fluxo, com JSON e keepalive quando pedido", f.versao === 3 && pedidos[1].method === "PUT" && pedidos[1].url === "/api/fluxogramas/f1" && pedidos[1].keepalive === true && JSON.parse(pedidos[1].body).versao === 2);
  respostas.push([409, { ok: false, error: "este fluxograma foi mudado em outro lugar", fluxo: { versao: 9 } }]);
  let erro = null;
  try { await api.salvar("f1", { documento: doc(1), versao: 2 }); } catch (e) { erro = e; }
  conferir("o 409 vira erro com status e o fluxo de lá (o salvador precisa dos dois)", erro?.status === 409 && erro.fluxo?.versao === 9 && /outro lugar/.test(erro.message));
  respostas.push([200, { ok: true }]);
  await api.excluirProjeto("p 1");
  conferir("excluir projeto vai pelo id na URL, escapado", pedidos.at(-1).method === "DELETE" && pedidos.at(-1).url === "/api/fluxogramas/projetos?id=p%201");
  conferir("o endereço do fluxo no painel", enderecoDoFluxo("f 1") === "/fluxogramas?fluxo=f%201");
}

console.log("as peças ligadas");
{
  const rotas = ["src/app/api/fluxogramas/route.js", "src/app/api/fluxogramas/projetos/route.js", "src/app/api/fluxogramas/[id]/route.js"];
  conferir("as três rotas existem e todas exigem o dono da sessão", rotas.every((r) => { const t = ler(r); return /donoDe\(req\)/.test(t) && /401/.test(t); }));
  const sql = ler("db/fluxogramas.sql");
  conferir("o SQL cria as duas tabelas, idempotente, com dono e RLS", /create table if not exists public\.lisa_projetos/.test(sql) && /create table if not exists public\.lisa_fluxogramas/.test(sql)
    && (sql.match(/dono_id\s+uuid not null/g) || []).length === 2 && /lisa_projetos enable row level security/.test(sql) && /lisa_fluxogramas enable row level security/.test(sql));
  conferir("o painel está no menu", GRUPOS_DE_PAINEIS.some((g) => g.itens.some((i) => i.href === "/fluxogramas")) && fs.existsSync(new URL("../src/app/(panels)/fluxogramas/page.js", import.meta.url)));
  const ponte = ler("public/diagramas/js/Ponte.js");
  conferir("a ponte do quadro abre sem avisar \"mudou\" e sabe criar, SQL e nome", /semAvisar\(\(\) => app\.manager\.load/.test(ponte) && /if \(!abrindo\) avisar\('mudou'\)/.test(ponte) && /novo\(modo\)/.test(ponte) && /sql\(\)/.test(ponte) && /nome\(n\)/.test(ponte));
  conferir("Ctrl+S embutido salva na página (não baixa .json)", /avisar\(k === 's' \? 'salvar' : 'importar'\)/.test(ponte));
  const quadro = ler("src/components/panels/QuadroDaLisa.js");
  conferir("o quadro da Lisa tem o \"salvar\" e grava as mudanças depois", /SalvarFluxo/.test(quadro) && /salvador\.current\?\.mudou\(ultimoDoc\.current\)/.test(quadro) && /v\.mudanca/.test(quadro));
  conferir("a conversa marca quando o desenho novo é mudança do anterior", /mudanca \}/.test(ler("src/app/(panels)/assistant/page.js")));
  conferir("a Lisa sabe que dá para salvar e onde achar", /painel ProcessMap/.test(ler("src/lib/codigoNaResposta.js")));
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
