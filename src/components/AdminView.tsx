import React, { useState } from 'react';
import {
  Package,
  Clock,
  CreditCard,
  Truck,
  PackageCheck,
  Filter,
  CheckCircle2,
  XCircle,
  Edit3,
  Calendar,
  Phone,
  MapPin,
  User,
  RefreshCw,
  Search,
  ExternalLink,
  Settings,
  Save,
  Check,
} from 'lucide-react';
import type { Product, Order, OrderStatus, StudioSettings } from '../types.ts';
import { GoogleSheetSyncCard } from './GoogleSheetSyncCard.tsx';
import { AdminAnalyticsDashboard } from './AdminAnalyticsDashboard.tsx';

interface AdminViewProps {
  products: Product[];
  orders: Order[];
  settings: StudioSettings | null;
  adminToken: string;
  onRefreshOrders: () => void;
  onToggleProductAvailability: (productId: string, currentAvailable: boolean) => Promise<void>;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, courier?: string, tracking?: string) => Promise<void>;
  onUpdateSettings: (updated: Partial<StudioSettings>) => Promise<void>;
  onOrdersImported: (orders: Order[], message: string) => void;
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onCopyText: (text: string, label: string) => void;
}

const FILTER_TABS: { label: string; value: string }[] = [
  { label: '전체', value: '전체' },
  { label: '입금 대기', value: '입금 대기' },
  { label: '입금 완료', value: '입금 완료' },
  { label: '택배 발송', value: '택배 발송' },
  { label: '도착 완료', value: '도착 완료' },
];

const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bg: string; border: string; icon: React.ElementType }
> = {
  '입금 대기': {
    label: '입금 대기',
    color: 'text-[#94551E]',
    bg: 'bg-[#FCF4EC]',
    border: 'border-[#F2D7C2]',
    icon: Clock,
  },
  '입금 완료': {
    label: '입금 완료',
    color: 'text-[#246A3E]',
    bg: 'bg-[#EBF7EF]',
    border: 'border-[#C8E8D2]',
    icon: CreditCard,
  },
  '택배 발송': {
    label: '택배 발송',
    color: 'text-[#1D6085]',
    bg: 'bg-[#EDF6FA]',
    border: 'border-[#C8E1EE]',
    icon: Truck,
  },
  '도착 완료': {
    label: '도착 완료',
    color: 'text-[#3E5C38]',
    bg: 'bg-[#F0F6EE]',
    border: 'border-[#D4E6D0]',
    icon: PackageCheck,
  },
};

export const AdminView: React.FC<AdminViewProps> = ({
  products,
  orders,
  settings,
  onRefreshOrders,
  onToggleProductAvailability,
  onUpdateOrderStatus,
  onUpdateSettings,
  onOrdersImported,
  onShowToast,
  onCopyText,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('전체');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit tracking modal state
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [courierInput, setCourierInput] = useState('경동택배');
  const [trackingInput, setTrackingInput] = useState('');
  const [targetStatusForModal, setTargetStatusForModal] = useState<OrderStatus | null>(null);

  // Studio Settings quick edit state
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [settingBank, setSettingBank] = useState(settings?.bankName || '');
  const [settingAccount, setSettingAccount] = useState(settings?.accountNumber || '');
  const [settingHolder, setSettingHolder] = useState(settings?.accountHolder || '');
  const [settingNotice, setSettingNotice] = useState(settings?.shippingNotice || '');

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshOrders();
    setTimeout(() => setIsRefreshing(false), 300);
  };

  // Filtered orders list
  const filteredOrders = orders.filter((order) => {
    if (selectedFilter !== '전체' && order.status !== selectedFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = order.customerName.toLowerCase().includes(q);
      const matchPhone = order.phoneNumber.replace(/[^0-9]/g, '').includes(q.replace(/[^0-9]/g, ''));
      const matchId = order.orderId.toLowerCase().includes(q);
      const matchProduct = order.product.toLowerCase().includes(q);
      return matchName || matchPhone || matchId || matchProduct;
    }
    return true;
  });

  // Count per filter tab
  const getFilterCount = (filterValue: string) => {
    if (filterValue === '전체') return orders.length;
    return orders.filter((o) => o.status === filterValue).length;
  };

  const openTrackingModal = (order: Order, nextStatus?: OrderStatus) => {
    setEditingOrder(order);
    setCourierInput(order.courierName || '경동택배');
    setTrackingInput(order.trackingNumber || '');
    setTargetStatusForModal(nextStatus || null);
  };

  const handleSaveTracking = async () => {
    if (!editingOrder) return;
    const finalStatus = targetStatusForModal || editingOrder.status;
    await onUpdateOrderStatus(
      editingOrder.orderId,
      finalStatus,
      courierInput.trim(),
      trackingInput.trim()
    );
    setEditingOrder(null);
    setTargetStatusForModal(null);
  };

  const handleQuickStatusClick = async (order: Order, status: OrderStatus) => {
    if (status === '택배 발송' && !order.trackingNumber) {
      // Prompt modal to enter tracking number when switching to '택배 발송'
      openTrackingModal(order, '택배 발송');
      return;
    }
    await onUpdateOrderStatus(order.orderId, status, order.courierName, order.trackingNumber);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateSettings({
      bankName: settingBank.trim(),
      accountNumber: settingAccount.trim(),
      accountHolder: settingHolder.trim(),
      shippingNotice: settingNotice.trim(),
    });
    setIsEditingSettings(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. 상품 주문 가능 / 주문 마감 관리 ⭐ (점토 / 슬립) */}
      <div className="bg-[#FAF7F2] border border-[#E3DACF] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[#2D241E] flex items-center gap-2">
              <span className="w-2 h-4 bg-[#8A502E] rounded-full inline-block" />
              상품별 주문 접수 여부 관리 ⭐
            </h2>
            <p className="text-xs text-[#7A695C] mt-0.5">
              원자재 재고 상황에 따라 [주문 가능] 또는 [주문 마감] 상태로 즉시 변경할 수 있습니다.
            </p>
          </div>
          <span className="text-xs text-[#8A7A6D] bg-[#EFE7DE] px-2.5 py-1 rounded-md">
            고객 화면에 실시간 반영됨
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-xl p-4 border border-[#E6DED4] shadow-2xs flex flex-col justify-between gap-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base text-[#2D241E]">{product.name}</span>
                    <span className="text-xs text-[#8A502E] font-bold">
                      {product.price.toLocaleString()}원
                    </span>
                  </div>
                  <p className="text-xs text-[#7B6A5D] mt-1">
                    {product.capacity} ({product.weight}) · {product.description}
                  </p>
                </div>

                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-md shrink-0 ${
                    product.isAvailable
                      ? 'bg-[#E7F3E9] text-[#245D33]'
                      : 'bg-[#FBEBE8] text-[#972B1B]'
                  }`}
                >
                  {product.isAvailable ? '🟢 주문 가능' : '🔴 주문 마감'}
                </span>
              </div>

              {/* Status Change Toggle Button */}
              <div className="pt-2 border-t border-[#F1EAE2] flex items-center justify-between">
                <span className="text-xs text-[#857467]">상태 변경:</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => onToggleProductAvailability(product.id, false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      product.isAvailable
                        ? 'bg-[#2E6B3E] text-white hover:bg-[#255732]'
                        : 'bg-[#EFE8DF] text-[#6E5D4F] hover:bg-[#E3D9CD]'
                    }`}
                  >
                    🟢 주문 가능으로 설정
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleProductAvailability(product.id, true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      !product.isAvailable
                        ? 'bg-[#982D1D] text-white hover:bg-[#7D2214]'
                        : 'bg-[#EFE8DF] text-[#6E5D4F] hover:bg-[#E3D9CD]'
                    }`}
                  >
                    🔴 주문 마감으로 설정
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. 구글 시트(Google Sheets) 연동 및 주문 실시간 동기화 ⭐ */}
      <GoogleSheetSyncCard
        settings={settings}
        orders={orders}
        onUpdateSettings={onUpdateSettings}
        onOrdersImported={onOrdersImported}
        onShowToast={onShowToast}
      />

      {/* 3. 구글 시트 기반 월별 주문 금액 & 상품별 판매량 대시보드 (Recharts) ⭐ */}
      <AdminAnalyticsDashboard
        settings={settings}
        fallbackOrders={orders}
        onShowToast={onShowToast}
      />

      {/* 4. Studio Settings / Bank info accordion */}
      <div className="bg-[#FAF7F2] border border-[#E3DACF] rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#8A502E]" />
            <h3 className="text-sm font-bold text-[#2D241E]">입금 계좌 및 배송 안내 문구 설정</h3>
          </div>
          <button
            type="button"
            onClick={() => setIsEditingSettings(!isEditingSettings)}
            className="text-xs font-semibold text-[#8A502E] hover:underline"
          >
            {isEditingSettings ? '설정 닫기' : '정보 수정'}
          </button>
        </div>

        {isEditingSettings ? (
          <form onSubmit={handleSaveSettings} className="p-4 bg-white rounded-xl border border-[#E2D8CC] space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-[#44362B] block mb-1">은행명</label>
                <input
                  type="text"
                  value={settingBank}
                  onChange={(e) => setSettingBank(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#D5C9BD] text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-[#44362B] block mb-1">계좌번호</label>
                <input
                  type="text"
                  value={settingAccount}
                  onChange={(e) => setSettingAccount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#D5C9BD] text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-[#44362B] block mb-1">예금주</label>
                <input
                  type="text"
                  value={settingHolder}
                  onChange={(e) => setSettingHolder(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#D5C9BD] text-xs"
                />
              </div>
            </div>
            <div>
              <label className="font-bold text-[#44362B] block mb-1">배송 안내 문구</label>
              <input
                type="text"
                value={settingNotice}
                onChange={(e) => setSettingNotice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#D5C9BD] text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEditingSettings(false)}
                className="px-3 py-1.5 rounded-lg border border-[#D5C9BD] text-[#635143]"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-[#8A502E] text-white font-semibold flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>저장하기</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="p-3 bg-white rounded-xl border border-[#E9E1D7] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 text-[#5F4E40]">
              <span>
                <strong>입금계좌:</strong> {settings?.bankName} {settings?.accountNumber} ({settings?.accountHolder})
              </span>
              <span className="hidden sm:inline">|</span>
              <span className="hidden sm:inline">
                <strong>배송원칙:</strong> {settings?.shippingNotice}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Orders List & Management Section ⭐ */}
      <div className="bg-[#FAF7F2] border border-[#E3DACF] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        {/* Header & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E0D5] pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#2D241E] flex items-center gap-2">
              <span className="w-2 h-4 bg-[#8A502E] rounded-full inline-block" />
              주문 목록 및 배송 상태 직접 변경 ⭐
            </h2>
            <p className="text-xs text-[#7A695C] mt-0.5">
              총 <strong>{orders.length}</strong>건의 주문이 등록되어 있습니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#544336] bg-[#ECE5DA] hover:bg-[#E1D7CB] px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>새로고침</span>
            </button>
          </div>
        </div>

        {/* 9. 관리자 주문 필터 ⭐ */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {FILTER_TABS.map((tab) => {
              const count = getFilterCount(tab.value);
              const isActive = selectedFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setSelectedFilter(tab.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#8A502E] text-white shadow-xs'
                      : 'bg-white text-[#6F5D4F] border border-[#E4DDD3] hover:bg-[#F3EDE4]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[#EFE8DE] text-[#685648]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#9F8E80] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="주문자명, 전화번호, 주문번호 검색"
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#D9CFC4] bg-white text-xs text-[#2D241E] placeholder:text-[#A09285] focus:outline-none focus:ring-1 focus:ring-[#8A502E]"
            />
          </div>
        </div>

        {/* Orders Table / Cards */}
        {filteredOrders.length === 0 ? (
          <div className="py-12 px-4 text-center bg-white rounded-xl border border-[#ECE5DC] text-xs text-[#7A695C] space-y-1">
            <p className="font-bold text-sm text-[#46382C]">조건에 맞는 주문 내역이 없습니다.</p>
            <p>필터를 변경하거나 검색어를 지워보세요.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const statusCfg = ORDER_STATUS_CONFIG[order.status];
              const StatusIcon = statusCfg.icon;

              return (
                <div
                  key={order.orderId}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E6DFD5] shadow-2xs space-y-4 hover:border-[#D5C6B5] transition-all"
                >
                  {/* Top Bar: Order ID, Date, and Current Status */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F2ECE4] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#2D241E]">
                        {order.orderId}
                      </span>
                      <button
                        type="button"
                        onClick={() => onCopyText(order.orderId, '주문번호')}
                        className="p-1 text-[#8A7A6D] hover:text-[#2D241E] hover:bg-[#F3ECE4] rounded"
                        title="주문번호 복사"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <span className="text-[11px] text-[#8C7B6F]">• 주문: {order.orderDate}</span>
                    </div>

                    {/* Current Status Pill */}
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span>현재: {order.status}</span>
                    </div>
                  </div>

                  {/* Order Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    {/* Column 1: Product & Amount */}
                    <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EEE7DE] space-y-1">
                      <div className="font-bold text-sm text-[#2D241E]">
                        {order.product} <span className="text-[#8A502E]">× {order.quantity}통</span>
                      </div>
                      <div className="text-[#7D6B5D] flex justify-between text-[11px]">
                        <span>상품금액:</span>
                        <span>{(order.productPrice ?? (order.unitPrice * order.quantity)).toLocaleString()}원</span>
                      </div>
                      <div className="text-[#7D6B5D] flex justify-between text-[11px]">
                        <span>운송료 ({order.shippingMethod || '택배'}):</span>
                        <span className="font-semibold text-[#8A502E]">
                          {(order.shippingMethod || '택배') === '택배'
                            ? `+${(order.shippingFee ?? (order.quantity * 6600)).toLocaleString()}원`
                            : order.shippingMethod === '화물'
                            ? '별도문의'
                            : '후불(0원)'}
                        </span>
                      </div>
                      <div className="text-sm font-extrabold text-[#8A502E] pt-1 border-t border-[#EBE3D9] flex justify-between">
                        <span>총 입금액:</span>
                        <span>{order.totalPrice.toLocaleString()}원</span>
                      </div>
                    </div>

                    {/* Column 2: Customer info */}
                    <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EEE7DE] space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-[#2D241E]">
                        <User className="w-3.5 h-3.5 text-[#8A7A6D]" />
                        <span>{order.customerName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#6D5B4D]">
                        <Phone className="w-3.5 h-3.5 text-[#8A7A6D]" />
                        <span>{order.phoneNumber}</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-[#6D5B4D] pt-0.5 leading-snug">
                        <MapPin className="w-3.5 h-3.5 text-[#8A7A6D] shrink-0 mt-0.5" />
                        <span>{order.address}</span>
                      </div>
                    </div>

                    {/* Column 3: Shipping & Tracking info */}
                    <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EEE7DE] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[#5F4E40]">
                          <Calendar className="w-3.5 h-3.5 text-[#8A502E]" />
                          <span>
                            {(order.shippingMethod || '택배') === '직접수령'
                              ? '공방 방문 수령'
                              : `발송 예정: ${order.shippingScheduledDate}`}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#EFE7DE] text-[#695240]">
                          {order.shippingMethod || '택배'}
                        </span>
                      </div>

                      {/* Courier & Tracking Number info */}
                      {order.trackingNumber ? (
                        <div className="p-2 bg-white rounded-lg border border-[#CADBCF] text-[11px] text-[#244730] flex items-center justify-between">
                          <div>
                            <span className="font-semibold">{order.courierName || '택배'}: </span>
                            <span className="font-mono font-bold">{order.trackingNumber}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openTrackingModal(order)}
                            className="text-[#3E6B4E] hover:underline font-bold ml-1"
                          >
                            수정
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-[11px] text-[#8C7A6D]">
                          <span>송장번호: 미등록</span>
                          <button
                            type="button"
                            onClick={() => openTrackingModal(order)}
                            className="text-[#8A502E] font-semibold hover:underline"
                          >
                            + 송장 입력
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 6. 관리자 직접 상태 변경 컨트롤 ⭐ */}
                  <div className="p-3 rounded-xl bg-[#F4EDE4] border border-[#E5DCD0] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#44362B]">
                      <span>직접 상태 변경:</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 max-w-xl">
                      {(['입금 대기', '입금 완료', '택배 발송', '도착 완료'] as OrderStatus[]).map(
                        (statusKey) => {
                          const isCurrent = order.status === statusKey;
                          return (
                            <button
                              key={statusKey}
                              type="button"
                              onClick={() => handleQuickStatusClick(order, statusKey)}
                              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                                isCurrent
                                  ? 'bg-[#8A502E] text-white shadow-xs ring-2 ring-[#8A502E]/20'
                                  : 'bg-white text-[#5F4E40] border border-[#D5C9BD] hover:bg-[#FAF6F1]'
                              }`}
                            >
                              {isCurrent && <Check className="w-3.5 h-3.5" />}
                              <span>{statusKey}</span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tracking Number Input Modal (7. 송장번호) */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#FAF7F2] border border-[#E6DFD5] w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E8E0D5] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#8A502E]" />
                <h3 className="font-bold text-sm sm:text-base text-[#2D241E]">
                  택배 송장번호 등록/수정
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="p-1 rounded-lg text-[#8A7A6D] hover:text-[#2D241E]"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-white rounded-xl border border-[#EAE2D7] space-y-1">
                <div className="font-bold text-[#2D241E]">
                  주문: {editingOrder.orderId} ({editingOrder.customerName}님)
                </div>
                <div className="text-[#7F6E60]">
                  {editingOrder.product} {editingOrder.quantity}통 · {editingOrder.address}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[#44362B] block">택배사 / 화물사</label>
                <select
                  value={courierInput}
                  onChange={(e) => setCourierInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D5C9BD] bg-white text-xs text-[#2D241E] focus:ring-2 focus:ring-[#8A502E]"
                >
                  <option value="경동택배">경동택배 (도예재료 중량화물 전용)</option>
                  <option value="CJ대한통운">CJ대한통운</option>
                  <option value="우체국택배">우체국택배</option>
                  <option value="롯데택배">롯데택배</option>
                  <option value="한진택배">한진택배</option>
                  <option value="대신화물">대신화물</option>
                  <option value="화물용달/직배송">화물용달 / 직배송</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[#44362B] block">송장번호</label>
                <input
                  type="text"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder="예: 70182940192"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D5C9BD] bg-white text-xs text-[#2D241E] font-mono focus:ring-2 focus:ring-[#8A502E]"
                  autoFocus
                />
                <p className="text-[11px] text-[#8C7A6D]">
                  * 송장번호는 고객 화면에도 동일하게 실시간 제공됩니다.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#D5C9BD] text-[#554335] font-semibold hover:bg-white transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveTracking}
                  className="flex-1 py-2.5 rounded-xl bg-[#8A502E] text-white font-semibold hover:bg-[#744123] transition-colors"
                >
                  저장하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
