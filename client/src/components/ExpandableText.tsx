import { useMemo, useState } from 'react';

interface Props {
  text: string;
  maxLines?: number;
}

export default function ExpandableText({ text, maxLines = 1 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const lines = useMemo(() => text.split('\n'), [text]);
  const shouldClamp = lines.length > maxLines || text.length > 140;

  if (!shouldClamp) {
    return <p className="ig-desc">{text}</p>;
  }

  return (
    <div className="ig-desc expandable">
      <div className={expanded ? 'full' : 'clamped'}>{text}</div>
      <button className="link-button" onClick={() => setExpanded((v) => !v)}>
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
}
