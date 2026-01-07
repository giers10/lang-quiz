import { Link } from 'react-router-dom';
import type { EntrySummary } from '../types';

interface Props {
  entry: EntrySummary;
}

export default function EntryCard({ entry }: Props) {
  const { counts } = entry;
  return (
    <Link to={`/entry/${encodeURIComponent(entry.id)}`} className="entry-card">
      <div className="entry-card__title">{entry.title}</div>
      <div className="entry-card__meta">
        <span className="pill">{entry.mode || 'mixed'}</span>
        {entry.type && <span className="pill pill--ghost">{entry.type}</span>}
      </div>
      <div className="entry-card__counts">
        <span>Grammar {counts.grammar}</span>
        <span>Vocab {counts.vocab}</span>
        <span>Phrases {counts.key_phrases}</span>
        <span>Conversation {counts.conversation}</span>
        <span>Quiz {counts.quiz}</span>
      </div>
    </Link>
  );
}
