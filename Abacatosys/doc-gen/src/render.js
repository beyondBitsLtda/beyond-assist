/* =============================================================================
   render.js - Monta o portal HTML autocontido a partir do modelo
   Secoes: Visao Geral, Arquitetura do Sistema, Mapa de Chamadas, Arquitetura de
   Dados, Datasets, Formularios, Workflow, Widget, i18n, Rastreabilidade,
   Biblioteca de Codigo, Inventario.
============================================================================= */
'use strict';

var theme = require('./theme');
var hl = require('./highlight');
var D = require('./diagrams');

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function dataBR(d) {
    try {
        var p = function (n) { return String(n).padStart(2, '0'); };
        return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    } catch (e) { return String(d); }
}
function badge(txt, cor, titulo) {
    return '<span class="dg-badge' + (cor ? ' dg-badge--' + cor : '') + '"' +
        (titulo ? ' title="' + esc(titulo) + '"' : '') + '>' + esc(txt) + '</span>';
}
function vazio(txt) { return '<span class="dg-empty">' + esc(txt || 'nao identificado') + '</span>'; }
function chips(arr, cls) {
    if (!arr || !arr.length) return vazio('nenhum');
    return '<div class="dg-chips">' + arr.map(function (a) {
        return '<span class="dg-chip' + (cls ? ' ' + cls : '') + '" title="' + esc(a) + '">' + esc(a) + '</span>';
    }).join('') + '</div>';
}
/* Lista longa: mostra as primeiras e guarda o resto atras de "ver todos". */
function chipsVerTodos(arr, limite, cls, rotulo) {
    if (!arr || !arr.length) return vazio('nenhum');
    limite = limite || 30;
    if (arr.length <= limite) return chips(arr, cls);
    return chips(arr.slice(0, limite), cls) +
        verTodos((rotulo || 'Ver todos') + ' (' + arr.length + ')', chips(arr, cls));
}
function verTodos(rotulo, conteudo) {
    return '<details class="dg-det dg-det--sm"><summary>' + esc(rotulo) + '</summary>' +
        '<div class="dg-det__body">' + conteudo + '</div></details>';
}
function timelineVersoes(vs) {
    if (!vs || !vs.length) return '<p class="dg-note">Sem historico de versao no cabecalho.</p>';
    return '<ul class="dg-ver">' + vs.map(function (v) {
        return '<li><span class="dg-ver__v">v' + esc(v.versao) + '</span>' +
            (v.data ? '<span class="dg-ver__d">' + esc(v.data) + '</span>' : '') +
            (v.nota ? '<span class="dg-ver__n">' + esc(v.nota) + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
}
function fmtBytes(n) {
    if (!n) return '-';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
}
function trunc(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

/* Indice nome-de-arquivo -> caminho relativo, para os links da biblioteca. */
var REL_POR_NOME = {};
function linkArquivo(nome, rotulo) {
    var rel = REL_POR_NOME[nome];
    var txt = esc(rotulo || nome);
    if (!rel) return '<code>' + txt + '</code>';
    return '<a class="dg-flink" href="#sec-biblioteca" data-abrir="' + esc(rel) + '" ' +
        'title="Ver o codigo de ' + esc(rel) + '"><code>' + txt + '</code></a>';
}

/* ------------------------------------------------------------ 1. VISAO GERAL */
function secVisaoGeral(m) {
    var qtd = {
        datasets: m.datasets.filter(function (d) { return !d.backup; }).length,
        forms: m.formularios.length,
        scripts: m.workflow.scripts.length,
        tabelas: m.dataModel.entidades.filter(function (e) { return e.origem === 'propria'; }).length,
        widgetJs: m.widget.js.length,
        procs: m.sql.procedures.length,
        i18n: m.i18n.length
    };
    qtd.eventosForm = m.formularios.reduce(function (s, f) { return s + (f.eventos || []).length; }, 0);
    var kpi = function (n, l) { return '<div class="dg-kpi"><div class="dg-kpi__num">' + n + '</div><div class="dg-kpi__lbl">' + esc(l) + '</div><div class="dg-kpi__bar"></div></div>'; };

    var metaRows = [
        ['Codigo', m.meta.appCode], ['Titulo', m.meta.appTitle],
        ['Tipo de aplicacao', m.meta.tipoAppRotulo],
        ['Tipo declarado (application.info)', m.meta.appType],
        ['Categoria', m.meta.appCategory], ['Renderer', m.meta.renderer],
        ['Desenvolvedor', (m.meta.developerName || '') + (m.meta.developerCode ? ' (' + m.meta.developerCode + ')' : '')],
        ['Versao', m.meta.appVersion], ['View', m.meta.viewFile], ['Locale base', m.meta.localeBase],
        ['Nome obtido de', m.meta.origemNome]
    ].filter(function (r) { return r[1]; });

    var readme = m.readmes.filter(function (r) { return r.tipo === 'readme'; })[0];

    var h = section('overview', 'Contexto', 'Visao Geral',
        esc(m.meta.appDescription || 'Documentacao tecnica gerada automaticamente a partir do codigo-fonte da aplicacao Fluig.'));

    /* os KPIs seguem o tipo: "Modulos JS (widget)" num formulario e sempre 0 */
    var terceiroKpi = ehWidget(m)
        ? kpi(qtd.widgetJs, 'Modulos JS (widget)')
        : kpi(qtd.eventosForm, 'Eventos de formulario');
    h += '<div class="dg-grid dg-grid--4" style="margin-bottom:24px">' +
        kpi(qtd.datasets, 'Datasets') + kpi(qtd.forms, 'Formularios') +
        kpi(qtd.scripts, 'Scripts WF') + kpi(qtd.tabelas, 'Tabelas proprias') +
        terceiroKpi + kpi(qtd.procs, 'Procedures') +
        kpi(m.grafo.arestas.length, 'Chamadas mapeadas') + kpi(m.biblioteca.arquivos.length, 'Arquivos na biblioteca') +
        '</div>';

    h += cartaoTipoApp(m);

    h += '<div class="dg-grid dg-grid--2">';
    h += '<div class="dg-card dg-card--accent"><div class="dg-h3" style="margin-top:0">Identificacao (application.info)</div>' +
        '<table class="dg-table" style="box-shadow:none">' + metaRows.map(function (r) {
            return '<tr><td style="width:38%;color:#666;font-weight:600">' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>';
        }).join('') + '</table></div>';

    h += '<div class="dg-card">' + cartaoEsquema(m) + '</div>';
    h += '</div>';

    if (readme) {
        h += verTodos('README do repositorio (' + readme.nome + ')',
            '<div class="dg-src" style="white-space:pre-wrap;max-height:520px">' + esc(readme.conteudo) + '</div>');
    }
    return h + '</section>';
}

function ehWidget(m) {
    var t = m.meta.tipoApp;
    return t === 'widget' || t === 'widget-formulario';
}
function ehFormulario(m) {
    var t = m.meta.tipoApp;
    return t === 'formulario' || t === 'widget-formulario';
}

/* Que tipo de aplicacao e esta, e COM BASE EM QUE.
   O tipo decide quais camadas de arquitetura sao desenhadas, entao ele nao pode
   ser uma afirmacao sem prova. */
function cartaoTipoApp(m) {
    var I = m.identidade || {};
    var ev = I.evidencias || {};
    var explic = {
        'widget': 'Foram encontrados os arquivos e pastas de uma widget Fluig (application.info, FTL de view e recursos em resources/js), e nenhum formulario de processo. Os diagramas seguem o ciclo de vida de uma widget.',
        'widget-formulario': 'Foram encontrados os arquivos de uma widget Fluig <b>e</b> de um formulario de processo. Os diagramas mostram a widget como caminho principal e o cartao do formulario como entrada alternativa pelo BPMN.',
        'formulario': 'Nao foi encontrada nenhuma pasta ou arquivo de widget (sem application.info de widget, sem FTL, sem resources/js). A aplicacao foi documentada como formulario de processo: cartao HTML mais eventos do cartao.'
    };
    var linha = function (rot, lista) {
        if (!lista || !lista.length) return '';
        return '<tr><td style="width:34%;color:#666;font-weight:600">' + esc(rot) + '</td><td>' +
            lista.map(function (x) { return '<code>' + esc(x) + '</code>'; }).join('<br>') + '</td></tr>';
    };
    var h = '<div class="dg-card dg-card--accent" style="margin-bottom:24px">' +
        '<div class="dg-h3" style="margin-top:0">Tipo de aplicacao: ' + esc(I.tipoRotulo || '—') + '</div>' +
        '<p class="dg-note" style="margin:0 0 12px">' + (explic[I.tipo] || '') + '</p>' +
        '<p style="margin:0 0 12px">' +
        badge(I.temWidget ? 'widget: sim' : 'widget: nao', I.temWidget ? 'green' : 'gray') + ' ' +
        badge(I.temFormulario ? 'formulario: sim' : 'formulario: nao', I.temFormulario ? 'green' : 'gray') + ' ' +
        badge(I.temWorkflow ? 'workflow: sim' : 'workflow: nao', I.temWorkflow ? 'orange' : 'gray') + ' ' +
        badge(I.temDatasets ? 'datasets: sim' : 'datasets: nao', I.temDatasets ? 'blue' : 'gray') + ' ' +
        badge(I.usaDatasetFactory ? 'usa DatasetFactory' : 'sem DatasetFactory', I.usaDatasetFactory ? 'blue' : 'gray') +
        '</p>';
    var linhas = linha('Evidencia de widget', ev.widget) +
        linha('Evidencia de formulario', ev.formulario) +
        linha('Evidencia de workflow', ev.workflow) +
        linha('Nome da aplicacao', [(I.appCode || '') + '  —  ' + (I.origemNome || '')]);
    h += verTodos('Ver as evidencias que sustentam essa classificacao',
        '<table class="dg-table" style="box-shadow:none">' + linhas + '</table>');
    return h + '</div>';
}

/* Estado da ponte codigo <-> banco. E o que tira os selos de "inferido". */
function cartaoEsquema(m) {
    var decl = m.dataModel.entidades.filter(function (e) { return e.fonte === 'declarado'; }).length;
    var inf = m.dataModel.entidades.filter(function (e) { return e.fonte !== 'declarado'; }).length;
    var total = decl + inf;
    var pct = total ? Math.round(decl * 100 / total) : 0;

    var h = '<div class="dg-h3" style="margin-top:0">Procedencia do esquema de dados</div>';
    h += '<div class="dg-meter"><div class="dg-meter__fill" style="width:' + pct + '%"></div></div>';
    h += '<p class="dg-note" style="margin:8px 0 12px"><b>' + pct + '%</b> das ' + total +
        ' tabelas tem esquema com fonte declarada (' + decl + ' declaradas, ' + inf + ' ainda inferidas do codigo).</p>';

    /* Todo arquivo aberto entra na tabela, inclusive o que nao deu em nada: e a
       unica forma de distinguir "nao salvei" de "salvei e o arquivo nao serviu". */
    if (m.esquemaBanco.arquivos.length) {
        h += '<p style="margin:0 0 10px">' + (m.esquemaBanco.ativo
            ? badge('esquema do banco carregado', 'green')
            : badge('arquivo lido, nada aproveitado', 'orange')) + '</p>';
        h += '<div class="dg-table-wrap"><table class="dg-table"><thead><tr><th>Arquivo lido</th><th>Formato</th><th>Base(s)</th><th>Tabelas</th><th>FKs</th><th>Situacao</th></tr></thead><tbody>' +
            m.esquemaBanco.arquivos.map(function (a) {
                var ok = (a.tabelas || a.fks) && !a.aviso;
                return '<tr><td><code>' + esc(a.nome) + '</code></td>' +
                    '<td>' + badge(a.formato === 'csv' ? 'grade do catalogo' : 'DDL', a.formato === 'csv' ? 'green' : 'gray') + '</td>' +
                    '<td>' + (a.bancos ? '<code>' + esc(a.bancos) + '</code>' : vazio('nao informada')) + '</td>' +
                    '<td>' + a.tabelas + '</td><td>' + a.fks + '</td>' +
                    '<td>' + (ok ? badge('lido', 'green') : badge(a.aviso || 'nada reconhecido', 'orange')) + '</td></tr>';
            }).join('') + '</tbody></table></div>';
        h += '<p class="dg-note" style="margin-top:10px">Origem: <code>' + esc(pastaCurta(m)) + '</code></p>';
    }

    if (!m.esquemaBanco.ativo) {
        var basesTxt = (m.dataModel.bancos || []).filter(function (b) { return b.identificado; })
            .map(function (b) { return '<code>' + esc(b.nome) + '</code>'; }).join(', ');
        h += '<div class="dg-callout"><b>Como remover os selos de "inferido"</b>' +
            '<ol style="margin:8px 0 0 18px;padding:0">' +
            '<li>Abra <code>' + esc(pastaCurta(m)) + '/01-extrair-esquema.sql</code> no SSMS e execute com <code>F5</code>. ' +
            'A base selecionada na barra <b>nao importa</b>: o script le ' + (basesTxt || 'todas as bases da lista') + ' numa execucao so.</li>' +
            '<li>Botao direito na grade &rsaquo; <b>Save Results As...</b>, salvando <b>dentro dessa mesma pasta</b>. ' +
            'Nome e extensao nao importam — o portal reconhece o arquivo pelo conteudo.</li>' +
            '<li>Rode o delp-docgen de novo: as tabelas passam a constar como <b>declarado (banco)</b>, cada uma na sua base.</li>' +
            '</ol>' +
            '<p class="dg-note" style="margin:10px 0 0">Se continuar aparecendo <i>inferido</i> depois disso, ' +
            'o motivo esta na secao de avisos no rodape deste portal.</p>' +
            '</div>';
    }
    return h;
}
function pastaCurta(m) {
    var p = String(m.esquemaBanco.pasta || '').replace(/\\/g, '/');
    var partes = p.split('/');
    return partes.slice(-2).join('/');
}

/* -------------------------------------------------- 2. ARQUITETURA DO SISTEMA */
function secArquitetura(m) {
    var fluxo = D.fluxograma(m);
    var arq = D.arquitetura(m);
    var carga = D.camadasCarga(m);

    var leads = {
        'widget': 'Como uma requisicao atravessa esta <b>widget</b>, do clique na tela ate a linha gravada no SQL Server.',
        'widget-formulario': 'Como uma requisicao atravessa esta aplicacao. Ela tem <b>duas entradas</b>: a widget (caminho principal) e o cartao do formulario, aberto pelo processo BPMN.',
        'formulario': 'Como uma requisicao atravessa este <b>formulario de processo</b>, da abertura do cartao pelo Fluig ate a linha gravada no SQL Server. Nao ha camadas de widget aqui &mdash; nenhuma foi encontrada no repositorio.'
    };
    var h = section('arquitetura', 'Diagramas', 'Arquitetura do Sistema',
        (leads[m.meta.tipoApp] || leads.formulario) +
        ' As camadas desenhadas seguem o <b>tipo</b> desta aplicacao: bandas que nao existem nao aparecem. Os diagramas sao SVG nativo: abrem sem internet, imprimem e podem ser copiados para apresentacoes.');

    h += '<div class="dg-h3">Fluxo de execucao</div>';
    h += '<p class="dg-note">Coluna central: caminho principal' +
        (fluxo.temEntradaLateral ? '. A esquerda, a entrada alternativa pelo processo BPMN' : '') +
        '. A direita, o que e carregado como dependencia. Passe o mouse sobre qualquer caixa para ver os nomes completos dos arquivos.</p>';
    h += '<div class="dg-diagram">' + fluxo.svg + '</div>';
    h += '<div class="dg-legend">' +
        '<span><i style="background:' + D.COR.red + '"></i>Fluxo principal</span>' +
        '<span><i style="background:' + D.COR.industria + '"></i>Entrada pelo workflow</span>' +
        '<span><i style="background:' + D.COR.gray1 + '"></i>- - dependencia carregada</span>' +
        '</div>';

    h += '<div class="dg-h3">Modulos por camada</div>';
    h += '<p class="dg-note">' + arq.camadas.length + ' camadas identificadas para uma aplicacao do tipo <b>' +
        esc(m.meta.tipoAppRotulo || '') + '</b>. Todos os modulos aparecem &mdash; nada foi cortado com "+N". ' +
        'Nomes longos ficam abreviados na caixa, mas o nome completo aparece no tooltip.</p>';
    h += '<div class="dg-diagram">' + arq.svg + '</div>';
    h += verTodos('Ver todos os modulos por camada em lista',
        arq.camadas.filter(function (c) { return c.itens.length; }).map(function (c) {
            return '<div style="margin-top:12px"><div class="dg-note" style="font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:.5px;margin-bottom:6px">' +
                esc(c.titulo) + ' (' + c.itens.length + ')</div>' + chips(c.itens) + '</div>';
        }).join(''));

    if (carga.svg) {
        h += '<div class="dg-h3">Camadas de carregamento (ordem no application.info)</div>';
        h += '<p class="dg-note">Sequencia real em que o Fluig injeta os recursos: ' + carga.total +
            ' arquivos, todos listados. Dependencias (dominio, componentes) carregam antes de quem as consome.</p>';
        h += '<div class="dg-diagram">' + carga.svg + '</div>';
    }

    if (m.recursos.js.length || m.recursos.css.length) {
        var linhas = m.recursos.js.map(function (r) {
            return '<tr><td>' + r.ordem + '</td><td>' + linkArquivo(r.nome) + '</td><td>' + papelBadge(r.role) +
                '</td><td class="dg-note">' + esc(r.path || '') + '</td></tr>';
        }).concat(m.recursos.css.map(function (r) {
            return '<tr><td>css</td><td>' + linkArquivo(r.nome) + '</td><td>' + badge('estilo', 'red') +
                '</td><td class="dg-note">' + esc(r.path || '') + '</td></tr>';
        }));
        h += '<div class="dg-h3">Recursos declarados (' + linhas.length + ')</div>';
        h += tabela(['#', 'Arquivo', 'Papel', 'Caminho'], linhas);
    }
    return h + '</section>';
}
function papelBadge(role) {
    var map = { lib: ['lib', 'gray'], dominio: ['dominio', 'red'], componentes: ['componentes', 'blue'],
        controller: ['controller', 'gray'], bootstrap: ['bootstrap', 'gray'], helper: ['helper', 'gray'],
        integracao: ['integracao', 'blue'], 'acesso-dados': ['acesso-dados', 'green'], infra: ['infra', 'orange'], outro: ['outro', 'gray'] };
    var v = map[role] || [role, 'gray'];
    return badge(v[0], v[1]);
}

/* -------------------------------------------------- 3. MAPA DE CHAMADAS */
function secChamadas(m) {
    var g = m.grafo;
    var h = section('chamadas', 'Diagramas', 'Mapa de Chamadas',
        'Quem chama quem, arquivo por arquivo, organizado nas camadas da aplicacao. Cada seta tem evidencia no codigo: uma chamada a getDataset, um simbolo exportado por outro modulo, ou um acesso SQL a uma tabela.');

    if (!g || !g.nos.length) {
        h += '<p class="dg-empty">Nenhuma ligacao entre arquivos pode ser detectada com seguranca.</p>';
        return h + '</section>';
    }

    var des = D.grafoChamadas(g);
    var porTipo = {};
    g.arestas.forEach(function (a) { porTipo[a.tipo] = (porTipo[a.tipo] || 0) + 1; });

    h += '<div class="dg-grid dg-grid--4" style="margin-bottom:18px">' +
        kpiSimples(g.nos.length, 'Arquivos no mapa') +
        kpiSimples(g.arestas.length, 'Ligacoes') +
        kpiSimples(porTipo.dataset || 0, 'Chamadas getDataset') +
        kpiSimples((porTipo.le || 0) + (porTipo.grava || 0), 'Acessos a tabela') +
        '</div>';

    h += '<p class="dg-note" style="margin-bottom:10px"><b>Clique em uma caixa</b> para isolar as ligacoes dela. Clique de novo (ou no fundo) para voltar. O diagrama rola na horizontal.</p>';
    h += '<div class="dg-diagram dg-diagram--grafo" id="dgGrafo">' + des.svg + '</div>';
    h += '<div class="dg-legend">' +
        '<span><i style="background:' + D.COR_ARESTA.dataset + '"></i>getDataset()</span>' +
        '<span><i style="background:' + D.COR_ARESTA.le + '"></i>le tabela</span>' +
        '<span><i style="background:' + D.COR_ARESTA.grava + '"></i>grava tabela</span>' +
        '<span><i style="background:' + D.COR_ARESTA.simbolo + '"></i>- - usa simbolo de outro modulo</span>' +
        '<span><i style="background:' + D.COR_ARESTA.par + '"></i>par HTML/JS do formulario</span>' +
        '</div>';

    /* tabela completa das ligacoes */
    var rotulo = {};
    g.nos.forEach(function (n) { rotulo[n.id] = n; });
    var nomeTipo = { dataset: 'getDataset()', le: 'le tabela', grava: 'grava tabela', simbolo: 'usa simbolo', par: 'par HTML/JS' };
    var linhas = g.arestas.slice().sort(function (a, b) {
        if (a.de !== b.de) return a.de < b.de ? -1 : 1;
        return a.para < b.para ? -1 : 1;
    }).map(function (a) {
        var de = rotulo[a.de], para = rotulo[a.para];
        return '<tr><td>' + (de && de.tipo !== 'tabela' ? linkArquivo(de.nome, de.rotulo) : '<code>' + esc(de ? de.rotulo : a.de) + '</code>') + '</td>' +
            '<td>' + badge(nomeTipo[a.tipo] || a.tipo, a.tipo === 'grava' ? 'red' : (a.tipo === 'le' ? 'green' : 'blue')) + '</td>' +
            '<td>' + (para && para.tipo !== 'tabela' ? linkArquivo(para.nome, para.rotulo) : '<code>' + esc(para ? para.rotulo : a.para) + '</code>') + '</td>' +
            '<td class="dg-note">' + esc(a.evidencias.join(', ')) + '</td></tr>';
    });
    h += '<div class="dg-h3">Todas as ligacoes (' + linhas.length + ')</div>';
    h += '<div class="dg-filtro"><input type="text" class="dg-input" id="dgFiltroChamadas" placeholder="filtrar por arquivo, tabela ou evidencia…"></div>';
    h += tabela(['De', 'Ligacao', 'Para', 'Evidencia'], linhas, 'dgTabChamadas');

    /* arquivos mais acoplados */
    var top = g.nos.slice().filter(function (n) { return n.tipo !== 'tabela'; })
        .sort(function (a, b) { return (b.entradas + b.saidas) - (a.entradas + a.saidas); }).slice(0, 12);
    if (top.length) {
        h += '<div class="dg-h3">Arquivos mais acoplados</div>';
        h += '<p class="dg-note">Quem soma mais ligacoes de entrada e saida. Mudar esses arquivos afeta mais gente &mdash; e onde a revisao de codigo deve ser mais cuidadosa.</p>';
        h += tabela(['Arquivo', 'Camada', 'Chama', 'E chamado por', 'Total'], top.map(function (n) {
            return '<tr><td>' + linkArquivo(n.nome, n.rotulo) + '</td><td>' + badge(n.camada) + '</td><td>' + n.saidas +
                '</td><td>' + n.entradas + '</td><td><b>' + (n.entradas + n.saidas) + '</b></td></tr>';
        }));
    }
    return h + '</section>';
}
function kpiSimples(n, l) {
    return '<div class="dg-kpi"><div class="dg-kpi__num">' + n + '</div><div class="dg-kpi__lbl">' + esc(l) + '</div><div class="dg-kpi__bar"></div></div>';
}

/* -------------------------------------------------- 4. ARQUITETURA DE DADOS */
function secDados(m) {
    var h = section('dados', 'Estrutura', 'Arquitetura de Dados',
        'A estrutura de cada tabela que a aplicacao toca: colunas, tipos, nulidade e chaves. A coluna "fonte" diz de onde veio a informacao &mdash; DDL declarado, esquema extraido do banco, ou deducao do codigo.');

    var ents = m.dataModel.entidades;
    if (!ents.length) {
        h += '<p class="dg-empty">Nenhuma tabela identificada no codigo nem no DDL.</p>';
        return h + '</section>';
    }

    /* acessos por tabela, para dar contexto de uso */
    var acessos = {};
    Object.keys(m.rastreabilidade.matriz).forEach(function (t) {
        acessos[t] = Object.keys(m.rastreabilidade.matriz[t]).length;
    });

    var decl = ents.filter(function (e) { return e.fonte === 'declarado'; }).length;
    var banco = ents.filter(function (e) { return e.banco; }).length;
    var basesIdent = (m.dataModel.bancos || []).filter(function (b) { return b.identificado; });
    h += '<div class="dg-grid dg-grid--4" style="margin-bottom:18px">' +
        kpiSimples(ents.length, 'Tabelas') +
        kpiSimples(ents.filter(function (e) { return e.origem === 'propria'; }).length, 'Proprias') +
        kpiSimples(basesIdent.length, basesIdent.length === 1 ? 'Base de dados' : 'Bases de dados') +
        kpiSimples(decl, 'Com esquema declarado') +
        kpiSimples(banco, 'Confirmadas no banco') +
        '</div>';

    h += cartaoBases(m);

    /* --- indice de todas as tabelas --- */
    h += '<div class="dg-h3">Todas as tabelas (' + ents.length + ')</div>';
    h += '<div class="dg-filtro"><input type="text" class="dg-input" id="dgFiltroTabelas" placeholder="filtrar tabela…"></div>';
    h += tabela(['Tabela', 'Base de dados', 'Origem', 'Fonte', 'Colunas', 'Modulos que acessam'], ents.map(function (e) {
        return '<tr><td><a class="dg-flink" href="#tab-' + esc(e.chave) + '"><code>' + esc(e.chave) + '</code></a></td>' +
            '<td>' + bancoBadge(e) + '</td>' +
            '<td>' + origemBadge(e.origem) + '</td>' +
            '<td>' + fonteBadge(e) + '</td>' +
            '<td>' + e.colunas.length + '</td>' +
            '<td>' + (acessos[e.chave] || 0) + '</td></tr>';
    }), 'dgTabTabelas');

    /* --- estrutura de cada tabela --- */
    h += '<div class="dg-h3">Estrutura das tabelas</div>';
    var grupos = [
        { t: 'Tabelas proprias da aplicacao', f: function (e) { return e.origem === 'propria'; } },
        { t: 'Tabelas TOTVS RM / CORPORE', f: function (e) { return e.origem === 'rm'; } },
        { t: 'Outras tabelas externas', f: function (e) { return e.origem === 'externa'; } }
    ];
    grupos.forEach(function (g) {
        var lista = ents.filter(g.f);
        if (!lista.length) return;
        h += '<div class="dg-note" style="font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:.6px;margin:18px 0 8px">' +
            esc(g.t) + ' (' + lista.length + ')</div>';
        lista.forEach(function (e) { h += entidadeCard(e, acessos[e.chave] || 0); });
    });

    /* --- relacionamentos --- */
    h += '<div class="dg-h3">Relacionamentos (' + m.dataModel.relacoes.length + ')</div>';
    if (m.dataModel.relacoes.length) {
        h += '<p class="dg-note" style="margin-bottom:10px">Relacoes <b>declaradas</b> vem de foreign keys reais. As <b>inferidas</b> foram deduzidas do padrao de nome <code>XXX_ID</code> e servem como hipotese, nao como verdade.</p>';
        h += tabela(['De', 'Coluna (FK)', 'Para', 'Coluna alvo', 'Cardinalidade', 'Fonte'],
            m.dataModel.relacoes.map(function (r) {
                return '<tr><td><code>' + esc(r.de) + '</code></td><td><code>' + esc(r.deColuna) + '</code></td>' +
                    '<td><code>' + esc(r.para) + '</code></td><td><code>' + esc(r.paraColuna || '?') + '</code></td>' +
                    '<td>' + esc(r.tipo) + '</td><td>' +
                    (r.fonte === 'declarado'
                        ? badge('declarado', 'green', r.constraint ? 'constraint ' + r.constraint : '')
                        : badge('inferido', 'gray')) + '</td></tr>';
            }));
    } else {
        h += '<p class="dg-empty">Nenhuma relacao pode ser inferida com seguranca. Traga o esquema do banco (pasta esquema-sql) para obter as foreign keys reais.</p>';
    }

    /* --- procedures e alteracoes --- */
    if (m.sql.procedures.length) {
        h += '<div class="dg-h3">Stored Procedures (' + m.sql.procedures.length + ')</div>';
        h += tabela(['Procedure', 'Parametros', 'Origem'], m.sql.procedures.map(function (p) {
            return '<tr><td><code>' + esc(p.nome) + '</code></td><td>' + chips(p.params) + '</td><td class="dg-note">' + esc(p.origem) + '</td></tr>';
        }));
    }
    if (m.sql.alters.length) {
        h += verTodos('Alteracoes de schema (ALTER TABLE) — ' + m.sql.alters.length,
            tabela(['Tabela', 'Mudanca'], m.sql.alters.map(function (a) {
                return '<tr><td><code>' + esc(a.tabela) + '</code></td><td class="dg-note">' + esc(a.mudanca) + '</td></tr>';
            })));
    }

    /* --- ponte com o banco --- */
    h += '<div class="dg-h3">Esquema SQL gerado</div>';
    h += '<div class="dg-callout">' +
        '<p style="margin:0 0 8px">Ao lado deste portal existe a pasta <code>' + esc(pastaCurta(m)) + '</code> com:</p>' +
        '<table class="dg-table" style="box-shadow:none;background:transparent">' +
        '<tr><td><code>01-extrair-esquema.sql</code></td><td>Consulta o catalogo do SQL Server e devolve o esquema real. <b>Rode este — uma vez so, em qualquer base.</b></td></tr>' +
        '<tr><td><code>02-ddl-inferido.sql</code></td><td>Rascunho do DDL deduzido do codigo, separado por base. Tipos sao estimativa.</td></tr>' +
        '<tr><td><code>03-esquema-consolidado.sql</code></td><td>Tudo que ja tem fonte declarada, separado por base.</td></tr>' +
        '<tr><td><code>00-LEIA-ME.md</code></td><td>O passo a passo completo, com a lista de bases a extrair.</td></tr>' +
        '</table>' +
        '<p style="margin:8px 0 0">Salve o resultado nessa mesma pasta e gere o portal de novo: o que hoje aparece como <i>inferido</i> passa a <b>declarado (banco)</b>.</p>' +
        '</div>';

    return h + '</section>';
}
/* Em qual BASE a tabela vive. Uma aplicacao Fluig atravessa FLUIG e CORPORE na
   mesma consulta; sem essa coluna, o portal daria a entender que tudo esta no
   mesmo lugar — e o script de extracao rodaria na base errada. */
function bancoBadge(e) {
    if (e.bancoAmbiguo) {
        return badge(e.bancos.join(' / '), 'orange',
            'Este nome de tabela aparece em mais de uma base. Confirme se sao a mesma tabela.');
    }
    if (!e.bancoNome) {
        return badge('base nao identificada', 'gray',
            'O codigo referencia esta tabela sem o prefixo do banco (dbo.X em vez de FLUIG.dbo.X).');
    }
    var cor = /CORPORE|RM|TOTVS/.test(e.bancoNome) ? 'orange' : 'blue';
    return badge(e.bancoNome, cor, 'Base de dados: ' + e.bancoNome +
        (e.esquema ? ' · esquema ' + e.esquema : '') +
        (e.banco ? ' · confirmado no catalogo do SQL Server' : ''));
}

/* Panorama das bases: quantas tabelas em cada uma, e quanto ja foi extraido. */
function cartaoBases(m) {
    var bancos = m.dataModel.bancos || [];
    if (!bancos.length) return '';
    var extraidas = {};
    ((m.esquemaBanco && m.esquemaBanco.bancos) || []).forEach(function (b) { extraidas[b] = 1; });

    var h = '<div class="dg-card dg-card--accent" style="margin-bottom:22px">' +
        '<div class="dg-h3" style="margin-top:0">Bases de dados que a aplicacao usa</div>' +
        '<p class="dg-note" style="margin:0 0 12px">O <code>01-extrair-esquema.sql</code> le todas estas bases em ' +
        '<b>uma execucao so</b>, qualificando o catalogo pelo nome do banco (<code>[FLUIG].sys.objects</code>) — ' +
        'e o portal atribui cada tabela a base onde ela realmente esta.</p>';
    h += tabela(['Base', 'Tabelas', 'Com esquema declarado', 'Confirmadas no catalogo', 'Esquema ja extraido'],
        bancos.map(function (b) {
            var pronto = b.identificado && extraidas[b.nome];
            return '<tr><td>' + (b.identificado ? '<code>' + esc(b.nome) + '</code>' : vazio(b.nome)) + '</td>' +
                '<td>' + b.tabelas + '</td><td>' + b.declaradas + '</td><td>' + b.confirmadas + '</td>' +
                '<td>' + (pronto ? badge('sim', 'green') : badge('nao', 'gray',
                    'Rode 01-extrair-esquema.sql e salve o resultado na pasta esquema-sql desta aplicacao. ' +
                    'Se ele ja rodou, esta base pode ter voltado com tipo=ERRO — veja os avisos no rodape.')) + '</td></tr>';
        }));
    var semBase = bancos.filter(function (b) { return !b.identificado; })[0];
    if (semBase) {
        h += '<p class="dg-note" style="margin-top:10px">' + semBase.tabelas + ' tabela(s) sao referenciadas no codigo ' +
            '<b>sem o prefixo do banco</b> (<code>dbo.X</code> em vez de <code>FLUIG.dbo.X</code>). ' +
            'Elas entram na lista de todas as execucoes: a base em que forem encontradas passa a ser a base delas.</p>';
    }
    return h + '</div>';
}

function origemBadge(o) {
    if (o === 'propria') return badge('propria', 'red');
    if (o === 'rm') return badge('RM/CORPORE', 'orange');
    return badge('externa', 'gray');
}
function fonteBadge(e) {
    if (e.banco) return badge('declarado (banco)', 'green', 'Extraido do catalogo do SQL Server: ' + (e.fonteArquivo || ''));
    if (e.fonte === 'declarado') return badge('declarado (DDL)', 'blue', 'DDL no repositorio: ' + (e.fonteArquivo || ''));
    return badge('inferido do codigo', 'gray', 'Deduzido do SQL embutido e dos grupos de colunas. Rode esquema-sql/01-extrair-esquema.sql para confirmar.');
}
function entidadeCard(e, nAcessos) {
    var corDot = e.origem === 'propria' ? D.COR.red : (e.origem === 'rm' ? D.COR.industria : D.COR.gray1);
    var head = '<span class="dg-dot" style="width:9px;height:9px;background:' + corDot + ';border-radius:2px"></span>' +
        '<code>' + esc(e.chave) + '</code> ' + bancoBadge(e) + ' ' + fonteBadge(e) +
        (e.ehView ? ' ' + badge('view', 'gray') : '') +
        '<span class="dg-note" style="margin-left:auto">' + e.colunas.length + ' colunas · ' + nAcessos + ' modulo(s)</span>';
    var body = '';
    if (e.nome !== e.chave) body += '<p class="dg-note" style="margin-top:12px">Nome completo no codigo: <code>' + esc(e.nome) + '</code></p>';
    if (e.fonteArquivo) body += '<p class="dg-note">Fonte: <code>' + esc(e.fonteArquivo) + '</code></p>';
    if (e.colunas.length) {
        body += tabela(['Coluna', 'Tipo', 'Nulo', 'Chave'], e.colunas.map(function (c) {
            return '<tr><td><code>' + esc(c.nome) + '</code>' + (c.inferida ? ' ' + badge('inf', 'gray', 'coluna deduzida do codigo') : '') +
                '</td><td>' + esc(c.tipo && c.tipo !== '?' ? c.tipo : '—') + '</td><td>' + (c.nulo ? 'sim' : 'nao') + '</td><td>' +
                (c.pk ? badge('PK', 'red') : (c.fk ? badge('FK', 'blue') : '')) + '</td></tr>';
        }));
    } else {
        body += '<p class="dg-empty" style="margin-top:12px">Colunas nao mapeadas a partir do codigo. Rode <code>esquema-sql/01-extrair-esquema.sql</code> para trazer a estrutura real.</p>';
    }
    return '<details class="dg-det" id="tab-' + esc(e.chave) + '"><summary>' + head + '</summary>' +
        '<div class="dg-det__body">' + body + '</div></details>';
}

/* -------------------------------------------------- 5. DATASETS */
function secDatasets(m) {
    var ds = m.datasets.filter(function (d) { return !d.backup; });
    var bk = m.datasets.filter(function (d) { return d.backup; });
    var h = section('datasets', 'Codigo', 'Datasets (server-side)',
        'Datasets customizados executados no servidor (Rhino). Para cada um: acoes suportadas, tabelas lidas/gravadas, grupos de colunas de retorno, funcoes e historico.');

    if (!ds.length && !bk.length) return '';
    if (!ds.length) { h += '<p class="dg-empty">Nenhum dataset server-side encontrado.</p>'; return h + '</section>'; }

    ds.forEach(function (d) {
        var head = '<code>' + esc(d.nome) + '</code>' +
            (d.acoes.length ? ' ' + badge(d.acoes.length + ' acoes', 'blue') : '') +
            (d.writes.length ? ' ' + badge('grava', 'red') : (d.reads.length ? ' ' + badge('leitura', 'green') : ''));
        var body = '';
        if (d.descricao) body += '<p style="margin-top:12px">' + esc(d.descricao) + '</p>';

        body += '<div class="dg-grid dg-grid--2" style="margin-top:8px">';
        body += '<div>' + rotulo('Acoes (_ACAO)') + chipsVerTodos(d.acoes, 30, '', 'Ver todas as acoes') + '</div>';
        body += '<div>' + rotulo('Datasource') + (d.jndi ? '<code>' + esc(d.jndi) + '</code>' : vazio('nao identificado')) + '</div>';
        body += '</div>';

        if (d.reads.length || d.writes.length) {
            body += '<div class="dg-grid dg-grid--2" style="margin-top:14px">';
            body += '<div>' + rotulo('Le (' + d.reads.length + ')') + chipsVerTodos(d.reads, 20, '', 'Ver todas') + '</div>';
            body += '<div>' + rotulo('Grava (' + d.writes.length + ')') + chipsVerTodos(d.writes, 20, '', 'Ver todas') + '</div>';
            body += '</div>';
        }

        if (d.colunasGrupos.length) {
            body += '<div class="dg-h3" style="font-size:13px;margin:18px 0 8px">Grupos de colunas de retorno</div>';
            d.colunasGrupos.forEach(function (g) {
                body += '<div style="margin-bottom:8px"><code style="color:' + D.COR.red + '">' + esc(g.nome) + '</code> ' +
                    '<span class="dg-note">(' + g.colunas.length + ')</span>' + chipsVerTodos(g.colunas, 40, '', 'Ver todas as colunas') + '</div>';
            });
        }
        if (d.chama.length) body += '<div style="margin-top:12px">' + rotulo('Chama datasets') + chips(d.chama) + '</div>';
        if (d.funcoes.length) {
            body += '<div class="dg-h3" style="font-size:13px;margin:18px 0 8px">Funcoes (' + d.funcoes.length + ')</div>' +
                chipsVerTodos(d.funcoes.map(function (f) { return f.nome + '()'; }), 40, 'dg-chip--fn', 'Ver todas as funcoes');
        }
        body += fonteDoArquivo(d.nome);
        body += '<div class="dg-h3" style="font-size:13px;margin:18px 0 8px">Historico</div>' + timelineVersoes(d.versoes);

        h += '<details class="dg-det"><summary>' + head + '</summary><div class="dg-det__body">' + body + '</div></details>';
    });

    if (bk.length) {
        h += '<div class="dg-warns" style="margin-top:8px">Arquivos de backup/copia detectados (fora da documentacao principal): ' +
            bk.map(function (d) { return '<code>' + esc(d.nome) + '</code>'; }).join(', ') +
            '. Recomenda-se remove-los do repositorio para evitar ambiguidade.</div>';
    }
    return h + '</section>';
}
/* Link para o codigo do arquivo, para o corpo do card (nunca no <summary>:
   la o clique tem de abrir e fechar o card). */
function fonteDoArquivo(nome) {
    if (!REL_POR_NOME[nome]) return '';
    return '<div class="dg-note" style="margin-top:14px">Codigo-fonte: ' + linkArquivo(nome) + '</div>';
}
function rotulo(t) {
    return '<div class="dg-note" style="font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:.5px;margin-bottom:6px">' + esc(t) + '</div>';
}

/* -------------------------------------------------- 6. FORMULARIOS */
function secFormularios(m) {
    if (!m.formularios.length) return '';
    var h = section('formularios', 'Codigo', 'Formularios',
        'Formularios do Fluig, um bloco por <b>pasta</b> em <code>forms/</code>. Cada bloco traz o cartao HTML, os eventos do cartao (displayFields, validacao), os scripts auxiliares, os campos referenciados e as atividades de workflow tratadas. Pastas diferentes sao formularios diferentes: nenhuma documentacao substitui a outra.');

    m.formularios.forEach(function (f) {
        /* uniao dos campos/elementos/funcoes de todos os scripts do cartao:
           num formulario real quem le o cartao e o displayFields, nao um .js
           homonimo do HTML — que muitas vezes nem existe */
        var scripts = [].concat(f.js ? [f.js] : [], f.eventos || [], f.auxiliares || []);
        var campos = [], elementos = [], atividades = [], funcoes = [];
        scripts.forEach(function (s) {
            campos = campos.concat(s.campos || []);
            elementos = elementos.concat(s.elementos || []);
            atividades = atividades.concat(s.atividades || []);
            (s.funcoes || []).forEach(function (x) { funcoes.push(s.nome + ' › ' + x.nome + '()'); });
        });
        campos = unicoArr(campos); elementos = unicoArr(elementos);

        var head = '<code>' + esc(f.base) + '</code>' +
            (f.idDataset ? ' ' + badge('dataset ' + f.idDataset, 'gray', 'codigo do formulario no Fluig') : '') +
            (campos.length ? ' ' + badge(campos.length + ' campos', 'blue') : '') +
            (f.eventos && f.eventos.length ? ' ' + badge(f.eventos.length + ' eventos', 'orange') : '') +
            (atividades.length ? ' ' + badge(atividades.length + ' atividades', 'orange') : '');
        var body = '';
        var desc = scripts.filter(function (s) { return s.descricao; })[0];
        if (desc) body += '<p style="margin-top:12px">' + esc(desc.descricao) + '</p>';
        body += '<p class="dg-note" style="margin:6px 0 0">Pasta no repositorio: <code>forms/' + esc(f.chave) + '</code></p>';

        if (f.eventos && f.eventos.length) {
            body += '<div class="dg-h3" style="font-size:13px;margin:16px 0 8px">Eventos do cartao (' + f.eventos.length + ')</div>';
            body += '<p class="dg-note" style="margin-bottom:8px">Ordem aproximada de execucao no Fluig: exibicao do cartao primeiro, validacao no envio depois.</p>';
            body += tabela(['Arquivo', 'Evento', 'Campos', 'Le', 'Grava'], f.eventos.map(function (e) {
                return '<tr><td>' + linkArquivo(e.nome) + '</td>' +
                    '<td>' + (e.evento && e.evento !== '(indefinido)' ? badge(e.evento, 'blue') : vazio('nao identificado')) + '</td>' +
                    '<td>' + (e.campos || []).length + '</td>' +
                    '<td>' + ((e.reads || []).length ? chips(e.reads) : '—') + '</td>' +
                    '<td>' + ((e.writes || []).length ? chips(e.writes) : '—') + '</td></tr>';
            }));
        }
        if (f.auxiliares && f.auxiliares.length) {
            body += '<div class="dg-h3" style="font-size:13px;margin:16px 0 8px">Scripts auxiliares do cartao (' + f.auxiliares.length + ')</div>';
            body += tabela(['Arquivo', 'Funcoes', 'Descricao'], f.auxiliares.map(function (e) {
                return '<tr><td>' + linkArquivo(e.nome) + '</td><td>' + (e.funcoes || []).length +
                    '</td><td class="dg-note">' + esc(e.descricao || '') + '</td></tr>';
            }));
        }
        if (atividades.length) {
            body += '<div class="dg-h3" style="font-size:13px;margin:14px 0 8px">Atividades tratadas</div>';
            body += tabela(['Constante', 'Codigo'], atividades.map(function (a) {
                return '<tr><td><code>' + esc(a.constante) + '</code></td><td>' + a.valor + '</td></tr>';
            }));
        }
        if (campos.length) {
            body += '<div class="dg-h3" style="font-size:13px;margin:16px 0 8px">Campos do cartao (' + campos.length + ')</div>' +
                chipsVerTodos(campos, 40, '', 'Ver todos os campos');
        }
        if (f.html && f.html.campos && f.html.campos.length) {
            body += '<div class="dg-h3" style="font-size:13px;margin:16px 0 8px">Campos declarados no HTML (' + f.html.campos.length + ')</div>' +
                chipsVerTodos(f.html.campos, 40, '', 'Ver todos os campos do HTML');
        }
        if (elementos.length) {
            body += '<div class="dg-h3" style="font-size:13px;margin:16px 0 8px">Paineis / elementos (' + elementos.length + ')</div>' +
                chipsVerTodos(elementos, 40, '', 'Ver todos os elementos');
        }
        if (funcoes.length) {
            body += '<div class="dg-h3" style="font-size:13px;margin:16px 0 8px">Funcoes (' + funcoes.length + ')</div>' +
                chipsVerTodos(funcoes, 40, 'dg-chip--fn', 'Ver todas as funcoes');
        }
        if (f.css && f.css.length) {
            body += '<div class="dg-h3" style="font-size:13px;margin:16px 0 8px">Estilos do cartao</div>' +
                tabela(['Arquivo', 'Tokens', 'Blocos'], f.css.map(function (c) {
                    return '<tr><td>' + linkArquivo(c.nome) + '</td><td>' + c.qtdTokens + '</td><td>' +
                        (c.blocos.length ? chipsVerTodos(c.blocos, 20, '', 'Ver todos') : vazio('nenhum')) + '</td></tr>';
                }));
        }
        body += '<div class="dg-note" style="margin-top:14px">Arquivos: ' +
            (f.html ? linkArquivo(f.html.nome) + ' ' : '') +
            (f.js ? linkArquivo(f.js.nome) : '') + '</div>';
        var comVersao = scripts.filter(function (s) { return s.versoes && s.versoes.length; })[0];
        if (comVersao) {
            body += '<div class="dg-h3" style="font-size:13px;margin:16px 0 8px">Historico (' + esc(comVersao.nome) + ')</div>' +
                timelineVersoes(comVersao.versoes);
        }
        h += '<details class="dg-det"><summary>' + head + '</summary><div class="dg-det__body">' + body + '</div></details>';
    });
    return h + '</section>';
}
function unicoArr(a) {
    var seen = {}, out = [];
    (a || []).forEach(function (x) { var k = String(x); if (!seen[k]) { seen[k] = 1; out.push(x); } });
    return out;
}

/* -------------------------------------------------- 7. WORKFLOW */
function secWorkflow(m) {
    if (!m.workflow.scripts.length && !m.workflow.processos.length && !m.workflow.svgProcesso.length) return '';
    var h = section('workflow', 'Processo', 'Workflow',
        'Processo BPMN, scripts de evento (server-side) e literais de internacionalizacao do fluxo.');

    if (m.workflow.svgProcesso.length) {
        h += '<div class="dg-h3">Diagrama do processo</div>';
        m.workflow.svgProcesso.forEach(function (s) {
            h += '<div class="dg-diagram"><div style="max-width:100%;overflow:auto">' + s.svg + '</div></div>';
            h += '<p class="dg-note">Fonte: <code>' + esc(s.nome) + '</code></p>';
        });
    }

    m.workflow.processos.forEach(function (p) {
        if (p.dados && p.dados.rotulos && p.dados.rotulos.length) {
            h += '<div class="dg-h3">Etapas do processo (' + esc(p.nome) + ')</div>';
            h += chipsVerTodos(p.dados.rotulos, 40, '', 'Ver todas as etapas');
        }
        if (p.xml && p.xml.atividades && p.xml.atividades.length) {
            h += '<div class="dg-h3">Atividades (' + esc(p.nome) + ')</div>';
            h += chipsVerTodos(p.xml.atividades, 40, '', 'Ver todas as atividades');
        }
    });

    h += '<div class="dg-h3">Scripts de evento</div>';
    if (!m.workflow.scripts.length) h += '<p class="dg-empty">Nenhum script de workflow encontrado.</p>';
    m.workflow.scripts.forEach(function (s) {
        var head = '<code>' + esc(s.nome) + '</code> ' + badge(s.evento, 'orange') +
            (s.writes.length ? ' ' + badge('grava', 'red') : (s.reads.length ? ' ' + badge('leitura', 'green') : ''));
        var body = '';
        if (s.descricao) body += '<p style="margin-top:12px">' + esc(s.descricao) + '</p>';
        if (s.reads.length || s.writes.length) {
            body += '<div class="dg-grid dg-grid--2" style="margin-top:8px">';
            body += '<div>' + rotulo('Le (' + s.reads.length + ')') + chipsVerTodos(s.reads, 20, '', 'Ver todas') + '</div>';
            body += '<div>' + rotulo('Grava (' + s.writes.length + ')') + chipsVerTodos(s.writes, 20, '', 'Ver todas') + '</div></div>';
        }
        if (s.chama.length) body += '<div style="margin-top:12px">' + rotulo('Chama datasets') + chips(s.chama) + '</div>';
        if (s.funcoes.length) {
            body += '<div class="dg-h3" style="font-size:13px;margin:16px 0 8px">Funcoes (' + s.funcoes.length + ')</div>' +
                chipsVerTodos(s.funcoes.map(function (f) { return f.nome + '()'; }), 40, 'dg-chip--fn', 'Ver todas as funcoes');
        }
        body += fonteDoArquivo(s.nome);
        body += '<div class="dg-h3" style="font-size:13px;margin:16px 0 8px">Historico</div>' + timelineVersoes(s.versoes);
        h += '<details class="dg-det"><summary>' + head + '</summary><div class="dg-det__body">' + body + '</div></details>';
    });

    var lit = m.i18n.filter(function (x) { return x.escopo === 'workflow'; });
    if (lit.length) {
        h += '<div class="dg-h3">Literais do processo (i18n)</div>';
        h += tabela(['Arquivo', 'Locale', 'Chaves'], lit.map(function (l) {
            return '<tr><td>' + linkArquivo(l.arquivo) + '</td><td>' + badge(l.locale) + '</td><td>' + l.total + '</td></tr>';
        }));
    }
    return h + '</section>';
}

/* -------------------------------------------------- 8. WIDGET (JS/CSS) */
function secWidget(m) {
    /* sem widget nenhuma, a secao inteira sai do portal (e do menu) */
    if (!m.widget.js.length && !m.widget.css.length && !Object.keys(m.tokens || {}).length) return '';
    var h = section('widget', 'Codigo', 'Widget &mdash; JS e CSS',
        'Modulos client-side da widget: classes de dominio (POO), componentes de UI, orquestracao e o sistema de design (tokens CSS).');

    if (m.widget.js.length) {
        h += '<div class="dg-h3">Modulos JavaScript (' + m.widget.js.length + ')</div>';
        m.widget.js.forEach(function (w) {
            var head = '<code>' + esc(w.nome) + '</code> ' + papelBadge(w.role) +
                (w.classes.length ? ' ' + badge(w.classes.length + ' classes', 'red') : '');
            var body = '';
            if (w.descricao) body += '<p style="margin-top:12px">' + esc(w.descricao) + '</p>';
            if (w.classes.length) body += '<div class="dg-h3" style="font-size:13px;margin:14px 0 8px">Classes (prototype)</div>' + chipsVerTodos(w.classes, 30, 'dg-chip--fn', 'Ver todas');
            if (w.namespaces.length) body += '<div class="dg-h3" style="font-size:13px;margin:14px 0 8px">Namespaces</div>' + chipsVerTodos(w.namespaces, 30, '', 'Ver todos');
            if (w.funcoes.length) {
                body += '<div class="dg-h3" style="font-size:13px;margin:14px 0 8px">Funcoes (' + w.funcoes.length + ')</div>' +
                    chipsVerTodos(w.funcoes.map(function (f) { return f.nome + '()'; }), 40, 'dg-chip--fn', 'Ver todas as funcoes');
            }
            body += fonteDoArquivo(w.nome);
            if (w.versoes.length) body += '<div class="dg-h3" style="font-size:13px;margin:14px 0 8px">Historico</div>' + timelineVersoes(w.versoes);
            if (!body) body = '<p class="dg-note" style="margin-top:12px">Sem metadados extraidos.</p>';
            h += '<details class="dg-det"><summary>' + head + '</summary><div class="dg-det__body">' + body + '</div></details>';
        });
    }

    var tk = Object.keys(m.tokens || {});
    if (tk.length) {
        h += '<div class="dg-h3">Design tokens (CSS) &mdash; ' + tk.length + '</div>';
        h += '<div class="dg-tokens">' + tk.map(function (k) {
            var v = m.tokens[k];
            var isColor = /^#|rgb|hsl/.test(v);
            return '<div class="dg-token" title="' + esc(k + ': ' + v) + '">' + (isColor ? '<i style="background:' + esc(v) + '"></i>' : '') +
                '<code>' + esc(k) + '</code><span class="dg-note">' + esc(trunc(v, 24)) + '</span></div>';
        }).join('') + '</div>';
    }
    if (m.widget.css.length) {
        h += '<div class="dg-h3">Folhas de estilo</div>';
        h += tabela(['Arquivo', 'Tokens', 'Blocos BEM'], m.widget.css.map(function (c) {
            return '<tr><td>' + linkArquivo(c.nome) + '</td><td>' + c.qtdTokens + '</td><td>' +
                (c.blocos.length ? chipsVerTodos(c.blocos, 20, '', 'Ver todos os blocos') : vazio('nenhum')) + '</td></tr>';
        }));
    }
    return h + '</section>';
}

/* -------------------------------------------------- 9. i18n */
function secI18n(m) {
    if (!m.i18n.length) return '';
    var h = section('i18n', 'Suporte', 'Internacionalizacao',
        'Cobertura de idiomas dos arquivos .properties (widget e workflow).');
    var porLocale = {};
    m.i18n.forEach(function (x) { porLocale[x.locale] = (porLocale[x.locale] || 0) + x.total; });
    h += '<div class="dg-grid dg-grid--4" style="margin-bottom:20px">' +
        Object.keys(porLocale).map(function (l) { return kpiSimples(porLocale[l], l); }).join('') + '</div>';
    h += tabela(['Arquivo', 'Escopo', 'Locale', 'Chaves'], m.i18n.map(function (l) {
        return '<tr><td>' + linkArquivo(l.arquivo) + '</td><td>' + badge(l.escopo) + '</td><td>' + badge(l.locale) + '</td><td>' + l.total + '</td></tr>';
    }));
    return h + '</section>';
}

/* -------------------------------------------------- 10. RASTREABILIDADE */
function secRastreabilidade(m) {
    var r = m.rastreabilidade;
    var h = section('rastreabilidade', 'Auditoria', 'Matriz de Rastreabilidade',
        'Cruzamento tabela x modulo. Mostra, para cada tabela do banco, quais datasets, scripts de workflow e procedures a leem (R), gravam (W) ou ambos (RW). Base para analise de impacto, auditoria e controle do Data Book.');

    if (!r.tabelas.length || !r.modulos.length) {
        h += '<p class="dg-empty">Sem dados suficientes para montar a matriz (nenhum acesso a tabela identificado no codigo).</p>';
        return h + '</section>';
    }

    var mods = r.modulos.filter(function (mm) { return (mm.reads && mm.reads.length) || (mm.writes && mm.writes.length); });

    h += '<div class="dg-legend" style="margin:0 0 12px">' +
        '<span class="dg-cell-R" style="font-weight:700">R</span> leitura &nbsp; ' +
        '<span class="dg-cell-W" style="font-weight:700">W</span> escrita &nbsp; ' +
        '<span class="dg-cell-RW" style="font-weight:700">RW</span> ambos</div>';

    h += '<div class="dg-table-wrap"><table class="dg-table dg-matrix"><thead><tr><th>Tabela \\ Modulo</th>' +
        mods.map(function (mm) {
            return '<th title="' + esc(mm.nome) + '">' + esc(mm.nome.replace(/\.js$/, '').replace(/^ds/, '')) + '</th>';
        }).join('') + '</tr></thead><tbody>';
    r.tabelas.forEach(function (t) {
        h += '<tr><td class="dg-l"><code>' + esc(t) + '</code></td>';
        mods.forEach(function (mm) {
            var v = r.matriz[t] && r.matriz[t][mm.nome];
            h += '<td class="' + (v ? 'dg-cell-' + v : '') + '"' + (v ? ' title="' + esc(mm.nome + ' → ' + t + ' (' + v + ')') + '"' : '') + '>' + (v || '·') + '</td>';
        });
        h += '</tr>';
    });
    h += '</tbody></table></div>';
    h += '<p class="dg-note" style="margin-top:10px">Acessos detectados por analise estatica de SQL no codigo. SQL montado dinamicamente pode nao aparecer &mdash; revise os modulos com concatenacao complexa.</p>';
    return h + '</section>';
}

/* -------------------------------------------------- 11. BIBLIOTECA DE CODIGO */
function secBiblioteca(m) {
    var arqs = m.biblioteca.arquivos;
    var h = section('biblioteca', 'Codigo-fonte', 'Biblioteca de Codigo',
        'Todo o codigo-fonte da aplicacao, indentado e colorido. Clique num arquivo para ler. Os nomes de arquivo espalhados pelo portal tambem levam para ca.');

    if (m._semCodigo) {
        h += '<div class="dg-callout">Portal gerado com <code>--sem-codigo</code>: o codigo-fonte nao foi ' +
            'embutido, para manter o HTML leve. O restante da documentacao (incluindo o mapa de chamadas, que ' +
            'depende da analise do codigo) continua completo. Gere sem essa opcao para ter o visualizador.</div>';
        return h + '</section>';
    }
    if (!arqs.length) {
        h += '<p class="dg-empty">Nenhum arquivo textual disponivel.</p>';
        return h + '</section>';
    }

    var totalLinhas = arqs.reduce(function (s, a) { return s + a.linhas; }, 0);
    h += '<div class="dg-grid dg-grid--4" style="margin-bottom:18px">' +
        kpiSimples(arqs.length, 'Arquivos') +
        kpiSimples(totalLinhas.toLocaleString('pt-BR'), 'Linhas de codigo') +
        kpiSimples(fmtBytes(m.biblioteca.bytes), 'Codigo embutido') +
        kpiSimples(m.biblioteca.omitidos.length, 'Nao embutidos') +
        '</div>';

    /* agrupa por pasta */
    var porCtx = {};
    arqs.forEach(function (a) { (porCtx[a.contexto] = porCtx[a.contexto] || []).push(a); });

    h += '<div class="dg-lib">';
    h += '<div class="dg-lib__aside">' +
        '<input type="text" class="dg-input dg-lib__search" id="dgLibBusca" placeholder="filtrar arquivo…" autocomplete="off">' +
        '<div class="dg-lib__tree" id="dgLibTree">';
    Object.keys(porCtx).sort().forEach(function (ctx) {
        h += '<div class="dg-lib__grupo">' + esc(ctx) + ' <span>' + porCtx[ctx].length + '</span></div>';
        porCtx[ctx].sort(function (a, b) { return a.nome < b.nome ? -1 : 1; }).forEach(function (a) {
            h += '<button type="button" class="dg-lib__item" data-idx="' + a.idx + '" data-rel="' + esc(a.rel) + '" ' +
                'title="' + esc(a.rel + '  ·  ' + a.linhas + ' linhas  ·  ' + fmtBytes(a.tamanho)) + '">' +
                '<span class="dg-lib__ico dg-lib__ico--' + esc(extCls(a.ext)) + '">' + esc(extCurta(a.ext)) + '</span>' +
                '<span class="dg-lib__nome">' + esc(a.nome) + '</span>' +
                '<span class="dg-lib__ln">' + a.linhas + '</span></button>';
        });
    });
    h += '</div></div>';

    h += '<div class="dg-lib__view">' +
        '<div class="dg-lib__bar">' +
        '<div class="dg-lib__titulo" id="dgLibTitulo">Selecione um arquivo</div>' +
        '<div class="dg-lib__meta" id="dgLibMeta"></div>' +
        '<button type="button" class="dg-lib__btn" id="dgLibCopiar" hidden>Copiar</button>' +
        '<button type="button" class="dg-lib__btn" id="dgLibQuebra" hidden>Quebrar linha</button>' +
        '</div>' +
        '<div class="dg-code dg-vs" id="dgLibCodigo">' +
        '<div class="dg-code__gutter" id="dgLibGutter"></div>' +
        '<pre class="dg-code__pre" id="dgLibPre"><span class="dg-note" style="padding:14px;display:block">' +
        'Escolha um arquivo na lista ao lado, ou clique no nome de qualquer arquivo citado no portal.</span></pre>' +
        '</div></div>';
    h += '</div>';

    if (m.biblioteca.omitidos.length) {
        h += verTodos('Arquivos nao embutidos (' + m.biblioteca.omitidos.length + ')',
            '<p class="dg-note" style="margin:12px 0">Binarios e arquivos acima do orcamento de tamanho do portal ficam de fora do visualizador, mas continuam no inventario.</p>' +
            tabela(['Arquivo', 'Motivo', 'Tamanho'], m.biblioteca.omitidos.map(function (o) {
                return '<tr><td><code>' + esc(o.rel) + '</code></td><td class="dg-note">' + esc(o.motivo) + '</td><td>' + fmtBytes(o.tamanho) + '</td></tr>';
            })));
    }
    return h + '</section>';
}
function extCurta(ext) {
    var e = String(ext || '').replace(/^\./, '').toUpperCase();
    if (e === 'PROPERTIES') return 'PRP';
    if (e === 'PROCESS') return 'BPM';
    return e.slice(0, 4) || '—';
}
function extCls(ext) {
    var e = String(ext || '').replace(/^\./, '').toLowerCase();
    if (['js', 'sql', 'css', 'html', 'ftl', 'md', 'xml', 'properties'].indexOf(e) >= 0) return e;
    return 'outro';
}

/* -------------------------------------------------- 12. INVENTARIO */
function secInventario(m) {
    var h = section('inventario', 'Anexos', 'Inventario de Arquivos',
        'Todos os arquivos varridos na pasta raiz, com o tipo logico atribuido pela ferramenta.');
    var porCtx = {};
    m.inventario.forEach(function (f) { (porCtx[f.contexto] = porCtx[f.contexto] || []).push(f); });
    Object.keys(porCtx).sort().forEach(function (ctx) {
        h += '<div class="dg-h3" style="font-size:13px">' + esc(ctx) + ' <span class="dg-note">(' + porCtx[ctx].length + ')</span></div>';
        h += tabela(['Arquivo', 'Tipo', 'Tamanho'], porCtx[ctx].map(function (f) {
            return '<tr><td>' + linkArquivo(f.nome) + '</td><td>' + badge(f.tipo) + '</td><td>' + fmtBytes(f.tamanho) + '</td></tr>';
        }));
    });
    if (m.avisos.length) {
        h += '<div class="dg-h3" style="font-size:13px">Avisos do gerador</div>';
        h += '<div class="dg-warns">' + m.avisos.map(esc).join('<br>') + '</div>';
    }
    return h + '</section>';
}

/* ------------------------------------------------------------ helpers layout */
function tabela(cols, linhas, id) {
    if (!linhas || !linhas.length) return '<p class="dg-empty">Nada a listar.</p>';
    return '<div class="dg-table-wrap"><table class="dg-table"' + (id ? ' id="' + id + '"' : '') + '><thead><tr>' +
        cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') +
        '</tr></thead><tbody>' + linhas.join('') + '</tbody></table></div>';
}
function section(id, eyebrow, titulo, lead) {
    return '<section class="dg-sec" id="sec-' + id + '">' +
        '<div class="dg-sec__eyebrow">' + eyebrow + '</div>' +
        '<h2 class="dg-sec__title">' + titulo + '</h2>' +
        (lead ? '<p class="dg-sec__lead">' + lead + '</p>' : '');
}

/* ------------------------------------------------------------ MENU + SHELL */
function sidebar(m) {
    var links = [];
    var dot = function (cor) { return '<span class="dg-dot" style="background:' + cor + '"></span>'; };
    var C = D.COR;
    var add = function (id, txt, cor, count) { links.push({ id: id, txt: txt, cor: cor, count: count }); };

    var nDatasets = m.datasets.filter(function (d) { return !d.backup; }).length;
    add('overview', 'Visao Geral', C.red);
    add('arquitetura', 'Arquitetura do Sistema', C.subsea);
    add('chamadas', 'Mapa de Chamadas', C.mooring, m.grafo.arestas.length);
    add('dados', 'Arquitetura de Dados', C.mooring, m.dataModel.entidades.length);
    if (nDatasets) add('datasets', 'Datasets', C.servicos, nDatasets);
    if (m.formularios.length) add('formularios', 'Formularios', C.industria, m.formularios.length);
    if (m.workflow.scripts.length || m.workflow.processos.length || m.workflow.svgProcesso.length) {
        add('workflow', 'Workflow', C.industria, m.workflow.scripts.length);
    }
    if (m.widget.js.length || m.widget.css.length || Object.keys(m.tokens || {}).length) {
        add('widget', 'Widget (JS/CSS)', C.mooring, m.widget.js.length);
    }
    if (m.i18n.length) add('i18n', 'Internacionalizacao', C.gray1, m.i18n.length);
    add('rastreabilidade', 'Rastreabilidade', C.red, m.rastreabilidade.tabelas.length);
    add('biblioteca', 'Biblioteca de Codigo', C.servicos, m.biblioteca.arquivos.length);
    add('inventario', 'Inventario', C.gray1, m.inventario.length);

    var grupos = [
        { t: 'Visao', ids: ['overview'] },
        { t: 'Arquitetura', ids: ['arquitetura', 'chamadas', 'dados'] },
        { t: 'Codigo', ids: ['datasets', 'formularios', 'workflow', 'widget'] },
        { t: 'Qualidade & Anexos', ids: ['i18n', 'rastreabilidade', 'biblioteca', 'inventario'] }
    ];
    var byId = {}; links.forEach(function (l) { byId[l.id] = l; });

    var html = '<aside class="dg-side" id="dgSide"><div class="dg-side__brand">' +
        '<div class="dg-side__logo"><b>delp</b> docs</div>' +
        '<div class="dg-side__sub">' + esc(m.meta.appCode || 'aplicacao fluig') + '</div></div>' +
        '<nav class="dg-side__nav">';
    grupos.forEach(function (g) {
        var itens = g.ids.filter(function (id) { return byId[id]; });
        if (!itens.length) return;
        html += '<div class="dg-side__group">' + esc(g.t) + '</div>';
        itens.forEach(function (id) {
            var l = byId[id];
            html += '<a class="dg-side__link" href="#sec-' + id + '" data-sec="' + id + '">' + dot(l.cor) + esc(l.txt) +
                (l.count != null ? '<span class="dg-side__count">' + l.count + '</span>' : '') + '</a>';
        });
    });
    html += '</nav></aside>';
    return html;
}

/* Codigo-fonte embutido para o visualizador. '<' vira \u003c: assim nenhum
   conteudo consegue fechar a tag <script> por acidente. */
function dadosFontes(m) {
    if (m._semCodigo) return '<script type="application/json" id="dgFontes">[]</script>';
    var dados = m.fontes.map(function (f) {
        return { i: f.idx, n: f.nome, r: f.rel, e: f.ext, l: f.lang, t: f.truncado ? 1 : 0, ln: f.linhas, c: f.conteudo };
    });
    var json = JSON.stringify(dados)
        .replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
        .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return '<script type="application/json" id="dgFontes">' + json + '</script>';
}

function scriptRuntime() {
    return '<script>(' + runtimePortal.toString() + ')();</script>';
}

/* Runtime do portal: scroll-spy, menu, biblioteca, grafo e filtros.
   Serializado com toString(), portanto precisa ser autocontido. */
function runtimePortal() {
    /* ------------------------------------------------ navegacao lateral */
    var links = [].slice.call(document.querySelectorAll('.dg-side__link'));
    var secs = links.map(function (l) { return document.getElementById('sec-' + l.getAttribute('data-sec')); });
    function onScroll() {
        var y = window.scrollY + 90, idx = 0;
        for (var i = 0; i < secs.length; i++) { if (secs[i] && secs[i].offsetTop <= y) idx = i; }
        links.forEach(function (l, i) { l.classList.toggle('is-active', i === idx); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var side = document.getElementById('dgSide');
    var btn = document.getElementById('dgMenu');
    if (btn) btn.addEventListener('click', function () { side.classList.toggle('is-open'); });
    links.forEach(function (l) {
        l.addEventListener('click', function () { if (window.innerWidth <= 920) side.classList.remove('is-open'); });
    });

    /* ------------------------------------------------ biblioteca de codigo */
    var FONTES = [];
    try {
        var tag = document.getElementById('dgFontes');
        if (tag) FONTES = JSON.parse(tag.textContent || tag.innerText || '[]');
    } catch (e) { FONTES = []; }

    var porRel = {}, porIdx = {};
    FONTES.forEach(function (f) { porRel[f.r] = f; porIdx[f.i] = f; });

    var elPre = document.getElementById('dgLibPre');
    var elGut = document.getElementById('dgLibGutter');
    var elTit = document.getElementById('dgLibTitulo');
    var elMet = document.getElementById('dgLibMeta');
    var elCop = document.getElementById('dgLibCopiar');
    var elQbr = document.getElementById('dgLibQuebra');
    var atual = null;

    function abrir(f) {
        if (!f || !elPre) return;
        atual = f;
        var codigo = f.c || '';
        var lang = f.l || (window.dgLang ? window.dgLang(f.e) : '');
        elPre.innerHTML = (window.dgHl && lang) ? window.dgHl(codigo, lang) : escapaHtml(codigo);
        var n = codigo ? codigo.split(/\r\n|\r|\n/).length : 0;
        var g = '';
        for (var i = 1; i <= n; i++) g += i + '\n';
        elGut.textContent = g;
        elTit.textContent = f.n;
        elMet.innerHTML = '<code>' + escapaHtml(f.r) + '</code> · ' + n + ' linhas' +
            (f.t ? ' · <b style="color:#CC0F10">truncado</b>' : '');
        elCop.hidden = false;
        elQbr.hidden = false;
        var tree = document.getElementById('dgLibTree');
        if (tree) {
            [].slice.call(tree.querySelectorAll('.dg-lib__item')).forEach(function (b) {
                var on = b.getAttribute('data-rel') === f.r;
                b.classList.toggle('is-active', on);
                if (on && b.scrollIntoView) b.scrollIntoView({ block: 'nearest' });
            });
        }
        document.getElementById('dgLibCodigo').scrollTop = 0;
    }
    function escapaHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    var tree = document.getElementById('dgLibTree');
    if (tree) {
        tree.addEventListener('click', function (ev) {
            var b = ev.target.closest ? ev.target.closest('.dg-lib__item') : null;
            if (b) abrir(porIdx[b.getAttribute('data-idx')]);
        });
    }

    var busca = document.getElementById('dgLibBusca');
    if (busca) {
        busca.addEventListener('input', function () {
            var q = busca.value.toLowerCase().trim();
            var itens = [].slice.call(tree.querySelectorAll('.dg-lib__item'));
            itens.forEach(function (b) {
                var ok = !q || b.getAttribute('data-rel').toLowerCase().indexOf(q) >= 0;
                b.style.display = ok ? '' : 'none';
            });
            [].slice.call(tree.querySelectorAll('.dg-lib__grupo')).forEach(function (g) {
                var vis = false, n = g.nextElementSibling;
                while (n && !n.classList.contains('dg-lib__grupo')) {
                    if (n.style.display !== 'none') vis = true;
                    n = n.nextElementSibling;
                }
                g.style.display = vis ? '' : 'none';
            });
        });
    }

    if (elCop) {
        elCop.addEventListener('click', function () {
            if (!atual) return;
            var txt = atual.c || '';
            var ok = function () { elCop.textContent = 'Copiado'; setTimeout(function () { elCop.textContent = 'Copiar'; }, 1400); };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(txt).then(ok, function () { copiaFallback(txt, ok); });
            } else { copiaFallback(txt, ok); }
        });
    }
    function copiaFallback(txt, ok) {
        var ta = document.createElement('textarea');
        ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); ok(); } catch (e) {}
        document.body.removeChild(ta);
    }
    if (elQbr) {
        elQbr.addEventListener('click', function () {
            var box = document.getElementById('dgLibCodigo');
            box.classList.toggle('is-wrap');
            elQbr.classList.toggle('is-on');
        });
    }

    /* links "ver o codigo" espalhados pelo portal */
    document.addEventListener('click', function (ev) {
        var a = ev.target.closest ? ev.target.closest('[data-abrir]') : null;
        if (!a) return;
        var f = porRel[a.getAttribute('data-abrir')];
        if (!f) return;
        ev.preventDefault();
        var sec = document.getElementById('sec-biblioteca');
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        abrir(f);
    });

    /* ------------------------------------------------ grafo de chamadas */
    var grafo = document.getElementById('dgGrafo');
    if (grafo) {
        var svgEl = grafo.querySelector('svg');
        grafo.addEventListener('click', function (ev) {
            var no = ev.target.closest ? ev.target.closest('.dg-gnode') : null;
            if (!no) { svgEl.classList.remove('is-focado'); limpar(); return; }
            var id = no.getAttribute('data-no');
            if (svgEl.classList.contains('is-focado') && no.classList.contains('is-alvo')) {
                svgEl.classList.remove('is-focado'); limpar(); return;
            }
            limpar();
            svgEl.classList.add('is-focado');
            no.classList.add('is-alvo');
            var ligados = {};
            [].slice.call(svgEl.querySelectorAll('.dg-edge')).forEach(function (e) {
                var de = e.getAttribute('data-de'), pa = e.getAttribute('data-para');
                if (de === id || pa === id) {
                    e.classList.add('is-on');
                    ligados[de] = 1; ligados[pa] = 1;
                }
            });
            [].slice.call(svgEl.querySelectorAll('.dg-gnode')).forEach(function (n) {
                if (ligados[n.getAttribute('data-no')]) n.classList.add('is-on');
            });
        });
        function limpar() {
            [].slice.call(svgEl.querySelectorAll('.is-on,.is-alvo')).forEach(function (n) {
                n.classList.remove('is-on'); n.classList.remove('is-alvo');
            });
        }
    }

    /* ------------------------------------------------ ancoras para <details>
       Ir para #tab-Z_DELP_X tem de ABRIR o card da tabela, nao so rolar ate ele. */
    function abrirAncora() {
        var id = (location.hash || '').replace('#', '');
        if (!id) return;
        var alvo = document.getElementById(id);
        if (!alvo) return;
        while (alvo) {
            if (alvo.tagName === 'DETAILS') alvo.open = true;
            alvo = alvo.parentElement;
        }
        var d = document.getElementById(id);
        if (d && d.scrollIntoView) d.scrollIntoView({ block: 'start' });
    }
    window.addEventListener('hashchange', abrirAncora);
    abrirAncora();

    /* ------------------------------------------------ filtros de tabela */
    function filtro(inputId, tabelaId) {
        var inp = document.getElementById(inputId);
        var tab = document.getElementById(tabelaId);
        if (!inp || !tab) return;
        var linhas = [].slice.call(tab.querySelectorAll('tbody tr'));
        inp.addEventListener('input', function () {
            var q = inp.value.toLowerCase().trim();
            linhas.forEach(function (tr) {
                tr.style.display = (!q || tr.textContent.toLowerCase().indexOf(q) >= 0) ? '' : 'none';
            });
        });
    }
    filtro('dgFiltroChamadas', 'dgTabChamadas');
    filtro('dgFiltroTabelas', 'dgTabTabelas');
}

/* ------------------------------------------------------------------ render */
function render(m) {
    /* indice usado pelos links de "ver o codigo" */
    REL_POR_NOME = {};
    if (!m._semCodigo) {
        m.fontes.forEach(function (f) { if (!REL_POR_NOME[f.nome]) REL_POR_NOME[f.nome] = f.rel; });
    }

    var body =
        secVisaoGeral(m) +
        secArquitetura(m) +
        secChamadas(m) +
        secDados(m) +
        secDatasets(m) +
        secFormularios(m) +
        secWorkflow(m) +
        secWidget(m) +
        secI18n(m) +
        secRastreabilidade(m) +
        secBiblioteca(m) +
        secInventario(m);

    var top = '<div class="dg-top">' +
        '<button class="dg-menu-btn" id="dgMenu" aria-label="Menu">☰</button>' +
        '<div><div class="dg-top__title">' + esc(m.meta.appTitle || m.meta.appCode || 'Documentacao Tecnica') + '</div>' +
        '<div class="dg-top__meta">' + esc(m.meta.appDescription ? trunc(m.meta.appDescription, 90) : 'Portal de documentacao tecnica') + '</div></div>' +
        '<div class="dg-top__spacer"></div>' +
        '<span class="dg-top__pill" title="' + esc(m.meta.tipoAppRotulo || '') + '">' +
        esc(m.meta.tipoAppRotulo || m.meta.appType || 'fluig') + '</span>' +
        '<button class="dg-top__print" onclick="window.print()">Imprimir / PDF</button>' +
        '</div>';

    var footer = '<footer class="dg-footer"><span><b style="color:var(--dg-red)">delp</b> docs</span>' +
        '<span>Gerado em ' + esc(dataBR(m.meta.geradoEm)) + '</span>' +
        '<span>' + esc(m.meta.ferramenta) + '</span>' +
        '<span style="margin-left:auto">Documentacao tecnica gerada automaticamente &mdash; revisar antes de uso como referencia oficial.</span></footer>';

    /* Marca de identidade: e o que permite ao gerador recusar sobrescrever a
       documentacao de OUTRA aplicacao que por acaso esteja no mesmo caminho. */
    var marca = '<meta name="dg-gerador" content="delp-docgen">' +
        '<meta name="dg-app" content="' + esc(m.meta.slug || '') + '">' +
        '<meta name="dg-app-code" content="' + esc(m.meta.appCode || '') + '">' +
        '<meta name="dg-app-tipo" content="' + esc(m.meta.tipoApp || '') + '">' +
        '<meta name="dg-origem" content="' + esc(String(m.meta.origem || '').replace(/\\/g, '/')) + '">';

    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' + marca +
        '<title>' + esc((m.meta.appCode || 'Aplicacao') + ' — Documentacao Tecnica DELP') + '</title>' +
        theme.fontLink() +
        '<style>' + theme.css() + hl.css() + '</style></head><body>' +
        '<div class="dg">' + sidebar(m) +
        '<div class="dg-main">' + top +
        '<main class="dg-content">' + body + '</main>' + footer +
        '</div></div>' +
        dadosFontes(m) + hl.clientJs() + scriptRuntime() +
        '</body></html>';
}

module.exports = { render: render };
