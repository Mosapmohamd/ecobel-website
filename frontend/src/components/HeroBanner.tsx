'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Slide {
  eyebrow: string;
  title: string;
  text: string;
  cta: string;
  href: string;
  bg: string;
}

const SLIDES: Slide[] = [
  {
    eyebrow: 'مكونات طبيعية · تركيبات آمنة',
    title: 'جمالك يبدأ من عناية نقية',
    text: 'منتجات Eco Bel للعناية بالبشرة والشعر، مصنوعة من مكونات طبيعية لنتائج فعّالة تدوم.',
    cta: 'تسوقي الآن',
    href: '/products',
    bg: 'linear-gradient(135deg, var(--forest) 0%, var(--forest-deep) 100%)',
  },
  {
    eyebrow: 'عرض لفترة محدودة',
    title: 'خصومات تصل إلى 30%',
    text: 'على مجموعة مختارة من منتجات العناية بالبشرة — قبل ما ينتهي العرض.',
    cta: 'شوفي العروض',
    href: '/products',
    bg: 'linear-gradient(135deg, #7A5A22 0%, #4a3714 100%)',
  },
  {
    eyebrow: 'توصيل لكل مصر',
    title: 'شحن مجاني فوق 1000 جنيه',
    text: 'اطلبي من أي محافظة، وادفعي عند الاستلام براحتك — بدون أي مقدّم.',
    cta: 'ابدأي التسوق',
    href: '/products',
    bg: 'linear-gradient(135deg, #3E5C47 0%, #1F3A2E 100%)',
  },
  {
    eyebrow: 'عناية بالشعر',
    title: 'شعر أقوى وألمع من غير سلفات',
    text: 'مجموعة كاملة لتقوية وترطيب الشعر بمكونات طبيعية 100%.',
    cta: 'اكتشفي المجموعة',
    href: '/products',
    bg: 'linear-gradient(135deg, #8FA888 0%, #4a5c45 100%)',
  },
];

export default function HeroBanner() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  const slide = SLIDES[index];

  return (
    <section style={{ background: slide.bg, transition: 'background 0.6s ease' }} className="relative">
      <div className="mx-auto max-w-6xl px-5 py-20 flex flex-col md:flex-row items-center gap-10">
        <div className="flex-1">
          <div className="text-sm font-bold mb-3" style={{ color: 'var(--gold-soft)' }}>{slide.eyebrow}</div>
          <h1 className="text-4xl md:text-5xl font-bold" style={{ color: 'var(--cream)' }}>{slide.title}</h1>
          <p className="mt-4 text-[17px] max-w-md" style={{ color: 'rgba(251,249,244,0.82)' }}>{slide.text}</p>
          <Link href={slide.href} className="btn btn-gold mt-7">{slide.cta}</Link>
        </div>
        <div className="flex-1 flex justify-center">
          <svg viewBox="0 0 220 260" width="240">
            <ellipse cx="110" cy="240" rx="70" ry="10" fill="#00000022" />
            <rect x="55" y="70" width="110" height="150" rx="14" fill="#E9E2CE" />
            <rect x="70" y="40" width="80" height="40" rx="10" fill="#C9A227" />
            <rect x="88" y="20" width="44" height="26" rx="6" fill="#8FA888" />
            <rect x="70" y="120" width="80" height="46" rx="4" fill="#1F3A2E" opacity="0.85" />
          </svg>
        </div>
      </div>

      <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            aria-label={`سلايد ${i + 1}`}
            onClick={() => setIndex(i)}
            className="rounded-full"
            style={{
              width: i === index ? 22 : 8,
              height: 8,
              background: i === index ? 'var(--gold)' : 'rgba(251,249,244,0.4)',
              transition: 'all 0.3s',
            }}
          />
        ))}
      </div>

      <button
        aria-label="السابق"
        onClick={() => setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length)}
        className="hidden md:flex absolute top-1/2 -translate-y-1/2 right-4 w-9 h-9 rounded-full items-center justify-center"
        style={{ background: 'rgba(251,249,244,0.15)', color: 'var(--cream)' }}
      >
        ›
      </button>
      <button
        aria-label="التالي"
        onClick={() => setIndex((i) => (i + 1) % SLIDES.length)}
        className="hidden md:flex absolute top-1/2 -translate-y-1/2 left-4 w-9 h-9 rounded-full items-center justify-center"
        style={{ background: 'rgba(251,249,244,0.15)', color: 'var(--cream)' }}
      >
        ‹
      </button>
    </section>
  );
}
