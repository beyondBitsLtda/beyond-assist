/* =============================================================================
   model.js - Consolida a varredura + parsing num modelo unico do sistema
   e deriva: arquitetura de dados (entidades/relacoes) e matriz de
   rastreabilidade (modulo x tabela: R/W/RW).
============================================================================= */
'use strict';

var P = require('./parse');
var TIPO = require('./scan').TIPO;
var H = require('./highlight');
var grafo = require('./grafo');
var ident = require('./identidade');

/* Limites do codigo embutido na biblioteca do portal (mantem o HTML utilizavel). */
var MAX_ARQUIVO = 512 * 1024;        /* por arquivo */
var MAX_MINIFICADO = 48 * 1024;      /* libs .min.* : ninguem le, mas fica o inicio */
var MAX_TOTAL = 14 * 1024 * 1024;    /* orcamento total de codigo embutido */

function unico(arr) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) { var k = String(arr[i]); if (!seen[k]) { seen[k] = 1; out.push(arr[i]); } }
    return out;
}

/* Normaliza nome de tabela para chave de relacao (ultimo segmento, upper). */
function chaveTabela(t) {
    var seg = String(t).split('.').pop();
    return seg.toUpperCase();
}

/* Marca se a tabela e do proprio projeto ou de um sistema de terceiro (ERP).
   Quando o nome qualificado diz o BANCO, ele decide: uma tabela em CORPORE e do
   RM mesmo que o nome nao pareca, e uma Z_* no FLUIG e da equipe mesmo sem o
   prefixo . Sem banco no nome, cai na heuristica pelo nome. */
/* Tabelas cujo CREATE TABLE esta NESTE repositorio. Preenchido antes de
   classificar qualquer origem — ver `origemTabela`. */
var DECLARADAS_AQUI = {};

function origemTabela(t, banco) {
    var s = String(t).toUpperCase();
    var seg = s.split('.').pop();
    var b = String(banco || P.bancoDe(t) || '').toUpperCase();

    /* A evidencia mais forte que existe: o repositorio CRIA esta tabela.
       -------------------------------------------------------------------------
       Vem antes de qualquer heuristica de nome. Sem isto, um projeto cujas
       tabelas nao seguem a convencao de prefixo antiga aparecia com "0 tabelas
       proprias" tendo o DDL de todas elas dentro de si — e o portal dizia que
       o sistema nao tem dados proprios, que e o oposto da verdade. */
    if (DECLARADAS_AQUI[seg]) return 'propria';

    if (b) {
        if (/CORPORE|RM|TOTVS/.test(b)) return 'rm';
        if (/APP|ECM/.test(b)) return /^Z_/.test(seg) ? 'propria' : 'externa';
    }
    if (/^Z_/.test(seg)) return 'propria';
    if (/CORPORE|TOTVS|GCCUSTO|TMOV|FCFO/.test(s)) return 'rm';
    return 'externa';
}

/* Prefixo comum das tabelas proprias, descoberto nas proprias tabelas.
   Antes isso era "PREFIXO_" fixo no codigo: em qualquer outra aplicacao o
   casamento por sufixo simplesmente nao acontecia. */
function prefixoTabelas(chaves) {
    if (chaves.length < 2) return chaves.length === 1 && /^[A-Z]+_[A-Z]+_/.test(chaves[0]) ? chaves[0].split('_').slice(0, 2).join('_') + '_' : '';
    var pre = chaves[0];
    for (var i = 1; i < chaves.length; i++) {
        var j = 0;
        while (j < pre.length && j < chaves[i].length && pre.charAt(j) === chaves[i].charAt(j)) j++;
        pre = pre.slice(0, j);
        if (!pre) break;
    }
    /* corta no ultimo separador para nao comer parte de um nome */
    var corte = pre.lastIndexOf('_');
    return corte > 0 ? pre.slice(0, corte + 1) : '';
}

function build(root, arquivos, opts) {
    opts = opts || {};
    /* Zera o que e de modulo: gerar dois projetos no mesmo processo faria o
       segundo herdar as tabelas do primeiro e marcar como "propria" uma tabela
       que ele nem conhece. */
    DECLARADAS_AQUI = {};
    var I = opts.identidade || ident.derivar(root, arquivos);
    var modelo = {
        identidade: I,
        meta: {
            geradoEm: new Date(),
            ferramenta: 'docgen 2.0.0',
            origem: root,
            appCode: '', appTitle: '', appDescription: '', appType: '', appCategory: '',
            renderer: '', developerCode: '', developerName: '', appVersion: '',
            viewFile: '', editFile: '', localeBase: '', uiwidget: '', mobileapp: ''
        },
        recursos: { js: [], css: [] },
        datasets: [],
        datasetsClient: [],
        formularios: [],
        ftls: [],
        workflow: { scripts: [], processos: [], svgProcesso: [], literais: [] },
        widget: { js: [], css: [] },
        sql: { tabelas: [], alters: [], procedures: [], pks: [], fks: [] },
        i18n: [],
        readmes: [],
        dataModel: { entidades: [], relacoes: [] },
        rastreabilidade: { tabelas: [], modulos: [], matriz: {} },
        tokens: {},
        inventario: [],
        /* codigo-fonte de cada arquivo, para a biblioteca e para o grafo */
        fontes: [],
        biblioteca: { arquivos: [], omitidos: [], bytes: 0 },
        /* esquema real trazido da pasta esquema-sql */
        esquemaBanco: { ativo: false, arquivos: [], tabelas: 0, fks: 0, pasta: opts.pastaEsquema || '' },
        grafo: { camadas: [], nos: [], porCamada: {}, arestas: [] },
        avisos: [],
        /* interno: --sem-codigo gera o portal sem a biblioteca embutida */
        _semCodigo: opts.semCodigo === true
    };

    /* Formularios agrupados pela PASTA dentro de forms/ (nao pelo nome do
       arquivo): duas pastas com o mesmo formulario sao duas documentacoes
       distintas, e uma nao pode sobrescrever a outra. */
    var formsPorChave = {};
    function formEntry(chave) {
        if (!formsPorChave[chave]) {
            var p = ident.partesFormulario(chave);
            formsPorChave[chave] = {
                chave: chave, base: p.base, idDataset: p.id,
                html: null, js: null, eventos: [], auxiliares: [], css: []
            };
        }
        return formsPorChave[chave];
    }
    function chaveDe(a) {
        return ident.chaveFormulario(a.rel) || baseForm(a.nome);
    }

    for (var i = 0; i < arquivos.length; i++) {
        var a = arquivos[i];
        /* le antes de consultar o tamanho: assim o scan deriva os bytes do
           proprio conteudo em vez de gastar um statSync a mais na rede */
        var conteudo = '';
        if (a.tipo !== TIPO.IMAGE) { try { conteudo = a.lerConteudo(); } catch (e) {} }

        modelo.inventario.push({ nome: a.nome, rel: a.rel, tipo: a.tipo, contexto: a.contexto, tamanho: a.tamanho });
        coletarFonte(modelo, a, conteudo);

        try {
            switch (a.tipo) {
                case TIPO.APP_INFO: {
                    /* so o application.info escolhido pela identidade vale: as
                       copias (.txt, "Copia", "Nova pasta") mudariam a ordem de
                       carregamento e o diagrama junto com ela */
                    if (I.appInfo && String(a.rel).replace(/\\/g, '/') !== I.appInfo) break;
                    var info = P.parseApplicationInfo(conteudo);
                    modelo.meta.appCode = info.code || modelo.meta.appCode;
                    modelo.meta.appTitle = info.title || '';
                    modelo.meta.appDescription = info.description || '';
                    modelo.meta.appType = info.type || '';
                    modelo.meta.appCategory = info.category || '';
                    modelo.meta.renderer = info.renderer || '';
                    modelo.meta.developerCode = info.developerCode || '';
                    modelo.meta.developerName = info.developerName || '';
                    modelo.meta.appVersion = info.version || '';
                    modelo.meta.viewFile = info.viewFile || '';
                    modelo.meta.editFile = info.editFile || '';
                    modelo.meta.localeBase = info.localeBase || '';
                    modelo.meta.uiwidget = info.uiwidget || '';
                    modelo.meta.mobileapp = info.mobileapp || '';
                    modelo.recursos.js = info.js;
                    modelo.recursos.css = info.css;
                    break;
                }
                case TIPO.DATASET_SERVER:
                    modelo.datasets.push(P.parseDataset(conteudo, a.nome));
                    break;
                case TIPO.DATASET_CLIENT:
                    modelo.datasetsClient.push(P.parseWidgetJs(conteudo, a.nome, I));
                    break;
                case TIPO.FORM_HTML:
                    formEntry(chaveDe(a)).html = { nome: a.nome, rel: a.rel, dados: P.parseFormHtml(conteudo) };
                    break;
                case TIPO.FORM_JS:
                    formEntry(chaveDe(a)).js = P.parseFormJs(conteudo, a.nome);
                    formEntry(chaveDe(a)).js.rel = a.rel;
                    break;
                case TIPO.FORM_EVENT_JS: {
                    var evt = P.parseFormEvento(conteudo, a.nome, a.tipo);
                    evt.rel = a.rel;
                    formEntry(chaveDe(a)).eventos.push(evt);
                    break;
                }
                case TIPO.FORM_AUX_JS: {
                    var aux = P.parseFormEvento(conteudo, a.nome, a.tipo);
                    aux.rel = a.rel;
                    formEntry(chaveDe(a)).auxiliares.push(aux);
                    break;
                }
                case TIPO.FTL:
                    if (!/\.txt$/i.test(a.nome)) modelo.ftls.push(P.parseFtl(conteudo, a.nome, I));
                    break;
                case TIPO.CSS: {
                    var css = P.parseCssTokens(conteudo, I);
                    var alvoCss = a.contexto === 'forms'
                        ? formEntry(chaveDe(a)).css
                        : modelo.widget.css;
                    alvoCss.push({ nome: a.nome, rel: a.rel, blocos: css.blocos, qtdTokens: Object.keys(css.tokens).length });
                    /* design tokens do SISTEMA sao os da widget; o style.css de um
                       cartao tambem tem variaveis, mas elas pertencem ao cartao —
                       promove-las a "design tokens da widget" criava uma secao de
                       widget em projeto que nao tem widget alguma */
                    if (a.contexto !== 'forms' && Object.keys(modelo.tokens).length === 0) {
                        modelo.tokens = css.tokens;
                    }
                    break;
                }
                case TIPO.WIDGET_JS:
                    modelo.widget.js.push(P.parseWidgetJs(conteudo, a.nome, I));
                    break;
                case TIPO.WORKFLOW_SCRIPT:
                    modelo.workflow.scripts.push(P.parseWorkflowScript(conteudo, a.nome));
                    break;
                case TIPO.WORKFLOW_PROCESS:
                    modelo.workflow.processos.push({ nome: a.nome, dados: P.parseProcess(conteudo) });
                    break;
                case TIPO.WORKFLOW_PROCESS_SVG:
                    modelo.workflow.svgProcesso.push({ nome: a.nome, rel: a.rel, svg: conteudo });
                    break;
                case TIPO.WORKFLOW_PROCESS_XML: {
                    var px = P.parseProcessXml(conteudo);
                    modelo.workflow.processos.push({ nome: a.nome, xml: px });
                    break;
                }
                case TIPO.SQL: {
                    var sql = P.parseSql(conteudo, a.nome);
                    /* Toda tabela criada por um .sql DESTE repositorio e, por
                       definicao, do proprio projeto. Registrar aqui, no momento
                       da leitura, e o que permite `origemTabela` decidir sem
                       depender de convencao de nome nenhuma. */
                    sql.tabelas.forEach(function (t) {
                        DECLARADAS_AQUI[String(t.nome).split('.').pop().toUpperCase()] = true;
                    });
                    sql.tabelas.forEach(function (t) { t.origemArquivo = a.rel; });
                    sql.fks.forEach(function (f) { f.origemArquivo = a.rel; });
                    modelo.sql.tabelas = modelo.sql.tabelas.concat(sql.tabelas);
                    modelo.sql.alters = modelo.sql.alters.concat(sql.alters);
                    modelo.sql.procedures = modelo.sql.procedures.concat(sql.procedures);
                    modelo.sql.pks = modelo.sql.pks.concat(sql.pks);
                    modelo.sql.fks = modelo.sql.fks.concat(sql.fks);
                    /* SP tambem entra na rastreabilidade */
                    if (sql.reads.length || sql.writes.length) {
                        modelo._sqlModulos = modelo._sqlModulos || [];
                        modelo._sqlModulos.push({ nome: a.nome, tipo: 'sql', reads: sql.reads, writes: sql.writes });
                    }
                    break;
                }
                case TIPO.PROPERTIES: {
                    var props = P.parseProperties(conteudo);
                    var loc = localeDe(a.nome);
                    modelo.i18n.push({ arquivo: a.nome, locale: loc.locale, escopo: loc.escopo, chaves: props.chaves, total: props.total });
                    break;
                }
                case TIPO.README:
                    if (a.nome.toLowerCase() === 'estrutura.md') {
                        modelo.readmes.push({ nome: a.nome, tipo: 'filetree', conteudo: conteudo });
                    } else {
                        modelo.readmes.push({ nome: a.nome, tipo: 'readme', conteudo: conteudo });
                    }
                    break;
                default: break;
            }
        } catch (e) {
            modelo.avisos.push('Falha ao processar ' + a.rel + ': ' + (e && e.message ? e.message : e));
        }
    }

    /* consolida formularios: cartao HTML + script principal + eventos + auxiliares */
    modelo.formularios = Object.keys(formsPorChave).sort().map(function (k) {
        var f = formsPorChave[k];
        var ordem = {};
        P.EVENTOS_FORM_ORDEM.forEach(function (e, idx) { ordem[e.toLowerCase()] = idx; });
        f.eventos.sort(function (x, y) {
            var a1 = ordem[String(x.evento).toLowerCase()], b1 = ordem[String(y.evento).toLowerCase()];
            if (a1 == null) a1 = 99;
            if (b1 == null) b1 = 99;
            return a1 !== b1 ? a1 - b1 : (x.nome < y.nome ? -1 : 1);
        });
        return {
            chave: f.chave,
            base: f.base,
            idDataset: f.idDataset,
            html: f.html ? {
                nome: f.html.nome, rel: f.html.rel, ids: f.html.dados.ids,
                campos: f.html.dados.campos, titulo: f.html.dados.titulo
            } : null,
            js: f.js || null,
            eventos: f.eventos,
            auxiliares: f.auxiliares,
            css: f.css
        };
    });

    /* separa backups (bkp) para nao poluir a doc principal */
    modelo.datasets = modelo.datasets.map(function (d) { d.backup = /bkp|copy|copia/i.test(d.nome); return d; });

    /* identidade preenche o que o application.info nao trouxe (formularios em
       geral nao tem application.info nenhum) */
    if (!modelo.meta.appCode) modelo.meta.appCode = I.appCode;
    if (!modelo.meta.appTitle) modelo.meta.appTitle = I.appTitle || I.appCode;
    modelo.meta.slug = I.slug;
    modelo.meta.tipoApp = I.tipo;
    modelo.meta.tipoAppRotulo = I.tipoRotulo;
    modelo.meta.origemNome = I.origemNome;
    I.avisos.forEach(function (av) { modelo.avisos.push(av); });

    /* o esquema extraido do banco entra DEPOIS do /sql da aplicacao: ele ganha. */
    ingerirEsquemaBanco(modelo, opts.esquemas);

    construirDataModel(modelo);
    construirRastreabilidade(modelo);

    /* biblioteca: indice navegavel (o conteudo continua em modelo.fontes) */
    modelo.biblioteca.arquivos = modelo._semCodigo ? [] : modelo.fontes.map(function (f) {
        return {
            idx: f.idx, nome: f.nome, rel: f.rel, ext: f.ext, tipo: f.tipo,
            contexto: f.contexto, lang: f.lang, tamanho: f.tamanho,
            linhas: f.linhas, truncado: f.truncado, minificado: f.minificado
        };
    });

    /* grafo de chamadas arquivo -> arquivo (precisa do modelo ja consolidado) */
    try { modelo.grafo = grafo.construir(modelo); }
    catch (e) { modelo.avisos.push('Falha ao montar o grafo de chamadas: ' + (e && e.message ? e.message : e)); }

    return modelo;
}

/* -------------------------------------------------- biblioteca de codigo-fonte */
/* Guarda o conteudo de cada arquivo textual para (a) a biblioteca navegavel do
   portal e (b) o grafo de chamadas. Respeita um orcamento de bytes para nao
   gerar um HTML impossivel de abrir. */
function coletarFonte(modelo, a, conteudo) {
    if (a.tipo === TIPO.IMAGE) {
        modelo.biblioteca.omitidos.push({ rel: a.rel, motivo: 'binario/imagem', tamanho: a.tamanho });
        return;
    }
    /* --sem-codigo: o grafo continua precisando do conteudo, mas nada e embutido
       no HTML. Marcamos a fonte como "so para analise". */
    var soAnalise = modelo._semCodigo === true;
    var minificado = /\.min\.(js|css)$/i.test(a.nome);
    var limite = minificado ? MAX_MINIFICADO : MAX_ARQUIVO;
    var texto = conteudo || '';
    var truncado = false;

    /* heuristica de binario: byte nulo ou muito caractere de controle */
    if (texto.indexOf('\u0000') >= 0) {
        modelo.biblioteca.omitidos.push({ rel: a.rel, motivo: 'conteudo binario', tamanho: a.tamanho });
        return;
    }
    if (texto.length > limite) { texto = texto.slice(0, limite); truncado = true; }
    if (!soAnalise && modelo.biblioteca.bytes + texto.length > MAX_TOTAL) {
        modelo.biblioteca.omitidos.push({ rel: a.rel, motivo: 'orcamento de tamanho do portal', tamanho: a.tamanho });
        texto = '';
        truncado = true;
    }
    var linhas = texto ? texto.split(/\r\n|\r|\n/).length : 0;
    if (soAnalise) modelo.biblioteca.omitidos.push({ rel: a.rel, motivo: 'gerado com --sem-codigo', tamanho: a.tamanho });
    else modelo.biblioteca.bytes += texto.length;
    var fonte = {
        idx: modelo.fontes.length,
        nome: a.nome,
        rel: a.rel.replace(/\\/g, '/'),
        ext: a.ext,
        tipo: a.tipo,
        contexto: a.contexto,
        role: /\.js$/i.test(a.nome) ? P.papelPorNome(a.nome) : '',
        lang: H.langDe(a.ext),
        tamanho: a.tamanho,
        linhas: linhas,
        truncado: truncado,
        minificado: minificado,
        conteudo: texto
    };
    modelo.fontes.push(fonte);
}

/* --------------------------------------- esquema real vindo da pasta esquema-sql */
function ingerirEsquemaBanco(modelo, esquemas) {
    if (!esquemas || !esquemas.length) return;
    var totalTab = 0, totalFk = 0;
    var bancosLidos = {};
    var ausentes = [];
    var errosBase = [];

    /* Todo arquivo aberto aparece no portal, inclusive o que nao deu em nada.
       Um arquivo que some da lista e indistinguivel de um arquivo que nunca foi
       salvo - e era exatamente essa a duvida de quem salvou e nao viu mudanca. */
    function registrar(e, sql) {
        modelo.esquemaBanco.arquivos.push({
            nome: e.nome, formato: e.formato || 'sql', extensao: e.extensao || '',
            bancos: ((sql && sql.bancos) || []).join(', '),
            tabelas: (sql && sql.tabelas ? sql.tabelas.length : 0),
            fks: (sql && sql.fks ? sql.fks.length : 0),
            pks: (sql && sql.pks ? sql.pks.length : 0),
            tamanho: e.tamanho, aviso: e.aviso || ''
        });
    }

    esquemas.forEach(function (e) {
        var sql;
        try {
            /* O formato ja veio decidido pelo conteudo (esquema.ler): 'csv' e a
               grade do catalogo, em qualquer separador ou largura fixa; 'sql' e
               DDL, aceito para os esquemas escritos a mao. */
            sql = e.formato === 'csv' ? P.parseEsquemaCsv(e.conteudo, e.nome) : P.parseSql(e.conteudo, e.nome);
        }
        catch (err) {
            modelo.avisos.push('Falha ao ler esquema ' + e.nome + ': ' + (err && err.message ? err.message : err));
            e.aviso = 'falha na leitura';
            registrar(e, null);
            return;
        }
        if (sql.erro) {
            modelo.avisos.push('Esquema ' + e.nome + ' ignorado: ' + sql.erro);
            e.aviso = sql.erro;
            registrar(e, null);
            return;
        }

        /* Arquivo lido, formato aceito e mesmo assim nada saiu dele. Sem este
           aviso o portal so mostrava "inferido" de novo, e nada dizia por que:
           era o modo de falhar mais caro da ferramenta. */
        if (!sql.tabelas.length && !sql.fks.length) {
            e.aviso = 'nenhuma tabela ou FK reconhecida';
            modelo.avisos.push('O arquivo ' + e.nome + ' foi lido da pasta esquema-sql mas nao ' +
                'produziu nenhuma tabela nem chave estrangeira, entao nada saiu de "inferido". ' +
                (e.formato === 'csv'
                    ? 'A grade veio vazia? Confira se o 01-extrair-esquema.sql retornou linhas antes de salvar.'
                    : 'O conteudo nao parece a grade do 01-extrair-esquema.sql nem um DDL com CREATE TABLE. ' +
                      'Salve de novo com "Save Results As..." a partir da grade de resultados.'));
        }

        (sql.erros || []).forEach(function (x) {
            errosBase.push(x);
            modelo.avisos.push('O 01-extrair-esquema.sql nao conseguiu ler a base ' + (x.banco || '(sem nome)') +
                ': ' + (x.mensagem || 'sem mensagem') + '. As tabelas dessa base continuam inferidas. ' +
                'Normalmente e permissao de leitura do catalogo, base fora do ar, ou base em outra instancia ' +
                '(nesse caso ela precisa ser extraida separadamente).');
        });
        (sql.bancos || []).forEach(function (b) { bancosLidos[b] = 1; });
        (sql.ausentes || []).forEach(function (a) { ausentes.push(a); });
        /* marca a procedencia: esse esquema veio do BANCO, e ganha de tudo */
        sql.tabelas.forEach(function (t) { t.banco = true; t.origemArquivo = 'esquema-sql/' + e.nome; });
        sql.pks.forEach(function (p) { p.banco = true; });
        sql.fks.forEach(function (f) { f.banco = true; f.origemArquivo = 'esquema-sql/' + e.nome; });

        modelo.sql.tabelas = modelo.sql.tabelas.concat(sql.tabelas);
        modelo.sql.alters = modelo.sql.alters.concat(sql.alters);
        modelo.sql.procedures = modelo.sql.procedures.concat(sql.procedures);
        modelo.sql.pks = modelo.sql.pks.concat(sql.pks);
        modelo.sql.fks = modelo.sql.fks.concat(sql.fks);

        totalTab += sql.tabelas.length;
        totalFk += sql.fks.length;
        registrar(e, sql);
    });
    /* Um arquivo so com FKs (ou so com colunas) ja e esquema vindo do banco. */
    modelo.esquemaBanco.ativo = totalTab > 0 || totalFk > 0;
    modelo.esquemaBanco.tabelas = totalTab;
    modelo.esquemaBanco.fks = totalFk;
    modelo.esquemaBanco.bancos = Object.keys(bancosLidos).sort();
    modelo.esquemaBanco.ausentes = ausentes;
    modelo.esquemaBanco.errosBase = errosBase;

    /* Objeto que o codigo usa e o catalogo nao encontrou em NENHUM banco lido.
       Enquanto so um banco foi extraido, "ausente aqui" nao quer dizer nada -
       a tabela pode estar na outra base. O aviso so vale para o que faltou em
       todas as bases lidas. */
    if (ausentes.length && modelo.esquemaBanco.bancos.length) {
        var vistasNoCatalogo = {};
        modelo.sql.tabelas.forEach(function (t) {
            if (t.banco) vistasNoCatalogo[chaveTabela(t.nome)] = 1;
        });
        var faltando = unico(ausentes.map(function (a) { return String(a.objeto).toUpperCase(); }))
            .filter(function (n) { return !vistasNoCatalogo[n]; });
        if (faltando.length) {
            modelo.avisos.push('Objeto(s) usados no codigo e nao encontrados em nenhuma das bases lidas (' +
                modelo.esquemaBanco.bancos.join(', ') + '): ' + faltando.join(', ') +
                '. Pode ser nome errado no codigo, objeto ainda nao criado, ou uma base que ainda nao foi extraida.');
        }
    }
}

function baseForm(nome) {
    return nome.replace(/\.(html|js)$/i, '').replace(/^\d+\s*-\s*/, '');
}

/* Todos os scripts de formulario (principal + eventos + auxiliares) numa lista
   plana, para alimentar arquitetura de dados e rastreabilidade. */
function modulosFormulario(modelo) {
    var out = [];
    modelo.formularios.forEach(function (f) {
        if (f.js) out.push(f.js);
        (f.eventos || []).forEach(function (e) { out.push(e); });
        (f.auxiliares || []).forEach(function (e) { out.push(e); });
    });
    return out;
}

function localeDe(nome) {
    var m = nome.match(/_(pt_BR|en_US|es|pt|en)\.properties$/i);
    var locale = m ? m[1] : 'default';
    var base = nome.replace(/(_(pt_BR|en_US|es|pt|en))?\.properties$/i, '');
    var escopo = /pedido|processo|workflow/i.test(base) ? 'workflow' : 'widget';
    return { locale: locale, escopo: escopo, base: base };
}

/* -------------------------------------------------- arquitetura de dados */
function construirDataModel(modelo) {
    var entidades = {};

    /* 1) tabelas declaradas no SQL (fonte autoritativa).
          Hierarquia de verdade: banco (esquema-sql) > DDL da aplicacao > codigo. */
    /* bancos onde cada nome de tabela foi visto (para detectar homonimos) */
    var bancosPorChave = {};
    function anotarBanco(chave, nomeBanco, confirmado) {
        if (!nomeBanco) return;
        var m = bancosPorChave[chave] = bancosPorChave[chave] || {};
        if (!m[nomeBanco] || confirmado) m[nomeBanco] = confirmado ? 'catalogo' : (m[nomeBanco] || 'codigo');
    }

    for (var i = 0; i < modelo.sql.tabelas.length; i++) {
        var t = modelo.sql.tabelas[i];
        var k = chaveTabela(t.nome);
        var bt = (t.bancoNome || P.bancoDe(t.nome) || '').toUpperCase();
        anotarBanco(k, bt, !!t.banco);
        if (entidades[k] && entidades[k].banco && !t.banco) continue;
        entidades[k] = {
            nome: t.nome, chave: k, origem: origemTabela(t.nome, bt), fonte: 'declarado',
            banco: !!t.banco,                 /* veio do catalogo do SQL Server */
            bancoNome: bt,                    /* em QUAL base de dados ela vive */
            esquema: t.esquema || P.partesTabela(t.nome).esquema || '',
            ehView: !!t.ehView,
            fonteArquivo: t.origemArquivo || t.origem || '',
            colunas: t.colunas.map(function (c) {
                return { nome: c.nome, tipo: c.tipo, nulo: c.nulo, pk: c.pk, identidade: !!c.identidade, fk: /_ID$/.test(c.nome) };
            })
        };
    }

    /* 1b) chaves primarias declaradas fora do CREATE TABLE */
    modelo.sql.pks.forEach(function (p) {
        var ent = entidades[chaveTabela(p.tabela)];
        if (!ent) return;
        if (p.porNomeConstraint && !p.banco && ent.banco) return;
        var alvo = {};
        p.colunas.forEach(function (c) { alvo[c.toUpperCase()] = 1; });
        ent.colunas.forEach(function (c) { if (alvo[c.nome.toUpperCase()]) c.pk = true; });
    });

    /* 2) tabelas referenciadas em datasets/scripts (inferidas, se ainda nao existem).
          Eventos e auxiliares de formulario tambem tocam o banco — num projeto
          de formulario eles sao a unica fonte de acesso a dados. */
    var fontesCodigo = modelo.datasets.concat(modelo.workflow.scripts).concat(modulosFormulario(modelo));
    for (var f = 0; f < fontesCodigo.length; f++) {
        var mod = fontesCodigo[f];
        for (var tt = 0; tt < (mod.tabelas || []).length; tt++) {
            var nomeTab = mod.tabelas[tt];
            var kk = chaveTabela(nomeTab);
            if (kk.charAt(kk.length - 1) === '_' || kk.length < 4) continue; /* filtra prefixo/ruido */
            var bk = P.bancoDe(nomeTab);
            anotarBanco(kk, bk, false);
            if (!entidades[kk]) {
                entidades[kk] = {
                    nome: nomeTab, chave: kk, origem: origemTabela(nomeTab, bk), fonte: 'inferido',
                    bancoNome: bk, esquema: P.partesTabela(nomeTab).esquema || '', colunas: []
                };
            } else if (!entidades[kk].bancoNome && bk) {
                /* o codigo qualificou o nome onde o DDL nao qualificava */
                entidades[kk].bancoNome = bk;
                entidades[kk].origem = origemTabela(entidades[kk].nome, bk);
            }
        }
    }

    /* 2b) colunas atribuiveis com seguranca (INSERT/UPDATE) -> enriquece entidades */
    for (var g2 = 0; g2 < fontesCodigo.length; g2++) {
        var colsMap = fontesCodigo[g2].colunasSql || {};
        Object.keys(colsMap).forEach(function (segTab) {
            /* casa o segmento com uma entidade existente */
            var alvo = null;
            Object.keys(entidades).forEach(function (k) { if (k === segTab || k.split('.').pop() === segTab) alvo = k; });
            if (!alvo) return;
            var ent = entidades[alvo];
            if (ent.fonte === 'declarado') return; /* SQL manda */
            var existentes = {}; ent.colunas.forEach(function (c) { existentes[c.nome.toUpperCase()] = 1; });
            colsMap[segTab].forEach(function (c) {
                if (!existentes[c.toUpperCase()]) {
                    ent.colunas.push({ nome: c, tipo: '?', nulo: true, pk: c.toUpperCase() === 'ID', fk: /_ID$/.test(c.toUpperCase()) && c.toUpperCase() !== 'ID', inferida: true });
                    existentes[c.toUpperCase()] = 1;
                }
            });
        });
    }

    /* 3) colunas inferidas dos grupos COLS_ nos datasets (marcadas como inferidas) */
    for (var d = 0; d < modelo.datasets.length; d++) {
        var ds = modelo.datasets[d];
        /* tabela principal = primeira TB resolvida */
        var principais = Object.keys(ds.tableVars || {}).map(function (v) { return ds.tableVars[v]; });
        if (!principais.length) continue;
        var kp = chaveTabela(principais[0]);
        var ent = entidades[kp];
        if (!ent) continue;
        if (ent.fonte === 'declarado') continue; /* nao mexe no que veio do SQL */
        var existentes = {}; ent.colunas.forEach(function (c) { existentes[c.nome] = 1; });
        (ds.colunasGrupos || []).forEach(function (g) {
            /* usa o maior grupo (normalmente COLS_LISTA) */
        });
        var maior = (ds.colunasGrupos || []).slice().sort(function (a, b) { return b.colunas.length - a.colunas.length; })[0];
        if (maior) {
            maior.colunas.forEach(function (c) {
                if (!existentes[c]) { ent.colunas.push({ nome: c, tipo: '?', nulo: true, pk: c === 'ID', fk: /_ID$/.test(c) && c !== 'ID', inferida: true }); existentes[c] = 1; }
            });
        }
    }

    var lista = Object.keys(entidades).map(function (k) { return entidades[k]; });

    /* --------------------------------------------------------- bancos de dados
       Uma consulta so ja atravessa mais de uma base. Atribuir cada tabela a sua
       base e o que permite gerar um script de extracao por banco - e o que evita
       tratar duas tabelas homonimas em bases distintas como se fossem uma. */
    lista.forEach(function (e) {
        var vistos = Object.keys(bancosPorChave[e.chave] || {});
        e.bancos = vistos;
        if (!e.bancoNome && vistos.length === 1) {
            e.bancoNome = vistos[0];
            e.origem = origemTabela(e.nome, e.bancoNome);
        }
        e.bancoAmbiguo = vistos.length > 1;
    });
    lista.filter(function (e) { return e.bancoAmbiguo; }).forEach(function (e) {
        modelo.avisos.push('A tabela ' + e.chave + ' aparece em mais de uma base (' + e.bancos.join(', ') +
            '). O portal a documenta como uma entidade so — confirme se sao a mesma tabela ' +
            'ou dois objetos diferentes com o mesmo nome.');
    });

    var porBanco = {};
    lista.forEach(function (e) {
        var b = e.bancoNome || '(nao identificado)';
        var g = porBanco[b] = porBanco[b] || { nome: b, identificado: !!e.bancoNome, tabelas: 0, declaradas: 0, confirmadas: 0 };
        g.tabelas++;
        if (e.fonte === 'declarado') g.declaradas++;
        if (e.banco) g.confirmadas++;
    });
    modelo.dataModel.bancos = Object.keys(porBanco).sort(function (a, b) {
        var ga = porBanco[a], gb = porBanco[b];
        if (ga.identificado !== gb.identificado) return ga.identificado ? -1 : 1;
        return gb.tabelas - ga.tabelas;
    }).map(function (k) { return porBanco[k]; });

    /* relacoes 1) CHAVES ESTRANGEIRAS REAIS - a fonte mais forte que existe.
       Vindas do DDL da aplicacao ou do esquema extraido do banco. */
    var relacoes = [];
    var declaradas = {};
    modelo.sql.fks.forEach(function (fk) {
        var de = chaveTabela(fk.tabela || '');
        var para = chaveTabela(fk.refTabela || '');
        if (!de || !para || !entidades[de] || !entidades[para]) return;
        relacoes.push({
            de: de, deColuna: fk.coluna, para: para, paraColuna: fk.refColuna,
            tipo: 'N:1', fonte: 'declarado',
            constraint: fk.constraint || '',
            fonteArquivo: fk.origemArquivo || ''
        });
        declaradas[de + '|' + String(fk.coluna).toUpperCase()] = 1;
        /* a coluna passa a ser oficialmente FK */
        entidades[de].colunas.forEach(function (c) {
            if (c.nome.toUpperCase() === String(fk.coluna).toUpperCase()) c.fk = true;
        });
    });

    /* relacoes 2) deducao por sufixo: coluna XXX_ID -> entidade que termina em XXX.
       So entra se a mesma coluna nao tiver uma FK declarada. */
    /* prefixo real das tabelas proprias desta aplicacao (nao um prefixo fixo) */
    var pre = prefixoTabelas(lista.filter(function (e) { return e.origem === 'propria'; })
        .map(function (e) { return e.chave; }));
    modelo.dataModel.prefixoTabelas = pre;

    var porSufixo = {};
    lista.forEach(function (e) {
        var seg = pre && e.chave.indexOf(pre) === 0 ? e.chave.slice(pre.length) : e.chave;
        porSufixo[seg] = e.chave;
    });
    lista.forEach(function (e) {
        e.colunas.forEach(function (c) {
            if (!/_ID$/.test(c.nome) || c.nome === 'ID') return;
            if (declaradas[e.chave + '|' + c.nome.toUpperCase()]) return; /* ja tem FK real */
            var alvoNome = c.nome.replace(/_ID$/, '');
            /* tenta casar por sufixo/segmento */
            var alvo = null;
            Object.keys(porSufixo).forEach(function (seg) {
                if (seg === alvoNome || seg === alvoNome + 'ES' || seg + 'ES' === alvoNome || seg.indexOf(alvoNome) === 0 || alvoNome.indexOf(seg) === 0) {
                    if (!alvo) alvo = porSufixo[seg];
                }
            });
            if (alvo && alvo !== e.chave) {
                relacoes.push({ de: e.chave, deColuna: c.nome, para: alvo, tipo: 'N:1', fonte: c.inferida ? 'inferido' : (e.fonte === 'declarado' ? 'declarado' : 'inferido') });
            }
        });
    });

    /* ordena: proprias primeiro, depois rm/externas */
    lista.sort(function (a, b) {
        var pa = a.origem === 'propria' ? 0 : (a.origem === 'rm' ? 1 : 2);
        var pb = b.origem === 'propria' ? 0 : (b.origem === 'rm' ? 1 : 2);
        if (pa !== pb) return pa - pb;
        return a.chave < b.chave ? -1 : 1;
    });

    modelo.dataModel.entidades = lista;
    modelo.dataModel.relacoes = dedupRel(relacoes);
}

function dedupRel(rels) {
    var seen = {}, out = [];
    rels.forEach(function (r) {
        var k = r.de + '|' + r.deColuna + '|' + r.para;
        if (!seen[k]) { seen[k] = 1; out.push(r); }
    });
    return out;
}

/* -------------------------------------------------- matriz de rastreabilidade */
function construirRastreabilidade(modelo) {
    var modulos = [];
    modelo.datasets.forEach(function (d) { if (!d.backup) modulos.push({ nome: d.nome, tipo: 'dataset', reads: d.reads, writes: d.writes }); });
    modelo.workflow.scripts.forEach(function (s) { modulos.push({ nome: s.nome, tipo: 'workflow', reads: s.reads, writes: s.writes }); });
    modulosFormulario(modelo).forEach(function (f) {
        if (!(f.reads || []).length && !(f.writes || []).length) return;
        modulos.push({ nome: f.nome, tipo: 'formulario', reads: f.reads, writes: f.writes });
    });
    (modelo._sqlModulos || []).forEach(function (s) { modulos.push(s); });

    var tabelasSet = {};
    var matriz = {};

    modulos.forEach(function (m) {
        var r = (m.reads || []).map(chaveTabela);
        var w = (m.writes || []).map(chaveTabela);
        unico(r.concat(w)).forEach(function (tk) {
            tabelasSet[tk] = 1;
            if (!matriz[tk]) matriz[tk] = {};
            var lê = r.indexOf(tk) >= 0, grava = w.indexOf(tk) >= 0;
            matriz[tk][m.nome] = grava && lê ? 'RW' : (grava ? 'W' : 'R');
        });
    });

    modelo.rastreabilidade.modulos = modulos;
    modelo.rastreabilidade.tabelas = Object.keys(tabelasSet).sort();
    modelo.rastreabilidade.matriz = matriz;
}

module.exports = { build: build, chaveTabela: chaveTabela, origemTabela: origemTabela };
