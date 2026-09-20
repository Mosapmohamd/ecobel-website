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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
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
  products: (categoryId?: string) =>
    request<Product[]>(`/catalog/products${categoryId ? `?category_id=${categoryId}` : ''}`),
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
  }) => request<Order>('/orders/', { method: 'POST', body: JSON.stringify(payload) }),
  track: (orderNumber: string, phone: string) =>
    request<Order>(`/orders/track?order_number=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(phone)}`),
};
