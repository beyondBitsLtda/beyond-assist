// A conta de CLIENTE: o que ela alcança, o que ela nunca alcança, e onde os limites travam.
//
// ==========================================================================================
// POR QUE ESTE TESTE FALA POR HTTP, E NÃO CHAMA AS FUNÇÕES
//
// A pergunta que ele responde é "quem abrir o inspetor e chamar a rota na mão consegue passar?".
// Chamar `exigirPodeCriarQuadro` direto provaria que a função funciona, e não que a ROTA a
// chama — e o buraco típico é exatamente esse: a trava existe, está escrita, e a rota nova
// esqueceu de passar por ela.
//
// Então tudo aqui é uma sessão de verdade, com cookie de verdade, pedindo à rota de verdade. É
// a única forma de o teste falhar quando alguém acrescentar um caminho novo sem a trava.
// ==========================================================================================
//
// O que ele faz: cria uma conta interna e uma de cliente, entra com as duas, e tenta com a do
// cliente tudo o que ela não devia conseguir. Depois estoura cada limite de propósito. No fim
// apaga o que criou.
//
// Uso:  node --env-file=.env.local scripts/cliente-limites-check.mjs
//       ABACATO_URL=https://abacato.beyond.dev.br node --env-file=.env.local scripts/cliente-limites-check.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chaveDeLogin, guardarSenha } from "../src/lib/abacatoAuth.js";
import { sortearSenha } from "../src/dominio/papeis.js";
import { PLANOS, planoDe, medir, emTamanho, semLimite } from "../src/dominio/planos.js";

const base = (process.argv[2] || process.env.ABACATO_URL || "http://localhost:3000").replace(/\/$/, "");

const url = process.env.SUPABASE_URL;
const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chaveServico) {
  console.error("faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}
const sb = createClient(url, chaveServico, { auth: { persistSession: false, autoRefreshToken: false } });

const arquivoSenha = path.join(os.homedir(), "senha-abacato.txt");
let texto = "";
try {
  texto = fs.readFileSync(arquivoSenha, "utf8");
} catch {
  console.error(`não achei ${arquivoSenha} — é de lá que sai a conta que administra.`);
  process.exit(1);
}
const emailAdmin = (texto.match(/e-mail:\s*(\S+)/)?.[1] || "").trim();
const senhaAdmin = (texto.match(/senha:\s*(\S+)/)?.[1] || "").trim();

let falhas = 0;
let passaram = 0;
const conferir = (titulo, ok, detalhe = "") => {
  if (ok) passaram += 1; else falhas += 1;
  console.log(`  ${ok ? "ok    " : "FALHOU"}  ${titulo}${detalhe ? `  — ${detalhe}` : ""}`);
};
const secao = (t) => console.log(`\n${t}`);

function novaSessao(nome) { return { nome, cookie: "" }; }

async function chamar(s, metodo, caminho, corpo) {
  const r = await fetch(base + caminho, {
    method: metodo,
    headers: { "content-type": "application/json", ...(s?.cookie ? { cookie: s.cookie } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    redirect: "manual",
  });
  const bruto = await r.text();
  let dados = null;
  try { dados = JSON.parse(bruto); } catch { /* HTML */ }
  const set = r.headers.get("set-cookie");
  if (s && set) {
    const par = set.split(";")[0];
    if (par.startsWith("abacato_sessao=")) s.cookie = par;
  }
  return { status: r.status, dados, bruto };
}

async function entrar(email, senha, nome) {
  const s = novaSessao(nome);
  const r = await chamar(s, "POST", "/api/auth/entrar", { email, chave: await chaveDeLogin(email, senha) });
  return { s, status: r.status, dados: r.dados };
}

async function criarConta(sessaoAdmin, apelido, tipo) {
  const email = `lim-${apelido}-${Date.now().toString(36)}@abacato.teste`;
  const senha = sortearSenha();
  const g = await guardarSenha(email, senha);
  const r = await chamar(sessaoAdmin, "POST", "/api/usuarios", {
    email, nome: `Limite ${apelido}`, hash: g.hash, sal: g.sal, iteracoes: g.iteracoes, tipo,
  });
  if (r.status !== 201) throw new Error(`não criei a conta ${apelido}: ${r.dados?.error || r.status}`);
  return { ...r.dados.usuario, email, senha };
}

const lixo = { usuarios: [], quadros: [], projetos: [], convites: [] };
async function limpar() {
  if (lixo.quadros.length) await sb.from("abacato_quadros").delete().in("id", lixo.quadros);
  if (lixo.projetos.length) await sb.from("abacato_projetos").delete().in("id", lixo.projetos);
  if (lixo.usuarios.length) {
    await sb.from("abacato_eventos").delete().in("usuario_id", lixo.usuarios);
    await sb.from("abacato_usuarios").delete().in("id", lixo.usuarios);
  }
  if (lixo.convites.length) await sb.from("abacato_convites").delete().in("id", lixo.convites);
}

// ============================================================================================

console.log(`\nContas de cliente: limites e fronteiras — ${base}\n`);

// -------------------------------------------------------------- 0. o domínio, sem rede
secao("Os números do plano (puro, sem banco)");
{
  conferir("cliente cria 10 quadros", PLANOS.cliente.quadros === 10);
  conferir("cliente compartilha 3 quadros", PLANOS.cliente.quadrosCompartilhados === 3);
  conferir("com no máximo 3 pessoas em cada", PLANOS.cliente.membrosPorQuadro === 3);
  conferir("mesma coisa para projetos de documentação",
    PLANOS.cliente.projetos === 10 && PLANOS.cliente.projetosCompartilhados === 3
    && PLANOS.cliente.membrosPorProjeto === 3);
  conferir("4 GB de arquivos", PLANOS.cliente.armazenamento === 4 * 1024 * 1024 * 1024,
    emTamanho(PLANOS.cliente.armazenamento));
  conferir("zero assistente", PLANOS.cliente.lisa === false);
  conferir("não vê o diretório de pessoas", PLANOS.cliente.verDiretorio === false);
  conferir("conta interna não tem teto", semLimite(PLANOS.interno.quadros) && PLANOS.interno.lisa === true);

  // A parte que decide o que acontece com um tipo que ninguém previu. Cair no permissivo seria
  // transformar um erro de digitação numa conta sem limite.
  conferir("um tipo desconhecido cai no plano MAIS restrito",
    planoDe("qualquer-coisa") === PLANOS.cliente);

  const m = medir(8, 10);
  conferir("medir conta o que falta", m.usado === 8 && m.restam === 2 && m.porcentagem === 80 && !m.cheio);
  conferir("medir marca quando estourou", medir(12, 10).cheio === true && medir(12, 10).restam === -2);
  conferir("medir sem teto não inventa porcentagem", medir(99, Infinity).ilimitado === true);
}

try {
  // -------------------------------------------------------------- 1. as contas
  secao("As contas");

  const admin = await entrar(emailAdmin, senhaAdmin, "admin");
  if (admin.status !== 200) throw new Error("o administrador não entrou");
  conferir("o administrador entra", true);

  const interno = await criarConta(admin.s, "interno", "interno");
  lixo.usuarios.push(interno.id);
  const cliente = await criarConta(admin.s, "cliente", "cliente");
  lixo.usuarios.push(cliente.id);

  conferir("a conta de cliente nasce com tipo cliente", cliente.tipo === "cliente", cliente.tipo);
  conferir("e nasce aprovada quando é o administrador que cria", cliente.aprovado === true);
  conferir("e nasce sem a assistente", cliente.lisa === false);

  // O pedido chega com admin:true e lisa:true. O servidor tem que ignorar os dois.
  const emailForcado = `lim-forcado-${Date.now().toString(36)}@abacato.teste`;
  const gForcado = await guardarSenha(emailForcado, sortearSenha());
  const forcado = await chamar(admin.s, "POST", "/api/usuarios", {
    email: emailForcado, nome: "Forçado", tipo: "cliente", admin: true, lisa: true,
    hash: gForcado.hash, sal: gForcado.sal, iteracoes: gForcado.iteracoes,
  });
  if (forcado.dados?.usuario?.id) lixo.usuarios.push(forcado.dados.usuario.id);
  conferir("pedir admin:true e lisa:true numa conta de cliente não funciona",
    forcado.status === 201 && forcado.dados.usuario.admin === false && forcado.dados.usuario.lisa === false,
    `status ${forcado.status}`);

  const sI = (await entrar(interno.email, interno.senha, "interno")).s;
  const entradaCliente = await entrar(cliente.email, cliente.senha, "cliente");
  conferir("o cliente entra", entradaCliente.status === 200, `status ${entradaCliente.status}`);
  const sC = entradaCliente.s;

  // -------------------------------------------------------------- 2. o que ele NÃO alcança
  secao("O que a conta de cliente não alcança");

  const quadroDoInterno = await chamar(sI, "POST", "/api/quadros", { nome: "Quadro particular do interno" });
  const idQuadroInterno = quadroDoInterno.dados?.quadro?.id;
  if (idQuadroInterno) lixo.quadros.push(idQuadroInterno);
  conferir("o interno cria um quadro", quadroDoInterno.status === 201);

  const listaDoCliente = await chamar(sC, "GET", "/api/quadros");
  conferir("a lista de quadros do cliente vem VAZIA",
    listaDoCliente.dados?.quadros?.length === 0, `veio ${listaDoCliente.dados?.quadros?.length}`);

  // O teste que importa: o endereço do quadro alheio, digitado na mão.
  const espiar = await chamar(sC, "GET", `/api/quadros/${idQuadroInterno}`);
  conferir("pedir o quadro alheio pelo ID devolve 404 (e não 403)", espiar.status === 404,
    `status ${espiar.status}`);

  const invadir = await chamar(sC, "PATCH", `/api/quadros/${idQuadroInterno}`, { nome: "invadido" });
  conferir("tentar renomear o quadro alheio não funciona", invadir.status >= 400, `status ${invadir.status}`);

  const entrarSozinho = await chamar(sC, "POST", `/api/quadros/${idQuadroInterno}/membros`,
    { usuarioId: cliente.id, papel: "editor" });
  conferir("o cliente não se põe como membro de um quadro alheio", entrarSozinho.status >= 400,
    `status ${entrarSozinho.status}`);

  const lisa = await chamar(sC, "GET", "/api/lisa");
  conferir("a assistente responde que não pode ser usada",
    lisa.status === 200 ? lisa.dados?.podeUsar === false : lisa.status === 403,
    `status ${lisa.status}`);

  const falarComLisa = await chamar(sC, "POST", "/api/lisa", { mensagens: [{ papel: "usuario", texto: "oi" }] });
  conferir("e conversar com ela é recusado", falarComLisa.status === 403, `status ${falarComLisa.status}`);

  const quadroGen = await chamar(sC, "POST", "/api/quadro-gen", { mensagens: [{ papel: "usuario", texto: "oi" }] });
  conferir("o Quadro Gen também é recusado", quadroGen.status === 403, `status ${quadroGen.status}`);

  const diretorio = await chamar(sC, "GET", "/api/usuarios");
  conferir("a lista de pessoas vem vazia para o cliente",
    diretorio.status === 200 && diretorio.dados?.usuarios?.length === 0 && diretorio.dados?.podeListar === false,
    `${diretorio.dados?.usuarios?.length} pessoa(s)`);

  const tudo = await chamar(sC, "GET", "/api/usuarios?tudo=1");
  conferir("e a lista completa é recusada", tudo.status === 403, `status ${tudo.status}`);

  const painelAdmin = await chamar(sC, "GET", "/api/admin/uso");
  conferir("o painel de administração é recusado", painelAdmin.status === 403, `status ${painelAdmin.status}`);

  const verConvites = await chamar(sC, "GET", "/api/convites");
  conferir("os links de cadastro são recusados", verConvites.status === 403, `status ${verConvites.status}`);

  const criarPessoa = await chamar(sC, "POST", "/api/usuarios", { email: "x@y.z", nome: "x" });
  conferir("criar contas é recusado", criarPessoa.status === 403, `status ${criarPessoa.status}`);

  const virarAdmin = await chamar(sC, "PATCH", `/api/usuarios/${cliente.id}`, { admin: true, lisa: true });
  conferir("promover a si mesmo é recusado", virarAdmin.status === 403, `status ${virarAdmin.status}`);

  // Mesmo pela mão de quem administra, o tipo manda.
  const adminLiberaLisa = await chamar(admin.s, "PATCH", `/api/usuarios/${cliente.id}`, { lisa: true });
  conferir("nem o administrador libera a assistente para um cliente", adminLiberaLisa.status === 400,
    `status ${adminLiberaLisa.status}`);

  // -------------------------------------------------------------- 3. o que ele alcança
  secao("O que a conta de cliente alcança");

  const meuQuadro = await chamar(sC, "POST", "/api/quadros", { nome: "Quadro do cliente 1" });
  const idMeuQuadro = meuQuadro.dados?.quadro?.id;
  if (idMeuQuadro) lixo.quadros.push(idMeuQuadro);
  conferir("o cliente cria o próprio quadro", meuQuadro.status === 201, `status ${meuQuadro.status}`);

  const abrindoOMeu = await chamar(sC, "GET", `/api/quadros/${idMeuQuadro}`);
  conferir("e abre o quadro que criou", abrindoOMeu.status === 200);

  const oInternoEspiando = await chamar(sI, "GET", `/api/quadros/${idMeuQuadro}`);
  conferir("o interno NÃO vê o quadro do cliente sem convite", oInternoEspiando.status === 404,
    `status ${oInternoEspiando.status}`);

  const plano = await chamar(sC, "GET", "/api/conta/plano");
  conferir("o cliente vê o próprio plano", plano.status === 200 && plano.dados?.uso?.tipo === "cliente");
  conferir("com o teto de quadros escrito", plano.dados?.uso?.quadros?.teto === 10,
    String(plano.dados?.uso?.quadros?.teto));
  conferir("e o de armazenamento", plano.dados?.uso?.armazenamento?.teto === 4 * 1024 * 1024 * 1024);

  // -------------------------------------------------------------- 4. o teto de quadros
  secao("O teto de 10 quadros");

  for (let i = 2; i <= 10; i++) {
    const r = await chamar(sC, "POST", "/api/quadros", { nome: `Quadro do cliente ${i}` });
    if (r.dados?.quadro?.id) lixo.quadros.push(r.dados.quadro.id);
    if (r.status !== 201) { conferir(`criou o quadro ${i}`, false, r.dados?.error || r.status); break; }
  }
  const decimo = await chamar(sC, "GET", "/api/conta/plano");
  conferir("chegou a 10 quadros", decimo.dados?.uso?.quadros?.usado === 10,
    String(decimo.dados?.uso?.quadros?.usado));

  const decimoPrimeiro = await chamar(sC, "POST", "/api/quadros", { nome: "O décimo primeiro" });
  if (decimoPrimeiro.dados?.quadro?.id) lixo.quadros.push(decimoPrimeiro.dados.quadro.id);
  conferir("o décimo primeiro é recusado", decimoPrimeiro.status === 403, `status ${decimoPrimeiro.status}`);
  conferir("e a recusa explica o que fazer",
    /limite de 10 quadros/i.test(decimoPrimeiro.dados?.error || "")
    && /arquive|administra/i.test(decimoPrimeiro.dados?.error || ""),
    decimoPrimeiro.dados?.error);

  // O interno, no mesmo instante, passa: o limite é do plano, e não do sistema.
  const internoPassa = await chamar(sI, "POST", "/api/quadros", { nome: "O interno não tem teto" });
  if (internoPassa.dados?.quadro?.id) lixo.quadros.push(internoPassa.dados.quadro.id);
  conferir("a conta interna continua sem teto", internoPassa.status === 201, `status ${internoPassa.status}`);

  // -------------------------------------------------------------- 5. o teto de projetos
  secao("O teto de 10 projetos de documentação");

  for (let i = 1; i <= 10; i++) {
    const r = await chamar(sC, "POST", "/api/projetos", { nome: `Projeto do cliente ${i}` });
    if (r.dados?.projeto?.id) lixo.projetos.push(r.dados.projeto.id);
    if (r.status !== 201) { conferir(`criou o projeto ${i}`, false, r.dados?.error || r.status); break; }
  }
  const decimoPrimeiroProjeto = await chamar(sC, "POST", "/api/projetos", { nome: "O décimo primeiro projeto" });
  if (decimoPrimeiroProjeto.dados?.projeto?.id) lixo.projetos.push(decimoPrimeiroProjeto.dados.projeto.id);
  conferir("o décimo primeiro projeto é recusado", decimoPrimeiroProjeto.status === 403,
    `status ${decimoPrimeiroProjeto.status}`);

  // -------------------------------------------------------------- 5b. o teto de 4 GB
  secao("O teto de 4 GB de arquivos");

  // Não dá para subir 4 GB num teste. O que dá, e é o que importa, é provar que a ROTA de envio
  // passa pela trava: planta-se uma revisão de 4 GB no banco pela chave de serviço e tenta-se
  // subir um arquivo minúsculo em seguida. Se a rota não conferisse, ele entraria.
  const projetosDoCliente = (await chamar(sC, "GET", "/api/projetos")).dados.projetos;
  const projetoCheio = projetosDoCliente[0].id;

  const antes = await chamar(sC, "GET", "/api/conta/plano");
  conferir("o armazenamento começa zerado", antes.dados?.uso?.armazenamento?.usado === 0,
    String(antes.dados?.uso?.armazenamento?.usado));

  const arquivinho = () => {
    const forma = new FormData();
    forma.append("arquivo", new Blob(["um arquivo bem pequeno"], { type: "text/plain" }), "pequeno.txt");
    return forma;
  };
  const enviar = async (sessao, projeto) => {
    const r = await fetch(`${base}/api/projetos/${projeto}/documentos`, {
      method: "POST", headers: { cookie: sessao.cookie }, body: arquivinho(),
    });
    return { status: r.status, dados: await r.json().catch(() => null) };
  };

  const primeiroEnvio = await enviar(sC, projetoCheio);
  conferir("com espaço, o envio passa", primeiroEnvio.status === 201, `status ${primeiroEnvio.status}`);

  const depoisDoEnvio = await chamar(sC, "GET", "/api/conta/plano");
  conferir("e o arquivo aparece na conta do plano",
    (depoisDoEnvio.dados?.uso?.armazenamento?.usado || 0) > 0,
    String(depoisDoEnvio.dados?.uso?.armazenamento?.usado));

  // Agora o projeto "pesa" 4 GB.
  const { data: docFalso } = await sb.from("abacato_documentos")
    .insert({ projeto_id: projetoCheio, nome: "peso de teste" }).select("id").single();
  await sb.from("abacato_revisoes").insert({
    documento_id: docFalso.id, numero: 1, caminho: `teste/${docFalso.id}`, tipo: "application/octet-stream",
    tamanho: 4 * 1024 * 1024 * 1024,
  });

  const cheio = await chamar(sC, "GET", "/api/conta/plano");
  conferir("o plano mostra o armazenamento estourado", cheio.dados?.uso?.armazenamento?.cheio === true,
    emTamanho(cheio.dados?.uso?.armazenamento?.usado || 0));

  const envioBarrado = await enviar(sC, projetoCheio);
  conferir("no teto, a rota de envio recusa", envioBarrado.status === 403, `status ${envioBarrado.status}`);
  conferir("e a recusa diz quanto está sendo usado e quanto cabe",
    /4,00 GB/.test(envioBarrado.dados?.error || ""), envioBarrado.dados?.error);

  // O outro projeto do MESMO dono também trava: o limite é da conta, e não do projeto — senão
  // bastaria criar um projeto novo para ganhar 4 GB de novo.
  const outroProjeto = projetosDoCliente[1].id;
  const envioNoOutro = await enviar(sC, outroProjeto);
  conferir("e o outro projeto do mesmo dono trava junto", envioNoOutro.status === 403,
    `status ${envioNoOutro.status}`);

  // A conta interna, no mesmo instante, sobe.
  const projetoInterno = await chamar(sI, "POST", "/api/projetos", { nome: "Projeto do interno" });
  if (projetoInterno.dados?.projeto?.id) lixo.projetos.push(projetoInterno.dados.projeto.id);
  const envioInterno = await enviar(sI, projetoInterno.dados.projeto.id);
  conferir("a conta interna continua subindo arquivo", envioInterno.status === 201,
    `status ${envioInterno.status}`);

  // -------------------------------------------------------------- 6. compartilhar
  secao("Compartilhar: 3 quadros, 3 pessoas em cada");

  // Três convidados para caber no teto de pessoas por quadro, e um quarto para estourá-lo.
  const convidados = [];
  for (const n of ["c1", "c2", "c3", "c4"]) {
    const u = await criarConta(admin.s, n, "interno");
    lixo.usuarios.push(u.id);
    convidados.push(u);
  }

  const meusQuadros = (await chamar(sC, "GET", "/api/quadros")).dados.quadros;
  const q1 = meusQuadros[0].id, q2 = meusQuadros[1].id, q3 = meusQuadros[2].id, q4 = meusQuadros[3].id;

  for (let i = 0; i < 3; i++) {
    const r = await chamar(sC, "POST", `/api/quadros/${q1}/membros`,
      { usuarioId: convidados[i].id, papel: "leitor" });
    if (r.status !== 201) conferir(`convidou a ${i + 1}ª pessoa`, false, r.dados?.error);
  }
  const quarta = await chamar(sC, "POST", `/api/quadros/${q1}/membros`,
    { usuarioId: convidados[3].id, papel: "leitor" });
  conferir("a 4ª pessoa no mesmo quadro é recusada", quarta.status === 403, `status ${quarta.status}`);
  conferir("e a recusa diz o número", /3 pessoas/.test(quarta.dados?.error || ""), quarta.dados?.error);

  // Mudar o papel de quem JÁ está não é um convite novo — não pode esbarrar no teto.
  const mudarPapel = await chamar(sC, "POST", `/api/quadros/${q1}/membros`,
    { usuarioId: convidados[0].id, papel: "editor" });
  conferir("mudar o papel de quem já está continua funcionando com o quadro cheio",
    mudarPapel.status === 201, `status ${mudarPapel.status}`);

  const seg = await chamar(sC, "POST", `/api/quadros/${q2}/membros`, { usuarioId: convidados[0].id, papel: "leitor" });
  const ter = await chamar(sC, "POST", `/api/quadros/${q3}/membros`, { usuarioId: convidados[0].id, papel: "leitor" });
  conferir("o 2º e o 3º quadro compartilhados passam", seg.status === 201 && ter.status === 201,
    `${seg.status} / ${ter.status}`);

  const quarto = await chamar(sC, "POST", `/api/quadros/${q4}/membros`, { usuarioId: convidados[0].id, papel: "leitor" });
  conferir("o 4º quadro compartilhado é recusado", quarto.status === 403, `status ${quarto.status}`);

  // E o convidado alcança MESMO o quadro em que foi posto — um limite que barra tudo, inclusive
  // o que devia passar, também estaria errado.
  const sConvidado = (await entrar(convidados[0].email, convidados[0].senha, "c1")).s;
  const convidadoAbre = await chamar(sConvidado, "GET", `/api/quadros/${q1}`);
  conferir("quem foi convidado abre o quadro", convidadoAbre.status === 200, `status ${convidadoAbre.status}`);
  const convidadoNoOutro = await chamar(sConvidado, "GET", `/api/quadros/${q4}`);
  conferir("e não abre os outros do mesmo dono", convidadoNoOutro.status === 404,
    `status ${convidadoNoOutro.status}`);

  // -------------------------------------------------------------- 7. o link de cadastro
  secao("O link de cadastro e a aprovação");

  const convite = await chamar(admin.s, "POST", "/api/convites", { rotulo: "teste automático" });
  const token = convite.dados?.convite?.token;
  if (convite.dados?.convite?.id) lixo.convites.push(convite.dados.convite.id);
  conferir("o administrador gera um link", convite.status === 201 && token?.length >= 30,
    `${token?.length} caracteres`);

  // A tela do cadastro é aberta SEM cookie — é o ponto inteiro dela.
  const olhando = await chamar(null, "GET", `/api/cadastro/${token}`);
  conferir("o link abre sem sessão", olhando.status === 200, `status ${olhando.status}`);
  conferir("e já mostra os limites antes de alguém digitar",
    olhando.dados?.plano?.quadros === 10 && olhando.dados?.plano?.armazenamento === 4 * 1024 * 1024 * 1024);

  const inventado = await chamar(null, "GET", "/api/cadastro/" + "z".repeat(52));
  conferir("um token inventado não abre", inventado.status === 404, `status ${inventado.status}`);

  const emailDeFora = `lim-fora-${Date.now().toString(36)}@abacato.teste`;
  const senhaDeFora = sortearSenha();
  const gFora = await guardarSenha(emailDeFora, senhaDeFora);
  const cadastrou = await chamar(null, "POST", `/api/cadastro/${token}`, {
    email: emailDeFora, nome: "Gente de fora",
    hash: gFora.hash, sal: gFora.sal, iteracoes: gFora.iteracoes,
    // O pedido vem da internet aberta e tenta se promover. Os três têm que ser ignorados.
    admin: true, lisa: true, tipo: "interno", aprovado: true,
  });
  conferir("o cadastro de fora é aceito", cadastrou.status === 201, `status ${cadastrou.status}`);

  const { data: deFora } = await sb.from("abacato_usuarios")
    .select("id, tipo, aprovado, admin, lisa").ilike("email", emailDeFora).maybeSingle();
  if (deFora?.id) lixo.usuarios.push(deFora.id);
  conferir("a conta nasce ESPERANDO aprovação", deFora?.aprovado === false);
  conferir("nasce como cliente, não como interno", deFora?.tipo === "cliente", deFora?.tipo);
  conferir("nasce sem administrar", deFora?.admin === false);
  conferir("nasce sem a assistente", deFora?.lisa === false);

  const tentandoEntrar = await entrar(emailDeFora, senhaDeFora, "fora");
  conferir("e NÃO consegue entrar antes da aprovação", tentandoEntrar.status === 403,
    `status ${tentandoEntrar.status}`);
  conferir("a recusa explica que está na fila",
    /aguardando aprova|aprovação/i.test(tentandoEntrar.dados?.error || ""), tentandoEntrar.dados?.error);

  // Com a senha ERRADA, a resposta tem que ser a de senha errada — e não a da fila, que
  // contaria a um estranho que aquele e-mail tem cadastro aqui.
  const chuteNaSenha = await entrar(emailDeFora, "isto-nao-e-a-senha-dela", "chute");
  conferir("com a senha errada, a resposta não entrega que a conta existe",
    chuteNaSenha.status === 401, `status ${chuteNaSenha.status}`);

  const aprovou = await chamar(admin.s, "PATCH", `/api/usuarios/${deFora.id}`, { aprovado: true });
  conferir("o administrador aprova", aprovou.status === 200, `status ${aprovou.status}`);

  const agoraEntra = await entrar(emailDeFora, senhaDeFora, "fora-2");
  conferir("aprovada, a conta entra", agoraEntra.status === 200, `status ${agoraEntra.status}`);

  const semQuadros = await chamar(agoraEntra.s, "GET", "/api/quadros");
  conferir("e mesmo aprovada não alcança nada do que já existia",
    semQuadros.dados?.quadros?.length === 0, `${semQuadros.dados?.quadros?.length} quadro(s)`);

  const recusou = await chamar(admin.s, "PATCH", `/api/usuarios/${deFora.id}`, { aprovado: false });
  conferir("o administrador recusa depois", recusou.status === 200);
  const depoisDeRecusar = await entrar(emailDeFora, senhaDeFora, "fora-3");
  conferir("recusada, a conta não entra mais", depoisDeRecusar.status !== 200,
    `status ${depoisDeRecusar.status}`);

  // Link desligado para de servir na hora.
  await chamar(admin.s, "PATCH", `/api/convites/${convite.dados.convite.id}`, { ativo: false });
  const depoisDeDesligar = await chamar(null, "GET", `/api/cadastro/${token}`);
  conferir("link desligado para de abrir", depoisDeDesligar.status === 404, `status ${depoisDeDesligar.status}`);

  // -------------------------------------------------------------- 8. o diário
  secao("O diário de uso");

  const painel = await chamar(admin.s, "GET", "/api/admin/uso?dias=1");
  conferir("o administrador abre o painel", painel.status === 200, `status ${painel.status}`);
  conferir("o painel conta os quadros criados agora", (painel.dados?.resumo?.quadros || 0) >= 11,
    String(painel.dados?.resumo?.quadros));
  conferir("e lista os quadros com dono e contagem de cards",
    Array.isArray(painel.dados?.quadros) && painel.dados.quadros.some((q) => q.nome === "Quadro do cliente 1"));

  const tipos = (painel.dados?.eventos || []).map((e) => e.tipo);
  conferir("o diário registrou a criação de quadros", tipos.includes("criou_quadro"));
  conferir("o diário registrou quem esbarrou no limite", tipos.includes("bateu_limite"));
  conferir("o diário registrou o pedido de cadastro", tipos.includes("pediu_cadastro"));
  conferir("o diário registrou a aprovação", tipos.includes("aprovou_conta"));

  // O diário não pode virar uma segunda cópia do conteúdo.
  const temConteudo = (painel.dados?.eventos || []).some((e) =>
    JSON.stringify(e.detalhe || {}).length > 400);
  conferir("e nenhum evento carrega conteúdo de verdade dentro", !temConteudo);
} catch (e) {
  conferir(`o teste parou no meio: ${e.message}`, false);
} finally {
  await limpar();
  console.log(`\n(limpeza: ${lixo.usuarios.length} conta(s), ${lixo.quadros.length} quadro(s), ${lixo.projetos.length} projeto(s) e ${lixo.convites.length} convite(s))`);
}

console.log(falhas === 0
  ? `\nTUDO PASSOU — ${passaram} verificações de limite e fronteira.\n`
  : `\n${falhas} FALHA(S) em ${passaram + falhas} verificações — há um limite que não trava.\n`);
process.exit(falhas === 0 ? 0 : 1);
