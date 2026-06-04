import {
  getEditableBookingRules,
  getEditableBookings,
  getEditableContacts,
  getEditableGalleryItems,
  getEditableHorses,
  getEditableTrainers,
  getEditableReviews,
  getEditableRulesInfo,
  getEditableServices,
  getEditableSiteContent,
  saveEditableBookingRules,
  saveEditableBookings,
  saveEditableContacts,
  saveEditableHorses,
  saveEditableReviews,
  saveEditableRulesInfo,
} from './adminContent';
import { checkBookingAvailability, createMockBooking, getAvailableDates, getAvailableTimeSlots } from './availabilityService';
import { createNotification } from './notificationRepository';
import type {
  ApiResponse,
  AvailabilityCheckResult,
  Booking,
  BookingRequest,
  BookingRule,
  ContactInfo,
  GalleryItem,
  Horse,
  Review,
  RulesInfo,
  Service,
  SiteContent,
  Trainer,
  TimeSlot,
} from '../types';

const delay = (ms = 450) => new Promise((resolve) => window.setTimeout(resolve, ms));

const respond = async <T>(data: T, ms?: number): Promise<ApiResponse<T>> => {
  await delay(ms);
  return { data };
};

export async function getServices(): Promise<ApiResponse<Service[]>> {
  return respond(getEditableServices());
}

export async function getServiceById(id: string): Promise<ApiResponse<Service | undefined>> {
  return respond(getEditableServices().find((service) => service.id === id));
}

export async function getSiteContent(): Promise<ApiResponse<SiteContent>> {
  return respond(getEditableSiteContent());
}

export async function createBookingRequest(data: BookingRequest): Promise<ApiResponse<{ requestId: string }>> {
  await delay(700);

  if (data.clientPhone.includes('000000')) {
    throw new Error('MOCK_REQUEST_ERROR');
  }

  const booking = createMockBooking(data);
  await createNotification({
    recipientRole: 'admin',
    recipientId: 'admin-local',
    type: 'booking_created',
    channel: 'in_app',
    title: 'Новая заявка',
    message: `Новая заявка на ${booking.date} в ${booking.startTime}.`,
    bookingId: booking.id,
  });
  await createNotification({
    recipientRole: 'manager',
    recipientId: 'manager-local',
    type: 'booking_created',
    channel: 'in_app',
    title: 'Новая заявка',
    message: `Новая заявка на ${booking.date} в ${booking.startTime}.`,
    bookingId: booking.id,
  });

  return {
    data: { requestId: booking.id },
    message: 'Заявка отправлена и ожидает подтверждения администратора',
  };
}

export async function getHorses(): Promise<ApiResponse<Horse[]>> {
  return respond(getEditableHorses());
}

export async function getTrainers(): Promise<ApiResponse<Trainer[]>> {
  return respond(getEditableTrainers());
}

export async function createHorse(data: Horse): Promise<ApiResponse<Horse>> {
  const horses = [data, ...getEditableHorses()];
  saveEditableHorses(horses);
  return respond(data);
}

export async function updateHorse(id: string, data: Partial<Horse>): Promise<ApiResponse<Horse | undefined>> {
  const horses = getEditableHorses().map((horse) => (horse.id === id ? { ...horse, ...data } : horse));
  saveEditableHorses(horses);
  return respond(horses.find((horse) => horse.id === id));
}

export async function deleteHorse(id: string): Promise<ApiResponse<{ id: string }>> {
  saveEditableHorses(getEditableHorses().filter((horse) => horse.id !== id));
  return respond({ id });
}

export async function getBookings(): Promise<ApiResponse<Booking[]>> {
  return respond(getEditableBookings());
}

export async function getBookingById(id: string): Promise<ApiResponse<Booking | undefined>> {
  return respond(getEditableBookings().find((booking) => booking.id === id));
}

export async function updateBookingStatus(id: string, status: Booking['status'], adminComment?: string): Promise<ApiResponse<Booking | undefined>> {
  const bookings = getEditableBookings().map((booking) => (booking.id === id ? { ...booking, status, adminComment } : booking));
  saveEditableBookings(bookings);
  return respond(bookings.find((booking) => booking.id === id));
}

export async function assignBookingHorses(id: string, assignedHorses: Booking['assignedHorses']): Promise<ApiResponse<Booking | undefined>> {
  const bookings = getEditableBookings().map((booking) => (booking.id === id ? { ...booking, assignedHorses } : booking));
  saveEditableBookings(bookings);
  return respond(bookings.find((booking) => booking.id === id));
}

export async function assignBookingTrainer(
  id: string,
  trainerId?: string,
): Promise<ApiResponse<Booking | undefined>> {
  const targetBooking = getEditableBookings().find((booking) => booking.id === id);
  if (!targetBooking) {
    return { data: undefined, message: 'Заявка не найдена.' };
  }

  if (trainerId) {
    const trainer = getEditableTrainers().find((item) => item.id === trainerId);
    if (!trainer) {
      return { data: undefined, message: 'Тренер не найден.' };
    }
    if (!isTrainerAssignable(trainer, targetBooking.serviceId)) {
      return { data: undefined, message: 'Тренер недоступен для выбранной услуги.' };
    }
  }

  const bookings: Booking[] = getEditableBookings().map((booking) => {
    if (booking.id !== id) return booking;
    if (!trainerId) {
      return { ...booking, assignedTrainerId: undefined, trainerStatus: undefined };
    }
    return { ...booking, assignedTrainerId: trainerId, trainerStatus: 'notified' as const };
  });
  saveEditableBookings(bookings);
  const updatedBooking = bookings.find((booking) => booking.id === id);

  return respond(updatedBooking);
}

export async function updateBookingTrainerStatus(
  id: string,
  trainerStatus?: Booking['trainerStatus'],
): Promise<ApiResponse<Booking | undefined>> {
  const currentBooking = getEditableBookings().find((booking) => booking.id === id);
  if (!currentBooking) {
    return { data: undefined, message: 'Заявка не найдена.' };
  }
  const bookings = getEditableBookings().map((booking) => (booking.id === id ? { ...booking, trainerStatus } : booking));
  saveEditableBookings(bookings);
  const updatedBooking = bookings.find((booking) => booking.id === id);

  if (updatedBooking?.assignedTrainerId && trainerStatus) {
    await createNotification({
      recipientRole: 'admin',
      recipientId: 'admin-local',
      type: 'trainer_response_required',
      channel: 'in_app',
      title: 'Статус тренера обновлен',
      message: `Тренер обновил статус по заявке на ${updatedBooking.date} (${trainerStatus}).`,
      bookingId: updatedBooking.id,
    });
    await createNotification({
      recipientRole: 'manager',
      recipientId: 'manager-local',
      type: 'trainer_response_required',
      channel: 'in_app',
      title: 'Статус тренера обновлен',
      message: `Тренер обновил статус по заявке на ${updatedBooking.date} (${trainerStatus}).`,
      bookingId: updatedBooking.id,
    });
  }

  return respond(updatedBooking);
}

function isTrainerAssignable(trainer: Trainer, serviceId: string) {
  if (!trainer.isActive) return false;
  if (trainer.status !== 'active') return false;
  if (!trainer.allowedServiceIds.includes(serviceId)) return false;
  return true;
}

export async function getAvailability(serviceId: string, date: string): Promise<ApiResponse<TimeSlot[]>> {
  return respond(getAvailableTimeSlots(serviceId, date));
}

export async function checkAvailability(data: BookingRequest): Promise<ApiResponse<AvailabilityCheckResult>> {
  return respond(checkBookingAvailability(data));
}

export async function getBookingRules(): Promise<ApiResponse<BookingRule[]>> {
  return respond(getEditableBookingRules());
}

export async function createBookingRule(data: BookingRule): Promise<ApiResponse<BookingRule>> {
  saveEditableBookingRules([data, ...getEditableBookingRules()]);
  return respond(data);
}

export async function updateBookingRule(id: string, data: Partial<BookingRule>): Promise<ApiResponse<BookingRule | undefined>> {
  const rules = getEditableBookingRules().map((rule) => (rule.id === id ? { ...rule, ...data } : rule));
  saveEditableBookingRules(rules);
  return respond(rules.find((rule) => rule.id === id));
}

export async function deleteBookingRule(id: string): Promise<ApiResponse<{ id: string }>> {
  saveEditableBookingRules(getEditableBookingRules().filter((rule) => rule.id !== id));
  return respond({ id });
}

export async function getScheduleExceptions(): Promise<ApiResponse<BookingRule[]>> {
  return respond(getEditableBookingRules().filter((rule) => rule.type === 'closed_date' || rule.type === 'horse_unavailable'));
}

export async function getAvailableBookingDates(serviceId: string) {
  return respond(getAvailableDates(serviceId));
}

export async function getReviews(): Promise<ApiResponse<Review[]>> {
  return respond(getEditableReviews());
}

export async function getGalleryItems(): Promise<ApiResponse<GalleryItem[]>> {
  return respond(getEditableGalleryItems());
}

export async function getContacts(): Promise<ApiResponse<ContactInfo>> {
  return respond(getEditableContacts());
}

export async function getRules(): Promise<ApiResponse<RulesInfo>> {
  return respond(getEditableRulesInfo());
}

export async function saveContacts(data: ContactInfo): Promise<ApiResponse<ContactInfo>> {
  saveEditableContacts(data);
  return respond(data);
}

export async function saveReviews(data: Review[]): Promise<ApiResponse<Review[]>> {
  saveEditableReviews(data);
  return respond(data);
}

export async function saveRules(data: RulesInfo): Promise<ApiResponse<RulesInfo>> {
  saveEditableRulesInfo(data);
  return respond(data);
}
