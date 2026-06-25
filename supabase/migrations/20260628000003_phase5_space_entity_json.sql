ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS decorations jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS character_image_url text,
  ADD COLUMN IF NOT EXISTS custom_emotions jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bubble_shape_png text;
