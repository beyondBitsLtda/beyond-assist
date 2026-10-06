# Lisa_Proof

Estudo de programação no estilo Duolingo, em cima dos quadros **STUDY** do Abacato.

- **Quadro** do Abacato com nome começando por `STUDY` → **tema** (ex.: `STUDY JavaScript` → JavaScript).
- **Card** → **assunto** (ex.: "Lógica de programação em JavaScript").
- **Checklist** do card → **tarefas de teoria** (ler apostila, discussão de fórum, definição com a IA...).

A Lisa lê o quadro e monta uma **trilha** progressiva, ignorando as colunas, distribuída nos dias
em que a pessoa estuda. A tela **Hoje** mostra os assuntos do dia com as checklists; marcar aqui
marca o mesmo item no Abacato. Cada tarefa vale pontos, e a **ofensiva** conta os dias seguidos com
estudo.

## Fases

| Fase | O que entra | Situação |
|---|---|---|
| 1 | Quadros STUDY, trilha pela IA, parte teórica, pontos, ofensiva, metas de dia, semana e mês | feita |
| 2 | Quiz e exercício diários sobre o assunto atual, gerados e corrigidos pela IA | feita |
| 3 | Projeto da semana e do mês, entregue por repositório público do GitHub e avaliado pela IA | feita |
| — | Mapa da trilha no estilo Duolingo e o mascote Neuro | feito |
| — | Lembretes por notificação push e app instalável | feito (falta ligar no iMac, ver abaixo) |

## Prática

Fica na aba **Prática** e também aparece como paradas no mapa (baú = projeto da semana, troféu =
projeto do mês). Um desafio de cada tipo por trilha e período — pedir de novo devolve o mesmo, não
gasta a IA outra vez (`proof_desafios`, índice único em usuário + trilha + tipo + período).

| Desafio | Período | Como responde | Tentativas |
|---|---|---|---|
| Quiz do dia | o dia | 5 perguntas, uma por vez; correção no servidor | 1 |
| Exercício do dia | o dia | código num editor; a IA corrige lendo | 3 (vale a melhor) |
| Projeto da semana | segunda a domingo | link de repositório **público** no GitHub | 5 (vale a melhor) |
| Projeto do mês | o mês | link de repositório **público** no GitHub | 5 (vale a melhor) |

- O gabarito do quiz nunca vai para a tela antes da resposta (`quizParaTela`).
- A IA **lê** o código, não executa. Nota 60 ou mais aprova (a aprovação sai da nota, não do que o
  modelo disse).
- Repositório privado é recusado mesmo com `GITHUB_TOKEN`: o token só existe para não esbarrar no
  limite da API sem login, e não pode virar uma porta para ler código privado pela avaliação.
- Até 18 arquivos por projeto, para caber no limite de 50 chamadas de rede por requisição do
  Worker gratuito.

## Conquistas e comemorações

**Conquistas** são da conta, não do quadro (`src/dominio/conquistas.js`): ofensiva (3, 7, 14, 30,
60, 100 dias), metas do dia batidas, dias estudados, tarefas, assuntos, quizzes, quizzes
gabaritados, exercícios e projetos aprovados — mais uma por trilha concluída (300 pts). Cada uma
vira um evento `conquista:<codigo>` em `proof_eventos`: soma no total e no nível, e a chave única
garante que é desbloqueada uma vez só. Tudo é recalculado a partir dos eventos, sem contador
guardado. Pontos de conquista **não** contam para a meta do dia.

Depois de qualquer ponto ganho, `depoisDePontuar` (em `src/lib/estudo.js`) confere, num lugar só:
bônus da meta, se a ofensiva subiu (primeiro evento do dia), trilha concluída e conquistas novas.
A tela recebe isso e abre a **comemoração em tela cheia** (`src/componentes/Celebracao.js`): a
chama com o número virando, o anel da meta e a medalha da conquista, em fila.

## Tema

Escuro por padrão; o botão da moldura alterna escuro → claro → sistema (guardado no aparelho).
Quem aplica é um script no `<head>`, antes da primeira pintura; o CSS usa
`:root[data-tema="escuro"]` para trocar os tokens.

## Lembretes (push)

Mesmo desenho da Lisa: o Worker só **guarda** as inscrições (`/api/push`, tabela `proof_push`);
quem **envia** é `scripts/lembretes.mjs`, no relógio do iMac — a biblioteca de push precisa do
Node completo, que o Worker não tem.

- A pessoa liga em **Progresso → Lembretes**. No iPhone só funciona com o app instalado na tela
  de início (Compartilhar → Adicionar à Tela de Início); a tela explica isso.
- O script manda **um** lembrete por pessoa: "ofensiva em risco" (tem sequência e não estudou
  hoje) ou "quiz do dia pendente". O mesmo tipo não se repete no mesmo dia por aparelho, e
  inscrição expirada (404/410) é apagada.
- Chaves VAPID: a pública fica no `.env.local` (vai para o Worker, a tela precisa dela); a
  **privada fica só no `.env.lembretes`**, que só o script lê e que o build não carrega.

**Ligar no iMac** (uma vez):

```bash
cd <pasta do repositório>/Abacatosys/lisa-proof
npm install
# copie para esta pasta os arquivos .env.local e .env.lembretes deste projeto (não estão no git)
npm run lembretes -- --simular     # confere sem mandar nada
npm run lembretes -- --teste       # manda um aviso de teste para os aparelhos inscritos
crontab -e
# acrescente:
0 12,20 * * * cd <pasta do repositório>/Abacatosys/lisa-proof && npm run lembretes >> ~/proof-lembretes.log 2>&1
```

## Pontos

| Ação | Pontos |
|---|---|
| Marcar uma tarefa | 10 |
| Concluir um assunto (todas as tarefas, ou à mão se não tiver tarefas) | +30 |
| Bater a meta do dia (uma vez por dia) | +20 |
| Quiz: cada acerto / gabaritar | 5 / +10 |
| Exercício (nota 100) | até 40 |
| Projeto da semana / do mês (nota 100) | até 150 / até 400 |

- Desmarcar devolve os pontos **só se foram ganhos hoje**. Ponto de outro dia é história, e
  desmarcar e marcar de novo não gera ponto nem salva a ofensiva.
- O dia é sempre o de São Paulo, mesmo com o Worker rodando em UTC.
- Metas de semana e mês contam **assuntos** planejados para terminar no período, mais os atrasados
  de antes.

## Onde as coisas moram

| Caminho | O quê |
|---|---|
| `src/dominio/` | Regras puras: datas, ofensiva, plano/agenda da trilha, metas, pontos. Testadas por `npm run dominio-check`. |
| `src/lib/estudo.js` | Único caminho até as tabelas do Abacato: permissão (dono + STUDY), marcar item, concluir card, pontos. |
| `src/lib/trilhas.js` | Criar, replanejar, apagar e ler trilhas. |
| `src/lib/ia.js` | IA da parte teórica: ordem da trilha, checklist de teoria, explicação. |
| `src/dominio/pratica.js` | Regras puras da prática: períodos, pontos, conferência do que a IA devolve, desenho do mapa. |
| `src/lib/pratica.js` · `src/lib/iaPratica.js` · `src/lib/github.js` | Prática no banco, IA da prática e leitura do GitHub. |
| `src/componentes/Neuro.js` · `src/app/neuro.css` | O mascote: SVG com humores trocados por classe CSS; `reagir()` e `comemorar()` de qualquer tela. |
| `src/componentes/MapaDaTrilha.js` · `src/app/mapa.css` | O mapa da trilha. |
| `src/lib/auth.js` | Cópia do login do Abacato. **Não mude `chaveDeLogin` aqui sem mudar lá.** |
| `db/001-proof.sql` · `db/002-pratica.sql` | Tabelas `proof_`. |

## Colocar no ar

1. **Banco**: aplique a migração (pode rodar duas vezes sem estragar nada).

   ```bash
   cp .env.example .env.local     # e preencha
   npm install
   npm run migrar -- db/001-proof.sql
   npm run migrar -- db/002-pratica.sql
   npm run migrar -- db/003-lembretes.sql
   npm run migrar -- db/004-conquistas.sql
   ```

2. **Worker**: crie as variáveis no painel da Cloudflare (Workers → `lisa-proof` → Settings →
   Variables), como **secret** as que são segredo:

   | Variável | Valor |
   |---|---|
   | `SUPABASE_URL` | o mesmo do Abacato |
   | `SUPABASE_SERVICE_ROLE_KEY` | o mesmo do Abacato (secret) |
   | `PROOF_SESSAO_SECRET` | um valor **novo** sorteado (secret) — não reaproveite o do Abacato |
   | `GEMINI_API_KEYS` | as mesmas chaves do Abacato (secret) |
   | `ABACATO_URL` | `https://abacato.beyond.dev.br` |
   | `GITHUB_TOKEN` | opcional (secret) — só aumenta o limite de leitura de repositórios públicos |
   | `VAPID_PUBLIC_KEY` | a chave pública dos lembretes (a privada NUNCA vai para o Worker) |

3. **Publicar**: `npm run publicar`. O `wrangler.jsonc` já aponta o domínio `proof.beyond.dev.br`
   e tem `keep_vars: true`, para o deploy não apagar as variáveis.

4. **Conferir**: `https://proof.beyond.dev.br/api/saude?banco=1` deve responder
   `"ok": true` e `"tabelas": "ok"`.

Para rodar local: `npm run dev` (porta 3100). O login exige HTTPS ou `localhost`, porque a senha
é calculada com WebCrypto no navegador.

## Decisões que valem lembrar

- **Só o dono** do quadro alcança a trilha, não os membros ("quadros criados pelo meu usuário").
- **Card recorrente** do Abacato não é concluído por aqui: lá, concluir arquiva uma cópia e reabre
  o card com a próxima data, e repetir essa lógica aqui seria ter duas versões dela.
- **Ids curtos para a IA** (`c1`, `c2`...): copiar uuids é onde o modelo erra, e um id errado é um
  assunto perdido. O que a IA esquece ou inventa é corrigido em `validarPlano`.
- **Replanejar** grava o plano novo antes de apagar o antigo; o que já foi concluído mantém as datas.
