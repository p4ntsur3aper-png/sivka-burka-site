import type { ApiResponse, Notification } from '../types';
import { request } from './backendApi';
import { showBrowserNotification } from './staffSettings';

function notifyUnread(items: Notification[]) {
  items.filter((item) => !item.isRead).forEach(showBrowserNotification);
}

export async function getNotifications(recipientId?: string): Promise<ApiResponse<Notification[]>> {
  const query = recipientId ? `?recipientId=${encodeURIComponent(recipientId)}` : '';
  const response = await request<Notification[]>(`/notifications${query}`);
  notifyUnread(response.data);
  return response;
}

export async function getNotificationsByRecipient(
  recipientRole: Notification['recipientRole'],
  recipientId: string,
): Promise<ApiResponse<Notification[]>> {
  const query = new URLSearchParams({ recipientRole, recipientId });
  const response = await request<Notification[]>(`/notifications?${query.toString()}`);
  notifyUnread(response.data);
  return response;
}

export async function createNotification(
  data: Omit<Notification, 'id' | 'createdAt' | 'isRead'>,
): Promise<ApiResponse<Notification>> {
  const response = await request<Notification>('/notifications', { method: 'POST', body: JSON.stringify(data) });
  showBrowserNotification(response.data);
  return response;
}

export const markNotificationAsRead = (id: string): Promise<ApiResponse<Notification | undefined>> =>
  request<Notification | undefined>(`/notifications/${id}/read`, { method: 'PATCH' });

export const getUnreadNotificationsCount = (recipientId?: string): Promise<ApiResponse<number>> => {
  const query = recipientId ? `?recipientId=${encodeURIComponent(recipientId)}` : '';
  return request<number>(`/notifications/unread-count${query}`);
};
