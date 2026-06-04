import {
  assignBookingTrainer,
  getBookingById,
  getBookings,
  getHorses,
  getServices,
  getTrainers,
  updateBookingStatus,
} from './mockApi';
import * as backend from './backendApi';
import { env } from './env';
import type {
  ApiResponse,
  Booking,
  HorseWorkloadSummary,
  ManagerAttentionBooking,
  ManagerBookingFilters,
  ManagerDashboardStats,
  TrainerWorkloadSummary,
} from '../types';

const MIN_REST_MINUTES = 30;

const toDateTime = (date: string, time: string) => new Date(`${date}T${time}:00`);

const durationHours = (booking: Booking) =>
  Math.max((toDateTime(booking.date, booking.endTime).getTime() - toDateTime(booking.date, booking.startTime).getTime()) / 3600000, 0);

const isDateInRange = (date: string, dateFrom?: string, dateTo?: string) => {
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
};

const isSameDay = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

const getWeekRange = () => {
  const now = new Date();
  const day = now.getDay();
  const shift = day === 0 ? 6 : day - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - shift);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
};

const findRestWarnings = (bookings: Booking[]) => {
  const byHorse = new Map<string, Booking[]>();

  bookings.forEach((booking) => {
    booking.assignedHorses.forEach((pair) => {
      const bucket = byHorse.get(pair.horseId) || [];
      bucket.push(booking);
      byHorse.set(pair.horseId, bucket);
    });
  });

  const warnings = new Map<string, number>();
  byHorse.forEach((horseBookings, horseId) => {
    const sorted = [...horseBookings].sort((a, b) =>
      toDateTime(a.date, a.startTime).getTime() - toDateTime(b.date, b.startTime).getTime(),
    );
    let count = 0;
    for (let i = 1; i < sorted.length; i += 1) {
      const prevEnd = toDateTime(sorted[i - 1].date, sorted[i - 1].endTime).getTime();
      const nextStart = toDateTime(sorted[i].date, sorted[i].startTime).getTime();
      const restMinutes = (nextStart - prevEnd) / 60000;
      if (restMinutes >= 0 && restMinutes < MIN_REST_MINUTES) {
        count += 1;
      }
    }
    warnings.set(horseId, count);
  });
  return warnings;
};

function filterBookings(bookings: Booking[], filters?: ManagerBookingFilters) {
  if (!filters) return bookings;

  const searchValue = filters.search?.trim().toLowerCase();

  return bookings.filter((booking) => {
    if (filters.status && filters.status !== 'all' && booking.status !== filters.status) return false;
    if (!isDateInRange(booking.date, filters.dateFrom, filters.dateTo)) return false;
    if (filters.serviceId && booking.serviceId !== filters.serviceId) return false;
    if (filters.trainerId && booking.assignedTrainerId !== filters.trainerId) return false;

    if (searchValue) {
      const haystack = `${booking.clientName} ${booking.clientPhone}`.toLowerCase();
      if (!haystack.includes(searchValue)) return false;
    }

    return true;
  });
}

export async function getManagerBookings(filters?: ManagerBookingFilters): Promise<ApiResponse<Booking[]>> {
  if (!env.useMockApi) return backend.getManagerBookings(filters);

  const [{ data: bookings }] = await Promise.all([getBookings()]);
  const filtered = filterBookings(bookings, filters).sort((a, b) =>
    toDateTime(a.date, a.startTime).getTime() - toDateTime(b.date, b.startTime).getTime(),
  );
  return { data: filtered };
}

export async function getManagerBookingById(id: string): Promise<ApiResponse<Booking | undefined>> {
  if (!env.useMockApi) return backend.getManagerBookingById(id);
  return getBookingById(id);
}

export async function getManagerDashboardStats(): Promise<ApiResponse<ManagerDashboardStats>> {
  if (!env.useMockApi) return backend.getManagerDashboardStats();

  const { data: bookings } = await getBookings();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const { weekStart, weekEnd } = getWeekRange();

  const weekBookings = bookings.filter((booking) => {
    const dt = toDateTime(booking.date, booking.startTime);
    return dt >= weekStart && dt <= weekEnd;
  });

  return {
    data: {
      newRequestsCount: bookings.filter((booking) => booking.status === 'pending').length,
      todayBookingsCount: bookings.filter((booking) => booking.date === today).length,
      unassignedBookingsCount: bookings.filter((booking) => !booking.assignedTrainerId).length,
      needsClarificationCount: bookings.filter((booking) => booking.status === 'needs_clarification').length,
      confirmedThisWeekCount: weekBookings.filter((booking) => booking.status === 'confirmed').length,
      rejectedThisWeekCount: weekBookings.filter((booking) => booking.status === 'rejected').length,
    },
  };
}

export async function getManagerAttentionBookings(): Promise<ApiResponse<ManagerAttentionBooking[]>> {
  if (!env.useMockApi) return backend.getManagerAttentionBookings();

  const [{ data: bookings }, { data: horses }] = await Promise.all([getBookings(), getHorses()]);
  const restWarnings = findRestWarnings(bookings);
  const activeHorseIds = new Set(horses.filter((horse) => horse.isActive && horse.status === 'available').map((horse) => horse.id));

  const result: ManagerAttentionBooking[] = bookings
    .map((booking) => {
      const reasons: string[] = [];
      if (booking.status === 'pending') reasons.push('Ожидает подтверждения');
      if (booking.status === 'needs_clarification') reasons.push('Требуется уточнение');
      if (!booking.assignedTrainerId) reasons.push('Не назначен тренер');
      if (booking.assignedHorses.length < booking.participants.length) reasons.push('Не всем участникам назначены лошади');

      const hasInactiveHorse = booking.assignedHorses.some((pair) => !activeHorseIds.has(pair.horseId));
      if (hasInactiveHorse) reasons.push('Назначена недоступная лошадь');

      const hasRestWarning = booking.assignedHorses.some((pair) => (restWarnings.get(pair.horseId) || 0) > 0);
      if (hasRestWarning) reasons.push('Потенциальный конфликт отдыха лошади');

      return { booking, reasons };
    })
    .filter((item) => item.reasons.length > 0)
    .sort((a, b) => toDateTime(a.booking.date, a.booking.startTime).getTime() - toDateTime(b.booking.date, b.booking.startTime).getTime());

  return { data: result };
}

export async function getManagerTrainerWorkload(dateFrom?: string, dateTo?: string): Promise<ApiResponse<TrainerWorkloadSummary[]>> {
  if (!env.useMockApi) return backend.getManagerTrainerWorkload(dateFrom, dateTo);

  const [{ data: bookings }, { data: trainers }] = await Promise.all([getBookings(), getTrainers()]);

  const scoped = bookings.filter((booking) => isDateInRange(booking.date, dateFrom, dateTo));

  const rows = trainers.map((trainer) => {
    const trainerBookings = scoped.filter((booking) => booking.assignedTrainerId === trainer.id);
    return {
      trainerId: trainer.id,
      trainerName: trainer.fullName,
      bookingsCount: trainerBookings.length,
      hoursPlanned: Number(trainerBookings.reduce((acc, booking) => acc + durationHours(booking), 0).toFixed(1)),
      pendingCount: trainerBookings.filter((booking) => booking.status === 'pending').length,
      needsClarificationCount: trainerBookings.filter((booking) => booking.status === 'needs_clarification').length,
    };
  });

  return { data: rows };
}

export async function getManagerHorseWorkload(dateFrom?: string, dateTo?: string): Promise<ApiResponse<HorseWorkloadSummary[]>> {
  if (!env.useMockApi) return backend.getManagerHorseWorkload(dateFrom, dateTo);

  const [{ data: bookings }, { data: horses }] = await Promise.all([getBookings(), getHorses()]);
  const scoped = bookings.filter((booking) => isDateInRange(booking.date, dateFrom, dateTo));
  const restWarnings = findRestWarnings(scoped);

  const rows = horses.map((horse) => {
    const horseBookings = scoped.filter((booking) => booking.assignedHorses.some((pair) => pair.horseId === horse.id));
    return {
      horseId: horse.id,
      horseName: horse.name,
      bookingsCount: horseBookings.length,
      hoursPlanned: Number(horseBookings.reduce((acc, booking) => acc + durationHours(booking), 0).toFixed(1)),
      restWarningsCount: restWarnings.get(horse.id) || 0,
    };
  });

  return { data: rows };
}

export async function managerAssignTrainer(bookingId: string, trainerId?: string) {
  if (!env.useMockApi) return backend.assignBookingTrainer(bookingId, trainerId);
  return assignBookingTrainer(bookingId, trainerId);
}

export async function managerUpdateBookingStatus(bookingId: string, status: Booking['status'], adminComment?: string) {
  if (!env.useMockApi) return backend.updateBookingStatus(bookingId, status, adminComment);
  return updateBookingStatus(bookingId, status, adminComment);
}

export async function getManagerReferenceData() {
  if (!env.useMockApi) return backend.getManagerReferenceData();

  const [services, trainers, horses] = await Promise.all([getServices(), getTrainers(), getHorses()]);
  return {
    data: {
      services: services.data,
      trainers: trainers.data,
      horses: horses.data,
    },
  };
}

export async function getManagerTodaySchedule() {
  if (!env.useMockApi) return backend.getManagerTodaySchedule();

  const { data: bookings } = await getBookings();
  const today = new Date();
  const todayItems = bookings
    .filter((booking) => isSameDay(toDateTime(booking.date, booking.startTime), today))
    .sort((a, b) => toDateTime(a.date, a.startTime).getTime() - toDateTime(b.date, b.startTime).getTime());
  return { data: todayItems };
}
