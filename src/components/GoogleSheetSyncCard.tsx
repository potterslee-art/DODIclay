import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Plus,
  Link2,
  LogOut,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowDownToLine,
  ArrowUpFromLine,
  Unlink,
} from 'lucide-react';
import type { Order, StudioSettings } from '../types.ts';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  type User,
} from '../lib/firebaseAuth.ts';
import {
  createPotteryOrderSpreadsheet,
  syncAllOrdersToSheet,
  fetchOrdersFromSheet,
  getSpreadsheetInfo,
  extractSpreadsheetId,
} from '../lib/googleSheets.ts';

interface GoogleSheetSyncCardProps {
  settings: StudioSettings | null;
  orders: Order[];
  onUpdateSettings: (updated: Partial<StudioSettings>) => Promise<void>;
  onOrdersImported: (orders: Order[], countMessage: string) => void;
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const GoogleSheetSyncCard: React.FC<GoogleSheetSyncCardProps> = ({
  settings,
  orders,
  onUpdateSettings,
  onOrdersImported,
  onShowToast,
}) => {
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [customSheetInput, setCustomSheetInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  // Initialize Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
      },
      () => {
        setGoogleUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Handle Google Login
  const handleGoogleLogin = async () => {
    setIsAuthLoading(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        onShowToast('success', `${result.user.displayName || 'Google'} 계정으로 연결되었습니다.`);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      onShowToast('error', 'Google 계정 로그인에 실패했습니다. 팝업 차단 여부를 확인해주세요.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Handle Google Logout
  const handleGoogleLogout = async () => {
    try {
      await logout();
      setGoogleUser(null);
      onShowToast('info', 'Google 계정 연결이 해제되었습니다.');
    } catch (err) {
      console.error(err);
    }
  };

  // Helper to ensure access token (or prompt re-login)
  const requireToken = async (): Promise<string | null> => {
    let token = await getAccessToken();
    if (!token) {
      onShowToast('info', 'Google 시트 권한 확인을 위해 Google 로그인을 진행해주세요.');
      const result = await googleSignIn();
      token = result?.accessToken || null;
      if (result) setGoogleUser(result.user);
    }
    return token;
  };

  // 1. Create a brand new dedicated Google Sheet
  const handleCreateNewSheet = async () => {
    setIsProcessing(true);
    try {
      const token = await requireToken();
      if (!token) {
        setIsProcessing(false);
        return;
      }

      onShowToast('info', '구글 스프레드시트를 생성하고 주문 서식을 구성 중입니다...');

      const newSheet = await createPotteryOrderSpreadsheet(
        token,
        '도디(DODI) 점토·슬립 주문 관리 대장'
      );

      // Immediately sync current orders if any
      if (orders.length > 0) {
        await syncAllOrdersToSheet(token, newSheet.spreadsheetId, orders);
      }

      const now = new Date();
      const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;

      // Save to studio settings
      await onUpdateSettings({
        googleSheetId: newSheet.spreadsheetId,
        googleSheetUrl: newSheet.spreadsheetUrl,
        googleSheetName: newSheet.title,
        lastSyncedAt: nowStr,
        autoSyncEnabled: true,
      });

      onShowToast(
        'success',
        `[${newSheet.title}] 구글 시트가 성공적으로 생성 및 연동되었습니다.`
      );
    } catch (err: any) {
      console.error('Sheet creation error:', err);
      onShowToast('error', err.message || '구글 시트 생성 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Connect an existing Google Sheet
  const handleConnectExistingSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSheetInput.trim()) {
      onShowToast('error', '구글 시트 주소 또는 ID를 입력해주세요.');
      return;
    }

    const cleanId = extractSpreadsheetId(customSheetInput);
    setIsProcessing(true);

    try {
      const token = await requireToken();
      if (!token) {
        setIsProcessing(false);
        return;
      }

      const info = await getSpreadsheetInfo(token, cleanId);

      await onUpdateSettings({
        googleSheetId: cleanId,
        googleSheetUrl: info.spreadsheetUrl,
        googleSheetName: info.title,
        autoSyncEnabled: true,
      });

      setShowCustomInput(false);
      setCustomSheetInput('');
      onShowToast('success', `[${info.title}] 구글 시트와 성공적으로 연결되었습니다.`);
    } catch (err: any) {
      console.error('Connect existing error:', err);
      onShowToast('error', err.message || '시트 정보를 확인하지 못했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Export all orders to Google Sheet (destructive write -> needs confirmation per SKILL)
  const handleExportAllOrders = async () => {
    if (!settings?.googleSheetId) return;

    setConfirmDialog({
      isOpen: true,
      title: '구글 시트 전체 주문 동기화',
      description: `현재 변경된 단가(점토 24,000원, 슬립 30,000원) 및 운송 방법이 반영된 총 ${orders.length}건의 주문 내역을 구글 시트의 [주문내역] 탭(17개 열 서식)에 최신 상태로 덮어쓰시겠습니까? 기존 시트 데이터가 최신 앱 데이터로 안전하게 갱신됩니다.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsProcessing(true);
        try {
          const token = await requireToken();
          if (!token) {
            setIsProcessing(false);
            return;
          }

          await syncAllOrdersToSheet(token, settings.googleSheetId!, orders);

          const now = new Date();
          const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
            now.getDate()
          ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
            now.getMinutes()
          ).padStart(2, '0')}`;

          await onUpdateSettings({ lastSyncedAt: nowStr });
          onShowToast('success', `구글 시트에 총 ${orders.length}건의 주문이 안전하게 동기화되었습니다.`);
        } catch (err: any) {
          console.error(err);
          onShowToast('error', err.message || '동기화 중 오류가 발생했습니다.');
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  // 4. Import orders from Google Sheet (Sheet -> App)
  const handleImportOrdersFromSheet = async () => {
    if (!settings?.googleSheetId) return;

    setIsProcessing(true);
    try {
      const token = await requireToken();
      if (!token) {
        setIsProcessing(false);
        return;
      }

      const imported = await fetchOrdersFromSheet(token, settings.googleSheetId);
      if (imported.length === 0) {
        onShowToast('info', '구글 시트에 등록된 주문 데이터가 없습니다.');
        setIsProcessing(false);
        return;
      }

      // Save imported orders to server
      const res = await fetch('/api/admin/sync-orders-from-sheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionStorage.getItem('pottery_admin_token') || ''}`,
        },
        body: JSON.stringify({ orders: imported }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '주문 동기화 실패');
      }

      onOrdersImported(data.orders, data.message);
      await onUpdateSettings({ lastSyncedAt: data.lastSyncedAt });
      onShowToast('success', data.message || '구글 시트에서 주문을 성공적으로 불러왔습니다.');
    } catch (err: any) {
      console.error(err);
      onShowToast('error', err.message || '구글 시트에서 가져오는 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Disconnect sheet
  const handleDisconnectSheet = () => {
    setConfirmDialog({
      isOpen: true,
      title: '구글 시트 연동 해제',
      description: '현재 연결된 구글 시트 연동을 해제하시겠습니까? 구글 드라이브 내 스프레드시트 파일 자체는 삭제되지 않습니다.',
      onConfirm: async () => {
        setConfirmDialog(null);
        await onUpdateSettings({
          googleSheetId: '',
          googleSheetUrl: '',
          googleSheetName: '',
          lastSyncedAt: '',
        });
        onShowToast('info', '구글 시트 연동이 해제되었습니다.');
      },
    });
  };

  // 6. Toggle Auto-sync
  const handleToggleAutoSync = async () => {
    const nextState = !settings?.autoSyncEnabled;
    await onUpdateSettings({ autoSyncEnabled: nextState });
    onShowToast('info', `실시간 시트 자동 동기화가 [${nextState ? '켜짐' : '꺼짐'}](으)로 설정되었습니다.`);
  };

  const isConnected = Boolean(settings?.googleSheetId);

  return (
    <div className="bg-[#FAF7F2] border border-[#E3DACF] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE3D7] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#2A6D3A] text-white flex items-center justify-center shadow-xs">
            <FileSpreadsheet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#2D241E] flex items-center gap-1.5">
              <span>구글 시트(Google Sheets) 연동</span>
              {isConnected && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1F6E36] bg-[#E5F5E9] px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  연동됨
                </span>
              )}
            </h3>
            <p className="text-xs text-[#7D6C5F]">
              고객의 점토·슬립 주문 내역을 내 구글 스프레드시트에 자동으로 기록하고 관리합니다.
            </p>
          </div>
        </div>

        {/* Google User Auth Status */}
        <div className="flex items-center gap-2">
          {googleUser ? (
            <div className="flex items-center gap-2 bg-[#EFE8DE] px-3 py-1.5 rounded-xl border border-[#DFD6C8]">
              {googleUser.photoURL ? (
                <img
                  src={googleUser.photoURL}
                  alt={googleUser.displayName || 'Google'}
                  className="w-5 h-5 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[#8A502E] text-white text-[10px] font-bold flex items-center justify-center">
                  {(googleUser.displayName || googleUser.email || 'G')[0].toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <p className="text-xs font-semibold text-[#3D3128] leading-tight">
                  {googleUser.displayName || 'Google 계정'}
                </p>
                <p className="text-[10px] text-[#857364] leading-tight">
                  {googleUser.email}
                </p>
              </div>
              <button
                type="button"
                onClick={handleGoogleLogout}
                className="ml-1 p-1 text-[#8A796B] hover:text-[#9A3828] hover:bg-[#E3D9CC] rounded-md transition-colors"
                title="Google 계정 로그아웃"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="btn-google-signin"
              type="button"
              onClick={handleGoogleLogin}
              disabled={isAuthLoading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#3C4043] bg-white border border-[#D5CCC0] hover:bg-[#F8F6F2] transition-colors shadow-xs"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              <span>{isAuthLoading ? '연결 중...' : 'Google 계정 로그인'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      {!isConnected ? (
        /* Not Connected State */
        <div className="space-y-4 pt-1">
          <div className="bg-[#FAF5ED] border border-[#E9DFCF] rounded-xl p-4 text-xs text-[#6B5A4D] space-y-2">
            <p className="font-semibold text-[#3D2E22] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#8A502E]" />
              구글 시트 연동으로 주문 대장을 자동 관리하세요
            </p>
            <p className="leading-relaxed">
              점토 및 슬립 주문이 접수될 때마다 구글 스프레드시트에 주문번호, 주문자, 전화번호, 수량, 배송지, 주문 상태 등이 한 줄씩 자동으로 기록됩니다.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Option 1: Create New Sheet */}
            <button
              id="btn-create-sheet"
              type="button"
              onClick={handleCreateNewSheet}
              disabled={isProcessing}
              className="flex flex-col items-start p-4 rounded-xl border-2 border-dashed border-[#CBBBA8] hover:border-[#8A502E] bg-[#FAF8F5] hover:bg-[#F3ECE0] transition-colors text-left group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-[#8A502E] text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs sm:text-sm text-[#2D241E]">
                  새 구글 시트 자동 생성
                </span>
              </div>
              <p className="text-[11px] text-[#7C6B5E] leading-relaxed">
                '도디(DODI) 주문 관리 대장' 시트를 자동 생성하고 헤더 서식 및 현재 주문({orders.length}건)을 즉시 등록합니다.
              </p>
            </button>

            {/* Option 2: Connect Existing Sheet */}
            <button
              id="btn-toggle-existing-sheet"
              type="button"
              onClick={() => setShowCustomInput((prev) => !prev)}
              className="flex flex-col items-start p-4 rounded-xl border border-[#D9CFC2] hover:border-[#8A502E] bg-[#FAF8F5] hover:bg-[#F3ECE0] transition-colors text-left"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-[#594B40] text-white flex items-center justify-center">
                  <Link2 className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs sm:text-sm text-[#2D241E]">
                  기존 구글 시트 연결
                </span>
              </div>
              <p className="text-[11px] text-[#7C6B5E] leading-relaxed">
                이미 사용 중인 구글 스프레드시트의 주소(URL) 또는 시트 ID를 입력하여 연동합니다.
              </p>
            </button>
          </div>

          {/* Existing Sheet Input Form */}
          {showCustomInput && (
            <form
              onSubmit={handleConnectExistingSheet}
              className="bg-[#F4ECE1] border border-[#D9CEBF] p-3.5 rounded-xl space-y-2.5 animate-fadeIn"
            >
              <label className="block text-xs font-semibold text-[#423428]">
                구글 스프레드시트 URL 또는 시트 ID 입력
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customSheetInput}
                  onChange={(e) => setCustomSheetInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/... 또는 시트ID"
                  className="flex-1 px-3 py-2 rounded-lg text-xs bg-white border border-[#CFC3B3] focus:outline-none focus:ring-2 focus:ring-[#8A502E] text-[#2D241E]"
                />
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#8A502E] hover:bg-[#733F21] transition-colors disabled:opacity-50"
                >
                  {isProcessing ? '확인 중...' : '연결하기'}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        /* Connected State */
        <div className="space-y-4 pt-1">
          {/* Sheet Info Box */}
          <div className="bg-[#FAF8F5] border border-[#DFD6C8] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#2A6D3A]" />
                <span className="text-xs sm:text-sm font-bold text-[#2D241E]">
                  {settings.googleSheetName || '도디(DODI) 주문 관리 대장'}
                </span>
                <span className="text-[10px] text-[#8F7D70] font-mono">
                  [ID: {settings.googleSheetId?.slice(0, 10)}...]
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#806F62]">
                <Clock className="w-3 h-3" />
                <span>
                  마지막 동기화:{' '}
                  <strong className="text-[#4E3E33]">
                    {settings.lastSyncedAt || '아직 동기화되지 않음'}
                  </strong>
                </span>
                <span>·</span>
                <span>등록된 주문: {orders.length}건</span>
              </div>
            </div>

            {/* Direct Open Link */}
            {settings.googleSheetUrl && (
              <a
                href={settings.googleSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#256534] bg-[#E7F6EB] hover:bg-[#D5EEDC] border border-[#C7E4CE] transition-colors self-start sm:self-center"
              >
                <span>구글 시트 바로 열기</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Recent Changes Notice */}
          <div className="p-3 bg-[#FAF4ED] border border-[#E4D7C7] rounded-xl text-xs space-y-1.5">
            <div className="flex items-center justify-between font-bold text-[#4B392C]">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#8A502E]" />
                시트 서식 및 최신 변경 사항 적용
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#EADECE] text-[#554235] font-semibold">
                17개 열 헤더 연동
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-[#69584B]">
              <div>• <strong>수정 단가:</strong> 점토 24,000원 / 슬립 30,000원</div>
              <div>• <strong>운송 방법:</strong> 택배(개당 6,600원), 화물(별도문의), 직접수령(후불)</div>
            </div>
            <p className="text-[10.5px] text-[#867568]">
              <strong>[구글 시트로 전체 내보내기]</strong>를 누르면 변경된 단가·운송료 내역 및 17개 열 헤더 서식이 즉시 시트에 일괄 동기화됩니다.
            </p>
          </div>

          {/* Sync Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Export (App -> Sheet) */}
            <button
              id="btn-sync-to-sheet"
              type="button"
              onClick={handleExportAllOrders}
              disabled={isProcessing}
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#8A502E] hover:bg-[#744123] transition-colors shadow-xs disabled:opacity-60"
            >
              <ArrowUpFromLine className="w-4 h-4" />
              <span>{isProcessing ? '동기화 진행 중...' : `구글 시트로 전체 내보내기 (${orders.length}건)`}</span>
            </button>

            {/* Import (Sheet -> App) */}
            <button
              id="btn-import-from-sheet"
              type="button"
              onClick={handleImportOrdersFromSheet}
              disabled={isProcessing}
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#48382D] bg-[#EFE8DD] hover:bg-[#E5DBCF] border border-[#DDD3C5] transition-colors disabled:opacity-60"
            >
              <ArrowDownToLine className="w-4 h-4 text-[#8A502E]" />
              <span>구글 시트에서 주문 불러오기</span>
            </button>
          </div>

          {/* Settings Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#EAE2D5] text-xs text-[#7A695C]">
            {/* Auto-sync Toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.autoSyncEnabled ?? true}
                onChange={handleToggleAutoSync}
                className="w-4 h-4 rounded text-[#8A502E] focus:ring-[#8A502E] border-[#D0C4B4] accent-[#8A502E]"
              />
              <span className="font-medium text-[#403328]">
                주문 접수 및 상태 변경 시 시트 자동 갱신
              </span>
            </label>

            {/* Disconnect Button */}
            <button
              type="button"
              onClick={handleDisconnectSheet}
              className="inline-flex items-center gap-1 text-[11px] text-[#A24838] hover:text-[#802D1E] hover:underline"
            >
              <Unlink className="w-3 h-3" />
              <span>시트 연동 해제</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal (Per SKILL guidelines) */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#FAF7F2] border border-[#D9CEBF] rounded-2xl p-5 max-w-md w-full shadow-xl space-y-4 animate-fadeIn">
            <div className="flex items-center gap-2 text-[#8A502E]">
              <AlertCircle className="w-5 h-5" />
              <h4 className="font-bold text-sm sm:text-base text-[#2D241E]">
                {confirmDialog.title}
              </h4>
            </div>
            <p className="text-xs text-[#6E5D50] leading-relaxed">
              {confirmDialog.description}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#655548] bg-[#EFE9DF] hover:bg-[#E4DCD0] transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#8A502E] hover:bg-[#723E20] transition-colors"
              >
                진행하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
