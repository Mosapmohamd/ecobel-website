import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_CONTACT } from '@/lib/constants';
import { PrivacyPreferencesLink } from '@/components/ConsentBanner';

// DRAFT — pending legal review before production (docs/PRIVACY_POLICY_DRAFT.md).
// It describes only what this storefront's code does; it doesn't claim
// compliance with any law. Kept out of search results until reviewed.
export const metadata: Metadata = {
  title: 'سياسة الخصوصية',
  description: 'إزاي Eco Bel بتتعامل مع بياناتك على الموقع.',
  alternates: { canonical: '/privacy' },
  robots: { index: false, follow: true },
};

const metaPixelOn = /^\d{6,20}$/.test((process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '').trim());

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-headline-lg font-bold text-ink">سياسة الخصوصية</h1>
      <div className="mt-6 flex flex-col gap-6 text-body leading-relaxed text-ink">
        <section>
          <h2 className="text-headline-sm font-bold mb-2">البيانات اللي بنحتاجها عشان طلبك</h2>
          <p>
            لما تطلبي من الموقع بنسجّل الاسم ورقم الموبايل والمحافظة والعنوان وأي ملاحظات تكتبيها، والمنتجات والمبالغ.
            بنستخدمها عشان نجهّز الطلب ونوصّله ونتواصل معاكي بخصوصه ونسجّل حساباتنا. لو عملتي حساب، بنسجّل الاسم ورقم
            الموبايل وكلمة السر (متخزّنة مشفّرة — محدش يقدر يقراها).
          </p>
        </section>

        <section>
          <h2 className="text-headline-sm font-bold mb-2">اللي بيتخزّن على جهازك (ضروري)</h2>
          <p>
            الموقع بيحفظ على جهازك السلة والمفضلة وتسجيل الدخول واختيارك للخصوصية. ده ضروري عشان الموقع يشتغل، ومش
            بيتبعت لأي حد غيرنا.
          </p>
        </section>

        <section>
          <h2 className="text-headline-sm font-bold mb-2">تتبع إعلانات Meta (اختياري — بعد موافقتك بس)</h2>
          <p>
            ممكن نستخدم أداة Meta Pixel (فيسبوك وإنستجرام) عشان نقيس إعلاناتنا. مش بتشتغل خالص — ومفيش أي حاجة بتتبعت
            لـ Meta — غير لو وافقتي. لو وافقتي، بيتبعت لـ Meta:
          </p>
          <ul className="mt-2 list-disc ps-6 flex flex-col gap-1">
            <li>الصفحات اللي فتحتيها على الموقع.</li>
            <li>المنتجات اللي شفتيها أو أضفتيها للسلة: رقم المنتج وسعره والكمية.</li>
            <li>الكلمات اللي بحثتي بيها في الموقع.</li>
            <li>إنك بدأتي إتمام طلب، وقيمة السلة.</li>
            <li>لما طلب دفع عند الاستلام يتسلّم وتفتحي حسابك: قيمته ومنتجاته ورقم مرجعي للطلب.</li>
          </ul>
          <p className="mt-2">
            مش بنبعت لـ Meta اسمك ولا رقمك ولا عنوانك ولا كلمة السر. Meta نفسها بتستقبل من متصفحك عنوان الـ IP ونوع الجهاز
            والمتصفح، وبتحط ملفات تعريف (cookies) خاصة بيها، وممكن تربط ده بحسابك عندها حسب{' '}
            <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer" className="underline">سياسة خصوصية Meta</a>.
          </p>
          <p className="mt-2">
            تقدري تغيّري اختيارك في أي وقت{metaPixelOn ? ' من ' : ' — '}
            {metaPixelOn ? <PrivacyPreferencesLink className="underline" /> : <span>الاختيار بيظهر لما الأداة تكون شغّالة</span>}
            {metaPixelOn ? ' في آخر الصفحة.' : '.'} الرفض بيوقف أي بيانات جديدة لـ Meta.
          </p>
        </section>

        <section>
          <h2 className="text-headline-sm font-bold mb-2">التواصل</h2>
          <p>
            لأي سؤال عن بياناتك كلمينا على{' '}
            <a href={SITE_CONTACT.phoneHref} className="underline" dir="ltr">{SITE_CONTACT.phone}</a>.{' '}
            <Link href="/" className="underline">الرجوع للرئيسية</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
