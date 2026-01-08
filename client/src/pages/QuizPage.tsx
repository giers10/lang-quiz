import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import QuizRunner from '../components/QuizRunner';

export default function QuizPage() {
  const [params] = useSearchParams();

  const { mode, entryId } = useMemo(() => {
    const modeParam = params.get('mode');
    const idParam = params.get('id');
    let decodedId: string | undefined;
    if (idParam) {
      try {
        decodedId = decodeURIComponent(idParam);
      } catch {
        decodedId = idParam;
      }
    }
    return { mode: modeParam, entryId: decodedId };
  }, [params]);

  const defaultMode = mode === 'entry' ? 'single' : 'all';
  const autoStart = true;

  return <QuizRunner defaultMode={defaultMode} defaultEntryId={entryId} autoStart={autoStart} />;
}
