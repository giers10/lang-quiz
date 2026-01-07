import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchEntry } from '../api';
import VideoPlayer from '../components/VideoPlayer';
import { ConversationPanel, GrammarPanel, KeyPhrasePanel, VocabPanel } from '../components/ItemPanels';
import ExpandableText from '../components/ExpandableText';
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
  const profileUrl = ig?.profile_url || (ig?.username ? `https://www.instagram.com/${ig.username}/` : undefined);
  let postDate: string | undefined;
  if (ig?.post_date) {
    const parsed = new Date(ig.post_date);
    postDate = isNaN(parsed.getTime()) ? ig.post_date : parsed.toLocaleString();
  }

  return (
    <div className="entry-page">
      <div className="crumbs">
        <button className="button button--ghost" onClick={() => navigate(-1)}>← Back</button>
      </div>
      <div className="page-header">
        <div>
          <h1>{entry.title}</h1>
        </div>
      </div>

      <div className="video-row">
        <VideoPlayer src={entry.video_url} variant="compact" quizLink={quizLink} />
      </div>
      {ig && (
        <div className="ig-block">
          {ig.profile_pic_url ? (
            <a href={profileUrl || '#'} target="_blank" rel="noreferrer">
              <img
                className="ig-avatar"
                src={`/api/profile-pic?id=${encodeURIComponent(entry.id)}`}
                alt={ig.username || 'profile'}
                onError={(e) => {
                  if (ig.profile_pic_url && !e.currentTarget.dataset.fallback) {
                    e.currentTarget.dataset.fallback = '1';
                    e.currentTarget.src = ig.profile_pic_url;
                  }
                }}
              />
            </a>
          ) : (
            <div className="ig-avatar placeholder" />
          )}
            <div className="ig-body">
              <div className="ig-row">
                {ig.username ? (
                  <a className="ig-name" href={profileUrl || '#'} target="_blank" rel="noreferrer">
                    {ig.username}
                </a>
              ) : (
                <span className="ig-name">Instagram</span>
              )}
              {ig.full_name && <span className="muted"> · {ig.full_name}</span>}
            </div>
            <div className="muted">{postDate || ig.post_date || 'Date unknown'}</div>
            {ig.description && (
              <ExpandableText text={ig.description} />
            )}
          </div>
        </div>
      )}

      <GrammarPanel items={entry.items?.grammar} />
      <VocabPanel items={entry.items?.vocab} />
      <KeyPhrasePanel items={entry.items?.key_phrases} />
      <ConversationPanel items={entry.items?.conversation} />
    </div>
  );
}
