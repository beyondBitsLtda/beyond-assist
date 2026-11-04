/* =============================================================================
   grafo.js - Grafo de dependencia ARQUIVO -> ARQUIVO, organizado em camadas
   -----------------------------------------------------------------------------
   Responde a pergunta "quem chama quem?" sem executar nada: descobre as arestas
   por tres caminhos, do mais forte para o mais fraco:

     1. getDataset('dsX')          -> aresta para o arquivo do dataset dsX
     2. simbolo exportado          -> classe / namespace / funcao declarada em B
                                      citada no corpo de A
     3. SQL (reads/writes)         -> aresta do modulo para a tabela

   Cada aresta guarda a EVIDENCIA (o que casou) para o portal poder mostrar
   "por que" a seta existe. Nada e desenhado sem evidencia.
============================================================================= */
'use strict';

/* Camadas, de cima (entrada do usuario) para baixo (persistencia).
   Os TITULOS mudam com o tipo da aplicacao: chamar de "Bootstrap (SuperWidget)"
   uma camada de um projeto que nao tem widget nenhuma e documentar ficcao. */
function camadasDe(tipo) {
    var C = require('./diagrams').COR;
    var temWidget = tipo === 'widget' || tipo === 'widget-formulario';
    var temForm = tipo === 'formulario' || tipo === 'widget-formulario';
    /* Um projeto de modulos (aplicacao web, biblioteca, servico) nao tem cartao
       nem processo; chamar suas camadas de "Formulario" e "Workflow" seria
       documentar uma arquitetura que nao existe ali. */
    var modulos = !temWidget && !temForm;

    return [
        {
            id: 'apresentacao', cor: C.neutro,
            titulo: modulos ? 'Apresentacao (telas, componentes, estilos)'
                : (temWidget ? 'Apresentacao (template / HTML / CSS)' : 'Apresentacao (cartao HTML / CSS)')
        },
        { id: 'formulario', titulo: 'Formulario (eventos do cartao)', cor: C.modulo },
        { id: 'bootstrap', titulo: modulos ? 'Entrada (bootstrap)' : 'Bootstrap', cor: C.tintaForte },
        {
            id: 'orquestracao', cor: C.tinta,
            titulo: modulos ? 'Modulos e dominio' : 'Orquestracao (controller / dominio / componentes)'
        },
        { id: 'integracao', titulo: 'Integracao com outros sistemas', cor: C.dado },
        { id: 'acesso-dados', titulo: 'Acesso a dados', cor: C.acao },
        { id: 'workflow', titulo: 'Processo (eventos server-side)', cor: C.processo },
        { id: 'dataset', titulo: modulos ? 'Consultas' : 'Consultas server-side', cor: C.modulo },
        { id: 'persistencia', titulo: 'Persistencia (banco de dados)', cor: C.alerta }
    ];
}
var CAMADAS = camadasDe('widget-formulario');

/* Palavras que nunca valem como "simbolo exportado" (ruido). */
var STOP = {
    init: 1, main: 1, start: 1, load: 1, data: 1, value: 1, name: 1, item: 1, list: 1,
    index: 1, error: 1, result: 1, response: 1, request: 1, callback: 1, options: 1,
    config: 1, params: 1, format: 1, parse: 1, render: 1, update: 1, remove: 1, create: 1,
    filter: 1, search: 1, submit: 1, cancel: 1, close: 1, open: 1, show: 1, hide: 1,
    length: 1, string: 1, number: 1, object: 1, array: 1, window: 1, document: 1,
    console: 1, module: 1, exports: 1, require: 1, prototype: 1, constructor: 1,
    element: 1, target: 1, source: 1, status: 1, message: 1, content: 1, header: 1,
    footer: 1, button: 1, select: 1, insert: 1, delete: 1, table: 1, column: 1,
    dataset: 1, datasetfactory: 1, form: 1, campo: 1, campos: 1, dados: 1, lista: 1,
    valor: 1, nome: 1, tabela: 1, coluna: 1, retorno: 1, resultado: 1, acao: 1
};

function camadaDe(f) {
    switch (f.tipo) {
        case 'ftl': case 'form_html': case 'css': return 'apresentacao';
        case 'workflow_script': return 'workflow';
        case 'dataset_server': return 'dataset';
        case 'dataset_client': return 'acesso-dados';
        case 'form_js': case 'form_event_js': case 'form_aux_js': return 'formulario';
        default: break;
    }
    switch (f.role) {
        case 'bootstrap': return 'bootstrap';
        case 'controller': case 'dominio': case 'componentes': case 'helper': case 'infra': return 'orquestracao';
        case 'integracao': return 'integracao';
        case 'acesso-dados': return 'acesso-dados';
        case 'lib': return 'orquestracao';
        default: return 'orquestracao';
    }
}

/* Simbolos que um arquivo "publica" e que servem para detectar quem o usa. */
function simbolosDe(f) {
    var c = f.conteudo || '';
    var out = {};
    var m, re;

    /* classes por prototype: X.prototype.y = ... */
    re = /([A-Za-z_$][\w$]*)\.prototype\s*\./g;
    while ((m = re.exec(c))) if (m[1].length >= 4) out[m[1]] = 'classe';

    /* namespaces com ponto: capex.componentes, app.dataset ... (2+ segmentos) */
    re = /\b([a-z][\w$]{2,})((?:\.[A-Za-z_$][\w$]*){1,2})\s*=\s*(?:\{|function)/g;
    while ((m = re.exec(c))) {
        var ns = m[1] + m[2];
        if (ns.indexOf('this.') !== 0 && ns.length >= 6) out[ns] = 'namespace';
    }

    /* funcoes de topo (coluna 0) - mais provavel de ser API do modulo */
    re = /^function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
    while ((m = re.exec(c))) if (m[1].length >= 5) out[m[1]] = 'funcao';

    /* var X = function(){} / var X = {} no topo */
    re = /^var\s+([A-Z][\w$]{3,})\s*=\s*(?:function|\{)/gm;
    while ((m = re.exec(c))) out[m[1]] = 'objeto';

    /* descarta ruido */
    Object.keys(out).forEach(function (k) {
        if (STOP[k.toLowerCase()]) delete out[k];
    });
    return out;
}

/* Tira comentarios. Um import comentado nao e uma dependencia, e um nome de
   funcao citado num comentario nao e uma chamada. */
function semComentarios(c) {
    return String(c || '')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/* Tira comentarios E o CONTEUDO das strings.
   -----------------------------------------------------------------------------
   Serve a busca por simbolo: sem isso, a palavra "Controller" dentro de uma
   mensagem de erro contaria como uso do modulo Controller.

   Cuidado ao reusar: o caminho de um `import from './x.js'` E uma string, e
   passa a ser '' aqui. Quem precisa do caminho usa semComentarios() — foi
   exatamente este engano que deixou o mapa de chamadas de um projeto de modulos
   com 36 ligacoes quando havia centenas. */
function corpoUtil(c) {
    return semComentarios(c)
        .replace(/'(?:\\.|[^'\\])*'/g, "''")
        .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

/* Identificadores citados num corpo, em UMA passada.
   - plain  : identificadores que NAO vem depois de um ponto (X em "X.prototype.y")
   - dotted : caminhos completos e seus prefixos ("capex.componentes.grid" gera
              "capex.componentes" e "capex.componentes.grid")
   Uma passada por arquivo em vez de um regex por simbolo: com centenas de
   simbolos e centenas de arquivos, a diferenca e de minutos para milissegundos. */
function tokensDe(corpo) {
    var plain = {}, dotted = {};
    var re = /([A-Za-z_$][\w$]*)((?:\.[A-Za-z_$][\w$]*)*)/g;
    var m;
    while ((m = re.exec(corpo))) {
        plain[m[1]] = 1;
        if (m[2]) {
            var partes = (m[1] + m[2]).split('.');
            for (var i = 2; i <= partes.length; i++) dotted[partes.slice(0, i).join('.')] = 1;
        }
    }
    return { plain: plain, dotted: dotted };
}

/* -------------------------------------------------------------- imports */

function normalizar(p) { return String(p).replace(/\\/g, '/').replace(/^\.\//, ''); }

/* Junta um caminho relativo com o do arquivo que importa, resolvendo . e .. */
function juntar(base, rel) {
    var partes = normalizar(base).split('/');
    partes.pop();                                  /* sai o nome do arquivo */
    normalizar(rel).split('/').forEach(function (p) {
        if (p === '.' || p === '') return;
        if (p === '..') partes.pop();
        else partes.push(p);
    });
    return partes.join('/');
}

var EXTENSOES = ['', '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.css',
    '/index.js', '/index.jsx', '/index.ts', '/index.tsx'];

/* De um especificador de import ao arquivo do repositorio, quando ele existir.
   -----------------------------------------------------------------------------
   Tres formas importam aqui:
     './x'        relativo — resolve contra a pasta de quem importa
     '@/lib/x'    apelido comum (Next.js, tsconfig paths) que aponta para src/
     'react'      pacote de terceiro — NAO vira aresta: nao e codigo deste
                  repositorio, e desenha-lo faria o mapa de chamadas do projeto
                  virar um mapa do node_modules. */
function resolverImport(spec, deRel, porCaminho) {
    var s = String(spec || '');
    var candidatos = [];

    if (s.charAt(0) === '.') {
        candidatos.push(juntar(deRel, s));
    } else if (s.charAt(0) === '@' && s.charAt(1) === '/') {
        var resto = s.slice(2);
        candidatos.push('src/' + resto, resto, 'app/' + resto);
    } else if (s.charAt(0) === '~' && s.charAt(1) === '/') {
        candidatos.push('src/' + s.slice(2), s.slice(2));
    } else {
        return null;                                /* pacote de terceiro */
    }

    for (var i = 0; i < candidatos.length; i++) {
        for (var j = 0; j < EXTENSOES.length; j++) {
            var tentativa = candidatos[i] + EXTENSOES[j];
            if (porCaminho[tentativa]) return porCaminho[tentativa];
        }
    }
    return null;
}

function chaveTabela(t) { return String(t).split('.').pop().toUpperCase(); }

function baseNome(n) { return String(n).replace(/\.(js|html|ftl|css|sql)$/i, ''); }

function construir(modelo) {
    var camadas = camadasDe((modelo.meta && modelo.meta.tipoApp) || 'widget-formulario');
    var preTab = (modelo.dataModel && modelo.dataModel.prefixoTabelas) || '';
    var fontes = (modelo.fontes || []).filter(function (f) {
        return f.tipo !== 'image' && f.tipo !== 'outro' && f.tipo !== 'workflow_process_svg';
    });

    /* ---------------------------------------------------------------- nos */
    var nos = [];
    var porId = {};
    var porBase = {};

    fontes.forEach(function (f) {
        var no = {
            id: f.rel,
            nome: f.nome,
            rotulo: baseNome(f.nome),
            camada: camadaDe(f),
            tipo: f.tipo,
            role: f.role || '',
            tamanho: f.tamanho,
            linhas: f.linhas,
            arquivoIdx: f.idx,
            entradas: 0, saidas: 0
        };
        nos.push(no);
        porId[no.id] = no;
        var b = baseNome(f.nome).toLowerCase();
        (porBase[b] = porBase[b] || []).push(no);
    });

    /* nos de persistencia: uma caixa por tabela efetivamente acessada */
    var tabNo = {};
    modelo.rastreabilidade.tabelas.forEach(function (t) {
        var ent = null;
        for (var i = 0; i < modelo.dataModel.entidades.length; i++) {
            if (modelo.dataModel.entidades[i].chave === t) { ent = modelo.dataModel.entidades[i]; break; }
        }
        var no = {
            id: 'tabela:' + t,
            nome: t,
            rotulo: preTab && t.indexOf(preTab) === 0 ? t.slice(preTab.length) : t,
            camada: 'persistencia',
            tipo: 'tabela',
            origem: ent ? ent.origem : 'externa',
            fonte: ent ? ent.fonte : 'inferido',
            entradas: 0, saidas: 0
        };
        nos.push(no);
        porId[no.id] = no;
        tabNo[t] = no;
    });

    /* ------------------------------------------------------------ arestas */
    var arestas = [];
    var vistas = {};
    function ligar(de, para, tipo, evidencia) {
        if (!de || !para || de === para) return;
        if (!porId[de] || !porId[para]) return;
        var k = de + '\u0000' + para + '\u0000' + tipo;
        if (vistas[k]) {
            if (evidencia && vistas[k].evidencias.indexOf(evidencia) < 0 && vistas[k].evidencias.length < 6) {
                vistas[k].evidencias.push(evidencia);
            }
            vistas[k].peso++;
            return;
        }
        var a = { de: de, para: para, tipo: tipo, peso: 1, evidencias: evidencia ? [evidencia] : [] };
        vistas[k] = a;
        arestas.push(a);
    }

    /* 1) indice de simbolos por arquivo */
    var indice = [];
    fontes.forEach(function (f) {
        if (!/\.js$/i.test(f.nome)) return;
        if (/\.min\.js$/i.test(f.nome)) return;   /* libs minificadas nao publicam API legivel */
        var s = simbolosDe(f);
        Object.keys(s).forEach(function (sym) {
            indice.push({ sym: sym, tipoSym: s[sym], arquivo: f.rel });
        });
    });
    /* simbolo ambiguo (declarado em 2+ arquivos) nao serve de evidencia */
    var cont = {};
    indice.forEach(function (x) { cont[x.sym] = (cont[x.sym] || 0) + 1; });
    indice = indice.filter(function (x) { return cont[x.sym] === 1; });

    /* 1b) IMPORTS — a evidencia mais forte que existe num projeto JS/TS.
       -------------------------------------------------------------------------
       Um `import x from './y.js'` nao e heuristica: e o arquivo dizendo, por
       escrito, de quem ele depende. Antes o grafo so tinha a busca por simbolo,
       que funciona numa aplicacao de baixo codigo (onde os arquivos se enxergam
       por variaveis globais) e quase nao acha nada num projeto de modulos, onde
       o simbolo importado costuma ter o mesmo nome em varios arquivos e cai na
       regra do "ambiguo nao serve de evidencia".

       Por isso este passo vem ANTES: onde ha import, ele e a verdade. */
    var porCaminho = {};
    fontes.forEach(function (f) { porCaminho[normalizar(f.rel)] = f.rel; });

    fontes.forEach(function (f) {
        if (!f.conteudo || !/\.(js|jsx|mjs|cjs|ts|tsx)$/i.test(f.nome)) return;
        if (/\.min\.js$/i.test(f.nome)) return;
        var corpo = semComentarios(f.conteudo);
        var specs = [];
        var re, m;

        re = /\bfrom\s*['"]([^'"]+)['"]/g;
        while ((m = re.exec(corpo))) specs.push(m[1]);
        re = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((m = re.exec(corpo))) specs.push(m[1]);
        re = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((m = re.exec(corpo))) specs.push(m[1]);
        re = /\bimport\s+['"]([^'"]+)['"]/g;      /* import './x.css' */
        while ((m = re.exec(corpo))) specs.push(m[1]);

        specs.forEach(function (spec) {
            var alvo = resolverImport(spec, f.rel, porCaminho);
            if (alvo) ligar(f.rel, alvo, 'import', spec);
        });
    });

    /* 2) varre cada arquivo procurando simbolos dos outros */
    fontes.forEach(function (f) {
        if (/\.min\.js$/i.test(f.nome)) return;
        if (!f.conteudo) return;
        var toks = tokensDe(corpoUtil(f.conteudo));
        indice.forEach(function (x) {
            if (x.arquivo === f.rel) return;
            var achou = x.sym.indexOf('.') >= 0 ? toks.dotted[x.sym] : toks.plain[x.sym];
            if (achou) ligar(f.rel, x.arquivo, 'simbolo', x.sym);
        });
    });

    /* 3) getDataset('X') -> arquivo do dataset */
    var chamadasDe = {};
    function registraChamadas(nome, lista) { chamadasDe[nome] = lista || []; }
    modelo.datasets.forEach(function (d) { registraChamadas(d.nome, d.chama); });
    modelo.workflow.scripts.forEach(function (s) { registraChamadas(s.nome, s.chama); });
    modelo.widget.js.forEach(function (w) { registraChamadas(w.nome, w.chama); });
    modelo.datasetsClient.forEach(function (w) { registraChamadas(w.nome, w.chama); });
    modelo.formularios.forEach(function (fo) { if (fo.js) registraChamadas(fo.js.nome, fo.js.chama); });

    fontes.forEach(function (f) {
        var chama = chamadasDe[f.nome];
        if (!chama || !chama.length) return;
        chama.forEach(function (dsNome) {
            var alvos = porBase[String(dsNome).toLowerCase()];
            if (!alvos || !alvos.length) return;
            /* prefere o dataset server-side, se houver homonimo client */
            var alvo = alvos.filter(function (n) { return n.tipo === 'dataset_server'; })[0] || alvos[0];
            ligar(f.rel, alvo.id, 'dataset', "getDataset('" + dsNome + "')");
        });
    });

    /* 4) modulo -> tabela (leitura/escrita) */
    modelo.rastreabilidade.modulos.forEach(function (mod) {
        var arq = null;
        for (var i = 0; i < fontes.length; i++) { if (fontes[i].nome === mod.nome) { arq = fontes[i]; break; } }
        if (!arq) return;
        (mod.reads || []).forEach(function (t) {
            var no = tabNo[chaveTabela(t)];
            if (no) ligar(arq.rel, no.id, 'le', t);
        });
        (mod.writes || []).forEach(function (t) {
            var no = tabNo[chaveTabela(t)];
            if (no) ligar(arq.rel, no.id, 'grava', t);
        });
    });

    /* 5) par formulario HTML <-> JS */
    modelo.formularios.forEach(function (fo) {
        if (!fo.html || !fo.js) return;
        var h = null, j = null;
        fontes.forEach(function (f) {
            if (f.nome === fo.html.nome) h = f;
            if (f.nome === fo.js.nome) j = f;
        });
        if (h && j) ligar(h.rel, j.rel, 'par', 'formulario ' + fo.base);
    });

    /* graus */
    arestas.forEach(function (a) {
        if (porId[a.de]) porId[a.de].saidas++;
        if (porId[a.para]) porId[a.para].entradas++;
    });

    /* remove nos totalmente isolados de camadas ruidosas (css/imagem sem ligacao) */
    var usados = nos.filter(function (n) {
        if (n.entradas || n.saidas) return true;
        return n.camada !== 'apresentacao';
    });

    var ativo = {};
    usados.forEach(function (n) { ativo[n.id] = 1; });

    var porCamada = {};
    camadas.forEach(function (c) { porCamada[c.id] = []; });
    usados.forEach(function (n) { (porCamada[n.camada] = porCamada[n.camada] || []).push(n); });
    Object.keys(porCamada).forEach(function (k) {
        porCamada[k].sort(function (a, b) {
            var d = (b.entradas + b.saidas) - (a.entradas + a.saidas);
            return d !== 0 ? d : (a.rotulo < b.rotulo ? -1 : 1);
        });
    });

    return {
        camadas: camadas,
        nos: usados,
        porCamada: porCamada,
        arestas: arestas.filter(function (a) { return ativo[a.de] && ativo[a.para]; })
    };
}

module.exports = { construir: construir, CAMADAS: CAMADAS, camadasDe: camadasDe, camadaDe: camadaDe };
