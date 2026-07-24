import {
  collectHossiiDisplayTags,
  sliceVisibleHossiiTags,
} from '../../core/utils/hossiiDisplayTags';

type Props = {
  tags?: string[] | null;
  hashtags?: string[] | null;
  className: string;
  tagClassName: string;
  presetClassName: string;
  freeClassName: string;
  moreClassName: string;
};

/** タグがあるときだけ行を描画。操作ボタンにはしない（視覚のみ）。 */
export function HossiiDisplayTagRow({
  tags,
  hashtags,
  className,
  tagClassName,
  presetClassName,
  freeClassName,
  moreClassName,
}: Props) {
  const all = collectHossiiDisplayTags({ tags, hashtags });
  if (all.length === 0) return null;

  const { visible, extraCount } = sliceVisibleHossiiTags(all);

  return (
    <div className={className} aria-hidden="true">
      {visible.map((tag) => (
        <span
          key={`${tag.kind}-${tag.label}`}
          className={`${tagClassName} ${tag.kind === 'preset' ? presetClassName : freeClassName}`}
        >
          #{tag.label}
        </span>
      ))}
      {extraCount > 0 && <span className={moreClassName}>+{extraCount}</span>}
    </div>
  );
}
