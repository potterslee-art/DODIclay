import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-6 right-4 left-4 sm:left-auto sm:right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl shadow-lg border text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-[#2E4F3E] text-white border-[#244032]'
                : toast.type === 'error'
                ? 'bg-[#8F3324] text-white border-[#752618]'
                : 'bg-[#3D332A] text-white border-[#2D251D]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#A1D9B5] shrink-0" />}
              {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-[#FFB4A2] shrink-0" />}
              {toast.type === 'info' && <Info className="w-4 h-4 text-[#E6DFD5] shrink-0" />}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="ml-2 text-white/70 hover:text-white p-1 rounded-lg transition-colors"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
