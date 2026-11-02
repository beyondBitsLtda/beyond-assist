// O MVP da Lisa (01/11/2026): "quando um usuário que não seja eu logar, ele tem acesso a uma versão
// limitada"; "quero a função dela ver a tela, escrever código e ProcessMap já nessa parte do MVP, e
// usar repositório para contexto também". O portão e os papéis são testados em auth-check; aqui, o
// que o USUÁRIO recebe: a conversa sem nada do admin, os repositórios só públicos (com o GitHub
// simulado), a entrevista, a Lisa Task, o limite do dia e as telas que escondem o que é do admin.
//
// Rodar: node --import ./scripts/alias-loader.mjs scripts/mvp-check.mjs

import fs from "node:fs";
import {
  INSTRUCAO_DO_USUARIO, secaoDoPerfil, secaoDasTarefas, pedidoDeTarefa, PERGUNTAS_SOBRE_VOCE, PERGUNTAS_DOS_ESTUDOS,
  perguntasDaEtapa, perfilDaEtapa, etapaQueFalta, respostaAoConvite, pedidoDaSegundaEtapa, PEDIDO_DE_CONSENTIMENTO,
  PEDE_APAGAR_PERFIL, limitesDoDia, LIMITES_PADRAO, mensagemDoLimite, promptDoUsuario,
} from "../src/lib/modoUsuario.js";

let falhas = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const falha = (t, d = "") => { falhas++; console.log(`  FALHA ${t}${d ? ` — ${d}` : ""}`); };
const conferir = (t, cond, d) => (cond ? ok(t) : falha(t, d));
const ler = (c) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

console.log("a conversa do usuário");
{
  conferir("a instrução é de assistente de dev e estudos, sem o admin (Abacato, Sentinela, Delp)", /assistente de desenvolvimento e produtividade/.test(INSTRUCAO_DO_USUARIO) && !/ABACATO|Sentinela|Delp|Beyond Brain/i.test(INSTRUCAO_DO_USUARIO));
  conferir("e diz o que ela faz: tela, código, repositório público, ProcessMap, tarefas", ["captura de tela", "Escreve, revisa", "repositório público", "ProcessMap", "Lisa Task"].every((x) => INSTRUCAO_DO_USUARIO.includes(x)));
  conferir("e o que não tem: dados de outras pessoas, repositórios privados", /dados de outras pessoas/.test(INSTRUCAO_DO_USUARIO) && /repositórios privados/.test(INSTRUCAO_DO_USUARIO));
  const prompt = promptDoUsuario("como faço um hook?", { hoje: "01/11/2026", nota: "há uma captura de tela", conversa: "PESSOA: oi\nLISA: oi!", extra: "\n\nREPOSITÓRIO: x" });
  conferir("o prompt leva a data, a tela, a conversa e o repositório — sem \"contexto recuperado\" da base do admin", /DATA DE HOJE: 01\/11\/2026/.test(prompt) && /CONTEXTO ATIVO: há uma captura/.test(prompt) && /CONVERSA ATÉ AGORA/.test(prompt) && /REPOSITÓRIO: x/.test(prompt) && !/CONTEXTO RECUPERADO/.test(prompt) && /PERGUNTA DA PESSOA:\ncomo faço um hook\?$/.test(prompt));
  const perfil = { nome: "Ana", area: "front-end em React", nivel: "intermediário", objetivos: "aprender testes", preferencias: { resposta: "curtas" } };
  conferir("o perfil entra na instrução", /Chame a pessoa de: Ana/.test(secaoDoPerfil(perfil)) && /React/.test(secaoDoPerfil(perfil)) && /curtas/.test(secaoDoPerfil(perfil)) && secaoDoPerfil(null) === "");
  conferir("as tarefas abertas também (as feitas não)", /Revisar o PR \(prioridade alta\)/.test(secaoDasTarefas([{ titulo: "Revisar o PR", prioridade: "alta", status: "aberta" }, { titulo: "Antiga", status: "feita" }])) && !/Antiga/.test(secaoDasTarefas([{ titulo: "Revisar o PR", status: "aberta" }, { titulo: "Antiga", status: "feita" }])) && secaoDasTarefas([]) === "");

  const rota = ler("src/app/api/ask/route.js");
  const doUsuario = rota.slice(rota.indexOf("function conversaDoUsuario"), rota.indexOf("return new Response(stream, { headers: CABECALHOS_SSE });"));
  conferir("o /api/ask manda o usuário para a conversa dele, antes de qualquer coisa do admin", /if \(sessao\.papel === "usuario"\) return conversaDoUsuario\(/.test(rota) && rota.indexOf("conversaDoUsuario(req, body") < rota.indexOf("delp_consent\") {"));
  conferir("a conversa do usuário não usa a base, o Abacato, a Delp, a persona nem o contexto pessoal do admin", doUsuario.length > 500 && !/retrieve|resolveScope|tratarAcaoNoAbacato|getDelpTasks|withPersona|withContextDocs|contextoDosRepositorios/.test(doUsuario));
  conferir("e conta no limite do dia", /usarDoDia\(req, "pergunta"\)/.test(doUsuario));
}

console.log("a tarefa pedida na conversa");
{
  const casos = {
    "crie uma tarefa: revisar o PR": "Revisar o PR",
    "Lisa, adicione a tarefa estudar React hooks": "Estudar React hooks",
    "nova tarefa: ligar para o cliente": "Ligar para o cliente",
    "me lembra de estudar testes amanhã": "Estudar testes amanhã",
    "anote uma tarefa de mandar o relatório": "Mandar o relatório",
  };
  const certos = Object.entries(casos).filter(([q, t]) => pedidoDeTarefa(q)?.titulo === t);
  conferir("\"crie uma tarefa…\", \"me lembra de…\" viram tarefa", certos.length === Object.keys(casos).length, Object.entries(casos).filter(([q, t]) => pedidoDeTarefa(q)?.titulo !== t).map(([q]) => `${q} → ${JSON.stringify(pedidoDeTarefa(q))}`).join(" | "));
  conferir("\"urgente\" vira prioridade alta (e sai do título)", pedidoDeTarefa("crie uma tarefa urgente: corrigir o login")?.prioridade === "alta" || pedidoDeTarefa("crie uma tarefa: corrigir o login, urgente")?.prioridade === "alta");
  conferir("pergunta sobre tarefa não cria tarefa", ["quais são minhas tarefas?", "como organizar tarefas?", "o que é uma tarefa assíncrona?", "crie um fluxograma de tarefas"].every((q) => pedidoDeTarefa(q) === null));
}

console.log("a entrevista do primeiro acesso, em duas etapas (01/11/2026: \"antes deveriam ter perguntas pessoais, para a Lisa formar a persona do usuário\")");
{
  conferir("etapa 1, sobre você: nome, descrição, jeito, algo importante", PERGUNTAS_SOBRE_VOCE.map((p) => p.campo).join() === "nome,sobre,jeito,importante" && /Me descreva você/.test(PERGUNTAS_SOBRE_VOCE[1].pergunta));
  conferir("etapa 2, estudos e trabalho: as 5 do print (nível, tecnologias, foco, ajuda, tempo)", PERGUNTAS_DOS_ESTUDOS.map((p) => p.campo).join() === "nivel,area,objetivos,ajuda,tempo" && perguntasDaEtapa(2) === PERGUNTAS_DOS_ESTUDOS && perguntasDaEtapa(1) === PERGUNTAS_SOBRE_VOCE);
  conferir("o convite explica as duas etapas, o que é guardado e que não precisa contar nada sensível", /4 perguntas sobre você/.test(PEDIDO_DE_CONSENTIMENTO) && /5 sobre seus estudos/.test(PEDIDO_DE_CONSENTIMENTO) && /apague meu perfil/.test(PEDIDO_DE_CONSENTIMENTO) && /nada sensível/.test(PEDIDO_DE_CONSENTIMENTO));
  const e1 = perfilDaEtapa(1, { nome: "Meu nome é Alice.", sobre: "Sou dev front-end e gosto de games", jeito: "direta, curiosa", importante: "estudo à noite" });
  conferir("as respostas da etapa 1 viram o perfil (\"Meu nome é Alice.\" → Alice)", e1.nome === "Alice" && e1.preferencias.sobre === "Sou dev front-end e gosto de games" && e1.preferencias.etapa === 1);
  const e2 = perfilDaEtapa(2, { nivel: "iniciante", area: "HTML e JavaScript", objetivos: "migração de carreira", ajuda: "explicando do zero", tempo: "5 horas" });
  conferir("e as da etapa 2 (sem mexer no nome)", e2.nivel === "iniciante" && e2.area === "HTML e JavaScript" && e2.preferencias.tempo === "5 horas" && e2.preferencias.etapa === 2 && !("nome" in e2));
  conferir("a etapa que falta: 1 sem perfil, 2 depois da primeira, nenhuma depois das duas", etapaQueFalta(null) === 1 && etapaQueFalta({ nome: "Alice", preferencias: { etapa: 1 } }) === 2 && etapaQueFalta({ preferencias: { etapa: 2 } }) === null);
  conferir("o convite reconhece \"Sim pode perguntar\" (o print), \"bora\", \"claro, manda\"…", ["Sim pode perguntar", "sim", "bora", "claro, manda", "pode sim", "ok vamos lá"].every((x) => respostaAoConvite(x) === "sim"));
  conferir("… e \"agora não\", \"depois\"; outro assunto não é resposta", ["agora não", "depois", "não", "Não, obrigado"].every((x) => respostaAoConvite(x) === "nao") && ["qual a capital da França?", "me ajuda com React"].every((x) => respostaAoConvite(x) === null));
  conferir("o convite da etapa 2 numa sessão seguinte", /^Oi, Alice! Ficaram 5 perguntas/.test(pedidoDaSegundaEtapa("Alice", { depois: true })) && /^Prontinho, Alice!/.test(pedidoDaSegundaEtapa("Alice")));
  const comRetrato = secaoDoPerfil({ nome: "Alice", nivel: "iniciante", preferencias: { retrato: "Alice é iniciante e direta; fale simples.", jeito: "direta" } });
  conferir("o retrato da pessoa vai na instrução da conversa, com o que ela contou", /COMO FALAR COM ELA[\s\S]*Alice é iniciante e direta/.test(comRetrato) && /O jeito dela/.test(comRetrato) && /Nível em programação: iniciante/.test(comRetrato));
  conferir("a conversa não improvisa entrevista", /Não faça entrevistas nem listas de perguntas sobre a pessoa por conta própria/.test(INSTRUCAO_DO_USUARIO));
  conferir("\"apague meu perfil\" é reconhecido", ["apague meu perfil", "Lisa, exclua meus dados", "esqueça meus dados"].every((q) => PEDE_APAGAR_PERFIL.test(q)) && !PEDE_APAGAR_PERFIL.test("apague a nota do fluxo"));
  const banco = ler("src/lib/perfilEtarefas.js");
  conferir("o perfil só é guardado com consentimento, junta as etapas (sem apagar a primeira), e apagar apaga de verdade", /if \(!dados\.consentimento\) throw/.test(banco) && /const prefs = \{ \.\.\.\(atual\?\.preferencias \|\| \{\}\) \};/.test(banco) && /from\("lisa_perfis"\)\.delete\(\)\.eq\("dono_id", dono\)/.test(banco));
  conferir("ao fim de cada etapa, a Lisa reescreve o retrato (sem perder o perfil se o modelo falhar)", /retratoDaPessoa\(perfil\)\.catch\(\(\) => ""\)/.test(ler("src/app/api/perfil/route.js")) && /export async function retratoDaPessoa/.test(ler("src/lib/gemini.js")));
  const pagina = ler("src/app/(panels)/assistant/page.js");
  conferir("a tela convida antes de cada etapa, uma pergunta por vez, e emenda a etapa 2 na 1", /const etapa = etapaQueFalta\(j\.perfil\)/.test(pagina) && /if \(usuarioRef\.current && !alvoDaIde && await entrevistaFazRef\.current\?\.\(q, displayText\)\) return;/.test(pagina) && /consentimento: true, \.\.\.dados, retrato: true/.test(pagina) && /entrevistaRef\.current = \{ estado: "convite", etapa: 2/.test(pagina));
}

console.log("a Lisa Task leve");
{
  const sql = ler("db/mvp_usuarios.sql");
  conferir("a tabela não tem campo de arquivo (\"Sem Hospedagem de Arquivos\")", /create table if not exists public\.lisa_tarefas/.test(sql) && !/arquivo|anexo|url|storage/i.test(sql.slice(sql.indexOf("lisa_tarefas ("), sql.indexOf("lisa_tarefas_dono_idx"))));
  conferir("perfil, tarefas e uso têm dono e RLS; só a service_role conta o uso", /lisa_perfis[\s\S]*dono_id/.test(sql) && /enable row level security/.test(sql) && /revoke all on function public\.lisa_contar_uso\(uuid, text\) from public, anon, authenticated/.test(sql));
  const banco = ler("src/lib/perfilEtarefas.js");
  conferir("toda leitura e escrita de tarefa filtra pelo dono", (banco.match(/from\("lisa_tarefas"\)/g) || []).length === 4 && (banco.match(/\.eq\("dono_id", dono\)/g) || []).length >= 5);
  conferir("a tela existe e o menu mostra para todos", fs.existsSync(new URL("../src/app/(panels)/lisa-task/page.js", import.meta.url)) && /\{ href: "\/lisa-task", rotulo: "Lisa Task"/.test(ler("src/lib/navegacao.js")));
}

console.log("o limite do dia");
{
  conferir("padrões: 50 perguntas, 10 desenhos, 120 comentários de tela, 100 falas", JSON.stringify(LIMITES_PADRAO) === JSON.stringify({ pergunta: 50, desenho: 10, tela: 120, voz: 100 }));
  conferir("as variáveis mudam o limite; valor inválido fica no padrão", limitesDoDia({ LISA_LIMITE_PERGUNTAS: "80", LISA_LIMITE_DESENHOS: "abc", LISA_LIMITE_TELA: "-3" }).pergunta === 80 && limitesDoDia({ LISA_LIMITE_DESENHOS: "abc" }).desenho === 10 && limitesDoDia({ LISA_LIMITE_TELA: "-3" }).tela === 120);
  conferir("a mensagem diz o limite e quando volta", /50 perguntas por dia\)\. Amanhã libera de novo\./.test(mensagemDoLimite("pergunta", 50)));
  const uso = ler("src/lib/usoDoDia.js");
  conferir("admin não conta; banco fora do ar não barra (o limite protege a cota, não a porta)", /if \(papel !== "usuario" \|\| !dono\) return null;/.test(uso) && /if \(error\) \{ console\.warn/.test(uso));
  conferir("conta na voz, no desenho, nos .md e no Modo Tela", [["src/app/api/speak/route.js", "voz"], ["src/app/api/diagrama/route.js", "desenho"], ["src/app/api/processmap/documento/route.js", "desenho"], ["src/app/api/screen-comment/route.js", "tela"]].every(([f, t]) => ler(f).includes(`usarDoDia(req, "${t}")`)));
}

console.log("o Modo Tela e os repositórios do usuário");
{
  const tela = ler("src/app/api/screen-comment/route.js");
  conferir("Modo Tela: sem a persona do admin e sem gravar no histórico do Vigia", /withPersona\(SCREEN_WATCH_INSTRUCTION \+ focusBlock, personaMode && !usuario\)/.test(tela) && /if \(persist && comment && !usuario\) await logScreenObservation/.test(tela));
  conferir("a leitura de repositórios do usuário é só pública", /soPublicos: ehUsuario\(req\)/.test(ler("src/app/api/repos/contexto/route.js")));

  // o GitHub simulado: um público, um privado; o token do admin existe no ambiente
  process.env.GITHUB_TOKEN = "TOKEN-DO-ADMIN";
  const chamadas = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    chamadas.push({ url: u, comToken: Boolean(init.headers?.authorization) });
    const resposta = (status, corpo) => ({ ok: status < 400, status, json: async () => corpo });
    const temToken = Boolean(init.headers?.authorization);
    if (u.endsWith("/repos/ana/publico")) return resposta(200, { full_name: "ana/publico", default_branch: "main", private: false });
    if (u.endsWith("/repos/admin/privado")) return temToken ? resposta(200, { full_name: "admin/privado", default_branch: "main", private: true }) : resposta(404, {});
    if (u.includes("/git/trees/")) return resposta(200, { tree: [{ type: "blob", path: "src/app.js", sha: u.includes("privado") ? "sha-priv" : "sha-pub", size: 10 }] });
    return resposta(404, {});
  };
  const { lerRepositorioVinculado } = await import("../src/lib/repositorioNaConversa.js");
  const publico = await lerRepositorioVinculado({ repo: "ana/publico" }, { soPublicos: true });
  conferir("o usuário lê um repositório público, sem o token do admin", publico.repo === "ana/publico" && chamadas.every((c) => !c.comToken));
  let erro = "";
  try { await lerRepositorioVinculado({ repo: "admin/privado" }, { soPublicos: true }); } catch (e) { erro = e.message; }
  conferir("o privado do admin não abre para o usuário (sem o token, o GitHub nem mostra)", /só leio repositórios públicos/.test(erro), erro);
  // o admin lê o privado (com o token) — e a árvore fica no cache do Worker
  const doAdmin = await lerRepositorioVinculado({ repo: "admin/privado" });
  conferir("o admin continua lendo o privado com o token", doAdmin.privado === true && chamadas.some((c) => c.url.endsWith("/repos/admin/privado") && c.comToken));
  erro = "";
  try { await lerRepositorioVinculado({ repo: "admin/privado" }, { soPublicos: true }); } catch (e) { erro = e.message; }
  conferir("e o usuário NÃO pega o privado pelo cache que o admin deixou", /é privado — nesta versão da Lisa eu só leio repositórios públicos/.test(erro), erro);
}

console.log("a tela do usuário");
{
  const pagina = ler("src/app/(panels)/assistant/page.js");
  conferir("os modos do admin somem e ficam desligados para o usuário", (pagina.match(/\{!usuario && \(<>/g) || []).length >= 10 && /setCodeMode\(false\); setObservanceMode\(false\); setVigiaMode\(false\)/.test(pagina));
  conferir("o Modo Tela, a conversa livre e a palavra \"Lisa\" continuam para ele", /ligado=\{screenMode\}/.test(pagina) && /ligado=\{conversaAberta\}/.test(pagina) && /ligado=\{escutaPalavra\}/.test(pagina));
  conferir("os outros painéis do celular só mostram o que ele abre", /\.filter\(\(item\) => podeAcessar\(papel \|\| "usuario", item\.href\)\)/.test(pagina));
  conferir("o menu do topo mostra só os painéis do papel; os avisos e comandos remotos são do admin", /gruposDoPapel\(papel\)/.test(ler("src/components/shell/Topbar.js")) && /const doAdmin = papel === "admin" &&/.test(ler("src/components/shell/Shell.js")));
}

console.log("a conta: sair e ver as informações (01/11/2026: \"faltou um botão de sair da Lisa e ver as informações da conta\")");
{
  const { POST: sair } = await import("../src/app/api/auth/logout/route.js");
  const req = new Request("http://local/api/auth/logout", { method: "POST" });
  req.cookies = { get: () => undefined };
  const res = await sair(req);
  const cookies = res.headers.getSetCookie();
  conferir("sair apaga a sessão, a renovação e o papel", res.status === 200 && ["lisa_sessao=;", "lisa_renova=;", "lisa_papel=;"].every((c) => cookies.some((x) => x.startsWith(c) && /Max-Age=0/.test(x))), cookies.join(" | "));
  conferir("e encerra a sessão no Supabase (melhor esforço, sem travar quem quer sair)", /\/auth\/v1\/logout/.test(ler("src/app/api/auth/logout/route.js")) && /AbortSignal\.timeout\(4000\)/.test(ler("src/app/api/auth/logout/route.js")));
  const { GET: eu } = await import("../src/app/api/auth/eu/route.js");
  const semSessao = new Request("http://local/api/auth/eu");
  semSessao.cookies = { get: () => undefined };
  const j = await (await eu(semSessao)).json();
  conferir("sem sessão, a conta diz \"não logado\"", j.ok === true && j.logado === false && j.papel === null);
  conferir("logado, a conta traz o e-mail, o acesso e (usuário) o uso de hoje", /email: String\(r\.payload\.email/.test(ler("src/app/api/auth/eu/route.js")) && /uso: papel === "usuario"/.test(ler("src/app/api/auth/eu/route.js")));
  conferir("o menu Conta está no topo, e no celular nas configurações do Assistente", /<MenuDaConta \/>/.test(ler("src/components/shell/Topbar.js")) && /<ContaNoCelular \/>/.test(ler("src/app/(panels)/assistant/page.js")));
  const menu = ler("src/components/shell/MenuDaConta.js");
  conferir("o menu tem Sair, o tipo de acesso e, para o usuário, o uso e apagar o perfil (com confirmação)", /Sair da Lisa/.test(menu) && /Usuário · versão MVP/.test(menu) && /Uso de hoje/.test(menu) && /Confirmar: apagar meu perfil/.test(menu) && /window\.location\.href = "\/login"/.test(menu));
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
