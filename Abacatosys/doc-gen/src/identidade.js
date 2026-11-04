/* =============================================================================
   identidade.js - QUEM e a aplicacao que esta sendo documentada
   -----------------------------------------------------------------------------
   Antes de extrair qualquer metadado, o docgen precisa responder duas perguntas:

     1. Como esta aplicacao se chama?   -> nomeia o portal e a pasta esquema-sql
     2. Que TIPO de aplicacao e esta?   -> define quais camadas de arquitetura
                                           fazem sentido desenhar

   Regra do projeto ("dado sem fonte nao e dado"): cada conclusao aqui guarda a
   EVIDENCIA que a sustenta, e o portal mostra essa evidencia.

   TIPOS reconhecidos:
     widget             widget da plataforma (application.info + view.ftl + resources/js)
     widget-formulario  widget que tambem traz o formulario do processo
     formulario         formulario de processo (cartao HTML + eventos)

   Na duvida assume-se FORMULARIO: e o caso mais comum e o mais conservador -
   um formulario nao desenha camadas de widget que nao existem.
============================================================================= */
'use strict';

var path = require('path');
var TIPO = require('./scan').TIPO;

var ROTULO_TIPO = {
    'aplicacao-web': 'Aplicacao web',
    'biblioteca': 'Biblioteca',
    'servico': 'Servico / API',
    'widget': 'Aplicacao de interface',
    'widget-formulario': 'Interface com telas de processo',
    'formulario': 'Telas de processo',
    'projeto': 'Projeto'
};

/* ------------------------------------------------------------- manifestos */
/* Como cada ecossistema diz o proprio nome.
   -----------------------------------------------------------------------------
   E dai que sai o nome do portal quando o repositorio nao e uma aplicacao de
   formulario. Ler o manifesto e melhor que usar o nome da pasta por um motivo
   pratico: a pasta costuma se chamar "main", "repo-novo" ou o nome que a pessoa
   deu ao clonar, e nenhum deles e o nome do sistema. */
function lerManifesto(arquivo) {
    var nome = String(arquivo.nome || '').toLowerCase();
    var texto = '';
    try { texto = arquivo.lerConteudo() || ''; } catch (e) { return null; }
    if (!texto) return null;

    if (nome === 'package.json') {
        try {
            var p = JSON.parse(texto);
            return {
                ecossistema: 'Node.js',
                nome: p.name || '',
                descricao: p.description || '',
                versao: p.version || '',
                /* Uma biblioteca publica um ponto de entrada; uma aplicacao tem
                   scripts para subir. A diferenca muda o tipo declarado. */
                ehBiblioteca: Boolean(p.main || p.exports) && !(p.scripts && (p.scripts.dev || p.scripts.start)),
                dependencias: Object.keys(p.dependencies || {}),
                scripts: Object.keys(p.scripts || {})
            };
        } catch (e) { return null; }
    }
    if (nome === 'pyproject.toml' || nome === 'cargo.toml') {
        var mn = texto.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
        var md = texto.match(/^\s*description\s*=\s*["']([^"']+)["']/m);
        var mv = texto.match(/^\s*version\s*=\s*["']([^"']+)["']/m);
        return {
            ecossistema: nome === 'cargo.toml' ? 'Rust' : 'Python',
            nome: mn ? mn[1] : '', descricao: md ? md[1] : '', versao: mv ? mv[1] : '',
            dependencias: [], scripts: []
        };
    }
    if (nome === 'go.mod') {
        var mg = texto.match(/^\s*module\s+(\S+)/m);
        var caminho = mg ? mg[1] : '';
        return {
            ecossistema: 'Go',
            /* "github.com/org/projeto" -> "projeto": o modulo Go e um caminho, e
               o caminho inteiro no titulo do portal nao diz nada a mais. */
            nome: caminho.split('/').pop() || '',
            descricao: '', versao: '', dependencias: [], scripts: []
        };
    }
    if (nome === 'composer.json') {
        try {
            var c = JSON.parse(texto);
            return {
                ecossistema: 'PHP', nome: (c.name || '').split('/').pop() || '',
                descricao: c.description || '', versao: c.version || '',
                dependencias: Object.keys(c.require || {}), scripts: []
            };
        } catch (e) { return null; }
    }
    if (nome === 'pom.xml') {
        var ma = texto.match(/<artifactId>\s*([^<]+?)\s*<\/artifactId>/);
        var mdesc = texto.match(/<description>\s*([^<]+?)\s*<\/description>/);
        return {
            ecossistema: 'Java / Maven', nome: ma ? ma[1] : '',
            descricao: mdesc ? mdesc[1] : '', versao: '', dependencias: [], scripts: []
        };
    }
    return null;
}

/* Qual manifesto manda, quando ha varios (monorepo, subprojetos).
   O da RAIZ ganha: um package.json tres pastas abaixo descreve um pedaco, nao
   o repositorio. */
function escolherManifesto(arquivos) {
    var candidatos = arquivos.filter(function (a) { return a.tipo === TIPO.MANIFESTO; });
    if (!candidatos.length) return { escolhido: null, manifesto: null, outros: [] };

    var ordenados = candidatos.slice().sort(function (a, b) {
        var pa = rel(a).split('/').length, pb = rel(b).split('/').length;
        if (pa !== pb) return pa - pb;                       /* mais raso ganha */
        /* Entre irmaos, package.json ganha: e o mais informativo. */
        var na = a.nome.toLowerCase() === 'package.json' ? 0 : 1;
        var nb = b.nome.toLowerCase() === 'package.json' ? 0 : 1;
        return na - nb;
    });

    for (var i = 0; i < ordenados.length; i++) {
        var lido = lerManifesto(ordenados[i]);
        if (lido && lido.nome) {
            return {
                escolhido: ordenados[i],
                manifesto: lido,
                outros: ordenados.filter(function (_, j) { return j !== i; }).map(rel)
            };
        }
    }
    return { escolhido: null, manifesto: null, outros: ordenados.map(rel) };
}

/* -------------------------------------------------------------------- texto */
function semAcento(s) {
    try { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
    catch (e) { return String(s); }
}

/* Nome seguro para arquivo/pasta, preservando o CamelCase do application.code. */
function slugificar(s) {
    var t = semAcento(s || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return t || 'aplicacao';
}

function unico(arr) {
    var seen = {}, out = [];
    arr.forEach(function (x) { var k = String(x); if (!seen[k]) { seen[k] = 1; out.push(x); } });
    return out;
}

function rel(a) { return String(a.rel || a.nome).replace(/\\/g, '/'); }

/* ------------------------------------------------------- application.info */
/* Uma pasta real tem varias copias: application.info, application.info.txt,
   "application - Copia.info.txt", aplication.info.txt (com typo). Escolher a
   errada muda a ordem de carregamento inteira do diagrama, entao a escolha e
   explicita: o arquivo canonico ganha, e as outras copias viram aviso. */
function escolherAppInfo(arquivos) {
    var candidatos = arquivos.filter(function (a) { return a.tipo === TIPO.APP_INFO; });
    if (!candidatos.length) return { escolhido: null, ignorados: [] };

    function nota(a) {
        var n = String(a.nome).toLowerCase();
        var p = rel(a).toLowerCase();
        var s = 0;
        if (n !== 'application.info') s += 100;            /* .txt e variantes perdem */
        if (/copia|copy|bkp|backup|old/.test(p)) s += 400;  /* copia nunca e a verdade */
        if (/nova pasta|temp|tmp|rascunho/.test(p)) s += 200;
        s += p.split('/').length;                           /* menos profundo ganha */
        return s;
    }
    var ordenados = candidatos.slice().sort(function (a, b) {
        var d = nota(a) - nota(b);
        return d !== 0 ? d : (rel(a) < rel(b) ? -1 : 1);
    });
    return {
        escolhido: ordenados[0],
        ignorados: ordenados.slice(1).map(function (a) { return rel(a); })
    };
}

/* ------------------------------------------------------------ formularios */
/* A chave de um formulario e a PASTA dele dentro de forms/, nao o nome do
   arquivo: "forms/429601 - pedidoCompraCapex" e "forms/pedidoCompraCapex" sao
   dois formularios diferentes (um publicado, outro nao), e juntar os dois numa
   entrada so faz uma documentacao sobrescrever a outra. */
function chaveFormulario(relPath) {
    var p = String(relPath).replace(/\\/g, '/');
    var m = p.match(/(?:^|\/)forms\/([^/]+)(\/?)/i);
    if (!m) return '';
    if (!m[2] && /\.[A-Za-z0-9]{1,6}$/.test(m[1])) return m[1].replace(/\.[^.]+$/, '');
    return m[1];
}

/* "429601 - pedidoCompraCapex" -> { id: '429601', base: 'pedidoCompraCapex' } */
function partesFormulario(chave) {
    var m = String(chave).match(/^(\d+)\s*[-_]\s*(.+)$/);
    if (m) return { id: m[1], base: m[2].trim() };
    return { id: '', base: String(chave).trim() };
}

/* ------------------------------------------------------------- prefixos */
/* O gerador nao pode assumir as convencoes de UM projeto. Estes prefixos sao
   descobertos no proprio codigo da aplicacao analisada. */

/* Raizes de namespace: "var capex = capex || {}" / "app.dataset = function(){}" */
function raizesNamespace(textos) {
    var cont = {};
    textos.forEach(function (c) {
        var m, re;
        re = /\b([a-z][\w$]{2,})\s*=\s*\1\s*\|\|\s*\{\s*\}/g;
        while ((m = re.exec(c))) cont[m[1]] = (cont[m[1]] || 0) + 5;
        re = /\b([a-z][\w$]{2,})((?:\.[A-Za-z_$][\w$]*){1,2})\s*=\s*(?:\{|function)/g;
        while ((m = re.exec(c))) cont[m[1]] = (cont[m[1]] || 0) + 1;
    });
    /* nomes de API do navegador / a plataforma nunca sao namespace da aplicacao */
    var proibido = {
        window: 1, document: 1, console: 1, module: 1, exports: 1, self: 1, globalthis: 1,
        jquery: 1, moment: 1, numeral: 1, chart: 1, exceljs: 1, bootstrap: 1, fluigapi: 1,
        object: 1, array: 1, string: 1, number: 1, math: 1, json: 1, date: 1, promise: 1,
        prototype: 1, constructor: 1, options: 1, config: 1, data: 1, form: 1, item: 1
    };
    return Object.keys(cont)
        .filter(function (k) { return !proibido[k.toLowerCase()] && cont[k] >= 3; })
        .sort(function (a, b) { return cont[b] - cont[a]; })
        .slice(0, 6);
}

/* Prefixo de bloco BEM no CSS: ".capex-tabela" -> "capex" */
function prefixosCss(textos) {
    var cont = {};
    textos.forEach(function (c) {
        var m, re = /\.([a-z][a-z0-9]{1,})-[a-z0-9]/g;
        while ((m = re.exec(c))) cont[m[1]] = (cont[m[1]] || 0) + 1;
    });
    var proibido = { fluig: 1, col: 1, btn: 1, form: 1, input: 1, text: 1, bg: 1, d: 1, ml: 1, mr: 1, mt: 1, mb: 1, pt: 1, pb: 1 };
    return Object.keys(cont)
        .filter(function (k) { return !proibido[k] && cont[k] >= 3; })
        .sort(function (a, b) { return cont[b] - cont[a]; })
        .slice(0, 4);
}

/* Prefixo de data-attribute proprio: data-capex-tab -> "capex" */
function prefixosData(textos) {
    var cont = {};
    textos.forEach(function (c) {
        var m, re = /data-([a-z][a-z0-9]{1,})-[a-z0-9-]+\s*=/g;
        while ((m = re.exec(c))) cont[m[1]] = (cont[m[1]] || 0) + 1;
    });
    var proibido = { bs: 1, toggle: 1, target: 1, fluig: 1, aria: 1 };
    return Object.keys(cont)
        .filter(function (k) { return !proibido[k] && cont[k] >= 2; })
        .sort(function (a, b) { return cont[b] - cont[a]; })
        .slice(0, 4);
}

/* ---------------------------------------------------------------- derivar */
function derivar(root, arquivos) {
    var avisos = [];
    var esc = escolherAppInfo(arquivos);
    var info = { code: '', title: '', type: '', bruto: '' };

    if (esc.escolhido) {
        var c = '';
        try { c = esc.escolhido.lerConteudo(); } catch (e) { c = ''; }
        info.bruto = c;
        var mc = c.match(/^\s*application\.code\s*=\s*(.+)$/m);
        var mt = c.match(/^\s*application\.title\s*=\s*(.+)$/m);
        var mp = c.match(/^\s*application\.type\s*=\s*(.+)$/m);
        if (mc) info.code = mc[1].trim();
        if (mt) info.title = mt[1].trim();
        if (mp) info.type = mp[1].trim();
        if (esc.ignorados.length) {
            avisos.push('Varias copias de application.info encontradas. Usada: ' +
                rel(esc.escolhido) + '. Ignoradas: ' + esc.ignorados.join(', ') + '.');
        }
    }

    /* ------------------------------------------------ evidencias por arquivo */
    var ev = {
        widget: [], formulario: [], workflow: [], dataset: [], sql: []
    };
    var forms = {};      /* chave da pasta -> { arquivos: [] } */
    var textosJs = [], textosCss = [], textosMarkup = [];

    arquivos.forEach(function (a) {
        var r = rel(a);
        var conteudo = '';
        var precisaTexto = a.ext === '.js' || a.ext === '.css' || a.ext === '.html' ||
            a.ext === '.htm' || a.ext === '.ftl';
        if (precisaTexto) { try { conteudo = a.lerConteudo() || ''; } catch (e) { conteudo = ''; } }
        if (a.ext === '.js') textosJs.push(conteudo);
        else if (a.ext === '.css') textosCss.push(conteudo);
        else if (precisaTexto) textosMarkup.push(conteudo);

        /* --- widget --- */
        if (/\/wcm\/widget\//i.test('/' + r)) ev.widget.push(r);
        else if (a.contexto === 'wcm/resources/js' || a.contexto === 'wcm/resources/css') ev.widget.push(r);
        else if (a.ext === '.ftl') ev.widget.push(r);

        /* --- formulario --- */
        var kf = chaveFormulario(r);
        if (kf) {
            (forms[kf] = forms[kf] || { arquivos: [] }).arquivos.push(r);
            if (a.tipo === TIPO.FORM_HTML || a.tipo === TIPO.FORM_JS || a.tipo === TIPO.FORM_EVENT_JS) {
                ev.formulario.push(r);
            }
        } else if (a.tipo === TIPO.FORM_JS || a.tipo === TIPO.FORM_EVENT_JS) {
            ev.formulario.push(r);
        }

        /* --- workflow / datasets / sql --- */
        if (a.tipo === TIPO.WORKFLOW_SCRIPT || a.tipo === TIPO.WORKFLOW_PROCESS ||
            a.tipo === TIPO.WORKFLOW_PROCESS_XML || a.tipo === TIPO.WORKFLOW_PROCESS_SVG) ev.workflow.push(r);
        if (a.tipo === TIPO.DATASET_SERVER) ev.dataset.push(r);
        if (a.tipo === TIPO.SQL) ev.sql.push(r);
    });

    /* application.type=widget e evidencia declarada, vale por si */
    if (/widget/i.test(info.type)) ev.widget.unshift('application.info (application.type=' + info.type + ')');

    var temWidget = ev.widget.length > 0;
    var temForm = ev.formulario.length > 0;

    /* ------------------------------------------------ que tipo de projeto e este
       A ordem e uma escala de confianca, da evidencia mais forte para a mais
       fraca. Um manifesto e uma DECLARACAO do proprio projeto sobre si mesmo:
       ganha de qualquer heuristica de pasta. Abaixo dele vem a estrutura de
       formulario e processo, que e evidencia de arquivo. Na falta das duas, o
       honesto e dizer "projeto" — e nao chutar um tipo que muda os diagramas. */
    var man = escolherManifesto(arquivos);
    var manifesto = man.manifesto;

    var tipo;
    if (manifesto) {
        tipo = manifesto.ehBiblioteca ? 'biblioteca'
            : (temForm || temWidget ? (temWidget && temForm ? 'widget-formulario' : (temWidget ? 'widget' : 'formulario'))
                : 'aplicacao-web');
    } else if (temWidget || temForm) {
        tipo = temWidget && temForm ? 'widget-formulario' : (temWidget ? 'widget' : 'formulario');
    } else {
        tipo = 'projeto';
    }

    /* ------------------------------------------------------------- nome */
    var origemNome = '';
    var appCode = info.code;
    if (appCode) origemNome = 'application.code (' + rel(esc.escolhido) + ')';

    if (!appCode) {
        /* .project do Eclipse/TOTVS Designer: <name>formularioRetrabalho</name> */
        for (var i = 0; i < arquivos.length && !appCode; i++) {
            if (arquivos[i].tipo !== TIPO.ECLIPSE_PROJECT) continue;
            var cp = '';
            try { cp = arquivos[i].lerConteudo(); } catch (e) { continue; }
            var mn = cp.match(/<name>\s*([^<]+?)\s*<\/name>/);
            if (mn && mn[1]) { appCode = mn[1].trim(); origemNome = '.project (' + rel(arquivos[i]) + ')'; }
        }
    }
    if (!appCode && manifesto && manifesto.nome) {
        appCode = manifesto.nome;
        origemNome = man.escolhido.nome + ' (' + rel(man.escolhido) + ')';
    }
    if (!appCode) {
        /* pasta unica de formulario: o nome do formulario E o nome do projeto */
        var chaves = Object.keys(forms);
        if (chaves.length === 1) {
            appCode = partesFormulario(chaves[0]).base;
            origemNome = 'pasta do formulario (forms/' + chaves[0] + ')';
        }
    }
    if (!appCode) {
        appCode = path.basename(root);
        origemNome = 'nome da pasta raiz';
    }
    if (!appCode) { appCode = 'aplicacao'; origemNome = 'padrao'; }

    /* ------------------------------------------------------- formularios */
    var listaForms = Object.keys(forms).sort().map(function (k) {
        var p = partesFormulario(k);
        return { chave: k, base: p.base, idDataset: p.id, arquivos: forms[k].arquivos };
    });
    /* duas pastas com o mesmo nome de formulario: avisa em vez de escolher uma */
    var porBase = {};
    listaForms.forEach(function (f) { (porBase[f.base.toLowerCase()] = porBase[f.base.toLowerCase()] || []).push(f); });
    Object.keys(porBase).forEach(function (b) {
        if (porBase[b].length < 2) return;
        avisos.push('Formulario "' + porBase[b][0].base + '" aparece em ' + porBase[b].length +
            ' pastas (' + porBase[b].map(function (f) { return 'forms/' + f.chave; }).join(', ') +
            '). Cada pasta foi documentada separadamente — remova as copias do repositorio.');
    });

    var todosTextos = textosJs.concat(textosCss).concat(textosMarkup);
    var usaDatasetFactory = todosTextos.some(function (c) {
        return /DatasetFactory|WKDataset|getDataset\s*\(/.test(c);
    });

    if (manifesto && man.outros.length) {
        avisos.push('Este repositorio tem ' + (man.outros.length + 1) + ' manifestos. ' +
            'Usado o da raiz (' + rel(man.escolhido) + '); os outros descrevem subprojetos e ' +
            'nao foram lidos como identidade: ' + man.outros.slice(0, 6).join(', ') + '.');
    }

    return {
        appCode: appCode,
        appTitle: info.title || (manifesto ? manifesto.nome : ''),
        appDescricao: manifesto ? manifesto.descricao : '',
        appVersao: manifesto ? manifesto.versao : '',
        ecossistema: manifesto ? manifesto.ecossistema : '',
        dependencias: manifesto ? (manifesto.dependencias || []) : [],
        scripts: manifesto ? (manifesto.scripts || []) : [],
        manifesto: man.escolhido ? rel(man.escolhido) : '',
        appTypeDeclarado: info.type || '',
        origemNome: origemNome,
        slug: slugificar(appCode),
        tipo: tipo,
        tipoRotulo: ROTULO_TIPO[tipo],
        appInfo: esc.escolhido ? rel(esc.escolhido) : '',
        appInfoIgnorados: esc.ignorados,
        temWidget: temWidget,
        temFormulario: temForm,
        temWorkflow: ev.workflow.length > 0,
        temDatasets: ev.dataset.length > 0,
        temSql: ev.sql.length > 0,
        usaDatasetFactory: usaDatasetFactory,
        formularios: listaForms,
        evidencias: {
            widget: unico(ev.widget).slice(0, 12),
            formulario: unico(ev.formulario).slice(0, 12),
            workflow: unico(ev.workflow).slice(0, 12),
            dataset: unico(ev.dataset).slice(0, 12)
        },
        prefixos: {
            namespace: raizesNamespace(textosJs),
            css: prefixosCss(textosCss),
            data: prefixosData(textosMarkup.concat(textosJs))
        },
        avisos: avisos
    };
}

module.exports = {
    derivar: derivar,
    slugificar: slugificar,
    chaveFormulario: chaveFormulario,
    partesFormulario: partesFormulario,
    ROTULO_TIPO: ROTULO_TIPO
};
