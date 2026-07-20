/** Event payloads (ARCHITECTURE.md §7.3) — shapes shared with order-service. */

export interface OrderCreatedEvent {
  orderId: string;
  productId: string;
  quantity: number;
  totalPrice: number;
  createdAt: string;
}

export interface StockReplyEvent {
  orderId: string;
  reason?: string; // rejected only
}
