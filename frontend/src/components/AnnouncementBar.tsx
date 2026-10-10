'use client';

import { useState } from 'react';
import { ANNOUNCEMENT } from '@/lib/constants';
import Icon from './Icon';

/** Slim scrolling announcement above the promo bar (text: ANNOUNCEMENT in
 * lib/constants.ts).
 *
 * - Screen readers get the text once (a static copy); the moving copies are
 *   decorative and hidden from them, so nothing is announced repeatedly.
 * - The scroll pauses with the pause button (moving content must be
 *   stoppable), and on hover only on devices that really hover — on touch
 *   screens a tap leaves :hover stuck, which would keep it paused after
 *   Play. It doesn't move at all for people who ask for reduced motion.
 * - The button keeps one label; `aria-pressed` says whether it's paused.
 * - Arabic scrolls left-to-right (it enters where Arabic reading starts),
 *   English right-to-left. */
export default function AnnouncementBar() {
  const [paused, setPaused] = useState(false);
  const { enabled, text, dir } = ANNOUNCEMENT;
  if (!enabled || !text.trim()) return null;

  // Two identical halves → the loop restarts seamlessly halfway through.
  const half = (
    <span className="announcement-half">
      {Array.from({ length: 4 }, (_, i) => (
        <span key={i} className="announcement-item">{text}</span>
      ))}
    </span>
  );

  return (
    <section aria-label="إعلان" className="announcement-bar" data-paused={paused || undefined}>
      <p className="sr-only" dir={dir}>{text}</p>
      <div className="announcement-viewport" aria-hidden="true" dir={dir}>
        <div className="announcement-track" data-dir={dir}>
          {half}
          {half}
        </div>
        <span className="announcement-static">{text}</span>
      </div>
      <button
        type="button"
        className="announcement-toggle"
        aria-pressed={paused}
        aria-label="إيقاف حركة الإعلان مؤقتًا"
        onClick={() => setPaused((p) => !p)}
      >
        <Icon name={paused ? 'play' : 'pause'} size={12} strokeWidth={2.2} />
      </button>
    </section>
  );
}
