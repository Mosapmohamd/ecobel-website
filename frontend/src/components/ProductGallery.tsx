'use client';

import { useRef, useState, type ReactNode } from 'react';
import ProductImage from './ProductImage';
import Icon from './Icon';

const ZOOM = 1.8;

/** Product page photos: the selected photo large, thumbnails below.
 * - Thumbnails are buttons (click, tap, or ←/→/Home/End on the strip);
 *   choosing one swaps the main photo in place — no navigation.
 * - With a mouse, hovering the main photo zooms it around the pointer
 *   (inside its frame, so nothing moves or overlaps); leaving restores it.
 *   Touch users get the previous/next buttons instead. Reduced motion:
 *   the zoom still works, without the animation. */
export default function ProductGallery({
  images,
  name,
  badge,
}: {
  /** Photo URLs, main photo first. Empty → the standard fallback. */
  images: string[];
  name: string;
  /** Overlay on the main photo (e.g. the discount badge). */
  badge?: ReactNode;
}) {
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = images.length;
  const index = Math.min(selected, Math.max(count - 1, 0));
  const current = images[index] ?? null;
  const label = (i: number) => (count > 1 ? `${name} — صورة ${(i + 1).toLocaleString('ar-EG')} من ${count.toLocaleString('ar-EG')}` : name);

  function select(i: number, focus = false) {
    const next = (i + count) % count;
    setSelected(next);
    setZoom(null);
    if (focus) thumbs.current[next]?.focus();
  }

  function onThumbKey(e: React.KeyboardEvent) {
    // RTL: ArrowLeft moves forward (towards the end of the row).
    const step = { ArrowLeft: 1, ArrowRight: -1 }[e.key as 'ArrowLeft' | 'ArrowRight'];
    if (step) select(index + step, true);
    else if (e.key === 'Home') select(0, true);
    else if (e.key === 'End') select(count - 1, true);
    else return;
    e.preventDefault();
  }

  function trackPointer(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse' || !current) return;
    // Over the previous/next buttons: no zoom, so they stay easy to use.
    if ((e.target as HTMLElement).closest('button')) {
      setZoom(null);
      return;
    }
    const box = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - box.left) / box.width) * 100, y: ((e.clientY - box.top) / box.height) * 100 });
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`relative aspect-square rounded overflow-hidden border border-line bg-surface-tint ${zoom ? 'cursor-zoom-in' : ''}`}
        onPointerEnter={trackPointer}
        onPointerMove={trackPointer}
        onPointerLeave={() => setZoom(null)}
        data-testid="gallery-main"
      >
        <div
          className="absolute inset-0 transition-transform duration-300 ease-out motion-reduce:transition-none will-change-transform"
          style={{
            transform: zoom ? `scale(${ZOOM})` : 'scale(1)',
            transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : 'center',
          }}
        >
          <ProductImage key={current ?? 'none'} src={current} alt={label(index)} sizes="(max-width: 767px) 100vw, 580px" preload={index === 0} />
        </div>
        {badge}
        {count > 1 && (
          <>
            <span className="sr-only" aria-live="polite">{`صورة ${(index + 1).toLocaleString('ar-EG')} من ${count.toLocaleString('ar-EG')}`}</span>
            <button
              type="button"
              className="gallery-nav right-2"
              aria-label="الصورة السابقة"
              onClick={() => select(index - 1)}
            >
              <Icon name="chevronLeft" size={18} className="rotate-180" />
            </button>
            <button
              type="button"
              className="gallery-nav left-2"
              aria-label="الصورة التالية"
              onClick={() => select(index + 1)}
            >
              <Icon name="chevronLeft" size={18} />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <ul className="flex gap-2 overflow-x-auto p-1 -m-1" aria-label={`صور ${name}`} onKeyDown={onThumbKey}>
          {images.map((url, i) => (
            <li key={url} className="flex-none">
              <button
                ref={(el) => {
                  thumbs.current[i] = el;
                }}
                type="button"
                className={`group relative block w-16 h-16 sm:w-20 sm:h-20 rounded overflow-hidden border-2 bg-surface-tint transition-colors ${
                  i === index ? 'border-primary' : 'border-line hover:border-ink-muted'
                }`}
                aria-label={`عرض ${label(i)}`}
                aria-current={i === index ? 'true' : undefined}
                tabIndex={i === index ? 0 : -1}
                onClick={() => select(i)}
              >
                <span className="absolute inset-0 transition-transform duration-200 ease-out motion-reduce:transition-none group-hover:scale-110">
                  <ProductImage src={url} alt="" sizes="80px" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
