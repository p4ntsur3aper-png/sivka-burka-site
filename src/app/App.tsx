import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { AdminPage } from '../pages/AdminPage';
import { AdminNotificationsPage } from '../pages/AdminNotificationsPage';
import { BookingPage } from '../pages/BookingPage';
import { ContactsPage } from '../pages/ContactsPage';
import { GalleryPage } from '../pages/GalleryPage';
import { HomePage } from '../pages/HomePage';
import { ManagerBookingDetailsPage } from '../pages/ManagerBookingDetailsPage';
import { ManagerBookingsPage } from '../pages/ManagerBookingsPage';
import { ManagerCalendarPage } from '../pages/ManagerCalendarPage';
import { ManagerDashboardPage } from '../pages/ManagerDashboardPage';
import { ManagerNotificationsPage } from '../pages/ManagerNotificationsPage';
import { ReviewsPage } from '../pages/ReviewsPage';
import { RulesPage } from '../pages/RulesPage';
import { ServiceDetailsPage } from '../pages/ServiceDetailsPage';
import { ServicesPage } from '../pages/ServicesPage';
import { StaffLoginPage } from '../pages/StaffLoginPage';
import { TrainerBookingDetailsPage } from '../pages/TrainerBookingDetailsPage';
import { TrainerLoginPage } from '../pages/TrainerLoginPage';
import { TrainerSchedulePage } from '../pages/TrainerSchedulePage';
import { clearLegacyBrowserData, getEditableSiteContent, hydrateEditableContentFromBackend } from '../services/adminContent';

function applySiteTheme() {
  const content = getEditableSiteContent();
  const root = document.documentElement;
  root.style.setProperty('--green-800', content.primaryColor);
  root.style.setProperty('--green-900', content.darkColor);
  root.style.setProperty('--clay', content.accentColor);
}

export function App() {
  useEffect(() => {
    clearLegacyBrowserData();
    applySiteTheme();
    void hydrateEditableContentFromBackend()
      .then(applySiteTheme)
      .catch(() => undefined);
    window.addEventListener('orlov-content-updated', applySiteTheme);
    return () => window.removeEventListener('orlov-content-updated', applySiteTheme);
  }, []);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/:id" element={<ServiceDetailsPage />} />
        <Route path="/booking" element={<BookingPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
        <Route path="/staff/login" element={<StaffLoginPage />} />
        <Route path="/manager/dashboard" element={<ManagerDashboardPage />} />
        <Route path="/manager/bookings" element={<ManagerBookingsPage />} />
        <Route path="/manager/bookings/:id" element={<ManagerBookingDetailsPage />} />
        <Route path="/manager/calendar" element={<ManagerCalendarPage />} />
        <Route path="/manager/notifications" element={<ManagerNotificationsPage />} />
        <Route path="/trainer/login" element={<TrainerLoginPage />} />
        <Route path="/trainer/schedule" element={<TrainerSchedulePage />} />
        <Route path="/trainer/notifications" element={<Navigate to="/trainer/schedule" replace />} />
        <Route path="/trainer/bookings/:id" element={<TrainerBookingDetailsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
