import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { glob } from 'glob';
import { z } from 'zod';

const DEFAULT_DATA_ROOT = path.resolve(__dirname, '..', '..', 'data');
const DATA_ROOT = process.env.DATA_ROOT ? path.resolve(process.env.DATA_ROOT) : DEFAULT_DATA_ROOT;

const metaSchema = z
  .object({
    mode: z.string().optional(),
    type: z.string().optional(),
    title_en: z.string().optional(),
  })
  .partial()
  .default({});

const itemsSchema = z
  .object({
    grammar: z.array(z.record(z.any())).default([]),
    vocab: z.array(z.record(z.any())).default([]),
    conversation: z.array(z.record(z.any())).default([]),
    key_phrases: z.array(z.record(z.any())).default([]),
  })
  .partial()
  .default({
    grammar: [],
    vocab: [],
    conversation: [],
    key_phrases: [],
  });

const quizSchema = z
  .array(
    z
      .object({
        id: z.union([z.string(), z.number()]).optional(),
        targets: z.array(z.union([z.string(), z.number()])).default([]),
        type: z.string().default(''),
        prompt_en: z.string().optional(),
        payload: z.record(z.any()).default({}),
        answer: z.record(z.any()).default({}),
      })
      .partial()
  )
  .default([]);

const uiHintsSchema = z
  .object({
    recommended_order: z.array(z.union([z.string(), z.number()])).default([]),
    show_first: z.string().optional(),
    explain_on_fail: z.boolean().optional(),
  })
  .partial()
  .default({ recommended_order: [] });

const entrySchema = z
  .object({
    meta: metaSchema,
    items: itemsSchema,
    quiz: quizSchema,
    ui_hints: uiHintsSchema,
  })
  .partial()
  .passthrough()
  .default({
    meta: {},
    items: { grammar: [], vocab: [], conversation: [], key_phrases: [] },
    quiz: [],
    ui_hints: { recommended_order: [] },
  });

type EntryData = z.infer<typeof entrySchema>;

interface EntryRecord {
  id: string;
  title: string;
  meta: EntryData['meta'];
  items: EntryData['items'];
  quiz: EntryData['quiz'];
  ui_hints: EntryData['ui_hints'];
  igMeta?: {
    username?: string;
    full_name?: string;
    profile_pic_url?: string;
    post_url?: string;
    profile_url?: string;
    post_date?: string;
    description?: string;
  };
  videoPath: string;
  jsonPath: string;
  video_url: string;
  counts: {
    grammar: number;
    vocab: number;
    key_phrases: number;
    conversation: number;
    quiz: number;
  };
}

const entryIndex = new Map<string, EntryRecord>();

function ensureWithinDataRoot(targetPath: string) {
  const resolved = path.resolve(targetPath);
  return resolved === DATA_ROOT || resolved.startsWith(DATA_ROOT + path.sep);
}

async function fileExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function toPosixId(relativePath: string) {
  return relativePath.split(path.sep).join('/');
}

function buildVideoUrl(id: string) {
  const encoded = id
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `/data/${encoded}.mp4`;
}

function computeCounts(items: EntryData['items'], quiz: EntryData['quiz']) {
  return {
    grammar: items?.grammar?.length || 0,
    vocab: items?.vocab?.length || 0,
    key_phrases: items?.key_phrases?.length || 0,
    conversation: items?.conversation?.length || 0,
    quiz: quiz?.length || 0,
  };
}

function extractIgMeta(raw: any): EntryRecord['igMeta'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const username = raw.username || raw.owner?.username;
  const full_name = raw.fullname || raw.full_name || raw.owner?.full_name;
  const post_url = raw.post_url || raw.postUrl || raw.permalink;
  const profile_pic_url =
    raw.profile_pic_url ||
    raw.owner?.hd_profile_pic_url_info?.url ||
    raw.owner?.profile_pic_url ||
    raw.owner?.profile_pic_url_info?.url;
  const post_date = raw.post_date || raw.date || raw.taken_at_timestamp || raw.timestamp;
  const description = raw.description || raw.caption;
  const profile_url = username ? `https://www.instagram.com/${username}/` : undefined;

  if (!username && !profile_pic_url && !post_date && !description) return undefined;
  return {
    username,
    full_name,
    profile_pic_url,
    post_url,
    profile_url,
    post_date: post_date ? String(post_date) : undefined,
    description,
  };
}

function isAllowedProfileHost(urlString: string) {
  try {
    const { hostname } = new URL(urlString);
    const safeHosts = ['instagram.com', 'cdninstagram.com', 'fbcdn.net'];
    return safeHosts.some((h) => hostname.endsWith(h) || hostname.includes(`.${h}`));
  } catch {
    return false;
  }
}

async function loadEntries() {
  entryIndex.clear();

  const dataExists = await fileExists(DATA_ROOT);
  if (!dataExists) {
    console.warn(`Data root not found at ${DATA_ROOT}`);
    return;
  }

  const mp4Paths = await glob('**/*.mp4', { cwd: DATA_ROOT, absolute: true });
  for (const mp4Path of mp4Paths) {
    const resolvedMp4 = path.resolve(mp4Path);
    if (!ensureWithinDataRoot(resolvedMp4)) {
      continue;
    }

    const dir = path.dirname(resolvedMp4);
    const baseName = path.basename(resolvedMp4, '.mp4');
    const jsonPath = path.join(dir, `${baseName}.json`);
    const mp4MetaPath = path.join(dir, `${baseName}.mp4.json`);

    if (!(await fileExists(jsonPath))) {
      continue;
    }

    const resolvedJson = path.resolve(jsonPath);
    if (!ensureWithinDataRoot(resolvedJson)) {
      continue;
    }

    let igMeta: EntryRecord['igMeta'];
    const resolvedMp4Meta = path.resolve(mp4MetaPath);
    if (await fileExists(resolvedMp4Meta)) {
      if (ensureWithinDataRoot(resolvedMp4Meta)) {
        try {
          const raw = await fs.readFile(resolvedMp4Meta, 'utf-8');
          const json = JSON.parse(raw);
          igMeta = extractIgMeta(json);
        } catch (err) {
          console.warn(`Failed to parse mp4 metadata ${resolvedMp4Meta}:`, err);
        }
      }
    }

    let parsed: EntryData | null = null;
    try {
      const raw = await fs.readFile(resolvedJson, 'utf-8');
      const json = JSON.parse(raw);
      const safe = entrySchema.safeParse(json);
      parsed = safe.success ? safe.data : entrySchema.parse({});
      if (!safe.success) {
        console.warn(`Entry at ${resolvedJson} parsed with defaults due to validation issues.`);
      }
    } catch (err) {
      console.warn(`Failed to parse ${resolvedJson}:`, err);
      parsed = entrySchema.parse({});
    }

    const relative = path.relative(DATA_ROOT, resolvedMp4);
    const id = toPosixId(relative.replace(/\.mp4$/i, ''));
    const title = parsed.meta?.title_en?.trim() || baseName;
    const video_url = buildVideoUrl(id);
    const counts = computeCounts(parsed.items || { grammar: [], vocab: [], conversation: [], key_phrases: [] }, parsed.quiz || []);

    entryIndex.set(id, {
      id,
      title,
      meta: parsed.meta || {},
      items: parsed.items || { grammar: [], vocab: [], conversation: [], key_phrases: [] },
      quiz: parsed.quiz || [],
      ui_hints: parsed.ui_hints || { recommended_order: [] },
      igMeta,
      videoPath: resolvedMp4,
      jsonPath: resolvedJson,
      video_url,
      counts,
    });
  }

  console.log(`Loaded ${entryIndex.size} entries from data directory.`);
}

function sanitizeEntryResponse(entry: EntryRecord) {
  return {
    id: entry.id,
    title: entry.title,
    meta: entry.meta || {},
    items: entry.items || { grammar: [], vocab: [], conversation: [], key_phrases: [] },
    quiz: entry.quiz || [],
    ui_hints: entry.ui_hints || { recommended_order: [] },
    ig_meta: entry.igMeta,
    video_url: entry.video_url,
    counts: entry.counts,
  };
}

async function main() {
  await loadEntries();

  const app = express();
  const port = process.env.PORT || 5174;

  app.disable('x-powered-by');

  app.use('/data', express.static(DATA_ROOT));

  app.get('/', (_req, res) => {
    res.type('text/plain').send('IG Japanese Quizzer backend is running. See /api/entries.');
  });

  app.get('/api/entries', (_req, res) => {
    const entries = Array.from(entryIndex.values())
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        mode: entry.meta?.mode,
        type: entry.meta?.type,
        counts: entry.counts,
        video_url: entry.video_url,
      }))
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

    res.json(entries);
  });

  app.get('/api/entry', (req, res) => {
    const idParam = req.query.id;
    if (!idParam || typeof idParam !== 'string') {
      res.status(400).json({ error: 'Missing id query param' });
      return;
    }

    const entry = entryIndex.get(idParam);
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    res.json(sanitizeEntryResponse(entry));
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, entries: entryIndex.size });
  });

  app.get('/api/profile-pic', async (req, res) => {
    const idParam = req.query.id;
    if (!idParam || typeof idParam !== 'string') {
      res.status(400).json({ error: 'Missing id query param' });
      return;
    }

    const entry = entryIndex.get(idParam);
    const url = entry?.igMeta?.profile_pic_url;
    if (!entry || !url) {
      res.status(404).json({ error: 'Profile picture not found' });
      return;
    }

    if (!isAllowedProfileHost(url)) {
      res.status(400).json({ error: 'Profile host not permitted' });
      return;
    }

    try {
      const upstream = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (IG Japanese Quizzer)',
          Accept: 'image/*',
        },
        redirect: 'follow',
      });

      if (!upstream.ok) {
        res.status(upstream.status).json({ error: 'Failed to load image' });
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Length', buffer.length.toString());
      res.end(buffer);
    } catch (err) {
      console.error('Proxy profile-pic error', err);
      res.status(500).json({ error: 'Proxy failed' });
    }
  });

  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
    console.log(`Data root: ${DATA_ROOT}`);
    console.log(`Entries loaded: ${entryIndex.size}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
