import { Injectable } from '@nestjs/common';
import { Order } from './interfaces/order.interface';
import { SortedMap } from './classes/sorted-map';

@Injectable()
export class OrderBookService {
  private bids: SortedMap<number, Order[]>;
  private asks: SortedMap<number, Order[]>;
  private orders: Map<string, Order>;

  constructor() {
    // Bids: Descending price (Highest price first)
    this.bids = new SortedMap<number, Order[]>((a, b) => b - a);
    // Asks: Ascending price (Lowest price first)
    this.asks = new SortedMap<number, Order[]>((a, b) => a - b);
    this.orders = new Map();
  }

  addOrder(order: Order): void {
    this.orders.set(order.id, order);
    const book = order.side === 'buy' ? this.bids : this.asks;
    const ordersAtPrice = book.get(order.price) || [];
    ordersAtPrice.push(order);
    book.set(order.price, ordersAtPrice);
  }

  cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order) return false;

    order.status = 'cancelled';
    this.orders.delete(orderId);

    const book = order.side === 'buy' ? this.bids : this.asks;
    const ordersAtPrice = book.get(order.price);

    if (ordersAtPrice) {
      const index = ordersAtPrice.findIndex((o) => o.id === orderId);
      if (index !== -1) {
        ordersAtPrice.splice(index, 1);
        if (ordersAtPrice.length === 0) {
          book.delete(order.price);
        } else {
          book.set(order.price, ordersAtPrice);
        }
      }
    }
    return true;
  }

  getBestBid(): number | undefined {
    const iterator = this.bids.iterator();
    const result = iterator.next();
    return result.done ? undefined : result.value.key;
  }

  getBestAsk(): number | undefined {
    const iterator = this.asks.iterator();
    const result = iterator.next();
    return result.done ? undefined : result.value.key;
  }

  getDepth(levels: number = 10): {
    bids: [number, number][];
    asks: [number, number][];
  } {
    const bids: [number, number][] = [];
    const asks: [number, number][] = [];

    let count = 0;
    for (const { key, value } of this.bids.iterator()) {
      if (count >= levels) break;
      const quantity = value.reduce((sum, o) => sum + o.remainingQuantity, 0);
      bids.push([key, quantity]);
      count++;
    }

    count = 0;
    for (const { key, value } of this.asks.iterator()) {
      if (count >= levels) break;
      const quantity = value.reduce((sum, o) => sum + o.remainingQuantity, 0);
      asks.push([key, quantity]);
      count++;
    }

    return { bids, asks };
  }
}
