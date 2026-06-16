-- Remove first-party daily unique visitor tracking (replaced by Meta Pixel / external analytics).
DROP TABLE IF EXISTS public.daily_visits;
