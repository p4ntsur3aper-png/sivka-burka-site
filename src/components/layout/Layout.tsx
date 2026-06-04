import { CalendarDays, Menu, Phone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { getEditableSiteContent } from '../../services/adminContent';
import type { SiteContent } from '../../types';
import { AdminModeToolbar } from '../admin/AdminModeToolbar';
import { ButtonLink } from '../ui/Button';

const navItems = [
  { to: '/', label: 'Главная' },
  { to: '/services', label: 'Услуги' },
  { to: '/rules', label: 'Правила и безопасность' },
  { to: '/gallery', label: 'Галерея' },
  { to: '/reviews', label: 'Отзывы' },
  { to: '/contacts', label: 'Контакты' },
];

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [siteContent, setSiteContent] = useState<SiteContent>(getEditableSiteContent());

  useEffect(() => {
    const updateSiteContent = () => setSiteContent(getEditableSiteContent());
    window.addEventListener('orlov-content-updated', updateSiteContent);
    return () => window.removeEventListener('orlov-content-updated', updateSiteContent);
  }, []);

  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink to="/" className="brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark">СБ</span>
          <span>
            <strong>{siteContent.siteName}</strong>
            <small>{siteContent.siteSubtitle}</small>
          </span>
        </NavLink>

        <nav className="desktop-nav" aria-label="Основная навигация">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="header-actions">
          <ButtonLink to="/booking" variant="primary" className="header-action">
            <CalendarDays size={18} />
            Записаться
          </ButtonLink>
        </div>

        <button className="icon-button mobile-menu-button" type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="Открыть меню">
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {menuOpen && (
        <nav className="mobile-nav" aria-label="Мобильная навигация">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setMenuOpen(false)}>
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/staff/login" onClick={() => setMenuOpen(false)}>
            Вход для сотрудников
          </NavLink>
          <ButtonLink to="/booking" variant="primary" onClick={() => setMenuOpen(false)}>
            Записаться
          </ButtonLink>
        </nav>
      )}

      <main>
        <Outlet />
      </main>

      <AdminModeToolbar />

      <footer className="site-footer">
        <div>
          <div className="brand footer-brand">
            <span className="brand-mark">СБ</span>
            <span>
              <strong>{siteContent.siteName}</strong>
              <small>{siteContent.siteSubtitle}</small>
            </span>
          </div>
          <p>Пространство для обучения, прогулок, фотосессий и спокойного общения с лошадьми.</p>
        </div>
        <div>
          <h3>Навигация</h3>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/staff/login">Вход для сотрудников</NavLink>
        </div>
        <div>
          <h3>Связь</h3>
          <a href="tel:+79991234567">
            <Phone size={16} /> +7 (999) 123-45-67
          </a>
          <span>Заявки обрабатываются с 08:00 до 20:00</span>
        </div>
      </footer>
    </div>
  );
}
