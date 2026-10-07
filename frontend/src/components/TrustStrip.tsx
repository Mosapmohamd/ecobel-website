import { FREE_SHIPPING_THRESHOLD } from '@/lib/constants';
import Icon, { type IconName } from './Icon';

const ITEMS: { icon: IconName; title: string; text: string; tone: 'primary' | 'success' }[] = [
  { icon: 'truck', title: 'شحن لكل المحافظات', text: `مجاني للطلبات فوق ${FREE_SHIPPING_THRESHOLD.toLocaleString('ar-EG')} ج.م`, tone: 'primary' },
  { icon: 'leaf', title: 'مكونات طبيعية', text: 'تركيبات آمنة بدون مواد ضارة', tone: 'success' },
  { icon: 'cash', title: 'الدفع عند الاستلام', text: 'ادفعي لما الطلب يوصلك', tone: 'primary' },
  { icon: 'return', title: 'استبدال خلال 14 يوم', text: 'استبدال سهل بدون تعقيد', tone: 'success' },
];

export default function TrustStrip() {
  return (
    <section aria-label="مميزات الشراء من Eco Bel" className="py-8 bg-surface">
      <ul className="page-container grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {ITEMS.map((item) => (
          <li key={item.title} className="flex items-center gap-4 rounded bg-surface-tint p-4">
            <span
              className={`flex-none w-12 h-12 rounded bg-surface flex items-center justify-center shadow-soft ${
                item.tone === 'success' ? 'text-success' : 'text-primary'
              }`}
            >
              <Icon name={item.icon} size={24} />
            </span>
            <div className="min-w-0">
              <div className="text-label-lg font-bold">{item.title}</div>
              <div className="text-body-sm mt-0.5 text-ink-muted">{item.text}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
