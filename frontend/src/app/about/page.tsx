export default function AboutPage() {
  return (
    <div>
      <section style={{ background: `linear-gradient(135deg, var(--forest) 0%, var(--forest-deep) 100%)` }}>
        <div className="mx-auto max-w-4xl px-5 py-16 text-center">
          <div className="text-sm font-bold mb-3" style={{ color: 'var(--gold-soft)' }}>Eco Bel</div>
          <h1 className="text-4xl font-bold" style={{ color: 'var(--cream)' }}>قصتنا</h1>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-16">
        <div className="flex flex-col gap-6 text-[16px] leading-relaxed" style={{ color: 'var(--ink)' }}>
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
          <div className="rounded-lg border p-6 text-center" style={{ borderColor: 'var(--line)', background: 'var(--cream)' }}>
            <div className="text-3xl mb-2">🌿</div>
            <div className="font-bold mb-1">مكونات طبيعية</div>
            <p className="text-[13.5px]" style={{ color: '#8a8074' }}>تركيبات مدروسة بدون مواد ضارة</p>
          </div>
          <div className="rounded-lg border p-6 text-center" style={{ borderColor: 'var(--line)', background: 'var(--cream)' }}>
            <div className="text-3xl mb-2">🚚</div>
            <div className="font-bold mb-1">شحن لكل المحافظات</div>
            <p className="text-[13.5px]" style={{ color: '#8a8074' }}>مجانًا فوق 1000 جنيه</p>
          </div>
          <div className="rounded-lg border p-6 text-center" style={{ borderColor: 'var(--line)', background: 'var(--cream)' }}>
            <div className="text-3xl mb-2">💵</div>
            <div className="font-bold mb-1">الدفع عند الاستلام</div>
            <p className="text-[13.5px]" style={{ color: '#8a8074' }}>تدفعي براحتك لما يوصلك الطلب</p>
          </div>
        </div>
      </section>

      <section className="border-t" style={{ borderColor: 'var(--line)', background: 'var(--parchment-2)' }}>
        <div className="mx-auto max-w-3xl px-5 py-12 text-center">
          <h2 className="text-2xl mb-3">تواصلي معنا</h2>
          <p style={{ color: '#8a8074' }} className="mb-1">المعادي، القاهرة</p>
          <p style={{ color: '#8a8074' }}>01508582006</p>
        </div>
      </section>
    </div>
  );
}
