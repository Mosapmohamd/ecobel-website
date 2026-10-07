'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Icon from './Icon';

/** One campaign banner. The banner art already carries its own headline,
 * copy and call to action, so the slide renders the image alone — no HTML
 * text on top of it — and the whole banner is the link. */
export interface HeroSlide {
  id: string;
  /** Desktop/tablet banner, ~3:1. */
  image: string;
  /** Optional phone crop (taller, larger type); falls back to `image`. */
  mobileImage?: string;
  /** What the banner says and shows — read out in place of the image. */
  alt: string;
  href: string;
}

const AUTOPLAY_MS = 5000;
const TRANSITION_MS = 700;
const SWIPE_THRESHOLD_PX = 50;
/** Width of each edge hover zone, as a fraction of the banner. */
const HOVER_ZONE = 0.3;
/** How long the controls stay visible after a touch. */
const TOUCH_REVEAL_MS = 2500;

const REDUCED = '(prefers-reduced-motion: reduce)';
function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
}

/**
 * RTL carousel: the track runs right→left, so the next slide arrives from
 * the left. Desktop: moving the cursor into the left edge reveals "next",
 * the right edge reveals "previous"; both stay hidden otherwise. Touch:
 * swipe, and a tap briefly reveals the controls. No dots, no pause button —
 * autoplay pauses on hover, keyboard focus, touch and a hidden tab, and is
 * off for reduced-motion users.
 */
export default function HeroCarousel({ slides, label = 'عروض Eco Bel' }: { slides: HeroSlide[]; label?: string }) {
  const count = slides.length;
  const looping = count > 1;
  const reducedMotion = usePrefersReducedMotion();

  // Track = [clone of last, ...slides, clone of first]. After animating onto
  // a clone we jump (no transition) to its real twin → seamless loop.
  const [pos, setPos] = useState(looping ? 1 : 0);
  const [animate, setAnimate] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [zone, setZone] = useState<'left' | 'right' | null>(null);
  const [touchReveal, setTouchReveal] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [dragPx, setDragPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);

  const drag = useRef<{ x: number; y: number; id: number; moved: boolean; axis: 'x' | 'y' | null } | null>(null);
  const suppressClick = useRef(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = looping ? (pos - 1 + count) % count : 0;
  const track = looping ? [slides[count - 1], ...slides, slides[0]] : slides;

  useEffect(() => {
    const onVis = () => setPageHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  useEffect(() => () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
  }, []);

  const goTo = useCallback(
    (nextPos: number) => {
      if (!looping) return;
      if (reducedMotion) {
        // No transition → no transitionend; wrap immediately.
        setAnimate(false);
        setPos(((nextPos - 1 + count) % count) + 1);
        return;
      }
      setAnimate(true);
      setPos(nextPos);
    },
    [looping, reducedMotion, count],
  );

  // Ignore input while parked on a clone mid-jump.
  const next = useCallback(() => {
    if (pos !== 0 && pos !== count + 1) goTo(pos + 1);
  }, [goTo, pos, count]);
  const prev = useCallback(() => {
    if (pos !== 0 && pos !== count + 1) goTo(pos - 1);
  }, [goTo, pos, count]);

  const onTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== e.currentTarget) return;
    if (pos === 0) {
      setAnimate(false);
      setPos(count);
    } else if (pos === count + 1) {
      setAnimate(false);
      setPos(1);
    }
  };

  // Re-enable the transition a frame after an instant jump.
  useEffect(() => {
    if (animate || reducedMotion) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    return () => cancelAnimationFrame(id);
  }, [animate, reducedMotion]);

  // Autoplay — re-armed on every slide change, so manual navigation always
  // gets a full interval.
  const paused = hovered || focusWithin || dragging || pageHidden || reducedMotion;
  useEffect(() => {
    if (!looping || paused) return;
    const t = setTimeout(next, AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [looping, paused, next, pos]);

  // ── Hover zones (mouse only) ───────────────────────────────────────────
  const onPointerMoveSection = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    setZone(x < HOVER_ZONE ? 'left' : x > 1 - HOVER_ZONE ? 'right' : null);
  };

  // ── Swipe (touch/pen) ──────────────────────────────────────────────────
  const revealForTouch = () => {
    setTouchReveal(true);
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => setTouchReveal(false), TOUCH_REVEAL_MS);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (!looping || e.pointerType === 'mouse') return;
    revealForTouch();
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, axis: null };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (d.axis === 'y') {
        drag.current = null; // vertical scroll — the page gets it
        return;
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(true);
    }
    d.moved = true;
    setDragPx(dx);
  };
  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || !d.moved) return;
    const dx = e.clientX - d.x;
    suppressClick.current = Math.abs(dx) > 10;
    setDragging(false);
    setDragPx(0);
    revealForTouch();
    // RTL: pulling the banner to the right brings in the next slide (from the left).
    if (dx > SWIPE_THRESHOLD_PX) next();
    else if (dx < -SWIPE_THRESHOLD_PX) prev();
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClick.current = false;
    }
  };

  // RTL keyboard: ← goes forward (next), → goes back (previous).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!looping || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    if (e.key === 'ArrowLeft') next();
    else prev();
  };

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className="relative mx-auto w-full max-w-[1920px] overflow-hidden bg-surface-tint"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'mouse') return;
        setHovered(false);
        setZone(null);
      }}
      onPointerMove={onPointerMoveSection}
      // Keyboard focus pauses; a mouse click on a control doesn't, so
      // autoplay still resumes once the cursor leaves.
      onFocus={(e) => {
        if ((e.target as HTMLElement).matches(':focus-visible')) setFocusWithin(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocusWithin(false);
      }}
      onKeyDown={onKeyDown}
    >
      <div
        className="relative overflow-hidden"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
      >
        <div
          className="flex"
          dir="rtl"
          // Announce slide changes only while the user is driving.
          aria-live={focusWithin ? 'polite' : 'off'}
          onTransitionEnd={onTransitionEnd}
          style={{
            transform: `translate3d(calc(${pos * 100}% + ${dragPx}px), 0, 0)`,
            transition: animate && !dragging && !reducedMotion ? `transform ${TRANSITION_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)` : 'none',
            willChange: 'transform',
          }}
        >
          {track.map((slide, i) => {
            const isClone = looping && (i === 0 || i === count + 1);
            const realIndex = looping ? (i - 1 + count) % count : i;
            const hidden = isClone || realIndex !== active;
            return (
              <div
                key={isClone ? `${slide.id}-clone-${i}` : slide.id}
                role={isClone ? undefined : 'group'}
                aria-roledescription={isClone ? undefined : 'slide'}
                aria-label={isClone ? undefined : `${(realIndex + 1).toLocaleString('ar-EG')} من ${count.toLocaleString('ar-EG')}`}
                aria-hidden={hidden || undefined}
                inert={hidden}
                className="relative flex-none w-full"
              >
                <Link href={slide.href} aria-label={slide.alt} className="block">
                  <BannerImage slide={slide} eager={realIndex === 0 && !isClone} />
                </Link>
              </div>
            );
          })}
        </div>

        {looping && (
          <>
            <EdgeControl side="right" label="الشريحة السابقة" visible={touchReveal || zone === 'right'} onClick={prev} />
            <EdgeControl side="left" label="الشريحة التالية" visible={touchReveal || zone === 'left'} onClick={next} />
          </>
        )}
      </div>
    </section>
  );
}

/** The banner at its own ~3:1 shape (no cropping of the baked-in copy);
 * a dedicated phone crop is used below md when the slide has one. */
function BannerImage({ slide, eager }: { slide: HeroSlide; eager: boolean }) {
  const common = { sizes: '(max-width: 1920px) 100vw, 1920px', preload: eager, className: 'w-full h-auto' };
  if (!slide.mobileImage) {
    return <Image {...common} alt="" src={slide.image} width={1900} height={630} />;
  }
  return (
    <>
      <Image {...common} alt="" src={slide.mobileImage} width={1200} height={900} className="w-full h-auto md:hidden" />
      <Image {...common} alt="" src={slide.image} width={1900} height={630} className="hidden md:block w-full h-auto" />
    </>
  );
}

/** Edge arrow, revealed by its hover zone, a recent touch, or keyboard
 * focus (see .hero-edge in globals.css). */
function EdgeControl({ side, visible, label, onClick }: { side: 'left' | 'right'; visible: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-side={side}
      data-visible={visible || undefined}
      className={`hero-edge absolute z-10 top-1/2 ${side === 'left' ? 'left-3 md:left-6' : 'right-3 md:right-6'} w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded border`}
    >
      {/* chevronLeft points left; flipped for the right-hand "previous" control */}
      <span className="inline-flex" style={{ transform: side === 'right' ? 'scaleX(-1)' : undefined }}>
        <Icon name="chevronLeft" size={22} />
      </span>
    </button>
  );
}
