interface Props {
  src: string;
  variant?: 'compact' | 'wide';
}

export default function VideoPlayer({ src, variant = 'wide' }: Props) {
  if (!src) return null;
  const className = variant === 'compact' ? 'video-shell compact' : 'video-shell';
  return (
    <div className={className}>
      <video controls src={src} preload="metadata" />
    </div>
  );
}
