/** Event payloads (ARCHITECTURE.md §4) — shapes shared with order-service. */

export interface OrderItemPayload {
  skuId: string;
  quantity: number;
}

export interface OrderCreatedEvent {
  orderId: string;
  items: OrderItemPayload[];
  createdAt: string;
}

export interface StockReplyEvent {
  orderId: string;
  reason?: string; // rejected only
}
