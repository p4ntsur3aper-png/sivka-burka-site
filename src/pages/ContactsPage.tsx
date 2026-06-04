import { Mail, MapPin, MessageCircle, Navigation, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EditablePageTitle } from '../components/admin/EditablePageTitle';
import { ButtonLink } from '../components/ui/Button';
import { ErrorState, LoadingState } from '../components/ui/States';
import { getContacts } from '../services/api';
import type { ContactInfo } from '../types';

export function ContactsPage() {
  const [contacts, setContacts] = useState<ContactInfo>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getContacts()
      .then((response) => setContacts(response.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="page-section">
      <EditablePageTitle pageKey="contacts" />
      {loading && <LoadingState />}
      {error && <ErrorState />}
      {contacts && (
        <div className="contacts-layout">
          <div className="contact-card">
            <h2>КТК "Сивка-Бурка"</h2>
            <p><MapPin size={18} /> {contacts.address}</p>
            <p><Phone size={18} /> <a href={`tel:${contacts.phone.replace(/\D/g, '')}`}>{contacts.phone}</a></p>
            <p><Mail size={18} /> <a href={`mailto:${contacts.email}`}>{contacts.email}</a></p>
            <p><MessageCircle size={18} /> {contacts.requestSchedule}</p>
            <div className="contact-actions">
              <ButtonLink to="/booking" variant="primary">Записаться</ButtonLink>
              {contacts.messengers.map((link) => <a className="button button-secondary" key={link.title} href={link.url}>{link.title}</a>)}
            </div>
          </div>
          <div className="map-placeholder">
            <MapPin size={44} />
            <h2>Карта</h2>
            <p>После согласования с backend или владельцем можно подключить интерактивную карту с точным адресом.</p>
          </div>
        </div>
      )}
      {contacts && (
        <div className="mobile-quick-actions">
          <a href={`tel:${contacts.phone.replace(/\D/g, '')}`}><Phone size={18} /> Позвонить</a>
          <a href={contacts.messengers[0]?.url}><MessageCircle size={18} /> Написать</a>
          <a href="https://maps.google.com"><Navigation size={18} /> Маршрут</a>
        </div>
      )}
    </section>
  );
}
