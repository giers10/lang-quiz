import type { EntryDetail, EntryItems, EntrySummary } from './types';

const entryCache = new Map<string, EntryDetail>();

function normalizeItems(items: Partial<EntryItems> | undefined): EntryItems {
  return {
    grammar: Array.isArray(items?.grammar) ? items.grammar : [],
    vocab: Array.isArray(items?.vocab) ? items.vocab : [],
    conversation: Array.isArray(items?.conversation) ? items.conversation : [],
    key_phrases: Array.isArray(items?.key_phrases) ? items.key_phrases : [],
  };
}

function normalizeDetail(payload: any): EntryDetail {
  const items = normalizeItems(payload?.items);
  const counts = payload?.counts || {
    grammar: items.grammar.length,
    vocab: items.vocab.length,
    key_phrases: items.key_phrases.length,
    conversation: items.conversation.length,
    quiz: Array.isArray(payload?.quiz) ? payload.quiz.length : 0,
  };

  return {
    id: String(payload?.id ?? ''),
    title: payload?.title || payload?.meta?.title_en || String(payload?.id ?? 'Untitled'),
    meta: payload?.meta || {},
    ig_meta: payload?.ig_meta,
    items,
    quiz: Array.isArray(payload?.quiz) ? payload.quiz : [],
    ui_hints: payload?.ui_hints || {},
    video_url: payload?.video_url || '',
    counts,
  };
}

export async function fetchEntries(): Promise<EntrySummary[]> {
  const response = await fetch('/api/entries');
  if (!response.ok) {
    throw new Error('Failed to load entries');
  }
  return response.json();
}

export async function fetchEntry(id: string): Promise<EntryDetail> {
  if (entryCache.has(id)) {
    return entryCache.get(id)!;
  }

  const response = await fetch(`/api/entry?id=${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new Error('Failed to load entry');
  }
  const payload = await response.json();
  const detail = normalizeDetail(payload);
  entryCache.set(id, detail);
  return detail;
}
