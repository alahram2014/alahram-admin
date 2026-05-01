-- Optional: store tier discount scope without changing schema.
-- This is safe because it uses app_settings, which already exists.
-- Replace TIER_NAME with the real tier key.

insert into app_settings (key, value, visible, updated_at)
values (
  'tier_scope:TIER_NAME',
  '{"carton":true,"pack":true}',
  true,
  now()
)
on conflict (key)
do update set
  value = excluded.value,
  visible = excluded.visible,
  updated_at = excluded.updated_at;
