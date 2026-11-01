// Guarda o ProcessMap na Lisa (01/11/2026): projetos e fluxogramas salvos (src/lib/fluxogramas.js),
// o salvamento automático do navegador (src/lib/fluxogramasNoNavegador.js) e as peças que ligam o
// painel /fluxogramas e o "salvar" do quadro da Lisa. O banco em si não entra aqui: as funções puras
// e o salvador são conferidos com relógio e servidor falsos.

import fs from "node:fs";
import {
  LIMITES, idValido, nomeLimpo, donoDe, documentoParaGuardar, resumoDoFluxo, arvoreDeProjetos, guardarAntes, VERSOES,
} from "../src/lib/fluxogramas.js";
import { apiDosFluxos, assinaturaDoDesenho, criarSalvador, enderecoDoFluxo } from "../src/lib/fluxogramasNoNavegador.js";
import { GRUPOS_DE_PAINEIS } from "../src/lib/navegacao.js";
import {
  citaProjeto, projetoCitado, fluxoCitado, contextoDoProjeto, secaoDoProjeto, validarPlano, LIMITE_DE_OPERACOES,
  pedeEmTodos, faltandoNoPlano, completarPlano, pedeDocumentacao, arquivoDoDocumento, respostaComDocumentos,
  pedeNovoDesenho, ajustarAoPedido, nomeDeArquivo,
} from "../src/lib/processmapNaConversa.js";
import { pedirPlano, executarPlano, textoDoAndamento, documentarProjeto, escreverDocumentos } from "../src/lib/trabalhoNoProjeto.js";
import { trechosDaResposta, respostaSemCodigo } from "../src/lib/codigoNaResposta.js";
import { montarDocumento, validarDesenho, tamanhoDaNota } from "../src/lib/diagramaDaLisa.js";

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
  conferir("a conversa marca quando o desenho novo é mudança do anterior", /colecao: r\.colecao, mudanca[,} ]/.test(ler("src/app/(panels)/assistant/page.js")));
  conferir("a Lisa sabe que dá para salvar e onde achar", /painel ProcessMap/.test(ler("src/lib/codigoNaResposta.js")));
}

console.log("o projeto citado na conversa (01/11/2026: \"no projeto X do ProcessMap, faça tal coisa\")");
{
  const projetos = [
    { id: "p1", nome: "Compras" }, { id: "p2", nome: "RH" }, { id: "p3", nome: "Meus fluxogramas" },
    { id: "p4", nome: "Lançamento do App" }, { id: "p5", nome: "Compras internacionais" },
  ];
  conferir("fala de projeto: \"projeto\" ou \"processmap\" (até com erro)", citaProjeto("no projeto Compras, inclua…") && citaProjeto("lá no procesmap") && citaProjeto("no process map") && !citaProjeto("fiz compras hoje"));
  conferir("acha o projeto pelo nome, sem acento e com erro de digitação", projetoCitado("no projeto compras do processmap, inclua a cotação", projetos)?.id === "p1"
    && projetoCitado("no projeto lancamento do app, ...", projetos)?.id === "p4" && projetoCitado("no projeto Lançamnto do App, ...", projetos)?.id === "p4");
  conferir("o nome mais completo ganha (\"Compras internacionais\" e não \"Compras\")", projetoCitado("no projeto de compras internacionais, mude…", projetos)?.id === "p5");
  conferir("sem falar de projeto, nem procura (\"compras\" sozinho é conversa)", projetoCitado("quais compras eu fiz?", projetos) === null);
  conferir("projeto que não existe: nada", projetoCitado("no projeto financeiro, …", projetos) === null);
  const fluxos = [{ id: "f1", nome: "Pedido de compra" }, { id: "f2", nome: "Aprovação de fornecedor" }, { id: "f3", nome: "Novo fluxograma" }, { id: "f4", nome: "Compras do mês" }];
  conferir("acha o fluxo citado dentro do projeto", fluxoCitado("no projeto Compras, no fluxo de aprovação de fornecedor, inclua a etapa X", fluxos, { nomeDoProjeto: "Compras" })?.id === "f2");
  conferir("o nome do projeto não escolhe fluxo (\"no projeto Compras\" não é \"Compras do mês\")", fluxoCitado("no projeto Compras, inclua uma etapa de cotação", fluxos, { nomeDoProjeto: "Compras" }) === null);
  conferir("fluxo de nome genérico (\"Novo fluxograma\") só se escrito igual", fluxoCitado("no projeto Compras, desenhe um novo fluxo", fluxos, { nomeDoProjeto: "Compras" }) === null && fluxoCitado("abra o novo fluxograma do projeto", fluxos)?.id === "f3");

  const doc = montarDocumento(validarDesenho({ titulo: "Pedido", formas: [{ id: "a", tipo: "process", texto: "Registrar pedido" }, { id: "b", tipo: "process", texto: "Cotar" }], ligacoes: [{ de: "a", para: "b" }] }));
  const comDocs = [{ ...fluxos[0], modo: "diagram", formas: 2, documento: doc }, { ...fluxos[1], modo: "diagram", formas: 0, documento: null, origem: "lisa" }];
  const texto = contextoDoProjeto({ nome: "Compras" }, comDocs, { alvo: comDocs[1] });
  conferir("o contexto traz o projeto, a lista e cada desenho descrito", /PROJETO "Compras" DO PROCESSMAP — 2 desenhos/.test(texto) && /"Registrar pedido"/.test(texto) && /\[a\] .* → \[b\]/.test(texto));
  conferir("o fluxo que o pedido muda vem primeiro e marcado", texto.indexOf("Aprovação de fornecedor\" (fluxograma") < texto.indexOf("=== \"Pedido de compra") && /É ESTE QUE O PEDIDO MUDA/.test(texto));
  const muitos = Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, nome: `Fluxo ${i}`, modo: "diagram", formas: 2, documento: doc }));
  conferir("projeto grande não estoura o prompt", contextoDoProjeto({ nome: "Grande" }, muitos.map((f) => ({ ...f, documento: { ...doc, name: "x".repeat(5000) } }))).length <= 26_000);
  conferir("a seção da conversa: vazia sem projeto, e pede para perguntar qual fluxo quando não disser", secaoDoProjeto("") === "" && /pergunte qual/.test(secaoDoProjeto(texto)));

  const pagina = ler("src/app/(panels)/assistant/page.js");
  conferir("a conversa acha o projeto antes de decidir entre desenhar e responder", /await resolverProjetoRef\.current\?\.\(q\)/.test(pagina) && /projeto: doProjeto\?\.texto \|\| ""/.test(pagina));
  conferir("o desenho no projeto é salvo lá (muda o alvo ou cria um fluxo) e o quadro abre ligado", /apiDosFluxosDaConversa\.salvar\(alvo\.id/.test(pagina) && /apiDosFluxosDaConversa\.criar\(\{ documento: r\.doc, nome: r\.titulo, projetoId/.test(pagina) && /mudanca, vinculo \}/.test(pagina));
  conferir("o quadro grava no fluxo ligado e avisa a página", /if \(!mesmaVersao && v\.vinculo\)/.test(ler("src/components/panels/QuadroDaLisa.js")) && /aoVincularRef\.current\?\.\(r\)/.test(ler("src/components/panels/QuadroDaLisa.js")));
  conferir("a conversa e o desenho recebem o projeto", /secaoDoProjeto\(body\.projeto\)/.test(ler("src/app/api/ask/route.js")) && /desenharDiagrama\(\{ pedido, estrutura, conversa, contexto, projeto \}\)/.test(ler("src/app/api/diagrama/route.js")));
  conferir("ler um projeto com os documentos: GET /api/fluxogramas/projetos?id=", /export async function GET/.test(ler("src/app/api/fluxogramas/projetos/route.js")));
}

console.log("o plano no projeto (01/11/2026: \"essa minha interação deveria ser o suficiente\")");
{
  const fluxos = [{ id: "f1", nome: "Funcionalidades" }, { id: "f2", nome: "Arquitetura" }];
  const plano = validarPlano({
    acao: "mudar", explicacao: "  Vou incluir a Lisa Task e pôr uma nota em cada fluxo. ",
    operacoes: [
      { fluxo: "f1", pedido: "Inclua o tópico Lisa Task." },
      { fluxo: "f2", pedido: "Adicione uma forma do tipo note com o texto: …" },
      { fluxo: "f1", pedido: "Adicione também uma nota." },
      { fluxo: "inventado", nome: "Decisões", tipo: "mapa mental", pedido: "Monte as decisões." },
      { fluxo: "f2", pedido: "   " },
    ],
  }, fluxos);
  conferir("mudar: uma operação por desenho, na ordem", plano.acao === "mudar" && plano.operacoes.map((o) => o.fluxo || o.nome).join() === "f1,f2,Decisões");
  conferir("duas operações no mesmo desenho viram uma (as instruções se somam)", /Lisa Task[\s\S]*Além disso: Adicione também uma nota/.test(plano.operacoes[0].pedido));
  conferir("desenho que não é do projeto vira desenho novo (com nome e tipo)", plano.operacoes[2].fluxo === "" && plano.operacoes[2].tipo === "mapa mental");
  conferir("operação sem instrução sai; a explicação vem limpa", plano.operacoes.length === 3 && plano.explicacao === "Vou incluir a Lisa Task e pôr uma nota em cada fluxo.");
  conferir("\"mudar\" sem nenhuma operação que sobre é \"responder\"", validarPlano({ acao: "mudar", operacoes: [{ fluxo: "f1", pedido: "" }] }, fluxos).acao === "responder");
  conferir("\"responder\" não leva operações", validarPlano({ acao: "responder", operacoes: [{ fluxo: "f1", pedido: "x" }] }, fluxos).operacoes.length === 0);
  conferir("no máximo LIMITE_DE_OPERACOES", validarPlano({ acao: "mudar", operacoes: Array.from({ length: 30 }, (_, i) => ({ nome: `N${i}`, pedido: "x" })) }, []).operacoes.length === LIMITE_DE_OPERACOES);
  conferir("plano estragado: responder", validarPlano(null, fluxos).acao === "responder" && validarPlano("lixo", fluxos).acao === "responder");

  // a nota de texto: longa, do tamanho do texto e ao lado do desenho
  const longo = "• Conceito: a Lisa Task é o Abacato dentro da Lisa.\n• Decisão: sem hospedagem de arquivos, para não duplicar armazenamento.\n• Decisão: o visual é o da Lisa.\n• " + "x".repeat(400);
  const d = validarDesenho({ titulo: "A", formas: [{ id: "a", tipo: "process", texto: "Etapa" }, { id: "nota", tipo: "note", texto: longo }], ligacoes: [] });
  conferir("a anotação guarda texto longo (uma etapa, não)", d.formas.find((f) => f.id === "nota").texto.length > 400 && validarDesenho({ titulo: "A", formas: [{ id: "a", tipo: "process", texto: "y".repeat(500) }], ligacoes: [] }).formas[0].texto.length <= 120);
  conferir("o tamanho da anotação acompanha o texto", tamanhoDaNota("curta").h === 60 && tamanhoDaNota(longo).h > 150 && tamanhoDaNota(longo).w === 360);
  const tela = montarDocumento(validarDesenho({ titulo: "A", formas: [{ id: "a", tipo: "process", texto: "A" }, { id: "b", tipo: "process", texto: "B" }], ligacoes: [{ de: "a", para: "b" }] }));
  const comNota = montarDocumento(validarDesenho({ titulo: "A", formas: [{ id: "a", tipo: "process", texto: "A" }, { id: "b", tipo: "process", texto: "B" }, { id: "nota", tipo: "note", texto: longo }], ligacoes: [{ de: "a", para: "b" }] }), tela);
  const formas = comNota.pages[0].shapes;
  const nota = formas.find((x) => x.id === "nota");
  const direita = Math.max(...formas.filter((x) => x.id !== "nota").map((x) => x.x + x.w));
  conferir("a anotação solta entra ao lado do desenho, sem empurrar ninguém", nota.x > direita && ["a", "b"].every((id) => formas.find((x) => x.id === id).x === tela.pages[0].shapes.find((x) => x.id === id).x) && nota.h === tamanhoDaNota(nota.text).h);

  const pagina = ler("src/app/(panels)/assistant/page.js");
  conferir("o projeto citado vale antes da regra do Abacato", /const doProjeto = !alvoDaIde \? await resolverProjetoRef/.test(pagina));
  conferir("a Lisa planeja e trabalha no projeto (vários desenhos)", /await planejarNoProjetoRef\.current\?\.\(q, doProjeto, displayText\)/.test(pagina) && /plano\?\.acao === "mudar"\) \{\s*const feito = await trabalharNoProjetoRef/.test(pagina) && /await executarPlano\(\{/.test(pagina)
    && /for \(const \[i, op\] of plano\.operacoes\.entries\(\)\)/.test(ler("src/lib/trabalhoNoProjeto.js")));
  const rotaDoPlano = ler("src/app/api/processmap/plano/route.js");
  conferir("a rota do plano confere o que o modelo devolveu", /validarPlano\(await planejarNoProjeto\(base\), fluxos\)/.test(rotaDoPlano));

  // "ela não criou comentários em todos os fluxogramas, fez apenas em um"
  const frase = "alem disso cir uma nota d etexto em tdoso os fluogramas descreevndo o conceito";
  conferir("\"em todos\": entende \"tdoso os fluogramas\", \"em cada fluxo\", \"todas as abas\"", pedeEmTodos(frase) && pedeEmTodos("ponha uma nota em cada fluxo") && pedeEmTodos("em todas as abas") && pedeEmTodos("em todos os desenhos do projeto"));
  conferir("e não confunde (\"no fluxo de compras\", \"todos os dias\")", !pedeEmTodos("no fluxo de compras, inclua uma etapa") && !pedeEmTodos("faço isso todos os dias"));
  const doProjetoTodo = [
    { id: "mvp", nome: "Fluxo de Uso MVP", modo: "diagram", formas: 12 },
    { id: "nucleo", nome: "Núcleo de Funcionalidades", modo: "mindmap", formas: 20 },
    { id: "mobile", nome: "Assistente Dev Mobile", modo: "mindmap", formas: 22 },
    { id: "vazio", nome: "Novo mapa mental", modo: "mindmap", formas: 1 },
  ];
  const so2 = validarPlano({ acao: "mudar", operacoes: [{ fluxo: "nucleo", pedido: "Lisa Task" }, { fluxo: "mvp", pedido: "nota" }] }, doProjetoTodo);
  const faltam = faltandoNoPlano(so2, doProjetoTodo);
  conferir("o que o plano esqueceu: os mapas mentais, até o quase vazio (\"todos os mapas mentais\")", faltam.map((f) => f.id).join() === "mobile,vazio");
  const completo = completarPlano(so2, validarPlano({ acao: "mudar", operacoes: [{ fluxo: "mobile", pedido: "tópico Conceito e decisões" }, { fluxo: "vazio", pedido: "tópico Conceito e decisões" }, { fluxo: "mvp", pedido: "repetido" }, { fluxo: "", nome: "Outro", pedido: "x" }] }, doProjetoTodo), faltam);
  conferir("a segunda volta completa só com os que faltavam (sem repetir, sem inventar desenho)", completo.operacoes.map((o) => o.fluxo).join() === "nucleo,mvp,mobile,vazio");
  conferir("a rota pede a segunda volta quando o pedido é para todos", /pedeEmTodos\(pedido\) && !pedeDocumentacao\(pedido\) \? faltandoNoPlano\(plano, fluxos\)/.test(rotaDoPlano) && /complemento:/.test(rotaDoPlano) && /completarPlano\(plano, extra, faltando\)/.test(rotaDoPlano));
  conferir("\"\\n\" escrito ao pé da letra no plano vira quebra de linha", validarPlano({ acao: "mudar", operacoes: [{ fluxo: "mvp", pedido: "• A\\n• B" }] }, doProjetoTodo).operacoes[0].pedido === "• A\n• B");
  conferir("o planejador sabe que \"fluxograma\" é qualquer desenho e que cada aba recebe a nota", /mapas\s+mentais inclusive/.test(ler("src/lib/gemini.js")) && /vai em CADA\s+aba/.test(ler("src/lib/gemini.js")));
}

console.log("executar o plano (a conversa e a barra do painel ProcessMap usam o mesmo)");
{
  const projeto = { id: "p1", nome: "Produto Lisa" };
  const fluxos = [
    { id: "mvp", nome: "Fluxo MVP", modo: "diagram", formas: 5, versao: 3, documento: { pages: [{ id: "desk", shapes: [] }] } },
    { id: "nucleo", nome: "Núcleo", modo: "mindmap", formas: 9, versao: 7, documento: { mode: "mindmap", pages: [{ shapes: [] }] } },
    { id: "mobile", nome: "Dev Mobile", modo: "mindmap", formas: 9, versao: 1, documento: { mode: "mindmap", pages: [{ shapes: [] }] } },
  ];
  const pedidos = [];
  const buscar = async (url, init) => {
    const corpo = JSON.parse(init.body);
    pedidos.push({ url, corpo });
    if (url === "/api/processmap/plano") return { ok: true, status: 200, json: async () => ({ ok: true, plano: { acao: "mudar", explicacao: "Vou anotar tudo.", operacoes: [] } }) };
    if (/Núcleo dá erro/.test(corpo.pedido)) return { ok: false, status: 500, json: async () => ({ ok: false, error: "o modelo caiu" }) };
    return { ok: true, status: 200, json: async () => ({ ok: true, doc: { pages: [{ shapes: [{ id: "nota", type: "note" }] }] }, colecao: "flow", titulo: "T", explicacao: "Anotei. Detalhe a mais." }) };
  };
  const gravacoes = [];
  const api = {
    salvar: async (id, dados) => { gravacoes.push({ id, ...dados }); return { id, nome: fluxos.find((f) => f.id === id).nome, versao: 99 }; },
    criar: async (dados) => { gravacoes.push({ novo: true, ...dados }); return { fluxo: { id: "novo", nome: dados.nome, versao: 1 } }; },
  };
  const plano0 = await pedirPlano({ pedido: "anote todos", projeto, fluxos, aberto: "mvp", buscar });
  conferir("pedir o plano manda o projeto inteiro e o fluxo aberto", plano0.acao === "mudar" && pedidos[0].corpo.aberto === "mvp" && pedidos[0].corpo.fluxos.length === 3 && /PROJETO "Produto Lisa"/.test(pedidos[0].corpo.projeto));
  const plano = { acao: "mudar", explicacao: "Vou anotar tudo.", operacoes: [
    { fluxo: "mvp", pedido: "nota em cada aba" }, { fluxo: "nucleo", pedido: "Núcleo dá erro" },
    { fluxo: "mobile", pedido: "galho Conceito e decisões" }, { fluxo: "", nome: "Decisões", tipo: "mapa mental", pedido: "as decisões" },
  ] };
  const andamentos = [];
  const daTela = { pages: [{ id: "desk", shapes: [{ id: "mexido" }] }] };
  const r = await executarPlano({ plano, projeto, fluxos, api, abertoId: "mvp", buscar, docDe: (f) => (f.id === "mvp" ? daTela : f.documento), aoAndar: (ls) => andamentos.push(ls.map((l) => l.estado).join("|")) });
  conferir("todos os desenhos do plano são trabalhados, um por um", pedidos.filter((p) => p.url === "/api/diagrama").length === 4);
  conferir("o aberto parte do que está na tela e grava por cima; os outros, pela versão", gravacoes[0].id === "mvp" && gravacoes[0].forcar === true && JSON.stringify(pedidos[1].corpo.atual) === JSON.stringify(daTela) && gravacoes.find((g) => g.id === "mobile")?.versao === 1);
  conferir("um que dá erro não para os outros", r.linhas[1].ok === false && /o modelo caiu/.test(r.linhas[1].nota) && r.linhas[2].ok === true && r.feitos === 3);
  conferir("desenho novo é criado no projeto, como mapa mental quando pedido", gravacoes.some((g) => g.novo && g.projetoId === "p1" && g.nome === "Decisões") && /^Monte um mapa mental\./.test(pedidos.at(-1).corpo.pedido));
  conferir("cada desenho leva o projeto inteiro como contexto, marcando o que muda", pedidos.filter((p) => p.url === "/api/diagrama").every((p) => /PROJETO "Produto Lisa"/.test(p.corpo.projeto)) && /É ESTE QUE O PEDIDO MUDA/.test(pedidos[1].corpo.projeto));
  conferir("o andamento aparece a cada passo", andamentos.some((a) => a.startsWith("trabalhando…|na fila")) && andamentos.at(-1).split("|").every((x) => x !== "na fila" && x !== "trabalhando…"));
  const texto = textoDoAndamento(plano, r.linhas, "Salvo.");
  conferir("o texto do andamento: explicação, ✓/✗ por desenho e o fecho", /^Vou anotar tudo\./.test(texto) && /✓ "Fluxo MVP" — atualizado: Anotei\./.test(texto) && /✗ "Núcleo" — não deu: o modelo caiu/.test(texto) && /✓ "Decisões" — criado/.test(texto) && /Salvo\.$/.test(texto));

  const painel = ler("src/app/(panels)/fluxogramas/page.js");
  conferir("a barra do painel ProcessMap trabalha no projeto inteiro quando o pedido fala dele", /falaDoProjeto\(q, doProjeto\.fluxos\)/.test(painel) && /await trabalharNoProjeto\(q, abertoRef\.current\)/.test(painel) && /executarPlano\(\{/.test(painel));
  conferir("e para o salvamento do fluxo aberto enquanto a Lisa grava, reabrindo depois", /salvador\.current\?\.parar\(\);\s*salvador\.current = null;/.test(painel) && /await abrirFluxo\(a\.id, \{ deNovo: true \}\)/.test(painel));
  const conversaPagina = ler("src/app/(panels)/assistant/page.js");
  conferir("na conversa, \"do projeto\" sem nome é o projeto em uso (o do quadro ou o último)", /projetoCitado\(q, lista\) \|\| \(emUso && lista\.find/.test(conversaPagina) && /if \(!citaProjeto\(q\) && !pedeEmTodos\(q\) && !documentaDesenhos\) return null;/.test(conversaPagina));
}

console.log("documentar: um .md por desenho no editor (01/11/2026: a Lisa mexeu nos desenhos em vez de escrever os MD)");
{
  const pedidoReal = "Lisa faça um arquivo MD no editor explicando toda anossa estrategia e conceito da construçã do noss MVP baseaod no projeto process map Produto lisa faal uamaba de MD por flugrama emapa mental que etmos eu viu usar isso para pedir o claud eara construir a rota e formar o nosso mvp";
  conferir("o pedido de verdade (com os erros) é reconhecido como documentar", pedeDocumentacao(pedidoReal));
  conferir("e outros jeitos de pedir", ["escreva um markdown de cada fluxograma", "gere o README do projeto", "no editor, escreva um arquivo por fluxo", "documente os fluxos do projeto", "faça um .md por mapa mental", "crie uma pagina no editor de codigo para cada fluxo"].every(pedeDocumentacao));
  conferir("com erros de digitação e de voz também (\"mds\", \"editro\", \"aquivos\", \"emedês\", \"docuemnte\")", [
    "abra o editro de codigo e escreva os mds de cada fluxo do projeto", "Lisa abre a IDE e escreve os aquivos de cada fluxograma",
    "no projeto produto lisa faça os emedês de cada mapa", "faça os arquivos eme de dos fluxos", "gere a documentaçao de cada fluxograma do projeto para o claude",
    "crie a especificação de todos os fluxos do projeto", "docuemnte os fluxos do projeto", "escreva no vs code um arquivo por fluxograma", "markdwon de todos os desenhos", "abra o editor",
  ].every(pedeDocumentacao));
  conferir("e assunto de fluxo com \"documentos\" não vira documentar", !["crie um fluxo de aprovação de documento por área", "no projeto x, crie um fluxo da gestão de documentos de cada área", "edite a aba Desktop e escreva o texto da nota"].some(pedeDocumentacao));
  conferir("o planejador planeja só o pedido de agora (a conversa é contexto) e põe documento acima de mudança", /O PEDIDO DE AGORA \(é ESTE que você planeja\)/.test(ler("src/lib/gemini.js")) && /NÃO mude os desenhos que já existem, a não ser que ele mande mudar/.test(ler("src/lib/gemini.js")));
  conferir("pedido de mudar o desenho não é documentar", !["crie uma nota de texto em tdoso os fluogramas descrevendo o conceito", "documente nas notas de cada fluxo as decisões", "crie um fluxo de aprovação de documentos", "editar a aba Desktop", "pinte de verde as decisões", "crie uma aba com o detalhe da aprovação", "no projeto Produto Lisa, ponha a especificação do login no fluxo"].some(pedeDocumentacao));
  conferir("o plano pode decidir \"documentar\" (e aí nenhuma operação)", validarPlano({ acao: "documentar", explicacao: "Vou escrever.", operacoes: [{ fluxo: "x", pedido: "y" }] }, []).acao === "documentar" && validarPlano({ acao: "documentar", operacoes: [{ fluxo: "x", pedido: "y" }] }, []).operacoes.length === 0);
  const rotaDoPlano = ler("src/app/api/processmap/plano/route.js");
  conferir("a rota do plano passa o plano pela trava (e, sem o modelo, o documento ainda sai)", /plano = ajustarAoPedido\(plano, pedido, fluxos\)/.test(rotaDoPlano) && /if \(!pedeDocumentacao\(pedido\)\) throw err;/.test(rotaDoPlano));
  conferir("o planejador conhece a ação documentar e devolve os documentos", /"documentar" quando a pessoa quer SÓ um TEXTO/.test(ler("src/lib/gemini.js")) && /enum: \["mudar", "responder", "documentar"\]/.test(ler("src/lib/gemini.js")) && /documentos: \{\s*type: "ARRAY"/.test(ler("src/lib/gemini.js")));

  // 01/11/2026: "faça um fluxograma desenhando a arquitetura … cibersegurança, onde hoje falhamos? … faça
  // um arquivo md também" — a Lisa reescreveu os .md do MVP e não desenhou nada
  const pedidoSeguranca = "Lisa faça um fluxograma desnhando a arquitetura do nosso produto já pensando em cyber segurança onde hoje nos falhamos ? pque eu tenho que tomar cuidaod antes de expandir o usoo, fla um aruivo md tambem";
  const doProjeto = [{ id: "mvp", nome: "Fluxo de Uso MVP" }, { id: "nucleo", nome: "Núcleo de Funcionalidades" }];
  conferir("o pedido de segurança pede um desenho novo e um documento", pedeNovoDesenho(pedidoSeguranca) && pedeDocumentacao(pedidoSeguranca));
  conferir("\"desenho novo\" é pedido de fazer, não citação", ["desenhe a arquitetura", "monte um mapa mental do lançamento", "crie um fluxograma de compras"].every(pedeNovoDesenho) && !["faça um md do desenho Núcleo", pedidoReal, "documente os fluxos do projeto"].some(pedeNovoDesenho));
  const planoSeguranca = ajustarAoPedido(validarPlano({
    acao: "mudar", explicacao: "Vou desenhar a arquitetura com os riscos e escrever a análise.",
    operacoes: [{ fluxo: "", nome: "Arquitetura e Cibersegurança", tipo: "fluxograma", pedido: "Desenhe a arquitetura…" }, { fluxo: "mvp", pedido: "acrescente uma nota de segurança" }],
    documentos: [{ arquivo: "analise de seguranca.md", titulo: "Análise de cibersegurança", desenhos: ["mvp", "inventado"], novos: true, pedido: "a arquitetura de hoje, onde falhamos, riscos e o que fazer antes de expandir" }],
  }, doProjeto), pedidoSeguranca, doProjeto);
  conferir("o plano: desenha o fluxograma NOVO e não mexe nos que existem", planoSeguranca.acao === "mudar" && planoSeguranca.operacoes.length === 1 && planoSeguranca.operacoes[0].fluxo === "" && planoSeguranca.operacoes[0].nome === "Arquitetura e Cibersegurança");
  conferir("e escreve UM documento sobre o assunto, ligado ao desenho novo", planoSeguranca.documentos.length === 1 && planoSeguranca.documentos[0].arquivo === "analise-de-seguranca.md" && planoSeguranca.documentos[0].novos === true && planoSeguranca.documentos[0].desenhos.join() === "mvp" && planoSeguranca.documentos[0].estilo === "livre");
  const primeiroPedido = ajustarAoPedido(validarPlano({ acao: "mudar", operacoes: [{ fluxo: "mvp", pedido: "nota" }, { fluxo: "nucleo", pedido: "nota" }] }, doProjeto), pedidoReal, doProjeto);
  conferir("\"um md por fluxograma\": nenhum desenho muda, e sai a visão geral + um por desenho", primeiroPedido.acao === "documentar" && primeiroPedido.operacoes.length === 0 && primeiroPedido.documentos.map((d) => d.arquivo).join() === "00-visao-geral.md,01-fluxo-de-uso-mvp.md,02-nucleo-de-funcionalidades.md");
  const semModelo = ajustarAoPedido(validarPlano({ acao: "documentar" }, doProjeto), "faça um arquivo md sobre os riscos de segurança do projeto", doProjeto);
  conferir("sem documentos no plano, sai um documento sobre o pedido", semModelo.acao === "documentar" && semModelo.documentos.length === 1 && semModelo.documentos[0].estilo === "livre" && /riscos de segurança/.test(semModelo.documentos[0].pedido));
  const mandaMudar = ajustarAoPedido(validarPlano({ acao: "mudar", operacoes: [{ fluxo: "mvp", pedido: "inclua a etapa de login" }], documentos: [{ arquivo: "login.md", titulo: "Login", pedido: "o login" }] }, doProjeto), "inclua a etapa de login no Fluxo de Uso MVP e faça um md do login", doProjeto);
  conferir("mudança pedida com todas as letras continua junto do documento", mandaMudar.acao === "mudar" && mandaMudar.operacoes.length === 1 && mandaMudar.documentos.length === 1);
  conferir("nome de arquivo: curto, com hífens, sem repetir", nomeDeArquivo("Análise de Segurança.md") === "analise-de-seguranca.md" && nomeDeArquivo("x", ["x.md"]) === "x-2.md");

  const projeto = { id: "p1", nome: "Produto Lisa" };
  conferir("os caminhos: docs/<projeto>/00-visao-geral.md e 01-<desenho>.md", arquivoDoDocumento(projeto, null, 0) === "docs/produto-lisa/00-visao-geral.md" && arquivoDoDocumento(projeto, { nome: "Fluxo de Uso MVP - Lisa Assistant" }, 1) === "docs/produto-lisa/01-fluxo-de-uso-mvp-lisa-assistant.md");

  // a resposta: um bloco de quatro crases por arquivo; cada um vira uma aba do editor
  const resposta = respostaComDocumentos("Escrevi 2 arquivos.", [
    { arquivo: "docs/produto-lisa/00-visao-geral.md", legenda: "**00-visao-geral.md** — a visão geral.", markdown: "# Produto Lisa\n\n```bash\nnpm run dev\n```\n\nFim." },
    { arquivo: "docs/produto-lisa/01-fluxo.md", legenda: "**01-fluxo.md** — o fluxo.", markdown: "# Fluxo\n````\nquatro crases dentro\n````\n## Rotas" },
  ]);
  const { trechos } = trechosDaResposta(resposta);
  conferir("o editor abre uma aba por arquivo, com o nome do arquivo", trechos.length === 2 && trechos.map((t) => t.rotulo).join() === "00-visao-geral.md,01-fluxo.md" && trechos.every((t) => t.linguagem === "markdown" && t.completo));
  conferir("o bloco de código de dentro do .md fica inteiro no arquivo", /```bash\nnpm run dev\n```\n\nFim\./.test(trechos[0].codigo));
  conferir("quatro crases dentro do .md não quebram a aba", /## Rotas$/.test(trechos[1].codigo) && !/````/.test(trechos[1].codigo));
  conferir("a conversa mostra o texto, não os arquivos", /^Escrevi 2 arquivos\./.test(respostaSemCodigo(resposta)) && !/npm run dev/.test(respostaSemCodigo(resposta)));

  // documentarProjeto com servidor falso: lê, escreve, e NUNCA grava desenho
  const fluxos = [
    { id: "mvp", nome: "Fluxo de Uso MVP", modo: "diagram", formas: 9, documento: { name: "Fluxo de Uso MVP", mode: "diagram", activePage: "desk", pages: [{ id: "desk", name: "Fluxo Desktop", shapes: [{ id: "n", type: "note", x: 0, y: 0, w: 360, h: 200, text: "• Conceito: " + "c".repeat(900) }], connections: [] }, { id: "mob", name: "Fluxo Mobile", shapes: [{ id: "i", type: "terminal", x: 0, y: 0, w: 160, h: 60, text: "Início" }], connections: [] }] } },
    { id: "nucleo", nome: "Núcleo", modo: "mindmap", formas: 3, documento: { mode: "mindmap", name: "Núcleo", pages: [{ id: "p1", shapes: [{ id: "root", type: "mmRoot", text: "Lisa" }, { id: "a", type: "mmNode", parent: "root", text: "Voz" }] }] } },
    { id: "falha", nome: "Este dá erro", modo: "diagram", formas: 1, documento: { pages: [{ id: "p1", shapes: [{ id: "x", type: "process", x: 0, y: 0, w: 160, h: 60, text: "X" }] }] } },
  ];
  const chamadas = [];
  let aoMesmoTempo = 0, pico = 0;
  const buscar = async (url, init) => {
    const corpo = JSON.parse(init.body);
    chamadas.push({ url, corpo, metodo: init.method });
    aoMesmoTempo++; pico = Math.max(pico, aoMesmoTempo);
    await new Promise((r) => setTimeout(r, 5));
    aoMesmoTempo--;
    if (corpo.desenhos?.[0]?.nome === "Este dá erro") return { ok: false, status: 500, json: async () => ({ ok: false, error: "o modelo caiu" }) };
    return { ok: true, status: 200, json: async () => ({ ok: true, markdown: `# ${corpo.desenhos?.[0]?.nome || corpo.titulo || "Visão geral"}\n\nTexto.` }) };
  };
  const andamentos = [];
  const r = await documentarProjeto({ pedido: pedidoReal, projeto, fluxos, buscar, aoAndar: (ls) => andamentos.push(ls.map((l) => l.estado).join("|")) });
  conferir("só /api/processmap/documento é chamado — nenhum desenho é gravado", chamadas.every((c) => c.url === "/api/processmap/documento"));
  conferir("a visão geral e um arquivo por desenho, na ordem (o que deu erro fica de fora)", r.documentos.map((d) => d.arquivo.split("/").pop()).join() === "00-visao-geral.md,01-fluxo-de-uso-mvp.md,02-nucleo.md" && r.linhas[3].ok === false && /o modelo caiu/.test(r.linhas[3].nota));
  const doMvp = chamadas.find((c) => c.corpo.desenhos?.[0]?.nome === "Fluxo de Uso MVP").corpo;
  conferir("cada desenho vai inteiro: todas as abas e a anotação sem corte", /ABA "Fluxo Desktop"/.test(doMvp.desenhos[0].descricao) && /ABA "Fluxo Mobile"/.test(doMvp.desenhos[0].descricao) && doMvp.desenhos[0].descricao.includes("c".repeat(900)) && doMvp.estilo === "especificacao");
  conferir("o mapa mental vai como mapa mental", chamadas.find((c) => c.corpo.desenhos?.[0]?.nome === "Núcleo").corpo.desenhos[0].tipo === "mapa mental");
  conferir("a visão geral recebe a lista dos arquivos", chamadas.find((c) => c.corpo.estilo === "visao-geral").corpo.arquivos.map((a) => a.arquivo.split("/").pop()).join() === "01-fluxo-de-uso-mvp.md,02-nucleo.md,03-este-da-erro.md");
  conferir("escreve alguns ao mesmo tempo (não um por um)", pico >= 2 && pico <= 3);
  conferir("a legenda diz quantas abas o desenho tem", /"Fluxo de Uso MVP" \(fluxograma, 2 abas\)/.test(r.documentos[1].legenda));
  conferir("o andamento aparece a cada passo", andamentos.some((a) => a.includes("escrevendo…")) && andamentos.at(-1).split("|").every((x) => x === "escrito" || x === "não deu"));

  chamadas.length = 0;
  const criado = { id: "arq", nome: "Arquitetura e Cibersegurança", modo: "diagram", documento: { name: "Arquitetura", mode: "diagram", pages: [{ id: "p1", name: "Arquitetura", shapes: [{ id: "api", type: "process", x: 0, y: 0, w: 160, h: 60, text: "API sem limite de taxa" }], connections: [] }] } };
  const r2 = await escreverDocumentos({ pedido: pedidoSeguranca, projeto, fluxos, criados: [criado], documentos: planoSeguranca.documentos, contexto: "CODIGO", buscar });
  const corpoSeg = chamadas[0].corpo;
  conferir("o documento do plano: só ele (não os do MVP), com o foco, o estilo livre e o código", r2.documentos.length === 1 && r2.documentos[0].arquivo === "docs/produto-lisa/analise-de-seguranca.md" && corpoSeg.estilo === "livre" && /onde falhamos/.test(corpoSeg.foco) && corpoSeg.contexto === "CODIGO");
  conferir("e fala do desenho que o mesmo pedido criou (e dos que ele citou)", corpoSeg.desenhos.map((d) => d.nome).join() === "Fluxo de Uso MVP,Arquitetura e Cibersegurança" && /API sem limite de taxa/.test(corpoSeg.desenhos[1].descricao));

  const conversaPagina = ler("src/app/(panels)/assistant/page.js");
  conferir("na conversa: o plano decide desenho e documentos, e sem o modelo o documento ainda sai", /\|\| \(pedeDocumentacao\(q\) \? ajustarAoPedido\(/.test(conversaPagina) && /plano\?\.acao === "documentar"\) return documentarNoProjetoRef/.test(conversaPagina));
  conferir("desenho novo + documento: desenha primeiro, depois escreve sobre o desenho criado", /if \(feito && plano\.documentos\?\.length\) \{\s*return documentarNoProjetoRef\.current\?\.\(q, \{ displayText, doProjeto, plano, criados: feito\.criados, antes: feito\.texto, contexto: feito\.contexto \}\)/.test(conversaPagina));
  conferir("e os arquivos vão para o editor de código", /guardarNaIde\(abrirNaIde\(shown\), shown, texto\)/.test(conversaPagina) && /respostaComDocumentos\(intro, documentos\)/.test(conversaPagina));
  const painel = ler("src/app/(panels)/fluxogramas/page.js");
  conferir("no painel ProcessMap, pedido de documento não mexe no desenho", /if \(pedeDocumentacao\(q\)\) \{\s*setExplicacao\(PARA_DOCUMENTAR\);\s*return;/.test(painel) && /plano\.acao === "documentar"/.test(painel));
}

console.log("versões anteriores (01/11/2026: \"ela estragou o meu fluxograma da versão desktop\")");
{
  const t0 = Date.parse("2026-11-01T12:00:00Z");
  const ha = (min) => new Date(t0 - min * 60_000).toISOString();
  conferir("a Lisa gravando: a versão de antes sempre fica", guardarAntes({ origem: "lisa", formasAntes: 9, formasDepois: 10, ultimaEm: ha(1), agoraMs: t0 }) === "antes de a Lisa mudar");
  conferir("voltar a uma versão também guarda a de agora (dá para desfazer)", guardarAntes({ origem: "volta", formasAntes: 2, formasDepois: 9, ultimaEm: ha(0), agoraMs: t0 }) !== "");
  conferir("sumiram formas (3 ou mais): guarda, mesmo logo depois de outra", guardarAntes({ origem: "pessoa", formasAntes: 9, formasDepois: 2, ultimaEm: ha(1), agoraMs: t0 }) === "antes de sumirem formas");
  conferir("a pessoa desenhando: no máximo uma a cada 10 minutos", guardarAntes({ origem: "pessoa", formasAntes: 9, formasDepois: 10, ultimaEm: ha(3), agoraMs: t0 }) === "" && guardarAntes({ origem: "pessoa", formasAntes: 9, formasDepois: 10, ultimaEm: ha(11), agoraMs: t0 }) === "automática" && guardarAntes({ origem: "pessoa", formasAntes: 9, formasDepois: 9, ultimaEm: null, agoraMs: t0 }) === "automática");
  conferir("ficam as 60 mais novas de cada fluxo", VERSOES.guardar === 60);

  const banco = ler("src/lib/fluxogramas.js");
  conferir("a gravação guarda a versão de antes ANTES de gravar por cima, e falhar nisso não impede a gravação", /await guardarVersao\(dono, atual, \{/.test(banco) && /catch \{\s*\/\/ \(a tabela pode ainda não existir/.test(banco));
  conferir("voltar é gravar a versão escolhida por cima, guardando a de agora", /salvarFluxo\(dono, id, \{ documento: data\.documento, forcar: true, origem: "volta"/.test(banco));
  const sql = ler("db/fluxogramas_versoes.sql");
  conferir("a tabela das versões: do fluxo (some junto), com dono, documento e motivo, e RLS", /create table if not exists public\.lisa_fluxogramas_versoes/.test(sql) && /references public\.lisa_fluxogramas \(id\) on delete cascade/.test(sql) && /enable row level security/.test(sql));
  conferir("a rota lista e volta", fs.existsSync("src/app/api/fluxogramas/[id]/versoes/route.js") && /export async function GET/.test(ler("src/app/api/fluxogramas/[id]/versoes/route.js")) && /voltarVersao\(dono, id, versaoId\)/.test(ler("src/app/api/fluxogramas/[id]/versoes/route.js")));

  const chamadas = [];
  const api = apiDosFluxos(async (url, init) => { chamadas.push({ url, metodo: init?.method || "GET", corpo: init?.body ? JSON.parse(init.body) : null }); return { ok: true, status: 200, json: async () => ({ ok: true, versoes: [{ id: "v1" }], fluxo: { id: "f1", versao: 9 } }) }; });
  const lista = await api.versoes("f1");
  const voltou = await api.voltarVersao("f1", "v1");
  conferir("o navegador: listar e voltar", lista[0].id === "v1" && voltou.versao === 9 && chamadas[0].url === "/api/fluxogramas/f1/versoes" && chamadas[1].metodo === "POST" && chamadas[1].corpo.versaoId === "v1");

  conferir("o trabalho no projeto grava como Lisa (a versão de antes fica)", /origem: "lisa", motivo:/.test(ler("src/lib/trabalhoNoProjeto.js")));
  const painel = ler("src/app/(panels)/fluxogramas/page.js");
  conferir("o painel tem \"Versões anteriores…\" e \"voltar para esta\"", /Versões anteriores…/.test(painel) && /voltar para esta/.test(painel) && /await api\.voltarVersao\(f\.id, v\.id\)/.test(painel));
  conferir("e o desenho que a Lisa faz no fluxo aberto também grava como Lisa", /daLisaRef\.current = q/.test(painel) && /origem: "lisa", motivo/.test(painel));
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
