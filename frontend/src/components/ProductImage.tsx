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
      style={{ background: 'linear-gradient(160deg, var(--color-surface-tint) 0%, var(--color-surface-muted) 100%)' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo/ecobel-mark-black.png" alt="" style={{ width: '32%', height: 'auto', opacity: 0.16 }} />
    </div>
  );
}

/** A product photo filling its (relatively positioned, sized) parent.
 * Missing or failing photos show the fallback; while loading, a soft
 * pulse of the same surface. `sizes` should describe the rendered width so
 * the optimizer sends a thumbnail, not the full upload. */
export default function ProductImage({
  src,
  alt,
  sizes = '(max-width: 768px) 50vw, 25vw',
  preload = false,
}: {
  src?: string | null;
  /** The product's name where the photo is the content; "" where the name is already next to it. */
  alt: string;
  sizes?: string;
  /** Only for the one above-the-fold photo of a page (product detail). */
  preload?: boolean;
}) {
  const resolved = resolveImageUrl(src);
  const [state, setState] = useState<{ src: string; status: 'loaded' | 'failed' } | null>(null);
  const status = state?.src === resolved ? state.status : 'loading';

  if (!resolved || status === 'failed') return <ProductImageFallback />;

  return (
    <>
      {status === 'loading' && (
        <div aria-hidden="true" className="absolute inset-0 bg-surface-tint animate-pulse motion-reduce:animate-none" />
      )}
      <Image
        src={resolved}
        alt={alt}
        fill
        sizes={sizes}
        preload={preload}
        style={{ objectFit: 'cover' }}
        onLoad={() => setState({ src: resolved, status: 'loaded' })}
        onError={() => setState({ src: resolved, status: 'failed' })}
      />
    </>
  );
}
