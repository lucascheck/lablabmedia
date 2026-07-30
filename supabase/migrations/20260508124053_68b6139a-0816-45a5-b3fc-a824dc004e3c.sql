
create table public.post_frases (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null,
  title text not null default 'Post frase',
  image_path text not null,
  created_at timestamptz not null default now()
);
alter table public.post_frases enable row level security;
create policy "own post_frases select" on public.post_frases for select using (auth.uid() = user_id);
create policy "own post_frases insert" on public.post_frases for insert with check (auth.uid() = user_id);
create policy "own post_frases delete" on public.post_frases for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('post-frases', 'post-frases', false) on conflict (id) do nothing;

create policy "own post_frases storage select" on storage.objects for select using (bucket_id = 'post-frases' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own post_frases storage insert" on storage.objects for insert with check (bucket_id = 'post-frases' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own post_frases storage delete" on storage.objects for delete using (bucket_id = 'post-frases' and auth.uid()::text = (storage.foldername(name))[1]);
