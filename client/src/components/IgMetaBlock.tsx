import ExpandableText from './ExpandableText';
import type { InstagramMeta } from '../types';

interface Props {
  ig: InstagramMeta;
  entryId?: string;
}

export default function IgMetaBlock({ ig, entryId }: Props) {
  const profileUrl = ig.profile_url || (ig.username ? `https://www.instagram.com/${ig.username}/` : undefined);
  const postDate = ig.post_date;
  return (
    <div className="ig-block">
      {ig.profile_pic_url ? (
        <a href={profileUrl || '#'} target="_blank" rel="noreferrer">
          <img
            className="ig-avatar"
            src={entryId ? `/api/profile-pic?id=${encodeURIComponent(entryId)}` : ig.profile_pic_url}
            alt={ig.username || 'profile'}
            onError={(e) => {
              if (ig.profile_pic_url && !e.currentTarget.dataset.fallback) {
                e.currentTarget.dataset.fallback = '1';
                e.currentTarget.src = ig.profile_pic_url;
              }
            }}
          />
        </a>
      ) : (
        <div className="ig-avatar placeholder" />
      )}
      <div className="ig-body">
        <div className="ig-row">
          {ig.username ? (
            <a className="ig-name" href={profileUrl || '#'} target="_blank" rel="noreferrer">
              {ig.username}
            </a>
          ) : (
            <span className="ig-name">Instagram</span>
          )}
          {ig.full_name && <span className="muted"> · {ig.full_name}</span>}
        </div>
        <div className="muted">{postDate || 'Date unknown'}</div>
        {ig.description && <ExpandableText text={ig.description} />}
      </div>
    </div>
  );
}
