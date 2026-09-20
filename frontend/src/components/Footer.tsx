export default function Footer() {
  return (
    <footer style={{ background: 'var(--forest-deep)', color: 'rgba(251,249,244,0.75)' }} className="mt-20">
      <div className="mx-auto max-w-6xl px-5 py-12 grid grid-cols-1 sm:grid-cols-4 gap-8">
        <div>
          <div className="text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--cream)' }}>
            Eco Bel
          </div>
          <p className="text-[13.5px] leading-relaxed mb-4" style={{ color: 'rgba(251,249,244,0.6)' }}>
            علامة مصرية للعناية بالبشرة والشعر، بتركيبات طبيعية وآمنة لجمال حقيقي وصحة مستدامة.
          </p>
          <div className="flex items-center gap-3">
            <a href="https://facebook.com/ecobel.eg" target="_blank" rel="noopener noreferrer" aria-label="فيسبوك" style={iconStyle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.5 9.88v-6.99H7.9V12h2.6V9.8c0-2.56 1.53-3.98 3.87-3.98 1.12 0 2.3.2 2.3.2v2.5h-1.3c-1.28 0-1.68.8-1.68 1.61V12h2.86l-.46 2.89h-2.4v6.99A10 10 0 0 0 22 12Z" /></svg>
            </a>
            <a href="https://instagram.com/ecobel.eg" target="_blank" rel="noopener noreferrer" aria-label="إنستجرام" style={iconStyle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
            </a>
            <a href="https://tiktok.com/@ecobel.eg" target="_blank" rel="noopener noreferrer" aria-label="تيك توك" style={iconStyle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.2c-.9-.8-1.4-1.9-1.5-3.2h-3.2v13.7c0 1.5-1.2 2.7-2.7 2.7s-2.7-1.2-2.7-2.7 1.2-2.7 2.7-2.7c.3 0 .6 0 .8.1V9.9c-.3 0-.5-.1-.8-.1-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6V8.3c1.2.9 2.7 1.4 4.3 1.4V6.4c-1 0-2-.4-2.9-1.2Z" /></svg>
            </a>
          </div>
        </div>
        <div>
          <div className="text-sm font-bold mb-3" style={{ color: 'var(--gold-soft)' }}>استكشف</div>
          <div className="flex flex-col gap-2 text-[13.5px]">
            <a href="/">الرئيسية</a>
            <a href="/products">كل المنتجات</a>
            <a href="/about">عن الشركة</a>
            <a href="/track">تتبع طلبك</a>
          </div>
        </div>
        <div>
          <div className="text-sm font-bold mb-3" style={{ color: 'var(--gold-soft)' }}>حسابي</div>
          <div className="flex flex-col gap-2 text-[13.5px]">
            <a href="/account">حسابي</a>
            <a href="/wishlist">المفضلة</a>
            <a href="/cart">السلة</a>
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

const iconStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(251,249,244,0.1)',
  color: 'var(--gold-soft)',
};
