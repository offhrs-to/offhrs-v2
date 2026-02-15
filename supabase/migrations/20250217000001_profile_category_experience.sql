-- Per-category experience level and points so users can level up each category separately.
-- Instructor categories are not stored here (they use profiles.instructor_categories and have no progression).

CREATE TABLE IF NOT EXISTS public.profile_category_experience (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  expertise_level TEXT NOT NULL DEFAULT 'Novice' CHECK (expertise_level IN ('Novice', 'Intermediate', 'Advanced', 'Expert', 'Master')),
  experience_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_profile_category_experience_user_id ON public.profile_category_experience(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_category_experience_category ON public.profile_category_experience(category);

ALTER TABLE public.profile_category_experience ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own category experience"
  ON public.profile_category_experience FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own category experience"
  ON public.profile_category_experience FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own category experience"
  ON public.profile_category_experience FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own category experience"
  ON public.profile_category_experience FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.profile_category_experience IS 'Per-category expertise level and experience points; used for onboarding and leveling up each category.';
