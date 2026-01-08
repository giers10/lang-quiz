export interface ExampleBlock {
  jp?: string;
  kana?: string;
  en?: string;
}

export interface BaseItem {
  id?: string;
  jp?: string;
  kana?: string;
  meaning_en?: string;
  meaning?: string;
  use_note_en?: string;
  when_to_use_en?: string;
  register?: string;
  note_en?: string;
  example?: ExampleBlock;
  example_jp?: string;
  example_kana?: string;
  example_en?: string;
}

export interface GrammarItem extends BaseItem {
  pattern?: string;
}

export interface VocabItem extends BaseItem {}

export interface ConversationItem extends BaseItem {
  en?: string;
}

export interface KeyPhraseItem extends BaseItem {}

export interface EntryItems {
  grammar: GrammarItem[];
  vocab: VocabItem[];
  conversation: ConversationItem[];
  key_phrases: KeyPhraseItem[];
}

export interface EntryCounts {
  grammar: number;
  vocab: number;
  key_phrases: number;
  conversation: number;
  quiz: number;
}

export interface EntrySummary {
  id: string;
  title: string;
  mode?: string;
  type?: string;
  counts: EntryCounts;
  video_url: string;
}

export interface EntryDetail {
  id: string;
  title: string;
  meta?: {
    mode?: string;
    type?: string;
    title_en?: string;
  };
  ig_meta?: InstagramMeta;
  items: EntryItems;
  quiz: QuizQuestion[];
  ui_hints?: {
    recommended_order?: (string | number)[];
    show_first?: string;
    explain_on_fail?: boolean;
  };
  video_url: string;
  counts: EntryCounts;
}

export interface QuizQuestion {
  id?: string | number;
  targets?: (string | number)[];
  type?: string;
  prompt_en?: string;
  payload?: Record<string, any>;
  answer?: Record<string, any>;
}

export interface QuizQuestionWithEntry extends QuizQuestion {
  entryId: string;
  entryTitle: string;
  items: EntryItems;
  video_url: string;
  ig_meta?: InstagramMeta;
}

export interface InstagramMeta {
  username?: string;
  full_name?: string;
  profile_pic_url?: string;
  post_url?: string;
  profile_url?: string;
  post_date?: string;
  description?: string;
}
