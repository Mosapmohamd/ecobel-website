import Link from 'next/link';
import { SITE_CONTACT } from '@/lib/constants';
import Icon, { type IconName } from './Icon';

/** Only facts the brand already states about itself (About page). */
const SEALS: { icon: IconName; label: string }[] = [
  { icon: 'pin', label: 'علامة مصرية' },
  { icon: 'leaf', label: 'بدون بارابين أو مواد ضارة' },
];

export default function BrandStory({ tone = 'surface' }: { tone?: 'surface' | 'tint' }) {
  return (
    <section aria-labelledby="home-brand-story" className={`section ${tone === 'tint' ? 'bg-surface-tint' : 'bg-surface'}`}>
      <div className="page-container">
        <div className={`rounded p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8 ${tone === 'tint' ? 'bg-surface' : 'bg-surface-tint'}`}>
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded bg-surface px-3 py-1 text-label font-bold text-primary shadow-soft">
              <Icon name="leaf" size={16} />
              قصة Eco Bel
            </span>
            <h2 id="home-brand-story" className="mt-4 text-headline-md lg:text-headline-lg">علامة مصرية، بمكونات طبيعية وآمنة</h2>
            <p className="mt-3 text-body-lg text-ink-secondary">
              كل منتج بنقدّمه بيتصمم بعناية عشان يجمع بين الفعالية والأمان على بشرتك وشعرك — من غير بارابين أو مواد ضارة.
              مقرّنا في {SITE_CONTACT.address}، وبنشحن لكل محافظات مصر مع الدفع عند الاستلام.
            </p>
            <Link href="/about" className="btn btn-secondary mt-6">
              تعرفي على قصتنا أكتر
              <Icon name="arrowLeft" size={17} />
            </Link>
          </div>

          <ul className="flex flex-wrap lg:flex-col gap-3 flex-none">
            {SEALS.map((s) => (
              <li key={s.label} className="flex items-center gap-3 rounded bg-surface px-4 py-3 shadow-soft">
                <Icon name={s.icon} size={22} className="text-success flex-none" />
                <span className="text-label font-bold">{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
