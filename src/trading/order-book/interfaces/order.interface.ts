export interface Order {
  id: string;
  userId: string;
  side: 'buy' | 'sell';
  type: 'limit';
  price: number;
  quantity: number;
  remainingQuantity: number;
  createdAt: Date;
  status: 'open' | 'filled' | 'cancelled' | 'partial';
}
