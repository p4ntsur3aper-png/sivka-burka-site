import type { ApiResponse, ContentBlock, ManagedPageKey, MediaAsset, MediaFolder } from '../types';
import { request } from './backendApi';

export const getPageContent = (pageKey: ManagedPageKey): Promise<ApiResponse<ContentBlock[]>> =>
  request<ContentBlock[]>(`/pages/${pageKey}/content`);

export const createContentBlock = (data: Omit<ContentBlock, 'id'>): Promise<ApiResponse<ContentBlock>> =>
  request<ContentBlock>('/content-blocks', { method: 'POST', body: JSON.stringify(data) });

export const updateContentBlock = (id: string, data: Partial<ContentBlock>): Promise<ApiResponse<ContentBlock | undefined>> =>
  request<ContentBlock | undefined>(`/content-blocks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteContentBlock = (id: string): Promise<ApiResponse<{ id: string }>> =>
  request<{ id: string }>(`/content-blocks/${id}`, { method: 'DELETE' });

export const reorderContentBlocks = (pageKey: ManagedPageKey, orderedIds: string[]): Promise<ApiResponse<ContentBlock[]>> =>
  request<ContentBlock[]>('/content-blocks/reorder', { method: 'POST', body: JSON.stringify({ pageKey, orderedIds }) });

export const getMediaAssets = (): Promise<ApiResponse<MediaAsset[]>> => request<MediaAsset[]>('/media');

export const getMediaFolders = (): Promise<ApiResponse<MediaFolder[]>> => request<MediaFolder[]>('/media-folders');

export const createMediaAsset = (data: Omit<MediaAsset, 'id' | 'createdAt'>): Promise<ApiResponse<MediaAsset>> =>
  request<MediaAsset>('/media', { method: 'POST', body: JSON.stringify(data) });

export const updateMediaAsset = (id: string, data: Partial<MediaAsset>): Promise<ApiResponse<MediaAsset | undefined>> =>
  request<MediaAsset | undefined>(`/media/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteMediaAsset = (id: string): Promise<ApiResponse<{ id: string }>> =>
  request<{ id: string }>(`/media/${id}`, { method: 'DELETE' });
