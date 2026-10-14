# Reconciliação local do histórico Supabase

Preparação local na branch `finance/migration-history-reconciliation`. Nenhuma escrita foi feita no projeto remoto.

Os oito SQLs originais foram copiados byte a byte para `/tmp/pirestracker-reconciliation-originals/`. Seus blobs Git também permanecem recuperáveis pela base da branch: `git show main:supabase/migrations/<arquivo-original>`.

Hashes SHA-256 abaixo são calculados após normalizar CRLF para LF, remover espaços no fim de cada linha e aparar espaços externos.

| Arquivo local anterior | Arquivo com versão remota | Blob Git original | SHA-256 local anterior | SHA-256 SQL aplicado |
|---|---|---|---|---|
| `20261012012045_add_commute_routine_items.sql` | `20261012012103_add_commute_routine_items.sql` | `92a0a4dfb5498fd94f60b02b86cba77e3175aeb8` | `248f1982493af8099842eb931929023e619a79505eee0781191a50cf918bd437` | `248f1982493af8099842eb931929023e619a79505eee0781191a50cf918bd437` |
| `20261012021000_create_study_goals.sql` | `20261012123138_create_study_goals.sql` | `12429f090770c0ba877be3ec4e1e46ba827a983e` | `e4772ffecd2f7741d386b6fcd4c8b9bdd8c530e8e0bcd8a49dc097bb5af45b1c` | `e4772ffecd2f7741d386b6fcd4c8b9bdd8c530e8e0bcd8a49dc097bb5af45b1c` |
| `20261012170000_consolidate_aws_ai_practitioner.sql` | `20261012175257_consolidate_aws_ai_practitioner.sql` | `542c0f5097da1238b0376f1d798068f3a92c8d44` | `5ea80c893d195396be0325f468b9830141873861dc311367f45b0d50cdcfe9b9` | `05c6165acdc4a70599ddd88586a0356643006f44263abc2d87e41b853c9528bf` |
| `20261012180000_label_aws_exam_stages.sql` | `20261012175418_label_aws_exam_stages.sql` | `c753a658c41c0614f9d13fd2ae8caccc66bad258` | `82052b20ce24e3fd5d94237254b405b42927536511ecc7d12c5123b33b30dd04` | `12ab803aec89292d655bc87b18ddeeec9f4cf844f06985224cecc0d0842ddc2d` |
| `20261012180500_label_aws_fundamentals_plan.sql` | `20261012175535_label_aws_fundamentals_plan.sql` | `f28770348584d2edd195d06a9ef32b66afd018ab` | `053d01ca12f7c83df5e74bd3ff51c66c8b1a18541a5fd7062d1a2cb9de4b818b` | `053d01ca12f7c83df5e74bd3ff51c66c8b1a18541a5fd7062d1a2cb9de4b818b` |
| `20261012181000_refresh_aws_course_descriptions.sql` | `20261012175643_refresh_aws_course_descriptions.sql` | `d4767f8e8dec03b53b2e9a33f833811e27643d98` | `c6fdbc5c39ac050d1a2dadd9c9c7565b4628260dd1345b3f98402b695e5b4393` | `c6fdbc5c39ac050d1a2dadd9c9c7565b4628260dd1345b3f98402b695e5b4393` |
| `20261012190000_create_projects.sql` | `20261012181235_create_projects.sql` | `bc509ba133b3e523d62fd7f11403a557cc3c4a93` | `5af21d761664b9fc2025687c2e21f33594fd0c3c193fd466506d6c82965274e5` | `5af21d761664b9fc2025687c2e21f33594fd0c3c193fd466506d6c82965274e5` |
| `20261012200000_index_project_foreign_keys.sql` | `20261012181707_index_project_foreign_keys.sql` | `d0f5b6b2dd8f13094281f740acf5ac89ade6f31d` | `1baefcfb45ee46e10c98a5ab3e52e63208d7f2aed861c6025084c44a6be957dd` | `1baefcfb45ee46e10c98a5ab3e52e63208d7f2aed861c6025084c44a6be957dd` |

## Proveniência e efeito

Os oito arquivos foram reconstruídos a partir das chamadas `apply_migration` concluídas registradas no histórico do Codex. Os dois arquivos divergentes agora contêm o SQL efetivamente enviado; os outros seis também usam o SQL capturado, que havia sido comparado com o conteúdo local. As versões locais anteriores não foram reaplicadas.

As migrações que atualizam dados existentes só serão executadas numa reconstrução local vazia. O alinhamento remoto por timestamp faz a CLI pular as versões já registradas; não atualiza dados de Rotina, Projetos ou Estudos no remoto.

## Validação local

A CLI 2.120.0 iniciou um Supabase descartável em `/tmp/pirestracker-reconcile-check-x5Hxic`. As 18 migrações, em ordem, foram aplicadas sem erro. `supabase migration list --local` confirmou os mesmos 18 timestamps no banco local.

`financial_sync.test.sql` tem 24 assertions. Atualizei o plano pgTAP de `plan(23)` para `plan(24)`. A nova execução de `supabase test db --local` passou com 45 testes em dois arquivos.

`npm run typecheck`, `npm test`, `npm run build` e `git diff --check` também passaram. Vitest executou 27 testes em quatro arquivos.

O primeiro início do projeto descartável parou porque a porta padrão 54327 já estava ocupada pelo stack local existente. A porta de analytics foi alterada somente no `config.toml` temporário, e o início seguinte terminou com sucesso. O stack descartável foi encerrado com `supabase stop --no-backup`; os outros containers não foram parados.

## Comparação com o projeto remoto

O histórico remoto de 14 versões foi consultado anteriormente pelo Supabase MCP. `supabase/config.toml` ainda declara o projeto `vwroeysxtkzryizzqnjq`, mas este checkout não contém `supabase/.temp/project-ref`. `supabase migration list --linked` confirmou que a CLI não está vinculada. A tentativa com `--project-ref` e `supabase db push --dry-run --project-ref vwroeysxtkzryizzqnjq` foi bloqueada porque a CLI não tem access token. Não fiz login, link nem escrita remota.

A comparação anterior de fingerprints entre a reconstrução das 14 migrações históricas e o remoto encontrou correspondência nas categorias consultadas: 69 colunas, 46 constraints, 30 índices, 28 policies, 7 estados de RLS, 5 triggers, 2 rotinas, 0 views e 0 tipos. Essa comparação não incluiu dados, grants, roles, ownership de sequências ou schemas gerenciados. O `db diff --linked` oficial não foi executado nesta branch.

As quatro migrações financeiras são as únicas diferenças de schema esperadas em relação ao remoto. A lista exata de diferenças estruturais da branch atual permanece não verificada até que uma CLI vinculada e autenticada possa executar `supabase db diff --linked --schema public` e `supabase db push --linked --dry-run`.

## Migrações financeiras pendentes

Permanecem depois do histórico remoto final `20261012191446`: `20261013090000_create_financial_linking.sql`, `20261013100000_validate_financial_link_confirmation.sql`, `20261013120000_create_financial_sync.sql` e `20261013130000_financial_transaction_bill_id_text.sql`.
