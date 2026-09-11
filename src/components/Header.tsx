import React from 'react';
import { Package, ShieldCheck, Search, LogOut, ArrowLeft } from 'lucide-react';
import type { StudioSettings } from '../types.ts';

interface HeaderProps {
  settings: StudioSettings | null;
  isAdmin: boolean;
  isAdminMode: boolean;
  onToggleAdminMode: () => void;
  onOpenAdminLogin: () => void;
  onLogoutAdmin: () => void;
  onOpenLookup: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  isAdmin,
  isAdminMode,
  onToggleAdminMode,
  onOpenAdminLogin,
  onLogoutAdmin,
  onOpenLookup,
}) => {
  return (
    <header className="bg-[#FAF7F2] border-b border-[#E6DFD5] sticky top-0 z-30 shadow-xs">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8A502E] text-white flex items-center justify-center shadow-xs">
            <Package className="w-5 h-5 text-[#FDFBF7]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-[#2D241E] tracking-tight">
                {settings?.studioName || '도디[DODI] 도예재료 보급소'}
              </h1>
              {isAdminMode ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#8A502E] text-white px-2 py-0.5 rounded-md">
                  <ShieldCheck className="w-3 h-3" />
                  관리자
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center text-[11px] font-medium text-[#7D6B5D] bg-[#EFE9DF] px-2 py-0.5 rounded-md">
                  도예인 전용 재료주문
                </span>
              )}
              {settings?.googleSheetId && (
                <span
                  className="hidden md:inline-flex items-center gap-1 text-[10px] font-semibold text-[#1C6030] bg-[#E8F6EC] border border-[#C5E8CE] px-2 py-0.5 rounded-md"
                  title="구글 스프레드시트 실시간 동기화 중"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D42] animate-pulse" />
                  구글시트 연동
                </span>
              )}
            </div>
            <p className="text-xs text-[#8A7A6D] hidden xs:block">
              {isAdminMode
                ? '주문 목록 실시간 확인 및 배송 상태 직접 관리'
                : '점토 · 슬립 재료 확인 및 간편 주문 시스템'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {!isAdminMode ? (
            <>
              {/* Order lookup button */}
              <button
                id="btn-open-lookup"
                type="button"
                onClick={onOpenLookup}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#574436] bg-[#ECE5DB] hover:bg-[#E3D9CD] transition-colors"
                title="내 주문 상태 조회"
              >
                <Search className="w-3.5 h-3.5" />
                <span>주문 조회</span>
              </button>

              {/* Admin login or switch to admin */}
              {isAdmin ? (
                <button
                  id="btn-switch-to-admin"
                  type="button"
                  onClick={onToggleAdminMode}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#8A502E] hover:bg-[#744123] transition-colors shadow-xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>관리자 모드</span>
                </button>
              ) : (
                <button
                  id="btn-admin-login-modal"
                  type="button"
                  onClick={onOpenAdminLogin}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#7C6B5E] hover:text-[#2D241E] hover:bg-[#EFE9DF] transition-colors"
                  title="관리자 전용 로그인"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#8A7A6D]" />
                  <span>관리자</span>
                </button>
              )}
            </>
          ) : (
            <>
              {/* Return to Customer view */}
              <button
                id="btn-back-to-customer"
                type="button"
                onClick={onToggleAdminMode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#574436] bg-[#ECE5DB] hover:bg-[#E3D9CD] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>고객 화면</span>
              </button>

              {/* Admin Logout */}
              <button
                id="btn-admin-logout"
                type="button"
                onClick={onLogoutAdmin}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#8F3324] hover:bg-[#FBEBE8] transition-colors"
                title="관리자 로그아웃"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>로그아웃</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
