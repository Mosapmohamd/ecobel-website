import { FREE_SHIPPING_THRESHOLD } from '@/lib/constants';
import Icon, { type IconName } from './Icon';

const ITEMS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'truck', title: 'شحن لكل المحافظات', text: `مجاني للطلبات فوق ${FREE_SHIPPING_THRESHOLD.toLocaleString('ar-EG')} ج.م` },
  { icon: 'leaf', title: 'مكونات طبيعية 100%', text: 'تركيبات آمنة بدون مواد ضارة' },
  { icon: 'cash', title: 'الدفع عند الاستلام', text: 'ادفعي لما الطلب يوصلك' },
  { icon: 'return', title: 'استبدال خلال 14 يوم', text: 'استبدال سهل بدون تعقيد' },
];

export default function TrustStrip({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className="border-y"
      style={{ background: compact ? 'var(--parchment)' : 'var(--cream)', borderColor: 'var(--line)' }}
    >
      <div className={`mx-auto max-w-6xl px-5 ${compact ? 'py-10' : 'py-7'} grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6`}>
        {ITEMS.map((item) => (
          <div key={item.title} className="flex items-center gap-3">
            <span
              className="flex-none w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: compact ? 'var(--cream)' : 'var(--parchment)', color: 'var(--forest)' }}
            >
              <Icon name={item.icon} size={21} />
            </span>
            <div className="min-w-0">
              <div className="text-[14px] font-bold">{item.title}</div>
              <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--muted)' }}>{item.text}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
