import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { StaffWorkspaceNav } from '../components/layout/StaffWorkspaceNav';
import { Button, ButtonLink } from '../components/ui/Button';
import { SectionTitle } from '../components/ui/SectionTitle';
import { ErrorState, LoadingState } from '../components/ui/States';
import { isManagerAuthorized, logoutManager } from '../services/managerAuth';
import {
  getManagerAttentionBookings,
  getManagerBookings,
  getManagerReferenceData,
  managerAssignTrainer,
  managerUpdateBookingStatus,
} from '../services/managerRepository';
import type { Booking, BookingStatus, ManagerAttentionBooking, Service, Trainer } from '../types';

const STATUS_OPTIONS: Array<{ value: BookingStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Все статусы' },
  { value: 'pending', label: 'Ожидает подтверждения' },
  { value: 'needs_clarification', label: 'Нужно уточнение' },
  { value: 'confirmed', label: 'Подтверждена' },
  { value: 'rejected', label: 'Отклонена' },
  { value: 'cancelled', label: 'Отменена' },
];

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждена',
  rejected: 'Отклонена',
  needs_clarification: 'Нужно уточнение',
  cancelled: 'Отменена',
};

export function ManagerBookingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [attentionItems, setAttentionItems] = useState<ManagerAttentionBooking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [status, setStatus] = useState<BookingStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [trainerId, setTrainerId] = useState('');

  if (!isManagerAuthorized()) {
    return <Navigate to="/staff/login" replace />;
  }

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [bookingsResponse, attentionResponse, refsResponse] = await Promise.all([
        getManagerBookings({
          status,
          search: search.trim() || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          serviceId: serviceId || undefined,
          trainerId: trainerId || undefined,
        }),
        getManagerAttentionBookings(),
        getManagerReferenceData(),
      ]);
      setBookings(bookingsResponse.data);
      setAttentionItems(attentionResponse.data);
      setServices(refsResponse.data.services);
      setTrainers(refsResponse.data.trainers);
    } catch {
      setError('Не удалось загрузить список заявок.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [status, dateFrom, dateTo, serviceId, trainerId]);

  const attentionMap = useMemo(() => new Map(attentionItems.map((item) => [item.booking.id, item.reasons])), [attentionItems]);
  const serviceMap = useMemo(() => new Map(services.map((item) => [item.id, item.title])), [services]);
  const trainerMap = useMemo(() => new Map(trainers.map((item) => [item.id, item.fullName])), [trainers]);

  const handleLogout = () => {
    logoutManager();
    navigate('/staff/login', { replace: true });
  };

  const handleAssignTrainer = async (bookingId: string, nextTrainerId: string) => {
    try {
      setUpdatingId(bookingId);
      await managerAssignTrainer(bookingId, nextTrainerId || undefined);
      await loadData();
    } catch {
      setError('Не удалось назначить тренера.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusChange = async (bookingId: string, nextStatus: BookingStatus) => {
    try {
      setUpdatingId(bookingId);
      await managerUpdateBookingStatus(bookingId, nextStatus);
      await loadData();
    } catch {
      setError('Не удалось обновить статус заявки.');
    } finally {
      setUpdatingId(null);
    }
  };

  const onSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    loadData();
  };

  return (
    <section className="page-section trainer-page manager-dashboard-page">
      <div className="trainer-heading manager-dashboard-heading">
        <SectionTitle eyebrow="Управляющий" title="Список заявок" text="Рабочая очередь для обработки заявок: фильтрация, назначение тренера и смена статуса." />
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

      <form className="manager-filters" onSubmit={onSearchSubmit}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск: клиент или телефон" />
        <select value={status} onChange={(event) => setStatus(event.target.value as BookingStatus | 'all')}>
          {STATUS_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
          <option value="">Все услуги</option>
          {services.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <select value={trainerId} onChange={(event) => setTrainerId(event.target.value)}>
          <option value="">Все тренеры</option>
          {trainers.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        <Button type="submit" variant="secondary">Применить</Button>
      </form>

      {loading && <LoadingState text="Загружаем заявки..." />}
      {error && <ErrorState text={error} />}

      {!loading && !error && (
        <div className="manager-list">
          {bookings.length === 0 && <div className="state-box">По текущим фильтрам заявок не найдено.</div>}
          {bookings.map((booking) => {
            const reasons = attentionMap.get(booking.id) || [];
            return (
              <article key={booking.id} className="manager-list-item manager-list-item--column manager-booking-card">
                <div className="manager-list-item-row">
                  <strong>
                    {booking.date} · {booking.startTime}-{booking.endTime} · {serviceMap.get(booking.serviceId) || booking.serviceId}
                  </strong>
                  <span className={`status-pill status-${booking.status}`}>{STATUS_LABELS[booking.status]}</span>
                </div>
                <p>
                  Клиент: {booking.clientName} ({booking.clientPhone}) · Участников: {booking.participants.length}
                </p>
                <div className="manager-booking-actions">
                  <ButtonLink to={`/manager/bookings/${booking.id}`} variant="secondary">
                    Открыть карточку
                  </ButtonLink>
                  <label>
                    <span>Тренер</span>
                    <select
                      value={booking.assignedTrainerId || ''}
                      disabled={updatingId === booking.id}
                      onChange={(event) => handleAssignTrainer(booking.id, event.target.value)}
                    >
                      <option value="">Не назначен</option>
                      {trainers.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Статус</span>
                    <select
                      value={booking.status}
                      disabled={updatingId === booking.id}
                      onChange={(event) => handleStatusChange(booking.id, event.target.value as BookingStatus)}
                    >
                      {STATUS_OPTIONS.filter((item) => item.value !== 'all').map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {reasons.length > 0 && <div className="conflict-box">{reasons.join(', ')}</div>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
