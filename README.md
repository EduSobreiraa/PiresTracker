# Minha Rotina

Aplicativo web instalável para consultar a semana, acompanhar estudos e academia, e manter compromissos recorrentes.

## Executar localmente

Instale as dependências e inicie o servidor:

```sh
npm install
npm run dev
```

Sem variáveis do Supabase, o app usa o modo de demonstração local. Ele salva os dados no navegador e não sincroniza entre dispositivos.

Para usar o Supabase, copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Use somente a chave publicável no frontend. Nunca use uma chave `service_role`.

O acesso usa [GitHub OAuth pelo Supabase](https://supabase.com/docs/guides/auth/social-login/auth-github). Entrar no painel Supabase com GitHub não configura automaticamente o login GitHub do aplicativo. Crie uma OAuth App em [GitHub Developer Settings](https://github.com/settings/developers), use a URL do app como Homepage URL e cadastre este callback:

```text
https://vwroeysxtkzryizzqnjq.supabase.co/auth/v1/callback
```

Em Supabase > Authentication > Sign In / Providers > GitHub, habilite o provedor e informe o Client ID e Client Secret da OAuth App. Guarde o Client Secret somente no Supabase, nunca no frontend. Em Authentication > URL Configuration, permita `http://localhost:5173/` e `http://127.0.0.1:5173/` para desenvolvimento e a URL HTTPS do app quando publicado, conforme a [configuração oficial de redirects](https://supabase.com/docs/guides/auth/redirect-urls). O app retorna para a origem atual após o login.

O primeiro login GitHub cria o usuário de Auth no projeto. Depois de criar sua conta, desative novos cadastros nas configurações de Auth se quiser manter o projeto restrito ao seu uso pessoal.

## Rotina e banco de dados

A primeira abertura cria a rotina confirmada da planilha v0.6 para a conta autenticada ou para a demonstração local. Compromissos e deslocamentos aparecem sem checkbox; estudos e academia registram conclusões por data. A timeline destaca a atividade atual ou a próxima, e o resumo usa a quantidade de sessões ativas planejadas na semana. Ao remover uma atividade recorrente, o app preserva o histórico das conclusões.

As migrações em `supabase/migrations` criam `routine_items`, `completions`, as políticas RLS e `study_goals`. `20261012160308_add_study_goal_tasks.sql` adiciona o vínculo entre tarefa e objetivo, com exclusão em cascata dentro da mesma conta; `20261012160737_seed_aws_practice_task.sql` separa a prática adicional do curso AWS. Ambas foram aplicadas ao projeto Supabase conectado. Em outro projeto, aplique as migrações em ordem.

## Verificar

```sh
npm run test
npm run typecheck
npm run build
```

Para publicar em Cloudflare Pages, use `npm run build`, publique `dist` e configure as duas variáveis do Supabase nas variáveis de ambiente do projeto.

## Vinculação financeira

O incremento 0.1A adiciona as tabelas `financial_link_sessions` e `financial_connections`, além das funções `finance-connect-start` e `finance-connect-confirm`. A função de início emite um Connect Token com `clientUserId` igual ao UUID do usuário autenticado. A função de confirmação valida o token no escopo do Item antes de gravar a conexão. O banco guarda apenas o hash do Connect Token.

Configure `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` nos secrets das Edge Functions. O código usa `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` fornecidos pelo Supabase. Nunca coloque esses valores em variáveis `VITE_`.

Para testar localmente, crie `supabase/functions/.env` com os dois secrets da Pluggy. Esse arquivo é ignorado pelo Git. Inicie o Supabase local e execute:

```sh
npx supabase start
npx supabase test db --local
npx supabase functions serve finance-connect-start finance-connect-confirm --env-file supabase/functions/.env
```

O runtime local valida a sessão Supabase e usa os secrets do arquivo local. As Edge Functions ainda não foram publicadas no projeto remoto.

Para cadastrar pontualmente um Item MeuPluggy já autorizado, use `supabase/scripts/bootstrap-financial-item.ts` em um terminal administrativo com as variáveis `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` exportadas. Confirme que `SUPABASE_URL` aponta para o projeto correto e que o Item foi autorizado pelo proprietário antes de executar. Informe o UUID do usuário proprietário, o `itemId` e a confirmação obrigatória:

```sh
deno run --allow-env=SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,PLUGGY_CLIENT_ID,PLUGGY_CLIENT_SECRET --allow-net=api.pluggy.ai,<project-ref>.supabase.co supabase/scripts/bootstrap-financial-item.ts <owner-user-uuid> <pluggy-item-uuid> --confirm-owner-and-authorization
```

O script consulta o Item diretamente na Pluggy, exige o conector MeuPluggy e não troca o proprietário de um Item já cadastrado. A chamada repetida para o mesmo proprietário não duplica a conexão. A confirmação administrativa continua necessária porque a consulta à API, sozinha, não prova a titularidade da conta bancária.

O incremento 0.1B adiciona a Edge Function `finance-sync`. Ela recebe somente `connectionId`, valida a sessão Supabase e consulta a conexão do usuário antes de acessar a Pluggy. Contas, transações e faturas são atualizadas por chaves externas únicas; a categoria manual fica fora do payload de sincronização. A função registra o resultado e as contagens da execução. Ela não calcula receitas, despesas ou saldo mensal.

## Instalar no iPhone

Abra o endereço HTTPS no Safari, toque em **Compartilhar** e escolha **Adicionar à Tela de Início**. A PWA atualiza os arquivos estáticos quando uma nova versão é publicada; feche e reabra o app se uma atualização ainda não aparecer. Dados e autenticação do Supabase não são armazenados pelo cache offline.
