import { CalendarDays, Clock, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Booking, BookingStatus, Service, Trainer } from '../../types';

type StaffCalendarView = 'day' | 'week';

interface StaffScheduleCalendarProps {
  bookings: Booking[];
  selectedDate: string;
  view: StaffCalendarView;
  services: Service[];
  trainers?: Trainer[];
  detailsPath: (bookingId: string) => string;
  attentionReasons?: Map<string, string[]>;
  emptyDayText: string;
  emptyWeekText: string;
  showTrainer?: boolean;
}

const statusLabels: Record<BookingStatus, string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждена',
  rejected: 'Отклонена',
  needs_clarification: 'Нужно уточнение',
  cancelled: 'Отменена',
};

const dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const timelineHours = Array.from({ length: 12 }, (_, index) => index + 8);

const toDate = (iso: string) => new Date(`${iso}T00:00:00`);
const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

function getWeekStart(baseIso: string) {
  const base = toDate(baseIso);
  const shift = base.getDay() === 0 ? 6 : base.getDay() - 1;
  const start = new Date(base);
  start.setDate(base.getDate() - shift);
  return start;
}

function getWeekDates(baseIso: string) {
  const start = getWeekStart(baseIso);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function formatDayTitle(iso: string) {
  return toDate(iso).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatShortDate(iso: string) {
  return toDate(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function sortBookings(bookings: Booking[]) {
  return [...bookings].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function StaffScheduleCalendar({
  bookings,
  selectedDate,
  view,
  services,
  trainers = [],
  detailsPath,
  attentionReasons,
  emptyDayText,
  emptyWeekText,
  showTrainer = false,
}: StaffScheduleCalendarProps) {
  const serviceMap = new Map(services.map((service) => [service.id, service.title]));
  const trainerMap = new Map(trainers.map((trainer) => [trainer.id, trainer.fullName]));

  const renderBookingCard = (booking: Booking, compact = false) => {
    const reasons = attentionReasons?.get(booking.id) || [];
    const trainerName = booking.assignedTrainerId ? trainerMap.get(booking.assignedTrainerId) || 'назначен' : 'не назначен';

    return (
      <Link className={`staff-event-card ${compact ? 'staff-event-card--compact' : ''}`} to={detailsPath(booking.id)} key={booking.id}>
        <div className="staff-event-card__main">
          <strong>{booking.startTime}-{booking.endTime}</strong>
          <span>{serviceMap.get(booking.serviceId) || booking.serviceId}</span>
        </div>
        <div className="staff-event-card__meta">
          <span className={`status-pill status-${booking.status}`}>{statusLabels[booking.status]}</span>
          <span><UserRound size={14} /> {booking.clientName}</span>
          {showTrainer && <span><Clock size={14} /> Тренер: {trainerName}</span>}
        </div>
        {!compact && (
          <p>
            Участников: {booking.participants.length}
            {booking.comment ? ` · ${booking.comment}` : ''}
          </p>
        )}
        {reasons.length > 0 && <div className="conflict-box">{reasons.join(', ')}</div>}
      </Link>
    );
  };

  if (view === 'week') {
    const week = getWeekDates(selectedDate);

    return (
      <div className="staff-week-calendar">
        {week.map((date, index) => {
          const key = dateKey(date);
          const items = sortBookings(bookings.filter((booking) => booking.date === key));
          const isSelected = key === selectedDate;

          return (
            <section className={`staff-week-day ${isSelected ? 'staff-week-day--selected' : ''}`} key={key}>
              <header>
                <span>{dayLabels[index]}</span>
                <strong>{formatShortDate(key)}</strong>
              </header>
              {items.length === 0 ? (
                <p className="manager-muted">{emptyWeekText}</p>
              ) : (
                <div className="staff-week-events">
                  {items.map((booking) => renderBookingCard(booking, true))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  const dayBookings = sortBookings(bookings.filter((booking) => booking.date === selectedDate));

  return (
    <section className="staff-day-calendar">
      <header className="staff-day-calendar__header">
        <h3><CalendarDays size={18} /> {formatDayTitle(selectedDate)}</h3>
        <span>{dayBookings.length ? `${dayBookings.length} занятий / заявок` : 'Нет событий'}</span>
      </header>

      {dayBookings.length === 0 ? (
        <div className="staff-empty-day">
          <strong>{emptyDayText}</strong>
          <p>Переключитесь на неделю или выберите другую дату, чтобы увидеть ближайшие события.</p>
        </div>
      ) : (
        <div className="staff-day-timeline">
          <div className="staff-time-scale" aria-hidden="true">
            {timelineHours.map((hour) => (
              <span key={hour}>{String(hour).padStart(2, '0')}:00</span>
            ))}
          </div>
          <div className="staff-timeline-events">
            {dayBookings.map((booking) => {
              const startMinutes = timeToMinutes(booking.startTime);
              const endMinutes = timeToMinutes(booking.endTime);
              const top = Math.max(0, ((startMinutes - 8 * 60) / (12 * 60)) * 100);
              const height = Math.max(11, ((endMinutes - startMinutes) / (12 * 60)) * 100);

              return (
                <div className="staff-timeline-event" style={{ top: `${top}%`, minHeight: `${height}%` }} key={booking.id}>
                  {renderBookingCard(booking)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
