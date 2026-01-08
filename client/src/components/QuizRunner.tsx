import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchEntries, fetchEntry } from '../api';
import type { EntryDetail, EntryItems, EntrySummary, QuizQuestionWithEntry } from '../types';
import VideoPlayer from './VideoPlayer';

type Mode = 'all' | 'selected' | 'single';

const TOTAL_QUESTIONS = 10;

interface QuizRunnerProps {
  defaultMode?: Mode;
  defaultEntryId?: string;
  autoStart?: boolean;
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

function shuffleQuestionOptions(question: QuizQuestionWithEntry): QuizQuestionWithEntry {
  const payload = { ...(question.payload || {}) };
  const answer = { ...(question.answer || {}) };

  if (Array.isArray(payload.options)) {
    const optionsWithIndex = payload.options.map((opt: any, idx: number) => ({ opt, idx }));
    const shuffled = shuffle(optionsWithIndex);
    payload.options = shuffled.map((p) => p.opt);
    if (typeof answer.correct_index === 'number') {
      const newIdx = shuffled.findIndex((p) => p.idx === answer.correct_index);
      answer.correct_index = newIdx >= 0 ? newIdx : answer.correct_index;
    }
  }

  return { ...question, payload, answer };
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

function deriveCorrectText(question: QuizQuestionWithEntry, userResponse: any) {
  const options: any[] = Array.isArray(question.payload?.options) ? question.payload?.options : [];
  if (typeof question.answer?.correct_index === 'number' && options[question.answer.correct_index]) {
    return options[question.answer.correct_index];
  }

  if (question.type === 'match') {
    const pairs: any[] = Array.isArray(question.payload?.pairs) ? question.payload.pairs : [];
    if (!pairs.length) return '';
    const messages: string[] = [];
    pairs.forEach((pair, idx) => {
      const correct = pair.right;
      const picked = userResponse?.[idx];
      if (picked !== correct) {
        messages.push(`${pair.left} → ${correct}${picked ? ` (you picked ${picked})` : ''}`);
      }
    });
    if (messages.length === 0) {
      return pairs.map((p: any) => `${p.left} → ${p.right}`).join(' | ');
    }
    return messages.join(' | ');
  }

  if (question.answer?.correct_text) return question.answer.correct_text;
  if (question.payload?.blanked) return question.payload.blanked;
  const pairs = Array.isArray(question.payload?.pairs) ? question.payload.pairs : [];
  if (pairs.length) {
    return pairs.map((p: any) => `${p.left} → ${p.right}`).join(' | ');
  }
  return '';
}

function formatUserAnswer(question: QuizQuestionWithEntry, userResponse: any) {
  const type = question.type || '';
  if (type === 'cloze') {
    return userResponse || 'No answer';
  }
  if (type === 'match') {
    const pairs: any[] = Array.isArray(question.payload?.pairs) ? question.payload.pairs : [];
    if (!pairs.length) return 'No answer';
    return pairs
      .map((pair, idx) => {
        const picked = userResponse?.[idx];
        return `${pair.left} → ${picked || '—'}`;
      })
      .join(' | ');
  }
  const options: any[] = Array.isArray(question.payload?.options) ? question.payload.options : [];
  if (((type || '').startsWith('mc') || type === 'choose_best_reply' || !type) && typeof userResponse === 'number') {
    return options[userResponse] ?? `Option ${userResponse}`;
  }
  return userResponse ?? 'No answer';
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
  showResult,
  lastCorrect,
}: {
  question: QuizQuestionWithEntry;
  response: any;
  onChange: (val: any) => void;
  showResult: boolean;
  lastCorrect: boolean;
}) {
  const payload = question.payload || {};
  const type = question.type || '';
  const correctIndex = typeof question.answer?.correct_index === 'number' ? question.answer.correct_index : null;

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
          disabled={showResult}
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
          <div
            key={idx}
            className={[
              'match-row',
              showResult && response?.[idx] === pair.right ? 'correct' : '',
              showResult && response?.[idx] && response?.[idx] !== pair.right ? 'incorrect' : '',
            ]
              .join(' ')
              .trim()}
          >
            <div className="match-left">{pair.left}</div>
            <select
              className="input"
              value={response?.[idx] || ''}
              onChange={(e) => {
                const current = response && typeof response === 'object' ? response : {};
                onChange({ ...current, [idx]: e.target.value });
              }}
              disabled={showResult}
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
        <label
          key={idx}
          className={[
            'option',
            showResult && correctIndex === idx ? 'correct' : '',
            showResult && !lastCorrect && response === idx && correctIndex !== idx ? 'incorrect' : '',
          ].join(' ').trim()}
        >
          <input
            type="radio"
            checked={response === idx}
            onChange={() => onChange(idx)}
            name={`q-${question.id}`}
            disabled={showResult}
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

import IgMetaBlock from './IgMetaBlock';

function ExplanationPanel({ question, targets }: { question: QuizQuestionWithEntry; targets: TargetHit[] }) {
  return (
    <div className="explanation">
      <div className="explanation-header">
        <h4>Explanation</h4>
        <Link className="entry-link" to={`/entry/${encodeURIComponent(question.entryId)}`}>
          Open learn page &raquo;
        </Link>
      </div>
      {targets.length ? (
        <div className="explanation-grid">
          {targets.map(({ group, item }) => (
            <div key={`${group}-${item.id || item.jp}`} className="panel-card">
              <div className="panel-card__title">
                {item.jp || item.pattern || item.id}
                {item.kana && <div className="subline">{item.kana}</div>}
              </div>
              <div className="muted">
                {item.meaning_en || item.meaning || item.en || item.when_to_use_en || item.note_en}
              </div>
              {item.use_note_en && <div className="subline">{item.use_note_en}</div>}
              {item.when_to_use_en && <div className="subline">{item.when_to_use_en}</div>}
              {item.register && <span className="pill pill--ghost">{item.register}</span>}
              {(item.example || item.example_en || item.example_jp) && (
                <div className="item-row">
                  <span className="label">Example</span>
                  <div className="subline">{item.example?.jp || item.example_jp}</div>
                  <div className="subline muted">{item.example?.kana || item.example_kana}</div>
                  <div className="subline muted">{item.example?.en || item.example_en}</div>
                </div>
              )}
              <div className="tag">{group}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No linked study items were found for this question.</p>
      )}
      <VideoPlayer src={question.video_url} />
      {question.ig_meta && <IgMetaBlock ig={question.ig_meta} entryId={question.entryId} />}
    </div>
  );
}

export default function QuizRunner({ defaultMode = 'all', defaultEntryId, autoStart }: QuizRunnerProps) {
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [mode] = useState<Mode>(defaultMode);
  const [selectedIds] = useState<string[]>(defaultEntryId ? [defaultEntryId] : []);
  const [questions, setQuestions] = useState<QuizQuestionWithEntry[]>([]);
  const [history, setHistory] = useState<
    { response: any; correct: boolean; skipped: boolean; showExplanation: boolean }[]
  >([]);
  const [status, setStatus] = useState<'setup' | 'loading' | 'running' | 'finished'>('setup');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [response, setResponse] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [lastSkipped, setLastSkipped] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingEntries(true);
    fetchEntries()
      .then((data) => setEntries(data))
      .catch(() => setError('Could not load entries.'))
      .finally(() => setLoadingEntries(false));
  }, []);

  useEffect(() => {
    if (autoStart && status === 'setup' && entries.length > 0) {
      startQuiz();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, defaultEntryId, entries.length, status]);

  const currentQuestion = useMemo(() => questions[currentIndex], [questions, currentIndex]);
  const canSubmit = useMemo(() => {
    if (!currentQuestion) return false;
    if (currentQuestion.type === 'cloze') {
      return Boolean(response && String(response).trim().length > 0);
    }
    if (currentQuestion.type === 'match') {
      return Boolean(response && Object.values(response).every((v) => v));
    }
    if ((currentQuestion.type || '').startsWith('mc') || currentQuestion.type === 'choose_best_reply') {
      return typeof response === 'number';
    }
    if (!currentQuestion.type) {
      return typeof response === 'number';
    }
    return true;
  }, [currentQuestion, response]);

  const resetQuestionState = () => {
    setResponse(null);
    setShowResult(false);
    setLastCorrect(false);
    setLastSkipped(false);
    setShowExplanation(false);
  };

  const startQuiz = async () => {
    const ids: string[] =
      mode === 'all' ? entries.map((e) => e.id) : selectedIds.length ? selectedIds.slice(0, 1) : entries.map((e) => e.id);

    if (!ids.length) {
      setError('Pick at least one entry to quiz on.');
      return;
    }

    setError(null);
    setStatus('loading');

    try {
      const uniqueIds = Array.from(new Set(ids));
      const details: EntryDetail[] = await Promise.all(uniqueIds.map((id) => fetchEntry(id)));
      const pool: QuizQuestionWithEntry[] = details.flatMap((entry) => {
        const safeItems: EntryItems = entry.items || { grammar: [], vocab: [], conversation: [], key_phrases: [] };
        return (entry.quiz || []).map((q) => shuffleQuestionOptions({
          ...q,
          entryId: entry.id,
          entryTitle: entry.title,
          items: safeItems,
          video_url: entry.video_url,
          ig_meta: entry.ig_meta,
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
      setHistory(Array(chosen.length).fill(null));
      setStatus('running');
    } catch (err: any) {
      setError(err?.message || 'Could not start quiz.');
      setStatus('setup');
    }
  };

  const handleSubmit = (skip = false) => {
    if (!currentQuestion) return;
    if (history[currentIndex]) {
      // already answered; keep locked
      setShowResult(true);
      setShowExplanation(history[currentIndex]?.showExplanation || false);
      setLastCorrect(history[currentIndex]?.correct || false);
      setLastSkipped(history[currentIndex]?.skipped || false);
      setResponse(history[currentIndex]?.response ?? null);
      return;
    }
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
    setLastSkipped(skip);
    setShowResult(true);
    setShowExplanation(!correct);
    setHistory((prev) => {
      const next = [...prev];
      next[currentIndex] = { response, correct, skipped: skip, showExplanation: !correct };
      return next;
    });
  };

  const goNext = () => {
    if (currentIndex + 1 >= questions.length) {
      setStatus('finished');
    } else {
      setCurrentIndex((idx) => idx + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((idx) => Math.max(0, idx - 1));
    }
  };

  useLayoutEffect(() => {
    if (status !== 'running') return;
    const saved = history[currentIndex];
    if (saved) {
      setResponse(saved.response);
      setShowResult(true);
      setLastCorrect(saved.correct);
      setLastSkipped(saved.skipped);
      setShowExplanation(saved.showExplanation);
    } else {
      resetQuestionState();
    }
  }, [currentIndex, history, status]);

  useLayoutEffect(() => {
    if (!showResult) return;
    setHistory((prev) => {
      const next = [...prev];
      const existing = next[currentIndex];
      if (existing) {
        next[currentIndex] = { ...existing, showExplanation };
      }
      return next;
    });
  }, [showExplanation, showResult, currentIndex]);

  if (loadingEntries) {
    return <div className="loading">Loading quiz setup…</div>;
  }

  if (status === 'setup') {
    return (
      <div className="quiz-setup">
        <h2>Building your quiz…</h2>
        <p className="muted">Preparing 10 questions from {mode === 'single' ? 'this entry' : 'all entries'}.</p>
        {error && <div className="error">{error}</div>}
        {!autoStart && (
          <button className="button button--primary" onClick={startQuiz}>
            Start quiz
          </button>
        )}
      </div>
    );
  }

  if (status === 'loading') {
    return <div className="loading">Building your quiz…</div>;
  }

  if (status === 'finished') {
    const lastIndex = questions.length ? questions.length - 1 : 0;
    const isRandomMode = mode === 'all';
    const entryLink = !isRandomMode && currentQuestion ? `/entry/${encodeURIComponent(currentQuestion.entryId)}` : null;
    const answered = history.filter(Boolean) as { response: any; correct: boolean; skipped: boolean; showExplanation: boolean }[];
    const correctCount = answered.filter((h) => h.correct).length;
    const skippedCount = answered.filter((h) => h.skipped).length;
    const wrongCount = Math.max(0, answered.length - correctCount - skippedCount);
    const summaryItems = questions.map((q, idx) => {
      const h = history[idx];
      const statusTag = h?.skipped ? 'skipped' : h?.correct ? 'correct' : 'wrong';
      return { question: q, history: h, statusTag };
    });
    return (
      <div className="quiz-finished">
        <h2>Nice work!</h2>
        <p className="muted">You scored {score} out of {questions.length}.</p>
        <div className="summary">
          <div className="pill">Correct {correctCount}</div>
          <div className="pill">Wrong {wrongCount}</div>
          <div className="pill">Skipped {skippedCount}</div>
        </div>
        <div className="actions" style={{ flexWrap: 'wrap' }}>
          <button
            className="button button--ghost"
            onClick={() => {
              setStatus('running');
              setCurrentIndex(lastIndex);
            }}
          >
            Back
          </button>
          <button className="button" onClick={startQuiz}>
            Play again
          </button>
          <Link className="button button--ghost" to="/">
            Home
          </Link>
          {entryLink && (
            <Link className="button button--ghost" to={entryLink}>
              Back to learn page
            </Link>
          )}
        </div>
        <div className="summary-list">
          {summaryItems.map(({ question, history: h, statusTag }, idx) => {
            const correctText = deriveCorrectText(question, h?.response);
            const userText = h ? formatUserAnswer(question, h.response) : 'No answer';
            const entryHref = `/entry/${encodeURIComponent(question.entryId)}`;
            return (
              <div key={question.id || idx} className={`summary-item ${statusTag}`}>
                <div className="summary-top">
                  <div className="summary-question">
                    {idx + 1}. {question.prompt_en || 'Question'}
                  </div>
                  {isRandomMode && (
                    <Link className="entry-link" to={entryHref} target="_blank" rel="noreferrer">
                      Learn page &raquo;
                    </Link>
                  )}
                </div>
                <div className="summary-answers">
                  <div className={`pill ${statusTag}`}>You: {userText}</div>
                  <div className="pill">Answer: {correctText || '—'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return <div className="error">No questions available.</div>;
  }

  const targets = resolveTargets(currentQuestion);
  const correctText = deriveCorrectText(currentQuestion, response);
  const shouldShowExplanation = showResult && (!lastCorrect || showExplanation);

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

      <QuestionRenderer
        question={currentQuestion}
        response={response}
        onChange={setResponse}
        showResult={showResult}
        lastCorrect={lastCorrect}
      />

      {showResult && (
        <div className={lastSkipped ? 'callout neutral' : lastCorrect ? 'callout success' : 'callout'}>
          {lastCorrect ? 'Correct!' : lastSkipped ? 'Answer:' : 'Not quite.'}
          {correctText && (
            <div className="subline">{lastSkipped ? correctText : `Answer: ${correctText}`}</div>
          )}
        </div>
      )}

      <div className="quiz-actions">
        {currentIndex > 0 && (
          <button className="button button--ghost" onClick={goPrev}>
            Back
          </button>
        )}
        {!showResult ? (
          <>
            <button className="button" onClick={() => handleSubmit(false)} disabled={!canSubmit}>
              Submit
            </button>
            <button className="button button--ghost" onClick={() => handleSubmit(true)}>
              Don’t know
            </button>
          </>
        ) : (
          <>
            <button className="button button--primary" onClick={goNext}>
              {currentIndex + 1 === questions.length ? 'Finish' : 'Next'}
            </button>
            {lastCorrect && !showExplanation && (
              <button className="button button--ghost" onClick={() => setShowExplanation(true)}>
                Show explanation
              </button>
            )}
          </>
        )}
      </div>

      {shouldShowExplanation && <ExplanationPanel question={currentQuestion} targets={targets} />}
    </div>
  );
}
