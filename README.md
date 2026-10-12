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
