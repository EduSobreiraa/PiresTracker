create index if not exists project_stages_owner_project_idx
  on public.project_stages (project_id, user_id);

create index if not exists project_tasks_owner_project_idx
  on public.project_tasks (project_id, user_id);

create index if not exists project_tasks_owner_stage_project_idx
  on public.project_tasks (stage_id, project_id, user_id);
