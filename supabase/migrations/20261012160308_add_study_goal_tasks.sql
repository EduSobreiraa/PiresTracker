alter table public.study_goals
  add column if not exists parent_goal_id uuid;

do $$ begin
  alter table public.study_goals
    add constraint study_goals_id_user_key unique (id, user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.study_goals
    add constraint study_goals_parent_owner_fk
    foreign key (parent_goal_id, user_id)
    references public.study_goals (id, user_id)
    on delete cascade;
exception when duplicate_object then null;
end $$;

alter table public.study_goals
  drop constraint if exists study_goals_no_self_parent;
alter table public.study_goals
  add constraint study_goals_no_self_parent check (parent_goal_id is null or parent_goal_id <> id);

create index if not exists study_goals_parent_idx
  on public.study_goals (user_id, parent_goal_id);
