import { useEffect, useState, useCallback } from 'react';

/**
 * Hook for countdown timer to a specific date/time
 * Updates every second
 * 
 * @param {string|Date} targetDateTime - ISO string or Date object to count down to
 * @param {function} onComplete - Callback when countdown reaches zero
 * @returns {{ timeRemaining: string, isExpired: boolean, totalSeconds: number }}
 */
export function useCountdown(targetDateTime, onComplete) {
  const [timeRemaining, setTimeRemaining] = useState('00:00:00');
  const [isExpired, setIsExpired] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(0);

  const calculateTimeRemaining = useCallback(() => {
    const now = new Date();
    const target = new Date(targetDateTime);
    const diffMs = target - now;

    if (diffMs <= 0) {
      setTimeRemaining('00:00:00');
      setIsExpired(true);
      setTotalSeconds(0);
      return true; // Expired
    }

    // Calculate hours, minutes, seconds
    const totalSecs = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;

    const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    setTimeRemaining(formatted);
    setTotalSeconds(totalSecs);
    setIsExpired(false);
    return false;
  }, [targetDateTime]);

  useEffect(() => {
    // Calculate immediately on mount
    const isExpiredNow = calculateTimeRemaining();

    if (isExpiredNow && onComplete) {
      onComplete();
      return;
    }

    // Set up interval to update every second
    const interval = setInterval(() => {
      const expired = calculateTimeRemaining();
      if (expired && onComplete) {
        onComplete();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateTimeRemaining, onComplete]);

  return {
    timeRemaining,
    isExpired,
    totalSeconds,
  };
}
