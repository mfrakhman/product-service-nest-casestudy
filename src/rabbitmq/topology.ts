/** Messaging topology names — single source: ARCHITECTURE.md §4. */
export const EXCHANGE = 'ordering';
export const DLX = 'ordering.dlx';
export const DEAD_LETTER_QUEUE = 'ordering.dead-letter';
export const ORDER_CREATED_QUEUE = 'product-service.order-created';

export const RK_ORDER_CREATED = 'order.created';
export const RK_STOCK_RESERVED = 'stock.reserved';
export const RK_STOCK_REJECTED = 'stock.rejected';
// spec-required (ARCHITECTURE.md §7.5) — no consumer bound to it in v3
export const RK_PRODUCT_CREATED = 'product.created';
