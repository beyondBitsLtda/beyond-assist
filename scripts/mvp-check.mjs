// O MVP da Lisa (01/11/2026): "quando um usuário que não seja eu logar, ele tem acesso a uma versão
// limitada"; "quero a função dela ver a tela, escrever código e ProcessMap já nessa parte do MVP, e
// usar repositório para contexto também". O portão e os papéis são testados em auth-check; aqui, o
// que o USUÁRIO recebe: a conversa sem nada do admin, os repositórios só públicos (com o GitHub
// simulado), a entrevista, a Lisa Task, o limite do dia e as telas que escondem o que é do admin.
//
// Rodar: node --import ./scripts/alias-loader.mjs scripts/mvp-check.mjs

import fs from "node:fs";
import {
  INSTRUCAO_DO_USUARIO, secaoDoPerfil, secaoDasTarefas, pedidoDeTarefa, PERGUNTAS_DA_ENTREVISTA,
  perfilDasRespostas, PEDE_APAGAR_PERFIL, limitesDoDia, LIMITES_PADRAO, mensagemDoLimite, promptDoUsuario,
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

console.log("a entrevista do primeiro acesso");
{
  conferir("5 perguntas, uma por campo", PERGUNTAS_DA_ENTREVISTA.length === 5 && PERGUNTAS_DA_ENTREVISTA.map((p) => p.campo).join() === "nome,area,nivel,objetivos,resposta");
  const p = perfilDasRespostas({ nome: "pode me chamar de Ana", area: "dados em Python", nivel: "começando", objetivos: "aprender pandas", resposta: "explicadas" });
  conferir("as respostas viram o perfil (\"pode me chamar de Ana\" → Ana)", p.nome === "Ana" && p.area === "dados em Python" && p.preferencias.resposta === "explicadas");
  conferir("\"apague meu perfil\" é reconhecido", ["apague meu perfil", "Lisa, exclua meus dados", "esqueça meus dados"].every((q) => PEDE_APAGAR_PERFIL.test(q)) && !PEDE_APAGAR_PERFIL.test("apague a nota do fluxo"));
  const banco = ler("src/lib/perfilEtarefas.js");
  conferir("o perfil só é guardado com consentimento, e apagar apaga de verdade", /if \(!dados\.consentimento\) throw/.test(banco) && /from\("lisa_perfis"\)\.delete\(\)\.eq\("dono_id", dono\)/.test(banco));
  const pagina = ler("src/app/(panels)/assistant/page.js");
  conferir("a tela pede o consentimento antes e faz as perguntas uma por vez", /setAnswer\(PEDIDO_DE_CONSENTIMENTO\)/.test(pagina) && /if \(usuarioRef\.current && !alvoDaIde && await entrevistaFazRef\.current\?\.\(q, displayText\)\) return;/.test(pagina) && /consentimento: true, \.\.\.perfil/.test(pagina));
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

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTUDO PASSOU\n");
process.exit(falhas ? 1 : 0);
