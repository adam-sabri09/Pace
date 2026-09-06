-- 0014_admin_aggregate_rpc.sql
-- Replaces unbounded table-scan queries in /admin with a single aggregate
-- RPC. The function is SECURITY DEFINER so it bypasses RLS (same as the
-- service role the admin page already uses), and is revoked from every role
-- except service_role so regular users cannot invoke it.

create or replace function admin_get_aggregate_stats()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'sessions', (
      select jsonb_build_object(
        'completed', coalesce(count(*) filter (where status = 'completed'), 0),
        'missed',    coalesce(count(*) filter (where status = 'missed'),    0),
        'scheduled', coalesce(count(*) filter (where status = 'scheduled'), 0)
      ) from sessions
    ),
    'subjects', (
      select jsonb_build_object(
        'total',            count(*),
        'avg_confidence',   round(avg(confidence_pct)::numeric),
        'confidence_count', count(confidence_pct),
        'top_names', (
          select coalesce(jsonb_agg(to_jsonb(r) order by r.cnt desc), '[]'::jsonb)
          from (
            select name, count(*)::int as cnt
            from subjects
            group by name
            order by cnt desc
            limit 8
          ) r
        ),
        'difficulty', jsonb_build_object(
          'easy',   coalesce(count(*) filter (where difficulty = 'easy'),   0),
          'medium', coalesce(count(*) filter (where difficulty = 'medium'), 0),
          'hard',   coalesce(count(*) filter (where difficulty = 'hard'),   0),
          'unset',  coalesce(count(*) filter (where difficulty is null),    0)
        )
      ) from subjects
    ),
    'profiles', (
      select jsonb_build_object(
        'avg_memory',   round(avg(memory_score)::numeric),
        'memory_count', count(memory_score),
        'top_goals', (
          select coalesce(jsonb_agg(to_jsonb(r) order by r.cnt desc), '[]'::jsonb)
          from (
            select goal_ranking[1] as goal, count(*)::int as cnt
            from profiles
            where goal_ranking is not null
              and array_length(goal_ranking, 1) > 0
            group by goal_ranking[1]
            order by cnt desc
            limit 5
          ) r
        ),
        'top_habits', (
          select coalesce(jsonb_agg(to_jsonb(r) order by r.cnt desc), '[]'::jsonb)
          from (
            select h as habit, count(*)::int as cnt
            from profiles, unnest(study_habits) as h
            where array_length(study_habits, 1) > 0
            group by h
            order by cnt desc
            limit 6
          ) r
        ),
        'age_bands', (
          select coalesce(jsonb_agg(to_jsonb(r) order by r.cnt desc), '[]'::jsonb)
          from (
            select age_band, count(*)::int as cnt
            from profiles
            where age_band is not null
            group by age_band
            order by cnt desc
          ) r
        )
      ) from profiles
      where session_length_minutes is not null
    ),
    'practice', (
      select jsonb_build_object(
        'total_sessions',  count(*)::int,
        'total_questions', coalesce(sum(questions_answered), 0)::int,
        'total_correct',   coalesce(sum(correct_count), 0)::int
      )
      from practice_sessions
      where status = 'completed'
    )
  )
$$;

-- Restrict to service_role only — no user should call this directly.
revoke execute on function admin_get_aggregate_stats() from public;
revoke execute on function admin_get_aggregate_stats() from authenticated;
grant  execute on function admin_get_aggregate_stats() to service_role;
