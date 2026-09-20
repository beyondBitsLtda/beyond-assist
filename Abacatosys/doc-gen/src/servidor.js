/* =============================================================================
   servidor.js - A tela do docgen, aberta no navegador, rodando na sua maquina
   -----------------------------------------------------------------------------
   POR QUE ISTO E LOCAL, E NAO UM BOTAO DENTRO DO ABACATO

   O Abacato roda na nuvem. O docgen precisa LER A PASTA DO REPOSITORIO, que
   esta no computador de quem gera. Nenhuma pagina na internet alcanca o disco
   de quem a abre — e ainda bem, porque um site que conseguisse ler suas pastas
   seria um problema muito maior que a comodidade de um botao.

   Entao a tela roda aqui: um servidor minusculo em 127.0.0.1 que serve uma
   pagina, navega pelas suas pastas, gera e publica. O Abacato continua sendo o
   lugar onde a documentacao FICA; esta tela e so o lugar de onde ela SAI.

   TRES TRAVAS, porque um servidor local que le pastas e roda geracao e uma
   porta aberta na sua maquina:

     1. So escuta em 127.0.0.1. Nao aparece na rede, nem no Wi-Fi do escritorio.
     2. Exige um TOKEN sorteado a cada execucao, que vai na URL impressa no
        terminal. Sem ele, qualquer pagina aberta no seu navegador poderia
        mandar pedidos para localhost e usar o docgen pelas suas costas (CSRF).
     3. Confere o cabecalho Host. E o que impede "DNS rebinding": um dominio de
        fora que resolve para 127.0.0.1 e passa a falar com este servidor como
        se fosse da casa.

   Zero dependencias: `http` e `fs` do proprio Node.
============================================================================= */
'use strict';

var http = require('http');
var fs = require('fs');
var os = require('os');
var path = require('path');
var crypto = require('crypto');

var gerar = require('./index').gerar;

var RECENTES = path.join(os.homedir(), '.docgen-recentes.json');

/* ------------------------------------------------------------- recentes */

function lerRecentes() {
    try { return JSON.parse(fs.readFileSync(RECENTES, 'utf8')).slice(0, 8); }
    catch (e) { return []; }
}
function guardarRecente(caminho) {
    var lista = lerRecentes().filter(function (c) { return c !== caminho; });
    lista.unshift(caminho);
    try { fs.writeFileSync(RECENTES, JSON.stringify(lista.slice(0, 8), null, 2)); } catch (e) {}
}

/* ------------------------------------------------------------- navegar */

/* As subpastas de um caminho, para a tela poder navegar sem caixa de dialogo.
   Pastas de build e dependencia ficam de fora: ninguem quer clicar em
   node_modules procurando o proprio projeto. */
var ESCONDER = ['node_modules', '.git', '.next', 'dist', 'build', '.venv',
    '__pycache__', 'vendor', '.cache', 'target', 'coverage'];

function listarPastas(caminho) {
    var alvo = caminho ? path.resolve(caminho) : os.homedir();
    var entradas = [];
    try {
        entradas = fs.readdirSync(alvo, { withFileTypes: true })
            .filter(function (e) {
                if (!e.isDirectory()) return false;
                if (ESCONDER.indexOf(e.name) >= 0) return false;
                return e.name.charAt(0) !== '.' || e.name === '.claude';
            })
            .map(function (e) { return e.name; })
            .sort(function (a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1; })
            .slice(0, 300);
    } catch (e) {
        return { erro: 'Nao consegui abrir essa pasta: ' + e.message, caminho: alvo, pastas: [] };
    }

    /* Marca o que PARECE um repositorio, para o alvo certo saltar aos olhos em
       vez de se perder numa lista de cinquenta nomes iguais. */
    var comMarca = entradas.map(function (nome) {
        var dentro = path.join(alvo, nome);
        var ehRepo = false;
        try {
            ehRepo = fs.existsSync(path.join(dentro, '.git')) ||
                fs.existsSync(path.join(dentro, 'package.json')) ||
                fs.existsSync(path.join(dentro, 'pyproject.toml')) ||
                fs.existsSync(path.join(dentro, 'go.mod'));
        } catch (e) {}
        return { nome: nome, repo: ehRepo };
    });

    var pai = path.dirname(alvo);
    return {
        caminho: alvo,
        pai: pai === alvo ? null : pai,
        pastas: comMarca,
        ehRepo: comMarca.length >= 0 && (
            fs.existsSync(path.join(alvo, '.git')) || fs.existsSync(path.join(alvo, 'package.json'))
        )
    };
}

/* --------------------------------------------------------------- a pagina */

function pagina(token) {
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>docgen</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" media="print" onload="this.media='all'">
<style>
:root{
  --verde:#22C55E; --verde-fundo:#10B981; --verde-claro:#D8EBDD;
  --fundo:#F4F6F5; --superficie:#FFFFFF; --superficie-2:#F4F6F5;
  --tinta:#1F2937; --tinta-2:#6B7280; --tinta-3:#9CA3AF;
  --linha:rgba(31,41,55,.08); --linha-forte:rgba(31,41,55,.16);
  --alerta:#EF4444; --alerta-fundo:#FEE2E2;
  --raio:16px; --pilula:9999px;
  --sombra:0 4px 20px rgba(0,0,0,.03);
  color-scheme:light;
}
@media (prefers-color-scheme:dark){:root{
  --fundo:#0D1310; --superficie:#151E19; --superficie-2:#1B2621;
  --tinta:#E8EDEA; --tinta-2:#9BA8A1; --tinta-3:#6B7A73;
  --verde-claro:#1E3A2A; --alerta-fundo:#3B1A1A;
  --linha:rgba(232,237,234,.10); --linha-forte:rgba(232,237,234,.20);
  --sombra:0 4px 20px rgba(0,0,0,.35); color-scheme:dark;
}}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;
  background:var(--fundo);color:var(--tinta);font-size:14px;line-height:1.55}
.wrap{max-width:860px;margin:0 auto;padding:28px 16px 80px}
h1{font-size:23px;font-weight:800;margin:0;display:flex;align-items:center;gap:10px}
h1 i{width:12px;height:12px;border-radius:50%;background:var(--verde);display:inline-block}
.sub{color:var(--tinta-2);margin:6px 0 24px}
.bloco{background:var(--superficie);border:1px solid var(--linha);border-radius:var(--raio);
  padding:18px 20px;box-shadow:var(--sombra);margin-bottom:16px}
.bloco h2{font-size:13px;font-weight:700;margin:0 0 12px;text-transform:uppercase;
  letter-spacing:.7px;color:var(--tinta-2)}
.caminho{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;background:var(--superficie-2);
  border:1px solid var(--linha);border-radius:10px;padding:9px 12px;margin-bottom:10px;
  overflow-x:auto;white-space:nowrap;color:var(--tinta-2)}
.lista{max-height:300px;overflow-y:auto;border:1px solid var(--linha);border-radius:12px}
.item{display:flex;align-items:center;gap:9px;width:100%;border:0;background:transparent;
  padding:9px 13px;cursor:pointer;font:inherit;font-size:13px;color:var(--tinta);text-align:left;
  border-bottom:1px solid var(--linha)}
.item:last-child{border-bottom:0}
.item:hover{background:var(--superficie-2)}
.item .ico{width:18px;flex-shrink:0;color:var(--tinta-3)}
.item .selo{margin-left:auto;font-size:10px;font-weight:700;background:var(--verde-claro);
  color:var(--verde-fundo);border-radius:var(--pilula);padding:2px 9px}
.botao{border:1px solid var(--verde);background:var(--verde);color:#fff;border-radius:12px;
  padding:11px 20px;font:inherit;font-weight:600;cursor:pointer}
.botao:hover{background:var(--verde-fundo);border-color:var(--verde-fundo)}
.botao:disabled{opacity:.55;cursor:default}
.botao--fantasma{background:transparent;color:var(--tinta);border-color:var(--linha-forte)}
.botao--fantasma:hover{background:var(--superficie-2);border-color:var(--verde)}
.linha{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
label.op{display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer}
.dica{font-size:12px;color:var(--tinta-2);margin:8px 0 0}
.saida{font-family:ui-monospace,Consolas,monospace;font-size:12px;white-space:pre-wrap;
  background:#1E1E1E;color:#D4D4D4;border-radius:12px;padding:14px 16px;margin-top:14px;
  max-height:340px;overflow:auto}
.erro{background:var(--alerta-fundo);border:1px solid var(--alerta);border-radius:12px;
  padding:12px 15px;margin-top:12px;font-size:13px}
.ok{background:var(--verde-claro);border:1px solid var(--verde);border-radius:12px;
  padding:14px 16px;margin-top:12px}
.ok a{color:var(--verde-fundo);font-weight:600;word-break:break-all}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.chip{font-size:12px;background:var(--superficie-2);border:1px solid var(--linha);
  border-radius:var(--pilula);padding:4px 11px;cursor:pointer;font-family:ui-monospace,Consolas,monospace}
.chip:hover{border-color:var(--verde)}
.campos{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:620px){.campos{grid-template-columns:1fr}}
.campo{display:flex;flex-direction:column;gap:5px}
.campo>span{font-size:12px;color:var(--tinta-2);font-weight:600}
.campo select,.campo input{font:inherit;font-size:13px;padding:9px 11px;border-radius:11px;
  border:1px solid var(--linha-forte);background:var(--superficie);color:var(--tinta)}
.campo select:focus,.campo input:focus{outline:none;border-color:var(--verde);
  box-shadow:0 0 0 3px var(--verde-claro)}
#destinos[hidden]{display:none}
</style></head><body>
<div class="wrap">
  <h1><i></i>docgen</h1>
  <p class="sub">Escolha um repositório. Ele lê o código e escreve a documentação técnica.</p>

  <div class="bloco">
    <h2>1 · Qual repositório</h2>
    <div class="caminho" id="caminho">…</div>
    <div class="lista" id="lista"></div>
    <div class="chips" id="recentes"></div>
    <p class="dica" id="dicaRepo"></p>
  </div>

  <div class="bloco">
    <h2>2 · Para onde vai</h2>
    <label class="op" style="margin-bottom:12px">
      <input type="checkbox" id="publicar" checked> Publicar no Abacato quando terminar
    </label>
    <div id="destinos">
      <div class="campos">
        <label class="campo">
          <span>Projeto de documentação</span>
          <select id="projeto"><option>carregando…</option></select>
        </label>
        <label class="campo">
          <span>Pasta dentro dele</span>
          <input list="pastas" id="pasta" placeholder="(raiz do projeto)" autocomplete="off">
          <datalist id="pastas"></datalist>
        </label>
      </div>
      <p class="dica">Escreva um nome de pasta que ainda não existe e ela é criada. Deixe vazio
        para o documento ficar na raiz do projeto.</p>
    </div>
  </div>

  <div class="bloco">
    <h2>3 · Gerar</h2>
    <div class="linha" style="margin-bottom:12px">
      <label class="op"><input type="checkbox" id="semCodigo"> Portal leve (sem o código-fonte embutido)</label>
    </div>
    <div class="linha">
      <button class="botao" id="gerar" disabled>Gerar documentação</button>
      <span class="dica" id="alvo"></span>
    </div>
    <div id="resultado"></div>
  </div>
</div>

<script>
var TOKEN = ${JSON.stringify(token)};
var atual = null;

function pedir(rota, corpo) {
  return fetch(rota, {
    method: corpo ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', 'x-docgen-token': TOKEN },
    body: corpo ? JSON.stringify(corpo) : undefined
  }).then(function (r) { return r.json(); });
}

function navegar(caminho) {
  pedir('/api/pastas?caminho=' + encodeURIComponent(caminho || '')).then(function (d) {
    atual = d.caminho;
    document.getElementById('caminho').textContent = d.caminho;
    document.getElementById('gerar').disabled = false;
    document.getElementById('alvo').textContent = 'vai documentar: ' + d.caminho;
    document.getElementById('dicaRepo').textContent = d.ehRepo
      ? 'Esta pasta parece um repositório. Pode gerar.'
      : 'Esta pasta não parece um repositório — entre numa subpasta, ou gere assim mesmo.';

    var lista = document.getElementById('lista');
    lista.innerHTML = '';
    if (d.pai) lista.appendChild(linha('..', '↑', false, d.pai));
    (d.pastas || []).forEach(function (p) {
      lista.appendChild(linha(p.nome, '▸', p.repo, d.caminho + '/' + p.nome));
    });
    if (!d.pastas.length && !d.pai) lista.innerHTML = '<div class="item">(nenhuma subpasta)</div>';
  });
}

function linha(nome, ico, repo, destino) {
  var b = document.createElement('button');
  b.className = 'item';
  b.innerHTML = '<span class="ico">' + ico + '</span><span></span>' + (repo ? '<span class="selo">repositório</span>' : '');
  b.children[1].textContent = nome;
  b.onclick = function () { navegar(destino); };
  return b;
}

pedir('/api/recentes').then(function (d) {
  var box = document.getElementById('recentes');
  (d.recentes || []).forEach(function (c) {
    var b = document.createElement('button');
    b.className = 'chip';
    b.textContent = c.split(/[\\\\/]/).pop();
    b.title = c;
    b.onclick = function () { navegar(c); };
    box.appendChild(b);
  });
});

/* ------------------------------------------------ para onde publicar */
var DESTINOS = [];

function pintarPastas() {
  var proj = DESTINOS.filter(function (p) { return p.nome === document.getElementById('projeto').value; })[0];
  var dl = document.getElementById('pastas');
  dl.innerHTML = '';
  (proj ? proj.pastas : []).forEach(function (nome) {
    var o = document.createElement('option');
    o.value = nome;
    dl.appendChild(o);
  });
}

pedir('/api/destinos').then(function (d) {
  var sel = document.getElementById('projeto');
  if (!d.ok) {
    sel.innerHTML = '<option>—</option>';
    document.getElementById('destinos').innerHTML =
      '<div class="erro">Não consegui falar com o Abacato: ' + escapar(d.erro) + '</div>';
    return;
  }
  DESTINOS = d.projetos || [];
  sel.innerHTML = '';
  DESTINOS.forEach(function (p) {
    var o = document.createElement('option');
    o.value = p.nome;
    o.textContent = p.nome;
    if (p.nome === d.padrao.projeto) o.selected = true;
    sel.appendChild(o);
  });
  document.getElementById('pasta').value = d.padrao.pasta || '';
  pintarPastas();
  sel.onchange = pintarPastas;
});

/* Sem publicar, escolher destino nao quer dizer nada — e um par de campos que
   nao faz efeito confunde mais do que ajuda. */
document.getElementById('publicar').onchange = function () {
  document.getElementById('destinos').hidden = !this.checked;
};

document.getElementById('gerar').onclick = function () {
  var botao = this;
  var res = document.getElementById('resultado');
  botao.disabled = true;
  botao.textContent = 'Gerando…';
  res.innerHTML = '<div class="saida">lendo ' + atual + ' …</div>';

  pedir('/api/gerar', {
    caminho: atual,
    publicar: document.getElementById('publicar').checked,
    semCodigo: document.getElementById('semCodigo').checked,
    projeto: document.getElementById('projeto').value,
    pasta: document.getElementById('pasta').value.trim()
  }).then(function (d) {
    botao.disabled = false;
    botao.textContent = 'Gerar documentação';
    if (!d.ok) {
      res.innerHTML = '<div class="erro"><b>Não deu certo.</b><br>' + escapar(d.erro) + '</div>';
      return;
    }
    var h = '<div class="saida">' + escapar(d.log.join('\\n')) + '</div>';
    if (d.url) {
      h += '<div class="ok"><b>' + escapar(d.acao) + '</b><br>' +
           '<a href="' + escapar(d.url) + '" target="_blank" rel="noreferrer">' + escapar(d.url) + '</a></div>';
    } else {
      h += '<div class="ok"><b>Portal gerado</b><br>' + escapar(d.saida) + '</div>';
    }
    res.innerHTML = h;
  }).catch(function (e) {
    botao.disabled = false;
    botao.textContent = 'Gerar documentação';
    res.innerHTML = '<div class="erro">' + escapar(String(e)) + '</div>';
  });
};

function escapar(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

navegar('');
</script></body></html>`;
}

/* --------------------------------------------------------------- servidor */

function subir(opts) {
    opts = opts || {};
    var porta = opts.porta || 4321;
    var token = crypto.randomBytes(16).toString('hex');

    var servidor = http.createServer(async function (req, res) {
        var url = new URL(req.url, 'http://localhost');

        /* Trava 3: o Host precisa ser local. Um dominio de fora que resolve
           para 127.0.0.1 chega aqui com o proprio nome no Host — e e assim que
           "DNS rebinding" contorna a limitacao de escutar so em localhost. */
        var host = String(req.headers.host || '').split(':')[0];
        if (host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]') {
            res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
            return res.end('pedido de outro endereco recusado');
        }

        var responder = function (codigo, dados) {
            res.writeHead(codigo, { 'content-type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(dados));
        };

        /* A pagina vai pelo token na URL; as chamadas, pelo cabecalho. */
        if (url.pathname === '/') {
            if (url.searchParams.get('t') !== token) {
                res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
                return res.end('abra pelo endereco impresso no terminal (ele traz a chave desta sessao)');
            }
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            return res.end(pagina(token));
        }

        if (req.headers['x-docgen-token'] !== token) return responder(403, { ok: false, erro: 'chave invalida' });

        if (url.pathname === '/api/pastas') {
            return responder(200, listarPastas(url.searchParams.get('caminho')));
        }
        if (url.pathname === '/api/recentes') {
            return responder(200, { recentes: lerRecentes() });
        }

        /* Para onde da para publicar: os projetos de documentacao e as pastas de
           cada um. Sem isto a tela so sabia o destino fixo do arquivo de
           configuracao, e tudo caia sempre na mesma pasta. */
        if (url.pathname === '/api/destinos') {
            try {
                var pub = require('./publicar');
                var cfg = pub.lerConfig();
                var entrada = await fetch(cfg.url + '/api/auth/entrar', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ email: cfg.email, chave: pub.chaveDeLogin(cfg.email, cfg.senha) })
                });
                if (entrada.status !== 200) {
                    return responder(200, { ok: false, erro: 'nao consegui entrar no Abacato (' + entrada.status + ')' });
                }
                var cookie = entrada.headers.get('set-cookie').split(';')[0];

                var lista = await (await fetch(cfg.url + '/api/projetos', { headers: { cookie: cookie } })).json();
                var projetos = [];
                for (var i = 0; i < (lista.projetos || []).length; i++) {
                    var p = lista.projetos[i];
                    var dentro = await (await fetch(cfg.url + '/api/projetos/' + p.id, { headers: { cookie: cookie } })).json();
                    projetos.push({
                        id: p.id,
                        nome: p.nome,
                        /* So as pastas de primeiro nivel: uma arvore inteira num
                           seletor nao ajuda a escolher, atrapalha. */
                        pastas: (dentro.pastas || []).filter(function (f) { return !f.pai_id; })
                            .map(function (f) { return f.nome; })
                    });
                }
                return responder(200, { ok: true, projetos: projetos, padrao: { projeto: cfg.projeto, pasta: cfg.pasta || '' } });
            } catch (e) {
                return responder(200, { ok: false, erro: e && e.message ? e.message : String(e) });
            }
        }
        if (url.pathname === '/api/gerar' && req.method === 'POST') {
            var corpo = '';
            req.on('data', function (c) { corpo += c; });
            await new Promise(function (r) { req.on('end', r); });

            var pedido;
            try { pedido = JSON.parse(corpo); } catch (e) { return responder(400, { ok: false, erro: 'pedido invalido' }); }
            if (!pedido.caminho) return responder(400, { ok: false, erro: 'faltou a pasta' });

            var log = [];
            try {
                /* A saida vai para uma pasta PROPRIA, e nao para o diretorio de
                   onde o servidor subiu. Sem isto, gerar pela tela deixava um
                   .doc.html e uma pasta esquema-sql/ dentro do repositorio do
                   proprio docgen — e, pior, dentro de qualquer repositorio de
                   onde alguem tivesse aberto a tela. */
                var pastaSaida = path.join(os.homedir(), 'docgen-saida');
                try { fs.mkdirSync(pastaSaida, { recursive: true }); } catch (e) {}

                var r = await gerar(path.resolve(pedido.caminho), {
                    out: path.join(pastaSaida, path.basename(path.resolve(pedido.caminho)) + '.doc.html'),
                    semCodigo: Boolean(pedido.semCodigo),
                    forcar: true
                });
                guardarRecente(path.resolve(pedido.caminho));

                var s = r.resumo, I = r.identidade;
                log.push('projeto      : ' + I.appCode + '  (' + I.tipoRotulo + ')');
                log.push('arquivos     : ' + s.arquivos);
                log.push('mapa         : ' + s.arestasGrafo + ' ligacoes entre ' + s.nosGrafo + ' nos');
                if (s.entidades) log.push('dados        : ' + s.entidades + ' tabelas, ' + s.relacoes + ' relacoes');
                log.push('biblioteca   : ' + s.biblioteca + ' arquivos');
                log.push('portal       : ' + s.htmlKb + ' KB em ' + r.ms + 'ms');
                log.push('arquivo      : ' + r.saida);
                if (s.avisos) log.push('avisos       : ' + s.avisos);

                if (!pedido.publicar) return responder(200, { ok: true, log: log, saida: r.saida });

                var publicar = require('./publicar').publicar;
                var p = await publicar(r.saida, {
                    nome: I.appCode + '.doc.html',
                    descricao: 'Documentacao tecnica de ' + I.appCode + ', gerada por leitura do codigo.',
                    projeto: pedido.projeto || undefined,
                    /* Pasta vazia e uma escolha valida — "na raiz do projeto" —
                       e nao "use o padrao". Por isso o teste e por undefined. */
                    pasta: pedido.pasta === undefined ? undefined : pedido.pasta,
                    aoPassar: function (t) { log.push('publicacao   : ' + t); }
                });
                return responder(200, {
                    ok: true, log: log, saida: r.saida, url: p.url,
                    acao: p.acao === 'novo' ? 'Documento criado no Abacato'
                        : ('Revisao ' + p.numero + ' gravada no Abacato')
                });
            } catch (e) {
                /* O portal pode ter sido gerado e so a publicacao falhar. O log
                   acumulado vai junto com o erro — sem ele, a tela diria "nao
                   deu certo" sobre uma geracao que deu. */
                return responder(200, {
                    ok: false,
                    erro: (e && e.message ? e.message : String(e)) +
                        (log.length ? '\n\nO que deu certo antes:\n' + log.join('\n') : '')
                });
            }
        }

        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('nao existe');
    });

    return new Promise(function (resolve) {
        /* 127.0.0.1 explicito: sem isso o Node escuta em TODAS as interfaces e
           a maquina ao lado no escritorio alcanca esta tela. */
        servidor.listen(porta, '127.0.0.1', function () {
            resolve({ porta: porta, token: token, url: 'http://localhost:' + porta + '/?t=' + token, servidor: servidor });
        });
    });
}

module.exports = { subir: subir };
