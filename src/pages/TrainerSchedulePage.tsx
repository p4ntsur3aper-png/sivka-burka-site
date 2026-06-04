import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { StaffWorkspaceNav } from '../components/layout/StaffWorkspaceNav';
import { StaffScheduleCalendar } from '../components/staff/StaffScheduleCalendar';
import { Button, ButtonLink } from '../components/ui/Button';
import { SectionTitle } from '../components/ui/SectionTitle';
import { LoadingState } from '../components/ui/States';
import { getBookings, getServices } from '../services/api';
import { getTrainerById } from '../services/trainerRepository';
import { getAuthorizedTrainerId, isTrainerAuthorized, logoutTrainer } from '../services/trainerAuth';
import type { Booking, Service, Trainer } from '../types';

type ScheduleMode = 'day' | 'week';

const dateIso = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const toDate = (iso: string) => new Date(`${iso}T00:00:00`);

const trainerAttentionLabels: Record<string, string> = {
  notified: 'Нужно ознакомиться с назначением',
  needs_clarification: 'Нужно уточнение',
};

export function TrainerSchedulePage() {
  const navigate = useNavigate();
  const trainerId = getAuthorizedTrainerId();

  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ScheduleMode>('day');
  const [selectedDate, setSelectedDate] = useState(dateIso(new Date()));

  const serviceById = useMemo(() => new Map(services.map((service) => [service.id, service.title])), [services]);
  const attentionMap = useMemo(() => {
    const pairs = bookings
      .map((booking) => {
        const reasons: string[] = [];
        if (booking.trainerStatus && trainerAttentionLabels[booking.trainerStatus]) reasons.push(trainerAttentionLabels[booking.trainerStatus]);
        if (booking.status === 'needs_clarification') reasons.push('По заявке требуется уточнение');
        return [booking.id, reasons] as const;
      })
      .filter(([, reasons]) => reasons.length > 0);
    return new Map(pairs);
  }, [bookings]);

  const loadData = async () => {
    if (!trainerId) return;
    try {
      setLoading(true);
      const [trainerResponse, bookingsResponse, servicesResponse] = await Promise.all([
        getTrainerById(trainerId),
        getBookings(),
        getServices(),
      ]);

      const trainerBookings = bookingsResponse.data
        .filter((booking) => booking.assignedTrainerId === trainerId)
        .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));

      setTrainer(trainerResponse.data || null);
      setBookings(trainerBookings);
      setServices(servicesResponse.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [trainerId]);

  if (!isTrainerAuthorized()) {
    return <Navigate to="/trainer/login" replace />;
  }

  const handleLogout = () => {
    logoutTrainer();
    navigate('/trainer/login', { replace: true });
  };

  const moveDate = (step: number) => {
    const current = toDate(selectedDate);
    current.setDate(current.getDate() + (mode === 'day' ? step : step * 7));
    setSelectedDate(dateIso(current));
  };

  const attentionBookings = bookings.filter((booking) => attentionMap.get(booking.id)?.length);
  const nextBooking = bookings.find((booking) => `${booking.date}T${booking.startTime}` >= `${dateIso(new Date())}T00:00`);

  return (
    <section className="page-section trainer-page manager-dashboard-page">
      <div className="trainer-heading">
        <SectionTitle
          eyebrow="Кабинет тренера"
          title={trainer ? `Расписание: ${trainer.fullName}` : 'Расписание тренера'}
          text="Показываются только назначенные вам занятия. Переключайтесь между днем и неделей, чтобы сверить расписание."
        />
        <StaffWorkspaceNav
          items={[
            { to: '/trainer/schedule', label: 'Расписание' },
          ]}
          onLogout={handleLogout}
        />
      </div>

      {!loading && (
        <div className="trainer-summary-grid">
          <article className="manager-stat-card">
            <strong>{bookings.filter((booking) => booking.date === selectedDate).length}</strong>
            <span>Занятий в выбранный день</span>
          </article>
          <article className="manager-stat-card">
            <strong>{attentionBookings.length}</strong>
            <span>Требуют реакции</span>
          </article>
          <article className="manager-panel trainer-next-panel">
            <h3>Ближайшее занятие</h3>
            {nextBooking ? (
              <>
                <p>{nextBooking.date} · {nextBooking.startTime}-{nextBooking.endTime}</p>
                <p>{serviceById.get(nextBooking.serviceId) || nextBooking.serviceId} · {nextBooking.clientName}</p>
                <ButtonLink to={`/trainer/bookings/${nextBooking.id}`} variant="secondary">Открыть занятие</ButtonLink>
              </>
            ) : (
              <p className="manager-muted">Ближайших назначенных занятий нет.</p>
            )}
          </article>
        </div>
      )}

      <div className="manager-calendar-toolbar">
        <div className="manager-calendar-nav">
          <Button variant="secondary" onClick={() => moveDate(-1)} aria-label="Предыдущий период"><ChevronLeft size={16} /></Button>
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value || dateIso(new Date()))} />
          <Button variant="secondary" onClick={() => moveDate(1)} aria-label="Следующий период"><ChevronRight size={16} /></Button>
        </div>
        <div className="staff-role-switch">
          <Button type="button" variant={mode === 'day' ? 'primary' : 'secondary'} onClick={() => setMode('day')}>День</Button>
          <Button type="button" variant={mode === 'week' ? 'primary' : 'secondary'} onClick={() => setMode('week')}>Неделя</Button>
        </div>
        <Button variant="secondary" onClick={loadData}>Обновить</Button>
      </div>

      {loading && <LoadingState text="Загружаем расписание..." />}

      {!loading && attentionBookings.length > 0 && (
        <article className="manager-panel">
          <h3>Требует реакции</h3>
          <div className="manager-list">
            {attentionBookings.slice(0, 5).map((booking) => (
              <div key={booking.id} className="manager-list-item">
                <div>
                  <strong>{booking.date} · {booking.startTime}-{booking.endTime}</strong>
                  <p>{serviceById.get(booking.serviceId) || booking.serviceId}</p>
                </div>
                <ButtonLink to={`/trainer/bookings/${booking.id}`} variant="secondary">Открыть</ButtonLink>
              </div>
            ))}
          </div>
        </article>
      )}

      {!loading && (
        <StaffScheduleCalendar
          bookings={bookings}
          selectedDate={selectedDate}
          view={mode}
          services={services}
          detailsPath={(bookingId) => `/trainer/bookings/${bookingId}`}
          attentionReasons={attentionMap}
          emptyDayText="На выбранный день занятий нет."
          emptyWeekText="Нет занятий"
        />
      )}
    </section>
  );
}
