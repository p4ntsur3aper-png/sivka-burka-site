import { CalendarDays, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createBookingRequest, getAvailability, getAvailableBookingDates } from '../../services/api';
import type { BookingParticipant, BookingRequest, FormStatus, RiderExperience, Service, TimeSlot } from '../../types';
import { getMediaStyle } from '../../utils/media';
import { Button } from '../ui/Button';
import { Alert } from '../ui/States';

const experienceLabels: Record<RiderExperience, string> = {
  beginner: 'Новичок',
  experienced: 'Есть опыт',
  confident: 'Уверенный наездник',
};

const createParticipant = (): BookingParticipant => ({
  id: `participant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  fullName: '',
  age: 10,
  weightKg: 50,
  experience: 'beginner',
  comment: '',
});

const initialForm: BookingRequest = {
  clientName: '',
  clientPhone: '',
  serviceId: '',
  date: '',
  timeSlotId: '',
  participants: [createParticipant()],
  comment: '',
  personalDataAgreement: false,
};

interface BookingFormProps {
  services: Service[];
  selectedServiceId?: string;
}

type BookingErrors = Partial<Record<keyof BookingRequest | `participant-${string}`, string>>;
type AvailableBookingDate = { date: string; isAvailable: boolean; reason?: string };

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

function weekDayLabel(date: Date) {
  return date.toLocaleDateString('ru-RU', { weekday: 'short' });
}

export function BookingForm({ services, selectedServiceId }: BookingFormProps) {
  const initialServiceId = selectedServiceId && services.some((service) => service.id === selectedServiceId) ? selectedServiceId : services[0]?.id || '';
  const [form, setForm] = useState<BookingRequest>({ ...initialForm, serviceId: initialServiceId });
  const [errors, setErrors] = useState<BookingErrors>({});
  const [status, setStatus] = useState<FormStatus>('idle');
  const [submitReason, setSubmitReason] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [availableDates, setAvailableDates] = useState<AvailableBookingDate[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const submitFeedbackRef = useRef<HTMLDivElement>(null);

  const selectedService = useMemo(() => services.find((service) => service.id === form.serviceId), [form.serviceId, services]);
  const datesByIso = useMemo(() => new Map(availableDates.map((item) => [item.date, item])), [availableDates]);
  const selectedSlot = slots.find((slot) => slot.id === form.timeSlotId);
  const selectedDateLabel = form.date ? new Date(`${form.date}T00:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }) : '';

  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const monthStart = startOfMonth(calendarMonth);
    const startWeekDay = (monthStart.getDay() + 6) % 7;
    const firstCell = new Date(monthStart);
    firstCell.setDate(monthStart.getDate() - startWeekDay);

    for (let i = 0; i < 42; i += 1) {
      const day = new Date(firstCell);
      day.setDate(firstCell.getDate() + i);
      days.push(day);
    }
    return days;
  }, [calendarMonth]);

  useEffect(() => {
    let active = true;
    setAvailableDates([]);
    setSlots([]);

    if (!form.serviceId) {
      return () => {
        active = false;
      };
    }

    getAvailableBookingDates(form.serviceId)
      .then((response) => {
        if (!active) return;
        setAvailableDates(response.data);
        setForm((current) => {
          const selectedDate = response.data.find((item) => item.date === current.date);
          if (current.date && selectedDate?.isAvailable) return current;
          const firstAvailableDate = response.data.find((date) => date.isAvailable)?.date || '';
          return { ...current, date: firstAvailableDate, timeSlotId: '' };
        });
      })
      .catch(() => {
        if (active) setAvailableDates([]);
      });

    return () => {
      active = false;
    };
  }, [form.serviceId]);

  useEffect(() => {
    let active = true;
    setSlots([]);

    if (!form.serviceId || !form.date) {
      setAvailabilityLoading(false);
      return () => {
        active = false;
      };
    }

    setAvailabilityLoading(true);
    getAvailability(form.serviceId, form.date)
      .then((response) => {
        if (active) setSlots(response.data);
      })
      .catch(() => {
        if (active) setSlots([]);
      })
      .finally(() => {
        if (active) setAvailabilityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [form.date, form.participants.length, form.serviceId]);

  useEffect(() => {
    setForm((current) => {
      const stillAvailable = slots.some((slot) => slot.id === current.timeSlotId && slot.isAvailable);
      return stillAvailable ? current : { ...current, timeSlotId: '' };
    });
  }, [slots]);

  const updateField = <K extends keyof BookingRequest>(field: K, value: BookingRequest[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setStatus('idle');
    setSubmitReason('');
  };

  const showSubmitFeedback = () => {
    window.setTimeout(() => {
      submitFeedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      submitFeedbackRef.current?.focus({ preventScroll: true });
    }, 0);
  };

  const selectDate = (dateIso: string) => {
    updateField('date', dateIso);
    setCalendarOpen(false);
  };

  const updateParticipant = <K extends keyof BookingParticipant>(participantId: string, field: K, value: BookingParticipant[K]) => {
    setForm((current) => ({
      ...current,
      participants: current.participants.map((participant) => (participant.id === participantId ? { ...participant, [field]: value } : participant)),
    }));
    setErrors((current) => ({ ...current, [`participant-${participantId}`]: undefined }));
    setStatus('idle');
    setSubmitReason('');
  };

  const addParticipant = () => {
    setForm((current) => ({ ...current, participants: [...current.participants, createParticipant()], timeSlotId: '' }));
  };

  const removeParticipant = (participantId: string) => {
    setForm((current) => ({
      ...current,
      participants: current.participants.length === 1 ? current.participants : current.participants.filter((participant) => participant.id !== participantId),
      timeSlotId: '',
    }));
  };

  const validate = () => {
    const nextErrors: BookingErrors = {};
    const phoneDigits = form.clientPhone.replace(/\D/g, '');

    if (!form.clientName.trim()) nextErrors.clientName = 'Укажите имя заявителя';
    if (phoneDigits.length < 10 || phoneDigits.length > 11) nextErrors.clientPhone = 'Укажите корректный телефон';
    if (!form.serviceId) nextErrors.serviceId = 'Выберите услугу';
    if (!form.date) nextErrors.date = 'Выберите дату';
    if (!form.timeSlotId) nextErrors.timeSlotId = 'Выберите доступное время';
    if (!form.personalDataAgreement) nextErrors.personalDataAgreement = 'Необходимо согласие на обработку данных';

    form.participants.forEach((participant) => {
      const participantErrors: string[] = [];
      if (!participant.fullName.trim()) participantErrors.push('имя');
      if (!participant.age || participant.age < 1) participantErrors.push('возраст');
      if (!participant.weightKg || participant.weightKg < 1) participantErrors.push('вес');
      if (selectedService && participant.age < selectedService.minAge) participantErrors.push(`возраст ниже ограничения ${selectedService.minAge}+`);
      if (participantErrors.length) {
        nextErrors[`participant-${participant.id}`] = `Заполните: ${participantErrors.join(', ')}`;
      }
    });

    if (selectedSlot && !selectedSlot.isAvailable) {
      nextErrors.timeSlotId = selectedSlot.reasons[0] || 'Выбранный слот недоступен';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    try {
      setStatus('loading');
      await createBookingRequest(form);
      setStatus('success');
      setSubmitReason('');
      showSubmitFeedback();
    } catch (error) {
      setStatus('error');
      setSubmitReason(error instanceof Error && error.message ? error.message : 'Не удалось отправить заявку. Проверьте данные и попробуйте еще раз.');
      showSubmitFeedback();
    }
  };

  return (
    <div className="booking-layout">
      <form className="form-card booking-form-advanced" onSubmit={handleSubmit} noValidate>
        <h2>Календарное бронирование</h2>
        <p className="form-note">Выберите дату и слот. Система проверит лошадей, ограничения по весу, возрасту и перерывы после занятий.</p>

        {status === 'success' && <Alert type="success">Заявка отправлена и ожидает подтверждения администратора.</Alert>}
        {status === 'error' && <Alert type="error">{submitReason || 'Не удалось отправить заявку. Попробуйте еще раз.'}</Alert>}

        <label>
          <span>Услуга *</span>
          <select value={form.serviceId} onChange={(event) => updateField('serviceId', event.target.value)}>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.title}
              </option>
            ))}
          </select>
          {errors.serviceId && <small>{errors.serviceId}</small>}
        </label>

        <section className="booking-step">
          <h3><CalendarDays size={20} /> Дата занятия</h3>
          <div className="calendar-field">
            <button
              type="button"
              className={`calendar-trigger ${calendarOpen ? 'open' : ''}`}
              onClick={() => setCalendarOpen((current) => !current)}
            >
              <span>{selectedDateLabel || 'Выберите дату занятия'}</span>
              <CalendarDays size={18} />
            </button>
            {calendarOpen && (
              <div className="calendar-popover" role="dialog" aria-label="Календарь выбора даты">
                <div className="calendar-header">
                  <Button type="button" variant="ghost" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
                    ←
                  </Button>
                  <strong>{monthLabel(calendarMonth)}</strong>
                  <Button type="button" variant="ghost" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
                    →
                  </Button>
                </div>
                <div className="calendar-weekdays">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                <div className="calendar-grid">
                  {calendarDays.map((day) => {
                    const dayIso = toIsoDate(day);
                    const dateInfo = datesByIso.get(dayIso);
                    const todayIso = toIsoDate(new Date());
                    const outOfMonth = day.getMonth() !== calendarMonth.getMonth();
                    const isPast = dayIso < todayIso;
                    const isAvailable = Boolean(dateInfo?.isAvailable) && !isPast && !outOfMonth;
                    const isSelected = form.date === dayIso;
                    const reason = dateInfo?.reason || (isPast ? 'Дата в прошлом' : outOfMonth ? 'Дата вне текущего месяца' : 'Нет доступных слотов');

                    return (
                      <button
                        key={dayIso}
                        type="button"
                        className={`calendar-day ${isSelected ? 'selected' : ''} ${!isAvailable ? 'disabled' : ''} ${outOfMonth ? 'muted' : ''}`}
                        disabled={!isAvailable}
                        onClick={() => selectDate(dayIso)}
                        title={isAvailable ? `${weekDayLabel(day)}, доступно` : reason}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {errors.date && <small className="standalone-error">{errors.date}</small>}
        </section>

        <section className="booking-step">
          <h3>Доступное время</h3>
          <div className="slot-grid">
            {availabilityLoading && <div className="state-box">Загружаем доступное время...</div>}
            {!availabilityLoading && slots.length === 0 && <div className="state-box">Нет доступных слотов на выбранную дату.</div>}
            {!availabilityLoading && slots.map((slot) => (
              <button
                className={`slot-choice ${form.timeSlotId === slot.id ? 'active' : ''} ${!slot.isAvailable ? 'disabled' : ''}`}
                disabled={!slot.isAvailable}
                key={slot.id}
                onClick={() => updateField('timeSlotId', slot.id)}
                type="button"
              >
                <strong>{slot.startTime}-{slot.endTime}</strong>
                <span>{slot.isAvailable ? `Подходит лошадей: ${slot.availableHorseIds.length}` : slot.reasons[0]}</span>
              </button>
            ))}
          </div>
          {errors.timeSlotId && <small className="standalone-error">{errors.timeSlotId}</small>}
        </section>

        <div className="form-grid">
          <label>
            <span>Имя заявителя *</span>
            <input value={form.clientName} onChange={(event) => updateField('clientName', event.target.value)} placeholder="Иванова Мария" />
            {errors.clientName && <small>{errors.clientName}</small>}
          </label>
          <label>
            <span>Телефон *</span>
            <input value={form.clientPhone} onChange={(event) => updateField('clientPhone', event.target.value)} placeholder="+7 (999) 123-45-67" inputMode="tel" />
            {errors.clientPhone && <small>{errors.clientPhone}</small>}
          </label>
        </div>

        <section className="booking-step">
          <div className="booking-step-header">
            <h3><Users size={20} /> Участники</h3>
            <Button type="button" variant="secondary" onClick={addParticipant}>
              <Plus size={18} /> Добавить участника
            </Button>
          </div>

          <div className="participants-list">
            {form.participants.map((participant, index) => (
              <article className="participant-card" key={participant.id}>
                <div className="participant-card-header">
                  <h4>Участник {index + 1}</h4>
                  <button type="button" className="icon-button danger-icon" onClick={() => removeParticipant(participant.id)} aria-label="Удалить участника">
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="form-grid">
                  <label>
                    <span>Имя участника *</span>
                    <input value={participant.fullName} onChange={(event) => updateParticipant(participant.id, 'fullName', event.target.value)} />
                  </label>
                  <label>
                    <span>Возраст *</span>
                    <input type="number" min="1" value={participant.age} onChange={(event) => updateParticipant(participant.id, 'age', Number(event.target.value))} />
                  </label>
                  <label>
                    <span>Вес, кг *</span>
                    <input type="number" min="1" value={participant.weightKg} onChange={(event) => updateParticipant(participant.id, 'weightKg', Number(event.target.value))} />
                  </label>
                  <label>
                    <span>Уровень подготовки *</span>
                    <select value={participant.experience} onChange={(event) => updateParticipant(participant.id, 'experience', event.target.value as RiderExperience)}>
                      {Object.entries(experienceLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  <span>Комментарий по участнику</span>
                  <textarea value={participant.comment} onChange={(event) => updateParticipant(participant.id, 'comment', event.target.value)} rows={2} />
                </label>
                {errors[`participant-${participant.id}`] && <small className="standalone-error">{errors[`participant-${participant.id}`]}</small>}
              </article>
            ))}
          </div>
        </section>

        <label>
          <span>Комментарий к заявке</span>
          <textarea value={form.comment} onChange={(event) => updateField('comment', event.target.value)} placeholder="Пожелания по времени, участникам или формату занятия" rows={3} />
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.personalDataAgreement}
            onChange={(event) => updateField('personalDataAgreement', event.target.checked)}
          />
          <span>Я согласен(а) на обработку персональных данных для связи по заявке *</span>
        </label>
        {errors.personalDataAgreement && <small className="standalone-error">{errors.personalDataAgreement}</small>}

        <Button type="submit" disabled={status === 'loading'} className="full-width">
          {status === 'loading' ? 'Проверяем доступность...' : 'Отправить заявку'}
        </Button>

        {(status === 'success' || status === 'error') && (
          <div ref={submitFeedbackRef} className="booking-submit-feedback" tabIndex={-1}>
            {status === 'success' ? (
              <Alert type="success">Заявка отправлена. Администратор проверит запись и свяжется с вами для подтверждения.</Alert>
            ) : (
              <Alert type="error">{submitReason || 'Не удалось отправить заявку. Попробуйте еще раз.'}</Alert>
            )}
          </div>
        )}

        <p className="secure-note">
          <ShieldCheck size={17} /> Клиентская проверка помогает показать сценарий. Сервер после интеграции обязан повторно проверить доступность и правила.
        </p>
      </form>

      <aside className="booking-aside">
        {selectedService && (
          <section className="side-panel">
            <h3>Выбранная услуга</h3>
            <div className="mini-service" style={getMediaStyle(selectedService.image)}>
              {selectedService.title}
            </div>
            <dl className="compact-list">
              <div><dt>Длительность</dt><dd>{selectedService.duration}</dd></div>
              <div><dt>Стоимость</dt><dd>{selectedService.price}</dd></div>
              <div><dt>Возраст</dt><dd>{selectedService.ageLimit}</dd></div>
            </dl>
          </section>
        )}

        <section className="side-panel warm">
          <h3>Как проверяется слот</h3>
          <ol>
            <li>Учитывается длительность услуги и рабочие часы.</li>
            <li>Для каждого участника ищется подходящая свободная лошадь.</li>
            <li>Проверяется вес, возраст, статус лошади и отдых после занятия.</li>
          </ol>
        </section>

        <section className="side-panel">
          <h3>После отправки</h3>
          <p>Заявка получит статус «ожидает подтверждения». Администратор увидит ее в календаре и сможет подтвердить, отклонить или уточнить детали.</p>
        </section>
      </aside>
    </div>
  );
}
