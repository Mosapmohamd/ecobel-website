import Link from 'next/link';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/constants';
import Icon, { type IconName } from './Icon';

const SEALS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'leaf', title: 'مكونات طبيعية', text: 'تركيبات مدروسة بدون مواد ضارة' },
  { icon: 'truck', title: 'شحن لكل المحافظات', text: `مجانًا فوق ${FREE_SHIPPING_THRESHOLD.toLocaleString('ar-EG')} جنيه` },
  { icon: 'cash', title: 'الدفع عند الاستلام', text: 'تدفعي براحتك لما يوصلك الطلب' },
];

export default function BrandStory() {
  return (
    <section style={{ background: 'var(--cream)' }}>
      <div className="mx-auto max-w-6xl px-5 py-16">
        <div
          className="rounded border grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-10 items-center p-8 md:p-12"
          style={{ background: 'var(--parchment)', borderColor: 'var(--line)' }}
        >
          <div>
            <span className="kicker">قصة Eco Bel</span>
            <h2 className="text-[28px] lg:text-[34px] leading-[1.35]">
              علامة مصرية، بمكونات طبيعية وآمنة
            </h2>
            <p className="mt-4 text-[15.5px] leading-[1.9]" style={{ color: 'var(--muted-strong)' }}>
              كل منتج بنقدّمه بيتصمم بعناية عشان يجمع بين الفعالية والأمان على بشرتك وشعرك — من غير
              بارابين أو مواد ضارة. مقرّنا في المعادي، القاهرة، وبنشحن لكل محافظات مصر مع الدفع عند
              الاستلام.
            </p>
            <Link href="/about" className="btn btn-secondary mt-7">
              تعرفي على قصتنا أكتر
              <Icon name="arrowLeft" size={17} />
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {SEALS.map((item) => (
              <div key={item.title} className="flex items-center gap-3 rounded border bg-white px-4 py-3.5" style={{ borderColor: 'var(--line)' }}>
                <span className="flex-none w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--parchment)', color: 'var(--ok)' }}>
                  <Icon name={item.icon} size={19} />
                </span>
                <div>
                  <div className="font-bold text-[14.5px]">{item.title}</div>
                  <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--muted)' }}>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
