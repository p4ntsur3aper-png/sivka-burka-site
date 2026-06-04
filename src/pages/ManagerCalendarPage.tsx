import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { StaffWorkspaceNav } from '../components/layout/StaffWorkspaceNav';
import { StaffScheduleCalendar } from '../components/staff/StaffScheduleCalendar';
import { Button } from '../components/ui/Button';
import { SectionTitle } from '../components/ui/SectionTitle';
import { ErrorState, LoadingState } from '../components/ui/States';
import { isManagerAuthorized, logoutManager } from '../services/managerAuth';
import { getManagerAttentionBookings, getManagerBookings, getManagerReferenceData } from '../services/managerRepository';
import type { Booking, ManagerAttentionBooking, Service, Trainer } from '../types';

type CalendarView = 'day' | 'week';
type CalendarStatusFilter = Booking['status'] | 'all';

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const toDate = (iso: string) => new Date(`${iso}T00:00:00`);

function getWeekStart(base: Date) {
  const day = base.getDay();
  const shift = day === 0 ? 6 : day - 1;
  const start = new Date(base);
  start.setDate(base.getDate() - shift);
  return start;
}

function weekDays(baseIso: string) {
  const start = getWeekStart(toDate(baseIso));
  return Array.from({ length: 7 }).map((_, i) => {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    return current;
  });
}

export function ManagerCalendarPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<CalendarView>('day');
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [attention, setAttention] = useState<ManagerAttentionBooking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [statusFilter, setStatusFilter] = useState<CalendarStatusFilter>('all');
  const [trainerFilter, setTrainerFilter] = useState('all');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!isManagerAuthorized()) return <Navigate to="/staff/login" replace />;

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [bookingsResponse, attentionResponse, refsResponse] = await Promise.all([
        getManagerBookings(),
        getManagerAttentionBookings(),
        getManagerReferenceData(),
      ]);
      setBookings(bookingsResponse.data);
      setAttention(attentionResponse.data);
      setServices(refsResponse.data.services);
      setTrainers(refsResponse.data.trainers);
    } catch {
      setError('Не удалось загрузить календарь. Попробуйте обновить страницу.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const week = useMemo(() => weekDays(selectedDate), [selectedDate]);
  const attentionMap = useMemo(() => new Map(attention.map((item) => [item.booking.id, item.reasons])), [attention]);
  const filteredBookings = useMemo(
    () =>
      bookings.filter((booking) => {
        if (statusFilter !== 'all' && booking.status !== statusFilter) return false;
        if (trainerFilter !== 'all' && (booking.assignedTrainerId || '') !== trainerFilter) return false;
        if (attentionOnly && !attentionMap.has(booking.id)) return false;
        return true;
      }),
    [attentionMap, attentionOnly, bookings, statusFilter, trainerFilter],
  );
  const weekBookings = useMemo(() => {
    const keys = new Set(week.map((day) => dateKey(day)));
    return filteredBookings.filter((booking) => keys.has(booking.date));
  }, [filteredBookings, week]);

  const moveDate = (step: number) => {
    const current = toDate(selectedDate);
    current.setDate(current.getDate() + (view === 'day' ? step : step * 7));
    setSelectedDate(dateKey(current));
  };

  const handleLogout = () => {
    logoutManager();
    navigate('/staff/login', { replace: true });
  };

  return (
    <section className="page-section trainer-page manager-dashboard-page">
      <div className="trainer-heading manager-dashboard-heading">
        <SectionTitle
          eyebrow="Управляющий"
          title="Календарь заявок"
          text="Рабочий календарь по дням и неделям: время, статусы, назначение тренера и проблемные заявки."
        />
        <StaffWorkspaceNav
          items={[
            { to: '/manager/dashboard', label: 'Дашборд' },
            { to: '/manager/bookings', label: 'Заявки' },
            { to: '/manager/calendar', label: 'Календарь' },
            { to: '/manager/notifications', label: 'События' },
          ]}
          onLogout={handleLogout}
        />
      </div>

      <div className="manager-calendar-toolbar">
        <div className="manager-calendar-nav">
          <Button variant="secondary" onClick={() => moveDate(-1)} aria-label="Предыдущий период"><ChevronLeft size={16} /></Button>
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value || dateKey(new Date()))} />
          <Button variant="secondary" onClick={() => moveDate(1)} aria-label="Следующий период"><ChevronRight size={16} /></Button>
        </div>
        <div className="staff-role-switch">
          <Button type="button" variant={view === 'day' ? 'primary' : 'secondary'} onClick={() => setView('day')}>День</Button>
          <Button type="button" variant={view === 'week' ? 'primary' : 'secondary'} onClick={() => setView('week')}>Неделя</Button>
        </div>
        <Button variant="secondary" onClick={loadData}>Обновить</Button>
      </div>

      <div className="manager-calendar-filters">
        <label>
          <span>Статус</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CalendarStatusFilter)}>
            <option value="all">Все статусы</option>
            <option value="pending">Ожидает подтверждения</option>
            <option value="needs_clarification">Нужно уточнение</option>
            <option value="confirmed">Подтверждена</option>
            <option value="rejected">Отклонена</option>
            <option value="cancelled">Отменена</option>
          </select>
        </label>
        <label>
          <span>Тренер</span>
          <select value={trainerFilter} onChange={(event) => setTrainerFilter(event.target.value)}>
            <option value="all">Все тренеры</option>
            <option value="">Не назначен</option>
            {trainers.map((trainer) => (
              <option key={trainer.id} value={trainer.id}>{trainer.fullName}</option>
            ))}
          </select>
        </label>
        <label className="checkbox-label manager-calendar-attention">
          <input type="checkbox" checked={attentionOnly} onChange={(event) => setAttentionOnly(event.target.checked)} />
          <span>Только требующие внимания</span>
        </label>
      </div>

      {loading && <LoadingState text="Загружаем календарь..." />}
      {error && <ErrorState text={error} />}

      {!loading && !error && (
        <StaffScheduleCalendar
          bookings={view === 'week' ? weekBookings : filteredBookings}
          selectedDate={selectedDate}
          view={view}
          services={services}
          trainers={trainers}
          detailsPath={(bookingId) => `/manager/bookings/${bookingId}`}
          attentionReasons={attentionMap}
          emptyDayText="На выбранный день заявок нет."
          emptyWeekText="Нет заявок"
          showTrainer
        />
      )}
    </section>
  );
}
