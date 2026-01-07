import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchEntry } from '../api';
import VideoPlayer from '../components/VideoPlayer';
import { ConversationPanel, GrammarPanel, KeyPhrasePanel, VocabPanel } from '../components/ItemPanels';
import type { EntryDetail } from '../types';

export default function EntryPage() {
  const { idEncoded } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const entryId = useMemo(() => {
    try {
      return decodeURIComponent(idEncoded || '');
    } catch {
      return idEncoded || '';
    }
  }, [idEncoded]);

  useEffect(() => {
    if (!entryId) return;
    setLoading(true);
    fetchEntry(entryId)
      .then((data) => setEntry(data))
      .catch(() => setError('Entry not found'))
      .finally(() => setLoading(false));
  }, [entryId]);

  if (!entryId) {
    return <div className="error">No entry id provided.</div>;
  }

  if (loading) return <div className="loading">Loading entry…</div>;
  if (error || !entry) return <div className="error">{error || 'Entry not found.'}</div>;

  const counts = entry.counts || { grammar: 0, vocab: 0, key_phrases: 0, conversation: 0, quiz: 0 };
  const quizLink = `/quiz?mode=entry&id=${encodeURIComponent(entry.id)}`;

  return (
    <div className="entry-page">
      <div className="crumbs">
        <button className="button button--ghost" onClick={() => navigate(-1)}>← Back</button>
      </div>
      <div className="page-header">
        <div>
          <p className="eyebrow">{entry.meta?.mode || 'mode not set'}</p>
          <h1>{entry.title}</h1>
          <p className="muted">{entry.meta?.type}</p>
          <div className="chips">
            <span className="pill">Grammar {counts.grammar}</span>
            <span className="pill">Vocab {counts.vocab}</span>
            <span className="pill">Phrases {counts.key_phrases}</span>
            <span className="pill">Conversation {counts.conversation}</span>
            <span className="pill pill--accent">Quiz {counts.quiz}</span>
          </div>
        </div>
        <div className="actions">
          <Link className="button" to={quizLink}>Start quiz (this entry)</Link>
        </div>
      </div>

      <VideoPlayer src={entry.video_url} />

      <div className="meta-box">
        <div>
          <div className="label">Mode</div>
          <div>{entry.meta?.mode || 'n/a'}</div>
        </div>
        <div>
          <div className="label">Type</div>
          <div>{entry.meta?.type || 'n/a'}</div>
        </div>
        <div>
          <div className="label">Entry ID</div>
          <div className="muted code">{entry.id}</div>
        </div>
      </div>

      <GrammarPanel items={entry.items?.grammar} />
      <VocabPanel items={entry.items?.vocab} />
      <KeyPhrasePanel items={entry.items?.key_phrases} />
      <ConversationPanel items={entry.items?.conversation} />
    </div>
  );
}
