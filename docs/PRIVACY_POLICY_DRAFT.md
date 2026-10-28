# Privacy policy & consent — DRAFT for legal review

**Status: draft. Not reviewed by a lawyer. Nothing here or on `/privacy`
claims compliance with any law.** Production activation of the Meta Pixel
(setting a real `NEXT_PUBLIC_META_PIXEL_ID`) waits for this review.

The customer-facing text is the storefront page `/privacy`
(`frontend/src/app/privacy/page.tsx`, Arabic, kept out of search results
with `noindex` until approved). It describes only what the code does.

## What the code does (facts for the reviewer)

| Data | Collected when | Used for | Shared with |
|---|---|---|---|
| name, mobile, governorate, address, note, order contents/amounts | checkout | fulfilling and delivering the order, contact about it, bookkeeping | stored in the shop's database (Supabase, EU region); see open questions |
| account: name, mobile, password (bcrypt hash) | registration | sign-in, order history | — |
| cart, wishlist, sign-in token, consent choice | browsing (localStorage) | running the site | nobody (stays on the device) |
| Meta Pixel events (pages, product ids/prices/quantities, search terms, cart/checkout values, delivered order value + order id) | **only after the visitor accepts** | ad measurement | Meta Platforms |
| IP address, browser details, Meta cookies (`_fbp`) | only after acceptance, by Meta's script | Meta's own processing | Meta Platforms |

Consent behaviour (implemented, `docs/META_PIXEL.md`): opt-in, nothing
preselected, accept and reject equally prominent, reject = Meta's script
never loads and nothing is sent, change any time from the footer, choice
stored on the device (versioned; a new version asks again), no `<noscript>`
beacon.

## Open questions for the reviewer / owner

1. Is opt-in consent required for the Meta Pixel for Egyptian visitors under
   Law 151/2020 and its executive regulations, and is the banner wording
   sufficient? EU visitors (GDPR/ePrivacy) if any are targeted?
2. Who is the data controller (legal entity name, address) to name in the policy?
3. Data protection officer / licence obligations under Law 151/2020?
4. Retention periods for orders, accounts and logs (none are defined today).
5. Sharing with the courier / shipping company (which data, which company) —
   not described on the page because it isn't confirmed.
6. How customers exercise their rights (access, correction, deletion) — the
   page currently offers the shop's phone number only.
7. Cross-border transfer (Supabase EU region; Meta) — wording needed?
8. Whether a future server-side Conversions API (hashed phone) needs
   separate consent or disclosure.
9. Policy "last updated" date and how changes are announced.
