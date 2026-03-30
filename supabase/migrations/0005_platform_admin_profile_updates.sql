create policy "Platform admins can update profiles" on public.profiles for update using (
  public.is_platform_admin()
) with check (
  public.is_platform_admin()
);
