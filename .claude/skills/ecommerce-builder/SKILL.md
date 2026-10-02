---
name: ecommerce-builder
description: StoreForge 10-phase ecommerce framework for building high-converting Shopify stores in <4h. Use when user says "build a store", "design the frontend", "make it look like X", "improve this website", "redo the homepage/PDP/collection", or any ecommerce store building task
---

# StoreForge — Ecommerce Store Builder

> Source: StoreForge Guide by ScaleUP Media / @mattganzak

## Core Targets (Non-Negotiable)
- Build time: Full store in **< 4 hours** from brand brief to live
- Baseline CVR: **> 2.5%** at launch (industry avg 1.8%)
- Tracking completeness: **100%** of funnel events from day one
- Page speed: **LCP < 2.5s** on all pages

---

## One-Prompt Build Mode (Default)

When user says anything like "build a store", "design the frontend", "improve this website":

ALWAYS include:
1. Phase 0.2 Competitor Continuation Loop
2. A prioritized change plan (Now / Next)
3. Implementation (theme edits / components / copy / layout)
4. Quick QA checklist (mobile, LCP, tracking)

**Output format (required):**
- (A) "What we're copying" (bullet list)
- (B) "What we're changing on your site" (ordered checklist)
- (C) "Implementation notes" (files/sections to touch)
- (D) "Before/after metrics to watch" (CVR, ATC, checkout completion, LCP)

---

## PHASE 0: Brand Discovery

### Step 0.1 — Brand Inputs (collect ALL before writing code)
| Input | Why It Matters |
|-------|---------------|
| Brand name | Logo, domain, SEO title tags |
| What they sell | Page structure, filtering, product complexity |
| Target customer | Voice, imagery, price anchoring, trust signals |
| Price range | Layout (luxury vs value), urgency tactics |
| Brand personality | Drives entire design system |
| USP | Hero copy, comparison tables, badge messaging |
| Competitors (2-5 URLs) | Direct benchmark + positioning |
| Existing assets | Logo, colors, fonts, photography |
| Business model | One-time, subscription, bundles, hybrid |
| Traffic sources | Landing page strategy, UTM personalization |

### Step 0.2 — Competitor Continuation Loop (MANDATORY)
**Always do this before implementing UI changes:**

1. **Direct competitors (2-5)** — user-provided URLs; if none, find them
2. **Best-in-class references (5-10)** — strongest stores in/near category + general best-in-class ecommerce UX
3. **Extract patterns** (copy structure, not branding):
   - Homepage section order + above-the-fold composition
   - Collection page grid + filters + sorting
   - PDP: ATF layout, gallery, sticky ATC, reviews, FAQs
   - Cart UX: slideout, free-ship bar, upsells
   - Trust: shipping/returns clarity, guarantees, payment badges, social proof density
4. **Decide: what we're copying + what we're differentiating**
5. **Ship improvements in same session** — prioritize: clarity > trust > speed > friction removal

### Step 0.3 — Competitor Audit
Score each competitor 1-10: First Impression, Visual Quality, Navigation, Product Pages, Mobile, Checkout, Page Speed, Trust Signals, Conversion Tactics, Differentiation

---

## PHASE 1: Store Architecture

### Navigation Rules
- Main nav: **Max 5-7 items**. Mega menus with imagery (outperforms text-only 20-30%)
- Search: Persistent, prominent, autocomplete + product images (search users convert **2-3x higher**)
- Sticky header: Logo + search + cart minimum
- **Never deeper than 3 clicks to any product**

---

## PHASE 2: UI Design System

### Color Palette (6 roles)
| Role | Purpose |
|------|---------|
| Primary | CTA buttons, links, active states |
| Primary Dark | Hover states, headings, footer bg |
| Secondary | Secondary buttons, badges, tags |
| Neutral Dark | Body text (#1A1A1A — never pure black) |
| Neutral Light | Backgrounds, cards (#F7F7F7) |
| White | Page background (#FFFFFF) |

- CTA contrast: **>= 4.5:1** (WCAG AA)
- Sale prices: Always red/bold — **never same color as regular price**

### Typography (2 fonts max)
| Element | Size | Weight |
|---------|------|--------|
| Hero headline | 48-72px / 28-36px mobile | Bold |
| Section headline | 32-40px | Bold/semibold |
| Body text | **16px minimum** | Regular, 1.6 line-height |
| Price | 20-28px | Bold |
| Labels/badges | 12px uppercase | Wide letter-spacing |

### Spacing: 8px base grid
4px micro | 8px tight | 16px small | 24px medium | 32px large | 48px section-gap | 64px section-padding | 96px hero-padding

---

## PHASE 3: Homepage Layout

**Homepage's one job: get visitors to a product page as fast as possible.**

### High-Converting Section Order
| # | Section | Notes |
|---|---------|-------|
| 1 | Announcement Bar | Free shipping threshold, rotating messages |
| 2 | Hero Section | Full-width image, benefit-driven headline, ONE CTA |
| 3 | Social Proof Bar | "As seen in" logos OR "10,000+ happy customers" |
| 4 | Featured Categories | 3-4 category cards with lifestyle imagery |
| 5 | Bestsellers | 4-8 product cards, "Shop All" link |
| 6 | Value Props Strip | Free Shipping, Easy Returns, Secure Pay |
| 7 | Brand Story | Split layout: image + 2-3 sentences + Learn More |
| 8 | UGC / Reviews | Customer photos or 3 featured review cards |
| 9 | New Arrivals | 4-6 product cards |
| 10 | Email Signup | "10% off first order" — email only |

### Critical Rules
- Hero LCP **< 2.5 seconds**
- **ONE primary CTA** above the fold
- Products viewable within 1.5 viewport heights
- Alternate section backgrounds (white / light gray)
- **NO auto-playing carousels** — static images convert **30-40% better**

---

## PHASE 4: Product Pages

**Where money is made or lost.**

### Above-the-Fold (Desktop)
```
[IMAGE GALLERY]          [PRODUCT INFO]
Main image (zoomable)    Breadcrumb
Thumbnails               Product Name (H1)
                         Stars + Review Count
                         Price (or Sale Price)
                         Short description
                         Variant selectors
                         Quantity picker
                         [ADD TO CART] button
                         [Express Pay buttons]
                         Trust badges row
```

### Must-Have Conversion Elements
| Element | Impact |
|---------|--------|
| Star rating + count (clickable -> reviews) | Trust instantly |
| Trust badges below ATC | Reduces purchase anxiety |
| "Only X left" (only when TRUE) | Creates urgency |
| Estimated delivery date | Reduces uncertainty |
| Sticky ATC bar (on scroll) | Never lose buy button |
| Express checkout (Apple Pay) | 1-tap purchase path |
| Installments ("4 payments of $12") | Lowers perceived price |

---

## PHASE 5: Cart & Checkout

### Slide-Out Cart (Not Cart Page)
- Free shipping progress bar — **lifts AOV 5-15%**
- Upsell: "Add [product] for $12 more"
- Promo code **COLLAPSED by default**

### Checkout (Max 3 Steps)
1. Information — email, shipping, phone (Google autocomplete, guest checkout ALWAYS)
2. Shipping — methods + **concrete delivery dates**
3. Payment — card, Shop Pay, Apple Pay, Google Pay, PayPal, BNPL

**Guest checkout ALWAYS** — 34% abandon due to forced account creation.

---

## PHASE 6: Tracking Infrastructure

**Never hardcode pixels. Use GTM.**

### GA4 Events
| Event | Fires When |
|-------|-----------|
| page_view | Every page load |
| view_item | Product page |
| view_item_list | Collection page |
| add_to_cart | ATC click |
| begin_checkout | Checkout start |
| purchase | **Confirmation page (CRITICAL)** |

### Meta Pixel + CAPI
- **Always implement CAPI alongside browser pixel** — browser alone misses 10-30%
- Event deduplication with matching event_id

### QA Checklist
- [ ] All tags fire correctly (GTM Preview mode)
- [ ] GA4 events appear (DebugView)
- [ ] Meta events fire (Events Manager)
- [ ] Purchase fires ONCE only
- [ ] CAPI deduplication works

---

## PHASE 7: SEO Foundation

Every page needs: unique title, unique meta description, canonical URL, OG tags, JSON-LD schema.

### Schema by Page Type
| Page | Schema |
|------|--------|
| Homepage | Organization + WebSite |
| Product | Product + Offer (price, availability, rating) |
| Collection | CollectionPage + ItemList |
| Blog | Article |
| FAQ | FAQPage |

### Speed Targets
LCP < 2.5s | FID < 100ms | CLS < 0.1 | Page weight < 1.5MB ideal

---

## PHASE 8: Mobile-First

60%+ of traffic is mobile.

- Sticky bottom bar: [Wishlist] [Add to Cart]
- Horizontal swipe gallery with dots
- **48px minimum tap targets**
- **14-16px minimum body text**
- Accordions for details
- 2-column product grid (never 1)

---

## PHASE 9: Post-Launch

### Abandoned Cart Email Sequence
1. 1 hour — cart contents + images + CTA
2. 24 hours — cart + social proof (review snippet)
3. 72 hours — cart + small discount (5-10%)

### A/B Testing Priority
1. CTA button text
2. Hero image/headline variants
3. Free shipping threshold
4. PDP layout
5. Pop-up offer
6. Checkout flow

### Key Metrics
| Metric | Good | Great | Elite |
|--------|------|-------|-------|
| CVR | 2% | 3% | 4%+ |
| ATC rate | 8% | 10% | 12%+ |
| Cart-to-checkout | 40% | 50% | 60%+ |
| Mobile CVR | 1.5% | 2% | 3%+ |
| LCP | < 3.0s | < 2.5s | < 1.5s |

---

## 13 Conversion Wins (Track Across All Stores)

1. **Trust badges next to ATC** — +15-20% CVR
2. **Sidebar filters on collections** — -20% bounce
3. **Hero banner on collection pages** — frames shopping experience
4. **Product-type-specific content** — dynamic descriptions/FAQ/specs
5. **Star ratings as scroll-to-reviews link** — trust above fold
6. **Sticky ATC bar** — never lose buy button
7. **Quantity stepper with -/+ buttons** — better UX
8. **Collapsible "What's Included" above fold** — progressive disclosure
9. **Final CTA section at page bottom** — catches full-scroll users
10. **Quick-add on collection cards** — AJAX cart, reduces friction
11. **Remove ALL emojis** — use SVG icons instead (emojis signal AI-generated)
12. **Eyebrow text** (uppercase label above heading) instead of emoji headings
13. **Trust badges: SVG icon + text horizontal row** — no colored boxes

---

## Integration Points
- **visual-prompting**: All product photography, hero banners, ad creative
- **researcher**: Competitor research (Phase 0.2), market analysis
- **know-me**: Track client brand preferences across builds
