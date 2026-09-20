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

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
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

export const staffApi = {
  login: async (username: string, password: string) => {
    const form = new URLSearchParams();
    form.set('username', username);
    form.set('password', password);
    const res = await fetch(`${API_BASE}/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!res.ok) {
      let detail = 'اسم المستخدم أو كلمة المرور غير صحيحة';
      try {
        const data = await res.json();
        if (typeof data.detail === 'string') detail = data.detail;
      } catch {
        // ignore
      }
      throw new Error(detail);
    }
    return res.json() as Promise<{ access_token: string; token_type: string }>;
  },
};

export interface RevenuePoint {
  date: string;
  total: number;
}

export interface TopProduct {
  product_name: string;
  quantity_sold: number;
  revenue: number;
}

export interface SalesAnalytics {
  total_revenue: number;
  total_orders: number;
  orders_by_status: Record<string, number>;
  revenue_last_30_days: RevenuePoint[];
  top_products: TopProduct[];
}

export const adminApi = {
  listOrders: (token: string, status?: string) =>
    request<Order[]>(`/orders/${status ? `?status=${status}` : ''}`, { token }),
  updateOrderStatus: (token: string, orderId: string, status: string) =>
    request<Order>(`/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status }), token }),

  listCoupons: (token: string) => request<Coupon[]>('/coupons/', { token }),
  createCoupon: (
    token: string,
    payload: {
      code: string;
      discount_type: 'percentage' | 'fixed';
      discount_value: number;
      min_order_amount?: number;
      limit_type: 'duration' | 'count' | 'unlimited';
      max_uses?: number;
      expires_at?: string;
    }
  ) => request<Coupon>('/coupons/', { method: 'POST', body: JSON.stringify(payload), token }),
  renewCoupon: (token: string, couponId: string) =>
    request<Coupon>(`/coupons/${couponId}/renew`, { method: 'POST', token }),
  deleteCoupon: (token: string, couponId: string) =>
    fetch(`${API_BASE}/coupons/${couponId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),

  listCategories: (token: string) => request<Category[]>('/admin/categories', { token }),
  createCategory: (token: string, name: string) =>
    request<Category>('/admin/categories', { method: 'POST', body: JSON.stringify({ name }), token }),
  updateCategory: (token: string, id: string, name: string) =>
    request<Category>(`/admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ name }), token }),
  deleteCategory: (token: string, id: string) =>
    fetch(`${API_BASE}/admin/categories/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),

  listAllProducts: (token: string) => request<Product[]>('/admin/products', { token }),
  createProduct: (
    token: string,
    payload: { name: string; category_id: string; sale_price: number; quantity: number; low_stock_threshold?: number; sku?: string }
  ) => request<Product>('/admin/products', { method: 'POST', body: JSON.stringify(payload), token }),
  updateProduct: (
    token: string,
    id: string,
    payload: Partial<{ name: string; category_id: string; sale_price: number; quantity: number; low_stock_threshold: number; is_active: boolean }>
  ) => request<Product>(`/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(payload), token }),
  deleteProduct: (token: string, id: string) =>
    fetch(`${API_BASE}/admin/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
  uploadProductImage: async (token: string, id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/admin/products/${id}/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) throw new Error('تعذر رفع الصورة');
    return res.json() as Promise<Product>;
  },

  analytics: (token: string) => request<SalesAnalytics>('/admin/analytics', { token }),
};
