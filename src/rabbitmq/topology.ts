/** Messaging topology names — single source: ARCHITECTURE.md §4. */
export const EXCHANGE = 'ordering';
export const DLX = 'ordering.dlx';
export const DEAD_LETTER_QUEUE = 'ordering.dead-letter';
export const ORDER_CREATED_QUEUE = 'product-service.order-created';

export const RK_ORDER_CREATED = 'order.created';
export const RK_STOCK_RESERVED = 'stock.reserved';
export const RK_STOCK_REJECTED = 'stock.rejected';
