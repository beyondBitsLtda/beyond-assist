// Contas, papéis e permissões — conferidos por HTTP, contra um Abacato de verdade.
//
// Este é o teste que eu não teria como escrever em memória. Permissão não é uma função pura:
// ela é o cookie, mais o middleware, mais a subida do card até o quadro, mais a linha na tabela
// de membros. Cada peça pode estar certa sozinha e errada em conjunto, e o jeito de descobrir
// é pedir de verdade, com a sessão de outra pessoa, e ver o que volta.
//
// O que ele faz: cria duas contas descartáveis, entra com cada uma, convida uma para um quadro
// e para um projeto de documentação, e tenta fazer o que aquele papel NÃO devia fazer. No fim
// apaga tudo o que criou — as contas, o quadro e o projeto — usando a chave de serviço.
//
// A senha do administrador vem de ~/senha-abacato.txt e não é impressa em lugar nenhum. As
// senhas das contas de teste são sorteadas aqui e morrem com o processo.
//
// Uso:  node scripts/pessoas-check.mjs                                    (dev local)
//       ABACATO_URL=https://abacato.beyond.dev.br node scripts/pessoas-check.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chaveDeLogin, guardarSenha } from "../src/lib/abacatoAuth.js";
import { sortearSenha } from "../src/dominio/papeis.js";

const base = (process.argv[2] || process.env.ABACATO_URL || "http://localhost:3000").replace(/\/$/, "");

const url = process.env.SUPABASE_URL;
const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chaveServico) {
  console.error("faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}
const sb = createClient(url, chaveServico, { auth: { persistSession: false, autoRefreshToken: false } });

// ---------------------------------------------------------------- o administrador

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
if (!emailAdmin || !senhaAdmin) {
  console.error(`${arquivoSenha} não está no formato esperado (e-mail: / senha:).`);
  process.exit(1);
}

// ---------------------------------------------------------------- placar

let falhas = 0;
let passaram = 0;
const conferir = (titulo, ok, detalhe = "") => {
  if (ok) passaram += 1;
  else falhas += 1;
  console.log(`  ${ok ? "ok    " : "FALHOU"}  ${titulo}${detalhe ? `  — ${detalhe}` : ""}`);
};
const secao = (t) => console.log(`\n${t}`);

// ---------------------------------------------------------------- HTTP com sessão

/** Uma sessão é um porta-cookie. Cada pessoa do teste tem a sua, e é isso que torna possível
 *  perguntar "e se fosse o leitor pedindo?" sem trocar nada de lugar. */
function novaSessao(nome) {
  return { nome, cookie: "" };
}

async function chamar(s, metodo, caminho, corpo) {
  const r = await fetch(base + caminho, {
    method: metodo,
    headers: {
      "content-type": "application/json",
      ...(s?.cookie ? { cookie: s.cookie } : {}),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    redirect: "manual",
  });
  const bruto = await r.text();
  let dados = null;
  try { dados = JSON.parse(bruto); } catch { /* HTML de erro, página de login */ }

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

// ---------------------------------------------------------------- o que vamos apagar depois

const lixo = { usuarios: [], quadros: [], projetos: [] };

async function limpar() {
  if (lixo.quadros.length) await sb.from("abacato_quadros").delete().in("id", lixo.quadros);
  if (lixo.projetos.length) await sb.from("abacato_projetos").delete().in("id", lixo.projetos);
  if (lixo.usuarios.length) await sb.from("abacato_usuarios").delete().in("id", lixo.usuarios);
}

// ============================================================================================

console.log(`\nPessoas e permissões do Abacato — ${base}\n`);

try {
  // -------------------------------------------------------------- 1. entrar como administrador
  secao("A porta");

  const semSessao = await chamar(null, "GET", "/api/usuarios");
  conferir("sem cookie, a API devolve 401 (e não a página de login)", semSessao.status === 401,
    `status ${semSessao.status}`);

  const admin = await entrar(emailAdmin, senhaAdmin, "admin");
  conferir("o administrador entra", admin.status === 200 && Boolean(admin.s.cookie), `status ${admin.status}`);
  if (admin.status !== 200) throw new Error("sem o administrador não dá para conferir o resto");
  const idAdmin = admin.dados.usuario.id;

  const souAdmin = await chamar(admin.s, "GET", "/api/usuarios?tudo=1");
  conferir("essa conta administra o Abacato", souAdmin.dados?.souAdmin === true,
    souAdmin.dados?.souAdmin ? "" : "rode o db/007-pessoas.sql");

  // -------------------------------------------------------------- 2. criar contas
  secao("Criar contas");

  const marca = Date.now().toString(36);
  const contas = {};
  for (const quem of ["ana", "bia"]) {
    const email = `check-${quem}-${marca}@abacato.teste`;
    const senha = sortearSenha();
    const guardada = await guardarSenha(email, senha);
    const r = await chamar(admin.s, "POST", "/api/usuarios", {
      email, nome: `Check ${quem} ${marca}`, ...{ hash: guardada.hash, sal: guardada.sal, iteracoes: guardada.iteracoes },
    });
    conferir(`o administrador cria a conta de ${quem}`, r.status === 201, `status ${r.status} ${r.dados?.error || ""}`);
    if (r.status !== 201) throw new Error("sem as contas de teste não dá para seguir");
    contas[quem] = { id: r.dados.usuario.id, email, senha };
    lixo.usuarios.push(r.dados.usuario.id);
  }

  const repetido = await chamar(admin.s, "POST", "/api/usuarios", {
    email: contas.ana.email, nome: "Outra", hash: "x".repeat(43), sal: "y".repeat(22), iteracoes: 210000,
  });
  conferir("o mesmo e-mail duas vezes é recusado (409)", repetido.status === 409, `status ${repetido.status}`);

  const torto = await chamar(admin.s, "POST", "/api/usuarios", {
    email: "isso não é e-mail", nome: "X", hash: "x".repeat(43), sal: "y".repeat(22), iteracoes: 210000,
  });
  conferir("e-mail inválido é recusado (400)", torto.status === 400, `status ${torto.status}`);

  // O número de iterações chega do navegador. Se o servidor aceitasse 1, bastaria um pedido
  // feito à mão para gravar uma senha que se quebra em segundos.
  const fraca = await chamar(admin.s, "POST", "/api/usuarios", {
    email: `fraca-${marca}@abacato.teste`, nome: "X", hash: "x".repeat(43), sal: "y".repeat(22), iteracoes: 1,
  });
  conferir("PBKDF2 com poucas iterações é recusado (400)", fraca.status === 400, `status ${fraca.status}`);

  // -------------------------------------------------------------- 3. entrar como elas
  secao("As contas novas funcionam");

  const ana = await entrar(contas.ana.email, contas.ana.senha, "ana");
  conferir("a senha sorteada entra", ana.status === 200, `status ${ana.status}`);
  const bia = await entrar(contas.bia.email, contas.bia.senha, "bia");
  conferir("a segunda conta também", bia.status === 200, `status ${bia.status}`);
  if (ana.status !== 200 || bia.status !== 200) throw new Error("as contas de teste não entram");

  const senhaErrada = await entrar(contas.ana.email, contas.ana.senha + "x", "ninguem");
  conferir("com a senha errada, não entra", senhaErrada.status === 401, `status ${senhaErrada.status}`);

  // -------------------------------------------------------------- 4. o que a lista de pessoas mostra
  secao("A lista de pessoas");

  const listaDaAna = await chamar(ana.s, "GET", "/api/usuarios");
  conferir("quem não administra vê a lista (precisa dela para convidar)", listaDaAna.status === 200,
    `status ${listaDaAna.status}`);

  const campos = Object.keys(listaDaAna.dados?.usuarios?.[0] || {});
  const vazou = campos.filter((c) => /senha|hash|sal|iter/i.test(c));
  conferir("a lista NÃO traz hash, sal nem iterações", vazou.length === 0, vazou.join(", "));
  conferir("a lista traz só o necessário", campos.sort().join(",") === "ativo,email,id,nome", campos.join(","));

  const tudoDaAna = await chamar(ana.s, "GET", "/api/usuarios?tudo=1");
  conferir("quem não administra não vê o detalhe (403)", tudoDaAna.status === 403, `status ${tudoDaAna.status}`);

  const criarPelaAna = await chamar(ana.s, "POST", "/api/usuarios", {
    email: `pirata-${marca}@abacato.teste`, nome: "Pirata", hash: "x".repeat(43), sal: "y".repeat(22), iteracoes: 210000,
  });
  conferir("quem não administra não cria conta (403)", criarPelaAna.status === 403, `status ${criarPelaAna.status}`);

  const promoverSozinha = await chamar(ana.s, "PATCH", `/api/usuarios/${contas.ana.id}`, { admin: true });
  conferir("ninguém se promove a administrador (403)", promoverSozinha.status === 403,
    `status ${promoverSozinha.status}`);

  // -------------------------------------------------------------- 5. as travas do administrador
  secao("As travas que evitam um Abacato sem dono");

  const meDesligo = await chamar(admin.s, "PATCH", `/api/usuarios/${idAdmin}`, { ativo: false });
  conferir("o administrador não desativa a própria conta (400)", meDesligo.status === 400,
    `status ${meDesligo.status} ${meDesligo.dados?.error || ""}`);

  const { count: quantosAdmins } = await sb
    .from("abacato_usuarios").select("id", { count: "exact", head: true }).eq("admin", true).eq("ativo", true);

  if (quantosAdmins === 1) {
    const meRebaixo = await chamar(admin.s, "PATCH", `/api/usuarios/${idAdmin}`, { admin: false });
    conferir("o último administrador não se rebaixa (400)", meRebaixo.status === 400,
      `status ${meRebaixo.status} ${meRebaixo.dados?.error || ""}`);

    // Rede de segurança: se a trava tiver falhado, o Abacato acabou de ficar sem ninguém que
    // possa criar contas. Devolvo o sinalizador pelo banco antes de continuar.
    const { data: conferindo } = await sb
      .from("abacato_usuarios").select("admin").eq("id", idAdmin).maybeSingle();
    if (!conferindo?.admin) {
      await sb.from("abacato_usuarios").update({ admin: true }).eq("id", idAdmin);
      console.log("        (o sinalizador de administrador foi devolvido pelo banco)");
    }
  } else {
    // Com dois ou mais administradores, rebaixar um é permitido — e testar isso mexeria numa
    // conta de gente de verdade. A trava fica conferida no dia em que sobrar um só.
    conferir("há mais de um administrador — a trava do último não se aplica agora", true,
      `${quantosAdmins} administradores`);
  }

  const promover = await chamar(admin.s, "PATCH", `/api/usuarios/${contas.bia.id}`, { admin: true });
  conferir("o administrador promove outra pessoa", promover.status === 200, `status ${promover.status}`);
  const rebaixar = await chamar(admin.s, "PATCH", `/api/usuarios/${contas.bia.id}`, { admin: false });
  conferir("e rebaixa de volta", rebaixar.status === 200, `status ${rebaixar.status}`);

  // -------------------------------------------------------------- 6. quadro: quem acessa
  secao("Um quadro e quem acessa");

  const quadro = await chamar(admin.s, "POST", "/api/quadros", { nome: `Check permissões ${marca}` });
  conferir("o quadro de teste nasce", quadro.status === 201, `status ${quadro.status}`);
  if (quadro.status !== 201) throw new Error("sem quadro não dá para conferir papéis");
  const quadroId = quadro.dados.quadro.id;
  lixo.quadros.push(quadroId);

  const dentro = await chamar(admin.s, "GET", `/api/quadros/${quadroId}`);
  const colunaId = dentro.dados?.quadro?.colunas?.[0]?.id;
  conferir("o quadro veio com colunas", Boolean(colunaId));

  const membros0 = await chamar(admin.s, "GET", `/api/quadros/${quadroId}/membros`);
  conferir("o dono aparece na lista de quem acessa", membros0.dados?.membros?.[0]?.papel === "dono",
    JSON.stringify(membros0.dados?.membros?.map((m) => m.papel)));

  // Antes do convite: um quadro alheio é 404, e não 403. 403 confirmaria que ele existe.
  const espiar = await chamar(ana.s, "GET", `/api/quadros/${quadroId}`);
  conferir("quadro de outra pessoa é 404, não 403", espiar.status === 404, `status ${espiar.status}`);

  const papelTorto = await chamar(admin.s, "POST", `/api/quadros/${quadroId}/membros`,
    { usuarioId: contas.ana.id, papel: "imperador" });
  conferir("papel inventado é recusado (400)", papelTorto.status === 400, `status ${papelTorto.status}`);

  const convidarDono = await chamar(admin.s, "POST", `/api/quadros/${quadroId}/membros`,
    { usuarioId: idAdmin, papel: "leitor" });
  conferir("o dono não vira leitor do próprio quadro (400)", convidarDono.status === 400,
    `status ${convidarDono.status}`);

  // -------------------------------------------------------------- 7. leitor
  secao("Papel: só leitura");

  const comoLeitor = await chamar(admin.s, "POST", `/api/quadros/${quadroId}/membros`,
    { usuarioId: contas.ana.id, papel: "leitor" });
  conferir("a ana entra como leitora", comoLeitor.status === 201, `status ${comoLeitor.status}`);

  const leituraOk = await chamar(ana.s, "GET", `/api/quadros/${quadroId}`);
  conferir("a leitora agora VÊ o quadro", leituraOk.status === 200, `status ${leituraOk.status}`);
  conferir("e o papel dela chega junto", leituraOk.dados?.papel === "leitor", leituraOk.dados?.papel);
  conferir("os poderes dizem que ela não edita", leituraOk.dados?.poderes?.editar === false,
    JSON.stringify(leituraOk.dados?.poderes));

  const leitorCria = await chamar(ana.s, "POST", `/api/colunas/${colunaId}/cards`, { titulo: "não devia existir" });
  conferir("a leitora NÃO cria card (403)", leitorCria.status === 403, `status ${leitorCria.status}`);

  const leitorRenomeia = await chamar(ana.s, "PATCH", `/api/quadros/${quadroId}`, { nome: "roubado" });
  conferir("a leitora NÃO renomeia o quadro (403)", leitorRenomeia.status === 403, `status ${leitorRenomeia.status}`);

  const leitorConvida = await chamar(ana.s, "POST", `/api/quadros/${quadroId}/membros`,
    { usuarioId: contas.bia.id, papel: "editor" });
  conferir("a leitora NÃO convida ninguém (403)", leitorConvida.status === 403, `status ${leitorConvida.status}`);

  // -------------------------------------------------------------- 8. editor
  secao("Papel: pode editar");

  const viraEditor = await chamar(admin.s, "POST", `/api/quadros/${quadroId}/membros`,
    { usuarioId: contas.ana.id, papel: "editor" });
  conferir("o dono muda o papel dela para editora", viraEditor.status === 201, `status ${viraEditor.status}`);

  const editorCria = await chamar(ana.s, "POST", `/api/colunas/${colunaId}/cards`, { titulo: `card do check ${marca}` });
  conferir("a editora cria card", editorCria.status === 201, `status ${editorCria.status}`);

  const cardId = editorCria.dados?.card?.id;
  if (cardId) {
    const editorEdita = await chamar(ana.s, "PATCH", `/api/cards/${cardId}`, { titulo: "renomeado pela editora" });
    conferir("a editora edita o card", editorEdita.status === 200, `status ${editorEdita.status}`);
  }

  // O que separa editor de dono é justamente isto: quem entra no quadro.
  const editorConvida = await chamar(ana.s, "POST", `/api/quadros/${quadroId}/membros`,
    { usuarioId: contas.bia.id, papel: "leitor" });
  conferir("a editora NÃO convida ninguém (403)", editorConvida.status === 403, `status ${editorConvida.status}`);

  const tirarDono = await chamar(admin.s, "DELETE", `/api/quadros/${quadroId}/membros?usuario=${idAdmin}`);
  conferir("o dono não pode ser removido (400)", tirarDono.status === 400, `status ${tirarDono.status}`);

  const tirarAna = await chamar(admin.s, "DELETE", `/api/quadros/${quadroId}/membros?usuario=${contas.ana.id}`);
  conferir("o dono tira a editora do quadro", tirarAna.status === 200, `status ${tirarAna.status}`);

  const depoisDeSair = await chamar(ana.s, "GET", `/api/quadros/${quadroId}`);
  conferir("tirada do quadro, ela volta a receber 404", depoisDeSair.status === 404, `status ${depoisDeSair.status}`);

  const cardOrfao = cardId ? await chamar(ana.s, "PATCH", `/api/cards/${cardId}`, { titulo: "de novo não" }) : null;
  if (cardOrfao) {
    // O card é neto do quadro. Se a permissão morasse na rota do card, esta é a chamada que
    // passaria — o id continua o mesmo, e só a subida até o quadro sabe que ela saiu.
    conferir("e nem mexe mais num card que ela mesma criou", cardOrfao.status === 404 || cardOrfao.status === 403,
      `status ${cardOrfao.status}`);
  }

  // -------------------------------------------------------------- 9. projeto de documentação
  secao("Um projeto de documentação e quem acessa");

  const projeto = await chamar(admin.s, "POST", "/api/projetos", { nome: `Check documentos ${marca}` });
  conferir("o projeto de teste nasce", projeto.status === 201, `status ${projeto.status}`);
  if (projeto.status === 201) {
    const projetoId = projeto.dados.projeto.id;
    lixo.projetos.push(projetoId);

    const espiarProjeto = await chamar(bia.s, "GET", `/api/projetos/${projetoId}`);
    conferir("projeto alheio é 404", espiarProjeto.status === 404, `status ${espiarProjeto.status}`);

    const leitoraDocs = await chamar(admin.s, "POST", `/api/projetos/${projetoId}/membros`,
      { usuarioId: contas.bia.id, papel: "leitor" });
    conferir("a bia entra no projeto como leitora", leitoraDocs.status === 201, `status ${leitoraDocs.status}`);

    const leProjeto = await chamar(bia.s, "GET", `/api/projetos/${projetoId}`);
    conferir("a leitora VÊ o projeto", leProjeto.status === 200, `status ${leProjeto.status}`);
    conferir("com o papel certo", leProjeto.dados?.papel === "leitor", leProjeto.dados?.papel);

    const leitoraCriaPasta = await chamar(bia.s, "POST", `/api/projetos/${projetoId}/pastas`, { nome: "não devia" });
    conferir("a leitora NÃO cria pasta (403)", leitoraCriaPasta.status === 403, `status ${leitoraCriaPasta.status}`);

    const viraEditoraDocs = await chamar(admin.s, "POST", `/api/projetos/${projetoId}/membros`,
      { usuarioId: contas.bia.id, papel: "editor" });
    conferir("o dono promove a bia a editora do projeto", viraEditoraDocs.status === 201,
      `status ${viraEditoraDocs.status}`);

    const editoraCriaPasta = await chamar(bia.s, "POST", `/api/projetos/${projetoId}/pastas`,
      { nome: `pasta do check ${marca}` });
    conferir("a editora cria pasta", editoraCriaPasta.status === 201, `status ${editoraCriaPasta.status}`);

    const pastaId = editoraCriaPasta.dados?.pasta?.id;
    if (pastaId) {
      const anaNaPasta = await chamar(ana.s, "PATCH", `/api/pastas/${pastaId}`, { nome: "de outro projeto" });
      conferir("quem não é do projeto não mexe na pasta", anaNaPasta.status === 404 || anaNaPasta.status === 403,
        `status ${anaNaPasta.status}`);
    }

    const tirarBia = await chamar(admin.s, "DELETE", `/api/projetos/${projetoId}/membros?usuario=${contas.bia.id}`);
    conferir("o dono tira a bia do projeto", tirarBia.status === 200, `status ${tirarBia.status}`);

    const biaDepois = await chamar(bia.s, "GET", `/api/projetos/${projetoId}`);
    conferir("tirada do projeto, ela volta a receber 404", biaDepois.status === 404, `status ${biaDepois.status}`);

    // Quadro e documentação são listas SEPARADAS de gente. Um convite para o quadro não pode
    // abrir a documentação junto — é a confusão mais fácil de cometer aqui, e a mais cara.
    const anaNoProjeto = await chamar(ana.s, "GET", `/api/projetos/${projetoId}`);
    conferir("acesso a quadro não dá acesso a documentos", anaNoProjeto.status === 404,
      `status ${anaNoProjeto.status}`);
  }

  // -------------------------------------------------------------- 10. conta desativada
  secao("Conta desativada");

  const desativar = await chamar(admin.s, "PATCH", `/api/usuarios/${contas.bia.id}`, { ativo: false });
  conferir("o administrador desativa a conta da bia", desativar.status === 200, `status ${desativar.status}`);

  const biaTentaEntrar = await entrar(contas.bia.email, contas.bia.senha, "bia-fora");
  conferir("conta desativada não entra mais (401)", biaTentaEntrar.status === 401, `status ${biaTentaEntrar.status}`);

  const convidarDesativada = await chamar(admin.s, "POST", `/api/quadros/${quadroId}/membros`,
    { usuarioId: contas.bia.id, papel: "leitor" });
  conferir("conta desativada não é convidada (400)", convidarDesativada.status === 400,
    `status ${convidarDesativada.status} ${convidarDesativada.dados?.error || ""}`);

  // O cookie dela ainda existe e ainda tem assinatura boa — a sessão vale uma semana. O que
  // impede a volta é a conferência no BANCO, não o cookie.
  const cookieVelho = await chamar(bia.s, "GET", "/api/usuarios?tudo=1");
  conferir("o cookie antigo de uma conta desativada não administra nada",
    cookieVelho.status === 401 || cookieVelho.status === 403, `status ${cookieVelho.status}`);

  // -------------------------------------------------------------- 11. a própria senha
  secao("Trocar a própria senha");

  const nova = sortearSenha();
  const guardadaNova = await guardarSenha(contas.ana.email, nova);

  const semAtual = await chamar(ana.s, "PATCH", "/api/conta/senha", {
    hash: guardadaNova.hash, sal: guardadaNova.sal, iteracoes: guardadaNova.iteracoes,
  });
  conferir("trocar a senha sem informar a atual é recusado (400)", semAtual.status === 400,
    `status ${semAtual.status}`);

  const atualErrada = await chamar(ana.s, "PATCH", "/api/conta/senha", {
    chaveAtual: await chaveDeLogin(contas.ana.email, "chute" + marca),
    hash: guardadaNova.hash, sal: guardadaNova.sal, iteracoes: guardadaNova.iteracoes,
  });
  conferir("com a senha atual errada, é recusado (403)", atualErrada.status === 403, `status ${atualErrada.status}`);

  const trocou = await chamar(ana.s, "PATCH", "/api/conta/senha", {
    chaveAtual: await chaveDeLogin(contas.ana.email, contas.ana.senha),
    hash: guardadaNova.hash, sal: guardadaNova.sal, iteracoes: guardadaNova.iteracoes,
  });
  conferir("com a senha atual certa, troca", trocou.status === 200, `status ${trocou.status}`);

  const comNova = await entrar(contas.ana.email, nova, "ana-nova");
  conferir("a senha nova entra", comNova.status === 200, `status ${comNova.status}`);
  const comVelha = await entrar(contas.ana.email, contas.ana.senha, "ana-velha");
  conferir("a senha antiga não entra mais", comVelha.status === 401, `status ${comVelha.status}`);

  // -------------------------------------------------------------- 12. senha nova pelo administrador
  secao("Senha nova dada pelo administrador");

  const sorteada = sortearSenha();
  const guardadaSorteada = await guardarSenha(contas.ana.email, sorteada);
  const reset = await chamar(admin.s, "PATCH", `/api/usuarios/${contas.ana.id}`, {
    hash: guardadaSorteada.hash, sal: guardadaSorteada.sal, iteracoes: guardadaSorteada.iteracoes,
  });
  conferir("o administrador grava uma senha nova", reset.status === 200, `status ${reset.status}`);

  const comSorteada = await entrar(contas.ana.email, sorteada, "ana-reset");
  conferir("a senha sorteada pelo administrador entra", comSorteada.status === 200, `status ${comSorteada.status}`);

  // E o servidor continua sem nunca ter visto senha nenhuma: o que foi pela rede foi hash e sal.
  const { data: linhaAna } = await sb
    .from("abacato_usuarios").select("senha_hash, senha_iter").eq("id", contas.ana.id).maybeSingle();
  conferir("o que está gravado não é a senha", linhaAna?.senha_hash !== sorteada);
  conferir("e foi gravado com as iterações fortes", Number(linhaAna?.senha_iter) >= 100000,
    String(linhaAna?.senha_iter));
} catch (e) {
  conferir(`o teste parou no meio: ${e.message}`, false);
} finally {
  await limpar();
  console.log(`\n(limpeza: ${lixo.usuarios.length} conta(s), ${lixo.quadros.length} quadro(s) e ${lixo.projetos.length} projeto(s) de teste apagados)`);
}

console.log(falhas === 0
  ? `\nTUDO PASSOU — ${passaram} verificações de acesso.\n`
  : `\n${falhas} FALHA(S) em ${passaram + falhas} verificações — há um buraco de permissão.\n`);
process.exit(falhas === 0 ? 0 : 1);
