-- Global default categories (household_id = null).
-- REQUIRED: the app never finishes loading without them (hasCats check in ZmrzkoApp.js).
-- Values are 1:1 from the CATS constant in components/ZmrzkoApp.js.

insert into public.categories (id, household_id, label, icon, color, months) values
  ('perutnina',    null, 'Perutnina',        '🐔', '#F97316', 9),
  ('goveje',       null, 'Goveje',           '🥩', '#DC2626', 12),
  ('svinjsko',     null, 'Svinjsko',         '🥓', '#E11D48', 6),
  ('riba',         null, 'Riba',             '🐟', '#0EA5E9', 6),
  ('zelenjava',    null, 'Zelenjava',        '🥦', '#22C55E', 12),
  ('sadje',        null, 'Sadje',            '🍓', '#A855F7', 12),
  ('pripravljena', null, 'Pripravljena jed', '🍲', '#F59E0B', 3),
  ('pecivo',       null, 'Pecivo',           '🍞', '#D97706', 6),
  ('psi',          null, 'Za psa',           '🐕', '#8B5CF6', 6),
  ('drugo',        null, 'Drugo',            '❄️', '#64748B', 6)
on conflict (id) do nothing;
