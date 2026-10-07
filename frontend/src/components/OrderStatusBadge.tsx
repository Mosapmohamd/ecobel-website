import Icon, { type IconName } from './Icon';
import { egp } from '@/lib/constants';
import type { Order } from '@/lib/api';

type Status = Order['status'];

export const ORDER_STATUS_LABEL: Record<Status, string> = {
  pending: 'قيد التجهيز',
  shipped: 'في الطريق',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
};

const STYLE: Record<Status, { icon: IconName; bg: string; color: string }> = {
  pending: { icon: 'box', bg: 'var(--color-surface-muted)', color: 'var(--color-primary-hover)' },
  shipped: { icon: 'truck', bg: 'color-mix(in srgb, var(--color-success) 14%, transparent)', color: 'var(--color-success-strong)' },
  delivered: { icon: 'checkCircle', bg: 'color-mix(in srgb, var(--color-success) 14%, transparent)', color: 'var(--color-success-strong)' },
  cancelled: { icon: 'close', bg: 'color-mix(in srgb, var(--color-error) 8%, transparent)', color: 'var(--color-error)' },
};

/** One look for an order's status everywhere (account, tracking). */
export default function OrderStatusBadge({ status }: { status: Status }) {
  const st = STYLE[status];
  return (
    <span className="badge inline-flex items-center gap-1" style={{ background: st.bg, color: st.color }}>
      <Icon name={st.icon} size={13} />
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}

/** Subtotal → discount → shipping → total, as charged. */
export function OrderTotals({ order }: { order: Pick<Order, 'subtotal' | 'discount_amount' | 'shipping_fee' | 'total_amount'> }) {
  return (
    <dl className="flex flex-col gap-1 text-[13px]">
      <div className="flex justify-between text-ink-secondary">
        <dt>المجموع الفرعي</dt>
        <dd>{egp(order.subtotal)}</dd>
      </div>
      {order.discount_amount > 0 && (
        <div className="flex justify-between text-success-strong">
          <dt>الخصم</dt>
          <dd>-{egp(order.discount_amount)}</dd>
        </div>
      )}
      <div className="flex justify-between text-ink-secondary">
        <dt>الشحن</dt>
        <dd>{order.shipping_fee === 0 ? 'مجاني' : egp(order.shipping_fee)}</dd>
      </div>
      <div className="flex justify-between font-bold text-[14.5px] pt-1.5 mt-1 border-t border-line">
        <dt>الإجمالي</dt>
        <dd>{egp(order.total_amount)}</dd>
      </div>
    </dl>
  );
}
