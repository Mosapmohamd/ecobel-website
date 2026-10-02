const ITEMS: { label: string; icon: (color: string) => React.ReactNode }[] = [
  {
    label: 'شحن لكل المحافظات',
    icon: (c) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
        <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
        <circle cx="7" cy="18" r="1.6" />
        <circle cx="17.5" cy="18" r="1.6" />
      </svg>
    ),
  },
  {
    label: 'الدفع عند الاستلام',
    icon: (c) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
        <rect x="2.5" y="6" width="19" height="12" rx="2" />
        <path d="M2.5 10h19" />
        <circle cx="7" cy="14.2" r="1.1" fill={c} stroke="none" />
      </svg>
    ),
  },
  {
    label: 'مكونات طبيعية 100%',
    icon: (c) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
        <path d="M12 21c-4-2-7-6-7-11a9 9 0 0 1 9-5c0 6-2 11-2 16Z" />
        <path d="M12 21c4-2 7-6 7-11" />
      </svg>
    ),
  },
  {
    label: 'استبدال خلال 14 يوم',
    icon: (c) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
        <path d="M3 12a9 9 0 1 1 3 6.7" />
        <path d="M3 21v-5h5" />
      </svg>
    ),
  },
];

export default function TrustStrip({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className="border-b"
      style={{ background: compact ? 'var(--cream)' : 'var(--parchment-2)', borderColor: 'var(--line)' }}
    >
      <div
        className={`mx-auto max-w-6xl px-5 ${compact ? 'py-8' : 'py-5'} grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-between gap-y-4 gap-x-3`}
      >
        {ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5 text-[13.5px] font-medium" style={{ color: 'var(--forest-deep)' }}>
            {item.icon('var(--forest)')}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
