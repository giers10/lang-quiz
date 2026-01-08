import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchEntry } from '../api';
import VideoPlayer from '../components/VideoPlayer';
import { ConversationPanel, GrammarPanel, KeyPhrasePanel, VocabPanel } from '../components/ItemPanels';
import IgMetaBlock from '../components/IgMetaBlock';
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

  const quizLink = `/quiz?mode=entry&id=${encodeURIComponent(entry.id)}`;
  const ig = entry.ig_meta;

  return (
    <div className="entry-page">
      <div className="crumbs row-between">
        <button className="button button--ghost" onClick={() => navigate(-1)}>← Back</button>
      </div>
      <div className="page-header">
        <div>
          <h1>{entry.title}</h1>
        </div>
      </div>

      <div className="video-row">
        <VideoPlayer src={entry.video_url} variant="compact" quizLink={quizLink} />
        <div className="video-cta">
          <button className="button button--primary" onClick={() => navigate(quizLink)}>
            Start quiz
          </button>
        </div>
      </div>
      {ig && <IgMetaBlock ig={ig} entryId={entry.id} />}

      <GrammarPanel items={entry.items?.grammar} />
      <VocabPanel items={entry.items?.vocab} />
      <KeyPhrasePanel items={entry.items?.key_phrases} />
      <ConversationPanel items={entry.items?.conversation} />
    </div>
  );
}
