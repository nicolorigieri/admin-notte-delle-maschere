-- ESEGUI QUESTO FILE NEL SQL EDITOR DI SUPABASE (dopo supabase.sql del sito principale).
-- E' sicuro da rilanciare piu' volte: ricrea sempre le stesse cose.
-- Aggiunge il PIN (in una tabella separata, illeggibile dal sito) e le funzioni
-- per gestire classifica e chiusura dal pannello admin.

-- Lettura normale delle impostazioni (voting_closed, closes_at) per tutti
grant select on public.contest_settings to anon, authenticated;
drop policy if exists "Anyone can view voting status" on public.contest_settings;
drop policy if exists "Anyone can view contest settings" on public.contest_settings;
create policy "Anyone can view contest settings"
  on public.contest_settings for select
  to anon, authenticated
  using (true);

-- Il PIN vive in una tabella a parte: nessuna policy = nessun accesso dall'esterno.
create table if not exists public.admin_secrets (
  id boolean primary key default true check (id),
  admin_pin text not null default 'CAMBIAMI'
);
alter table public.admin_secrets enable row level security;

-- CAMBIA QUI IL PIN DELL'ORGANIZZATORE (5-20 caratteri):
insert into public.admin_secrets (id, admin_pin) values (true, 'Zucca-4817')
on conflict (id) do update set admin_pin = excluded.admin_pin;

-- Se il vecchio schema aveva il PIN dentro contest_settings, lo rimuovo da li'.
alter table public.contest_settings drop column if exists admin_pin;

create or replace function public.admin_check(pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.admin_secrets where id = true and admin_pin = pin) then
    raise exception 'PIN errato';
  end if;
end;
$$;

-- Il parametro si chiama "new_closes_at" (non "closes_at") per non essere ambiguo
-- con la colonna della tabella che ha lo stesso nome.
drop function if exists public.admin_set_closing(text, boolean, timestamptz);
create or replace function public.admin_set_closing(pin text, closed boolean, new_closes_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_check(pin);
  update public.contest_settings set voting_closed = closed, closes_at = new_closes_at where id = true;
end;
$$;

create or replace function public.admin_delete_contestant(pin text, contestant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_check(pin);
  delete from public.contestants where id = contestant;
end;
$$;

create or replace function public.admin_reset_vote(pin text, contestant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.admin_check(pin);
  delete from public.votes where contestant_id = contestant;
  update public.contestants set vote_count = 0 where id = contestant;
end;
$$;

revoke all on function public.admin_check(text) from public;
revoke all on function public.admin_set_closing(text, boolean, timestamptz) from public;
revoke all on function public.admin_delete_contestant(text, uuid) from public;
revoke all on function public.admin_reset_vote(text, uuid) from public;
grant execute on function public.admin_check(text) to anon, authenticated;
grant execute on function public.admin_set_closing(text, boolean, timestamptz) to anon, authenticated;
grant execute on function public.admin_delete_contestant(text, uuid) to anon, authenticated;
grant execute on function public.admin_reset_vote(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
