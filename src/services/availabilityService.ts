import {
  getEditableBookingRules,
  getEditableBookings,
  getEditableHorses,
  getEditableServices,
  getEditableTrainers,
  saveEditableBookings,
} from './adminContent';
import type { AvailabilityCheckResult, Booking, BookingParticipant, BookingRequest, BookingRule, Horse, Service, TimeSlot, Trainer } from '../types';

const BLOCKING_STATUSES: Booking['status'][] = ['pending', 'confirmed', 'needs_clarification'];

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const toTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
  const mins = (minutes % 60).toString().padStart(2, '0');
  return `${hours}:${mins}`;
};

const addMinutes = (time: string, minutes: number) => toTime(toMinutes(time) + minutes);

const getWorkingHoursRule = (rules: BookingRule[]) =>
  rules.find((rule) => rule.type === 'working_hours' && rule.isActive);

const getRestMinutes = (rules: BookingRule[]) => {
  const rule = rules.find((item) => item.type === 'horse_rest_after_lesson' && item.isActive);
  return Number(rule?.config.restMinutes ?? 30);
};

const getService = (serviceId: string) => getEditableServices().find((service) => service.id === serviceId);

function isDateClosed(date: string, rules: BookingRule[]) {
  const weekday = new Date(`${date}T00:00:00`).getDay();

  return rules
    .filter((rule) => rule.type === 'closed_date' && rule.isActive)
    .map((rule) => {
      const dates = Array.isArray(rule.config.dates) ? rule.config.dates : [];
      const weekDays = Array.isArray(rule.config.weekDays) ? rule.config.weekDays : [];
      const reason = typeof rule.config.reason === 'string' ? rule.config.reason : 'Выбранный день закрыт для записи';
      return {
        closed: dates.includes(date) || weekDays.includes(weekday),
        reason,
      };
    })
    .find((item) => item.closed);
}

function isWorkingDay(date: string, rules: BookingRule[]) {
  const workingRule = getWorkingHoursRule(rules);
  const weekDays = Array.isArray(workingRule?.config.workingWeekDays) ? workingRule.config.workingWeekDays : [1, 2, 3, 4, 5, 6];
  const weekday = new Date(`${date}T00:00:00`).getDay();
  return weekDays.includes(weekday);
}

function getWorkingRange(rules: BookingRule[]) {
  const workingRule = getWorkingHoursRule(rules);
  return {
    startTime: String(workingRule?.config.startTime ?? '09:00'),
    endTime: String(workingRule?.config.endTime ?? '18:00'),
    slotStepMinutes: Number(workingRule?.config.slotStepMinutes ?? 30),
  };
}

function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(endA) > toMinutes(startB);
}

function getHorseUnavailabilityReason(horse: Horse, date: string, startTime: string, endTime: string, rules: BookingRule[]) {
  const rule = rules.find((item) => {
    if (item.type !== 'horse_unavailable' || !item.isActive) return false;
    return item.config.horseId === horse.id && item.config.date === date && overlaps(startTime, endTime, String(item.config.startTime), String(item.config.endTime));
  });

  if (!rule) return '';
  return typeof rule.config.reason === 'string' ? rule.config.reason : 'Лошадь недоступна в выбранный период';
}

function getHorseBookingConflictReason(horse: Horse, date: string, startTime: string, endTime: string, bookings: Booking[], restMinutes: number) {
  const horseBookings = bookings.filter(
    (booking) =>
      booking.date === date &&
      BLOCKING_STATUSES.includes(booking.status) &&
      booking.assignedHorses.some((assignment) => assignment.horseId === horse.id),
  );

  for (const booking of horseBookings) {
    if (overlaps(startTime, endTime, booking.startTime, booking.endTime)) {
      return 'Нет свободных лошадей для выбранного времени';
    }

    const restEnd = addMinutes(booking.endTime, restMinutes);
    if (toMinutes(startTime) >= toMinutes(booking.endTime) && toMinutes(startTime) < toMinutes(restEnd)) {
      return 'Лошадь должна отдохнуть после предыдущей тренировки';
    }
  }

  return '';
}

function getHorseProblem(horse: Horse, participant: BookingParticipant, serviceId: string, date: string, startTime: string, endTime: string, rules: BookingRule[], bookings: Booking[]) {
  if (!horse.isActive) return 'Лошадь временно отключена из записи';
  if (horse.status !== 'available') return 'Лошадь сейчас недоступна';
  if (!horse.allowedServiceIds.includes(serviceId)) return 'Услуга недоступна для одной из лошадей';
  if (participant.weightKg > horse.maxRiderWeightKg) return 'Для одного из участников нет подходящей лошади по весу';

  const unavailableReason = getHorseUnavailabilityReason(horse, date, startTime, endTime, rules);
  if (unavailableReason) return unavailableReason;

  return getHorseBookingConflictReason(horse, date, startTime, endTime, bookings, getRestMinutes(rules));
}

function getTrainerBookingConflictReason(trainer: Trainer, date: string, startTime: string, endTime: string, bookings: Booking[]) {
  const trainerBookings = bookings.filter(
    (booking) =>
      booking.date === date &&
      BLOCKING_STATUSES.includes(booking.status) &&
      booking.assignedTrainerId === trainer.id,
  );

  for (const booking of trainerBookings) {
    if (overlaps(startTime, endTime, booking.startTime, booking.endTime)) {
      return 'Нет свободного тренера для выбранного времени';
    }
  }

  return '';
}

function getTrainerProblem(trainer: Trainer, serviceId: string, date: string, startTime: string, endTime: string, bookings: Booking[]) {
  const weekDay = new Date(`${date}T00:00:00`).getDay();

  if (!trainer.isActive) return 'Нет свободного тренера для выбранного времени';
  if (trainer.status !== 'active') return 'Нет свободного тренера для выбранного времени';
  if (!trainer.allowedServiceIds.includes(serviceId)) return 'Тренер не проводит выбранную услугу';
  if (!trainer.workingDays.includes(weekDay)) return 'Тренер не работает в выбранный день';
  if (toMinutes(startTime) < toMinutes(trainer.workStartTime) || toMinutes(endTime) > toMinutes(trainer.workEndTime)) {
    return 'Тренер недоступен в выбранный временной интервал';
  }

  return getTrainerBookingConflictReason(trainer, date, startTime, endTime, bookings);
}

function findAvailableTrainersForSlot(serviceId: string, date: string, startTime: string, endTime: string) {
  const trainers = getEditableTrainers();
  const bookings = getEditableBookings();
  const reasons = new Set<string>();
  const availableTrainerIds: string[] = [];

  for (const trainer of trainers) {
    const problem = getTrainerProblem(trainer, serviceId, date, startTime, endTime, bookings);
    if (problem) {
      reasons.add(problem);
      continue;
    }
    availableTrainerIds.push(trainer.id);
  }

  return {
    isAvailable: availableTrainerIds.length > 0,
    availableTrainerIds,
    reasons: availableTrainerIds.length > 0 ? [] : Array.from(reasons.size > 0 ? reasons : new Set(['Нет свободного тренера для выбранного времени'])),
  };
}

function assignHorses(
  participants: BookingParticipant[],
  serviceId: string,
  date: string,
  startTime: string,
  endTime: string,
  horses: Horse[],
  rules: BookingRule[],
  bookings: Booking[],
) {
  const usedHorseIds = new Set<string>();
  const assignedHorses: AvailabilityCheckResult['assignedHorses'] = [];
  const reasons = new Set<string>();

  for (const participant of participants) {
    const sortedHorses = [...horses].sort((a, b) => a.maxRiderWeightKg - b.maxRiderWeightKg);
    const horse = sortedHorses.find((candidate) => {
      if (usedHorseIds.has(candidate.id)) return false;
      const problem = getHorseProblem(candidate, participant, serviceId, date, startTime, endTime, rules, bookings);
      if (problem) {
        reasons.add(problem);
        return false;
      }
      return true;
    });

    if (!horse) {
      reasons.add('Нет свободных лошадей для выбранного времени');
      return { assignedHorses, reasons: Array.from(reasons), isAvailable: false };
    }

    usedHorseIds.add(horse.id);
    assignedHorses.push({ participantId: participant.id, horseId: horse.id });
  }

  return { assignedHorses, reasons: [], isAvailable: true };
}

export function getAvailableDates(serviceId: string) {
  const service = getService(serviceId);
  const rules = getEditableBookingRules();
  if (!service?.isAvailable) return [];

  const today = new Date();
  return Array.from({ length: 21 }).map((_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index + 1);
    const isoDate = date.toISOString().slice(0, 10);
    const closed = isDateClosed(isoDate, rules);

    return {
      date: isoDate,
      isAvailable: !closed && isWorkingDay(isoDate, rules),
      reason: closed?.reason || (!isWorkingDay(isoDate, rules) ? 'Выбранный день закрыт для записи' : ''),
    };
  });
}

export function getAvailableTimeSlots(serviceId: string, date: string, participants: BookingParticipant[] = []): TimeSlot[] {
  const service = getService(serviceId);
  const rules = getEditableBookingRules();
  const closed = isDateClosed(date, rules);
  const horses = getEditableHorses();
  const bookings = getEditableBookings();
  const { startTime, endTime, slotStepMinutes } = getWorkingRange(rules);

  if (!service || closed || !isWorkingDay(date, rules)) {
    return [];
  }

  const slots: TimeSlot[] = [];
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);

  for (let current = start; current + service.durationMinutes <= end; current += slotStepMinutes) {
    const slotStart = toTime(current);
    const slotEnd = toTime(current + service.durationMinutes);
    const checkParticipants =
      participants.length > 0
        ? participants
        : [
            {
              id: 'preview-participant',
              fullName: 'Участник',
              age: service.minAge,
              weightKg: 70,
              experience: 'beginner' as const,
            },
          ];
    const result = assignHorses(checkParticipants, serviceId, date, slotStart, slotEnd, horses, rules, bookings);
    const trainerResult = findAvailableTrainersForSlot(serviceId, date, slotStart, slotEnd);
    const mergedReasons = Array.from(new Set([...result.reasons, ...trainerResult.reasons]));
    const slotAvailable = result.isAvailable && trainerResult.isAvailable;

    slots.push({
      id: `${date}_${slotStart}`,
      startTime: slotStart,
      endTime: slotEnd,
      isAvailable: slotAvailable,
      reasons: slotAvailable ? [] : mergedReasons,
      availableHorseIds: result.assignedHorses.map((assignment) => assignment.horseId),
    });
  }

  return slots;
}

export function validateBookingRules(request: BookingRequest) {
  const service = getService(request.serviceId);
  const rules = getEditableBookingRules();
  const reasons: string[] = [];

  if (!service?.isAvailable) reasons.push('Услуга временно недоступна');
  if (isDateClosed(request.date, rules) || !isWorkingDay(request.date, rules)) reasons.push('Выбранный день закрыт для записи');

  for (const participant of request.participants) {
    if (service && participant.age < service.minAge) {
      reasons.push(`Возраст участника ${participant.fullName || 'без имени'} ниже ограничения услуги`);
    }
  }

  return reasons;
}

export function findAvailableHorsesForParticipants(request: BookingRequest) {
  const service = getService(request.serviceId);
  const startTime = request.timeSlotId.split('_')[1] || request.timeSlotId;
  const endTime = service ? addMinutes(startTime, service.durationMinutes) : startTime;

  return assignHorses(
    request.participants,
    request.serviceId,
    request.date,
    startTime,
    endTime,
    getEditableHorses(),
    getEditableBookingRules(),
    getEditableBookings(),
  );
}

export function detectBookingConflicts(request: BookingRequest) {
  const service = getService(request.serviceId);
  const startTime = request.timeSlotId.split('_')[1] || request.timeSlotId;
  const endTime = service ? addMinutes(startTime, service.durationMinutes) : startTime;
  const horseReasons = findAvailableHorsesForParticipants(request).reasons;
  const trainerReasons = findAvailableTrainersForSlot(request.serviceId, request.date, startTime, endTime).reasons;
  return Array.from(new Set([...horseReasons, ...trainerReasons]));
}

export function checkBookingAvailability(request: BookingRequest): AvailabilityCheckResult {
  const ruleReasons = validateBookingRules(request);
  const horseResult = findAvailableHorsesForParticipants(request);
  const service = getService(request.serviceId);
  const startTime = request.timeSlotId.split('_')[1] || request.timeSlotId;
  const endTime = service ? addMinutes(startTime, service.durationMinutes) : startTime;
  const trainerResult = findAvailableTrainersForSlot(request.serviceId, request.date, startTime, endTime);
  const reasons = Array.from(new Set([...ruleReasons, ...horseResult.reasons, ...trainerResult.reasons]));

  return {
    isAvailable: reasons.length === 0 && horseResult.isAvailable && trainerResult.isAvailable,
    reasons,
    assignedHorses: horseResult.assignedHorses,
  };
}

export function createMockBooking(request: BookingRequest) {
  const service = getService(request.serviceId);
  const startTime = request.timeSlotId.split('_')[1] || request.timeSlotId;
  const endTime = service ? addMinutes(startTime, service.durationMinutes) : startTime;
  const availability = checkBookingAvailability(request);

  if (!availability.isAvailable) {
    throw new Error(availability.reasons.join(', '));
  }

  const booking: Booking = {
    id: `booking-${Date.now()}`,
    serviceId: request.serviceId,
    date: request.date,
    startTime,
    endTime,
    clientName: request.clientName,
    clientPhone: request.clientPhone,
    participants: request.participants,
    assignedHorses: availability.assignedHorses,
    status: 'pending',
    comment: request.comment,
  };

  saveEditableBookings([booking, ...getEditableBookings()]);
  return booking;
}
