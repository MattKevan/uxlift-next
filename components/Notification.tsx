// components/Notification.tsx
'use client';
import React from 'react';
import { useNotification } from '@/contexts/NotificationContext';

const Notification: React.FC = () => {
  const { notifications, removeNotification } = useNotification();

  const getNotificationClasses = (type: string) => {
    switch (type) {
      case 'success':
        return 'border-green-500 bg-green-100 dark:bg-green-800/20 dark:border-green-800 ';
      case 'error':
        return 'border-red-500 bg-red-100 dark:bg-red-800/20 dark:border-red-800 ';
      case 'warning':
        return 'border-yellow-500 bg-yellow-100 dark:bg-yellow-800/20 dark:border-yellow-800 ';
      case 'info':
        return 'border-blue-500 bg-blue-100 dark:bg-blue-800/20 dark:border-blue-800 ';
      default:
        return 'border-gray-500 bg-gray-100 dark:bg-gray-800/20 dark:border-gray-800 ';
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`${getNotificationClasses(
            notification.type
          )} max-w-xs border text-sm p-4 text-gray-800 rounded-lg dark:text-white font-sans`}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => removeNotification(notification.id)}
            className="ml-4 text-white focus:outline-none"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
};

export default Notification;
