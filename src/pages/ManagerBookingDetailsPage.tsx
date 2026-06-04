import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button, ButtonLink } from '../components/ui/Button';
import { StaffWorkspaceNav } from '../components/layout/StaffWorkspaceNav';
import { SectionTitle } from '../components/ui/SectionTitle';
import { ErrorState, LoadingState } from '../components/ui/States';
import { isManagerAuthorized, logoutManager } from '../services/managerAuth';
import {
  getManagerAttentionBookings,
  getManagerBookingById,
  getManagerReferenceData,
  managerAssignTrainer,
  managerUpdateBookingStatus,
} from '../services/managerRepository';
import type { Booking, BookingStatus, Horse, ManagerAttentionBooking, Service, Trainer } from '../types';

const STATUS_OPTIONS: Array<{ value: BookingStatus; label: string }> = [
  { value: 'pending', label: 'Ожидает подтверждения' },
  { value: 'needs_clarification', label: 'Нужно уточнение' },
  { value: 'confirmed', label: 'Подтверждена' },
  { value: 'rejected', label: 'Отклонена' },
  { value: 'cancelled', label: 'Отменена' },
];

export function ManagerBookingDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [attention, setAttention] = useState<ManagerAttentionBooking | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [adminComment, setAdminComment] = useState('');

  if (!isManagerAuthorized()) return <Navigate to="/staff/login" replace />;

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [bookingResponse, attentionResponse, refsResponse] = await Promise.all([
        getManagerBookingById(id),
        getManagerAttentionBookings(),
        getManagerReferenceData(),
      ]);
      if (!bookingResponse.data) {
        setError('Заявка не найдена.');
        return;
      }
      setBooking(bookingResponse.data);
      setAdminComment(bookingResponse.data.adminComment || '');
      setAttention(attentionResponse.data.find((item) => item.booking.id === bookingResponse.data?.id) || null);
      setServices(refsResponse.data.services);
      setTrainers(refsResponse.data.trainers);
      setHorses(refsResponse.data.horses);
    } catch {
      setError('Не удалось загрузить карточку заявки.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const serviceMap = useMemo(() => new Map(services.map((item) => [item.id, item.title])), [services]);
  const trainerMap = useMemo(() => new Map(trainers.map((item) => [item.id, item.fullName])), [trainers]);
  const horseMap = useMemo(() => new Map(horses.map((item) => [item.id, item.name])), [horses]);

  const handleLogout = () => {
    logoutManager();
    navigate('/staff/login', { replace: true });
  };

  const handleSave = async (nextStatus: BookingStatus, nextTrainerId?: string) => {
    if (!booking) return;
    try {
      setSaving(true);
      setError(null);
      await managerAssignTrainer(booking.id, nextTrainerId);
      await managerUpdateBookingStatus(booking.id, nextStatus, adminComment.trim() || undefined);
      await loadData();
    } catch {
      setError('Не удалось сохранить изменения.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page-section trainer-page manager-dashboard-page">
      <div className="trainer-heading manager-dashboard-heading">
        <SectionTitle eyebrow="Управляющий" title="Карточка заявки" text="Полная проверка параметров заявки, назначений и статусов перед подтверждением." />
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

      <Link to="/manager/bookings" className="back-link"><ArrowLeft size={17} /> Вернуться к заявкам</Link>

      {loading && <LoadingState text="Загружаем карточку заявки..." />}
      {error && !loading && <ErrorState text={error} />}

      {!loading && !error && booking && (
        <article className="form-card manager-detail-card">
          <h2>{booking.date} · {booking.startTime}-{booking.endTime}</h2>
          <p>Услуга: {serviceMap.get(booking.serviceId) || booking.serviceId}</p>
          <p>Клиент: {booking.clientName} · {booking.clientPhone}</p>
          <p>Назначенный тренер: {booking.assignedTrainerId ? trainerMap.get(booking.assignedTrainerId) || booking.assignedTrainerId : 'Не назначен'}</p>
          <p>Статус: <span className={`status-pill status-${booking.status}`}>{booking.status}</span></p>

          {attention && attention.reasons.length > 0 && <div className="conflict-box">{attention.reasons.join(', ')}</div>}

          <div className="participants-list">
            {booking.participants.map((participant) => {
              const assignment = booking.assignedHorses.find((item) => item.participantId === participant.id);
              return (
                <article key={participant.id} className="participant-card">
                  <div className="participant-card-header">
                    <h4>{participant.fullName}</h4>
                    <span>{participant.age} лет</span>
                  </div>
                  <p>Вес: {participant.weightKg} кг · Опыт: {participant.experience}</p>
                  <p>Лошадь: {assignment ? horseMap.get(assignment.horseId) || assignment.horseId : 'Не назначена'}</p>
                  {participant.comment && <p>Комментарий: {participant.comment}</p>}
                </article>
              );
            })}
          </div>

          <div className="manager-booking-actions">
            <label>
              <span>Тренер</span>
              <select
                defaultValue={booking.assignedTrainerId || ''}
                disabled={saving}
                onChange={(event) => void handleSave(booking.status, event.target.value || undefined)}
              >
                <option value="">Не назначен</option>
                {trainers.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
              </select>
            </label>
            <label>
              <span>Новый статус</span>
              <select
                defaultValue={booking.status}
                disabled={saving}
                onChange={(event) => void handleSave(event.target.value as BookingStatus, booking.assignedTrainerId)}
              >
                {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          </div>

          <label>
            <span>Служебный комментарий</span>
            <textarea value={adminComment} onChange={(event) => setAdminComment(event.target.value)} rows={4} />
          </label>
          <div className="card-actions">
            <Button disabled={saving} onClick={() => void handleSave(booking.status, booking.assignedTrainerId)}>
              Сохранить комментарий
            </Button>
          </div>
        </article>
      )}
    </section>
  );
}
