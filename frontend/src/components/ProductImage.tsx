'use client';

import { useState } from 'react';
import Image from 'next/image';
import { resolveImageUrl } from '@/lib/image';

/** The one consistent fallback used everywhere a product photo is missing
 * or fails to load — a soft brand-toned surface, never a fabricated
 * product graphic. */
export function ProductImageFallback() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'linear-gradient(160deg, var(--parchment) 0%, var(--parchment-2) 100%)' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo/ecobel-mark-black.png" alt="" style={{ width: '32%', height: 'auto', opacity: 0.16 }} />
    </div>
  );
}

export default function ProductImage({
  src,
  alt,
  sizes = '(max-width: 768px) 50vw, 25vw',
}: {
  src?: string | null;
  alt: string;
  sizes?: string;
}) {
  const resolved = resolveImageUrl(src);
  const [failed, setFailed] = useState(false);

  if (!resolved || failed) return <ProductImageFallback />;

  return (
    <Image
      src={resolved}
      alt={alt}
      fill
      sizes={sizes}
      style={{ objectFit: 'cover' }}
      onError={() => setFailed(true)}
    />
  );
}
