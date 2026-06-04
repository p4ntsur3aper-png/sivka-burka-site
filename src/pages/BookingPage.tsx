import { CalendarCheck, CheckCircle2, Headphones, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookingForm } from '../components/booking/BookingForm';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { ErrorState, LoadingState } from '../components/ui/States';
import { getEditableSiteContent } from '../services/adminContent';
import { getServices } from '../services/api';
import type { Service } from '../types';
import { getMediaStyle } from '../utils/media';

export function BookingPage() {
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const siteContent = getEditableSiteContent();

  useEffect(() => {
    getServices()
      .then((response) => setServices(response.data.filter((service) => service.isAvailable)))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="page-section booking-page-redesign mockup-page">
      <Breadcrumbs items={[{ label: 'Запись' }]} />

      <div className="booking-hero-redesign">
        <div>
          <span className="eyebrow">Предварительная запись</span>
          <h1>Запись на занятие</h1>
          <p>Выберите услугу, удобную дату и время, заполните данные участников. Мы свяжемся с вами для подтверждения заявки.</p>
        </div>
        <div className="booking-hero-photo" style={getMediaStyle(siteContent.homeHeroImage)} aria-hidden="true" />
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState />}
      {!loading && !error && <BookingForm services={services} selectedServiceId={searchParams.get('service') || undefined} />}

      <div className="booking-help-strip">
        <article>
          <Headphones size={34} />
          <div>
            <strong>Нужна помощь?</strong>
            <span>Если остались вопросы, свяжитесь с нами.</span>
          </div>
        </article>
        <article>
          <Phone size={24} />
          <div>
            <strong>+7 (999) 123-45-67</strong>
            <span>Ежедневно с 08:00 до 20:00</span>
          </div>
        </article>
        <article>
          <MapPin size={24} />
          <div>
            <strong>г. Гурьевск</strong>
            <span>Территория конюшни</span>
          </div>
        </article>
        <article>
          <CalendarCheck size={24} />
          <div>
            <strong>Подтверждение</strong>
            <span>Администратор свяжется после заявки.</span>
          </div>
        </article>
      </div>

      <div className="booking-important-card">
        <h2>Что важно знать перед занятием</h2>
        <ul className="check-list">
          <li><CheckCircle2 size={18} />Наденьте удобную одежду и обувь без каблуков.</li>
          <li><CheckCircle2 size={18} />Приходите за 15 минут до начала занятия.</li>
          <li><CheckCircle2 size={18} />Сообщите заранее о медицинских ограничениях.</li>
          <li><ShieldCheck size={18} />Дети допускаются только в сопровождении взрослых.</li>
        </ul>
      </div>
    </section>
  );
}
