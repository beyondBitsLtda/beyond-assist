#!/usr/bin/env node
/* =============================================================================
   docgen - CLI
   Le um repositorio e escreve um portal HTML de documentacao tecnica.

   Uso:
     node bin/docgen.js <pasta-do-repositorio> [opcoes]

   Exemplos:
     node bin/docgen.js ./meu-projeto
     node bin/docgen.js ./meu-projeto --out ./docs/meu-projeto.doc.html
     node bin/docgen.js ./meu-projeto --publicar
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
    console.log('\n' + C.bold + 'docgen' + C.reset + ' — documentacao tecnica lida do codigo de um repositorio\n');
    console.log('Uso:');
    console.log('  node bin/docgen.js <pasta-do-repositorio> [opcoes]\n');
    console.log('Opcoes:');
    console.log('  --out <arquivo>    Caminho do HTML de saida (padrao: <nome-do-projeto>.doc.html)');
    console.log('  --json             Grava tambem um <saida>.json com o modelo extraido');
    console.log('  --sem-codigo       Nao embute o codigo-fonte (portal leve, sem a biblioteca)');
    console.log('  --forcar           Sobrescreve um HTML que documenta OUTRO projeto (padrao: recusa)');
    console.log('  --publicar         Envia o portal para um projeto de documentacao do Abacato');
    console.log('  --config <arquivo> Configuracao da publicacao (padrao: ~/.docgen-abacato.json)');
    console.log('  --tela             Abre a tela do docgen no navegador, nesta maquina');
    console.log('  --porta <numero>   Porta da tela (padrao: 4321)');
    console.log('  --help             Mostra esta ajuda\n');
    console.log('Tela:');
    console.log('  node bin/docgen.js --tela');
    console.log('  No Windows, docgen.cmd faz isso com dois cliques.\n');
    console.log('Publicar:');
    console.log('  Regerar o mesmo projeto cria uma REVISAO do documento que ja existe, e nao');
    console.log('  um documento novo — o endereco continua o mesmo e o historico fica guardado.\n');
}

/* Abre o navegador na pagina da tela. Cada sistema tem o seu comando, e nenhum
   deles e critico: se falhar, o endereco ja esta impresso no terminal. */
function abrirNavegador(url) {
    var cmd = process.platform === 'win32' ? 'start ""'
        : (process.platform === 'darwin' ? 'open' : 'xdg-open');
    try {
        require('child_process').exec(cmd + ' "' + url + '"');
    } catch (e) { /* o endereco esta no terminal */ }
}

async function main() {
    if (tem('--help') || tem('-h')) { ajuda(); process.exit(0); }

    /* ------------------------------------------------------------ a tela */
    if (tem('--tela') || tem('--servidor')) {
        var porta = Number(arg('--porta')) || 4321;
        var s;
        try {
            s = await require('../src/servidor').subir({ porta: porta });
        } catch (e) {
            if (e && e.code === 'EADDRINUSE') {
                console.error('\n' + C.red + 'A porta ' + porta + ' ja esta em uso.' + C.reset +
                    ' Talvez o docgen ja esteja aberto — procure a aba no navegador.');
                console.error('Para usar outra porta:  node bin/docgen.js --tela --porta 4322\n');
                process.exit(1);
            }
            throw e;
        }
        console.log('\n' + C.green + '✓' + C.reset + ' docgen aberto em ' + C.bold + s.url + C.reset);
        console.log(C.dim + '  So esta maquina alcanca esta tela. Feche com Ctrl+C.' + C.reset + '\n');
        abrirNavegador(s.url);
        return;                                  /* fica no ar ate o Ctrl+C */
    }

    var root = process.argv[2];
    if (!root || root.charAt(0) === '-') {
        console.error(C.red + 'Erro:' + C.reset + ' informe a pasta do repositorio.');
        ajuda();
        process.exit(1);
    }
    root = path.resolve(root);

    var out = arg('--out');
    if (out) out = path.resolve(out);

    console.log('\n' + C.cyan + '›' + C.reset + ' Lendo ' + C.bold + root + C.reset);

    var r;
    try {
        if (out) { try { fs.mkdirSync(path.dirname(out), { recursive: true }); } catch (e) {} }
        r = await gerar(root, { out: out, semCodigo: tem('--sem-codigo'), forcar: tem('--forcar') });
    } catch (e) {
        console.error(C.red + 'Falha:' + C.reset + ' ' + (e && e.message ? e.message : e));
        process.exit(2);
    }

    var s = r.resumo;
    var I = r.identidade;
    console.log(C.green + '✓' + C.reset + ' Portal gerado em ' + C.dim + r.ms + 'ms' + C.reset);
    console.log('  Projeto            : ' + C.bold + I.appCode + C.reset + C.dim + '  (nome de: ' + I.origemNome + ')' + C.reset);
    console.log('  Tipo detectado     : ' + C.cyan + I.tipoRotulo + C.reset +
        (I.ecossistema ? C.dim + '  ·  ' + I.ecossistema + C.reset : ''));
    console.log('  ' + C.dim + '────────────────────────────────' + C.reset);
    console.log('  Arquivos varridos  : ' + C.bold + s.arquivos + C.reset);
    /* Linhas que so fazem sentido quando ha o que contar: um repositorio sem
       formularios nao precisa de "Formularios: 0" na saida. */
    if (s.datasets) console.log('  Consultas de dados : ' + s.datasets);
    if (s.formularios) console.log('  Formularios        : ' + s.formularios);
    if (s.scriptsWf) console.log('  Scripts de processo: ' + s.scriptsWf);
    if (s.modulosJs) console.log('  Modulos JS         : ' + s.modulosJs);
    if (s.eventosForm) console.log('  Eventos de form.   : ' + s.eventosForm);
    if (s.entidades) {
        console.log('  Entidades          : ' + s.entidades + ' (' + s.proprias + ' proprias)');
        console.log('  Esquema de dados   : ' + C.green + s.declaradas + ' declaradas' + C.reset +
            (s.inferidas ? ' / ' + C.yellow + s.inferidas + ' inferidas' + C.reset : ''));
        console.log('  Relacoes           : ' + s.relacoes);
    }
    console.log('  Mapa de chamadas   : ' + s.arestasGrafo + ' ligacoes entre ' + s.nosGrafo + ' nos');
    console.log('  Biblioteca         : ' + s.biblioteca + ' arquivos (' + s.bibliotecaKb + ' KB de codigo)');
    console.log('  Portal HTML        : ' + s.htmlKb + ' KB');
    if (s.avisos) console.log('  ' + C.yellow + 'Avisos             : ' + s.avisos + C.reset);
    console.log('  ' + C.dim + '────────────────────────────────' + C.reset);
    console.log(C.green + '→' + C.reset + ' ' + C.bold + r.saida + C.reset);

    if (r.esquemaEscritos.length) {
        console.log(C.green + '→' + C.reset + ' ' + r.esquemaDir + C.dim + '  (' + r.esquemaEscritos.length + ' arquivos)' + C.reset);
    }

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
        console.log('  Rode o ' + C.bold + '01-extrair-esquema.sql' + C.reset + ' e salve o resultado la.');
    }

    var doEsquema = (r.modelo.avisos || []).filter(function (a) {
        return /esquema-sql|01-extrair-esquema|inferid/i.test(a);
    });
    if (doEsquema.length) {
        console.log('');
        doEsquema.forEach(function (a) { console.log('  ' + C.yellow + '! ' + C.reset + a.replace(/\s+/g, ' ')); });
    }
    console.log('');

    /* ------------------------------------------------------------- --json */
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

    /* --------------------------------------------------------- --publicar */
    if (tem('--publicar')) {
        var publicar = require('../src/publicar').publicar;
        console.log(C.cyan + '›' + C.reset + ' Publicando no Abacato…');
        try {
            var p = await publicar(r.saida, {
                config: arg('--config'),
                nome: I.appCode + '.doc.html',
                descricao: 'Documentacao tecnica de ' + I.appCode + ', gerada por leitura do codigo.',
                aoPassar: function (t) { console.log('  ' + C.dim + t + C.reset); }
            });
            console.log(C.green + '✓' + C.reset + ' ' +
                (p.acao === 'novo' ? 'Documento criado' : 'Revisao ' + p.numero + ' gravada') +
                C.dim + '  (' + Math.round(p.bytes / 1024) + ' KB)' + C.reset);
            console.log(C.green + '→' + C.reset + ' ' + C.bold + p.url + C.reset + '\n');
        } catch (e) {
            console.error(C.red + 'Nao publiquei:' + C.reset + ' ' + (e && e.message ? e.message : e) + '\n');
            /* O portal FOI gerado; so a publicacao falhou. Sair com 0 mentiria,
               sair com 2 diria que nada saiu. O 3 separa os dois casos. */
            process.exit(3);
        }
    }
}

main().catch(function (e) {
    console.error(C.red + 'Falha:' + C.reset + ' ' + (e && e.stack ? e.stack : e));
    process.exit(2);
});
