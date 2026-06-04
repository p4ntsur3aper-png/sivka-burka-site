import type { ApiResponse, Notification } from '../types';
import { env } from './env';
import { getNotificationSettings, showBrowserNotification } from './staffSettings';

const NOTIFICATIONS_KEY = 'orlov_notifications';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const delay = (ms = 300) => new Promise((resolve) => window.setTimeout(resolve, ms));

const respond = async <T>(data: T, ms?: number): Promise<ApiResponse<T>> => {
  await delay(ms);
  return { data };
};

async function backendRequest<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });
  const raw = await response.text();
  const parsed = raw ? JSON.parse(raw) : {};
  if (!response.ok) {
    throw new Error(parsed.message || `HTTP ${response.status}`);
  }
  return parsed && typeof parsed === 'object' && 'data' in parsed ? parsed : { data: parsed as T };
}

function readStorage<T>(key: string, fallback: T): T {
  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) return clone(fallback);

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    window.localStorage.removeItem(key);
    return clone(fallback);
  }
}

function writeStorage<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event('orlov-content-updated'));
}

function getStoredNotifications() {
  return readStorage<Notification[]>(NOTIFICATIONS_KEY, []);
}

function saveStoredNotifications(items: Notification[]) {
  writeStorage(NOTIFICATIONS_KEY, items);
}

export async function getNotifications(recipientId?: string): Promise<ApiResponse<Notification[]>> {
  if (!env.useMockApi) {
    const query = recipientId ? `?recipientId=${encodeURIComponent(recipientId)}` : '';
    const response = await backendRequest<Notification[]>(`/notifications${query}`);
    response.data.filter((item) => !item.isRead).forEach(showBrowserNotification);
    return response;
  }

  const notifications = getStoredNotifications()
    .filter((item) => (recipientId ? item.recipientId === recipientId : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return respond(notifications);
}

export async function getNotificationsByRecipient(
  recipientRole: Notification['recipientRole'],
  recipientId: string,
): Promise<ApiResponse<Notification[]>> {
  if (!env.useMockApi) {
    const query = new URLSearchParams({ recipientRole, recipientId });
    const response = await backendRequest<Notification[]>(`/notifications?${query.toString()}`);
    response.data.filter((item) => !item.isRead).forEach(showBrowserNotification);
    return response;
  }

  const notifications = getStoredNotifications()
    .filter((item) => item.recipientRole === recipientRole && item.recipientId === recipientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return respond(notifications);
}

export async function createNotification(
  data: Omit<Notification, 'id' | 'createdAt' | 'isRead'>,
): Promise<ApiResponse<Notification>> {
  if (!env.useMockApi) {
    const response = await backendRequest<Notification>('/notifications', { method: 'POST', body: JSON.stringify(data) });
    showBrowserNotification(response.data);
    return response;
  }

  const settings = getNotificationSettings(data.recipientRole, data.recipientId);
  const notification: Notification = {
    ...data,
    id: `notification-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    isRead: false,
  };

  if (settings.inApp) {
    saveStoredNotifications([notification, ...getStoredNotifications()]);
  }
  showBrowserNotification(notification);
  return respond(notification);
}

export async function markNotificationAsRead(id: string): Promise<ApiResponse<Notification | undefined>> {
  if (!env.useMockApi) {
    return backendRequest<Notification | undefined>(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  let updatedNotification: Notification | undefined;
  const nextItems = getStoredNotifications().map((notification) => {
    if (notification.id !== id) return notification;
    updatedNotification = { ...notification, isRead: true };
    return updatedNotification;
  });
  saveStoredNotifications(nextItems);
  return respond(updatedNotification);
}

export async function getUnreadNotificationsCount(recipientId?: string): Promise<ApiResponse<number>> {
  if (!env.useMockApi) {
    const query = recipientId ? `?recipientId=${encodeURIComponent(recipientId)}` : '';
    return backendRequest<number>(`/notifications/unread-count${query}`);
  }

  const count = getStoredNotifications().filter((item) => !item.isRead && (!recipientId || item.recipientId === recipientId)).length;
  return respond(count);
}
