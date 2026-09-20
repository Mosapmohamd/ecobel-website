export default function Footer() {
  return (
    <footer style={{ background: 'var(--forest-deep)', color: 'rgba(251,249,244,0.75)' }} className="mt-20">
      <div className="mx-auto max-w-6xl px-5 py-12 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div>
          <div className="text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)' }}>
            Eco Bel
          </div>
          <p className="text-[13.5px] leading-relaxed" style={{ color: 'rgba(251,249,244,0.6)' }}>
            علامة مصرية للعناية بالبشرة والشعر، بتركيبات طبيعية وآمنة لجمال حقيقي وصحة مستدامة.
          </p>
        </div>
        <div>
          <div className="text-sm font-bold mb-3" style={{ color: 'var(--gold-soft)' }}>استكشف</div>
          <div className="flex flex-col gap-2 text-[13.5px]">
            <a href="/">الرئيسية</a>
            <a href="/products">كل المنتجات</a>
            <a href="/track">تتبع طلبك</a>
          </div>
        </div>
        <div>
          <div className="text-sm font-bold mb-3" style={{ color: 'var(--gold-soft)' }}>تواصلي معنا</div>
          <div className="flex flex-col gap-2 text-[13.5px]">
            <span>المعادي، القاهرة</span>
            <span>01508582006</span>
          </div>
        </div>
      </div>
      <div
        className="border-t mx-auto max-w-6xl px-5 py-4 text-[12.5px] flex justify-between"
        style={{ borderColor: 'rgba(251,249,244,0.12)', color: 'rgba(251,249,244,0.45)' }}
      >
        <span>© 2026 جميع الحقوق محفوظة لـ Eco Bel</span>
        <span>الدفع عند الاستلام</span>
      </div>
    </footer>
  );
}
