import React, { useState } from 'react';
import { ShieldCheck, Lock, X, AlertCircle } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (token: string) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('관리자 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '인증에 실패했습니다.');
        return;
      }

      onLoginSuccess(data.token);
      setPassword('');
      onClose();
    } catch (err) {
      console.error(err);
      setError('서버와 통신 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-[#FAF7F2] border border-[#E6DFD5] w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E8E0D5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#8A502E] text-white flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-[#2D241E]">관리자 인증</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#8A7A6D] hover:text-[#2D241E] hover:bg-[#EFE8DF] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-[#7A695C] leading-relaxed">
            관리자 전용 페이지입니다. 주문 확인 및 배송 상태 직접 변경을 위해 관리자 비밀번호를 입력해주세요.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#44362B] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#8A7A6D]" />
              <span>관리자 비밀번호</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="비밀번호 입력"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9CFC4] bg-white text-sm text-[#2D241E] placeholder:text-[#9F9185] focus:outline-none focus:ring-2 focus:ring-[#8A502E]"
              autoFocus
            />
          </div>

          <div className="p-2.5 rounded-lg bg-[#F0EAE1] border border-[#E0D5C7] text-[11px] text-[#715D4F]">
            💡 초기 관리자 기본 비밀번호는 <code className="font-mono font-bold text-[#8A502E]">clay1234</code> 입니다.
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#FBEBE8] border border-[#F3CCC4] text-xs text-[#8F3324]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-semibold text-[#544336] bg-white border border-[#DDD3C7] rounded-xl hover:bg-[#FAF7F2] transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 text-xs font-semibold text-white bg-[#8A502E] hover:bg-[#744123] rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? '인증 중...' : '로그인'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
