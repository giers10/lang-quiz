interface Props {
  src: string;
}

export default function VideoPlayer({ src }: Props) {
  if (!src) return null;
  return (
    <div className="video-shell">
      <video controls src={src} preload="metadata" />
    </div>
  );
}
