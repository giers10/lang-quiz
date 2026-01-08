import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchEntries } from '../api';
import type { EntrySummary } from '../types';

export default function RandomEntryRedirect() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const entries: EntrySummary[] = await fetchEntries();
        if (!entries.length) {
          throw new Error('No entries available');
        }
        const idx = Math.floor(Math.random() * entries.length);
        const entry = entries[idx];
        if (!cancelled) {
          navigate(`/entry/${encodeURIComponent(entry.id)}${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Could not pick a random entry');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [navigate, params]);

  if (loading) return <div className="loading">Picking a random reel…</div>;
  if (error) return <div className="error">{error}</div>;
  return null;
}
