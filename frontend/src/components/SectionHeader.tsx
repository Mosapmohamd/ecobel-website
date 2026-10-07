import Link from 'next/link';
import Icon from './Icon';

/** Kicker + heading (+ optional "see all" link) used at the top of every
 * homepage/catalog section. `align="center"` for editorial sections. */
export default function SectionHeader({
  kicker,
  title,
  description,
  link,
  align = 'start',
  kickerTone = 'primary',
  id,
}: {
  kicker?: string;
  title: string;
  description?: string;
  link?: { href: string; label: string };
  align?: 'start' | 'center';
  kickerTone?: 'primary' | 'sale';
  /** id for the heading, so the section can be `aria-labelledby` it. */
  id?: string;
}) {
  const centered = align === 'center';
  return (
    <div className={`mb-8 flex gap-4 ${centered ? 'flex-col items-center text-center' : 'flex-wrap items-end justify-between'}`}>
      <div className={centered ? 'max-w-2xl' : 'min-w-0'}>
        {kicker && <span className={`kicker ${kickerTone === 'sale' ? '!text-sale' : ''}`}>{kicker}</span>}
        <h2 id={id} className="text-headline-md lg:text-headline-lg">{title}</h2>
        {description && <p className="mt-2 text-body text-ink-muted">{description}</p>}
      </div>
      {link && (
        <Link href={link.href} className="flex-none inline-flex items-center gap-1.5 text-label font-bold text-primary link-underline">
          {link.label}
          <Icon name="arrowLeft" size={15} />
        </Link>
      )}
    </div>
  );
}
