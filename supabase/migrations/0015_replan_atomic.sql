-- 0015_replan_atomic.sql
-- Wraps the replan session swap in a single PL/pgSQL block so Postgres
-- executes delete + insert as one implicit transaction. If the insert fails
-- the delete is rolled back, leaving the previous schedule intact.
--
-- SECURITY INVOKER: runs under the calling role's RLS context, so the
-- delete is automatically scoped to the authenticated user's own sessions.

create or replace function pace_swap_scheduled_sessions(
  p_user_id  uuid,
  p_plan_id  uuid,
  p_sessions jsonb   -- array of {topic_id, starts_at, duration_minutes, instruction}
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Delete current scheduled sessions (RLS scopes this to the calling user).
  delete from sessions
  where user_id  = p_user_id
    and status   = 'scheduled';

  -- Insert replacement sessions (empty array = intentionally empty schedule).
  if p_sessions is not null and jsonb_array_length(p_sessions) > 0 then
    insert into sessions (
      plan_id, user_id, topic_id,
      starts_at, duration_minutes, instruction, status
    )
    select
      p_plan_id,
      p_user_id,
      (s->>'topic_id')::uuid,
      (s->>'starts_at')::timestamptz,
      (s->>'duration_minutes')::int,
      s->>'instruction',
      'scheduled'
    from jsonb_array_elements(p_sessions) as s;
  end if;
end;
$$;

-- Revoke the default public grant; only authenticated users may call this function.
revoke execute on function pace_swap_scheduled_sessions(uuid, uuid, jsonb) from public;
grant  execute on function pace_swap_scheduled_sessions(uuid, uuid, jsonb) to authenticated;
