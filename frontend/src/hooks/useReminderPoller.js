import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDueReminders } from '../utils/api';

/**
 * Hook that polls for due reminders at regular intervals.
 * Returns dueReminders and isChecking state.
 * 
 * @param {number} pollIntervalSeconds - Interval between polls (default 15 seconds)
 * @param {number} withinMinutes - How many minutes into the future to check (default 60)
 * @returns {{ dueReminders: Array, isChecking: boolean }}
 */
export function useReminderPoller(pollIntervalSeconds = 15, withinMinutes = 60) {
  const [dueReminders, setDueReminders] = useState([]);
  const [isChecking, setIsChecking] = useState(false);
  const intervalRef = useRef(null);
  const processedRemindersRef = useRef(new Set()); // Track already-triggered reminders

  const checkDueReminders = useCallback(async () => {
    try {
      setIsChecking(true);
      const response = await fetchDueReminders(withinMinutes);
      const reminders = response?.data || [];
      
      // Filter for reminders that are now or in the past
      const now = new Date();
      const triggeredReminders = reminders.filter((reminder) => {
        const remindAtTime = new Date(reminder.remind_at);
        // Check if reminder time has passed and we haven't already triggered it
        if (remindAtTime <= now && !processedRemindersRef.current.has(reminder.id)) {
          processedRemindersRef.current.add(reminder.id);
          return true;
        }
        return false;
      });

      setDueReminders(triggeredReminders);
    } catch (error) {
      console.error('Error checking reminders:', error);
    } finally {
      setIsChecking(false);
    }
  }, [withinMinutes]);

  // Set up polling interval
  useEffect(() => {
    // Check immediately on mount
    checkDueReminders();

    // Set up interval for continuous checking
    intervalRef.current = setInterval(() => {
      checkDueReminders();
    }, pollIntervalSeconds * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkDueReminders, pollIntervalSeconds]);

  return {
    dueReminders,
    isChecking,
  };
}
