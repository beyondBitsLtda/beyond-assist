/* =============================================================================
   scan.js - Varredura e classificacao de arquivos de uma aplicacao Fluig DELP
   -----------------------------------------------------------------------------
   Objetivo: dado o caminho da pasta raiz, percorrer recursivamente e classificar
   cada arquivo em um TIPO logico do dominio Fluig/DELP. Funciona tanto na
   estrutura canonica (datasets/, forms/, wcm/widget/.../resources/js|css,
   workflow/diagrams|scripts|literals, sql/) quanto numa pasta "plana" (dump).

   A classificacao usa nome + extensao e, para .js ambiguos, faz "sniffing" do
   conteudo (createDataset -> dataset server; displayFields -> formulario; etc).

   Nao interpreta o conteudo semantico aqui - so descobre O QUE cada arquivo e.
   A extracao de metadados vive em parse.js.
============================================================================= */
'use strict';

var fs = require('fs');
var fsp = fs.promises;
var path = require('path');

/* Quantas leituras simultaneas. Em pasta de rede (Z:), o custo e a latencia por
   arquivo, nao a banda: ler 24 de cada vez derruba a varredura de minutos para
   segundos. Em disco local nao atrapalha. */
var CONCORRENCIA = 24;

/* Pastas e arquivos que nunca entram na documentacao (apenas inventario). */
var IGNORAR_DIR = ['.git', 'node_modules', '.settings', 'META-INF', 'WEB-INF', 'target'];
var IGNORAR_ARQ = ['.jsdtscope', '.ws.cache.bkp', 'org.eclipse.core.resources.prefs',
    'Thumbs.db', '.DS_Store'];

/* Tipos logicos reconhecidos. */
var TIPO = {
    APP_INFO: 'app_info',
    ECLIPSE_PROJECT: 'eclipse_project',
    FILETREE: 'filetree',
    README: 'readme',
    DATASET_SERVER: 'dataset_server',
    DATASET_CLIENT: 'dataset_client',
    FORM_HTML: 'form_html',
    FORM_JS: 'form_js',
    FORM_EVENT_JS: 'form_event_js',
    FORM_AUX_JS: 'form_aux_js',
    FTL: 'ftl',
    CSS: 'css',
    WIDGET_JS: 'widget_js',
    WORKFLOW_SCRIPT: 'workflow_script',
    WORKFLOW_PROCESS: 'workflow_process',
    WORKFLOW_PROCESS_SVG: 'workflow_process_svg',
    WORKFLOW_PROCESS_XML: 'workflow_process_xml',
    SQL: 'sql',
    PROPERTIES: 'properties',
    IMAGE: 'image',
    OUTRO: 'outro'
};

/* Eventos de FORMULARIO do Fluig (executam no cartao, nao no processo).
   Sem esta lista, "beforeSendValidate.js" cai na regra de workflow e um
   formulario passa a ser documentado como se fosse um processo. */
var EVENTOS_FORM = {
    displayfields: 1, setenable: 1, enablefields: 1, inputfields: 1, validateform: 1,
    beforesendvalidate: 1, documentready: 1, setinformation: 1, oncreate: 1,
    beforeprocessing: 1, afterprocessing: 1, aftersavenew: 1, beforesavenew: 1
};

/* Eventos de PROCESSO (workflow), executam no servidor entre atividades. */
function ehEventoWorkflow(base) {
    return /(before|after)[a-z]*\.js$/i.test(base) ||
        /_?(before|after)[a-z]*task[a-z]*\.js$/i.test(base) ||
        /_?servicetask\d+\.js$/i.test(base) ||
        /\.servicetask\d+\.js$/i.test(base) ||
        /_?(beforetasksave|aftertasksave|beforetaskcomplete|aftertaskcomplete|beforestateentry|afterstateentry|beforeprocesscreate|afterprocesscreate|afterprocessfinish|beforemovementry)\.js$/i.test(base);
}

/* Sniffing de conteudo para .js ambiguos. */
function classificarJs(nome, conteudo) {
    var base = nome.toLowerCase();

    /* Scripts de workflow: beforeTaskSave / servicetaskN / afterProcessCreate...
       No repositorio real vem como "x.beforeTaskSave.js"; no dump como
       "x_beforeTaskSave.js". */
    if (ehEventoWorkflow(base)) return TIPO.WORKFLOW_SCRIPT;

    /* Dataset server-side custom: assinatura obrigatoria createDataset(...). */
    if (/function\s+createDataset\s*\(/.test(conteudo)) return TIPO.DATASET_SERVER;

    /* Formulario: displayFields e a funcao que o Fluig chama ao abrir o cartao. */
    if (/function\s+displayFields\s*\(/.test(conteudo)) return TIPO.FORM_JS;

    /* Recursos de widget conhecidos por nome. */
    if (/^(objects|componentes|controller|main\.function|excelhelper|patch|permissoes)\.js$/i.test(base)) return TIPO.WIDGET_JS;
    if (/^integre/i.test(base)) return TIPO.WIDGET_JS;
    if (/(chart\.umd\.min|exceljs\.min|jquery|bootstrap)\.js$/i.test(base)) return TIPO.WIDGET_JS; /* libs */

    /* ds* dentro do widget (wrapper client-side do DatasetFactory). */
    if (/^ds/i.test(base)) {
        /* se nao tem createDataset, tratamos como wrapper client-side. */
        return TIPO.DATASET_CLIENT;
    }

    return TIPO.WIDGET_JS;
}

/* A PASTA manda no significado do arquivo.
   Um "utils.js" dentro de forms/ e um script do cartao; o mesmo nome dentro de
   wcm/widget/ e um modulo da widget. Classificar so por nome/conteudo fazia
   todo formulario ser documentado com as camadas de uma widget. */
function classificarPorContexto(nome, relPath, ctx, conteudo, formCtx) {
    var base = nome.toLowerCase();
    var ext = path.extname(base);

    /* ---------------------------------------------------------- formularios */
    if (ctx === 'forms') {
        if (ext === '.html' || ext === '.htm') return TIPO.FORM_HTML;
        if (ext !== '.js') return null;                     /* css/imagem seguem o fluxo normal */
        if (/function\s+createDataset\s*\(/.test(conteudo)) return TIPO.DATASET_SERVER;

        var semExt = base.replace(/\.js$/, '');
        var emEvents = /\/events\//i.test('/' + String(relPath).replace(/\\/g, '/'));
        if (emEvents || EVENTOS_FORM[semExt]) return TIPO.FORM_EVENT_JS;
        if (/function\s+displayFields\s*\(/.test(conteudo)) return TIPO.FORM_EVENT_JS;
        /* o .js homonimo do .html e o script principal do cartao */
        if (formCtx && formCtx.htmlBases && formCtx.htmlBases[semExt]) return TIPO.FORM_JS;
        return TIPO.FORM_AUX_JS;
    }

    /* ------------------------------------------------------------ datasets */
    if (ctx === 'datasets' && ext === '.js') return TIPO.DATASET_SERVER;

    /* ------------------------------------------------------------ workflow */
    if (ctx === 'workflow/scripts' && ext === '.js') return TIPO.WORKFLOW_SCRIPT;

    return null;
}

function classificar(nome, relPath, conteudoGetter, ctx, formCtx) {
    var lower = nome.toLowerCase();
    var ext = path.extname(lower);

    if (lower === 'application.info' || lower === 'application.info.txt') return TIPO.APP_INFO;
    if (lower === '.project' || lower === '_project') return TIPO.ECLIPSE_PROJECT;
    if (lower === 'estrutura.md') return TIPO.FILETREE;
    if (lower === 'readme.md') return TIPO.README;

    /* o caminho decide antes de qualquer heuristica de nome/conteudo */
    var porCtx = classificarPorContexto(nome, relPath, ctx, conteudoGetter(), formCtx);
    if (porCtx) return porCtx;

    if (/\.processimage\.svg$/i.test(lower)) return TIPO.WORKFLOW_PROCESS_SVG;
    if (/\.ecm30\.xml$/i.test(lower)) return TIPO.WORKFLOW_PROCESS_XML;
    if (ext === '.process') return TIPO.WORKFLOW_PROCESS;

    if (ext === '.sql') return TIPO.SQL;
    if (ext === '.ftl' || lower.endsWith('ftl.txt')) return TIPO.FTL;
    if (ext === '.css') return TIPO.CSS;
    if (ext === '.properties') return TIPO.PROPERTIES;
    if (ext === '.html' || ext === '.htm') return TIPO.FORM_HTML;
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif' || ext === '.svg') return TIPO.IMAGE;

    if (ext === '.js') return classificarJs(nome, conteudoGetter());

    /* .md soltos, .txt, .xml genericos, .metadata etc. */
    if (ext === '.md') return TIPO.README;
    return TIPO.OUTRO;
}

/* Deriva o "modulo canonico" a partir do caminho relativo, quando existir.
   O caminho e normalizado com barra inicial: sem isso, "workflow/scripts/x.js"
   na raiz do projeto nao casava com "/workflow/scripts/" e caia em 'raiz'. */
function contexto(relPath) {
    var p = '/' + String(relPath).replace(/\\/g, '/').toLowerCase().replace(/^\/+/, '');
    if (p.indexOf('/datasets/') >= 0) return 'datasets';
    if (p.indexOf('/forms/') >= 0) return 'forms';
    if (p.indexOf('/workflow/scripts/') >= 0) return 'workflow/scripts';
    if (p.indexOf('/workflow/diagrams/') >= 0) return 'workflow/diagrams';
    if (p.indexOf('/workflow/literals/') >= 0) return 'workflow/literals';
    if (p.indexOf('/workflow/.resources/') >= 0 || p.indexOf('/workflow/resources/') >= 0) return 'workflow/resources';
    if (p.indexOf('/resources/js/') >= 0) return 'wcm/resources/js';
    if (p.indexOf('/resources/css/') >= 0) return 'wcm/resources/css';
    if (p.indexOf('/resources/') >= 0) return 'wcm/resources';
    if (p.indexOf('/sql/') >= 0) return 'sql';
    return 'raiz';
}

/* Extensoes que nunca precisam ser lidas (nao vao para a biblioteca nem para o
   grafo). Poupa leitura de binario grande. */
function ehBinario(nome) {
    return /\.(png|jpe?g|gif|bmp|ico|webp|pdf|zip|jar|war|xls[xm]?|docx?|pptx?|exe|dll|ttf|woff2?|eot)$/i.test(nome);
}

/* Varredura em duas fases:
     1. lista os arquivos (so readdir, sem ler nem stat)
     2. le tudo EM PARALELO e so entao classifica
   A classificacao de .js depende do conteudo; fazer isso durante a caminhada
   forcava uma leitura sequencial por arquivo. */
async function scan(root) {
    var stats;
    try { stats = await fsp.stat(root); } catch (e) {
        throw new Error('Caminho nao encontrado: ' + root);
    }
    if (!stats.isDirectory()) throw new Error('O caminho informado nao e uma pasta: ' + root);

    var falhasLeitura = [];
    var brutos = listar(root, falhasLeitura);
    var falhasArquivo = await preencher(brutos);

    /* pre-passo: quais nomes-base tem um .html dentro de cada pasta de
       formulario. E o que distingue o script principal do cartao dos
       auxiliares (utils.js, selectZoom.js, tabelaDespesas.js...). */
    var htmlBases = {};
    brutos.forEach(function (b) {
        if (!/\.html?$/i.test(b.nome)) return;
        var r = path.relative(root, b.path);
        if (contexto(r) !== 'forms') return;
        htmlBases[b.nome.toLowerCase().replace(/\.html?$/, '')] = 1;
    });
    var formCtx = { htmlBases: htmlBases };

    var lista = brutos.map(function (b) {
        var rel = path.relative(root, b.path);
        var ctx = contexto(rel);
        var tipo = classificar(b.nome, rel, function () { return b.conteudo || ''; }, ctx, formCtx);
        return {
            nome: b.nome,
            path: b.path,
            rel: rel,
            ext: path.extname(b.nome).toLowerCase(),
            tipo: tipo,
            contexto: ctx,
            tamanho: b.tamanho,
            lerConteudo: function () { return b.conteudo || ''; }
        };
    });
    lista.falhas = falhasLeitura.concat(falhasArquivo);
    return lista;
}

/* Fase 1: caminha a arvore e devolve os caminhos, sem tocar no conteudo.
   Em pasta de rede (Z:) um readdir falha de vez em quando. Engolir esse erro
   fazia a pasta inteira desaparecer da documentacao sem uma linha de aviso —
   duas execucoes seguidas produziam portais diferentes. Aqui a leitura e
   tentada de novo e, se ainda falhar, o erro sobe para os avisos do portal. */
function listar(root, falhas) {
    var out = [];
    function ler(dir) {
        try { return fs.readdirSync(dir, { withFileTypes: true }); }
        catch (e1) {
            try { return fs.readdirSync(dir, { withFileTypes: true }); }
            catch (e2) {
                falhas.push({ dir: dir, erro: (e2 && e2.message) ? e2.message : String(e2) });
                return null;
            }
        }
    }
    function walk(dir) {
        var entradas = ler(dir);
        if (!entradas) return;
        for (var i = 0; i < entradas.length; i++) {
            var ent = entradas[i];
            var full = path.join(dir, ent.name);

            /* Em compartilhamento de rede o tipo da entrada vem como UNKNOWN:
               nem isDirectory() nem isFile() respondem true. Descartar essas
               entradas fazia arquivos desaparecerem da documentacao sem aviso
               (e duas execucoes da mesma pasta darem resultados diferentes).
               Quando o tipo e desconhecido, perguntamos ao stat. */
            var ehDir = ent.isDirectory();
            var ehArq = ent.isFile();
            if (!ehDir && !ehArq) {
                try {
                    var st = fs.statSync(full);
                    ehDir = st.isDirectory();
                    ehArq = st.isFile();
                } catch (e) {
                    falhas.push({ dir: full, erro: 'tipo de entrada indeterminado no diretorio' });
                    continue;
                }
            }

            if (ehDir) {
                if (IGNORAR_DIR.indexOf(ent.name) >= 0) continue;
                walk(full);
                continue;
            }
            if (!ehArq) continue;
            if (IGNORAR_ARQ.indexOf(ent.name) >= 0) continue;

            out.push({ nome: ent.name, path: full, conteudo: '', tamanho: 0, binario: ehBinario(ent.name) });
        }
    }
    walk(root);
    return out;
}

/* Fase 2: le tudo em paralelo. Binarios levam so um stat (para o inventario). */
async function preencher(brutos) {
    var i = 0;
    var falhas = [];
    async function operario() {
        while (i < brutos.length) {
            var b = brutos[i++];
            if (b.binario) {
                try { b.tamanho = (await fsp.stat(b.path)).size; } catch (e) { b.tamanho = 0; }
                continue;
            }
            /* mesma logica do readdir: uma segunda tentativa antes de desistir,
               e o que sobrar vira aviso em vez de arquivo vazio silencioso */
            var buf = null, erro = null;
            for (var t = 0; t < 2 && !buf; t++) {
                try { buf = await fsp.readFile(b.path); }
                catch (e) { erro = e; }
            }
            if (buf) { b.tamanho = buf.length; b.conteudo = buf.toString('utf8'); }
            else {
                b.conteudo = ''; b.tamanho = 0;
                falhas.push({ dir: b.path, erro: (erro && erro.message) ? erro.message : String(erro) });
            }
        }
    }
    var equipe = [];
    for (var k = 0; k < Math.min(CONCORRENCIA, brutos.length); k++) equipe.push(operario());
    await Promise.all(equipe);
    return falhas;
}

module.exports = { scan: scan, TIPO: TIPO };
