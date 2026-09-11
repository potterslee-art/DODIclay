import React, { useState } from 'react';
import { Search, X, Calendar, ArrowRight, Clock, AlertCircle } from 'lucide-react';
import type { Order } from '../types.ts';

interface OrderLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder: (order: Order) => void;
}

export const OrderLookupModal: React.FC<OrderLookupModalProps> = ({
  isOpen,
  onClose,
  onSelectOrder,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Order[] | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = query.trim();
    if (!clean) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/orders-lookup?q=${encodeURIComponent(clean)}`);
      const data = await res.json();
      setResults(data.orders || []);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-[#FAF7F2] border border-[#E6DFD5] w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#E8E0D5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-[#8A502E]" />
            <h3 className="font-bold text-base text-[#2D241E]">주문 상태 조회</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#8A7A6D] hover:text-[#2D241E] hover:bg-[#EFE8DF] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <p className="text-xs text-[#7A695C] leading-relaxed">
            주문하실 때 입력하신 <strong>연락처(휴대폰 번호)</strong> 또는 <strong>주문번호</strong>를 입력하시면 실시간 주문 진행 상태를 확인하실 수 있습니다.
          </p>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="연락처 (예: 010-1234-5678) 또는 주문번호"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#D9CFC4] bg-white text-sm text-[#2D241E] placeholder:text-[#9F9185] focus:outline-none focus:ring-2 focus:ring-[#8A502E]"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-4 py-2.5 bg-[#8A502E] text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-[#744123] disabled:opacity-50 transition-colors shrink-0"
            >
              {loading ? '검색 중...' : '조회하기'}
            </button>
          </form>

          {/* Results list */}
          {hasSearched && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-[#6D5A4C]">
                조회 결과 ({results ? results.length : 0}건)
              </h4>

              {results && results.length > 0 ? (
                <div className="space-y-2">
                  {results.map((order) => (
                    <div
                      key={order.orderId}
                      onClick={() => {
                        onSelectOrder(order);
                        onClose();
                      }}
                      className="p-3.5 rounded-xl bg-white border border-[#E8DFD5] hover:border-[#8A502E] hover:shadow-xs transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#2D241E]">
                            {order.orderId}
                          </span>
                          <span className="text-[11px] font-semibold text-[#8A502E] bg-[#F7EFE8] px-2 py-0.5 rounded">
                            {order.status}
                          </span>
                        </div>
                        <div className="text-xs text-[#5C4A3C] font-medium">
                          {order.product} {order.quantity}개 · {order.totalPrice.toLocaleString()}원
                        </div>
                        <div className="text-[11px] text-[#8C7A6C] flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>주문일: {order.orderDate}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-semibold text-[#8A502E] group-hover:translate-x-0.5 transition-transform">
                        <span>상세보기</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : results && results.length === 0 ? (
                <div className="text-center py-8 px-4 bg-white rounded-xl border border-[#ECE5DC] text-xs text-[#7A695C]">
                  <AlertCircle className="w-7 h-7 text-[#A8988A] mx-auto mb-2" />
                  <p className="font-semibold text-sm text-[#44362B]">일치하는 주문 내역이 없습니다.</p>
                  <p className="mt-1">연락처 번호 또는 주문번호를 다시 한번 확인해주세요.</p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#E8E0D5] bg-[#F4EFE9] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#544336] bg-white border border-[#DDD3C7] rounded-lg hover:bg-[#FAF7F2] transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
