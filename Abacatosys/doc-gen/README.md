# docgen

Lê um repositório e escreve um **portal HTML de documentação técnica**: o que o sistema é, como
ele está montado, quem chama quem, que dados ele guarda — e o código-fonte inteiro, colorido e
navegável, dentro da própria página.

Sem dependências externas, sem build, sem rede. E, se você quiser, ele publica o resultado
direto num projeto de documentação do **Abacato**, onde a equipe já procura documento.

```bash
node bin/docgen.js --tela              # abre a tela no navegador
node bin/docgen.js ./meu-projeto --publicar
```

## Por onde se usa

**A tela.** No Windows, dois cliques em `docgen.cmd`; em qualquer sistema,
`node bin/docgen.js --tela`. Abre no navegador: você navega até a pasta do repositório (as que
parecem repositório vêm marcadas), marca se quer publicar, e clica em **Gerar documentação**.
Os últimos repositórios ficam à mão como atalhos.

**Arrastando.** Solte uma pasta em cima de `docgen.cmd` e ele gera e publica aquela pasta
direto, sem abrir tela nenhuma.

**Pelo terminal**, com as opções da tabela mais abaixo.

> **Por que a tela é local, e não um botão dentro do Abacato**
>
> O Abacato roda na nuvem; o docgen precisa **ler a pasta do repositório**, que está no seu
> computador. Nenhuma página da internet alcança o disco de quem a abre — e ainda bem: um site
> que conseguisse ler suas pastas seria um problema bem maior que a comodidade de um botão.
>
> Então a tela roda na sua máquina, em `127.0.0.1`. O Abacato continua sendo o lugar onde a
> documentação **fica**; a tela é o lugar de onde ela **sai**.
>
> Três travas, porque um servidor local que lê pastas e roda geração é uma porta aberta:
> ele só escuta em `127.0.0.1`, exige uma **chave sorteada a cada execução** (que vai no
> endereço impresso no terminal — sem ela, qualquer aba aberta no seu navegador poderia mandar
> pedidos para o localhost pelas suas costas), e confere o cabeçalho `Host`, que é o que impede
> um domínio de fora apontado para `127.0.0.1` de conversar com ele.
>
> A saída vai para `~/docgen-saida/`, nunca para dentro do repositório analisado.

## O que ele entende

**Qualquer repositório.** O nome e o tipo do projeto saem do manifesto — `package.json`,
`pyproject.toml`, `go.mod`, `pom.xml`, `Cargo.toml`, `composer.json` — e, na falta dele, da
estrutura de pastas. Não havendo evidência nenhuma, ele diz "projeto" em vez de chutar um tipo
que mudaria os diagramas.

**JavaScript e TypeScript a fundo.** `import`, `require`, `import()` e apelidos (`@/lib/x`)
viram o mapa de chamadas. É a evidência mais forte que existe: o arquivo dizendo, por escrito,
de quem depende.

**SQL a fundo.** `CREATE TABLE` nos `.sql` do repositório (incluindo a forma do Postgres, com
`if not exists`), chaves estrangeiras declaradas na própria coluna, e o acesso a tabelas tanto
em SQL escrito à mão quanto em consultas encadeadas (`.from("tabela").select()`), separando o
que **lê** do que **grava**.

**Aplicações de baixo código** continuam reconhecidas: formulários, eventos de cartão, scripts
de processo e consultas server-side ganham suas próprias seções e diagramas.

**As outras linguagens** entram no inventário, na biblioteca de código e no realce de sintaxe.
Não há mapa de chamadas para elas — e o portal não finge que há.

## As seções do portal

| Seção | O que responde |
|---|---|
| Visão geral | que projeto é este, de onde veio o nome, e as evidências que sustentam o tipo detectado |
| Arquitetura do sistema | fluxograma de execução e camadas, desenhados conforme o tipo — camada que não existe não é desenhada |
| Mapa de chamadas | quem chama quem, arquivo por arquivo, com a evidência de cada seta |
| Arquitetura de dados | tabelas, colunas, tipos, chaves, relações e em que base cada uma vive |
| Rastreabilidade | matriz tabela × módulo (lê / grava), base para análise de impacto |
| Biblioteca de código | todo o código-fonte, colorido, navegável dentro da própria página |
| Inventário | todos os arquivos varridos e o papel de cada um |

## Duas decisões que explicam o resto

### O portal funciona sem JavaScript

Não é preferência: é o requisito de onde ele vai ser lido.

O visor de documentos do Abacato desenha HTML enviado dentro de um `<iframe sandbox="">`, **sem
nenhuma permissão** — o que desliga o script da página. É a trava certa, porque ali se desenha
código que outra pessoa mandou, e afrouxá-la para o portal ficar bonito seria abrir a única
porta que o sistema fechou de propósito.

Então o portal não depende de script para mostrar nada:

- a navegação é âncora;
- o que abre e fecha é `<details>`;
- o realce de sintaxe **já vem aplicado** do gerador;
- o código-fonte está escrito no HTML, não num blob JSON montado no navegador.

Com JavaScript — abrindo o arquivo direto no navegador — ele ganha filtro de arquivos, foco no
grafo e o botão de imprimir. Sem ele, continua inteiro.

> A versão anterior guardava o código num `<script type="application/json">` e o montava no
> cliente. Dentro do visor, a biblioteca de código inteira aparecia como um painel **em branco**
> — sem erro, sem aviso, sem nada.

### Dado sem fonte não é dado

Cada tabela, coluna e relação é marcada como `declarado (banco)`, `declarado (DDL)` ou
`inferido`. Uma tabela cujo `CREATE TABLE` está no repositório é, por definição, do próprio
projeto — e isso vale mais que qualquer convenção de nome.

A pasta `esquema-sql/`, criada ao lado do portal, existe para converter o inferido em
declarado: ela traz um script que lê o catálogo do banco, e o resultado salvo ali faz a próxima
geração usar tipos reais, nulidade, chaves primárias e **relações vindas de chaves estrangeiras
de verdade**, em vez de adivinhadas pelo sufixo `_id`.

## Opções

| Opção | O que faz |
|---|---|
| `--out <arquivo>` | caminho do HTML (padrão: `<nome-do-projeto>.doc.html`) |
| `--json` | grava também o modelo extraído, para integrar em outro processo |
| `--sem-codigo` | não embute o código-fonte; portal muito menor, resto completo |
| `--forcar` | sobrescreve um HTML que documenta **outro** projeto (sem isso, recusa) |
| `--publicar` | envia para um projeto de documentação do Abacato |
| `--config <arquivo>` | configuração da publicação (padrão: `~/.docgen-abacato.json`) |
| `--tela` | abre a tela no navegador, nesta máquina |
| `--porta <n>` | porta da tela (padrão: 4321) |

Todo portal carrega `<meta name="dg-app">` com o projeto que ele documenta. Regerar o mesmo
projeto sobrescreve sem perguntar; apontar `--out` para a documentação de outro projeto
**interrompe** a geração em vez de destruí-la.

## Publicar no Abacato

```json
{
  "url": "https://abacato.exemplo.com.br",
  "email": "voce@exemplo.com.br",
  "senha": "...",
  "projeto": "Documentação de código",
  "pasta": "Meu Sistema",
  "categoria": "Técnico"
}
```

Em `~/.docgen-abacato.json`, **modo 600** — o arquivo guarda uma senha, e o publicador recusa
lê-lo se o resto da máquina puder abri-lo.

**Regerar cria uma REVISÃO, não um documento novo.** Documentação de código é regerada toda
semana; se cada geração criasse um documento, o projeto viraria uma pilha de arquivos iguais e
ninguém saberia qual é o de hoje. Com revisão, o endereço é um só, a versão atual é a última, e
o histórico fica guardado.

O publicador **não cria o projeto** se ele não existir: um erro de digitação no nome criaria
projetos duplicados em silêncio. Ele falha listando os projetos a que você tem acesso.

A senha é esticada aqui, do mesmo jeito que o navegador faria — o servidor do Abacato nunca
recebe senha em texto. Como são duas implementações do mesmo cálculo (WebCrypto lá, `node:crypto`
aqui), `npm run publicar-check` compara as duas byte a byte: se um dia divergirem, isso aparece
como falha de teste e não como um 401 sem explicação no meio de uma publicação.

## Conferências

| comando | o que garante |
|---|---|
| `npm run estilo-check` | toda classe que o gerador escreve tem regra no tema, todo nome montado na hora casa com alguma regra, e toda cor usada nos diagramas existe na paleta |
| `npm run publicar-check` | a derivação de senha daqui é idêntica à do Abacato |
| `npm run tela-check` | as três travas da tela local, a navegação por pastas e a geração pelo botão |
| `npm run publicado-check` | o caminho inteiro contra o Abacato de verdade |

## Limitações conhecidas

- Mapa de chamadas é análise **estática**: nome de módulo montado em tempo de execução não aparece.
- SQL montado de forma muito dinâmica (colunas em variáveis, `switch` de fragmentos) pode não ser capturado por inteiro — o portal sinaliza onde revisar.
- Nome de tabela em duas partes (`dbo.X`) é tratado como *esquema.objeto*, nunca como *banco.objeto*: não dá para saber qual dos dois é sem adivinhar.
- Duas tabelas com o mesmo nome em bases diferentes são documentadas como uma só, com aviso.
- Fora de JS/TS e SQL não há mapa de chamadas nem extração de símbolos.
- Com a biblioteca embutida, o portal de um repositório grande passa de 10 MB. Abre rápido, mas incomoda para anexar em e-mail — nesse caso, `--sem-codigo`.
- Em pasta de rede a varredura lê 24 arquivos por vez; leituras que falham são tentadas de novo e, se ainda falharem, aparecem nos avisos do portal — nunca são descartadas em silêncio.
