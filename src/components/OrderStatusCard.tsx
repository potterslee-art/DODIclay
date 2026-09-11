import React from 'react';
import {
  CheckCircle2,
  Clock,
  Truck,
  PackageCheck,
  CreditCard,
  Copy,
  RefreshCw,
  Calendar,
  MapPin,
  Phone,
  User,
  PlusCircle,
  ExternalLink,
} from 'lucide-react';
import type { Order, OrderStatus, StudioSettings } from '../types.ts';

interface OrderStatusCardProps {
  order: Order;
  settings: StudioSettings | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
  onNewOrder: () => void;
  onCopyText: (text: string, label: string) => void;
}

const STAGES: { key: OrderStatus; label: string; desc: string; icon: React.ElementType }[] = [
  {
    key: '입금 대기',
    label: '입금 대기',
    desc: '입금 계좌로 이체 후 관리자가 입금을 확인합니다.',
    icon: Clock,
  },
  {
    key: '입금 완료',
    label: '입금 완료',
    desc: '입금이 확인되었습니다. 수요일 발송을 준비합니다.',
    icon: CreditCard,
  },
  {
    key: '택배 발송',
    label: '택배 발송',
    desc: '물품이 택배/화물로 발송되었습니다.',
    icon: Truck,
  },
  {
    key: '도착 완료',
    label: '도착 완료',
    desc: '배송지에 상품이 안전하게 도착 완료되었습니다.',
    icon: PackageCheck,
  },
];

export const OrderStatusCard: React.FC<OrderStatusCardProps> = ({
  order,
  settings,
  onRefresh,
  isRefreshing,
  onNewOrder,
  onCopyText,
}) => {
  const currentStageIndex = STAGES.findIndex((s) => s.key === order.status);

  return (
    <div className="bg-[#FAF7F2] border border-[#E3DACF] rounded-2xl p-5 sm:p-7 shadow-sm space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E8E0D5] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#8A502E] bg-[#F1E9E0] px-2.5 py-1 rounded-md">
              주문 접수 완료
            </span>
            <span className="text-xs text-[#7A695C]">{order.orderDate}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-sm font-semibold text-[#544336]">주문번호:</span>
            <span className="font-mono text-base font-bold text-[#2D241E]">{order.orderId}</span>
            <button
              type="button"
              onClick={() => onCopyText(order.orderId, '주문번호')}
              className="p-1 text-[#8A7A6D] hover:text-[#2D241E] hover:bg-[#EFE8DF] rounded transition-colors"
              title="주문번호 복사"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#574436] bg-[#ECE5DB] hover:bg-[#E2D8CC] px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>상태 새로고침</span>
          </button>
        </div>
      </div>

      {/* 4-Step Order Status Progress Stepper */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[#2D241E]">현재 주문 상태</h3>
          <span className="text-xs font-semibold text-[#8A502E] bg-[#F6ECE2] px-2.5 py-0.5 rounded-full">
            {order.status}
          </span>
        </div>

        {/* Stepper bar */}
        <div className="relative pt-2 pb-1">
          {/* Progress bar line */}
          <div className="absolute top-6 left-6 right-6 h-1 bg-[#E2D8CD] -z-0">
            <div
              className="h-full bg-[#8A502E] transition-all duration-500 ease-out"
              style={{
                width: `${(Math.max(0, currentStageIndex) / (STAGES.length - 1)) * 100}%`,
              }}
            />
          </div>

          <div className="grid grid-cols-4 relative z-10">
            {STAGES.map((stage, idx) => {
              const isPassed = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              const Icon = stage.icon;

              return (
                <div key={stage.key} className="flex flex-col items-center text-center">
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${
                      isCurrent
                        ? 'bg-[#8A502E] text-white ring-4 ring-[#F1E8DE] shadow-xs'
                        : isPassed
                        ? 'bg-[#50684E] text-white'
                        : 'bg-[#EAE2D7] text-[#9A897B]'
                    }`}
                  >
                    {isPassed ? (
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs sm:text-sm font-bold tracking-tight ${
                      isCurrent ? 'text-[#8A502E]' : isPassed ? 'text-[#3E523C]' : 'text-[#8C7D70]'
                    }`}
                  >
                    {stage.label}
                  </span>
                  <span className="text-[11px] text-[#7A695C] hidden sm:block mt-0.5 max-w-[110px] leading-tight">
                    {stage.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Current status explanation callout */}
        <div className="mt-4 p-3.5 rounded-xl bg-[#F4EDE4] border border-[#E5DCD0] text-xs text-[#524235] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#8A502E] animate-pulse shrink-0" />
            <span className="font-medium">
              {order.status === '입금 대기' && '고객님의 주문이 접수되었습니다. 안내된 계좌로 입금해 주시면 확인 후 즉시 배송 준비가 진행됩니다.'}
              {order.status === '입금 완료' && '관리자가 입금을 확인했습니다. 이번 주 수요일 발송 대상입니다.'}
              {order.status === '택배 발송' && '배송사로 물품이 인계되어 발송되었습니다. 아래 송장번호로 조회 가능합니다.'}
              {order.status === '도착 완료' && '물품이 배송지에 도착 완료되었습니다. 깨끗하고 안전한 도예 작업을 응원합니다!'}
            </span>
          </div>
        </div>
      </div>

      {/* Tracking Number Display (If registered) */}
      {order.trackingNumber ? (
        <div className="p-4 rounded-xl bg-[#EAF2ED] border border-[#CADBCF] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#2A4C36]">
              <Truck className="w-4 h-4 text-[#3E6B4E]" />
              <span>택배 발송 송장번호 안내</span>
            </div>
            <span className="text-xs font-semibold text-[#3E6B4E] bg-white/70 px-2 py-0.5 rounded">
              {order.courierName || '택배 발송'}
            </span>
          </div>
          <div className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-[#C2D6C7]">
            <div className="font-mono text-sm sm:text-base font-bold text-[#1E3927] tracking-wider">
              {order.trackingNumber}
            </div>
            <button
              type="button"
              onClick={() => onCopyText(order.trackingNumber || '', '송장번호')}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#244730] bg-[#E3EDE6] hover:bg-[#D5E4D9] rounded-md transition-colors"
            >
              <Copy className="w-3 h-3" />
              <span>복사</span>
            </button>
          </div>
          <p className="text-[11px] text-[#42614C]">
            * 배송조회는 해당 택배사(또는 화물사) 웹사이트에서 송장번호로 조회하실 수 있습니다.
          </p>
        </div>
      ) : order.status === '택배 발송' ? (
        <div className="p-3.5 rounded-xl bg-[#F7EFE8] border border-[#E8DACD] text-xs text-[#73513B]">
          * 택배 발송이 완료되었으며, 송장번호 등록 시 여기에 바로 표시됩니다.
        </div>
      ) : null}

      {/* Deposit Guide Callout (Always visible, especially prominent when '입금 대기') */}
      {settings && (
        <div
          className={`rounded-xl p-4 border transition-colors ${
            order.status === '입금 대기'
              ? 'bg-[#FFF9F3] border-[#EAD2BF] ring-1 ring-[#F3DFC9]'
              : 'bg-[#F6EFE6] border-[#E5DACD]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#6D492E] flex items-center gap-1.5">
              <CreditCard className="w-4 h-4" />
              입금 계좌 안내
            </span>
            <span className="text-xs font-bold text-[#8A502E]">
              입금금액: {order.totalPrice.toLocaleString()}원
            </span>
          </div>

          <div className="bg-white/80 rounded-lg p-3 border border-[#E6D9CA] flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs text-[#7A695C]">
                {settings.bankName} (예금주: {settings.accountHolder})
              </div>
              <div className="font-mono text-sm sm:text-base font-bold text-[#2D241E] tracking-wide mt-0.5">
                {settings.accountNumber}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onCopyText(settings.accountNumber, '계좌번호')}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#643F24] bg-[#F1E5D8] hover:bg-[#E7D6C4] rounded-lg transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>계좌번호 복사</span>
            </button>
          </div>

          <p className="text-[11px] text-[#866D5B] mt-2 leading-relaxed">
            * 입금자명은 주문자명 <strong className="text-[#593922]">[{order.customerName}]</strong>(으)로 이체해 주시면 확인이 빠릅니다.
          </p>
        </div>
      )}

      {/* Order Item & Customer Detail Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        {/* Ordered Product */}
        <div className="p-3.5 rounded-xl bg-white border border-[#EAE2D8] space-y-2">
          <h4 className="font-bold text-[#554336] border-b border-[#F0EAE2] pb-1.5">주문 상품 정보</h4>
          <div className="flex justify-between">
            <span className="text-[#847466]">상품명</span>
            <span className="font-bold text-[#2D241E]">{order.product} (20L / 약 19kg)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#847466]">수량</span>
            <span className="font-bold text-[#2D241E]">{order.quantity}개</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#847466]">상품 금액</span>
            <span className="text-[#2D241E]">
              {(order.productPrice ?? (order.unitPrice * order.quantity)).toLocaleString()}원
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#847466]">운송 방법</span>
            <span className="font-semibold text-[#8A502E]">
              {order.shippingMethod || '택배'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#847466]">운송료</span>
            <span className="text-[#2D241E]">
              {(order.shippingMethod || '택배') === '택배'
                ? `+${(order.shippingFee ?? (order.quantity * 6600)).toLocaleString()}원 (개당 6,600원)`
                : order.shippingMethod === '화물'
                ? '별도문의'
                : '후불 (0원)'}
            </span>
          </div>
          <div className="flex justify-between border-t border-[#F0EAE2] pt-1.5">
            <span className="font-bold text-[#8A502E]">총 입금금액</span>
            <span className="font-bold text-sm text-[#8A502E]">{order.totalPrice.toLocaleString()}원</span>
          </div>
        </div>

        {/* Customer & Shipping */}
        <div className="p-3.5 rounded-xl bg-white border border-[#EAE2D8] space-y-2">
          <h4 className="font-bold text-[#554336] border-b border-[#F0EAE2] pb-1.5">주문자 및 수령 정보</h4>
          <div className="flex items-center gap-1.5 text-[#2D241E]">
            <User className="w-3.5 h-3.5 text-[#8A7A6D]" />
            <span className="font-semibold">{order.customerName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#2D241E]">
            <Phone className="w-3.5 h-3.5 text-[#8A7A6D]" />
            <span>{order.phoneNumber}</span>
          </div>
          <div className="flex items-start gap-1.5 text-[#2D241E]">
            <MapPin className="w-3.5 h-3.5 text-[#8A7A6D] shrink-0 mt-0.5" />
            <span className="leading-snug">{order.address}</span>
          </div>
          <div className="flex items-center gap-1.5 border-t border-[#F0EAE2] pt-1.5 text-[#6D492E]">
            <Calendar className="w-3.5 h-3.5 text-[#8A502E]" />
            <span className="font-medium">
              {(order.shippingMethod || '택배') === '직접수령'
                ? '공방 방문 수령 (상시 협의)'
                : `발송 예정일: ${order.shippingScheduledDate}`}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-2 flex justify-center">
        <button
          type="button"
          onClick={onNewOrder}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#5C4533] bg-[#ECE5DA] hover:bg-[#DFD4C5] transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          <span>다른 재료 추가 주문하기</span>
        </button>
      </div>
    </div>
  );
};
