/* =============================================================================
   diagrams.js - Geracao de diagramas em SVG NATIVO (100% offline, sem libs)
   -----------------------------------------------------------------------------
   Gera:
     1. arquitetura()     camadas do sistema, com TODOS os modulos (sem corte)
     2. fluxograma()      o fluxo de execucao desenhado de fato (nada de mermaid)
     3. camadasCarga()    ordem de carga do application.info, tudo visivel
     4. grafoChamadas()   quem chama quem, arquivo a arquivo, dividido em camadas

   Regras desta versao:
     - Nenhum item e escondido atras de "+N". Tudo que existe aparece.
     - Toda caixa carrega <title> com o nome completo (tooltip nativo do browser).
     - Diagramas largos usam largura fixa e rolagem horizontal, em vez de
       encolher a ponto de ninguem conseguir ler.
============================================================================= */
'use strict';

/* Paleta por papel — ver COR abaixo. */
/* A paleta dos diagramas, por PAPEL e nao por marca.
   -----------------------------------------------------------------------------
   Antes estes nomes eram unidades de negocio de uma empresa (subsea, mooring,
   industria, servicos). Um gerador que documenta qualquer repositorio nao tem
   como saber de que unidade uma tabela e — e nao precisa. O que ele sabe e o
   PAPEL de cada coisa no desenho: isto le, aquilo grava, aquele outro e um
   modulo. Nomear pelo papel tambem faz o diagrama se explicar sozinho para quem
   nunca viu a legenda.

   Os valores vem do Abacato System, para o portal parecer parte dele. */
var COR = {
    acao: '#22C55E', acaoEscura: '#10B981', acaoClara: '#D8EBDD',       /* le, ok, identidade */
    alerta: '#EF4444', alertaEscuro: '#DC2626', alertaClaro: '#FEE2E2', /* grava, destrutivo */
    dado: '#3B82F6',                                                    /* dados, consultas */
    modulo: '#6366F1',                                                  /* modulo de codigo */
    processo: '#F97316',                                                /* processo, evento */
    tinta: '#1F2937', tintaForte: '#111827', tinta2: '#6B7280',
    linha: '#E5E7EB', fundo: '#FFFFFF', painel: '#F4F6F5',
    neutro: '#9CA3AF', neutro2: '#E5E7EB'
};
var FONTE = "'Inter',system-ui,-apple-system,'Segoe UI',sans-serif";

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function trunc(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

/* Quantos caracteres cabem numa caixa de largura w, na fonte tamanho fs. */
function cabe(w, fs) { return Math.max(3, Math.floor((w - 14) / (fs * 0.54))); }

/* ---------- primitivas SVG ---------- */
function caixa(x, y, w, h, opt) {
    opt = opt || {};
    var fill = opt.fill || COR.fundo;
    var stroke = opt.stroke || COR.linha;
    var rx = opt.rx == null ? 8 : opt.rx;
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
        '" rx="' + rx + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (opt.sw || 1.2) + '"/>';
}
function texto(x, y, s, opt) {
    opt = opt || {};
    return '<text x="' + x + '" y="' + y + '" font-family="' + FONTE + '" font-size="' + (opt.size || 12) +
        '" font-weight="' + (opt.weight || 500) + '" fill="' + (opt.fill || COR.tinta) +
        '" text-anchor="' + (opt.anchor || 'start') + '"' +
        (opt.extra ? ' ' + opt.extra : '') + '>' + esc(s) + '</text>';
}

/* Caixa rotulada com tooltip nativo: o nome completo aparece ao passar o mouse,
   mesmo quando o texto foi truncado para caber. */
function caixaRotulada(x, y, w, h, rotulo, opt) {
    opt = opt || {};
    var fs = opt.size || 10.5;
    var completo = opt.titulo || rotulo;
    var visivel = trunc(rotulo, opt.max || cabe(w, fs));
    var g = '<g class="dg-node' + (opt.cls ? ' ' + opt.cls : '') + '"' +
        (opt.attrs ? ' ' + opt.attrs : '') + '>';
    g += '<title>' + esc(completo) + '</title>';
    g += caixa(x, y, w, h, opt);
    if (opt.sub) {
        g += texto(x + w / 2, y + h / 2 - 1, visivel, { size: fs, weight: 600, anchor: 'middle', fill: opt.corTexto || COR.tinta });
        g += texto(x + w / 2, y + h / 2 + 11, trunc(opt.sub, cabe(w, 8.5)), { size: 8.5, weight: 500, anchor: 'middle', fill: COR.tinta2 });
    } else {
        g += texto(x + w / 2, y + h / 2 + fs / 2 - 1, visivel, { size: fs, weight: 600, anchor: 'middle', fill: opt.corTexto || COR.tinta });
    }
    g += '</g>';
    return g;
}

function seta(x1, y1, x2, y2, opt) {
    opt = opt || {};
    var cor = opt.cor || COR.tinta2;
    var dash = opt.dash ? ' stroke-dasharray="5 4"' : '';
    return '<path d="M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2 + '" stroke="' + cor +
        '" stroke-width="' + (opt.sw || 1.6) + '" fill="none" marker-end="url(#' + marcador(cor) + ')"' + dash + '/>';
}
function curva(x1, y1, x2, y2, opt) {
    opt = opt || {};
    var cor = opt.cor || COR.tinta2;
    var dash = opt.dash ? ' stroke-dasharray="5 4"' : '';
    var dy = Math.max(18, Math.abs(y2 - y1) * 0.42);
    return '<path d="M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + (y1 + dy) + ' ' + x2 + ' ' + (y2 - dy) + ' ' + x2 + ' ' + y2 +
        '" stroke="' + cor + '" stroke-width="' + (opt.sw || 1.5) + '" fill="none" marker-end="url(#' + marcador(cor) + ')"' +
        dash + ' opacity="' + (opt.op == null ? 0.85 : opt.op) + '"' +
        (opt.attrs ? ' ' + opt.attrs : '') + (opt.cls ? ' class="' + opt.cls + '"' : '') + '/>';
}

/* Um marcador de seta por cor (o SVG nao herda 'stroke' no marker-end). */
var MARCADORES = {};
function marcador(cor) {
    var id = 'seta' + String(cor).replace(/[^\w]/g, '');
    MARCADORES[id] = cor;
    return id;
}
function defsMarkers() {
    var d = '<defs>';
    Object.keys(MARCADORES).forEach(function (id) {
        d += '<marker id="' + id + '" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">' +
            '<path d="M0,0 L7,3 L0,6 Z" fill="' + MARCADORES[id] + '"/></marker>';
    });
    return d + '</defs>';
}

function svg(w, h, corpo, opt) {
    opt = opt || {};
    /* largura fixa (com rolagem) quando o desenho for grande demais para encolher */
    var dim = opt.fixo
        ? 'width="' + w + '" height="' + h + '" style="max-width:none;background:' + COR.fundo + '"'
        : 'width="100%" style="max-width:100%;height:auto;background:' + COR.fundo + '"';
    var s = '<svg viewBox="0 0 ' + w + ' ' + h + '" ' + dim +
        ' preserveAspectRatio="xMidYMin meet" xmlns="http://www.w3.org/2000/svg" role="img"' +
        (opt.cls ? ' class="' + opt.cls + '"' : '') + '>' +
        defsMarkers() + corpo + '</svg>';
    MARCADORES = {};
    return s;
}

function dedup(arr) { var s = {}, o = []; arr.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }

/* =============================================================================
   1) ARQUITETURA DO SISTEMA - camadas horizontais, TODOS os modulos visiveis
   -----------------------------------------------------------------------------
   As camadas NAO sao fixas: sao montadas conforme o TIPO da aplicacao.
   Um formulario de processo nao tem bootstrap de SuperWidget nem view.ftl;
   uma widget nao tem cartao nem displayFields. Desenhar a banda de qualquer
   forma - vazia, ou pior, preenchida com o que sobrou - documentaria uma
   arquitetura que nao existe. Banda sem item nao entra no desenho.
============================================================================= */

function semExt(n) { return String(n).replace(/\.(js|css|html|htm|ftl)$/i, ''); }

/* A ordem do application.info e a verdade; sem ele, os modulos varridos. */
function recursosJs(modelo) {
    if (modelo.recursos.js && modelo.recursos.js.length) return modelo.recursos.js;
    return modelo.widget.js.map(function (w) { return { nome: w.nome, role: w.role }; });
}
function porPapel(modelo, papeis) {
    return dedup(recursosJs(modelo)
        .filter(function (r) { return papeis.indexOf(r.role || 'outro') >= 0; })
        .map(function (r) { return semExt(r.nome); }));
}
/* O view.file do application.info vem primeiro: e ele que o a plataforma renderiza.
   Sem isso o fluxograma abria a widget pelo edit.ftl, que e a tela de
   configuracao e nao o caminho do usuario. */
function nomesFtl(modelo) {
    var l = modelo.ftls.map(function (f) { return f.nome; });
    if (!l.length && modelo.meta.viewFile) l = [modelo.meta.viewFile];
    var view = String(modelo.meta.viewFile || '').split('/').pop().toLowerCase();
    if (view) {
        l = l.slice().sort(function (a, b) {
            var pa = a.toLowerCase() === view ? 0 : 1;
            var pb = b.toLowerCase() === view ? 0 : 1;
            return pa !== pb ? pa - pb : (a < b ? -1 : 1);
        });
    }
    return dedup(l);
}
function nomesDatasets(modelo) {
    return dedup(modelo.datasets.filter(function (d) { return !d.backup; })
        .map(function (d) { return semExt(d.nome); }));
}
function nomesDatasetsClient(modelo) {
    return dedup(modelo.datasetsClient.map(function (d) { return semExt(d.nome); }));
}
function nomesWorkflow(modelo) {
    return dedup(modelo.workflow.scripts.map(function (s) { return semExt(s.nome); }));
}
function nomesEntidades(modelo) {
    var ordem = { propria: 0, rm: 1, externa: 2 };
    return dedup(modelo.dataModel.entidades.slice()
        .sort(function (a, b) { return (ordem[a.origem] || 3) - (ordem[b.origem] || 3); })
        .map(function (x) { return x.chave; }));
}
function cartoesForm(modelo) {
    return dedup(modelo.formularios.filter(function (f) { return f.html; })
        .map(function (f) { return semExt(f.html.nome); }));
}
function cssForm(modelo) {
    var out = [];
    modelo.formularios.forEach(function (f) {
        (f.css || []).forEach(function (c) { out.push(c.nome); });
    });
    return dedup(out);
}
function auxForm(modelo) {
    var out = [];
    modelo.formularios.forEach(function (f) {
        (f.auxiliares || []).forEach(function (a) { out.push(semExt(a.nome)); });
    });
    return dedup(out);
}
/* Eventos do cartao separados em "monta a tela" e "valida ao enviar": e a
   diferenca que importa para entender o fluxo de um formulario. */
var EV_EXIBE = ['displayfields', 'documentready', 'setenable', 'enablefields', 'inputfields', 'setinformation'];
var EV_VALIDA = ['validateform', 'beforesendvalidate', 'beforeprocessing', 'afterprocessing', 'beforesavenew', 'aftersavenew'];

function eventosForm(modelo, quais) {
    var out = [];
    modelo.formularios.forEach(function (f) {
        if (f.js && !quais) out.push(semExt(f.js.nome));
        (f.eventos || []).forEach(function (e) {
            var ev = String(e.evento || '').toLowerCase();
            if (!quais || quais.indexOf(ev) >= 0) out.push(semExt(e.nome));
        });
    });
    return dedup(out);
}
/* Eventos que nao caem em nenhum dos dois grupos conhecidos. */
function eventosFormRestantes(modelo) {
    var conhecidos = {};
    eventosForm(modelo, EV_EXIBE).concat(eventosForm(modelo, EV_VALIDA))
        .forEach(function (n) { conhecidos[n] = 1; });
    return eventosForm(modelo, null).filter(function (n) { return !conhecidos[n]; });
}

/* --------------------------------------------------- camadas por tipo de app */
function camadasArquitetura(modelo) {
    var I = modelo.identidade || {};
    var tipo = (modelo.meta && modelo.meta.tipoApp) || 'formulario';
    var temWidget = tipo === 'widget' || tipo === 'widget-formulario';
    var temForm = tipo === 'formulario' || tipo === 'widget-formulario';

    var C = [];
    function add(id, titulo, cor, itens, nota) {
        var lista = dedup((itens || []).filter(Boolean));
        if (!lista.length) return;
        C.push({ id: id, titulo: titulo, cor: cor, itens: lista, nota: nota || '' });
    }

    if (temWidget) {
        add('apresentacao', 'Apresentacao da widget (FTL)', COR.neutro, nomesFtl(modelo));
        add('bootstrap', 'Bootstrap (SuperWidget)', COR.tintaForte, porPapel(modelo, ['bootstrap']));
        add('controller', 'Orquestracao (controller)', COR.tinta, porPapel(modelo, ['controller']));
        add('dominio', 'Dominio, componentes e helpers', COR.alerta,
            porPapel(modelo, ['dominio', 'componentes', 'helper', 'infra']));
        add('libs', 'Bibliotecas de terceiros', COR.neutro, porPapel(modelo, ['lib']));
    }
    if (temForm) {
        add('cartao', 'Cartao do formulario (HTML)', COR.neutro, cartoesForm(modelo),
            temWidget ? 'entrada alternativa: o formulario do processo' : '');
        add('ev-exibe', 'Eventos que montam o cartao', COR.modulo, eventosForm(modelo, EV_EXIBE));
        add('ev-valida', 'Eventos de validacao / envio', COR.processo, eventosForm(modelo, EV_VALIDA));
        add('ev-outros', 'Outros scripts do cartao', COR.tinta, eventosFormRestantes(modelo));
        add('aux-form', 'Scripts auxiliares do cartao', COR.tinta, auxForm(modelo));
        add('css-form', 'Estilos do cartao (CSS)', COR.neutro, cssForm(modelo));
    }
    if (temWidget) {
        add('integracao', 'Integracao (integre*)', COR.dado, porPapel(modelo, ['integracao']));
        add('acesso-dados', 'Acesso a dados', COR.acao,
            porPapel(modelo, ['acesso-dados']).concat(nomesDatasetsClient(modelo)));
    } else {
        add('acesso-dados', 'Acesso a dados', COR.acao, nomesDatasetsClient(modelo));
    }

    add('workflow', 'Eventos do processo (workflow, server-side)', COR.processo, nomesWorkflow(modelo));
    if (I.usaDatasetFactory) {
        add('factory', 'Fabrica de consultas', COR.modulo, ['DatasetFactory', 'WKDataset']);
    }
    add('dataset', 'Datasets server-side (Rhino)', COR.modulo, nomesDatasets(modelo));
    add('procedures', 'Stored procedures', COR.alerta,
        dedup(modelo.sql.procedures.map(function (p) { return p.nome; })));

    var ent = nomesEntidades(modelo);
    add('backend', 'Backend (banco de dados)', COR.processo,
        ent.length ? ent : ['SQL Server / RM']);

    return { camadas: C, tipo: tipo };
}

function arquitetura(modelo) {
    var res = camadasArquitetura(modelo);
    var camadas = res.camadas;

    var W = 1080, padX = 22, bw = 150, bh = 40, bgap = 10, topo = 18, gap = 26;
    var porLinha = Math.floor((W - padX * 2 + bgap) / (bw + bgap));

    /* altura de cada banda calculada para caber TODOS os itens */
    var alturas = camadas.map(function (c) {
        var linhas = Math.max(1, Math.ceil(c.itens.length / porLinha));
        return 40 + linhas * (bh + 8);
    });

    var corpo = '', y = topo, yBanda = [];
    camadas.forEach(function (c, i) {
        var h = alturas[i];
        yBanda.push({ y: y, h: h });
        corpo += '<rect x="0" y="' + y + '" width="' + W + '" height="' + h + '" rx="10" fill="' + COR.painel + '" stroke="' + COR.linha + '"/>';
        corpo += '<rect x="0" y="' + y + '" width="6" height="' + h + '" rx="3" fill="' + c.cor + '"/>';
        corpo += texto(padX, y + 22, c.titulo.toUpperCase(), { size: 11, weight: 700, fill: c.cor });
        corpo += texto(W - padX, y + 22, c.itens.length + (c.itens.length === 1 ? ' item' : ' itens'), { size: 10, anchor: 'end', fill: COR.tinta2 });
        c.itens.forEach(function (it, k) {
            var col = k % porLinha, row = Math.floor(k / porLinha);
            var x = padX + col * (bw + bgap);
            var yy = y + 32 + row * (bh + 8);
            corpo += caixaRotulada(x, yy, bw, bh, it, {
                titulo: it, fill: COR.fundo, stroke: c.cor, rx: 7, sw: 1.3, size: 10.5
            });
        });
        y += h + gap;
    });

    for (var i2 = 0; i2 < camadas.length - 1; i2++) {
        corpo += seta(W / 2, yBanda[i2].y + yBanda[i2].h, W / 2, yBanda[i2 + 1].y, { cor: COR.alerta, sw: 2 });
    }

    return { svg: svg(W, y, corpo), camadas: camadas, tipo: res.tipo };
}

/* =============================================================================
   2) FLUXOGRAMA DE EXECUCAO - o desenho que antes era so codigo Mermaid
   -----------------------------------------------------------------------------
   Coluna central = caminho de execucao real DESTE tipo de aplicacao:
     widget             usuario -> view.ftl -> bootstrap -> controller -> dados
     formulario         usuario -> cartao HTML -> eventos do cartao -> dados
     widget+formulario  caminho da widget na central, o cartao como entrada
                        alternativa na coluna da esquerda
   Coluna direita = o que e carregado como dependencia, sem chamar ninguem.
============================================================================= */
function fluxograma(modelo) {
    var I = modelo.identidade || {};
    var tipo = (modelo.meta && modelo.meta.tipoApp) || 'formulario';
    var temWidget = tipo === 'widget' || tipo === 'widget-formulario';
    var temForm = tipo === 'formulario' || tipo === 'widget-formulario';

    function resumo(lista, alt) {
        if (!lista || !lista.length) return alt;
        if (lista.length === 1) return lista[0];
        return lista[0] + ' +' + (lista.length - 1);
    }

    var ftl = nomesFtl(modelo);
    var boot = porPapel(modelo, ['bootstrap']);
    var ctrl = porPapel(modelo, ['controller']);
    var integ = porPapel(modelo, ['integracao']);
    var dsCli = porPapel(modelo, ['acesso-dados']).concat(nomesDatasetsClient(modelo));
    var dsSrv = nomesDatasets(modelo);
    var deps = porPapel(modelo, ['dominio', 'componentes', 'helper', 'infra']);
    var libs = porPapel(modelo, ['lib']);
    var wf = nomesWorkflow(modelo);
    var cartoes = cartoesForm(modelo);
    var evExibe = eventosForm(modelo, EV_EXIBE);
    var evValida = eventosForm(modelo, EV_VALIDA);
    var evOutros = eventosFormRestantes(modelo);
    var aux = auxForm(modelo);
    var cssF = cssForm(modelo);

    var W = 1080;
    var cw = 300, cx = 390;            /* coluna central */
    var lw = 250, lx = 30;             /* coluna esquerda (entrada alternativa) */
    var rw = 250, rx = 800;            /* coluna direita (dependencias) */

    var corpo = '';
    var y = 24;
    var passos = [];

    function passo(rotulo, sub, forma, cor, titulo) {
        if (!rotulo) return;
        var h = sub ? 56 : 46;
        passos.push({ x: cx, y: y, w: cw, h: h, rotulo: rotulo, sub: sub, forma: forma, cor: cor, titulo: titulo || rotulo });
        y += h + 34;
    }

    /* --------------------------------------------- coluna central por tipo */
    if (temWidget) {
        passo('Usuario abre a tela', 'A aplicacao monta a pagina', 'inicio', COR.neutro);
        if (ftl.length) passo(resumo(ftl), 'markup da tela (FreeMarker)', 'arquivo', COR.neutro, ftl.join(', '));
        if (boot.length) passo(resumo(boot), 'bootstrap: SuperWidget.bindings', 'arquivo', COR.tintaForte, boot.join(', '));
        if (ctrl.length) passo(resumo(ctrl), 'orquestra a tela e os eventos', 'arquivo', COR.tinta, ctrl.join(', '));
        if (integ.length) passo(resumo(integ), 'regra de integracao (' + integ.length + ')', 'arquivo', COR.dado, integ.join(', '));
        if (dsCli.length) passo(resumo(dsCli), 'acesso a dados client (' + dsCli.length + ')', 'arquivo', COR.acao, dsCli.join(', '));
    } else {
        passo('Usuario abre a tarefa', 'A aplicacao monta a tela', 'inicio', COR.neutro);
        if (cartoes.length) passo(resumo(cartoes), 'cartao do formulario (HTML)', 'arquivo', COR.neutro, cartoes.join(', '));
        if (evExibe.length) passo(resumo(evExibe), 'evento de exibicao do cartao (' + evExibe.length + ')', 'arquivo', COR.modulo, evExibe.join(', '));
        if (evOutros.length) passo(resumo(evOutros), 'demais scripts do cartao (' + evOutros.length + ')', 'arquivo', COR.tinta, evOutros.join(', '));
        if (evValida.length) passo(resumo(evValida), 'validacao ao enviar (' + evValida.length + ')', 'arquivo', COR.processo, evValida.join(', '));
    }

    /* --------------------------------------------- cauda comum: dados */
    if (wf.length && !temWidget) {
        passo(resumo(wf), 'eventos do processo, server-side (' + wf.length + ')', 'servico', COR.processo, wf.join(', '));
    }
    if (I.usaDatasetFactory) {
        passo('DatasetFactory.getDataset()', 'ponte client → server da plataforma', 'servico', COR.modulo);
    }
    if (dsSrv.length) {
        passo(resumo(dsSrv), 'dataset server-side, Rhino (' + dsSrv.length + ')', 'arquivo', COR.modulo, dsSrv.join(', '));
    }
    if (dsSrv.length || modelo.sql.procedures.length) {
        passo('SQL / JDBC', 'datasource ' + (primeiroJndi(modelo) || 'JNDI da aplicacao'), 'dados', COR.alerta);
    }
    passo('Banco de dados', modelo.dataModel.entidades.length + ' tabelas mapeadas', 'banco', COR.processo);

    var H = y;

    /* --- ligacoes da coluna central --- */
    for (var i = 0; i < passos.length - 1; i++) {
        var a = passos[i], b = passos[i + 1];
        corpo += seta(a.x + a.w / 2, a.y + a.h, b.x + b.w / 2, b.y - 2, { cor: COR.alerta, sw: 2 });
    }

    /* --------------------------------------------- coluna esquerda
       So existe quando ha uma entrada que NAO passa pela coluna central:
         - widget que tambem tem formulario  -> o cartao e a entrada alternativa
         - qualquer app com eventos de processo que a central nao mostrou      */
    var idxFactory = indiceDe(passos, 'DatasetFactory.getDataset()');
    var blocos = [];
    if (temWidget && temForm && (cartoes.length || evExibe.length || evValida.length || evOutros.length)) {
        if (cartoes.length) {
            blocos.push({ rot: 'Telas (' + cartoes.length + ')', sub: 'entrada pelo processo', tit: cartoes.join(', '), cor: COR.processo });
        }
        var todosEv = evExibe.concat(evOutros).concat(evValida);
        if (todosEv.length) {
            blocos.push({ rot: 'Eventos do cartao (' + todosEv.length + ')', sub: 'displayFields, validacao…', tit: todosEv.join(', '), cor: COR.processo });
        }
    }
    if (temWidget && wf.length) {
        blocos.push({ rot: 'Eventos do processo (' + wf.length + ')', sub: 'beforeTaskSave, servicetask…', tit: wf.join(', '), cor: COR.processo });
    }
    if (blocos.length) {
        var yw = passos[2] ? passos[2].y : 60;
        corpo += texto(lx, yw - 12, 'ENTRADA PELO PROCESSO (BPMN)', { size: 10, weight: 700, fill: COR.processo });
        blocos.forEach(function (b, k) {
            var by = yw + k * 86;
            corpo += formaNo(lx, by, lw, 56, b.rot, b.sub, 'arquivo', b.cor, b.tit);
            b.y = by; b.h = 56;
            H = Math.max(H, by + 86);
        });
        var ultimo = blocos[blocos.length - 1];
        var alvo = passos[idxFactory >= 0 ? idxFactory : Math.max(0, passos.length - 2)];
        corpo += curva(lx + lw, ultimo.y + ultimo.h / 2, alvo.x, alvo.y + alvo.h / 2,
            { cor: COR.processo, sw: 1.6, dash: false, op: 0.9 });
    }

    /* --------------------------------------------- coluna direita */
    var grupos = [];
    if (temWidget) {
        if (deps.length) grupos.push({ rot: 'Dominio e componentes', sub: deps.length + ' modulos', tit: deps.join(', '), cor: COR.modulo });
        if (libs.length) grupos.push({ rot: 'Bibliotecas', sub: libs.length + ' arquivos', tit: libs.join(', '), cor: COR.neutro });
        if (modelo.widget.css.length) {
            grupos.push({
                rot: 'Estilos (CSS)', sub: modelo.widget.css.length + ' folha(s)',
                tit: modelo.widget.css.map(function (c) { return c.nome; }).join(', '), cor: COR.neutro
            });
        }
    } else {
        if (aux.length) grupos.push({ rot: 'Scripts auxiliares', sub: aux.length + ' arquivos', tit: aux.join(', '), cor: COR.modulo });
        if (cssF.length) grupos.push({ rot: 'Estilos do cartao', sub: cssF.length + ' folha(s)', tit: cssF.join(', '), cor: COR.neutro });
    }
    if (grupos.length) {
        var yd = passos[2] ? passos[2].y - 10 : 120;
        corpo += texto(rx, yd - 12, 'DEPENDENCIAS CARREGADAS', { size: 10, weight: 700, fill: COR.tinta2 });
        var ancora = passos[Math.min(2, passos.length - 1)];
        grupos.forEach(function (g, k) {
            var gy = yd + k * 72;
            corpo += formaNo(rx, gy, rw, 52, g.rot, g.sub, 'arquivo', g.cor, g.tit);
            corpo += curva(rx, gy + 26, cx + cw, ancora.y + ancora.h / 2,
                { cor: COR.neutro, sw: 1.3, dash: true, op: 0.8 });
            H = Math.max(H, gy + 72);
        });
    }

    /* --- nos da coluna central (desenhados por cima das setas) --- */
    passos.forEach(function (p) {
        corpo += formaNo(p.x, p.y, p.w, p.h, p.rotulo, p.sub, p.forma, p.cor, p.titulo);
    });

    return { svg: svg(W, H + 20, corpo), tipo: tipo, temEntradaLateral: blocos.length > 0 };
}

function indiceDe(lista, rotulo) {
    for (var i = 0; i < lista.length; i++) if (lista[i].rotulo === rotulo) return i;
    return -1;
}
function primeiroJndi(modelo) {
    for (var i = 0; i < modelo.datasets.length; i++) if (modelo.datasets[i].jndi) return modelo.datasets[i].jndi;
    return '';
}

/* Desenha um no do fluxograma na forma pedida, com tooltip. */
function formaNo(x, y, w, h, rotulo, sub, forma, cor, titulo) {
    var g = '<g class="dg-node"><title>' + esc(titulo || rotulo) + '</title>';
    var fill = COR.fundo;
    if (forma === 'inicio') {
        g += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (h / 2) +
            '" fill="' + cor + '" stroke="' + cor + '" stroke-width="1.5"/>';
        fill = cor;
    } else if (forma === 'banco') {
        var ry = 9;
        g += '<path d="M ' + x + ' ' + (y + ry) + ' A ' + (w / 2) + ' ' + ry + ' 0 0 1 ' + (x + w) + ' ' + (y + ry) +
            ' L ' + (x + w) + ' ' + (y + h - ry) + ' A ' + (w / 2) + ' ' + ry + ' 0 0 1 ' + x + ' ' + (y + h - ry) + ' Z" ' +
            'fill="' + COR.fundo + '" stroke="' + cor + '" stroke-width="1.8"/>';
        g += '<path d="M ' + x + ' ' + (y + ry) + ' A ' + (w / 2) + ' ' + ry + ' 0 0 0 ' + (x + w) + ' ' + (y + ry) + '" ' +
            'fill="none" stroke="' + cor + '" stroke-width="1.8"/>';
    } else if (forma === 'dados') {
        var sk = 16;
        g += '<path d="M ' + (x + sk) + ' ' + y + ' L ' + (x + w) + ' ' + y + ' L ' + (x + w - sk) + ' ' + (y + h) +
            ' L ' + x + ' ' + (y + h) + ' Z" fill="' + COR.fundo + '" stroke="' + cor + '" stroke-width="1.6"/>';
    } else if (forma === 'servico') {
        g += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="6" fill="' + COR.fundo +
            '" stroke="' + cor + '" stroke-width="1.8" stroke-dasharray="6 3"/>';
    } else {
        g += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8" fill="' + COR.fundo +
            '" stroke="' + cor + '" stroke-width="1.8"/>';
        g += '<rect x="' + x + '" y="' + y + '" width="4" height="' + h + '" rx="2" fill="' + cor + '"/>';
    }
    var corTxt = forma === 'inicio' ? '#fff' : COR.tinta;
    var corSub = forma === 'inicio' ? 'rgba(255,255,255,.85)' : COR.tinta2;
    if (sub) {
        g += texto(x + w / 2, y + h / 2 - 1, trunc(rotulo, cabe(w, 12.5)), { size: 12.5, weight: 700, anchor: 'middle', fill: corTxt });
        g += texto(x + w / 2, y + h / 2 + 14, trunc(sub, cabe(w, 9.5)), { size: 9.5, weight: 500, anchor: 'middle', fill: corSub });
    } else {
        g += texto(x + w / 2, y + h / 2 + 5, trunc(rotulo, cabe(w, 12.5)), { size: 12.5, weight: 700, anchor: 'middle', fill: corTxt });
    }
    return g + '</g>';
}

/* =============================================================================
   3) CAMADAS DE CARREGAMENTO (ordem do application.info) - nada escondido
============================================================================= */
function camadasCarga(modelo) {
    var grupos = [
        { role: 'lib', titulo: 'Bibliotecas', cor: COR.neutro },
        { role: 'dominio', titulo: 'Dominio (POO)', cor: COR.alerta },
        { role: 'componentes', titulo: 'Componentes (UI)', cor: COR.modulo },
        { role: 'helper', titulo: 'Helpers', cor: COR.tinta2 },
        { role: 'acesso-dados', titulo: 'Acesso a dados', cor: COR.acao },
        { role: 'integracao', titulo: 'Integracao', cor: COR.dado },
        { role: 'infra', titulo: 'Infra/Permissoes', cor: COR.processo },
        { role: 'controller', titulo: 'Controller', cor: COR.tinta },
        { role: 'bootstrap', titulo: 'Bootstrap', cor: COR.tintaForte },
        { role: 'outro', titulo: 'Outros', cor: COR.neutro }
    ];
    var porRole = {};
    modelo.recursos.js.forEach(function (r) { (porRole[r.role] = porRole[r.role] || []).push(r); });

    var linhas = grupos.filter(function (g) { return porRole[g.role] && porRole[g.role].length; });
    if (!linhas.length) return { svg: '', total: 0 };

    var W = 1080, labelW = 180, padLeft = 12, bw = 132, bh = 26, bgap = 8, rowGap = 8;
    var xIni = labelW + 14;
    var porLinha = Math.max(1, Math.floor((W - xIni + bgap) / (bw + bgap)));

    var corpo = '', y = 16, total = 0;
    linhas.forEach(function (g) {
        var itens = porRole[g.role].slice().sort(function (a, b) { return a.ordem - b.ordem; });
        total += itens.length;
        var nLinhas = Math.ceil(itens.length / porLinha);
        var alturaBloco = nLinhas * (bh + rowGap) - rowGap;

        corpo += '<rect x="0" y="' + y + '" width="' + labelW + '" height="' + Math.max(bh, alturaBloco) +
            '" rx="6" fill="' + g.cor + '"/>';
        corpo += texto(padLeft, y + 17, g.titulo.toUpperCase(), { size: 10, weight: 700, fill: '#fff' });
        corpo += texto(labelW - padLeft, y + 17, String(itens.length), { size: 10, weight: 700, fill: 'rgba(255,255,255,.8)', anchor: 'end' });

        itens.forEach(function (it, k) {
            var col = k % porLinha, row = Math.floor(k / porLinha);
            var x = xIni + col * (bw + bgap);
            var yy = y + row * (bh + rowGap);
            var rot = String(it.ordem) + '. ' + it.nome.replace(/\.js$/, '');
            corpo += caixaRotulada(x, yy, bw, bh, rot, {
                titulo: it.ordem + '. ' + (it.path || it.nome), fill: COR.fundo, stroke: g.cor, rx: 6, sw: 1.1, size: 9.5
            });
        });
        y += Math.max(bh, alturaBloco) + 12;
    });
    return { svg: svg(W, y + 6, corpo), total: total };
}

/* =============================================================================
   4) GRAFO DE CHAMADAS - quem chama quem, dividido em camadas
   -----------------------------------------------------------------------------
   Cada no e um arquivo (ou uma tabela, na ultima camada). Cada aresta e uma
   chamada com evidencia. Clicar num no isola as ligacoes dele.
============================================================================= */
var COR_ARESTA = {
    /* O import e a ligacao mais confiavel do mapa: o arquivo diz, por escrito,
       de quem depende. Por isso e a unica traçada cheia e na cor de acao. */
    import: COR.acao,
    dataset: COR.modulo,
    le: COR.acao,
    grava: COR.alerta,
    simbolo: COR.neutro,
    par: COR.dado
};

function grafoChamadas(g) {
    if (!g || !g.nos.length) return { svg: '', vazio: true };

    var W = 1240, padX = 20, bw = 148, bh = 34, bgap = 10, rowGap = 8, gapCamada = 34, topo = 16;
    var porLinha = Math.max(1, Math.floor((W - padX * 2 + bgap) / (bw + bgap)));

    /* posiciona cada no dentro da banda da sua camada */
    var pos = {};
    var bandas = [];
    var y = topo;
    g.camadas.forEach(function (c) {
        var itens = g.porCamada[c.id] || [];
        if (!itens.length) return;
        var nLinhas = Math.ceil(itens.length / porLinha);
        var h = 30 + nLinhas * (bh + rowGap);
        bandas.push({ camada: c, y: y, h: h, itens: itens });
        itens.forEach(function (n, k) {
            var col = k % porLinha, row = Math.floor(k / porLinha);
            var x = padX + col * (bw + bgap);
            var yy = y + 26 + row * (bh + rowGap);
            pos[n.id] = { x: x, y: yy, w: bw, h: bh, cx: x + bw / 2 };
        });
        y += h + gapCamada;
    });
    var H = y;

    var corpo = '';

    /* bandas */
    bandas.forEach(function (b) {
        corpo += '<rect x="0" y="' + b.y + '" width="' + W + '" height="' + b.h + '" rx="10" fill="' + COR.painel +
            '" stroke="' + COR.linha + '"/>';
        corpo += '<rect x="0" y="' + b.y + '" width="6" height="' + b.h + '" rx="3" fill="' + b.camada.cor + '"/>';
        corpo += texto(padX, b.y + 18, b.camada.titulo.toUpperCase(), { size: 10.5, weight: 700, fill: b.camada.cor });
        corpo += texto(W - padX, b.y + 18, b.itens.length + '', { size: 10, weight: 700, anchor: 'end', fill: COR.tinta2 });
    });

    /* arestas (atras dos nos) */
    var camadas = '<g class="dg-edges">';
    g.arestas.forEach(function (a, i) {
        var p = pos[a.de], q = pos[a.para];
        if (!p || !q) return;
        var cor = COR_ARESTA[a.tipo] || COR.neutro;
        var descendo = q.y >= p.y;
        var x1 = p.cx, y1 = descendo ? p.y + p.h : p.y;
        var x2 = q.cx, y2 = descendo ? q.y : q.y + q.h;
        camadas += curva(x1, y1, x2, y2, {
            cor: cor, sw: a.tipo === 'simbolo' ? 1 : 1.5,
            dash: a.tipo === 'simbolo',
            op: a.tipo === 'simbolo' ? 0.3 : 0.55,
            cls: 'dg-edge',
            attrs: 'data-de="' + esc(a.de) + '" data-para="' + esc(a.para) + '"'
        });
    });
    camadas += '</g>';
    corpo += camadas;

    /* nos */
    g.camadas.forEach(function (c) {
        (g.porCamada[c.id] || []).forEach(function (n) {
            var p = pos[n.id];
            if (!p) return;
            var sub = n.tipo === 'tabela'
                ? (n.entradas + ' acesso' + (n.entradas === 1 ? '' : 's'))
                : (n.saidas + '↓ ' + n.entradas + '↑');
            var titulo = (n.tipo === 'tabela' ? 'Tabela ' + n.nome : n.id) +
                '\n' + n.saidas + ' chamada(s) para fora, ' + n.entradas + ' recebida(s)';
            corpo += caixaRotulada(p.x, p.y, p.w, p.h, n.rotulo, {
                titulo: titulo, sub: sub, fill: COR.fundo, stroke: c.cor, rx: 7, sw: 1.3, size: 10,
                cls: 'dg-gnode', attrs: 'data-no="' + esc(n.id) + '" tabindex="0"'
            });
        });
    });

    return {
        svg: svg(W, H, corpo, { fixo: true, cls: 'dg-grafo' }),
        vazio: false,
        largura: W
    };
}

module.exports = {
    arquitetura: arquitetura,
    fluxograma: fluxograma,
    camadasCarga: camadasCarga,
    grafoChamadas: grafoChamadas,
    COR: COR,
    COR_ARESTA: COR_ARESTA
};
