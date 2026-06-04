import { CalendarDays, Clock, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ImageUploadButton } from '../admin/ImageUploadButton';
import { getEditableServices, isAdminAuthorized, isAdminEditMode as getAdminEditMode, saveEditableServices } from '../../services/adminContent';
import type { Service } from '../../types';
import { getMediaStyle } from '../../utils/media';
import { ButtonLink } from '../ui/Button';

interface ServiceCardProps {
  service: Service;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const [adminEditMode, setAdminEditMode] = useState(isAdminAuthorized() && getAdminEditMode());

  useEffect(() => {
    const syncAdminState = () => setAdminEditMode(isAdminAuthorized() && getAdminEditMode());
    window.addEventListener('orlov-admin-state-updated', syncAdminState);
    return () => window.removeEventListener('orlov-admin-state-updated', syncAdminState);
  }, []);

  const updateService = <K extends keyof Service>(field: K, value: Service[K]) => {
    const updatedServices = getEditableServices().map((item) => (item.id === service.id ? { ...item, [field]: value } : item));
    saveEditableServices(updatedServices);
  };

  return (
    <article className="service-card service-card--catalog">
      <div className="service-card-image" style={getMediaStyle(service.image)} aria-hidden="true" />
      <div className="service-card-body">
        <h3>{service.title}</h3>
        <p>{service.shortDescription}</p>
        <div className="service-card-facts">
          <span><Clock size={15} /> {service.duration}</span>
          <span><Users size={15} /> {service.ageLimit}</span>
        </div>
        <strong className="service-card-price">{service.price}</strong>
        <div className="card-actions service-card-actions">
          <ButtonLink to={`/services/${service.id}`} variant="primary">
            Подробнее
          </ButtonLink>
          <ButtonLink to={`/booking?service=${service.id}`} variant="secondary" aria-label={`Записаться на ${service.title}`}>
            <CalendarDays size={17} />
          </ButtonLink>
        </div>
        {adminEditMode && (
          <div className="inline-edit-panel service-inline-panel">
            <strong>Быстрое редактирование</strong>
            <label>
              <span>Название</span>
              <input value={service.title} onChange={(event) => updateService('title', event.target.value)} />
            </label>
            <label>
              <span>Цена</span>
              <input value={service.price} onChange={(event) => updateService('price', event.target.value)} />
            </label>
            <label>
              <span>URL или gradient</span>
              <input value={service.image} onChange={(event) => updateService('image', event.target.value)} />
            </label>
            <ImageUploadButton label="Добавить файл фото" onUpload={(dataUrl) => updateService('image', dataUrl)} />
          </div>
        )}
      </div>
    </article>
  );
}
