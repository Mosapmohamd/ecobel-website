import { redirect } from 'next/navigation';

// Checkout now lives on the cart page (one combined "السلة وإتمام الطلب"
// screen) — kept as a redirect so existing links and bookmarks still work.
export default function CheckoutPage() {
  redirect('/cart');
}
