'use client';

import { useState } from 'react';
import type { AnnouncementBarSettings } from '@/lib/api';
import Icon from './Icon';

/** Slim scrolling announcement above the promo bar. Its content and look
 * come from the settings staff save in the accounting system ("واجهة
 * المتجر" → شريط الإعلان), read at runtime — never from the code. Nothing
 * saved yet → the API's default; no settings, disabled, or no text → no bar.
 *
 * - Plain text only (the API validates; React escapes): an Arabic and/or an
 *   English text, each rendered in its own direction (never reversed).
 * - Screen readers get the text once (a static copy); the moving copies are
 *   decorative and hidden from them, so nothing is announced repeatedly.
 * - The scroll pauses with the pause button (moving content must be
 *   stoppable), and on hover only on devices that really hover — on touch
 *   screens a tap leaves :hover stuck. It doesn't move at all for people who
 *   ask for reduced motion, or when staff turned motion off.
 * - Direction "auto": with Arabic text it moves right (it enters where
 *   Arabic reading starts); English-only moves left.
 * - Optional link: a site path, or an https address opened in a new tab. */
export default function AnnouncementBar({ settings }: { settings: AnnouncementBarSettings | null }) {
  const [paused, setPaused] = useState(false);
  if (!settings?.enabled) return null;
  const texts = [
    settings.text_ar?.trim() ? { text: settings.text_ar.trim(), dir: 'rtl' as const } : null,
    settings.text_en?.trim() ? { text: settings.text_en.trim(), dir: 'ltr' as const } : null,
  ].filter((t): t is { text: string; dir: 'rtl' | 'ltr' } => t !== null);
  if (!texts.length) return null;

  const motion = settings.direction === 'auto' ? (texts[0].dir === 'rtl' ? 'right' : 'left') : settings.direction;
  const trackDir = motion === 'right' ? 'rtl' : 'ltr';
  const items = (key: string) =>
    texts.map((t, i) => (
      <span key={`${key}-${i}`} className="announcement-item" dir={t.dir}>{t.text}</span>
    ));
  // Two identical halves → the loop restarts seamlessly halfway through.
  const half = (
    <span className="announcement-half">
      {Array.from({ length: Math.max(2, 4 / texts.length) }, (_, i) => items(String(i)))}
    </span>
  );
  const content = (
    <>
      <span className="sr-only">
        {texts.map((t, i) => <span key={i} dir={t.dir}>{t.text}{i < texts.length - 1 ? ' — ' : ''}</span>)}
      </span>
      <span className="announcement-viewport" aria-hidden="true" dir={trackDir}>
        <span className="announcement-track" data-dir={trackDir}>
          {half}
          {half}
        </span>
        <span className="announcement-static">
          {texts.map((t, i) => <span key={i} dir={t.dir} className="announcement-static-item">{t.text}</span>)}
        </span>
      </span>
    </>
  );
  const link = settings.link_url;
  const external = !!link && link.startsWith('https://');

  return (
    <section
      aria-label="إعلان"
      className="announcement-bar"
      data-paused={paused || undefined}
      data-static={!settings.scrolling || undefined}
      data-theme={settings.theme}
      data-speed={settings.speed}
      data-visibility={settings.visibility}
    >
      {link ? (
        <a href={link} className="announcement-link" {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {content}
        </a>
      ) : (
        <div className="announcement-link">{content}</div>
      )}
      {settings.scrolling && (
        <button
          type="button"
          className="announcement-toggle"
          aria-pressed={paused}
          aria-label="إيقاف حركة الإعلان مؤقتًا"
          onClick={() => setPaused((p) => !p)}
        >
          <Icon name={paused ? 'play' : 'pause'} size={12} strokeWidth={2.2} />
        </button>
      )}
    </section>
  );
}
