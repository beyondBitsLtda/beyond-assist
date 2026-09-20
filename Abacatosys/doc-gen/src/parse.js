/* =============================================================================
   parse.js - Extratores de metadados por tipo de arquivo Fluig/DELP
   -----------------------------------------------------------------------------
   Cada funcao recebe o conteudo (string) e devolve um objeto estruturado.
   Regras de projeto (importantes para rastreabilidade/auditoria):
     - Toda extracao de tabela/coluna/relacao marca a ORIGEM (declarado no SQL
       vs inferido do codigo). "Dado sem fonte nao e dado."
     - Nada e inventado: se o parser nao acha, o campo fica vazio, nunca chutado.
============================================================================= */
'use strict';

/* ------------------------------------------------------------------ helpers */

/* Extrai o bloco de comentario /* ... *​/ do TOPO do arquivo.
   "Do topo" e literal: so vale se antes dele houver apenas espaco em branco ou
   comentarios de linha. Aceitar o primeiro /* de qualquer lugar fazia um trecho
   de codigo comentado no meio do arquivo virar a "descricao" do modulo — a doc
   saia com frases como "} else {" no lugar do proposito do arquivo. */
function cabecalho(conteudo) {
    var i = conteudo.indexOf('/*');
    if (i < 0) return '';
    var antes = conteudo.slice(0, i)
        .replace(/^[ \t]*\/\/[^\n]*$/gm, '')   /* comentarios de linha nao contam */
        .replace(/^#![^\n]*/, '')              /* shebang */
        .replace(/['"]use strict['"];?/, '');
    if (/\S/.test(antes)) return '';
    var fim = conteudo.indexOf('*/', i);
    return fim < 0 ? '' : conteudo.slice(i, fim + 2);
}

/* Uma linha de comentario que "parece codigo" nao descreve nada. */
function pareceCodigo(l) {
    if (/[{}();]\s*$/.test(l)) return true;
    if (/\b(function|return|var |let |const |if\s*\(|else|for\s*\(|while\s*\(|await |typeof )/.test(l)) return true;
    if (/[=!<>]=|=>|\+\+|&&|\|\|/.test(l)) return true;
    if (/^[.\[\]{}()<>=+*\/\\|&%$#@!?,:;'"`-]/.test(l)) return true;
    return false;
}

/* Historico de versao a partir de linhas "vX.Y - data - nota" no cabecalho. */
function versoes(conteudo) {
    var head = cabecalho(conteudo);
    var out = [];
    var re = /v(\d+(?:\.\d+)*)\s*[-–]\s*([0-9]{2}\/[0-9]{2}\/[0-9]{2,4})?\s*[-–]?\s*(.*)/g;
    var linhas = head.split(/\r?\n/);
    for (var i = 0; i < linhas.length; i++) {
        var l = linhas[i].replace(/^\s*\*?\s?/, '');
        var m = l.match(/^v(\d+(?:\.\d+)*)\s*[-–]\s*(?:([0-9]{2}\/[0-9]{2}\/[0-9]{2,4})\s*[-–]\s*)?(.+)$/);
        if (m) out.push({ versao: m[1], data: m[2] || '', nota: (m[3] || '').trim() });
    }
    return out;
}

/* Primeira frase util do cabecalho como descricao curta. */
function descricao(conteudo) {
    var head = cabecalho(conteudo);
    var linhas = head.split(/\r?\n/);
    for (var i = 0; i < linhas.length; i++) {
        var l = linhas[i].replace(/^[\s*\/=\-]+/, '').replace(/[\s*=\-]+$/, '').trim();
        if (!l) continue;
        /* pula a linha que e so o nome do arquivo */
        if (/\.(js|ftl|css|sql|process)\b/i.test(l) && l.split(/\s+/).length <= 2) continue;
        if (l.length < 8) continue;
        if (pareceCodigo(l)) continue;
        return l;
    }
    return '';
}

function unico(arr) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) {
        var k = String(arr[i]);
        if (!seen[k]) { seen[k] = 1; out.push(arr[i]); }
    }
    return out;
}

/* ------------------------------------------------------- nome qualificado
   Uma aplicacao Fluig da DELP quase nunca fala com um banco so: as tabelas
   proprias ficam no FLUIG e as de ERP no CORPORE, na mesma consulta. O nome
   qualificado (BANCO.esquema.objeto) e a unica coisa no codigo que diz em qual
   banco cada tabela vive - jogar fora essa parte e perder a informacao. */
function partesTabela(nome) {
    var limpo = String(nome == null ? '' : nome).replace(/[\[\]"]/g, '').trim();
    var p = limpo.split('.').filter(function (x) { return x !== ''; });
    var out = { banco: '', esquema: '', tabela: '', completo: limpo };
    if (p.length >= 3) {
        out.banco = p[p.length - 3].toUpperCase();
        out.esquema = p[p.length - 2];
        out.tabela = p[p.length - 1];
    } else if (p.length === 2) {
        /* 2 partes e esquema.objeto (dbo.X) - nao da para afirmar que o
           primeiro segmento e um banco, entao nao se afirma */
        out.esquema = p[0];
        out.tabela = p[1];
    } else {
        out.tabela = p[0] || '';
    }
    return out;
}
function bancoDe(nome) { return partesTabela(nome).banco; }

/* Um token so vale como tabela se: tem schema (ponto) OU e identificador
   all-caps com _ (padrao de tabela) OU e conhecido como variavel de tabela.
   Isso descarta ruido de prosa em comentarios ("from now", "no", aliases). */
function ehTabelaValida(t, varsConhecidas, ctes) {
    if (!t) return false;
    var seg = String(t).split('.').pop();
    if (seg.charAt(seg.length - 1) === '_') return false;      /* prefixo tipo Z_DELP_CAPEX_ */
    var reservadas = { SELECT: 1, WHERE: 1, DUAL: 1, VALUES: 1, SET: 1, INTO: 1, ORDER: 1, GROUP: 1, ON: 1, AND: 1, OR: 1 };
    if (reservadas[t.toUpperCase()] || reservadas[seg.toUpperCase()]) return false;
    /* catalogo do proprio SQL Server nao e tabela de negocio */
    if (/^(sys|information_schema|tempdb)\./i.test(String(t))) return false;
    /* CTE (WITH x AS (...)) e tabela temporaria de consulta, nao entidade */
    if (ctes && ctes[seg.toUpperCase()]) return false;
    if (String(t).charAt(0) === '#') return false;              /* #temp */
    if (t.indexOf('.') >= 0) return true;                       /* tem schema */
    if (varsConhecidas && varsConhecidas[t]) return true;       /* e var de tabela */
    if (/^[A-Z][A-Z0-9_]{2,}$/.test(t) && /_/.test(t)) return true; /* CAPS_COM_UNDERSCORE */
    return false;
}

/* "Achata" o SQL concatenado: troca variaveis de tabela pelos literais e
   colapsa 'A' + 'B' -> 'AB'. Assim o SQL montado dinamicamente vira uma string
   contigua e os regexes de FROM/INSERT/UPDATE passam a enxergar as tabelas. */
function flattenSql(conteudo, vars) {
    var s = conteudo;
    Object.keys(vars).forEach(function (v) {
        var re = new RegExp('(^|[^\\w.])' + v + '(?![\\w])', 'g');
        s = s.replace(re, function (_, p) { return p + "'" + vars[v] + "'"; });
    });
    var prev;
    var reCol = /'([^'\n]*)'\s*\+\s*'([^'\n]*)'/g;
    var guard = 0;
    do { prev = s; s = s.replace(reCol, "'$1$2'"); guard++; } while (s !== prev && guard < 50);
    return s;
}

/* Nomes de CTE declarados com WITH x AS ( ... ) - sao consultas, nao tabelas. */
function ctesEmSql(conteudo) {
    var out = {};
    var re = /(?:\bWITH\b|,)\s*([A-Za-z_][\w]*)\s+AS\s*\(/gi;
    var m;
    while ((m = re.exec(conteudo))) out[m[1].toUpperCase()] = 1;
    return out;
}

/* Nomes de tabela a partir de SQL embutido (FROM/JOIN/INTO/UPDATE/DELETE). */
function tabelasEmSql(conteudo) {
    var vars = resolverVarsTabela(conteudo);
    conteudo = flattenSql(conteudo, vars);
    var ctes = ctesEmSql(conteudo);
    var reads = [], writes = [];
    var reFrom = /\b(?:FROM|JOIN)\s+([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*){0,2})/gi;
    var reIns = /\bINSERT\s+INTO\s+([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*){0,2})/gi;
    var reUpd = /\bUPDATE\s+([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*){0,2})/gi;
    var reDel = /\bDELETE\s+FROM\s+([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*){0,2})/gi;
    var m;
    while ((m = reFrom.exec(conteudo))) reads.push(m[1]);
    while ((m = reIns.exec(conteudo))) writes.push(m[1]);
    while ((m = reUpd.exec(conteudo))) writes.push(m[1]);
    while ((m = reDel.exec(conteudo))) writes.push(m[1]);
    var f = function (a) { return unico(a).filter(function (t) { return ehTabelaValida(t, vars, ctes); }); };
    return { reads: f(reads), writes: f(writes) };
}

/* Colunas atribuiveis com seguranca a UMA tabela: alvo de INSERT/UPDATE.
   Retorna { NOME_TABELA_SEGMENTO: [col, col, ...] }. */
function colunasPorTabelaSql(conteudo) {
    var vars = resolverVarsTabela(conteudo);
    conteudo = flattenSql(conteudo, vars);
    var ctes = ctesEmSql(conteudo);
    var out = {};
    var seg = function (t) { return String(t).split('.').pop().toUpperCase(); };
    var add = function (tab, cols) {
        if (!ehTabelaValida(tab, vars, ctes)) return;
        var k = seg(tab);
        out[k] = out[k] || {};
        cols.forEach(function (c) { if (/^[A-Za-z_][\w]*$/.test(c)) out[k][c.toUpperCase()] = 1; });
    };
    /* INSERT INTO T (a, b, c) */
    var reIns = /\bINSERT\s+INTO\s+([A-Za-z_][\w.]*)\s*\(([^)]*)\)/gi;
    var m;
    while ((m = reIns.exec(conteudo))) {
        var cols = m[2].split(',').map(function (s) { return s.trim().replace(/[\[\]'"]/g, ''); }).filter(Boolean);
        add(m[1], cols);
    }
    /* UPDATE T SET a = ?, b = ? */
    var reUpd = /\bUPDATE\s+([A-Za-z_][\w.]*)\s+SET\s+([\s\S]*?)(?:\bWHERE\b|;|$)/gi;
    while ((m = reUpd.exec(conteudo))) {
        var pares = m[2].split(',').map(function (s) {
            var mm = s.match(/([A-Za-z_][\w]*)\s*=/); return mm ? mm[1] : null;
        }).filter(Boolean);
        add(m[1], pares);
    }
    /* resultado como mapa de arrays */
    var final = {};
    Object.keys(out).forEach(function (k) { final[k] = Object.keys(out[k]); });
    return final;
}

/* Relacoes a partir de JOIN ... ON a.col = b.col, resolvendo aliases no mesmo
   trecho FROM/JOIN. Devolve [{deTab, deCol, paraTab, paraCol}]. */
function relacoesPorJoin(conteudo) {
    var vars = resolverVarsTabela(conteudo);
    var rels = [];
    /* mapeia alias -> tabela dentro de blocos "FROM t a JOIN t2 b" e resolve var refs */
    /* estrategia: para cada ON a.C = b.C, procura os aliases definidos por perto */
    var reAlias = /\b(?:FROM|JOIN)\s+([A-Za-z_][\w.]*|\'\s*\+\s*[A-Z_]+\s*\+\s*\'|[A-Z_]+)\s+(?:AS\s+)?([A-Za-z][\w]*)\b/gi;
    /* Como o SQL e concatenado, usamos uma varredura simples: coletar pares alias->possivel tabela
       por proximidade textual nao e confiavel. Em vez disso, resolvemos por nome de coluna: */
    var reOn = /\bON\s+([A-Za-z][\w]*)\.([A-Za-z_][\w]*)\s*=\s*([A-Za-z][\w]*)\.([A-Za-z_][\w]*)/gi;
    var m;
    while ((m = reOn.exec(conteudo))) {
        rels.push({ aliasA: m[1], colA: m[2], aliasB: m[3], colB: m[4] });
    }
    return rels; /* aliases resolvidos no model, junto ao mapa global de tabelas */
}

/* Resolve nomes de variaveis de tabela (var TB = 'FLUIG.dbo.X') dentro do SQL. */
function resolverVarsTabela(conteudo) {
    var mapa = {};
    var re = /var\s+([A-Z_][A-Z0-9_]*)\s*=\s*['"]([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*){0,2})['"]\s*;/g;
    var m;
    while ((m = re.exec(conteudo))) {
        var nome = m[1], val = m[2];
        /* heuristica: parece nome de tabela (tem schema.dbo. ou 2+ pontos, ou prefixo TB/TABELA) */
        if (/\.dbo\./i.test(val) || (val.match(/\./g) || []).length >= 1 || /^TB/i.test(nome) || /TABELA/i.test(nome)) {
            mapa[nome] = val;
        }
    }
    return mapa;
}

/* Datasets chamados via DatasetFactory / getDataset('ds...'). */
function datasetsChamados(conteudo) {
    var out = [];
    var re = /getDataset\s*\(\s*['"]([\w]+)['"]/g;
    var m;
    while ((m = re.exec(conteudo))) out.push(m[1]);
    var re2 = /DatasetFactory\.getDataset\s*\(\s*['"]([\w]+)['"]/g;
    while ((m = re2.exec(conteudo))) out.push(m[1]);
    return unico(out);
}

/* Todas as funcoes declaradas (function nome(...) e nome: function(...)). */
function funcoes(conteudo) {
    var out = [];
    var re = /function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g;
    var m;
    while ((m = re.exec(conteudo))) {
        var nome = m[1];
        out.push({
            nome: nome,
            visibilidade: nome.charAt(0) === '_' ? 'privada' : 'publica',
            args: m[2].split(',').map(function (s) { return s.trim(); }).filter(Boolean)
        });
    }
    /* metodos de objeto/prototype: nome: function( / nome = function( */
    var re2 = /([A-Za-z_$][\w$]*)\s*[:=]\s*function\s*\(([^)]*)\)/g;
    while ((m = re2.exec(conteudo))) {
        out.push({ nome: m[1], visibilidade: m[1].charAt(0) === '_' ? 'privada' : 'publica',
                   args: m[2].split(',').map(function (s) { return s.trim(); }).filter(Boolean), metodo: true });
    }
    return out;
}

/* ------------------------------------------------------- application.info */
function parseApplicationInfo(conteudo) {
    var out = { js: [], css: [] };
    var linhas = conteudo.split(/\r?\n/);
    var jsTmp = {}, cssTmp = {};
    for (var i = 0; i < linhas.length; i++) {
        var l = linhas[i].trim();
        if (!l || l.charAt(0) === '#') continue;
        var eq = l.indexOf('=');
        if (eq < 0) continue;
        var chave = l.substring(0, eq).trim();
        var valor = l.substring(eq + 1).trim();

        var mjs = chave.match(/^application\.resource\.js\.(\d+)$/);
        var mcss = chave.match(/^application\.resource\.css\.(\d+)$/);
        if (mjs) { jsTmp[parseInt(mjs[1], 10)] = valor; continue; }
        if (mcss) { cssTmp[parseInt(mcss[1], 10)] = valor; continue; }

        switch (chave) {
            case 'application.type': out.type = valor; break;
            case 'application.code': out.code = valor; break;
            case 'application.title': out.title = valor; break;
            case 'application.description': out.description = valor; break;
            case 'application.category': out.category = valor; break;
            case 'application.renderer': out.renderer = valor; break;
            case 'application.version': out.version = valor; break;
            case 'application.uiwidget': out.uiwidget = valor; break;
            case 'application.mobileapp': out.mobileapp = valor; break;
            case 'developer.code': out.developerCode = valor; break;
            case 'developer.name': out.developerName = valor; break;
            case 'view.file': out.viewFile = valor; break;
            case 'edit.file': out.editFile = valor; break;
            case 'locale.file.base.name': out.localeBase = valor; break;
            default: break;
        }
    }
    var ordenar = function (tmp) {
        var chaves = Object.keys(tmp).map(Number).sort(function (a, b) { return a - b; });
        return chaves.map(function (k) {
            var p = tmp[k];
            var nome = p.split('/').pop();
            return { ordem: k, path: p, nome: nome, role: papelPorNome(nome) };
        });
    };
    out.js = ordenar(jsTmp);
    out.css = ordenar(cssTmp);
    return out;
}

/* Classifica o papel arquitetural de um recurso JS pelo nome (para o diagrama). */
function papelPorNome(nome) {
    var b = nome.toLowerCase();
    if (/(exceljs|chart|jquery|bootstrap)\.min/.test(b) || /\.min\.js$/.test(b)) return 'lib';
    if (b === 'objects.js') return 'dominio';
    if (b === 'componentes.js') return 'componentes';
    if (b === 'controller.js') return 'controller';
    if (b === 'main.function.js') return 'bootstrap';
    if (b === 'excelhelper.js') return 'helper';
    if (b === 'permissoes.js') return 'infra';
    if (/^integre/.test(b)) return 'integracao';
    if (/^ds/.test(b)) return 'acesso-dados';
    return 'outro';
}

/* ------------------------------------------------------------- dataset */
function parseDataset(conteudo, nome) {
    var vars = resolverVarsTabela(conteudo);
    var acoes = [];
    /* acoes: case 'XXX': dentro do switch(acao) */
    var reCase = /case\s+['"]([A-Z0-9_]+)['"]\s*:/g;
    var m;
    while ((m = reCase.exec(conteudo))) acoes.push(m[1]);
    acoes = unico(acoes);

    /* grupos de colunas: var COLS_XXX = [ 'A','B',... ] */
    var colGrupos = [];
    var reCols = /var\s+(COLS?_[A-Z0-9_]*|COLUNAS?_[A-Z0-9_]*)\s*=\s*\[([\s\S]*?)\]/g;
    while ((m = reCols.exec(conteudo))) {
        var nomeG = m[1];
        var itens = (m[2].match(/['"]([^'"]+)['"]/g) || []).map(function (s) { return s.replace(/['"]/g, ''); });
        if (itens.length) colGrupos.push({ nome: nomeG, colunas: itens });
    }

    var sqlTab = tabelasEmSql(conteudo);
    /* junta tabelas resolvidas por variavel */
    var todasTabelas = unico(Object.keys(vars).map(function (k) { return vars[k]; })
        .concat(sqlTab.reads).concat(sqlTab.writes));

    var jndi = '';
    var mj = conteudo.match(/JNDI[_A-Z]*\s*=\s*['"]([^'"]+)['"]/);
    if (mj) jndi = mj[1];

    return {
        nome: nome,
        descricao: descricao(conteudo),
        versoes: versoes(conteudo),
        acoes: acoes,
        tabelas: todasTabelas,
        tableVars: vars,
        colunasGrupos: colGrupos,
        colunasSql: colunasPorTabelaSql(conteudo),
        funcoes: funcoes(conteudo).filter(function (f) { return !f.metodo; }),
        jndi: jndi,
        reads: sqlTab.reads,
        writes: sqlTab.writes,
        chama: datasetsChamados(conteudo)
    };
}

/* ------------------------------------------------------------- formulario JS */
function parseFormJs(conteudo, nome) {
    /* atividades: var SEQ_XXX = N;  (codigo de atividade do workflow) */
    var ativs = [];
    var re = /var\s+(SEQ_[A-Z0-9_]*|ATIV[A-Z0-9_]*|STATE_[A-Z0-9_]*)\s*=\s*(\d+)\s*;/g;
    var m;
    while ((m = re.exec(conteudo))) ativs.push({ constante: m[1], valor: parseInt(m[2], 10) });

    /* campos do cartao: getCardValue('X') e wrappers _v(form,'X') */
    var campos = [];
    var reCard = /getCardValue\s*\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)/g;
    while ((m = reCard.exec(conteudo))) campos.push(m[1]);
    var reV = /_v\s*\(\s*form\s*,\s*['"]([A-Za-z0-9_]+)['"]\s*\)/g;
    while ((m = reV.exec(conteudo))) campos.push(m[1]);
    campos = unico(campos);

    /* paineis / elementos manipulados: _mostrar('id') _esconder('id') getElementById('id') */
    var paineis = [];
    var reEl = /(?:_mostrar|_esconder|_montar[A-Za-z]*|getElementById)\s*\(\s*['"]([A-Za-z0-9_\-]+)['"]/g;
    while ((m = reEl.exec(conteudo))) paineis.push(m[1]);
    paineis = unico(paineis);

    /* SQL no cartao e raro, mas quando existe entra na rastreabilidade igual */
    var sqlTab = tabelasEmSql(conteudo);
    var varsTab = resolverVarsTabela(conteudo);

    return {
        nome: nome,
        descricao: descricao(conteudo),
        versoes: versoes(conteudo),
        atividades: ativs,
        campos: campos,
        elementos: paineis,
        funcoes: funcoes(conteudo).filter(function (f) { return !f.metodo; }),
        chama: datasetsChamados(conteudo),
        tabelas: unico(Object.keys(varsTab).map(function (k) { return varsTab[k]; })
            .concat(sqlTab.reads).concat(sqlTab.writes)),
        colunasSql: colunasPorTabelaSql(conteudo),
        reads: sqlTab.reads,
        writes: sqlTab.writes
    };
}

/* -------------------------------------------- evento / auxiliar de formulario
   Arquivos dentro de forms/: eventos do cartao (displayFields, setEnable,
   validateForm, beforeSendValidate, documentReady) e scripts auxiliares. Sao o
   equivalente, no formulario, do que os modulos JS sao na widget. */
var EVENTOS_FORM_CONHECIDOS = ['displayFields', 'setEnable', 'enableFields', 'inputFields',
    'validateForm', 'beforeSendValidate', 'documentReady', 'setInformation',
    'beforeProcessing', 'afterProcessing', 'afterSaveNew', 'beforeSaveNew'];

function parseFormEvento(conteudo, nome, tipo) {
    var base = String(nome).replace(/\.js$/i, '');
    var evento = '';
    for (var i = 0; i < EVENTOS_FORM_CONHECIDOS.length; i++) {
        var e = EVENTOS_FORM_CONHECIDOS[i];
        if (base.toLowerCase() === e.toLowerCase()) { evento = e; break; }
        if (new RegExp('function\\s+' + e + '\\s*\\(').test(conteudo)) { evento = e; break; }
    }
    var dados = parseFormJs(conteudo, nome);
    dados.evento = evento || (tipo === 'form_aux_js' ? '' : '(indefinido)');
    dados.auxiliar = tipo === 'form_aux_js';
    return dados;
}

/* ------------------------------------------------------------- formulario HTML */
function parseFormHtml(conteudo) {
    /* ids de elementos e campos data-* do Fluig */
    var ids = unico((conteudo.match(/id\s*=\s*["']([A-Za-z0-9_\-]+)["']/g) || [])
        .map(function (s) { return s.replace(/id\s*=\s*["']/, '').replace(/["']$/, ''); }));
    var campos = unico((conteudo.match(/name\s*=\s*["']([A-Za-z0-9_]+)["']/g) || [])
        .map(function (s) { return s.replace(/name\s*=\s*["']/, '').replace(/["']$/, ''); }));
    var titulo = '';
    var mt = conteudo.match(/<h1[^>]*>([^<]+)<\/h1>/i) || conteudo.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (mt) titulo = mt[1].trim();
    return { ids: ids, campos: campos, titulo: titulo };
}

/* ------------------------------------------------------------- FTL */
/* Os data-attributes de navegacao nao seguem um nome universal: cada aplicacao
   usa o seu prefixo (data-capex-tab, data-portal-tab...). O prefixo vem da
   identidade da aplicacao analisada; sem ele, aceita-se qualquer prefixo. */
function reDataAttr(prefixos, sufixos) {
    var pre = (prefixos && prefixos.length)
        ? '(?:' + prefixos.map(escapaRe).join('|') + ')'
        : '[a-z][a-z0-9]*';
    return new RegExp('data-' + pre + '-(?:' + sufixos + ')\\s*=\\s*["\']([A-Za-z0-9_\\-]+)["\']', 'g');
}
function escapaRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function parseFtl(conteudo, nome, ident) {
    var pd = (ident && ident.prefixos && ident.prefixos.data) || [];
    var abas = unico((conteudo.match(reDataAttr(pd, 'tab|secao|aba|section')) || [])
        .map(function (s) { return s.replace(/.*["']([A-Za-z0-9_\-]+)["']$/, '$1'); }));
    var containers = unico((conteudo.match(reDataAttr(pd, 'container|painel|panel')) || [])
        .map(function (s) { return s.replace(/.*["']([A-Za-z0-9_\-]+)["']$/, '$1'); }));
    var comentarioFtl = '';
    var mc = conteudo.match(/<#--([\s\S]*?)-->/);
    if (mc) {
        var linhas = mc[1].split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
        for (var i = 0; i < linhas.length; i++) {
            if (linhas[i].length > 10 && !/^=+$/.test(linhas[i])) { comentarioFtl = linhas[i]; break; }
        }
    }
    /* versoes no comentario FTL (mesma convencao) */
    var vs = [];
    if (mc) {
        var ls = mc[1].split(/\r?\n/);
        for (var j = 0; j < ls.length; j++) {
            var mm = ls[j].match(/v(\d+(?:\.\d+)*)\s*\(?([^)]*)\)?\s*[:\-–]?\s*(.*)/);
            if (mm && /^\d/.test(mm[1]) && ls[j].toLowerCase().indexOf('altera') >= 0) {
                vs.push({ versao: mm[1], nota: (mm[3] || '').trim() });
            }
        }
    }
    return { nome: nome, descricao: comentarioFtl, abas: abas, containers: containers };
}

/* ------------------------------------------------------------- SQL (DDL) */
function parseSql(conteudo, nome) {
    var tabelas = [], alters = [], procs = [];

    /* CREATE TABLE nome ( ... ) */
    var reCreate = /CREATE\s+TABLE\s+(?:\[?dbo\]?\.)?(?:\[?[\w]+\]?\.)?\[?([\w]+)\]?\s*\(([\s\S]*?)\)\s*(?:;|GO|$)/gi;
    var m;
    while ((m = reCreate.exec(conteudo))) {
        var tab = m[1];
        var corpo = m[2];
        var colunas = [];
        var linhas = corpo.split(/,(?![^(]*\))/); /* virgula fora de parenteses */
        for (var i = 0; i < linhas.length; i++) {
            var l = linhas[i].trim();
            if (!l) continue;
            if (/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|KEY|CHECK|INDEX)\b/i.test(l)) continue;
            /* [NOME] tipo(args) resto   - o tipo pode ter virgula: decimal(18,2) */
            var mc = l.match(/^\[?([\w]+)\]?\s+(\[?[\w]+\]?(?:\s*\([^)]*\))?)(.*)$/);
            if (mc) {
                colunas.push({
                    nome: mc[1],
                    tipo: mc[2].replace(/[\[\]]/g, '').replace(/\s+/g, ''),
                    nulo: !/NOT\s+NULL/i.test(mc[3]),
                    pk: /PRIMARY\s+KEY/i.test(mc[3]) || /IDENTITY/i.test(mc[3])
                });
            }
        }
        tabelas.push({ nome: tab, colunas: colunas, origem: 'sql:' + nome });
    }

    /* CHAVES PRIMARIAS declaradas fora do CREATE:
       ALTER TABLE [dbo].[T] ADD CONSTRAINT [PK_T] PRIMARY KEY ([A], [B]); */
    var pks = [];
    var rePk = /ALTER\s+TABLE\s+(?:\[?[\w]+\]?\.){0,2}\[?([\w]+)\]?\s+ADD\s+(?:CONSTRAINT\s+\[?([\w]+)\]?\s+)?PRIMARY\s+KEY[^(]*\(([^)]*)\)/gi;
    while ((m = rePk.exec(conteudo))) {
        pks.push({
            tabela: m[1],
            constraint: m[2] || '',
            colunas: m[3].split(',').map(function (s) { return s.trim().replace(/[\[\]"'`]/g, ''); }).filter(Boolean),
            origem: 'sql:' + nome
        });
    }
    /* PRIMARY KEY dentro do proprio CREATE TABLE: CONSTRAINT [PK] PRIMARY KEY (A, B) */
    var rePkIn = /CONSTRAINT\s+\[?([\w]+)\]?\s+PRIMARY\s+KEY[^(]*\(([^)]*)\)/gi;
    while ((m = rePkIn.exec(conteudo))) {
        var alvoPk = m[1].replace(/^PK[_-]?/i, '');
        if (!alvoPk) continue;
        pks.push({
            tabela: alvoPk,
            constraint: m[1],
            colunas: m[2].split(',').map(function (s) { return s.trim().replace(/[\[\]"'`]/g, ''); }).filter(Boolean),
            origem: 'sql:' + nome,
            porNomeConstraint: true
        });
    }

    /* CHAVES ESTRANGEIRAS -> viram relacionamentos DECLARADOS (a fonte mais forte).
       ALTER TABLE [dbo].[A] ADD CONSTRAINT [FK] FOREIGN KEY ([X_ID]) REFERENCES [dbo].[X] ([ID]); */
    var fks = [];
    var reFk = /(?:ALTER\s+TABLE\s+(?:\[?[\w]+\]?\.){0,2}\[?([\w]+)\]?\s+(?:WITH\s+(?:NO)?CHECK\s+)?ADD\s+)?CONSTRAINT\s+\[?([\w]+)\]?\s+FOREIGN\s+KEY\s*\(([^)]*)\)\s*REFERENCES\s+(?:\[?[\w]+\]?\.){0,2}\[?([\w]+)\]?\s*\(([^)]*)\)/gi;
    while ((m = reFk.exec(conteudo))) {
        var cols = m[3].split(',').map(function (s) { return s.trim().replace(/[\[\]"'`]/g, ''); }).filter(Boolean);
        var refCols = m[5].split(',').map(function (s) { return s.trim().replace(/[\[\]"'`]/g, ''); }).filter(Boolean);
        if (!cols.length || !refCols.length) continue;
        fks.push({
            tabela: m[1] || '',
            constraint: m[2] || '',
            coluna: cols[0],
            colunas: cols,
            refTabela: m[4],
            refColuna: refCols[0],
            origem: 'sql:' + nome
        });
    }

    /* ALTER TABLE ... ADD/ALTER/DROP COLUMN (mudancas de schema, para o historico).
       PK/FK ja foram capturadas acima e nao interessam aqui como "mudanca". */
    var reAlter = /ALTER\s+TABLE\s+(?:\[?[\w]+\]?\.){0,2}\[?([\w]+)\]?\s+([\s\S]*?)(?:;|GO|$)/gi;
    while ((m = reAlter.exec(conteudo))) {
        if (/\b(PRIMARY\s+KEY|FOREIGN\s+KEY)\b/i.test(m[2])) continue;
        alters.push({ tabela: m[1], mudanca: m[2].replace(/\s+/g, ' ').trim().slice(0, 200), origem: 'sql:' + nome });
    }

    /* CREATE PROCEDURE nome (@a, @b) */
    var reProc = /CREATE\s+(?:OR\s+ALTER\s+)?PROC(?:EDURE)?\s+(?:\[?[\w]+\]?\.){0,2}\[?([\w]+)\]?([\s\S]{0,400}?)\bAS\b/gi;
    while ((m = reProc.exec(conteudo))) {
        var params = unico((m[2].match(/@[\w]+/g) || []));
        procs.push({ nome: m[1], params: params, origem: 'sql:' + nome });
    }

    var sqlTab = tabelasEmSql(conteudo);
    return {
        tabelas: tabelas, alters: alters, procedures: procs,
        pks: pks, fks: fks,
        reads: sqlTab.reads, writes: sqlTab.writes
    };
}

/* ------------------------------------------------------------- workflow script */
function parseWorkflowScript(conteudo, nome) {
    var evento = '';
    var mb = nome.match(/[._]([a-zA-Z]*[Tt]ask[a-zA-Z]*\d*|before[A-Za-z]+|after[A-Za-z]+|servicetask\d+)\.js$/);
    if (mb) evento = mb[1];
    else {
        /* funcoes de evento conhecidas dentro do arquivo */
        var conhecidos = ['beforeTaskSave', 'afterTaskSave', 'beforeTaskComplete', 'afterTaskComplete',
            'beforeStateEntry', 'afterStateEntry', 'beforeProcessCreate', 'afterProcessCreate', 'beforeMovementEntry'];
        for (var i = 0; i < conhecidos.length; i++) {
            if (new RegExp('function\\s+' + conhecidos[i] + '\\s*\\(').test(conteudo)) { evento = conhecidos[i]; break; }
        }
        if (!evento) { var ms = nome.match(/servicetask\d+/i); if (ms) evento = ms[0]; }
    }
    var sqlTab = tabelasEmSql(conteudo);
    var vars = resolverVarsTabela(conteudo);
    var tabelas = unico(Object.keys(vars).map(function (k) { return vars[k]; })
        .concat(sqlTab.reads).concat(sqlTab.writes));

    return {
        nome: nome,
        evento: evento || '(indefinido)',
        descricao: descricao(conteudo),
        versoes: versoes(conteudo),
        funcoes: funcoes(conteudo).filter(function (f) { return !f.metodo; }),
        tabelas: tabelas,
        colunasSql: colunasPorTabelaSql(conteudo),
        reads: sqlTab.reads,
        writes: sqlTab.writes,
        chama: datasetsChamados(conteudo)
    };
}

/* ------------------------------------------------------------- widget JS */
function parseWidgetJs(conteudo, nome, ident) {
    /* classes POO: SuperWidget.extend / var X = function(){} + X.prototype
       + declaracoes function Nome() usadas como classe (maiuscula). */
    var classes = [];
    var reProto = /([A-Za-z_$][\w$]*)\.prototype\./g;
    var m, protoNomes = {};
    while ((m = reProto.exec(conteudo))) protoNomes[m[1]] = 1;
    classes = Object.keys(protoNomes);

    /* Namespaces do modulo. As raizes ("capex", "portal", "app"...) sao as que
       a propria aplicacao declara — nao ha prefixo fixo no gerador. */
    var raizes = (ident && ident.prefixos && ident.prefixos.namespace) || [];
    var namespaces = [];
    if (raizes.length) {
        var reNs = new RegExp('\\b(?:' + raizes.map(escapaRe).join('|') +
            ')\\.[A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)?', 'g');
        namespaces = unico(conteudo.match(reNs) || []);
    }

    /* dependencias entre modulos: usos de outros namespaces/classes conhecidos */
    return {
        nome: nome,
        role: papelPorNome(nome),
        descricao: descricao(conteudo),
        versoes: versoes(conteudo),
        classes: classes,
        namespaces: namespaces,
        funcoes: funcoes(conteudo),
        chama: datasetsChamados(conteudo)
    };
}

/* ------------------------------------------------------------- CSS tokens */
function parseCssTokens(conteudo, ident) {
    var tokens = {};
    var re = /(--[\w-]+)\s*:\s*([^;]+);/g;
    var m;
    while ((m = re.exec(conteudo))) {
        var nome = m[1].trim(), val = m[2].trim();
        if (!tokens[nome]) tokens[nome] = val;
    }
    /* Blocos BEM da aplicacao (nao pega elementos/modificadores). O prefixo e o
       que a folha de estilo realmente usa, descoberto na identidade. */
    var pc = (ident && ident.prefixos && ident.prefixos.css) || [];
    var reBloco = pc.length
        ? new RegExp('\\.(?:' + pc.map(escapaRe).join('|') + ')-[a-z0-9]+(?=[\\s,{:])', 'g')
        : null;
    var blocos = reBloco
        ? unico((conteudo.match(reBloco) || []).map(function (s) { return s.replace(/^\./, ''); }))
        : [];
    return { tokens: tokens, blocos: blocos };
}

/* =============================================================================
   ESQUEMA VINDO DO BANCO EM CSV
   -----------------------------------------------------------------------------
   O tecnico roda 01-extrair-esquema.sql em CADA banco e salva o resultado como
   CSV nesta pasta. Uma execucao por banco, um CSV por banco - e cada linha do
   CSV carrega a coluna "banco" (DB_NAME()), entao o arquivo se identifica
   sozinho: o nome dado ao arquivo nao importa.

   O CSV do SSMS varia com a maquina: separador virgula ou ponto-e-virgula
   (Windows pt-BR usa ";"), com ou sem BOM, aspas so quando necessario. O leitor
   abaixo lida com as tres variacoes em vez de exigir uma configuracao exata.
============================================================================= */

/* Descobre o separador olhando o cabecalho: vence o que produz mais colunas. */
function separadorCsv(primeiraLinha) {
    var cands = [';', ',', '\t', '|'];
    var melhor = ',', max = 0;
    cands.forEach(function (s) {
        var n = fatiarLinhaCsv(primeiraLinha, s).length;
        if (n > max) { max = n; melhor = s; }
    });
    return melhor;
}

/* Uma linha CSV -> campos, respeitando aspas duplas e "" como aspa literal. */
function fatiarLinhaCsv(linha, sep) {
    var out = [], atual = '', dentro = false;
    for (var i = 0; i < linha.length; i++) {
        var c = linha.charAt(i);
        if (dentro) {
            if (c === '"') {
                if (linha.charAt(i + 1) === '"') { atual += '"'; i++; }
                else dentro = false;
            } else atual += c;
        } else if (c === '"') {
            dentro = true;
        } else if (c === sep) {
            out.push(atual); atual = '';
        } else atual += c;
    }
    out.push(atual);
    return out;
}

/* Ordem fixa das colunas produzidas por 01-extrair-esquema.sql.
   O cabecalho e OPCIONAL no CSV: "Include column headers" e uma opcao por
   estacao no SSMS e vem desligada em muitas maquinas. Depender dela faria o
   arquivo inteiro ser descartado por causa de uma caixinha de configuracao. */
var COLUNAS_ESQUEMA = ['tipo', 'banco', 'esquema', 'objeto', 'objeto_tipo', 'coluna', 'ordem',
    'tipo_dado', 'tamanho', 'precisao', 'escala', 'nulo', 'pk', 'identidade',
    'ref_banco', 'ref_esquema', 'ref_objeto', 'ref_coluna', 'restricao'];

/* Texto CSV -> registros crus (listas de campos), sem supor cabecalho.
   Suporta campo com quebra de linha dentro de aspas. */
function registrosCsv(texto) {
    var s = String(texto || '').replace(/^﻿/, '');
    if (!s.trim()) return { sep: ',', registros: [] };

    var registros = [], atual = '', dentro = false;
    for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i);
        if (c === '"') {
            if (dentro && s.charAt(i + 1) === '"') { atual += '""'; i++; continue; }
            dentro = !dentro; atual += c; continue;
        }
        if (!dentro && (c === '\n' || c === '\r')) {
            if (c === '\r' && s.charAt(i + 1) === '\n') i++;
            registros.push(atual); atual = '';
            continue;
        }
        atual += c;
    }
    if (atual !== '') registros.push(atual);
    registros = registros.filter(function (r) { return r.trim() !== '' && !ehRodapeSsms(r); });
    if (!registros.length) return { sep: ',', registros: [] };

    var sep = separadorCsv(registros[0]);
    return { sep: sep, registros: registros.map(function (r) { return fatiarLinhaCsv(r, sep); }) };
}

/* "(46 rows affected)" / "(46 linhas afetadas)" - o SSMS ainda escreve isso em
   algumas configuracoes, mesmo com SET NOCOUNT ON. Nao e dado. */
function ehRodapeSsms(linha) {
    return /^\s*\(\s*\d+\s+(rows?|linhas?)\b/i.test(String(linha || ''));
}

/* -----------------------------------------------------------------------------
   SAIDA EM TEXTO (Ctrl+T no SSMS) EM VEZ DE GRADE (Ctrl+D)

   Trocar "Results to Grid" por "Results to Text" e um atalho de teclado de
   diferenca, e o arquivo salvo fica de largura fixa em vez de separado por
   delimitador. Recusar esse arquivo devolveria o portal inteiro para "inferido"
   por causa de um Ctrl+T - entao ele tambem e lido.

   A linha de tracejados abaixo do cabecalho da as larguras exatas de cada
   coluna; e por ela que o corte e feito.
   ----------------------------------------------------------------------------- */
function registrosTextoFixo(texto) {
    var linhas = String(texto || '').replace(/^﻿/, '').split(/\r\n|\r|\n/);
    var iSep = -1;
    for (var i = 0; i < linhas.length && i < 6; i++) {
        if (/^-{2,}( +-{2,})+\s*$/.test(linhas[i])) { iSep = i; break; }
    }
    if (iSep < 1) return null;

    var faixas = [], re = /-+/g, m;
    while ((m = re.exec(linhas[iSep]))) faixas.push([m.index, m.index + m[0].length]);
    if (faixas.length < 5) return null;   /* tabela estreita demais: nao e esta saida */

    function fatiar(linha) {
        var s = String(linha == null ? '' : linha);
        return faixas.map(function (f) { return s.slice(f[0], f[1]).trim(); });
    }

    var out = [fatiar(linhas[iSep - 1])];   /* o cabecalho e a linha acima do tracejado */
    for (var k = iSep + 1; k < linhas.length; k++) {
        if (!linhas[k].trim() || ehRodapeSsms(linhas[k])) continue;
        out.push(fatiar(linhas[k]));
    }
    return out;
}

/* O arquivo salvo na pasta esquema-sql e a saida do catalogo, ou e outra coisa
   (um DDL, um rascunho)? A pergunta e respondida pelo CONTEUDO: a extensao que o
   tecnico escolheu no "Save Results As" nao e uma informacao confiavel - a mesma
   grade e salva como .csv, .txt ou .sql dependendo do dia. */
function pareceEsquemaCatalogo(texto) {
    var linhas = String(texto || '').replace(/^﻿/, '').split(/\r\n|\r|\n/);
    for (var i = 0; i < linhas.length; i++) {
        var l = linhas[i].trim();
        if (!l) continue;
        /* cabecalho da grade, em qualquer separador */
        if (/^"?tipo"?\s*[;,\t|]\s*"?banco"?\s*[;,\t|]/i.test(l)) return true;
        /* primeira celula de uma linha de dados (arquivo sem cabecalho) */
        if (/^"?(COLUNA|FK|AUSENTE|ERRO)"?\s*[;,\t|]/i.test(l)) return true;
        /* mesma grade salva em texto de largura fixa */
        if (/^tipo\s+banco\s+esquema\s+objeto\b/i.test(l)) return true;
        return false;   /* a primeira linha util ja decide */
    }
    return false;
}

/* Texto CSV -> lista de objetos { coluna: valor }, usando a 1a linha como
   cabecalho. Usado quando o cabecalho e garantido. */
function parseCsv(texto) {
    var s = String(texto || '').replace(/^﻿/, '');
    if (!s.trim()) return { colunas: [], linhas: [] };

    /* separa registros respeitando aspas */
    var registros = [], atual = '', dentro = false;
    for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i);
        if (c === '"') {
            if (dentro && s.charAt(i + 1) === '"') { atual += '""'; i++; continue; }
            dentro = !dentro; atual += c; continue;
        }
        if (!dentro && (c === '\n' || c === '\r')) {
            if (c === '\r' && s.charAt(i + 1) === '\n') i++;
            registros.push(atual); atual = '';
            continue;
        }
        atual += c;
    }
    if (atual !== '') registros.push(atual);
    registros = registros.filter(function (r) { return r.trim() !== ''; });
    if (!registros.length) return { colunas: [], linhas: [] };

    var sep = separadorCsv(registros[0]);
    var cab = fatiarLinhaCsv(registros[0], sep).map(normalizaChave);
    var linhas = [];
    for (var k = 1; k < registros.length; k++) {
        var campos = fatiarLinhaCsv(registros[k], sep);
        var obj = {};
        for (var j = 0; j < cab.length; j++) obj[cab[j]] = (campos[j] == null ? '' : campos[j]).trim();
        linhas.push(obj);
    }
    return { colunas: cab, linhas: linhas };
}

/* "Tipo_Dado", "TIPO DADO", "tipo-dado" -> "tipo_dado" */
function normalizaChave(s) {
    var t = String(s == null ? '' : s).trim().toLowerCase();
    try { t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    return t.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function ehSim(v) { return /^(1|s|sim|y|yes|true|t)$/i.test(String(v || '').trim()); }

/* Monta "varchar(255)" / "decimal(18,2)" a partir das colunas cruas do catalogo.
   O CSV carrega metadado, nao DDL pronto: assim ele serve para outras leituras
   alem desta. */
function tipoDoCatalogo(l) {
    var t = String(l.tipo_dado || '').toLowerCase();
    if (!t) return '?';
    var tam = String(l.tamanho || '').trim();
    var pre = String(l.precisao || '').trim();
    var esc = String(l.escala || '').trim();
    if (/^(varchar|char|nvarchar|nchar|varbinary|binary)$/.test(t)) {
        return tam ? t + '(' + tam + ')' : t;
    }
    if (/^(decimal|numeric)$/.test(t)) {
        return (pre ? t + '(' + pre + (esc ? ',' + esc : '') + ')' : t);
    }
    if (/^(datetime2|time|datetimeoffset)$/.test(t)) {
        return esc && esc !== '0' ? t + '(' + esc + ')' : t;
    }
    return t;
}

/* CSV do catalogo -> mesma forma que parseSql devolve, para o modelo consumir
   os dois formatos sem saber a diferenca. */
function parseEsquemaCsv(conteudo, nome) {
    /* A mesma grade pode ter sido salva como texto de largura fixa (Ctrl+T). */
    var fixo = registrosTextoFixo(conteudo);
    var bruto = fixo ? { sep: 'texto-fixo', registros: fixo } : registrosCsv(conteudo);
    var vazio = { tabelas: [], alters: [], procedures: [], pks: [], fks: [], reads: [], writes: [], bancos: [], ausentes: [], erros: [], linhas: 0 };
    if (!bruto.registros.length) return vazio;

    /* Cabecalho presente? A pergunta e feita ao contrario, pelo lado que tem
       resposta certa: a 1a celula de uma linha de DADOS so pode ser COLUNA, FK,
       AUSENTE ou ERRO. Qualquer outra coisa e cabecalho — inclusive um cabecalho
       com as colunas fora da ordem, que continua sendo lido pelos nomes. */
    var VALORES_TIPO = { coluna: 1, fk: 1, ausente: 1, erro: 1 };
    var primeiro = bruto.registros[0];
    var temCabecalho = !VALORES_TIPO[normalizaChave(primeiro[0])];
    var colunas = temCabecalho ? primeiro.map(normalizaChave) : COLUNAS_ESQUEMA;
    var dados = temCabecalho ? bruto.registros.slice(1) : bruto.registros;

    if (!dados.length) return vazio;

    if (!temCabecalho) {
        /* Sem cabecalho a leitura e posicional: a ordem tem de bater. */
        if (primeiro.length !== COLUNAS_ESQUEMA.length) {
            vazio.erro = 'CSV sem cabecalho tem ' + primeiro.length + ' colunas, esperava ' +
                COLUNAS_ESQUEMA.length + '. Sem cabecalho a leitura e posicional, entao o arquivo ' +
                'precisa vir do 01-extrair-esquema.sql desta versao. Alternativa: ligue ' +
                '"Include column headers" no SSMS e exporte de novo.';
            return vazio;
        }
    } else {
        var obrigatorias = ['tipo', 'objeto'];
        for (var o = 0; o < obrigatorias.length; o++) {
            if (colunas.indexOf(obrigatorias[o]) < 0) {
                vazio.erro = 'CSV sem a coluna "' + obrigatorias[o] + '". Ele foi gerado por ' +
                    '01-extrair-esquema.sql? Colunas encontradas: ' + colunas.join(', ') + '.';
                return vazio;
            }
        }
    }

    var csv = {
        colunas: colunas,
        linhas: dados.map(function (campos) {
            var obj = {};
            for (var j = 0; j < colunas.length; j++) {
                obj[colunas[j]] = (campos[j] == null ? '' : campos[j]).trim();
            }
            return obj;
        })
    };
    if (!csv.linhas.length) return vazio;

    var porObjeto = {};
    var fks = [];
    var ausentes = [];
    var erros = [];
    var bancos = {};

    csv.linhas.forEach(function (l) {
        var tipo = String(l.tipo || '').toUpperCase();
        var banco = String(l.banco || '').toUpperCase();

        /* Base que o script nao conseguiu ler (permissao, offline, outra
           instancia). Ela NAO entra em "bancos": dizer que foi extraida quando
           nada foi lido dela e pior do que dizer que falta extrair. */
        if (tipo === 'ERRO') {
            erros.push({ banco: banco, mensagem: l.restricao || '' });
            return;
        }
        if (banco) bancos[banco] = 1;

        if (tipo === 'AUSENTE') { if (l.objeto) ausentes.push({ banco: banco, objeto: l.objeto }); return; }

        var esquema = l.esquema || 'dbo';
        var completo = (banco ? banco + '.' : '') + esquema + '.' + l.objeto;

        if (tipo === 'FK') {
            var refCompleto = (String(l.ref_banco || banco).toUpperCase() ? String(l.ref_banco || banco).toUpperCase() + '.' : '') +
                (l.ref_esquema || 'dbo') + '.' + (l.ref_objeto || '');
            if (!l.ref_objeto) return;
            fks.push({
                tabela: completo, coluna: l.coluna,
                refTabela: refCompleto, refColuna: l.ref_coluna,
                constraint: l.restricao || '', banco: true
            });
            return;
        }

        if (tipo !== 'COLUNA') return;
        if (!l.coluna) return;
        var alvo = porObjeto[completo];
        if (!alvo) {
            alvo = porObjeto[completo] = {
                nome: completo, banco: true, bancoNome: banco, esquema: esquema,
                objeto: l.objeto,
                ehView: String(l.objeto_tipo || '').toUpperCase() === 'VIEW',
                colunas: []
            };
        }
        alvo.colunas.push({
            nome: l.coluna,
            tipo: tipoDoCatalogo(l),
            nulo: ehSim(l.nulo),
            pk: ehSim(l.pk),
            identidade: ehSim(l.identidade),
            _ordem: parseInt(l.ordem, 10) || 0
        });
    });

    var tabelas = Object.keys(porObjeto).map(function (k) {
        var t = porObjeto[k];
        t.colunas.sort(function (a, b) { return a._ordem - b._ordem; });
        t.colunas.forEach(function (c) { delete c._ordem; });
        return t;
    });

    return {
        tabelas: tabelas, alters: [], procedures: [],
        pks: [], fks: fks, reads: [], writes: [],
        bancos: Object.keys(bancos).sort(),
        ausentes: ausentes,
        erros: erros,
        linhas: csv.linhas.length
    };
}

/* ------------------------------------------------------------- properties */
function parseProperties(conteudo) {
    var chaves = [];
    var linhas = conteudo.split(/\r?\n/);
    for (var i = 0; i < linhas.length; i++) {
        var l = linhas[i].trim();
        if (!l || l.charAt(0) === '#' || l.charAt(0) === '!') continue;
        var eq = l.indexOf('=');
        if (eq > 0) chaves.push(l.substring(0, eq).trim());
    }
    return { chaves: unico(chaves), total: unico(chaves).length };
}

/* ------------------------------------------------------------- process (Graphiti/BPMN) */
function decodeXml(s) {
    return String(s || '')
        .replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
        .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(parseInt(d, 10)); })
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

function parseProcess(conteudo) {
    /* businessObjects="pool1 swimlane2 ..." e value="Rotulo" dao os nos. */
    var bos = unico((conteudo.match(/businessObjects="([^"]+)"/g) || [])
        .join(' ').replace(/businessObjects="|"/g, ' ').split(/\s+/).filter(Boolean));
    var labels = unico((conteudo.match(/value="([^"]*)"/g) || [])
        .map(function (s) { return decodeXml(s.replace(/^value="|"$/g, '').replace(/&#xA;/g, ' ')).replace(/\s+/g, ' ').trim(); })
        .filter(function (s) { return s && s.length > 1 && !/^\d+$/.test(s); }));

    var nos = bos.map(function (id) {
        var tipo = 'atividade';
        if (/start/i.test(id)) tipo = 'inicio';
        else if (/end/i.test(id)) tipo = 'fim';
        else if (/gateway|exclusive|parallel|inclusive/i.test(id)) tipo = 'gateway';
        else if (/service/i.test(id)) tipo = 'servico';
        else if (/annotation|task7|note/i.test(id)) tipo = 'anotacao';
        else if (/pool|swimlane|lane/i.test(id)) tipo = 'raia';
        return { id: id, tipo: tipo };
    });
    return { nos: nos, rotulos: labels };
}

/* ------------------------------------------------------------- process XML (ecm30) */
function parseProcessXml(conteudo) {
    var ativs = unico((conteudo.match(/<activity[^>]*\bname="([^"]+)"/g) || [])
        .map(function (s) { return s.replace(/.*name="([^"]+)".*/, '$1'); }));
    var seqs = (conteudo.match(/<sequenceFlow[^>]*>/g) || []).length;
    return { atividades: ativs, sequencias: seqs };
}

module.exports = {
    cabecalho: cabecalho,
    versoes: versoes,
    descricao: descricao,
    parseApplicationInfo: parseApplicationInfo,
    parseDataset: parseDataset,
    EVENTOS_FORM_ORDEM: EVENTOS_FORM_CONHECIDOS,
    parseFormJs: parseFormJs,
    parseFormEvento: parseFormEvento,
    parseFormHtml: parseFormHtml,
    parseFtl: parseFtl,
    parseSql: parseSql,
    parseWorkflowScript: parseWorkflowScript,
    parseWidgetJs: parseWidgetJs,
    parseCssTokens: parseCssTokens,
    parseProperties: parseProperties,
    parseProcess: parseProcess,
    parseProcessXml: parseProcessXml,
    papelPorNome: papelPorNome,
    colunasPorTabelaSql: colunasPorTabelaSql,
    ehTabelaValida: ehTabelaValida,
    partesTabela: partesTabela,
    bancoDe: bancoDe,
    parseCsv: parseCsv,
    parseEsquemaCsv: parseEsquemaCsv,
    pareceEsquemaCatalogo: pareceEsquemaCatalogo
};
