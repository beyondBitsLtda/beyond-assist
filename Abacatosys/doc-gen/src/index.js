/* =============================================================================
   index.js - Orquestrador. Junta scan + esquema-sql + model + render e grava
   o portal, mais a pasta esquema-sql/ ao lado dele.
============================================================================= */
'use strict';

var fs = require('fs');
var path = require('path');
var scan = require('./scan').scan;
var model = require('./model');
var render = require('./render').render;
var esquema = require('./esquema');
var identidade = require('./identidade');

async function gerar(root, opts) {
    opts = opts || {};
    var t0 = Date.now();

    var arquivos = await scan(root);
    if (!arquivos.length) throw new Error('Nenhum arquivo encontrado em: ' + root);

    /* 1. QUEM e esta aplicacao. Vem antes de tudo: define o nome do portal, a
          pasta de esquema e o tipo que os diagramas vao seguir. */
    var I = identidade.derivar(root, arquivos);

    /* 2. caminho de saida — sempre com o nome da aplicacao analisada */
    var saida = opts.out || path.join(process.cwd(), I.slug + '.doc.html');
    var dirEsquema = esquema.pasta(saida, I.slug);

    /* 3. nunca sobrescrever a documentacao de OUTRA aplicacao.
          Devolve string = conflito que bloqueia; { aviso } = so registra. */
    var checado = checarConflito(saida, I, root);
    var conflito = typeof checado === 'string' ? checado : '';
    var avisoOrigem = (checado && checado.aviso) ? checado.aviso : '';
    if (conflito && !opts.forcar) throw new Error(conflito);

    /* 4. le o esquema que o tecnico ja trouxe do banco (desta aplicacao) */
    var esquemas = esquema.ler(dirEsquema);

    /* 5. monta o modelo ja com esse esquema como fonte autoritativa */
    var m = model.build(root, arquivos, {
        identidade: I,
        esquemas: esquemas,
        pastaEsquema: dirEsquema,
        semCodigo: opts.semCodigo === true
    });

    if (conflito && opts.forcar) m.avisos.push('Sobrescrito com --forcar: ' + conflito);
    if (avisoOrigem) m.avisos.push(avisoOrigem);

    /* leituras que falharam: sem isso o portal ficaria incompleto em silencio */
    (arquivos.falhas || []).forEach(function (f) {
        m.avisos.push('Nao foi possivel ler ' + f.dir + ' (' + f.erro + '). ' +
            'O conteudo NAO entrou nesta documentacao — gere de novo para conferir.');
    });

    var orfaos = esquema.legado(saida);
    if (orfaos.length) {
        m.avisos.push('Ha ' + orfaos.length + ' arquivo(s) soltos na raiz de ' + esquema.NOME_PASTA +
            '/ (' + orfaos.join(', ') + '). Eles NAO foram lidos: sem saber a qual aplicacao pertencem, ' +
            'seriam atribuidos a esta por engano. Mova-os para ' + esquema.NOME_PASTA + '/' + I.slug + '/.');
    }

    /* Saida do catalogo salva na pasta de outra aplicacao: o arquivo esta certo,
       so esta no lugar onde ninguem le. */
    var perdidos = esquema.perdidos(saida, I.slug);
    if (perdidos.length) {
        m.avisos.push('Encontrei ' + perdidos.length + ' arquivo(s) com saida do 01-extrair-esquema.sql na pasta ' +
            'de OUTRA aplicacao (' + perdidos.join(', ') + '). Eles nao valem para ' + I.appCode + '. ' +
            'Se a extracao foi feita para esta aplicacao, mova para ' + esquema.NOME_PASTA + '/' + I.slug + '/ ' +
            'e gere de novo.');
    }

    /* 6. portal HTML */
    var html = render(m);
    fs.writeFileSync(saida, html, 'utf8');

    /* 4. artefatos SQL ao lado do portal (script de extracao, DDL inferido, etc.) */
    var escritos = [];
    try { escritos = esquema.gravar(dirEsquema, m, esquemas); }
    catch (e) { m.avisos.push('Nao foi possivel gravar a pasta esquema-sql: ' + e.message); }

    return {
        saida: saida,
        identidade: I,
        esquemaDir: dirEsquema,
        esquemaLidos: esquemas.map(function (e) { return e.nome; }),
        esquemaEscritos: escritos,
        ms: Date.now() - t0,
        resumo: {
            arquivos: arquivos.length,
            datasets: m.datasets.filter(function (d) { return !d.backup; }).length,
            formularios: m.formularios.length,
            scriptsWf: m.workflow.scripts.length,
            modulosJs: m.widget.js.length,
            eventosForm: m.formularios.reduce(function (n, f) { return n + (f.eventos || []).length + (f.auxiliares || []).length; }, 0),
            entidades: m.dataModel.entidades.length,
            proprias: m.dataModel.entidades.filter(function (e) { return e.origem === 'propria'; }).length,
            declaradas: m.dataModel.entidades.filter(function (e) { return e.fonte === 'declarado'; }).length,
            inferidas: m.dataModel.entidades.filter(function (e) { return e.fonte !== 'declarado'; }).length,
            relacoes: m.dataModel.relacoes.length,
            tabelasRastreadas: m.rastreabilidade.tabelas.length,
            nosGrafo: m.grafo.nos.length,
            arestasGrafo: m.grafo.arestas.length,
            biblioteca: m.biblioteca.arquivos.length,
            bibliotecaKb: Math.round(m.biblioteca.bytes / 1024),
            htmlKb: Math.round(Buffer.byteLength(html, 'utf8') / 1024),
            avisos: m.avisos.length
        },
        modelo: m
    };
}

/* -----------------------------------------------------------------------------
   Uma documentacao nunca substitui a de outra aplicacao.
   Todo portal gerado carrega <meta name="dg-app"> com o slug da aplicacao. Se o
   arquivo de destino ja existe e pertence a OUTRA aplicacao, a geracao para em
   vez de sobrescrever. Regerar a MESMA aplicacao (mesmo slug) e o caso normal e
   passa direto. Arquivo que nao foi gerado pelo docgen tambem e preservado.
----------------------------------------------------------------------------- */
/* No Windows "Z:/x" e "z:/x" sao a mesma pasta. Comparar sensivel a caixa fazia
   a ferramenta acusar troca de origem toda vez que o caminho era digitado com a
   letra do drive em minuscula. */
function normalizaCaminho(p) {
    return String(p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function checarConflito(saida, I, caminhoOrigem) {
    if (!fs.existsSync(saida)) return '';
    var cabeca = '';
    try {
        var fd = fs.openSync(saida, 'r');
        var buf = Buffer.alloc(8192);
        var n = fs.readSync(fd, buf, 0, 8192, 0);
        fs.closeSync(fd);
        cabeca = buf.slice(0, n).toString('utf8');
    } catch (e) { return ''; }

    if (cabeca.indexOf('name="dg-gerador" content="delp-docgen"') < 0) {
        return 'O arquivo de destino ja existe e nao foi gerado pelo delp-docgen:\n  ' + saida +
            '\nNao sera sobrescrito. Use --out com outro caminho, ou --forcar se tiver certeza.';
    }
    var m = cabeca.match(/name="dg-app"\s+content="([^"]*)"/);
    var mc = cabeca.match(/name="dg-app-code"\s+content="([^"]*)"/);
    var mo = cabeca.match(/name="dg-origem"\s+content="([^"]*)"/);
    var slugAntigo = m ? m[1] : '';

    if (!slugAntigo || slugAntigo === I.slug) {
        /* Mesma aplicacao: regerar e o fluxo normal, nao bloqueia. Mas se vier de
           OUTRA pasta (repositorio copiado, "- Copia", "Nova pasta"), quem le
           precisa saber que a versao anterior era de outro lugar. */
        var origemAntiga = mo ? mo[1] : '';
        var origemNova = String(caminhoOrigem || '').replace(/\\/g, '/');
        if (origemAntiga && origemNova && normalizaCaminho(origemAntiga) !== normalizaCaminho(origemNova)) {
            return { aviso: 'Este portal substituiu uma versao gerada a partir de outra pasta.\n' +
                '  antes : ' + origemAntiga + '\n  agora : ' + origemNova + '\n' +
                'As duas pastas declaram a mesma aplicacao (' + I.appCode + '). Confirme qual e a oficial.' };
        }
        return '';
    }

    return 'O arquivo de destino ja documenta OUTRA aplicacao:\n' +
        '  arquivo : ' + saida + '\n' +
        '  contem  : ' + (mc ? mc[1] : slugAntigo) + '  (' + slugAntigo + ')\n' +
        '  gerando : ' + I.appCode + '  (' + I.slug + ')\n' +
        'A documentacao de uma aplicacao nao substitui a de outra. Gere em outro caminho\n' +
        '(--out ' + path.join(path.dirname(saida), I.slug + '.doc.html') + ') ou use --forcar.';
}

module.exports = { gerar: gerar };
