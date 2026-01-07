import { useEffect, useMemo, useState } from 'react';
import { fetchEntries, fetchEntry } from '../api';
import type { EntryItems, EntrySummary, QuizQuestionWithEntry } from '../types';
import VideoPlayer from './VideoPlayer';

type Mode = 'all' | 'selected' | 'single';

const TOTAL_QUESTIONS = 10;

interface QuizRunnerProps {
  defaultMode?: Mode;
  defaultEntryId?: string;
}

interface TargetHit {
  group: string;
  item: Record<string, any>;
}

function shuffle<T>(list: T[]) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const normalize = (val: any) => (val === undefined || val === null ? '' : String(val).trim());

function resolveTargets(question: QuizQuestionWithEntry): TargetHit[] {
  const targetIds = new Set((question.targets || []).map((t) => normalize(t)));
  const groups: { label: string; items: any[] }[] = [
    { label: 'Grammar', items: question.items?.grammar || [] },
    { label: 'Vocabulary', items: question.items?.vocab || [] },
    { label: 'Key Phrases', items: question.items?.key_phrases || [] },
    { label: 'Conversation', items: question.items?.conversation || [] },
  ];

  const found: TargetHit[] = [];
  groups.forEach(({ label, items }) => {
    items.forEach((item) => {
      if (item?.id && targetIds.has(normalize(item.id))) {
        found.push({ group: label, item });
      }
    });
  });

  return found;
}

function deriveCorrectText(question: QuizQuestionWithEntry) {
  const options: any[] = Array.isArray(question.payload?.options) ? question.payload?.options : [];
  if (typeof question.answer?.correct_index === 'number' && options[question.answer.correct_index]) {
    return options[question.answer.correct_index];
  }
  if (question.answer?.correct_text) return question.answer.correct_text;
  if (question.payload?.blanked) return question.payload.blanked;
  const pairs = Array.isArray(question.payload?.pairs) ? question.payload.pairs : [];
  if (pairs.length) {
    return pairs.map((p: any) => `${p.left} → ${p.right}`).join(' | ');
  }
  return '';
}

function checkClozeAnswer(question: QuizQuestionWithEntry, response: string) {
  if (!response) return false;
  const expected = [question.answer?.correct_text, question.answer?.correct, question.payload?.blanked].filter(Boolean).map(normalize);
  const answer = normalize(response);
  return expected.some((val) => val === answer || val.toLowerCase() === answer.toLowerCase());
}

function checkMatchAnswer(question: QuizQuestionWithEntry, response: Record<number, string> | null) {
  const pairs: any[] = Array.isArray(question.payload?.pairs) ? question.payload.pairs : [];
  if (!pairs.length) return false;
  return pairs.every((pair, idx) => {
    const expected = normalize(pair.right);
    const user = normalize(response?.[idx]);
    return expected === user;
  });
}

function checkMcAnswer(question: QuizQuestionWithEntry, response: number | null) {
  if (typeof response !== 'number') return false;
  if (typeof question.answer?.correct_index !== 'number') return false;
  return response === question.answer.correct_index;
}

function QuestionRenderer({
  question,
  response,
  onChange,
}: {
  question: QuizQuestionWithEntry;
  response: any;
  onChange: (val: any) => void;
}) {
  const payload = question.payload || {};
  const type = question.type || '';

  if (type === 'cloze') {
    const sentence = payload.sentence_jp || payload.sentence || '';
    return (
      <div className="question-block">
        {sentence && <div className="muted">{sentence.replace(payload.blanked || '', '____')}</div>}
        <input
          className="input"
          type="text"
          placeholder="Type the missing text"
          value={response || ''}
          onChange={(e) => onChange(e.target.value)}
        />
        {Array.isArray(payload.options) && payload.options.length > 0 && (
          <div className="option-hints">Hints: {payload.options.join(' • ')}</div>
        )}
      </div>
    );
  }

  if (type === 'match') {
    const pairs: any[] = Array.isArray(payload.pairs) ? payload.pairs : [];
    const rightOptions = useMemo(
      () => shuffle(pairs.map((p) => p.right).filter(Boolean)),
      [question.id, question.entryId]
    );
    return (
      <div className="question-block matches">
        {pairs.map((pair, idx) => (
          <div key={idx} className="match-row">
            <div className="match-left">{pair.left}</div>
            <select
              className="input"
              value={response?.[idx] || ''}
              onChange={(e) => {
                const current = response && typeof response === 'object' ? response : {};
                onChange({ ...current, [idx]: e.target.value });
              }}
            >
              <option value="">Match…</option>
              {rightOptions.map((opt, optionIdx) => (
                <option key={optionIdx} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  }

  const options: any[] = Array.isArray(payload.options) ? payload.options : [];
  if (!options.length) {
    return <div className="muted">No options provided for this question.</div>;
  }
  return (
    <div className="question-block">
      {options.map((option, idx) => (
        <label key={idx} className="option">
          <input
            type="radio"
            checked={response === idx}
            onChange={() => onChange(idx)}
            name={`q-${question.id}`}
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

function ExplanationPanel({ question, targets }: { question: QuizQuestionWithEntry; targets: TargetHit[] }) {
  return (
    <div className="explanation">
      <h4>Explanation</h4>
      {targets.length ? (
        <div className="explanation-grid">
          {targets.map(({ group, item }) => (
            <div key={`${group}-${item.id || item.jp}`} className="panel-card">
              <div className="panel-card__title">{item.jp || item.pattern || item.id}</div>
              <div className="muted">{item.meaning_en || item.en || item.when_to_use_en}</div>
              {item.use_note_en && <div className="subline">{item.use_note_en}</div>}
              {item.register && <span className="pill pill--ghost">{item.register}</span>}
              <div className="tag">{group}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No linked study items were found for this question.</p>
      )}
      <VideoPlayer src={question.video_url} />
    </div>
  );
}

export default function QuizRunner({ defaultMode = 'all', defaultEntryId }: QuizRunnerProps) {
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultEntryId ? [defaultEntryId] : []);
  const [questions, setQuestions] = useState<QuizQuestionWithEntry[]>([]);
  const [status, setStatus] = useState<'setup' | 'loading' | 'running' | 'finished'>('setup');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [response, setResponse] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingEntries(true);
    fetchEntries()
      .then((data) => setEntries(data))
      .catch(() => setError('Could not load entries.'))
      .finally(() => setLoadingEntries(false));
  }, []);

  useEffect(() => {
    if (defaultEntryId) {
      setMode('single');
      setSelectedIds([defaultEntryId]);
    }
  }, [defaultEntryId]);

  const currentQuestion = useMemo(() => questions[currentIndex], [questions, currentIndex]);

  const resetQuestionState = () => {
    setResponse(null);
    setShowResult(false);
    setLastCorrect(false);
  };

  const startQuiz = async () => {
    const ids: string[] =
      mode === 'all'
        ? entries.map((e) => e.id)
        : mode === 'selected'
        ? selectedIds
        : selectedIds.slice(0, 1);

    if (!ids.length) {
      setError('Pick at least one entry to quiz on.');
      return;
    }

    setError(null);
    setStatus('loading');

    try {
      const uniqueIds = Array.from(new Set(ids));
      const details = await Promise.all(uniqueIds.map((id) => fetchEntry(id)));
      const pool: QuizQuestionWithEntry[] = details.flatMap((entry) => {
        const safeItems: EntryItems = entry.items || { grammar: [], vocab: [], conversation: [], key_phrases: [] };
        return (entry.quiz || []).map((q) => ({
          ...q,
          entryId: entry.id,
          entryTitle: entry.title,
          items: safeItems,
          video_url: entry.video_url,
          targets: q.targets || [],
          type: q.type || 'unknown',
          payload: q.payload || {},
          answer: q.answer || {},
        }));
      });

      if (!pool.length) {
        setError('No quiz questions found in the selected entries.');
        setStatus('setup');
        return;
      }

      const chosen = shuffle(pool).slice(0, Math.min(TOTAL_QUESTIONS, pool.length));
      setQuestions(chosen);
      setCurrentIndex(0);
      setScore(0);
      resetQuestionState();
      setStatus('running');
    } catch (err: any) {
      setError(err?.message || 'Could not start quiz.');
      setStatus('setup');
    }
  };

  const handleSubmit = (skip = false) => {
    if (!currentQuestion || showResult) return;
    let correct = false;
    if (!skip) {
      if ((currentQuestion.type || '').startsWith('mc') || currentQuestion.type === 'choose_best_reply') {
        correct = checkMcAnswer(currentQuestion, response);
      } else if (currentQuestion.type === 'cloze') {
        correct = checkClozeAnswer(currentQuestion, response);
      } else if (currentQuestion.type === 'match') {
        correct = checkMatchAnswer(currentQuestion, response);
      } else if (typeof currentQuestion.answer?.correct_index === 'number') {
        correct = checkMcAnswer(currentQuestion, response);
      }
    }

    if (correct) {
      setScore((s) => s + 1);
    }
    setLastCorrect(correct);
    setShowResult(true);
  };

  const goNext = () => {
    if (currentIndex + 1 >= questions.length) {
      setStatus('finished');
    } else {
      setCurrentIndex((idx) => idx + 1);
      resetQuestionState();
    }
  };

  if (loadingEntries) {
    return <div className="loading">Loading quiz setup…</div>;
  }

  if (status === 'setup') {
    return (
      <div className="quiz-setup">
        <div className="page-header">
          <div>
            <p className="eyebrow">Quiz Wizard</p>
            <h1>Pick a mode</h1>
            <p className="muted">Build a 10-question run from all entries, a custom set, or a single reel.</p>
          </div>
        </div>

        <div className="mode-switch">
          <button className={mode === 'all' ? 'button button--solid' : 'button'} onClick={() => setMode('all')}>
            Mode A · All entries
          </button>
          <button className={mode === 'selected' ? 'button button--solid' : 'button'} onClick={() => setMode('selected')}>
            Mode B · Select entries
          </button>
          <button className={mode === 'single' ? 'button button--solid' : 'button'} onClick={() => setMode('single')}>
            Mode C · Single entry
          </button>
        </div>

        {mode === 'selected' && (
          <div className="selector">
            <p className="muted">Check the entries you want in the pool.</p>
            <div className="selector-grid">
              {entries.map((entry) => (
                <label key={entry.id} className="selector-row">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(entry.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds((prev) => [...prev, entry.id]);
                      } else {
                        setSelectedIds((prev) => prev.filter((id) => id !== entry.id));
                      }
                    }}
                  />
                  <span>{entry.title}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {mode === 'single' && (
          <div className="selector">
            <p className="muted">Pick the entry to drill.</p>
            <select
              className="input"
              value={selectedIds[0] || ''}
              onChange={(e) => setSelectedIds(e.target.value ? [e.target.value] : [])}
            >
              <option value="">Select an entry…</option>
              {entries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <button className="button button--primary" onClick={startQuiz}>
          Start quiz
        </button>
      </div>
    );
  }

  if (status === 'loading') {
    return <div className="loading">Building your quiz…</div>;
  }

  if (status === 'finished') {
    return (
      <div className="quiz-finished">
        <h2>Nice work!</h2>
        <p className="muted">You scored {score} out of {questions.length}.</p>
        <div className="actions">
          <button className="button" onClick={() => setStatus('setup')}>
            Play again
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return <div className="error">No questions available.</div>;
  }

  const targets = resolveTargets(currentQuestion);
  const correctText = deriveCorrectText(currentQuestion);

  return (
    <div className="quiz-runner">
      <div className="quiz-top">
        <div>
          <p className="eyebrow">{currentQuestion.entryTitle}</p>
          <h2>{currentQuestion.prompt_en || 'Answer the prompt'}</h2>
        </div>
        <div className="score-box">
          <div className="muted">{currentIndex + 1} / {questions.length}</div>
          <div className="score">Score: {score}</div>
        </div>
      </div>

      <QuestionRenderer question={currentQuestion} response={response} onChange={setResponse} />

      {showResult && (
        <div className={lastCorrect ? 'callout success' : 'callout'}>
          {lastCorrect ? 'Correct!' : 'Not quite.'}
          {!lastCorrect && correctText && <div className="subline">Answer: {correctText}</div>}
        </div>
      )}

      <div className="quiz-actions">
        {!showResult && (
          <>
            <button className="button" onClick={() => handleSubmit(false)}>
              Submit
            </button>
            <button className="button button--ghost" onClick={() => handleSubmit(true)}>
              Don’t know
            </button>
          </>
        )}
        {showResult && (
          <button className="button button--primary" onClick={goNext}>
            {currentIndex + 1 === questions.length ? 'Finish' : 'Next'}
          </button>
        )}
      </div>

      {showResult && !lastCorrect && <ExplanationPanel question={currentQuestion} targets={targets} />}
    </div>
  );
}
