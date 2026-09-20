"""Website tables (customers, coupons, orders, order_items, staff_users)

This migration owns ONLY the website-specific tables. It intentionally
does NOT create `categories`, `products`, `inventory_movements`, or
`finance_entries` — those are shared tables owned and migrated by
ecobel-accounting-system. In production, run that service's migrations
against the shared database FIRST so those tables (and their FK targets)
already exist before this migration runs.

For local/standalone development without a real shared Postgres yet, see
dev_bootstrap_shared_tables.py, which creates just those shared tables
against your local SQLite file so this service can be tested in isolation.

Revision ID: ada8410f3eb2
Revises:
Create Date: 2026-09-20 11:05:14.902884

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ada8410f3eb2'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('coupons',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('code', sa.String(), nullable=False),
    sa.Column('discount_type', sa.Enum('percentage', 'fixed', name='coupondiscounttype'), nullable=False),
    sa.Column('discount_value', sa.Float(), nullable=False),
    sa.Column('min_order_amount', sa.Float(), nullable=False),
    sa.Column('max_uses', sa.Integer(), nullable=True),
    sa.Column('used_count', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_coupons_code'), 'coupons', ['code'], unique=True)
    op.create_table('customers',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('phone', sa.String(), nullable=False),
    sa.Column('email', sa.String(), nullable=True),
    sa.Column('address', sa.Text(), nullable=True),
    sa.Column('hashed_password', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_customers_phone'), 'customers', ['phone'], unique=False)
    op.create_table('staff_users',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('username', sa.String(), nullable=False),
    sa.Column('hashed_password', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_staff_users_username'), 'staff_users', ['username'], unique=True)
    op.create_table('orders',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('order_number', sa.String(), nullable=False),
    sa.Column('customer_id', sa.String(), nullable=True),
    sa.Column('customer_name', sa.String(), nullable=False),
    sa.Column('customer_phone', sa.String(), nullable=False),
    sa.Column('shipping_address', sa.Text(), nullable=False),
    sa.Column('status', sa.Enum('pending', 'shipped', 'delivered', 'cancelled', name='orderstatus'), nullable=False),
    sa.Column('payment_method', sa.String(), nullable=False),
    sa.Column('subtotal', sa.Float(), nullable=False),
    sa.Column('coupon_id', sa.String(), nullable=True),
    sa.Column('discount_amount', sa.Float(), nullable=False),
    sa.Column('shipping_fee', sa.Float(), nullable=False),
    sa.Column('total_amount', sa.Float(), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['coupon_id'], ['coupons.id'], ),
    sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_orders_order_number'), 'orders', ['order_number'], unique=True)
    op.create_table('order_items',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('order_id', sa.String(), nullable=False),
    sa.Column('product_id', sa.String(), nullable=False),
    sa.Column('product_name', sa.String(), nullable=False),
    sa.Column('unit_price', sa.Float(), nullable=False),
    sa.Column('quantity', sa.Integer(), nullable=False),
    sa.Column('line_total', sa.Float(), nullable=False),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('order_items')
    op.drop_index(op.f('ix_orders_order_number'), table_name='orders')
    op.drop_table('orders')
    op.drop_index(op.f('ix_staff_users_username'), table_name='staff_users')
    op.drop_table('staff_users')
    op.drop_index(op.f('ix_customers_phone'), table_name='customers')
    op.drop_table('customers')
    op.drop_index(op.f('ix_coupons_code'), table_name='coupons')
    op.drop_table('coupons')
