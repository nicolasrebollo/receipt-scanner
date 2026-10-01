-- TEMPLATE: replace <PROJECT_URL> and <CRON_SECRET> (the value in supabase/functions/.env) first.
-- Schedules the monthly summary notification. Run once in the Supabase SQL Editor.
-- Safe to run again: it replaces the existing schedule and touches no app data.
--
-- At 15:00 UTC on the 1st of each month (late morning in the Americas) the database calls the
-- monthly-summary function, which notifies every member who has that notification turned on.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'monthly-summary',
  '0 15 1 * *',
  $$
  select net.http_post(
    url := '<PROJECT_URL>/functions/v1/monthly-summary',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
