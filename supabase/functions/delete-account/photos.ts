type PhotoCleanup = {
  freeze: (user: string) => Promise<boolean>;
  list: (user: string) => Promise<string[] | null>;
  remove: (paths: string[]) => Promise<boolean>;
};
export async function clearProfilePhotos(user: string, deps: PhotoCleanup): Promise<boolean> {
  try {
    if (!await deps.freeze(user)) return false;
    for (let batch = 0; batch < 100; batch++) {
      const names = await deps.list(user);
      if (!names || names.length > 100 || names.some(name => !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.jpg$/i.test(name))) return false;
      if (!names.length) return true;
      if (!await deps.remove(names.map(name => `${user}/${name}`))) return false;
    }
  } catch { return false; }
  return false;
}
