-- SPEC 8 C3: a citizen sees the masked content of reports they filed.
create policy messages_reporter_read on public.messages for select to authenticated
  using (exists (select 1 from public.reports r where r.message_id = messages.id and r.reporter_id = (select auth.uid())));
