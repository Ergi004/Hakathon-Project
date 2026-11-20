-- Reference rows that every environment needs. Dataset rows are loaded by scripts/seed.ts.

-- Private storage buckets (SPEC 5 / 14 step 11). No public buckets.
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false), ('brand-assets', 'brand-assets', false), ('exports', 'exports', false)
on conflict (id) do nothing;

-- Detection settings (SPEC 5 settings, 6.3)
insert into public.settings (key, value) values
  ('thresholds', '{"yellow":20,"orange":40,"red":60,"darkred":80}'),
  ('weights', '{"links":30,"content":25,"sender":25,"attachments":10,"reputation":10}'),
  ('auto_escalate_hours', '24')
on conflict (key) do nothing;
