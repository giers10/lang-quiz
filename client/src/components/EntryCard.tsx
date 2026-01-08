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
      <div className="entry-card__content">
        <div className="entry-card__title">{entry.title}</div>
      </div>
      <div className="entry-card__actions inline">
        <Link className="entry-link" to={learnLink}>
          Learn &raquo;
        </Link>
        <Link className="entry-link" to={quizLink}>
          Quiz &raquo;
        </Link>
      </div>
    </div>
  );
}
