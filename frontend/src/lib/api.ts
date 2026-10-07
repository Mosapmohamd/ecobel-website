export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8002';

export interface Category {
  id: string;
  name: string;
  product_count: number;
}

export interface OfferBrief {
  id: string;
  title: string;
  offer_price: number;
}

/** A product as the storefront sells it. `price` is what checkout charges
 * (offers already applied server-side); `sale_price` is the regular price,
 * shown struck through when `offer` is set. */
export interface Product {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  sku: string | null;
  sale_price: number;
  price: number;
  offer: OfferBrief | null;
  stock_status: 'ok' | 'low' | 'out';
  /** Most that can be ordered now; 0 = unavailable. */
  max_quantity: number;
  image_url: string | null;
  description: string | null;
}

export interface ProductPage {
  items: Product[];
  total: number;
  limit: number;
  offset: number;
}

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'name';

export interface ProductQuery {
  categoryId?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  onOffer?: boolean;
  sort?: ProductSort;
  limit?: number;
  offset?: number;
}

export interface RoutineItem {
  product: Product;
  regular_price: number;
  price: number;
}

/** Priced from its products' current prices; `savings` = what live offers
 * take off `regular_total`. */
export interface Routine {
  id: string;
  name: string;
  description: string | null;
  items: RoutineItem[];
  regular_total: number;
  total: number;
  savings: number;
  is_available: boolean;
}

export type CartIssue = 'unavailable' | 'out_of_stock' | 'insufficient_stock';

export interface CartQuoteLine {
  product_id: string;
  quantity: number;
  product: Product | null;
  unit_price: number;
  regular_unit_price: number;
  line_total: number;
  issue: CartIssue | null;
}

/** The cart priced exactly as checkout will charge it. Discount, shipping
 * and total are only meaningful once a coupon / city were sent. */
export interface CartQuote {
  lines: CartQuoteLine[];
  subtotal: number;
  regular_subtotal: number;
  savings: number;
  has_issues: boolean;
  coupon: { code: string; valid: boolean; reason: string | null } | null;
  discount: number;
  /** null until a deliverable city is chosen (unless shipping is free). */
  shipping_fee: number | null;
  city_error: string | null;
  free_shipping_threshold: number;
  total: number;
}

export interface OrderItemIn {
  product_id: string;
  quantity: number;
}

export interface OrderItemOut {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  city: string | null;
  shipping_address: string;
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
  payment_method: string;
  subtotal: number;
  discount_amount: number;
  shipping_fee: number;
  total_amount: number;
  note: string | null;
  created_at: string;
  items: OrderItemOut[];
}

export interface OrderTrackSummary {
  order_number: string;
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
  total_amount: number;
  created_at: string;
}

/** Why a request failed — callers decide what each case means (e.g. only
 * an invalid session, never a network blip, signs the customer out).
 * `message` is always customer-facing Arabic. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: 'http' | 'network' | 'timeout',
    /** HTTP status for kind 'http'. */
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Fired when a signed-in request is rejected as unauthenticated (expired
 * or invalid token) — the auth provider signs the customer out. */
export const SESSION_EXPIRED_EVENT = 'ecobel:session-expired';

const REQUEST_TIMEOUT_MS = 15000;

async function request<T>(path: string, options?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string> || {}) };
  if (options?.token) headers.Authorization = `Bearer ${options.token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
  } catch {
    // Network down / server unreachable / too slow — the browser's own
    // message ("Failed to fetch") must never reach the customer.
    throw controller.signal.aborted
      ? new ApiError('الاتصال بطيء ومكملش — حاولي تاني', 'timeout')
      : new ApiError('تعذر الاتصال بالمتجر — اتأكدي من الإنترنت وحاولي تاني', 'network');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = res.status >= 500 ? 'حصلت مشكلة عندنا، حاولي تاني بعد شوية' : 'حصل خطأ، حاولي تاني';
    try {
      const data = await res.json();
      // The backend always answers with one Arabic sentence in `detail`.
      if (typeof data.detail === 'string') detail = data.detail;
    } catch {
      // ignore
    }
    if (res.status === 401 && options?.token && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(detail, 'http', res.status);
  }
  return res.json();
}

export const catalogApi = {
  categories: () => request<Category[]>('/catalog/categories'),
  products: (opts: ProductQuery = {}) => {
    const params = new URLSearchParams();
    if (opts.categoryId) params.set('category_id', opts.categoryId);
    if (opts.q) params.set('q', opts.q);
    if (opts.minPrice !== undefined) params.set('min_price', String(opts.minPrice));
    if (opts.maxPrice !== undefined) params.set('max_price', String(opts.maxPrice));
    if (opts.onOffer) params.set('on_offer', 'true');
    if (opts.sort) params.set('sort', opts.sort);
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.offset) params.set('offset', String(opts.offset));
    const qs = params.toString();
    return request<ProductPage>(`/catalog/products${qs ? `?${qs}` : ''}`);
  },
  product: (id: string) => request<Product>(`/catalog/products/${encodeURIComponent(id)}`),
  related: (id: string) => request<Product[]>(`/catalog/products/${encodeURIComponent(id)}/related`),
  featuredProducts: () => request<Product[]>('/catalog/featured-products'),
  /** All active routines, or with `q` only those whose name/description match. */
  routines: (q?: string) => request<Routine[]>(`/catalog/routines${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  routine: (id: string) => request<Routine>(`/catalog/routines/${encodeURIComponent(id)}`),
  featuredRoutines: () => request<Routine[]>('/catalog/featured-routines'),
  shippingRates: () => request<{ city: string; fee: number }[]>('/catalog/shipping-rates'),
};

export const cartApi = {
  quote: (items: OrderItemIn[], checkout: { city?: string; couponCode?: string } = {}) =>
    request<CartQuote>('/cart/quote', {
      method: 'POST',
      body: JSON.stringify({ items, city: checkout.city || undefined, coupon_code: checkout.couponCode || undefined }),
    }),
};

export const orderApi = {
  create: (payload: {
    customer_name: string;
    customer_phone: string;
    city: string;
    shipping_address: string;
    items: OrderItemIn[];
    coupon_code?: string;
    note?: string;
  }, token?: string) => request<Order>('/orders/', { method: 'POST', body: JSON.stringify(payload), token }),
  track: (opts: { orderNumber?: string; phone?: string }) => {
    const params = new URLSearchParams();
    if (opts.orderNumber) params.set('order_number', opts.orderNumber);
    if (opts.phone) params.set('phone', opts.phone);
    return request<Order | OrderTrackSummary[]>(`/orders/track?${params.toString()}`);
  },
  edit: (orderId: string, payload: { items: OrderItemIn[]; city?: string; shipping_address?: string; note?: string }, token: string) =>
    request<Order>(`/orders/${orderId}`, { method: 'PATCH', body: JSON.stringify(payload), token }),
  cancel: (orderId: string, token: string) =>
    request<Order>(`/orders/${orderId}`, { method: 'DELETE', token }),
};

export const accountApi = {
  register: (payload: { name: string; phone: string; email?: string; address?: string; password: string }) =>
    request<{ access_token: string; token_type: string }>('/account/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (phone: string, password: string) =>
    request<{ access_token: string; token_type: string }>('/account/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    }),
  me: (token: string) => request<Customer>('/account/me', { token }),
  updateMe: (token: string, payload: { name?: string; email?: string; address?: string }) =>
    request<Customer>('/account/me', { method: 'PATCH', body: JSON.stringify(payload), token }),
  myOrders: (token: string) => request<Order[]>('/account/orders', { token }),
};

// ---------------- Reviews ----------------
export interface Review {
  id: string;
  customer_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface ReviewSummary {
  average_rating: number;
  review_count: number;
  reviews: Review[];
}

export interface ReviewEligibility {
  can_review: boolean;
  reason: string | null;
}

export const reviewApi = {
  list: (productId: string) => request<ReviewSummary>(`/products/${productId}/reviews/`),
  eligibility: (productId: string, token: string) =>
    request<ReviewEligibility>(`/products/${productId}/reviews/eligibility`, { token }),
  create: (productId: string, payload: { rating: number; comment?: string }, token: string) =>
    request<Review>(`/products/${productId}/reviews/`, { method: 'POST', body: JSON.stringify(payload), token }),
};
