import type { Booking, ManagerBookingFilters } from '../types';
import * as backend from './backendApi';

export const getManagerBookings = (filters?: ManagerBookingFilters) => backend.getManagerBookings(filters);
export const getManagerBookingById = (id: string) => backend.getManagerBookingById(id);
export const getManagerDashboardStats = () => backend.getManagerDashboardStats();
export const getManagerAttentionBookings = () => backend.getManagerAttentionBookings();
export const getManagerTrainerWorkload = (dateFrom?: string, dateTo?: string) =>
  backend.getManagerTrainerWorkload(dateFrom, dateTo);
export const getManagerHorseWorkload = (dateFrom?: string, dateTo?: string) =>
  backend.getManagerHorseWorkload(dateFrom, dateTo);
export const managerAssignTrainer = (bookingId: string, trainerId?: string) =>
  backend.assignBookingTrainer(bookingId, trainerId);
export const managerUpdateBookingStatus = (bookingId: string, status: Booking['status'], adminComment?: string) =>
  backend.updateBookingStatus(bookingId, status, adminComment);
export const getManagerReferenceData = () => backend.getManagerReferenceData();
export const getManagerTodaySchedule = () => backend.getManagerTodaySchedule();
