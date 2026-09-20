#!/usr/bin/env node
/* =============================================================================
   delp-docgen - CLI
   Uso:
     node bin/delp-docgen.js <caminho-da-pasta-raiz> [--out arquivo.html] [--json]
   Exemplos:
     node bin/delp-docgen.js "z:\...\portalCapex"
     node bin/delp-docgen.js ./portalCapex --out ./docs/portalCapex.html
============================================================================= */
'use strict';

var path = require('path');
var fs = require('fs');
var gerar = require('../src/index').gerar;

var C = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', dim: '\x1b[2m', bold: '\x1b[1m', cyan: '\x1b[36m', yellow: '\x1b[33m' };

function arg(nome) {
    var i = process.argv.indexOf(nome);
    return i >= 0 ? process.argv[i + 1] : null;
}
function tem(nome) { return process.argv.indexOf(nome) >= 0; }

function ajuda() {
    console.log('\n' + C.bold + 'delp-docgen' + C.reset + ' — gerador de documentacao tecnica de aplicacoes Fluig DELP\n');
    console.log('Uso:');
    console.log('  node bin/delp-docgen.js <pasta-raiz> [opcoes]\n');
    console.log('Opcoes:');
    console.log('  --out <arquivo>   Caminho do HTML de saida (padrao: <codigo-da-aplicacao>.doc.html)');
    console.log('  --json            Grava tambem um <saida>.json com o modelo extraido');
    console.log('  --sem-codigo      Nao embute o codigo-fonte (portal leve, sem a biblioteca)');
    console.log('  --forcar          Sobrescreve um HTML que documenta OUTRA aplicacao (padrao: recusa)');
    console.log('  --help            Mostra esta ajuda\n');
    console.log('Exemplo:');
    console.log('  node bin/delp-docgen.js "./portalCapex" --out "./docs/portalCapex.html"\n');
}

async function main() {
    if (tem('--help') || tem('-h')) { ajuda(); process.exit(0); }

    var root = process.argv[2];
    if (!root || root.charAt(0) === '-') {
        console.error(C.red + 'Erro:' + C.reset + ' informe a pasta raiz da aplicacao.');
        ajuda();
        process.exit(1);
    }
    root = path.resolve(root);

    var out = arg('--out');
    if (out) out = path.resolve(out);

    console.log('\n' + C.cyan + '›' + C.reset + ' Lendo ' + C.bold + root + C.reset);

    var r;
    try {
        /* garante a pasta de saida */
        if (out) { try { fs.mkdirSync(path.dirname(out), { recursive: true }); } catch (e) {} }
        r = await gerar(root, { out: out, semCodigo: tem('--sem-codigo'), forcar: tem('--forcar') });
    } catch (e) {
        console.error(C.red + 'Falha:' + C.reset + ' ' + (e && e.message ? e.message : e));
        process.exit(2);
    }

    var s = r.resumo;
    var I = r.identidade;
    console.log(C.green + '✓' + C.reset + ' Portal gerado em ' + C.dim + r.ms + 'ms' + C.reset);
    console.log('  Aplicacao          : ' + C.bold + I.appCode + C.reset + C.dim + '  (nome de: ' + I.origemNome + ')' + C.reset);
    console.log('  Tipo detectado     : ' + C.cyan + I.tipoRotulo + C.reset);
    console.log('  ' + C.dim + '────────────────────────────────' + C.reset);
    console.log('  Arquivos varridos  : ' + C.bold + s.arquivos + C.reset);
    console.log('  Datasets           : ' + s.datasets);
    console.log('  Formularios        : ' + s.formularios);
    console.log('  Scripts workflow   : ' + s.scriptsWf);
    console.log('  Modulos JS (widget): ' + s.modulosJs);
    console.log('  Eventos de form.   : ' + s.eventosForm);
    console.log('  Entidades          : ' + s.entidades + ' (' + s.proprias + ' proprias)');
    console.log('  Esquema de dados   : ' + C.green + s.declaradas + ' declaradas' + C.reset +
        (s.inferidas ? ' / ' + C.yellow + s.inferidas + ' inferidas' + C.reset : ''));
    console.log('  Relacoes           : ' + s.relacoes);
    console.log('  Tabelas rastreadas : ' + s.tabelasRastreadas);
    console.log('  Mapa de chamadas   : ' + s.arestasGrafo + ' ligacoes entre ' + s.nosGrafo + ' nos');
    console.log('  Biblioteca         : ' + s.biblioteca + ' arquivos (' + s.bibliotecaKb + ' KB de codigo)');
    console.log('  Portal HTML        : ' + s.htmlKb + ' KB');
    if (s.avisos) console.log('  ' + C.yellow + 'Avisos             : ' + s.avisos + C.reset);
    console.log('  ' + C.dim + '────────────────────────────────' + C.reset);
    console.log(C.green + '→' + C.reset + ' ' + C.bold + r.saida + C.reset);

    /* pasta esquema-sql: a ponte entre o codigo e o banco */
    console.log(C.green + '→' + C.reset + ' ' + r.esquemaDir + C.dim + '  (' + r.esquemaEscritos.length + ' arquivos)' + C.reset);

    /* Um arquivo por linha, com o que saiu dele. "Lido" e "aproveitado" sao
       coisas diferentes, e era a diferenca entre as duas que ficava invisivel. */
    var lidos = (r.modelo.esquemaBanco && r.modelo.esquemaBanco.arquivos) || [];
    if (lidos.length) {
        lidos.forEach(function (a) {
            var ok = (a.tabelas || a.fks) && !a.aviso;
            console.log('  ' + (ok ? C.green + '✓' : C.yellow + '!') + C.reset + ' ' + a.nome +
                C.dim + '  ' + a.tabelas + ' tabela(s), ' + a.fks + ' FK(s)' +
                (a.bancos ? ' em ' + a.bancos : '') + C.reset +
                (ok ? '' : '  ' + C.yellow + (a.aviso || 'nada reconhecido') + C.reset));
        });
    } else if (s.inferidas) {
        console.log('  ' + C.yellow + s.inferidas + ' tabela(s) ainda inferidas.' + C.reset +
            ' Nenhum arquivo de esquema nessa pasta.');
        console.log('  Rode o ' + C.bold + '01-extrair-esquema.sql' + C.reset +
            ' (uma vez so, em qualquer base) e salve o resultado la.');
    }

    /* Avisos que falam da ponte com o banco vem para o terminal: eles respondem
       a pergunta "salvei a saida e continua inferido, por que?". */
    var doEsquema = (r.modelo.avisos || []).filter(function (a) {
        return /esquema-sql|01-extrair-esquema|inferid/i.test(a);
    });
    if (doEsquema.length) {
        console.log('');
        doEsquema.forEach(function (a) {
            console.log('  ' + C.yellow + '! ' + C.reset + a.replace(/\s+/g, ' '));
        });
    }
    console.log('');

    if (tem('--json')) {
        var jsonPath = r.saida.replace(/\.html?$/i, '') + '.json';
        try {
            /* fora do JSON: funcoes, SVG bruto e o codigo-fonte embutido (pesado) */
            var clean = JSON.parse(JSON.stringify(r.modelo, function (k, v) {
                if (k === 'lerConteudo' || k === 'svg') return undefined;
                if (k === 'fontes') {
                    return v.map(function (f) {
                        var c = {};
                        Object.keys(f).forEach(function (x) { if (x !== 'conteudo') c[x] = f[x]; });
                        return c;
                    });
                }
                return v;
            }));
            fs.writeFileSync(jsonPath, JSON.stringify(clean, null, 2), 'utf8');
            console.log(C.green + '→' + C.reset + ' modelo JSON: ' + jsonPath + '\n');
        } catch (e) { console.error('Nao foi possivel gravar o JSON: ' + e.message); }
    }
}

main().catch(function (e) {
    console.error(C.red + 'Falha:' + C.reset + ' ' + (e && e.stack ? e.stack : e));
    process.exit(2);
});
