import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  src: string;
  variant?: 'compact' | 'wide';
  quizLink?: string;
}

export default function VideoPlayer({ src, variant = 'wide', quizLink }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    setEnded(false);
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = async () => {
      try {
        video.muted = false;
        setMuted(false);
        await video.play();
      } catch {
        video.muted = true;
        setMuted(true);
        try {
          await video.play();
        } catch (err) {
          console.warn('Autoplay failed', err);
        }
      }
    };

    tryPlay();
  }, [src]);

  if (!src) return null;
  const className = variant === 'compact' ? 'video-shell compact' : 'video-shell';

  const handleReplay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    setEnded(false);
    video.play().catch(() => {});
  };

  return (
    <div className={className}>
      <video
        ref={videoRef}
        controls
        autoPlay
        playsInline
        muted={muted}
        src={src}
        preload="metadata"
        onEnded={() => setEnded(true)}
        onPlay={() => setEnded(false)}
      />
      {ended && (
        <div className="video-overlay">
          <button className="button button--primary" onClick={handleReplay}>
            Play again
          </button>
          {quizLink && (
            <Link className="button" to={quizLink}>
              Start quiz
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
