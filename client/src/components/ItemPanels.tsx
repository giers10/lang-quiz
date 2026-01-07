import type { ConversationItem, GrammarItem, KeyPhraseItem, VocabItem } from '../types';

interface ItemProps<T> {
  items?: T[];
}

const renderExample = (item: any) => {
  const example = item.example || {};
  const hasExample = example.jp || example.en || example.kana || item.example_jp || item.example_en || item.example_kana;
  if (!hasExample) return null;
  return (
    <div className="item-row">
      <span className="label">Example</span>
      <div className="muted">
        {example.jp || item.example_jp}
        {example.kana || item.example_kana ? <div className="subline">{example.kana || item.example_kana}</div> : null}
        {example.en || item.example_en ? <div className="subline">{example.en || item.example_en}</div> : null}
      </div>
    </div>
  );
};

const renderNote = (item: any) => {
  const note = item.use_note_en || item.note_en || item.when_to_use_en;
  if (!note) return null;
  return (
    <div className="item-row">
      <span className="label">Usage</span>
      <div className="muted">{note}</div>
    </div>
  );
};

const renderRegister = (item: any) => {
  if (!item.register) return null;
  return (
    <div className="item-row">
      <span className="label">Register</span>
      <div className="pill pill--ghost">{item.register}</div>
    </div>
  );
};

export function GrammarPanel({ items }: ItemProps<GrammarItem>) {
  if (!items?.length) return null;
  return (
    <section className="panel">
      <header>
        <h3>Grammar</h3>
      </header>
      <div className="panel-grid">
        {items.map((item) => (
          <div key={item.id || item.pattern} className="panel-card">
            <div className="panel-card__title">{item.pattern || item.jp || item.id}</div>
            <div className="panel-card__body">
              {(item.meaning_en || item.meaning) && <div className="muted">{item.meaning_en || item.meaning}</div>}
              {renderRegister(item)}
              {renderNote(item)}
              {renderExample(item)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function VocabPanel({ items }: ItemProps<VocabItem>) {
  if (!items?.length) return null;
  return (
    <section className="panel">
      <header>
        <h3>Vocabulary</h3>
      </header>
      <div className="panel-grid">
        {items.map((item) => (
          <div key={item.id || item.jp} className="panel-card">
            <div className="panel-card__title">{item.jp || item.id}</div>
            {(item.kana || item.meaning_en || item.meaning) && (
              <div className="muted">
                {item.kana && <div className="subline">{item.kana}</div>}
                {(item.meaning_en || item.meaning) && <div className="subline">{item.meaning_en || item.meaning}</div>}
              </div>
            )}
            {renderRegister(item)}
            {renderNote(item)}
            {renderExample(item)}
          </div>
        ))}
      </div>
    </section>
  );
}

export function KeyPhrasePanel({ items }: ItemProps<KeyPhraseItem>) {
  if (!items?.length) return null;
  return (
    <section className="panel">
      <header>
        <h3>Key Phrases</h3>
      </header>
      <div className="panel-grid">
        {items.map((item) => (
          <div key={item.id || item.jp} className="panel-card">
            <div className="panel-card__title">{item.jp || item.id}</div>
            {(item.kana || item.meaning_en || item.meaning) && (
              <div className="muted">
                {item.kana && <div className="subline">{item.kana}</div>}
                {(item.meaning_en || item.meaning) && <div className="subline">{item.meaning_en || item.meaning}</div>}
              </div>
            )}
            {renderRegister(item)}
            {renderNote(item)}
            {renderExample(item)}
          </div>
        ))}
      </div>
    </section>
  );
}

export function ConversationPanel({ items }: ItemProps<ConversationItem>) {
  if (!items?.length) return null;
  return (
    <section className="panel">
      <header>
        <h3>Conversation</h3>
      </header>
      <div className="panel-grid">
        {items.map((item) => (
          <div key={item.id || item.jp} className="panel-card">
            <div className="panel-card__title">{item.jp || item.id}</div>
            {(item.kana || item.en) && (
              <div className="muted">
                {item.kana && <div className="subline">{item.kana}</div>}
                {item.en && <div className="subline">{item.en}</div>}
              </div>
            )}
            {renderRegister(item)}
            {renderNote(item)}
          </div>
        ))}
      </div>
    </section>
  );
}
