const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8001';

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  sku: string | null;
  sale_price: number;
  quantity: number;
  stock_status: 'ok' | 'low' | 'out';
  image_url: string | null;
  description: string | null;
}

export interface Offer {
  id: string;
  product_id: string;
  product_name: string;
  original_price: number;
  image_url: string | null;
  title: string;
  offer_price: number;
}

export interface RoutineItem {
  product_id: string;
  product_name: string;
  sale_price: number;
  image_url: string | null;
}

export interface Routine {
  id: string;
  name: string;
  description: string | null;
  items: RoutineItem[];
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

async function request<T>(path: string, options?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string> || {}) };
  if (options?.token) headers.Authorization = `Bearer ${options.token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = 'حصل خطأ، حاول تاني';
    try {
      const data = await res.json();
      if (typeof data.detail === 'string') detail = data.detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  return res.json();
}

export const catalogApi = {
  categories: () => request<Category[]>('/catalog/categories'),
  products: (opts?: { categoryId?: string; q?: string }) => {
    const params = new URLSearchParams();
    if (opts?.categoryId) params.set('category_id', opts.categoryId);
    if (opts?.q) params.set('q', opts.q);
    const qs = params.toString();
    return request<Product[]>(`/catalog/products${qs ? `?${qs}` : ''}`);
  },
  product: (id: string) => request<Product>(`/catalog/products/${id}`),
  offers: () => request<Offer[]>('/catalog/offers'),
  routines: () => request<Routine[]>('/catalog/routines'),
  shippingRates: () => request<{ city: string; fee: number }[]>('/catalog/shipping-rates'),
};

export const couponApi = {
  validate: (code: string, orderSubtotal: number) =>
    request<{ valid: boolean; reason?: string; discount_amount: number }>('/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code, order_subtotal: orderSubtotal }),
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
