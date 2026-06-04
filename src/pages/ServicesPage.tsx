import { CheckCircle2, Clock, Search, SlidersHorizontal, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ServiceCard } from '../components/services/ServiceCard';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { ErrorState, LoadingState } from '../components/ui/States';
import { getServices } from '../services/api';
import type { Service } from '../types';

type SortMode = 'popular' | 'price' | 'duration';

const getPrice = (service: Service) => Number(service.price.replace(/[^\d]/g, '')) || 0;

export function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [ageFilter, setAgeFilter] = useState('all');
  const [durationFilter, setDurationFilter] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('popular');

  useEffect(() => {
    const loadServices = () => {
      getServices()
        .then((response) => setServices(response.data))
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    };

    loadServices();
    window.addEventListener('orlov-content-updated', loadServices);
    return () => window.removeEventListener('orlov-content-updated', loadServices);
  }, []);

  const filteredServices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const result = services.filter((service) => {
      if (normalizedSearch && !`${service.title} ${service.shortDescription}`.toLowerCase().includes(normalizedSearch)) return false;
      if (ageFilter === 'kids' && service.minAge > 7) return false;
      if (ageFilter === 'adults' && service.minAge < 10) return false;
      if (durationFilter === 'short' && service.durationMinutes > 60) return false;
      if (durationFilter === 'long' && service.durationMinutes <= 60) return false;
      return true;
    });

    return [...result].sort((a, b) => {
      if (sortMode === 'price') return getPrice(a) - getPrice(b);
      if (sortMode === 'duration') return a.durationMinutes - b.durationMinutes;
      return 0;
    });
  }, [ageFilter, durationFilter, search, services, sortMode]);

  return (
    <section className="page-section services-catalog-page mockup-page">
      <Breadcrumbs items={[{ label: 'Услуги' }, { label: 'Каталог услуг' }]} />

      <div className="catalog-hero">
        <div>
          <span className="eyebrow">Каталог</span>
          <h1>Каталог услуг</h1>
          <p>Выберите подходящую услугу и проведите время с пользой в компании лошадей и инструкторов.</p>
        </div>
        <aside className="catalog-help-card">
          <h2>Как выбрать услугу?</h2>
          <ul className="check-list">
            <li><CheckCircle2 size={18} />Определите цель: обучение, отдых или знакомство.</li>
            <li><CheckCircle2 size={18} />Учитывайте возраст и уровень подготовки.</li>
            <li><CheckCircle2 size={18} />Выберите удобную длительность занятия.</li>
            <li><CheckCircle2 size={18} />При сомнениях оставьте комментарий к заявке.</li>
          </ul>
        </aside>
      </div>

      <div className="catalog-filter-panel">
        <label>
          <span><SlidersHorizontal size={17} /> Тип услуги</span>
          <select value={ageFilter} onChange={(event) => setAgeFilter(event.target.value)}>
            <option value="all">Все услуги</option>
            <option value="kids">Подходит детям</option>
            <option value="adults">Для взрослых</option>
          </select>
        </label>
        <label>
          <span><Clock size={17} /> Продолжительность</span>
          <select value={durationFilter} onChange={(event) => setDurationFilter(event.target.value)}>
            <option value="all">Любая</option>
            <option value="short">До 60 минут</option>
            <option value="long">Больше 60 минут</option>
          </select>
        </label>
        <label>
          <span><Users size={17} /> Сортировка</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
            <option value="popular">По популярности</option>
            <option value="price">Сначала дешевле</option>
            <option value="duration">По длительности</option>
          </select>
        </label>
        <label className="catalog-search">
          <span><Search size={17} /> Поиск</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск услуги..." />
        </label>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState />}
      {!loading && !error && (
        <>
          <div className="catalog-count-row">
            <span>Найдено услуг: {filteredServices.length}</span>
          </div>
          <div className="cards-grid catalog-grid">
            {filteredServices.map((service) => <ServiceCard key={service.id} service={service} />)}
          </div>
        </>
      )}
    </section>
  );
}
