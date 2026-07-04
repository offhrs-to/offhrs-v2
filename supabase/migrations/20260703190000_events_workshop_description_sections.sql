-- Optional collapsible workshop description sections (ClassEasily-style).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS workshop_experience text,
  ADD COLUMN IF NOT EXISTS workshop_experience_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS workshop_materials_takeaway text,
  ADD COLUMN IF NOT EXISTS workshop_materials_takeaway_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS workshop_skill_level text,
  ADD COLUMN IF NOT EXISTS workshop_skill_level_hidden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.workshop_experience IS 'Step-by-step workshop flow shown in mobile quickview accordion.';
COMMENT ON COLUMN public.events.workshop_materials_takeaway IS 'Materials provided and takeaways shown in mobile quickview accordion.';
COMMENT ON COLUMN public.events.workshop_skill_level IS 'Skill / prior knowledge requirements shown in mobile quickview accordion.';
