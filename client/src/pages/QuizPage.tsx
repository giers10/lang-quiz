import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import QuizRunner from '../components/QuizRunner';

export default function QuizPage() {
  const [params] = useSearchParams();

  const { mode, entryId, nonce } = useMemo(() => {
    const modeParam = params.get('mode');
    const idParam = params.get('id');
    const nonceParam = params.get('nonce') || '';
    let decodedId: string | undefined;
    if (idParam) {
      try {
        decodedId = decodeURIComponent(idParam);
      } catch {
        decodedId = idParam;
      }
    }
    return { mode: modeParam, entryId: decodedId, nonce: nonceParam };
  }, [params]);

  const defaultMode = mode === 'entry' ? 'single' : 'all';
  const autoStart = true;

  const runnerKey = `${defaultMode}-${entryId || 'all'}-${nonce}`;

  return <QuizRunner key={runnerKey} defaultMode={defaultMode} defaultEntryId={entryId} autoStart={autoStart} />;
}
