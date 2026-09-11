export type OrderStatus = '입금 대기' | '입금 완료' | '택배 발송' | '도착 완료';

export type ShippingMethod = '택배' | '화물' | '직접수령';

export interface Product {
  id: string;
  name: string;
  price: number;
  capacity: string;
  weight: string;
  isAvailable: boolean;
  description: string;
  tags?: string[];
}

export interface Order {
  orderId: string;
  customerName: string;
  phoneNumber: string;
  address: string;
  productId: string;
  product: string;
  quantity: number;
  unitPrice: number;
  productPrice?: number; // 상품 순수 금액 (수량 × 단가)
  shippingMethod: ShippingMethod; // '택배' | '화물' | '직접수령'
  shippingFee: number; // 택배: 개당 6,600원, 화물: 0(별도문의), 직접수령: 0(후불)
  totalPrice: number; // 총 입금/결제 금액 (상품금액 + 운송료)
  shippingScheduledDate: string;
  status: OrderStatus;
  courierName?: string;
  trackingNumber?: string;
  orderDate: string;
  updatedAt?: string;
}

export interface StudioSettings {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  shippingNotice: string;
  studioName: string;
  studioPhone?: string;
  googleSheetId?: string;
  googleSheetUrl?: string;
  googleSheetName?: string;
  lastSyncedAt?: string;
  autoSyncEnabled?: boolean;
}
