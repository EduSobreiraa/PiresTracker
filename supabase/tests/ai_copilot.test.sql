begin;
select plan(19);

select ok((select count(*) = 3 from pg_class where relnamespace = 'public'::regnamespace and relname in ('ai_conversations', 'ai_messages', 'ai_proposals') and relrowsecurity), 'all copilot tables use RLS');
select ok(not has_table_privilege('authenticated', 'public.ai_proposals', 'INSERT'), 'clients cannot create proposals');
select ok(not has_table_privilege('authenticated', 'public.ai_proposals', 'UPDATE'), 'clients cannot edit proposals');
select ok(has_function_privilege('authenticated', 'public.decide_ai_proposal(uuid, uuid, text)', 'EXECUTE'), 'authenticated users can decide proposals');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
('00000000-0000-4000-8000-00000000aa01', 'authenticated', 'authenticated', 'ai-test-1@example.invalid', '', now(), now(), now()),
('00000000-0000-4000-8000-00000000aa02', 'authenticated', 'authenticated', 'ai-test-2@example.invalid', '', now(), now(), now());
insert into public.projects(id, user_id, name) values ('00000000-0000-4000-8000-00000000ab01', '00000000-0000-4000-8000-00000000aa01', 'Teste');
insert into public.project_stages(id, user_id, project_id, title) values ('00000000-0000-4000-8000-00000000ac01', '00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-00000000ab01', 'Etapa');
insert into public.ai_conversations(id, user_id) values ('00000000-0000-4000-8000-00000000ad01', '00000000-0000-4000-8000-00000000aa01');
insert into public.ai_proposals(id, conversation_id, user_id, version, kind, project_id, stage_id, project_name, stage_title, title) values
('00000000-0000-4000-8000-00000000ae01', '00000000-0000-4000-8000-00000000ad01', '00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-00000000af01', 'create_project_task', '00000000-0000-4000-8000-00000000ab01', '00000000-0000-4000-8000-00000000ac01', 'Teste', 'Etapa', 'Nova tarefa'),
('00000000-0000-4000-8000-00000000ae02', '00000000-0000-4000-8000-00000000ad01', '00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-00000000af02', 'create_project_task', '00000000-0000-4000-8000-00000000ab01', '00000000-0000-4000-8000-00000000ac01', 'Teste', 'Etapa', 'Expirada'),
('00000000-0000-4000-8000-00000000ae03', '00000000-0000-4000-8000-00000000ad01', '00000000-0000-4000-8000-00000000aa01', '00000000-0000-4000-8000-00000000af03', 'create_project_task', '00000000-0000-4000-8000-00000000ab01', '00000000-0000-4000-8000-00000000ac01', 'Teste', 'Etapa', 'Rejeitada');
update public.ai_proposals set expires_at = now() - interval '1 minute' where id = '00000000-0000-4000-8000-00000000ae02';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000000aa02';
select is((select count(*) from public.ai_proposals), 0::bigint, 'other user cannot read proposals');
select throws_ok($$select public.decide_ai_proposal('00000000-0000-4000-8000-00000000ae01', '00000000-0000-4000-8000-00000000af01', 'approve')$$, 'P0001', 'PROPOSAL_NOT_FOUND', 'other user cannot approve');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000000aa01';
select is((select count(*) from public.ai_proposals), 3::bigint, 'owner reads own proposals');
select throws_ok($$select public.decide_ai_proposal('00000000-0000-4000-8000-00000000ae01', '00000000-0000-4000-8000-00000000af02', 'approve')$$, 'P0001', 'PROPOSAL_CHANGED', 'changed version is rejected');
select throws_ok($$select public.decide_ai_proposal('00000000-0000-4000-8000-00000000ae01', null, 'approve')$$, 'P0001', 'PROPOSAL_CHANGED', 'missing version is rejected');
select throws_ok($$select public.decide_ai_proposal('00000000-0000-4000-8000-00000000ae01', '00000000-0000-4000-8000-00000000af01', null)$$, 'P0001', 'INVALID_DECISION', 'missing decision is rejected');
select throws_ok($$select public.decide_ai_proposal('00000000-0000-4000-8000-00000000ae02', '00000000-0000-4000-8000-00000000af02', 'approve')$$, 'P0001', 'PROPOSAL_EXPIRED', 'expired proposal is rejected');
select is(public.decide_ai_proposal('00000000-0000-4000-8000-00000000ae01', '00000000-0000-4000-8000-00000000af01', 'approve'), 'approved', 'approved proposal applies');
select throws_ok($$select public.decide_ai_proposal('00000000-0000-4000-8000-00000000ae01', '00000000-0000-4000-8000-00000000af01', 'approve')$$, 'P0001', 'PROPOSAL_ALREADY_DECIDED', 'repeat approval is rejected');
select is(public.decide_ai_proposal('00000000-0000-4000-8000-00000000ae03', '00000000-0000-4000-8000-00000000af03', 'reject'), 'rejected', 'rejection records a decision');
reset role;
select is((select count(*) from public.project_tasks where seed_key = 'ai:00000000-0000-4000-8000-00000000ae01'), 1::bigint, 'approval creates exactly one task');
select is((select status from public.ai_proposals where id = '00000000-0000-4000-8000-00000000ae01'), 'approved', 'proposal records decision');
select ok((select applied_task_id is not null from public.ai_proposals where id = '00000000-0000-4000-8000-00000000ae01'), 'proposal audits the created task');
select is((select status from public.ai_proposals where id = '00000000-0000-4000-8000-00000000ae03'), 'rejected', 'rejected proposal keeps its status');
select is((select count(*) from public.project_tasks where seed_key = 'ai:00000000-0000-4000-8000-00000000ae03'), 0::bigint, 'rejection creates no task');

select * from finish();
rollback;
