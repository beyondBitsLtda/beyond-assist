/* =============================================================================
   publicar.js - Manda o portal gerado para um projeto de documentacao do Abacato
   -----------------------------------------------------------------------------
   O portal so serve se alguem o ler, e um HTML numa pasta do computador de quem
   gerou nao e lido por ninguem. Aqui ele vira um DOCUMENTO do repositorio de
   documentos: entra num projeto, herda a lista de quem acessa aquele projeto, e
   abre dentro do proprio Abacato.

   REGERAR CRIA UMA REVISAO, NAO UM DOCUMENTO NOVO.
   Documentacao de codigo e regerada toda semana. Se cada geracao criasse um
   documento, o projeto viraria uma pilha de "portalX.doc.html" iguais e ninguem
   saberia qual e o de hoje. Com revisao, o endereco e um so, a versao atual e a
   ultima, e o historico fica guardado — que e exatamente o que o Abacato ja faz
   com qualquer documento.

   A SENHA E ESTICADA AQUI, como o navegador faria. O servidor do Abacato nunca
   recebe senha em texto — nem do navegador, nem daqui. O porque inteiro esta em
   abacato/src/lib/abacatoAuth.js; o resumo e que esticar no servidor estourava
   a CPU do Worker e dava a qualquer pessoa de fora um jeito de derrubar o
   sistema mandando logins errados.
============================================================================= */
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var crypto = require('crypto');

/* Os mesmos numeros do Abacato. Se um dia mudarem la, o login daqui para de
   funcionar — e o scripts/publicar-check.mjs existe justamente para essa
   divergencia aparecer como uma falha de teste, e nao como um 401 sem
   explicacao no meio de uma publicacao. */
var ITERACOES = 210000;
var MAXIMO_POR_RODADA = 100000;
var TAMANHO_CHAVE = 32;

function base64url(buf) {
    return Buffer.from(buf).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* O sal e derivado do proprio e-mail, e nao sorteado. O motivo esta no Abacato:
   uma rota que entregasse o sal de cada e-mail seria uma lista de quem tem conta
   la — e o navegador precisa do sal ANTES de falar com o servidor. */
function salDoCliente(email) {
    var texto = 'abacato:' + String(email || '').trim().toLowerCase();
    return crypto.createHash('sha256').update(texto, 'utf8').digest();
}

/* PBKDF2 em rodadas encadeadas: a saida de uma vira a entrada da seguinte.
   Nao e capricho — o runtime da Cloudflare recusa contagens acima de 100.000
   iteracoes numa chamada so ("iteration counts above 100000 are not
   supported"), e o Abacato quer 210.000. Tres rodadas de 70.000 dao o mesmo
   custo para quem ataca. */
function chaveDeLogin(email, senha) {
    if (!email || !senha) return null;
    var sal = salDoCliente(email);
    var rodadas = Math.max(1, Math.ceil(ITERACOES / MAXIMO_POR_RODADA));
    var porRodada = Math.ceil(ITERACOES / rodadas);

    var material = Buffer.from(String(senha), 'utf8');
    var bits = null;
    for (var i = 0; i < rodadas; i++) {
        bits = crypto.pbkdf2Sync(material, sal, porRodada, TAMANHO_CHAVE, 'sha512');
        material = bits;
    }
    return base64url(bits);
}

/* ------------------------------------------------------------------ config */

var CONFIG_PADRAO = path.join(os.homedir(), '.docgen-abacato.json');

/* O arquivo de configuracao guarda uma SENHA. Ele nasce e vive em modo 600, e
   esta funcao recusa ler um arquivo que o resto da maquina consegue abrir.
   Recusar e chato; descobrir depois que a senha estava legivel para todo mundo
   e pior. No Windows o modo POSIX nao significa nada, entao la a checagem vira
   um aviso — dizer "esta seguro" sem ter olhado seria mentira. */
function lerConfig(caminho) {
    var arq = caminho || process.env.DOCGEN_ABACATO || CONFIG_PADRAO;
    if (!fs.existsSync(arq)) {
        throw new Error(
            'Nao achei a configuracao de publicacao em ' + arq + '.\n' +
            'Crie o arquivo com:\n' +
            '  {\n' +
            '    "url": "https://abacato.exemplo.com.br",\n' +
            '    "email": "voce@exemplo.com.br",\n' +
            '    "senha": "...",\n' +
            '    "projeto": "Nome do projeto de documentacao",\n' +
            '    "pasta": "Documentacao tecnica",   (opcional)\n' +
            '    "categoria": "Tecnico"             (opcional)\n' +
            '  }\n' +
            'e deixe-o so para voce:  chmod 600 ' + arq
        );
    }

    var aviso = '';
    try {
        var st = fs.statSync(arq);
        if (process.platform !== 'win32') {
            var modo = st.mode & 0o777;
            if (modo & 0o077) {
                throw new Error(
                    'O arquivo ' + arq + ' esta legivel por outras contas da maquina (modo ' +
                    modo.toString(8) + ') e guarda uma senha.\n' +
                    'Corrija com:  chmod 600 ' + arq
                );
            }
        } else {
            aviso = 'No Windows nao da para conferir a permissao do arquivo de configuracao. ' +
                'Garanta que ' + arq + ' esteja numa pasta so sua.';
        }
    } catch (e) {
        if (/legivel por outras contas/.test(e.message)) throw e;
    }

    var cfg;
    try { cfg = JSON.parse(fs.readFileSync(arq, 'utf8')); }
    catch (e) { throw new Error('A configuracao ' + arq + ' nao e um JSON valido: ' + e.message); }

    ['url', 'email', 'senha', 'projeto'].forEach(function (campo) {
        if (!cfg[campo]) throw new Error('Falta "' + campo + '" em ' + arq + '.');
    });
    cfg.url = String(cfg.url).replace(/\/$/, '');
    cfg._arquivo = arq;
    cfg._aviso = aviso;
    return cfg;
}

/* ------------------------------------------------------------------- HTTP */

function criarSessao() { return { cookie: '' }; }

async function chamar(s, metodo, base, caminho, corpo, ehForm) {
    var cabecalhos = {};
    if (s.cookie) cabecalhos.cookie = s.cookie;
    if (corpo && !ehForm) cabecalhos['content-type'] = 'application/json';

    var r = await fetch(base + caminho, {
        method: metodo,
        headers: cabecalhos,
        body: corpo === undefined ? undefined : (ehForm ? corpo : JSON.stringify(corpo)),
        redirect: 'manual'
    });

    var bruto = await r.text();
    var dados = null;
    try { dados = JSON.parse(bruto); } catch (e) { /* HTML de erro */ }

    var set = r.headers.get('set-cookie');
    if (set) {
        var par = set.split(';')[0];
        if (par.indexOf('abacato_sessao=') === 0) s.cookie = par;
    }
    return { status: r.status, dados: dados, bruto: bruto };
}

/* Erro com a mensagem do servidor, e nao "status 403". Quem publica precisa
   saber que faltou permissao, nao que houve um numero. */
function erroDe(r, oque) {
    var msg = (r.dados && r.dados.error) ? r.dados.error : ('HTTP ' + r.status);
    return new Error(oque + ': ' + msg);
}

/* --------------------------------------------------------------- publicar */

var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function publicar(caminhoHtml, opts) {
    opts = opts || {};
    var cfg = lerConfig(opts.config);

    /* O destino pode vir de fora da configuracao. A tela pergunta a cada geracao
       para qual projeto e para qual pasta vai — o arquivo de configuracao passa a
       ser so o padrao de quem usa pelo terminal, e nao uma amarra. */
    if (opts.projeto) cfg.projeto = opts.projeto;
    if (opts.pasta !== undefined) cfg.pasta = opts.pasta || '';
    if (opts.categoria !== undefined) cfg.categoria = opts.categoria || '';

    var passos = [];
    var diga = function (t) { passos.push(t); if (opts.aoPassar) opts.aoPassar(t); };

    if (cfg._aviso) diga('aviso: ' + cfg._aviso);

    if (!fs.existsSync(caminhoHtml)) throw new Error('O portal nao existe: ' + caminhoHtml);
    var conteudo = fs.readFileSync(caminhoHtml);
    var nomeArquivo = opts.nome || path.basename(caminhoHtml);

    /* ---------------------------------------------------------------- 1. entrar */
    var s = criarSessao();
    var entrada = await chamar(s, 'POST', cfg.url, '/api/auth/entrar', {
        email: cfg.email,
        chave: chaveDeLogin(cfg.email, cfg.senha)
    });
    if (entrada.status !== 200 || !s.cookie) throw erroDe(entrada, 'Nao consegui entrar no Abacato');
    diga('entrei como ' + (entrada.dados && entrada.dados.usuario ? entrada.dados.usuario.nome : cfg.email));

    /* ------------------------------------------------------------- 2. o projeto */
    var projetoId = null;
    if (UUID.test(cfg.projeto)) {
        projetoId = cfg.projeto;
    } else {
        var lista = await chamar(s, 'GET', cfg.url, '/api/projetos');
        if (lista.status !== 200) throw erroDe(lista, 'Nao consegui listar os projetos');
        var projetos = (lista.dados && lista.dados.projetos) || [];
        var alvo = projetos.filter(function (p) {
            return String(p.nome).trim().toLowerCase() === String(cfg.projeto).trim().toLowerCase();
        })[0];
        if (!alvo) {
            /* Listar o que existe e melhor que "projeto nao encontrado": o erro
               mais comum aqui e um acento ou uma palavra a mais no nome. */
            throw new Error(
                'Nao achei um projeto de documentacao chamado "' + cfg.projeto + '".\n' +
                'Projetos a que voce tem acesso: ' +
                (projetos.length ? projetos.map(function (p) { return '"' + p.nome + '"'; }).join(', ')
                                 : '(nenhum — peca acesso a um projeto)')
            );
        }
        projetoId = alvo.id;
        diga('projeto "' + alvo.nome + '"');
    }

    /* --------------------------------------------------------- 3. o que ja existe */
    var dentro = await chamar(s, 'GET', cfg.url, '/api/projetos/' + projetoId);
    if (dentro.status !== 200) throw erroDe(dentro, 'Nao consegui abrir o projeto');
    var pastas = (dentro.dados && dentro.dados.pastas) || [];
    var documentos = (dentro.dados && dentro.dados.documentos) || [];

    /* ---------------------------------------------------------------- 4. a pasta */
    var pastaId = null;
    if (cfg.pasta) {
        var achada = pastas.filter(function (p) {
            return String(p.nome).trim().toLowerCase() === String(cfg.pasta).trim().toLowerCase();
        })[0];
        if (achada) {
            pastaId = achada.id;
            diga('pasta "' + achada.nome + '"');
        } else {
            var nova = await chamar(s, 'POST', cfg.url, '/api/projetos/' + projetoId + '/pastas', { nome: cfg.pasta });
            if (nova.status !== 201) throw erroDe(nova, 'Nao consegui criar a pasta "' + cfg.pasta + '"');
            pastaId = nova.dados.pasta.id;
            diga('pasta "' + cfg.pasta + '" criada');
        }
    }

    /* -------------------------------------------- 5. revisao nova, ou documento novo */
    var jaExiste = documentos.filter(function (d) {
        var mesmoNome = String(d.nome).trim().toLowerCase() === nomeArquivo.trim().toLowerCase();
        var mesmaPasta = (d.pasta_id || null) === (pastaId || null);
        return mesmoNome && mesmaPasta;
    })[0];

    var form = new FormData();
    var arquivo = new File([conteudo], nomeArquivo, { type: 'text/html' });

    if (jaExiste) {
        form.append('arquivo', arquivo);
        form.append('nota', opts.nota || ('regerado em ' + new Date().toLocaleString('pt-BR')));
        var rev = await chamar(s, 'POST', cfg.url, '/api/documentos/' + jaExiste.id + '/revisoes', form, true);
        if (rev.status !== 201) throw erroDe(rev, 'Nao consegui gravar a revisao');
        return {
            acao: 'revisao',
            documentoId: jaExiste.id,
            projetoId: projetoId,
            numero: rev.dados.revisao && rev.dados.revisao.numero,
            url: cfg.url + '/documentos/' + projetoId + '?doc=' + jaExiste.id,
            passos: passos,
            bytes: conteudo.length
        };
    }

    form.append('arquivo', arquivo);
    form.append('nome', nomeArquivo);
    if (pastaId) form.append('pastaId', pastaId);
    if (cfg.categoria) form.append('categoria', cfg.categoria);
    form.append('descricao', opts.descricao || 'Documentacao tecnica gerada por leitura do codigo.');

    var novo = await chamar(s, 'POST', cfg.url, '/api/projetos/' + projetoId + '/documentos', form, true);
    if (novo.status !== 201) throw erroDe(novo, 'Nao consegui enviar o documento');
    var doc = novo.dados.documentos[0];
    return {
        acao: 'novo',
        documentoId: doc.id,
        projetoId: projetoId,
        numero: 1,
        url: cfg.url + '/documentos/' + projetoId + '?doc=' + doc.id,
        passos: passos,
        bytes: conteudo.length
    };
}

module.exports = {
    publicar: publicar,
    chaveDeLogin: chaveDeLogin,
    salDoCliente: salDoCliente,
    lerConfig: lerConfig,
    CONFIG_PADRAO: CONFIG_PADRAO
};
