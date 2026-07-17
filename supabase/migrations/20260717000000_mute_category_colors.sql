-- UI redesign: mute the global category colors one Tailwind step darker so
-- text-(--cat) stays readable on the new cream (stone-100) page background.
-- Only global defaults (household_id is null) are touched; user-created
-- categories keep whatever color they were given.

update public.categories
set color = case id
  when 'perutnina'    then '#EA580C'
  when 'goveje'       then '#B91C1C'
  when 'svinjsko'     then '#BE123C'
  when 'riba'         then '#0284C7'
  when 'zelenjava'    then '#16A34A'
  when 'sadje'        then '#9333EA'
  when 'pripravljena' then '#D97706'
  when 'pecivo'       then '#B45309'
  when 'psi'          then '#7C3AED'
  when 'drugo'        then '#78716C'
  else color
end
where household_id is null;
