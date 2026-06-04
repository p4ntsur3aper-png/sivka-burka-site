import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { SectionTitle } from '../components/ui/SectionTitle';
import { getBookingById, getHorses, getServiceById, updateBookingTrainerStatus } from '../services/api';
import { getTrainerById } from '../services/trainerRepository';
import { getAuthorizedTrainerId, isTrainerAuthorized, logoutTrainer } from '../services/trainerAuth';
import type { Booking, Horse, Trainer } from '../types';

export function TrainerBookingDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [serviceTitle, setServiceTitle] = useState('');
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  const trainerId = getAuthorizedTrainerId();
  const horseById = useMemo(() => new Map(horses.map((horse) => [horse.id, horse.name])), [horses]);

  useEffect(() => {
    const loadDetails = async () => {
      if (!id || !trainerId) return;

      try {
        const [trainerResponse, bookingResponse, horsesResponse] = await Promise.all([
          getTrainerById(trainerId),
          getBookingById(id),
          getHorses(),
        ]);

        const loadedBooking = bookingResponse.data;
        if (!loadedBooking) {
          setErrorText('Заявка не найдена.');
          return;
        }
        if (loadedBooking.assignedTrainerId !== trainerId) {
          setErrorText('Эта заявка не назначена вам.');
          return;
        }

        const serviceResponse = await getServiceById(loadedBooking.serviceId);
        setServiceTitle(serviceResponse.data?.title || loadedBooking.serviceId);
        setTrainer(trainerResponse.data || null);
        setBooking(loadedBooking);
        setHorses(horsesResponse.data);
      } finally {
        setLoading(false);
      }
    };

    void loadDetails();
  }, [id, trainerId]);

  if (!isTrainerAuthorized()) {
    return <Navigate to="/trainer/login" replace />;
  }

  const handleStatusChange = async (status: Booking['trainerStatus']) => {
    if (!booking) return;
    const response = await updateBookingTrainerStatus(booking.id, status);
    if (!response.data) return;
    setBooking((current) => (current ? { ...current, trainerStatus: response.data?.trainerStatus } : current));
  };

  const handleLogout = () => {
    logoutTrainer();
    navigate('/trainer/login', { replace: true });
  };

  return (
    <section className="page-section trainer-page">
      <div className="trainer-heading">
        <SectionTitle
          eyebrow="Кабинет тренера"
          title={trainer ? `Занятие: ${trainer.fullName}` : 'Детали занятия'}
          text="Просмотрите данные участников и обновите статус по заявке."
        />
        <Button variant="ghost" onClick={handleLogout}>
          Выйти
        </Button>
      </div>

      <Link to="/trainer/schedule" className="back-link">
        <ArrowLeft size={17} /> Вернуться к расписанию
      </Link>

      {loading && <div className="state-box">Загружаем детали...</div>}
      {!loading && errorText && <div className="state-error">{errorText}</div>}

      {!loading && booking && !errorText && (
        <article className="form-card">
          <h2>{booking.date} · {booking.startTime}-{booking.endTime}</h2>
          <p>Услуга: {serviceTitle}</p>
          <p>Клиент: {booking.clientName} · {booking.clientPhone}</p>
          <p>Статус тренера: {booking.trainerStatus || 'notified'}</p>

          <div className="participants-list">
            {booking.participants.map((participant) => {
              const assignment = booking.assignedHorses.find((item) => item.participantId === participant.id);
              return (
                <article className="participant-card" key={participant.id}>
                  <div className="participant-card-header">
                    <h4>{participant.fullName}</h4>
                    <span>{participant.age} лет</span>
                  </div>
                  <p>Вес: {participant.weightKg} кг</p>
                  <p>Опыт: {participant.experience}</p>
                  <p>Лошадь: {assignment ? horseById.get(assignment.horseId) || assignment.horseId : 'Не назначена'}</p>
                  {participant.comment && <p>Комментарий: {participant.comment}</p>}
                </article>
              );
            })}
          </div>

          <div className="card-actions">
            <Button variant="secondary" onClick={() => void handleStatusChange('seen')}>Ознакомился</Button>
            <Button variant="secondary" onClick={() => void handleStatusChange('accepted')}>Подтвердил</Button>
            <Button variant="secondary" onClick={() => void handleStatusChange('needs_clarification')}>Нужно уточнение</Button>
            <Button onClick={() => void handleStatusChange('completed')}>Занятие проведено</Button>
          </div>
        </article>
      )}
    </section>
  );
}

