import React, { useState, useRef } from 'react';
import { Check, ClipboardCheck } from 'lucide-react';

interface SwipeablePatientCardProps {
  children: React.ReactNode;
  onSwipeRight: () => void; // Cycle status
  onSwipeLeft: () => void; // Jump to procedure registration
  statusLabel?: string;
}

export const SwipeablePatientCard: React.FC<SwipeablePatientCardProps> = ({
  children,
  onSwipeRight,
  onSwipeLeft,
  statusLabel = 'تغییر وضعیت',
}) => {
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isVerticalScrollRef = useRef<boolean | null>(null);

  const SWIPE_THRESHOLD = 72;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isVerticalScrollRef.current = null;
    setIsSwiping(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current === null || startYRef.current === null) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - startXRef.current;
    const dy = currentY - startYRef.current;

    // Lock direction on first significant movement
    if (isVerticalScrollRef.current === null) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        isVerticalScrollRef.current = true;
        return;
      }
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        isVerticalScrollRef.current = false;
        setIsSwiping(true);
      }
    }

    if (isVerticalScrollRef.current) return;

    if (isSwiping || Math.abs(dx) > 10) {
      // Apply resistance beyond threshold
      const clamped = Math.max(-120, Math.min(120, dx * 0.75));
      setOffsetX(clamped);
    }
  };

  const handleTouchEnd = () => {
    if (isSwiping) {
      if (offsetX >= SWIPE_THRESHOLD) {
        try {
          if ('vibrate' in navigator) navigator.vibrate(18);
        } catch {}
        onSwipeRight();
      } else if (offsetX <= -SWIPE_THRESHOLD) {
        try {
          if ('vibrate' in navigator) navigator.vibrate(25);
        } catch {}
        onSwipeLeft();
      }
    }
    startXRef.current = null;
    startYRef.current = null;
    isVerticalScrollRef.current = null;
    setIsSwiping(false);
    setOffsetX(0);
  };

  const isTriggeredRight = offsetX >= SWIPE_THRESHOLD;
  const isTriggeredLeft = offsetX <= -SWIPE_THRESHOLD;

  return (
    <div className="relative overflow-hidden rounded-2xl select-none">
      {/* Background Action Indicators revealed during swipe */}
      {offsetX !== 0 && (
        <div
          className={`absolute inset-0 flex items-center justify-between px-4 rounded-2xl text-xs font-extrabold transition-colors ${
            offsetX > 0
              ? isTriggeredRight
                ? 'bg-emerald-500 text-white'
                : 'bg-emerald-500/20 text-emerald-500'
              : isTriggeredLeft
              ? 'bg-sky-500 text-white'
              : 'bg-sky-500/20 text-sky-500'
          }`}
        >
          {/* Left side (revealed when swiping right: dx > 0) */}
          <div
            className={`flex items-center gap-1.5 ${
              offsetX > 0 ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>{statusLabel}</span>
          </div>

          {/* Right side (revealed when swiping left: dx < 0) */}
          <div
            className={`flex items-center gap-1.5 ${
              offsetX < 0 ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <span>ثبت کار انجام‌شده</span>
            <ClipboardCheck className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>
      )}

      {/* Foreground Card Content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          transform: offsetX ? `translateX(${offsetX}px)` : undefined,
          transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
};
