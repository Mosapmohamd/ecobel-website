import Link from 'next/link';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/constants';

export default function BrandStory() {
  return (
    <section style={{ background: 'var(--charcoal)' }}>
      <div className="mx-auto max-w-6xl px-5 py-16 md:py-20 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div>
          <div className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--gold-soft)' }}>
            Eco Bel
          </div>
          <h2 className="text-3xl" style={{ color: 'var(--cream)' }}>
            علامة مصرية، بمكونات طبيعية وآمنة
          </h2>
          <p className="mt-5 text-[15.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.82)' }}>
            كل منتج بنقدّمه بيتصمم بعناية عشان يجمع بين الفعالية والأمان على بشرتك وشعرك — من غير
            بارابين أو مواد ضارة. مقرّنا في المعادي، القاهرة، وبنشحن لكل محافظات مصر مع الدفع عند
            الاستلام.
          </p>
          <Link
            href="/about"
            className="inline-flex items-center gap-2 mt-7 text-[14px] font-bold"
            style={{ color: 'var(--gold-soft)' }}
          >
            تعرفي على قصتنا أكتر ←
          </Link>
        </div>

        <div className="flex flex-col gap-5 sm:flex-row md:flex-col">
          {[
            { title: 'مكونات طبيعية', text: 'تركيبات مدروسة بدون مواد ضارة' },
            { title: 'شحن لكل المحافظات', text: `مجانًا فوق ${FREE_SHIPPING_THRESHOLD.toLocaleString('ar-EG')} جنيه` },
            { title: 'الدفع عند الاستلام', text: 'تدفعي براحتك لما يوصلك الطلب' },
          ].map((item) => (
            <div key={item.title} className="pb-5 sm:pb-0 border-b sm:border-b-0 sm:border-none" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
              <div className="font-bold text-[15px]" style={{ color: 'var(--cream)' }}>{item.title}</div>
              <p className="mt-1 text-[13.5px]" style={{ color: 'rgba(255,255,255,0.65)' }}>{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
