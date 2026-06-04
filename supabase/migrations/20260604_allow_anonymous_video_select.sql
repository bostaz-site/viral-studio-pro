-- Allow anonymous users to SELECT videos where user_id IS NULL (TikTok demo)
DROP POLICY IF EXISTS "Users can view own videos" ON public.videos;
CREATE POLICY "Users can view own videos or anonymous" ON public.videos
FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Allow reading anonymous uploads from storage (path starts with 'anonymous/')
CREATE POLICY "Public read for anonymous videos" ON storage.objects
FOR SELECT USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = 'anonymous');
