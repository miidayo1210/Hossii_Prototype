-- Hotfix: Storage INSERT policy "hossii-images insert" had WITH CHECK (true),
-- which permitted inserts into every bucket (including challenge-photos).
-- Replace with an hossii-images-only WITH CHECK. Minimal change only.

DROP POLICY IF EXISTS "hossii-images insert" ON storage.objects;

CREATE POLICY "hossii-images insert"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'hossii-images');

COMMENT ON POLICY "hossii-images insert" ON storage.objects IS
  'Hotfix: INSERT limited to hossii-images bucket (was WITH CHECK true).';
