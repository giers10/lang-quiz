import { useEffect, useState } from 'react';
import EntryCard from '../components/EntryCard';
import { fetchEntries } from '../api';
import type { EntrySummary } from '../types';

export default function OverviewPage() {
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEntries()
      .then((data) => setEntries(data))
      .catch(() => setError('Could not load entries'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading entries…</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Choose a reel to study</h1>
          <p className="muted">Each card bundles grammar, vocab, phrases, and quizzes pulled from your local data folder.</p>
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="error">No entries detected in data/. Add mp4 + json pairs and restart the server.</div>
      ) : (
        <div className="grid">
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
