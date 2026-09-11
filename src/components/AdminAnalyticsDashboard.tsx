import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  Package,
  CircleDollarSign,
  FileSpreadsheet,
  RefreshCw,
  Calendar,
  Layers,
  ShoppingBag,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react';
import type { Order, StudioSettings } from '../types.ts';
import { getAccessToken } from '../lib/firebaseAuth.ts';
import { fetchOrdersFromSheet } from '../lib/googleSheets.ts';

interface AdminAnalyticsDashboardProps {
  settings: StudioSettings | null;
  fallbackOrders: Order[];
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

const PRODUCT_COLORS: Record<string, string> = {
  점토: '#8A502E', // Terracotta brown
  슬립: '#315A75', // Slip Slate blue
  기타: '#887B70',
};

const PIE_COLORS = ['#8A502E', '#315A75', '#4A7C59', '#C07D3E'];

export const AdminAnalyticsDashboard: React.FC<AdminAnalyticsDashboardProps> = ({
  settings,
  fallbackOrders,
  onShowToast,
}) => {
  const [sheetOrders, setSheetOrders] = useState<Order[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'6months' | '2026' | 'all'>('6months');
  const [chartView, setChartView] = useState<'bar' | 'area'>('bar');
  const [dataSource, setDataSource] = useState<'sheet' | 'local'>('local');

  // Fetch orders directly from Google Sheet if connected
  const loadOrdersFromGoogleSheet = async (showToastNotice = false) => {
    if (!settings?.googleSheetId) {
      setDataSource('local');
      return;
    }

    setIsLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setDataSource('local');
        setIsLoading(false);
        return;
      }

      const ordersFromSheet = await fetchOrdersFromSheet(token, settings.googleSheetId);
      setSheetOrders(ordersFromSheet);
      setDataSource('sheet');

      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
        .getMinutes()
        .toString()
        .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setLastFetchedAt(timeStr);

      if (showToastNotice) {
        onShowToast(
          'success',
          `구글 시트에서 최신 주문 데이터 ${ordersFromSheet.length}건을 성공적으로 불러왔습니다.`
        );
      }
    } catch (err: any) {
      console.warn('Could not fetch from sheet directly, falling back to local orders:', err);
      setDataSource('local');
      if (showToastNotice) {
        onShowToast('error', '구글 시트 데이터 로딩 실패: 로컬 주문 데이터를 표시합니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch when sheet is connected or changed
  useEffect(() => {
    if (settings?.googleSheetId) {
      loadOrdersFromGoogleSheet(false);
    } else {
      setDataSource('local');
      setSheetOrders(null);
    }
  }, [settings?.googleSheetId]);

  // Active dataset to analyze
  const activeOrders = useMemo(() => {
    if (dataSource === 'sheet' && sheetOrders && sheetOrders.length > 0) {
      return sheetOrders;
    }
    return fallbackOrders;
  }, [dataSource, sheetOrders, fallbackOrders]);

  // Helper: parse date to 'YYYY-MM'
  const getYearMonth = (order: Order): string => {
    // Try orderDate first (e.g., '2026-09-08 14:20' or '2026-09-08')
    if (order.orderDate) {
      const match = order.orderDate.match(/(\d{4})[./-](\d{1,2})/);
      if (match) {
        return `${match[1]}-${match[2].padStart(2, '0')}`;
      }
    }
    // Try shippingScheduledDate (e.g., '2026-09-10 (수)')
    if (order.shippingScheduledDate) {
      const match = order.shippingScheduledDate.match(/(\d{4})[./-](\d{1,2})/);
      if (match) {
        return `${match[1]}-${match[2].padStart(2, '0')}`;
      }
    }
    // Try orderId date part (e.g., 'POT-260908-1042' -> '2026-09')
    const idMatch = order.orderId.match(/POT-(\d{2})(\d{2})\d{2}/i);
    if (idMatch) {
      return `20${idMatch[1]}-${idMatch[2]}`;
    }
    return '2026-09';
  };

  // 1. Filter orders according to time range
  const filteredOrders = useMemo(() => {
    if (timeRange === 'all') return activeOrders;

    const currentYear = '2026';
    if (timeRange === '2026') {
      return activeOrders.filter((o) => getYearMonth(o).startsWith(currentYear));
    }

    // 6months: last 6 months (e.g. 2026-04 ~ 2026-09)
    const validMonths = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
    return activeOrders.filter((o) => validMonths.includes(getYearMonth(o)));
  }, [activeOrders, timeRange]);

  // 2. Aggregate monthly metrics (Total amount & Product sales volume)
  const monthlyData = useMemo(() => {
    // Determine the month keys to show
    let months: string[] = [];
    if (timeRange === '6months') {
      months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
    } else if (timeRange === '2026') {
      months = [
        '2026-01',
        '2026-02',
        '2026-03',
        '2026-04',
        '2026-05',
        '2026-06',
        '2026-07',
        '2026-08',
        '2026-09',
      ];
    } else {
      // All unique months from orders sorted
      const monthSet = new Set<string>();
      activeOrders.forEach((o) => monthSet.add(getYearMonth(o)));
      // Ensure at least recent months exist
      ['2026-07', '2026-08', '2026-09'].forEach((m) => monthSet.add(m));
      months = Array.from(monthSet).sort();
    }

    const monthMap: Record<
      string,
      {
        month: string;
        monthLabel: string;
        totalAmount: number;
        clayQty: number;
        slipQty: number;
        totalQty: number;
        clayAmount: number;
        slipAmount: number;
        orderCount: number;
      }
    > = {};

    months.forEach((m) => {
      const parts = m.split('-');
      const label = `${parseInt(parts[1], 10)}월`;
      monthMap[m] = {
        month: m,
        monthLabel: label,
        totalAmount: 0,
        clayQty: 0,
        slipQty: 0,
        totalQty: 0,
        clayAmount: 0,
        slipAmount: 0,
        orderCount: 0,
      };
    });

    // Populate from orders
    activeOrders.forEach((order) => {
      const ym = getYearMonth(order);
      if (!monthMap[ym]) {
        const parts = ym.split('-');
        monthMap[ym] = {
          month: ym,
          monthLabel: parts[1] ? `${parseInt(parts[1], 10)}월` : ym,
          totalAmount: 0,
          clayQty: 0,
          slipQty: 0,
          totalQty: 0,
          clayAmount: 0,
          slipAmount: 0,
          orderCount: 0,
        };
      }

      const target = monthMap[ym];
      target.totalAmount += order.totalPrice || 0;
      target.orderCount += 1;

      const isSlip =
        (order.productId && order.productId.toLowerCase().includes('slip')) ||
        (order.product && order.product.includes('슬립'));

      if (isSlip) {
        target.slipQty += order.quantity || 0;
        target.slipAmount += order.totalPrice || 0;
      } else {
        target.clayQty += order.quantity || 0;
        target.clayAmount += order.totalPrice || 0;
      }
      target.totalQty += order.quantity || 0;
    });

    // Return array sorted by month
    return Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));
  }, [activeOrders, timeRange]);

  // 3. Product sales volume aggregate (Clay vs Slip)
  const productShareData = useMemo(() => {
    let clayQty = 0;
    let slipQty = 0;
    let clayRevenue = 0;
    let slipRevenue = 0;

    filteredOrders.forEach((order) => {
      const isSlip =
        (order.productId && order.productId.toLowerCase().includes('slip')) ||
        (order.product && order.product.includes('슬립'));

      if (isSlip) {
        slipQty += order.quantity || 0;
        slipRevenue += order.totalPrice || 0;
      } else {
        clayQty += order.quantity || 0;
        clayRevenue += order.totalPrice || 0;
      }
    });

    return [
      {
        name: '점토',
        quantity: clayQty,
        revenue: clayRevenue,
        unit: '포(20L/19kg)',
        color: PRODUCT_COLORS['점토'],
      },
      {
        name: '슬립',
        quantity: slipQty,
        revenue: slipRevenue,
        unit: '통(20L/19kg)',
        color: PRODUCT_COLORS['슬립'],
      },
    ];
  }, [filteredOrders]);

  // 4. Overall Key KPI Metrics
  const kpis = useMemo(() => {
    let totalRevenue = 0;
    let totalQuantity = 0;
    let clayQty = 0;
    let slipQty = 0;

    filteredOrders.forEach((order) => {
      totalRevenue += order.totalPrice || 0;
      totalQuantity += order.quantity || 0;
      const isSlip =
        (order.productId && order.productId.toLowerCase().includes('slip')) ||
        (order.product && order.product.includes('슬립'));
      if (isSlip) {
        slipQty += order.quantity || 0;
      } else {
        clayQty += order.quantity || 0;
      }
    });

    const orderCount = filteredOrders.length;
    const aov = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

    return {
      totalRevenue,
      totalQuantity,
      clayQty,
      slipQty,
      orderCount,
      aov,
    };
  }, [filteredOrders]);

  return (
    <div className="bg-[#FAF7F2] border border-[#E3DACF] rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
      {/* 1. Header & Source Badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E8E1D5] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#8A502E] text-white flex items-center justify-center shadow-2xs">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#2D241E] flex items-center gap-2">
              도디(DODI) 판매 분석 & 주문 통계 대시보드
            </h2>
          </div>
          <p className="text-xs text-[#7A695C] mt-1">
            월별 총 주문 금액 추이와 상품별(점토·슬립) 판매 수량을 시각화하여 확인합니다.
          </p>
        </div>

        {/* Data Source & Refresh Action */}
        <div className="flex flex-wrap items-center gap-2">
          {settings?.googleSheetId ? (
            <div className="inline-flex items-center gap-2 bg-[#E7F3E9] text-[#1E5C2D] border border-[#C6E5CD] px-3 py-1.5 rounded-xl text-xs font-semibold">
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#2E7D42]" />
              <span>구글 시트 연동 데이터</span>
              {lastFetchedAt && (
                <span className="text-[10px] text-[#3D7D4D] font-normal">
                  ({lastFetchedAt} 기준)
                </span>
              )}
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 bg-[#F2ECE1] text-[#6E5E50] border border-[#DDD3C4] px-2.5 py-1 rounded-xl text-xs">
              <AlertCircle className="w-3.5 h-3.5 text-[#8A502E]" />
              <span>로컬 데이터 기반</span>
            </div>
          )}

          {settings?.googleSheetId && (
            <button
              type="button"
              onClick={() => loadOrdersFromGoogleSheet(true)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#4A3B30] bg-[#EFE8DD] hover:bg-[#E4DCCE] border border-[#D5C9BA] transition-colors disabled:opacity-50"
              title="연동된 구글 시트에서 최신 주문 데이터를 다시 읽어옵니다."
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#8A502E] ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? '동기화 중...' : '시트 데이터 새로고침'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Time range selector */}
        <div className="inline-flex rounded-xl bg-[#EFE8DD] p-1 border border-[#DDD4C7]">
          <button
            type="button"
            onClick={() => setTimeRange('6months')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              timeRange === '6months'
                ? 'bg-[#8A502E] text-white shadow-2xs'
                : 'text-[#6C5B4F] hover:text-[#2D241E]'
            }`}
          >
            최근 6개월
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('2026')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              timeRange === '2026'
                ? 'bg-[#8A502E] text-white shadow-2xs'
                : 'text-[#6C5B4F] hover:text-[#2D241E]'
            }`}
          >
            올해 (2026년)
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              timeRange === 'all'
                ? 'bg-[#8A502E] text-white shadow-2xs'
                : 'text-[#6C5B4F] hover:text-[#2D241E]'
            }`}
          >
            전체 기간 ({activeOrders.length}건)
          </button>
        </div>

        {/* Chart type toggle for revenue */}
        <div className="flex items-center gap-1.5 text-xs text-[#7A695C]">
          <span>매출 차트 유형:</span>
          <button
            type="button"
            onClick={() => setChartView('bar')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
              chartView === 'bar'
                ? 'bg-[#8A502E] text-white'
                : 'bg-[#EAE2D5] text-[#594B40] hover:bg-[#DDD3C4]'
            }`}
          >
            막대형 (Bar)
          </button>
          <button
            type="button"
            onClick={() => setChartView('area')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
              chartView === 'area'
                ? 'bg-[#8A502E] text-white'
                : 'bg-[#EAE2D5] text-[#594B40] hover:bg-[#DDD3C4]'
            }`}
          >
            영역형 (Area)
          </button>
        </div>
      </div>

      {/* 3. Key Metric Cards (KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Revenue */}
        <div className="bg-white rounded-xl p-4 border border-[#E6DDD2] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#806E61]">
            <span className="font-semibold">총 주문 금액</span>
            <CircleDollarSign className="w-4 h-4 text-[#8A502E]" />
          </div>
          <div className="text-lg sm:text-xl font-black text-[#2D241E] tracking-tight">
            ₩{kpis.totalRevenue.toLocaleString()}
          </div>
          <p className="text-[11px] text-[#8C7A6D]">
            총 {kpis.orderCount}건의 주문 결제 대상
          </p>
        </div>

        {/* Total Quantity */}
        <div className="bg-white rounded-xl p-4 border border-[#E6DDD2] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#806E61]">
            <span className="font-semibold">총 판매 수량</span>
            <Package className="w-4 h-4 text-[#315A75]" />
          </div>
          <div className="text-lg sm:text-xl font-black text-[#2D241E] tracking-tight">
            {kpis.totalQuantity.toLocaleString()}
            <span className="text-xs font-medium text-[#7D6B5E] ml-1">포/통</span>
          </div>
          <p className="text-[11px] text-[#8C7A6D]">
            점토 {kpis.clayQty}포 · 슬립 {kpis.slipQty}통
          </p>
        </div>

        {/* Clay Sales */}
        <div className="bg-white rounded-xl p-4 border border-[#E6DDD2] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#806E61]">
            <span className="font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#8A502E]" />
              점토 판매량
            </span>
            <span className="text-[10px] font-bold text-[#8A502E]">단가 2.4만</span>
          </div>
          <div className="text-lg sm:text-xl font-black text-[#8A502E] tracking-tight">
            {kpis.clayQty.toLocaleString()}
            <span className="text-xs font-medium text-[#7D6B5E] ml-1">포</span>
          </div>
          <p className="text-[11px] text-[#8C7A6D]">
            매출: ₩{(kpis.clayQty * 24000).toLocaleString()}
          </p>
        </div>

        {/* Slip Sales */}
        <div className="bg-white rounded-xl p-4 border border-[#E6DDD2] shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#806E61]">
            <span className="font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#315A75]" />
              슬립 판매량
            </span>
            <span className="text-[10px] font-bold text-[#315A75]">단가 3만</span>
          </div>
          <div className="text-lg sm:text-xl font-black text-[#315A75] tracking-tight">
            {kpis.slipQty.toLocaleString()}
            <span className="text-xs font-medium text-[#7D6B5E] ml-1">통</span>
          </div>
          <p className="text-[11px] text-[#8C7A6D]">
            매출: ₩{(kpis.slipQty * 30000).toLocaleString()}
          </p>
        </div>
      </div>

      {/* 4. Chart 1: Monthly Total Order Amount (월별 총 주문 금액) */}
      <div className="bg-white rounded-2xl p-5 border border-[#E6DDD2] shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0EAE1] pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#2D241E] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#8A502E]" />
              월별 총 주문 금액 (Monthly Revenue)
            </h3>
            <p className="text-xs text-[#806E60]">
              월별 도예 재료 주문 합계 금액 추이입니다.
            </p>
          </div>
          <span className="text-xs font-bold text-[#8A502E] bg-[#F7EFE6] px-2.5 py-1 rounded-md">
            단위: 원 (KRW)
          </span>
        </div>

        <div className="h-64 sm:h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartView === 'bar' ? (
              <BarChart data={monthlyData} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E8DF" vertical={false} />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fill: '#6B594C', fontSize: 11 }}
                  axisLine={{ stroke: '#DFD5C8' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#6B594C', fontSize: 11 }}
                  axisLine={{ stroke: '#DFD5C8' }}
                  tickLine={false}
                  tickFormatter={(val: number) =>
                    val >= 10000 ? `${(val / 10000).toLocaleString()}만` : val.toLocaleString()
                  }
                />
                <Tooltip
                  formatter={(value: any) => [`₩${Number(value).toLocaleString()}원`, '총 주문 금액']}
                  labelFormatter={(label) => `${label} 도예재료 주문 매출`}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#DDD2C3',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  }}
                />
                <Bar
                  dataKey="totalAmount"
                  name="총 주문 금액"
                  fill="#8A502E"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            ) : (
              <AreaChart data={monthlyData} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8A502E" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8A502E" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E8DF" vertical={false} />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fill: '#6B594C', fontSize: 11 }}
                  axisLine={{ stroke: '#DFD5C8' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#6B594C', fontSize: 11 }}
                  axisLine={{ stroke: '#DFD5C8' }}
                  tickLine={false}
                  tickFormatter={(val: number) =>
                    val >= 10000 ? `${(val / 10000).toLocaleString()}만` : val.toLocaleString()
                  }
                />
                <Tooltip
                  formatter={(value: any) => [`₩${Number(value).toLocaleString()}원`, '총 주문 금액']}
                  labelFormatter={(label) => `${label} 도예재료 주문 매출`}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#DDD2C3',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="totalAmount"
                  name="총 주문 금액"
                  stroke="#8A502E"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorTotal)"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. Chart 2 & 3: Product Sales Volume (상품별 판매량) & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Monthly Product Volume Comparison Bar Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-[#E6DDD2] shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0EAE1] pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#2D241E] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#315A75]" />
                월별 상품별 판매량 (점토 vs 슬립)
              </h3>
              <p className="text-xs text-[#806E60]">
                점토(포)와 슬립(통)의 월별 출고 수량을 비교합니다.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-[#8A502E] font-semibold">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#8A502E]" />
                점토 (포)
              </span>
              <span className="flex items-center gap-1 text-[#315A75] font-semibold">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#315A75]" />
                슬립 (통)
              </span>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 15, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E8DF" vertical={false} />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fill: '#6B594C', fontSize: 11 }}
                  axisLine={{ stroke: '#DFD5C8' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#6B594C', fontSize: 11 }}
                  axisLine={{ stroke: '#DFD5C8' }}
                  tickLine={false}
                  allowDecimals={false}
                  tickFormatter={(val: number) => `${val}개`}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `${value}개`,
                    name === 'clayQty' ? '점토 (포)' : '슬립 (통)',
                  ]}
                  labelFormatter={(label) => `${label} 판매량`}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#DDD2C3',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="clayQty"
                  name="clayQty"
                  fill="#8A502E"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="slipQty"
                  name="slipQty"
                  fill="#315A75"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Cumulative Product Share Donut Chart (1 col) */}
        <div className="bg-white rounded-2xl p-5 border border-[#E6DDD2] shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="border-b border-[#F0EAE1] pb-3">
            <h3 className="text-sm font-bold text-[#2D241E] flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-[#8A502E]" />
              상품별 누적 판매 비중
            </h3>
            <p className="text-xs text-[#806E60]">
              점토와 슬립의 전체 주문 수량 비율
            </p>
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            {kpis.totalQuantity > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={productShareData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="quantity"
                  >
                    {productShareData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      `${value}개 (${Math.round(
                        (Number(value) / (kpis.totalQuantity || 1)) * 100
                      )}%)`,
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#DDD2C3',
                      borderRadius: '10px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-[#958374]">데이터가 없습니다.</div>
            )}
          </div>

          {/* Legend Details */}
          <div className="pt-2 border-t border-[#F2ECE4] space-y-2 text-xs">
            {productShareData.map((prod) => {
              const percent =
                kpis.totalQuantity > 0
                  ? Math.round((prod.quantity / kpis.totalQuantity) * 100)
                  : 0;
              return (
                <div key={prod.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: prod.color }}
                    />
                    <span className="font-bold text-[#3B2F25]">{prod.name}</span>
                    <span className="text-[11px] text-[#806E60]">
                      ({prod.quantity}개)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#2D241E]">{percent}%</span>
                    <span className="text-[10px] text-[#8A796B] ml-1.5">
                      (₩{prod.revenue.toLocaleString()})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
