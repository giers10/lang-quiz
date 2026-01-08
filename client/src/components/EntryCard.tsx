import { Link } from 'react-router-dom';
import type { EntrySummary } from '../types';

interface Props {
  entry: EntrySummary;
}

export default function EntryCard({ entry }: Props) {
  const learnLink = `/entry/${encodeURIComponent(entry.id)}`;
  const quizLink = `/quiz?mode=entry&id=${encodeURIComponent(entry.id)}`;

  return (
    <div className="entry-card">
      <div className="entry-card__title">{entry.title}</div>
      <div className="entry-card__actions">
        <Link className="button button--ghost" to={learnLink}>
          Learn
        </Link>
        <Link className="button" to={quizLink}>
          Quiz
        </Link>
      </div>
    </div>
  );
}
