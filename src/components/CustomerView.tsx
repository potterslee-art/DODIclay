import React, { useState } from 'react';
import {
  Package,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  MapPin,
  Phone,
  User,
  Info,
  Copy,
  Sparkles,
  Truck,
  Building,
} from 'lucide-react';
import type { Product, Order, StudioSettings, ShippingMethod } from '../types.ts';
import { OrderStatusCard } from './OrderStatusCard.tsx';

interface CustomerViewProps {
  products: Product[];
  settings: StudioSettings | null;
  nextShippingDate: string;
  activeOrder: Order | null;
  onRefreshActiveOrder: () => void;
  isRefreshingOrder?: boolean;
  onNewOrder: () => void;
  onOrderCreated: (order: Order) => void;
  onCopyText: (text: string, label: string) => void;
}

export const CustomerView: React.FC<CustomerViewProps> = ({
  products,
  settings,
  nextShippingDate,
  activeOrder,
  onRefreshActiveOrder,
  isRefreshingOrder,
  onNewOrder,
  onOrderCreated,
  onCopyText,
}) => {
  // If activeOrder is present, show the Order Status Card (Live Customer Order Status)
  if (activeOrder) {
    return (
      <div className="space-y-6">
        <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#E8E0D5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#8A502E]" />
            <span className="text-xs sm:text-sm font-semibold text-[#44362B]">
              고객님의 주문이 접수되어 처리 중입니다.
            </span>
          </div>
          <button
            type="button"
            onClick={onNewOrder}
            className="text-xs font-semibold text-[#8A502E] hover:underline"
          >
            새 주문서 작성
          </button>
        </div>

        <OrderStatusCard
          order={activeOrder}
          settings={settings}
          onRefresh={onRefreshActiveOrder}
          isRefreshing={isRefreshingOrder}
          onNewOrder={onNewOrder}
          onCopyText={onCopyText}
        />
      </div>
    );
  }

  // Otherwise, render the streamlined single-screen order form
  const [selectedProductId, setSelectedProductId] = useState<string>(
    products[0]?.id || 'clay'
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('택배');
  const [customerName, setCustomerName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const isAvailable = selectedProduct?.isAvailable ?? true;
  const unitPrice = selectedProduct?.price ?? 0;
  const productPrice = unitPrice * Math.max(1, quantity);
  // 택배: 1개당 6,600원 / 화물: 별도문의(0원) / 직접수령: 후불(0원)
  const shippingFee = shippingMethod === '택배' ? Math.max(1, quantity) * 6600 : 0;
  const totalPrice = productPrice + shippingFee;

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  const handleManualQuantity = (val: string) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1) {
      setQuantity(1);
    } else {
      setQuantity(Math.min(999, num));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedProduct) {
      setErrorMsg('상품을 선택해주세요.');
      return;
    }

    if (!isAvailable) {
      setErrorMsg(`현재 [${selectedProduct.name}] 상품은 주문 마감 상태입니다.`);
      return;
    }

    if (!customerName.trim()) {
      setErrorMsg('주문자명을 입력해주세요.');
      return;
    }

    if (!phoneNumber.trim()) {
      setErrorMsg('연락처(휴대폰 번호)를 입력해주세요.');
      return;
    }

    const effectiveAddress = (shippingMethod === '직접수령' && !address.trim())
      ? '도디 공방 직접 방문 수령'
      : address.trim();

    if (!effectiveAddress) {
      setErrorMsg('배송지 주소를 상세히 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity,
          customerName: customerName.trim(),
          phoneNumber: phoneNumber.trim(),
          address: effectiveAddress,
          shippingMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || '주문 접수에 실패했습니다.');
        return;
      }

      // Order created! Pass back to display live status card
      onOrderCreated(data.order);
    } catch (err) {
      console.error(err);
      setErrorMsg('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-8">
      {/* Introduction Banner */}
      <div className="bg-[#FAF7F2] border border-[#E8E0D5] rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-[#F0E6DC] text-[#8A502E] shrink-0 mt-0.5">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#2D241E]">
              도예 재료 간편 주문서
            </h2>
            <p className="text-xs sm:text-sm text-[#7D6B5D] mt-0.5 leading-relaxed">
              점토 및 슬립의 실시간 가격과 주문 가능 여부를 확인하시고 간편하게 주문하실 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      {/* 1. 상품 선택 (점토 / 슬립) */}
      <div className="bg-[#FAF7F2] border border-[#E3DACF] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#2D241E] flex items-center gap-1.5">
            <span className="w-1.5 h-4 bg-[#8A502E] rounded-full inline-block" />
            1. 상품 선택
          </h3>
          <span className="text-xs text-[#8A7A6D]">필수 선택</span>
        </div>

        {/* Product Selection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {products.map((prod) => {
            const isSelected = selectedProductId === prod.id;
            return (
              <button
                key={prod.id}
                type="button"
                onClick={() => setSelectedProductId(prod.id)}
                className={`relative text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#8A502E] bg-[#FFFDFB] shadow-xs ring-2 ring-[#8A502E]/10'
                    : 'border-[#E6DFD5] bg-white hover:border-[#D5C7B7]'
                }`}
              >
                {/* Availability Badge */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${
                      prod.isAvailable
                        ? 'bg-[#EAF3EC] text-[#285736]'
                        : 'bg-[#FBEBE8] text-[#972B1B]'
                    }`}
                  >
                    {prod.isAvailable ? '🟢 주문 가능' : '🔴 주문 마감'}
                  </span>
                  {isSelected && (
                    <span className="text-xs font-bold text-[#8A502E] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      선택됨
                    </span>
                  )}
                </div>

                <div className="font-bold text-base text-[#2D241E] flex items-baseline justify-between">
                  <span>{prod.name}</span>
                  <span className="text-[#8A502E] text-base font-extrabold">
                    {prod.price.toLocaleString()}원
                  </span>
                </div>

                <div className="mt-2 text-xs text-[#6F5D4F] flex flex-wrap gap-x-3 gap-y-1">
                  <span>용량: <strong>{prod.capacity}</strong></span>
                  <span>중량: <strong>{prod.weight}</strong></span>
                </div>

                <p className="mt-2 text-[11px] text-[#8C7B6F] leading-snug">
                  {prod.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Selected Product Specs Summary */}
        {selectedProduct && (
          <div className="p-3.5 rounded-xl bg-[#F3ECE4] border border-[#E3D8CC] text-xs space-y-1.5">
            <div className="font-bold text-[#4F3C2F] flex items-center justify-between">
              <span>선택 상품: [{selectedProduct.name}]</span>
              <span>{selectedProduct.isAvailable ? '🟢 현재 주문 가능' : '🔴 현재 주문 마감'}</span>
            </div>
            <div className="text-[#6D5A4C] flex gap-4">
              <span>• 용량: <strong>{selectedProduct.capacity}</strong></span>
              <span>• 중량: <strong>{selectedProduct.weight}</strong></span>
              <span>• 단가: <strong>{selectedProduct.price.toLocaleString()}원</strong></span>
            </div>
            {!isAvailable && (
              <p className="text-[#962A1A] font-medium pt-1">
                ⚠️ 현재 {selectedProduct.name} 상품은 재고 소진으로 주문이 마감되었습니다.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 2. 주문 수량 및 금액 자동 계산 */}
      <div className="bg-[#FAF7F2] border border-[#E3DACF] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#2D241E] flex items-center gap-1.5">
            <span className="w-1.5 h-4 bg-[#8A502E] rounded-full inline-block" />
            2. 주문 수량
          </h3>
          <span className="text-xs text-[#8A7A6D]">통(20L 단위)</span>
        </div>

        <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-[#E5DCD1]">
          <span className="text-xs sm:text-sm font-medium text-[#4D3C2E]">수량 선택</span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleQuantityChange(-1)}
              disabled={quantity <= 1}
              className="w-9 h-9 rounded-lg border border-[#D5C8B9] bg-[#FAF7F2] hover:bg-[#EFE8DE] disabled:opacity-35 flex items-center justify-center text-[#4C3B2E] transition-colors"
              aria-label="수량 감소"
            >
              <Minus className="w-4 h-4" />
            </button>

            <input
              type="number"
              min="1"
              max="999"
              value={quantity}
              onChange={(e) => handleManualQuantity(e.target.value)}
              className="w-16 h-9 text-center font-bold text-base text-[#2D241E] bg-white border border-[#D5C8B9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8A502E]"
            />

            <button
              type="button"
              onClick={() => handleQuantityChange(1)}
              className="w-9 h-9 rounded-lg border border-[#D5C8B9] bg-[#FAF7F2] hover:bg-[#EFE8DE] flex items-center justify-center text-[#4C3B2E] transition-colors"
              aria-label="수량 증가"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Total Price Auto Calculation Callout */}
        <div className="p-4 rounded-xl bg-[#F6EEE5] border border-[#E4D8CB] space-y-2">
          <div className="flex items-center justify-between text-xs text-[#7D6A5C]">
            <span>상품 금액 ({quantity}통)</span>
            <span className="font-semibold text-[#3D2F24]">{productPrice.toLocaleString()}원</span>
          </div>
          <div className="flex items-center justify-between text-xs text-[#7D6A5C]">
            <span>운송료 ({shippingMethod})</span>
            <span className="font-semibold text-[#8A502E]">
              {shippingMethod === '택배'
                ? `+${(quantity * 6600).toLocaleString()}원 (개당 6,600원)`
                : shippingMethod === '화물'
                ? '별도문의'
                : '0원 (후불/방문)'}
            </span>
          </div>
          <div className="pt-2 border-t border-[#E3D6C6] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#4F3E31]">총 주문금액 (자동 계산)</span>
              {shippingMethod === '화물' && (
                <p className="text-[11px] text-[#A25F37] mt-0.5">※ 화물 운임은 별도 협의 후 안내</p>
              )}
            </div>
            <div className="text-right">
              <span className="font-extrabold text-lg sm:text-2xl text-[#8A502E]">
                {totalPrice.toLocaleString()}
              </span>
              <span className="text-sm font-bold text-[#8A502E] ml-1">원</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 운송 방법 선택 및 배송 안내 */}
      <div className="bg-[#FAF7F2] border border-[#E3DACF] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#2D241E] flex items-center gap-1.5">
            <span className="w-1.5 h-4 bg-[#8A502E] rounded-full inline-block" />
            3. 운송 방법 선택
          </h3>
          <span className="text-xs text-[#8A7A6D]">필수 선택</span>
        </div>

        {/* 3 Shipping Options: 택배, 화물, 직접수령 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 택배 */}
          <button
            type="button"
            onClick={() => setShippingMethod('택배')}
            className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              shippingMethod === '택배'
                ? 'border-[#8A502E] bg-[#FFFDFB] shadow-xs ring-2 ring-[#8A502E]/10'
                : 'border-[#E6DFD5] bg-white hover:border-[#D5C7B7]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm text-[#2D241E] flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-[#8A502E]" />
                  택배
                </span>
                {shippingMethod === '택배' && (
                  <CheckCircle2 className="w-4 h-4 text-[#8A502E]" />
                )}
              </div>
              <p className="text-xs text-[#7D6B5D] leading-snug">
                전용 화물 택배 안전 배송
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[#F0E8DE]">
              <span className="inline-block text-xs font-bold text-[#8A502E] bg-[#F7ECE1] px-2 py-0.5 rounded">
                1개당 6,600원
              </span>
              <div className="text-[11px] text-[#8C7A6E] mt-1 font-medium">
                {quantity}개 × 6,600원 = {(quantity * 6600).toLocaleString()}원
              </div>
            </div>
          </button>

          {/* 화물 */}
          <button
            type="button"
            onClick={() => setShippingMethod('화물')}
            className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              shippingMethod === '화물'
                ? 'border-[#8A502E] bg-[#FFFDFB] shadow-xs ring-2 ring-[#8A502E]/10'
                : 'border-[#E6DFD5] bg-white hover:border-[#D5C7B7]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm text-[#2D241E] flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-[#8A502E]" />
                  화물
                </span>
                {shippingMethod === '화물' && (
                  <CheckCircle2 className="w-4 h-4 text-[#8A502E]" />
                )}
              </div>
              <p className="text-xs text-[#7D6B5D] leading-snug">
                용차 또는 대량 화물 배송
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[#F0E8DE]">
              <span className="inline-block text-xs font-bold text-[#4B3C2F] bg-[#ECE5DB] px-2 py-0.5 rounded">
                별도문의
              </span>
              <div className="text-[11px] text-[#8C7A6E] mt-1 font-medium">
                주문 접수 후 운임 별도 안내
              </div>
            </div>
          </button>

          {/* 직접수령 */}
          <button
            type="button"
            onClick={() => setShippingMethod('직접수령')}
            className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              shippingMethod === '직접수령'
                ? 'border-[#8A502E] bg-[#FFFDFB] shadow-xs ring-2 ring-[#8A502E]/10'
                : 'border-[#E6DFD5] bg-white hover:border-[#D5C7B7]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm text-[#2D241E] flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-[#8A502E]" />
                  직접수령
                </span>
                {shippingMethod === '직접수령' && (
                  <CheckCircle2 className="w-4 h-4 text-[#8A502E]" />
                )}
              </div>
              <p className="text-xs text-[#7D6B5D] leading-snug">
                도디 공방 직접 방문 수령
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[#F0E8DE]">
              <span className="inline-block text-xs font-bold text-[#2A5C37] bg-[#E9F3EC] px-2 py-0.5 rounded">
                후불 / 0원
              </span>
              <div className="text-[11px] text-[#8C7A6E] mt-1 font-medium">
                공방 방문 수령 (배송비 무료)
              </div>
            </div>
          </button>
        </div>

        {/* 배송 일정 안내 */}
        <div className="p-3.5 rounded-xl bg-[#EFE9DF] border border-[#DED4C7] space-y-1.5 text-xs">
          <div className="flex items-center gap-2 font-bold text-[#3E2F23]">
            <Calendar className="w-4 h-4 text-[#8A502E]" />
            <span>택배 및 운송은 매주 수요일입니다.</span>
          </div>
          <p className="text-[#6F5D4F] leading-relaxed">
            무거운 도예 재료 특성상 전용 화물 택배로 매주 수요일 일괄 발송됩니다. (직접수령 시 방문 일정 별도 협의 가능)
          </p>
          <div className="text-xs font-semibold text-[#8A502E] bg-white/80 p-2 rounded-lg border border-[#DACFBF] inline-block">
            📅 이번 주/다음 발송 예정일: <strong>{shippingMethod === '직접수령' ? '공방 방문 수령 (상시 협의)' : nextShippingDate}</strong>
          </div>
        </div>
      </div>

      {/* 4. 주문자 정보 (최소 정보만 입력) */}
      <div className="bg-[#FAF7F2] border border-[#E3DACF] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#2D241E] flex items-center gap-1.5">
            <span className="w-1.5 h-4 bg-[#8A502E] rounded-full inline-block" />
            4. 주문자 정보
          </h3>
          <span className="text-xs text-[#8A7A6D]">
            {shippingMethod === '직접수령' ? '이름/연락처 필수' : '최소 정보 필수'}
          </span>
        </div>

        <div className="space-y-3.5">
          {/* Customer Name */}
          <div>
            <label className="text-xs font-bold text-[#44362B] flex items-center gap-1.5 mb-1">
              <User className="w-3.5 h-3.5 text-[#8A7A6D]" />
              <span>주문자명</span>
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="예: 김도예 (또는 도예과 홍길동)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5C9BD] bg-white text-sm text-[#2D241E] placeholder:text-[#A4968A] focus:outline-none focus:ring-2 focus:ring-[#8A502E]"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="text-xs font-bold text-[#44362B] flex items-center gap-1.5 mb-1">
              <Phone className="w-3.5 h-3.5 text-[#8A7A6D]" />
              <span>연락처 (휴대폰 번호)</span>
            </label>
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="예: 010-1234-5678"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5C9BD] bg-white text-sm text-[#2D241E] placeholder:text-[#A4968A] focus:outline-none focus:ring-2 focus:ring-[#8A502E]"
            />
          </div>

          {/* Shipping Address */}
          <div>
            <label className="text-xs font-bold text-[#44362B] flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#8A7A6D]" />
                <span>
                  {shippingMethod === '직접수령' ? '수령 안내 및 방문 메모' : '배송지 주소'}
                </span>
              </span>
              {shippingMethod === '직접수령' && (
                <span className="text-[11px] font-normal text-[#8A7A6D]">직접 방문 수령 (선택 메모)</span>
              )}
            </label>
            <textarea
              required={shippingMethod !== '직접수령'}
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={
                shippingMethod === '직접수령'
                  ? '도디 공방 직접 방문 수령 (방문 희망 일시나 전달 메모가 있으시면 입력해주세요)'
                  : '상세 주소를 입력해주세요 (예: 서울시 마포구 와우산로 94 조형관 301호 도예실)'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5C9BD] bg-white text-sm text-[#2D241E] placeholder:text-[#A4968A] focus:outline-none focus:ring-2 focus:ring-[#8A502E] resize-none"
            />
          </div>
        </div>
      </div>

      {/* 5. 입금 안내 (결제 기능 없음, 계좌 안내) */}
      <div className="bg-[#FAF7F2] border border-[#E3DACF] rounded-2xl p-5 sm:p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#2D241E] flex items-center gap-1.5">
            <span className="w-1.5 h-4 bg-[#8A502E] rounded-full inline-block" />
            5. 입금 계좌 안내
          </h3>
          <span className="text-xs text-[#8A7A6D]">계좌 이체</span>
        </div>

        <div className="bg-[#F6EEE5] rounded-xl p-4 border border-[#E6DACB] space-y-3">
          {/* Detailed Price Breakdown */}
          <div className="space-y-1.5 pb-3 border-b border-[#E0D3C3] text-xs">
            <div className="flex items-center justify-between text-[#6D5B4E]">
              <span>상품 금액 ({selectedProduct?.name} {quantity}통)</span>
              <span>{productPrice.toLocaleString()}원</span>
            </div>
            <div className="flex items-center justify-between text-[#6D5B4E]">
              <span>
                운송료 ({shippingMethod}
                {shippingMethod === '택배' && ' · 개당 6,600원'})
              </span>
              <span className="font-semibold text-[#8A502E]">
                {shippingMethod === '택배'
                  ? `+${shippingFee.toLocaleString()}원`
                  : shippingMethod === '화물'
                  ? '별도문의'
                  : '후불 (0원)'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-[#715E50] font-bold">입금하실 총 금액</span>
              {shippingMethod === '화물' && (
                <div className="text-[11px] text-[#915B35]">※ 화물 운송비는 별도 협의</div>
              )}
            </div>
            <span className="text-lg sm:text-xl font-extrabold text-[#8A502E]">
              {totalPrice.toLocaleString()}원
            </span>
          </div>

          {settings && (
            <div className="bg-white rounded-lg p-3 border border-[#DED2C3] flex items-center justify-between gap-2">
              <div>
                <div className="text-xs text-[#827163]">
                  {settings.bankName} (예금주: {settings.accountHolder})
                </div>
                <div className="font-mono text-sm sm:text-base font-bold text-[#2D241E] mt-0.5">
                  {settings.accountNumber}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onCopyText(settings.accountNumber, '계좌번호')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#6E4426] bg-[#F1E5D8] hover:bg-[#E7D6C4] rounded-lg transition-colors shrink-0 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>복사</span>
              </button>
            </div>
          )}

          <div className="flex items-start gap-1.5 text-xs text-[#866F5E] pt-1">
            <Info className="w-4 h-4 text-[#8A7A6D] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              온라인 카드결제 기능은 없으며, 주문 접수 후 위 계좌로 입금해주시면 관리자가 확인 후 순차 배송을 준비합니다.
            </p>
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-[#FCECE8] border border-[#F5CAC1] flex items-center gap-2 text-xs text-[#8E2F20] font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 6. 핵심 단일 버튼: [주문하기] */}
      <div className="pt-2">
        <button
          id="btn-submit-order"
          type="submit"
          disabled={isSubmitting || !isAvailable}
          className={`w-full py-4 px-6 rounded-2xl text-base sm:text-lg font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 ${
            !isAvailable
              ? 'bg-[#A89C92] cursor-not-allowed opacity-80'
              : 'bg-[#8A502E] hover:bg-[#744021] active:scale-[0.99]'
          }`}
        >
          {isSubmitting ? (
            <span>주문 접수 중...</span>
          ) : !isAvailable ? (
            <span>해당 상품은 현재 주문 마감되었습니다</span>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>주문하기 ({totalPrice.toLocaleString()}원)</span>
            </>
          )}
        </button>
        <p className="text-center text-xs text-[#98877B] mt-2">
          주문하기를 누르시면 <strong>[입금 대기]</strong> 상태로 주문이 등록됩니다.
        </p>
      </div>
    </form>
  );
};
