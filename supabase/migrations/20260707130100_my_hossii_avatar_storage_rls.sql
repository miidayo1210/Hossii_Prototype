-- Phase 5: マイHossiiアバター画像の Storage RLS（本人の avatars/{uid}/ 配下のみ書き込み可）
-- 既存の広い authenticated ポリシーは維持し、avatars パス用の追加制約を設ける

DROP POLICY IF EXISTS "owner upload my hossii avatar" ON storage.objects;
DROP POLICY IF EXISTS "owner update my hossii avatar" ON storage.objects;
DROP POLICY IF EXISTS "owner delete my hossii avatar" ON storage.objects;

CREATE POLICY "owner upload my hossii avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'hossii-images'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "owner update my hossii avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'hossii-images'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "owner delete my hossii avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'hossii-images'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
