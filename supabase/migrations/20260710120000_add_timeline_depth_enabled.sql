-- 時系列奥行き表示 ON/OFF（スペース単位、デフォルト OFF）
-- 列限定トリガーで管理者以外の timeline_depth_enabled 変更を拒否

alter table public.space_settings
  add column if not exists timeline_depth_enabled boolean not null default false;

comment on column public.space_settings.timeline_depth_enabled is
  '時系列奥行き表示の ON/OFF。true のとき starDot の depth scale を適用する。管理者のみ変更可。';

create or replace function public.enforce_timeline_depth_enabled_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.timeline_depth_enabled is not true then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.timeline_depth_enabled is not distinct from old.timeline_depth_enabled then
    return new;
  end if;

  if (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin' then
    return new;
  end if;

  if not exists (
    select 1
    from public.spaces s
    inner join public.communities c on c.id = s.community_id
    where s.id = new.space_id
      and c.admin_id = auth.uid()
  ) then
    raise exception 'Only space administrators can change timeline depth settings.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_timeline_depth_enabled_admin on public.space_settings;

create trigger enforce_timeline_depth_enabled_admin
  before insert or update on public.space_settings
  for each row
  execute function public.enforce_timeline_depth_enabled_admin();
