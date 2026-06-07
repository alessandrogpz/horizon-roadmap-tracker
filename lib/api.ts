export const fetchAppState = async () => {
  const res = await fetch('/api/data', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch data');
  return res.json();
};

export const updateAppState = async (newState: any) => {
  const res = await fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newState),
  });
  if (!res.ok) throw new Error('Failed to update data');
  return res.json();
};

export const openLinkOnSystem = async (link: string) => {
  const res = await fetch('/api/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ link }),
  });
  if (!res.ok) throw new Error('Failed to open link');
  return res.json();
};
export const fetchGitStats = async (path: string) => {
  const res = await fetch(`/api/git?path=${encodeURIComponent(path)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch Git stats');
  return res.json();
};

export const fetchNotes = async (id: string) => {
  const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch notes');
  return res.json();
};

export const saveNotes = async (id: string, content: string) => {
  const res = await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, content }),
  });
  if (!res.ok) throw new Error('Failed to save notes');
  return res.json();
};

export const syncWorkspace = async () => {
  const res = await fetch('/api/sync', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to sync workspace');
  return res.json();
};

export const fetchReflection = async (week: number) => {
  const res = await fetch(`/api/reflection?week=${week}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch reflection');
  return res.json();
};

export const saveReflection = async (week: number, date: string, content: string) => {
  const res = await fetch('/api/reflection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ week, date, content }),
  });
  if (!res.ok) throw new Error('Failed to save reflection');
  return res.json();
};

