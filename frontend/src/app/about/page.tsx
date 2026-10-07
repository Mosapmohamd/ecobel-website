import Icon from '@/components/Icon';
import { FREE_SHIPPING_THRESHOLD, SITE_CONTACT } from '@/lib/constants';

export default function AboutPage() {
  return (
    <div>
      <section style={{ background: `linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)` }}>
        <div className="mx-auto max-w-4xl px-5 py-16 text-center">
          <div className="text-sm font-bold mb-3" style={{ color: 'var(--color-surface-muted)' }}>Eco Bel</div>
          <h1 className="text-4xl font-bold" style={{ color: 'var(--color-surface)' }}>قصتنا</h1>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-16">
        <div className="flex flex-col gap-6 text-[16px] leading-relaxed" style={{ color: 'var(--color-ink)' }}>
          <p>
            Eco Bel علامة مصرية للعناية بالبشرة والشعر، بدأت من فكرة بسيطة: الجمال الحقيقي مبنيّ على
            مكونات طبيعية وآمنة، مش على مواد كيميائية قاسية. كل منتج بنقدّمه بيتصمم بعناية عشان يجمع
            بين الفعالية والأمان على بشرتك وشعرك.
          </p>
          <p>
            بنشتغل على فئتين رئيسيتين — العناية بالبشرة والعناية بالشعر — وبنحرص إن كل تركيبة تكون
            مدروسة، من غير بارابين أو مواد ضارة، عشان تقدري تستخدمي منتجاتنا بثقة كل يوم.
          </p>
          <p>
            مقرّنا في المعادي، القاهرة، وبنشحن لكل محافظات مصر مع الدفع عند الاستلام عشان تجربة تسوق
            مريحة وآمنة.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12">
          <div className="rounded border p-6 text-center" style={{ borderColor: 'var(--color-line)', background: 'var(--color-surface)' }}>
            <span className="mx-auto mb-3 w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--color-surface-tint)', color: 'var(--color-success)' }}><Icon name="leaf" size={22} /></span>
            <div className="font-bold mb-1">مكونات طبيعية</div>
            <p className="text-[13.5px]" style={{ color: 'var(--color-ink-muted)' }}>تركيبات مدروسة بدون مواد ضارة</p>
          </div>
          <div className="rounded border p-6 text-center" style={{ borderColor: 'var(--color-line)', background: 'var(--color-surface)' }}>
            <span className="mx-auto mb-3 w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--color-surface-tint)', color: 'var(--color-success)' }}><Icon name="truck" size={22} /></span>
            <div className="font-bold mb-1">شحن لكل المحافظات</div>
            <p className="text-[13.5px]" style={{ color: 'var(--color-ink-muted)' }}>مجانًا فوق {FREE_SHIPPING_THRESHOLD.toLocaleString('ar-EG')} جنيه</p>
          </div>
          <div className="rounded border p-6 text-center" style={{ borderColor: 'var(--color-line)', background: 'var(--color-surface)' }}>
            <span className="mx-auto mb-3 w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--color-surface-tint)', color: 'var(--color-success)' }}><Icon name="cash" size={22} /></span>
            <div className="font-bold mb-1">الدفع عند الاستلام</div>
            <p className="text-[13.5px]" style={{ color: 'var(--color-ink-muted)' }}>تدفعي براحتك لما يوصلك الطلب</p>
          </div>
        </div>
      </section>

      <section className="border-t" style={{ borderColor: 'var(--color-line)', background: 'var(--color-surface-tint)' }}>
        <div className="mx-auto max-w-3xl px-5 py-12 text-center">
          <h2 className="text-2xl mb-3">تواصلي معنا</h2>
          <p style={{ color: 'var(--color-ink-muted)' }} className="mb-1">{SITE_CONTACT.address}</p>
          <a href={SITE_CONTACT.phoneHref} dir="ltr" className="link-underline" style={{ color: 'var(--color-ink-muted)' }}>{SITE_CONTACT.phone}</a>
        </div>
      </section>
    </div>
  );
}
