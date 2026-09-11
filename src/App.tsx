/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { Product, Order, StudioSettings, OrderStatus } from './types.ts';
import { Header } from './components/Header.tsx';
import { CustomerView } from './components/CustomerView.tsx';
import { AdminView } from './components/AdminView.tsx';
import { AdminLoginModal } from './components/AdminLoginModal.tsx';
import { OrderLookupModal } from './components/OrderLookupModal.tsx';
import { ToastContainer, type ToastMessage } from './components/Toast.tsx';
import { getAccessToken } from './lib/firebaseAuth.ts';
import { appendOrderToSheet, updateOrderRowInSheet } from './lib/googleSheets.ts';

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [nextShippingDate, setNextShippingDate] = useState<string>('매주 수요일');
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isRefreshingOrder, setIsRefreshingOrder] = useState(false);

  // Admin Mode & Auth State
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return sessionStorage.getItem('pottery_admin_token');
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLookupModalOpen, setIsLookupModalOpen] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const copyToClipboard = useCallback(
    (text: string, label: string) => {
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            addToast('success', `${label}이(가) 복사되었습니다.`);
          })
          .catch(() => {
            fallbackCopy(text, label);
          });
      } else {
        fallbackCopy(text, label);
      }
    },
    [addToast]
  );

  const fallbackCopy = (text: string, label: string) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      addToast('success', `${label}이(가) 복사되었습니다.`);
    } catch {
      addToast('error', '복사에 실패했습니다.');
    }
    document.body.removeChild(textarea);
  };

  // 1. Initial load: fetch products & settings
  const fetchProductsAndSettings = useCallback(async () => {
    try {
      const [prodRes, settRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/settings'),
      ]);

      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.products || []);
      }

      if (settRes.ok) {
        const settData = await settRes.json();
        setSettings(settData.settings || null);
        if (settData.nextShippingDate) {
          setNextShippingDate(settData.nextShippingDate);
        }
      }
    } catch (err) {
      console.error('Error fetching initial data:', err);
    }
  }, []);

  // 2. Fetch admin orders
  const fetchAdminOrders = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/admin/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      } else if (res.status === 401) {
        // Token invalid/expired
        sessionStorage.removeItem('pottery_admin_token');
        setAdminToken(null);
        setIsAdminMode(false);
      }
    } catch (err) {
      console.error('Error fetching admin orders:', err);
    }
  }, []);

  // 3. Check existing admin token on startup
  useEffect(() => {
    fetchProductsAndSettings();

    const storedToken = sessionStorage.getItem('pottery_admin_token');
    if (storedToken) {
      fetch('/api/admin/check', {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.valid) {
            setAdminToken(storedToken);
            fetchAdminOrders(storedToken);
          } else {
            sessionStorage.removeItem('pottery_admin_token');
            setAdminToken(null);
          }
        })
        .catch(() => {
          sessionStorage.removeItem('pottery_admin_token');
          setAdminToken(null);
        });
    }

    // Check if there was an active order in session
    const lastOrderId = sessionStorage.getItem('last_order_id');
    if (lastOrderId) {
      fetch(`/api/orders/${lastOrderId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.order) {
            setActiveOrder(data.order);
          }
        })
        .catch((e) => console.error(e));
    }
  }, [fetchProductsAndSettings, fetchAdminOrders]);

  // Refresh active order live from server
  const handleRefreshActiveOrder = async () => {
    if (!activeOrder) return;
    setIsRefreshingOrder(true);
    try {
      const res = await fetch(`/api/orders/${activeOrder.orderId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveOrder(data.order);
        addToast('info', '주문 상태를 실시간으로 새로고침했습니다.');
      }
    } catch (err) {
      console.error(err);
      addToast('error', '상태 확인 중 오류가 발생했습니다.');
    } finally {
      setIsRefreshingOrder(false);
    }
  };

  // Order created handler
  const handleOrderCreated = async (newOrder: Order) => {
    setActiveOrder(newOrder);
    sessionStorage.setItem('last_order_id', newOrder.orderId);
    addToast('success', `주문이 정상 접수되었습니다. (주문번호: ${newOrder.orderId})`);

    // If Google Sheet is connected and autoSync is enabled, append to sheet
    if (settings?.googleSheetId && settings.autoSyncEnabled !== false) {
      try {
        const token = await getAccessToken();
        if (token) {
          appendOrderToSheet(token, settings.googleSheetId, newOrder).catch(console.error);
        }
      } catch (e) {
        console.error('Sheet append error on order create:', e);
      }
    }

    // If admin is active, refresh orders
    if (adminToken) {
      fetchAdminOrders(adminToken);
    }
  };

  // Admin login success
  const handleLoginSuccess = (token: string) => {
    sessionStorage.setItem('pottery_admin_token', token);
    setAdminToken(token);
    setIsAdminMode(true);
    fetchAdminOrders(token);
    addToast('success', '관리자로 로그인되었습니다.');
  };

  // Admin logout
  const handleLogoutAdmin = async () => {
    if (adminToken) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      } catch (err) {
        console.error(err);
      }
    }
    sessionStorage.removeItem('pottery_admin_token');
    setAdminToken(null);
    setIsAdminMode(false);
    addToast('info', '로그아웃 되었습니다.');
  };

  // Toggle Admin Mode button
  const handleToggleAdminMode = () => {
    if (!adminToken) {
      setIsLoginModalOpen(true);
      return;
    }
    setIsAdminMode((prev) => !prev);
  };

  // Admin: toggle product availability (주문 가능 / 주문 마감 ⭐)
  const handleToggleProductAvailability = async (productId: string, currentAvailable: boolean) => {
    if (!adminToken) return;
    try {
      const targetAvailable = !currentAvailable;
      const res = await fetch(`/api/admin/products/${productId}/availability`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ isAvailable: targetAvailable }),
      });

      const data = await res.json();
      if (!res.ok) {
        addToast('error', data.error || '상태 변경에 실패했습니다.');
        return;
      }

      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, isAvailable: targetAvailable } : p))
      );
      addToast(
        'success',
        `[${data.product.name}] 주문 상태가 [${targetAvailable ? '🟢 주문 가능' : '🔴 주문 마감'}](으)로 변경되었습니다.`
      );
    } catch (err) {
      console.error(err);
      addToast('error', '상품 상태 변경 중 오류가 발생했습니다.');
    }
  };

  // Admin: directly update order status & optional tracking number ⭐
  const handleUpdateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    courierName?: string,
    trackingNumber?: string
  ) => {
    if (!adminToken) return;
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          status,
          courierName,
          trackingNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        addToast('error', data.error || '상태 변경 실패');
        return;
      }

      // Update local orders
      setOrders((prev) =>
        prev.map((o) => (o.orderId.toUpperCase() === orderId.toUpperCase() ? data.order : o))
      );

      // If active order is the one being modified, update it too!
      if (activeOrder && activeOrder.orderId.toUpperCase() === orderId.toUpperCase()) {
        setActiveOrder(data.order);
      }

      // If Google Sheet is connected and autoSync is enabled, sync updated row
      if (settings?.googleSheetId && settings.autoSyncEnabled !== false) {
        try {
          const token = await getAccessToken();
          if (token) {
            updateOrderRowInSheet(token, settings.googleSheetId, data.order).catch(console.error);
          }
        } catch (e) {
          console.error('Sheet update error:', e);
        }
      }

      addToast('success', `주문(${orderId}) 상태가 [${status}](으)로 직접 변경되었습니다.`);
    } catch (err) {
      console.error(err);
      addToast('error', '주문 상태 변경 중 오류가 발생했습니다.');
    }
  };

  // Admin: update studio settings
  const handleUpdateSettings = async (updated: Partial<StudioSettings>) => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast('error', data.error || '설정 저장 실패');
        return;
      }
      setSettings(data.settings);
      addToast('success', '공방 설정이 안전하게 업데이트되었습니다.');
    } catch (err) {
      console.error(err);
      addToast('error', '설정 업데이트 오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F6F2] text-[#2D2621] flex flex-col selection:bg-[#E2D2C3] selection:text-[#3B2516]">
      {/* Studio Header */}
      <Header
        settings={settings}
        isAdmin={Boolean(adminToken)}
        isAdminMode={isAdminMode}
        onToggleAdminMode={handleToggleAdminMode}
        onOpenAdminLogin={() => setIsLoginModalOpen(true)}
        onLogoutAdmin={handleLogoutAdmin}
        onOpenLookup={() => setIsLookupModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {isAdminMode && adminToken ? (
          <AdminView
            products={products}
            orders={orders}
            settings={settings}
            adminToken={adminToken}
            onRefreshOrders={() => fetchAdminOrders(adminToken)}
            onToggleProductAvailability={handleToggleProductAvailability}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onUpdateSettings={handleUpdateSettings}
            onOrdersImported={(importedOrders, msg) => {
              setOrders(importedOrders);
              addToast('success', msg);
            }}
            onShowToast={addToast}
            onCopyText={copyToClipboard}
          />
        ) : (
          <CustomerView
            products={products}
            settings={settings}
            nextShippingDate={nextShippingDate}
            activeOrder={activeOrder}
            onRefreshActiveOrder={handleRefreshActiveOrder}
            isRefreshingOrder={isRefreshingOrder}
            onNewOrder={() => setActiveOrder(null)}
            onOrderCreated={handleOrderCreated}
            onCopyText={copyToClipboard}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E8E1D7] bg-[#FAF8F5] py-6 text-center text-xs text-[#8A796C]">
        <div className="max-w-3xl mx-auto px-4 space-y-1.5">
          <p className="font-semibold text-[#544336]">
            {settings?.studioName || '도디[DODI] 도예재료 보급소'}
          </p>
          <p className="text-[11px] text-[#918175]">
            정기 발송일: 매주 수요일 · 문의 최소화를 위한 실시간 주문 & 배송 상태 시스템
          </p>
          <p className="text-[11px] text-[#A6978C] pt-1">
            본 시스템은 결제 대행사(PG)를 사용하지 않는 계좌이체 주문 시스템입니다.
          </p>
        </div>
      </footer>

      {/* Modals */}
      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <OrderLookupModal
        isOpen={isLookupModalOpen}
        onClose={() => setIsLookupModalOpen(false)}
        onSelectOrder={(order) => {
          setActiveOrder(order);
          setIsAdminMode(false);
          sessionStorage.setItem('last_order_id', order.orderId);
        }}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
