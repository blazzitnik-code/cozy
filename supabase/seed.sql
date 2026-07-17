-- Global default categories (household_id = null).
-- REQUIRED: the app never finishes loading without them (hasCats check in ZmrzkoApp.js).
-- Values are 1:1 from the CATS constant in components/ZmrzkoApp.js.

insert into public.categories (id, household_id, label, icon, color, months) values
  ('perutnina',    null, 'Perutnina',        '🐔', '#EA580C', 9),
  ('goveje',       null, 'Goveje',           '🥩', '#B91C1C', 12),
  ('svinjsko',     null, 'Svinjsko',         '🥓', '#BE123C', 6),
  ('riba',         null, 'Riba',             '🐟', '#0284C7', 6),
  ('zelenjava',    null, 'Zelenjava',        '🥦', '#16A34A', 12),
  ('sadje',        null, 'Sadje',            '🍓', '#9333EA', 12),
  ('pripravljena', null, 'Pripravljena jed', '🍲', '#D97706', 3),
  ('pecivo',       null, 'Pecivo',           '🍞', '#B45309', 6),
  ('psi',          null, 'Za psa',           '🐕', '#7C3AED', 6),
  ('drugo',        null, 'Drugo',            '❄️', '#78716C', 6)
on conflict (id) do nothing;
