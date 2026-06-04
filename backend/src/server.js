const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');
const {
  clone,
  createSession,
  deleteSession,
  findStaffUserForLogin,
  getDb,
  getSessionUser,
  resetDb,
  saveDb,
  verifyStaffPassword,
} = require('./store');
const {
  checkBookingAvailability,
  getAvailableDates,
  getAvailableTimeSlots,
  resolveBookingTime,
} = require('./availability');

const BLOCKING_STATUSES = ['pending', 'confirmed', 'needs_clarification'];

function newId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

function toDateTime(date, time) {
  return new Date(`${date}T${time}:00`);
}

function durationHours(booking) {
  return Math.max((toDateTime(booking.date, booking.endTime).getTime() - toDateTime(booking.date, booking.startTime).getTime()) / 3600000, 0);
}

function isDateInRange(date, dateFrom, dateTo) {
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}

function toMinutes(time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
}

function overlaps(startA, endA, startB, endB) {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(endA) > toMinutes(startB);
}

function setCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

function sendJson(req, res, statusCode, payload) {
  setCors(req, res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function ok(req, res, data, message) {
  sendJson(req, res, 200, message ? { data, message } : { data });
}

function created(req, res, data, message) {
  sendJson(req, res, 201, message ? { data, message } : { data });
}

function fail(req, res, statusCode, code, message, details) {
  sendJson(req, res, statusCode, { code, message, details });
}

async function readJsonBody(req) {
  const contentType = req.headers['content-type'] || '';
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
  }
  if (!raw) return {};
  if (!contentType.includes('application/json')) return {};

  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('Invalid JSON body');
    error.statusCode = 400;
    error.code = 'INVALID_JSON';
    throw error;
  }
}

function parseCookies(req) {
  return String(req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, item) => {
      const [key, ...rest] = item.split('=');
      acc[key] = decodeURIComponent(rest.join('='));
      return acc;
    }, {});
}

function getSession(req) {
  const sid = parseCookies(req).sid;
  return sid ? getSessionUser(sid) : undefined;
}

function setSessionCookie(res, sid) {
  res.setHeader('Set-Cookie', `sid=${encodeURIComponent(sid)}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    role: user.role,
    name: user.displayName || user.name,
    trainerId: user.trainerId,
  };
}

function createNotification(db, data) {
  const notification = {
    ...data,
    id: newId('notification'),
    createdAt: new Date().toISOString(),
    isRead: false,
  };
  db.notifications = [notification, ...(db.notifications || [])];
  return notification;
}

function getCollectionItem(db, key, id) {
  return db[key].find((item) => item.id === id);
}

function createCollectionItem(db, key, prefix, body) {
  const item = {
    ...body,
    id: body.id || newId(prefix),
  };
  db[key] = [item, ...db[key]];
  saveDb();
  return item;
}

function patchCollectionItem(db, key, id, body) {
  let updated;
  db[key] = db[key].map((item) => {
    if (item.id !== id) return item;
    updated = { ...item, ...body, id: item.id };
    return updated;
  });
  if (updated) saveDb();
  return updated;
}

function deleteCollectionItem(db, key, id) {
  const initialLength = db[key].length;
  db[key] = db[key].filter((item) => item.id !== id);
  if (db[key].length !== initialLength) saveDb();
  return { id };
}

function filterBookings(bookings, filters = {}) {
  const searchValue = String(filters.search || '').trim().toLowerCase();

  return bookings.filter((booking) => {
    if (filters.status && filters.status !== 'all' && booking.status !== filters.status) return false;
    if (!isDateInRange(booking.date, filters.dateFrom, filters.dateTo)) return false;
    if (filters.serviceId && booking.serviceId !== filters.serviceId) return false;
    if (filters.trainerId && booking.assignedTrainerId !== filters.trainerId) return false;

    if (searchValue) {
      const haystack = `${booking.clientName} ${booking.clientPhone}`.toLowerCase();
      if (!haystack.includes(searchValue)) return false;
    }

    return true;
  });
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const shift = day === 0 ? 6 : day - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - shift);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

function findRestWarnings(bookings) {
  const byHorse = new Map();

  bookings.forEach((booking) => {
    booking.assignedHorses.forEach((pair) => {
      const bucket = byHorse.get(pair.horseId) || [];
      bucket.push(booking);
      byHorse.set(pair.horseId, bucket);
    });
  });

  const warnings = new Map();
  byHorse.forEach((horseBookings, horseId) => {
    const sorted = [...horseBookings].sort((a, b) => toDateTime(a.date, a.startTime).getTime() - toDateTime(b.date, b.startTime).getTime());
    let count = 0;
    for (let i = 1; i < sorted.length; i += 1) {
      const prevEnd = toDateTime(sorted[i - 1].date, sorted[i - 1].endTime).getTime();
      const nextStart = toDateTime(sorted[i].date, sorted[i].startTime).getTime();
      const restMinutes = (nextStart - prevEnd) / 60000;
      if (restMinutes >= 0 && restMinutes < 30) count += 1;
    }
    warnings.set(horseId, count);
  });
  return warnings;
}

function buildDashboardStats(db) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const { weekStart, weekEnd } = getWeekRange();
  const weekBookings = db.bookings.filter((booking) => {
    const dt = toDateTime(booking.date, booking.startTime);
    return dt >= weekStart && dt <= weekEnd;
  });

  return {
    newRequestsCount: db.bookings.filter((booking) => booking.status === 'pending').length,
    todayBookingsCount: db.bookings.filter((booking) => booking.date === today).length,
    unassignedBookingsCount: db.bookings.filter((booking) => !booking.assignedTrainerId).length,
    needsClarificationCount: db.bookings.filter((booking) => booking.status === 'needs_clarification').length,
    confirmedThisWeekCount: weekBookings.filter((booking) => booking.status === 'confirmed').length,
    rejectedThisWeekCount: weekBookings.filter((booking) => booking.status === 'rejected').length,
  };
}

function buildAttentionBookings(db) {
  const restWarnings = findRestWarnings(db.bookings);
  const activeHorseIds = new Set(db.horses.filter((horse) => horse.isActive && horse.status === 'available').map((horse) => horse.id));

  return db.bookings
    .map((booking) => {
      const reasons = [];
      if (booking.status === 'pending') reasons.push('Awaiting confirmation');
      if (booking.status === 'needs_clarification') reasons.push('Needs clarification');
      if (!booking.assignedTrainerId) reasons.push('Trainer is not assigned');
      if (booking.assignedHorses.length < booking.participants.length) reasons.push('Not all participants have horses');
      if (booking.assignedHorses.some((pair) => !activeHorseIds.has(pair.horseId))) reasons.push('Inactive horse assigned');
      if (booking.assignedHorses.some((pair) => (restWarnings.get(pair.horseId) || 0) > 0)) reasons.push('Possible horse rest conflict');
      return { booking, reasons };
    })
    .filter((item) => item.reasons.length > 0)
    .sort((a, b) => toDateTime(a.booking.date, a.booking.startTime).getTime() - toDateTime(b.booking.date, b.booking.startTime).getTime());
}

function buildTrainerWorkload(db, dateFrom, dateTo) {
  const scoped = db.bookings.filter((booking) => isDateInRange(booking.date, dateFrom, dateTo));
  return db.trainers.map((trainer) => {
    const trainerBookings = scoped.filter((booking) => booking.assignedTrainerId === trainer.id);
    return {
      trainerId: trainer.id,
      trainerName: trainer.fullName,
      bookingsCount: trainerBookings.length,
      hoursPlanned: Number(trainerBookings.reduce((acc, booking) => acc + durationHours(booking), 0).toFixed(1)),
      pendingCount: trainerBookings.filter((booking) => booking.status === 'pending').length,
      needsClarificationCount: trainerBookings.filter((booking) => booking.status === 'needs_clarification').length,
    };
  });
}

function buildHorseWorkload(db, dateFrom, dateTo) {
  const scoped = db.bookings.filter((booking) => isDateInRange(booking.date, dateFrom, dateTo));
  const restWarnings = findRestWarnings(scoped);
  return db.horses.map((horse) => {
    const horseBookings = scoped.filter((booking) => booking.assignedHorses.some((pair) => pair.horseId === horse.id));
    return {
      horseId: horse.id,
      horseName: horse.name,
      bookingsCount: horseBookings.length,
      hoursPlanned: Number(horseBookings.reduce((acc, booking) => acc + durationHours(booking), 0).toFixed(1)),
      restWarningsCount: restWarnings.get(horse.id) || 0,
    };
  });
}

function canAssignTrainer(db, booking, trainer) {
  const weekDay = new Date(`${booking.date}T00:00:00`).getDay();
  if (!trainer.isActive || trainer.status !== 'active') return 'Trainer is unavailable';
  if (!trainer.allowedServiceIds.includes(booking.serviceId)) return 'Trainer does not provide selected service';
  if (!trainer.workingDays.includes(weekDay)) return 'Trainer does not work on selected date';
  if (toMinutes(booking.startTime) < toMinutes(trainer.workStartTime) || toMinutes(booking.endTime) > toMinutes(trainer.workEndTime)) {
    return 'Trainer is unavailable for selected time';
  }

  const conflict = db.bookings.find(
    (item) =>
      item.id !== booking.id &&
      item.date === booking.date &&
      BLOCKING_STATUSES.includes(item.status) &&
      item.assignedTrainerId === trainer.id &&
      overlaps(booking.startTime, booking.endTime, item.startTime, item.endTime),
  );

  return conflict ? 'Trainer already has a booking at selected time' : '';
}

function getRequestContext(req) {
  const requestUrl = new URL(req.url, 'http://localhost');
  const pathname = requestUrl.pathname.startsWith('/api') ? requestUrl.pathname.slice(4) || '/' : requestUrl.pathname;
  const parts = pathname.split('/').filter(Boolean);
  return { pathname, parts, query: requestUrl.searchParams };
}

async function handleAuth(req, res, method, parts, body, db) {
  if (method === 'POST' && parts[1] === 'login') {
    const login = String(body.login || '').trim();
    const password = String(body.password || '');
    const role = ['admin', 'manager', 'trainer'].includes(body.role) ? body.role : undefined;
    if (!role) return fail(req, res, 400, 'ROLE_REQUIRED', 'Role is required');

    const user = findStaffUserForLogin({ role, login, trainerId: body.trainerId });
    if (!user || !verifyStaffPassword(user, password)) {
      return fail(req, res, 401, 'INVALID_CREDENTIALS', 'Invalid login or password');
    }

    const session = createSession(user.id);
    setSessionCookie(res, session.token);
    return ok(req, res, publicUser(user));
  }

  if (method === 'POST' && parts[1] === 'logout') {
    const sid = parseCookies(req).sid;
    if (sid) deleteSession(sid);
    clearSessionCookie(res);
    return ok(req, res, { ok: true });
  }

  if (method === 'GET' && parts[1] === 'me') {
    return ok(req, res, publicUser(getSession(req)));
  }

  return false;
}

function handleCollection(req, res, method, parts, db, route, key, prefix) {
  if (parts[0] !== route) return false;
  if (method === 'GET' && parts.length === 1) {
    ok(req, res, clone(db[key]));
    return true;
  }
  if (method === 'POST' && parts.length === 1) {
    created(req, res, createCollectionItem(db, key, prefix, req.body));
    return true;
  }
  if (method === 'GET' && parts.length === 2) {
    ok(req, res, clone(getCollectionItem(db, key, parts[1])));
    return true;
  }
  if (method === 'PATCH' && parts.length === 2) {
    ok(req, res, patchCollectionItem(db, key, parts[1], req.body));
    return true;
  }
  if (method === 'DELETE' && parts.length === 2) {
    ok(req, res, deleteCollectionItem(db, key, parts[1]));
    return true;
  }
  return false;
}

function buildAdminSnapshot(db) {
  return clone({
    siteContent: db.siteContent,
    services: db.services,
    galleryItems: db.galleryItems,
    horses: db.horses,
    trainers: db.trainers,
    staffAccounts: db.staffAccounts || [],
    bookings: db.bookings,
    bookingRules: db.bookingRules,
    reviews: db.reviews,
    contacts: db.contacts,
    rulesInfo: db.rulesInfo,
    contentBlocks: db.contentBlocks || [],
    mediaFolders: db.mediaFolders || [],
    mediaAssets: db.mediaAssets || [],
  });
}

function applyAdminSnapshot(db, body) {
  [
    'services',
    'galleryItems',
    'horses',
    'trainers',
    'staffAccounts',
    'bookings',
    'bookingRules',
    'reviews',
    'contentBlocks',
    'mediaFolders',
    'mediaAssets',
  ].forEach((key) => {
    if (Array.isArray(body[key])) db[key] = body[key];
  });

  ['siteContent', 'contacts', 'rulesInfo'].forEach((key) => {
    if (body[key] && typeof body[key] === 'object') db[key] = body[key];
  });
}

function isPublicRequest(method, parts, pathname) {
  if (method === 'GET' && pathname === '/health') return true;
  if (parts[0] === 'auth') return true;
  if (method === 'GET' && ['site-content', 'services', 'horses', 'trainers', 'reviews', 'contacts', 'rules-info'].includes(parts[0])) return true;
  if (method === 'GET' && parts[0] === 'gallery') return true;
  if (method === 'GET' && parts[0] === 'pages' && parts[2] === 'content') return true;
  if (method === 'GET' && parts[0] === 'booking-rules') return true;
  if (method === 'GET' && parts[0] === 'schedule' && parts[1] === 'exceptions') return true;
  if (parts[0] === 'availability') return true;
  if (method === 'POST' && parts[0] === 'bookings' && parts.length === 1) return true;
  return false;
}

function rolesForRequest(method, parts, pathname) {
  if (pathname === '/dev/reset') return ['admin'];
  if (parts[0] === 'admin') return ['admin'];
  if (parts[0] === 'manager') return ['admin', 'manager'];
  if (parts[0] === 'trainer') return ['admin', 'manager', 'trainer'];
  if (parts[0] === 'notifications') return ['admin', 'manager'];

  if (parts[0] === 'bookings') {
    if (method === 'GET') return ['admin', 'manager', 'trainer'];
    if (parts[2] === 'trainer-status') return ['admin', 'manager', 'trainer'];
    return ['admin', 'manager'];
  }

  if (method === 'GET') return ['admin', 'manager'];
  return ['admin'];
}

function authorizeRequest(req, res, method, parts, pathname, user) {
  if (isPublicRequest(method, parts, pathname)) return true;
  if (!user) {
    fail(req, res, 401, 'UNAUTHORIZED', 'Authentication is required');
    return false;
  }

  const allowedRoles = rolesForRequest(method, parts, pathname);
  if (!allowedRoles.includes(user.role)) {
    fail(req, res, 403, 'FORBIDDEN', 'Not enough permissions for this action');
    return false;
  }

  return true;
}

async function handleRequest(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  let body = {};
  try {
    if (['POST', 'PATCH', 'PUT'].includes(req.method)) body = await readJsonBody(req);
  } catch (error) {
    fail(req, res, error.statusCode || 400, error.code || 'BAD_REQUEST', error.message);
    return;
  }

  req.body = body;
  const db = getDb();
  const { pathname, parts, query } = getRequestContext(req);
  const method = req.method;

  try {
    if (method === 'GET' && pathname === '/health') return ok(req, res, { ok: true, version: db.version });

    if (parts[0] === 'auth') {
      const handled = await handleAuth(req, res, method, parts, body, db);
      if (handled !== false) return;
    }

    const currentUser = getSession(req);
    req.user = currentUser;
    if (!authorizeRequest(req, res, method, parts, pathname, currentUser)) return;

    if (method === 'POST' && pathname === '/dev/reset') return ok(req, res, resetDb());

    if (parts[0] === 'admin' && parts[1] === 'snapshot') {
      if (method === 'GET') return ok(req, res, buildAdminSnapshot(db));
      if (method === 'PATCH') {
        applyAdminSnapshot(db, body);
        saveDb();
        return ok(req, res, buildAdminSnapshot(getDb()));
      }
    }

    if (parts[0] === 'services' && parts[1] === 'reorder' && method === 'POST') {
      const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds : [];
      const known = new Map(db.services.map((service) => [service.id, service]));
      const ordered = orderedIds.map((id) => known.get(id)).filter(Boolean);
      const remaining = db.services.filter((service) => !orderedIds.includes(service.id));
      db.services = [...ordered, ...remaining];
      saveDb();
      return ok(req, res, db.services);
    }

    if (handleCollection(req, res, method, parts, db, 'services', 'services', 'service')) return;
    if (handleCollection(req, res, method, parts, db, 'horses', 'horses', 'horse')) return;
    if (handleCollection(req, res, method, parts, db, 'trainers', 'trainers', 'trainer')) return;
    if (handleCollection(req, res, method, parts, db, 'booking-rules', 'bookingRules', 'rule')) return;

    if (parts[0] === 'site-content') {
      if (method === 'GET') return ok(req, res, clone(db.siteContent));
      if (method === 'PATCH') {
        db.siteContent = { ...db.siteContent, ...body };
        saveDb();
        return ok(req, res, db.siteContent);
      }
    }

    if (parts[0] === 'gallery' && (!parts[1] || parts[1] === 'items')) {
      if (method === 'GET') return ok(req, res, clone(db.galleryItems));
      if (method === 'POST') return created(req, res, createCollectionItem(db, 'galleryItems', 'gallery', body));
    }

    if (parts[0] === 'gallery' && parts[1] === 'items' && parts[2]) {
      if (method === 'PATCH') return ok(req, res, patchCollectionItem(db, 'galleryItems', parts[2], body));
      if (method === 'DELETE') return ok(req, res, deleteCollectionItem(db, 'galleryItems', parts[2]));
    }

    if (parts[0] === 'reviews') {
      if (method === 'GET' && parts.length === 1) return ok(req, res, clone(db.reviews));
      if (method === 'PATCH' && parts.length === 1 && Array.isArray(body)) {
        db.reviews = body;
        saveDb();
        return ok(req, res, db.reviews);
      }
      if (method === 'POST' && parts.length === 1) return created(req, res, createCollectionItem(db, 'reviews', 'review', body));
      if (method === 'PATCH' && parts.length === 2) return ok(req, res, patchCollectionItem(db, 'reviews', parts[1], body));
      if (method === 'DELETE' && parts.length === 2) return ok(req, res, deleteCollectionItem(db, 'reviews', parts[1]));
    }

    if (parts[0] === 'contacts') {
      if (method === 'GET') return ok(req, res, clone(db.contacts));
      if (method === 'PATCH') {
        db.contacts = body;
        saveDb();
        return ok(req, res, db.contacts);
      }
    }

    if (parts[0] === 'rules-info' || (parts[0] === 'info' && parts[1] === 'rules')) {
      if (method === 'GET') return ok(req, res, clone(db.rulesInfo));
      if (method === 'PATCH') {
        db.rulesInfo = body;
        saveDb();
        return ok(req, res, db.rulesInfo);
      }
    }

    if (parts[0] === 'schedule' && parts[1] === 'exceptions' && method === 'GET') {
      return ok(req, res, db.bookingRules.filter((rule) => rule.type === 'closed_date' || rule.type === 'horse_unavailable'));
    }

    if (parts[0] === 'availability' && parts[1] === 'dates' && method === 'GET') {
      const serviceId = query.get('serviceId');
      if (!serviceId) return fail(req, res, 400, 'SERVICE_REQUIRED', 'serviceId is required');
      const participants = Number(query.get('participants') || 1);
      return ok(req, res, getAvailableDates(db, serviceId, participants));
    }

    if (parts[0] === 'availability' && parts[1] === 'slots' && method === 'GET') {
      const serviceId = query.get('serviceId');
      const date = query.get('date');
      if (!serviceId || !date) return fail(req, res, 400, 'SLOT_QUERY_REQUIRED', 'serviceId and date are required');
      return ok(req, res, getAvailableTimeSlots(db, serviceId, date));
    }

    if (parts[0] === 'availability' && parts[1] === 'check' && method === 'POST') {
      return ok(req, res, checkBookingAvailability(db, body));
    }

    if (parts[0] === 'bookings' && method === 'GET' && parts.length === 1) {
      const items = req.user?.role === 'trainer'
        ? db.bookings.filter((booking) => booking.assignedTrainerId === req.user.trainerId)
        : db.bookings;
      return ok(req, res, clone(items));
    }

    if (parts[0] === 'bookings' && method === 'POST' && parts.length === 1) {
      if (!body.personalDataAgreement) return fail(req, res, 400, 'PERSONAL_DATA_REQUIRED', 'Personal data agreement is required');
      const availability = checkBookingAvailability(db, body);
      if (!availability.isAvailable) return fail(req, res, 409, 'SLOT_UNAVAILABLE', availability.reasons[0] || 'Selected slot is unavailable', availability);

      const { startTime, endTime } = resolveBookingTime(db, body);
      const booking = {
        id: newId('booking'),
        serviceId: body.serviceId,
        date: body.date,
        startTime,
        endTime,
        clientName: body.clientName,
        clientPhone: body.clientPhone,
        participants: body.participants || [],
        assignedHorses: availability.assignedHorses,
        status: 'pending',
        comment: body.comment,
      };

      db.bookings = [booking, ...db.bookings];
      createNotification(db, {
        recipientRole: 'admin',
        recipientId: 'admin-local',
        type: 'booking_created',
        channel: 'in_app',
        title: 'New booking request',
        message: `New request for ${booking.date} at ${booking.startTime}.`,
        bookingId: booking.id,
      });
      createNotification(db, {
        recipientRole: 'manager',
        recipientId: 'manager-local',
        type: 'booking_created',
        channel: 'in_app',
        title: 'New booking request',
        message: `New request for ${booking.date} at ${booking.startTime}.`,
        bookingId: booking.id,
      });
      saveDb();
      return created(req, res, { requestId: booking.id }, 'Booking request created');
    }

    if (parts[0] === 'bookings' && parts[1]) {
      const booking = db.bookings.find((item) => item.id === parts[1]);
      if (!booking) return fail(req, res, 404, 'BOOKING_NOT_FOUND', 'Booking not found');
      if (req.user?.role === 'trainer' && booking.assignedTrainerId !== req.user.trainerId) {
        return fail(req, res, 403, 'FORBIDDEN_BOOKING', 'Trainer can access only assigned bookings');
      }

      if (method === 'GET' && parts.length === 2) return ok(req, res, clone(booking));

      if (method === 'PATCH' && parts[2] === 'status') {
        booking.status = body.status;
        booking.adminComment = body.adminComment;
        saveDb();
        return ok(req, res, booking);
      }

      if (method === 'PATCH' && parts[2] === 'assign-horses') {
        booking.assignedHorses = Array.isArray(body.assignedHorses) ? body.assignedHorses : [];
        saveDb();
        return ok(req, res, booking);
      }

      if (method === 'PATCH' && parts[2] === 'assign-trainer') {
        if (body.trainerId) {
          const trainer = db.trainers.find((item) => item.id === body.trainerId);
          if (!trainer) return fail(req, res, 404, 'TRAINER_NOT_FOUND', 'Trainer not found');
          const trainerProblem = canAssignTrainer(db, booking, trainer);
          if (trainerProblem) return fail(req, res, 409, 'TRAINER_UNAVAILABLE', trainerProblem);
          booking.assignedTrainerId = body.trainerId;
          booking.trainerStatus = 'notified';
        } else {
          delete booking.assignedTrainerId;
          delete booking.trainerStatus;
        }
        saveDb();
        return ok(req, res, booking);
      }

      if (method === 'PATCH' && parts[2] === 'trainer-status') {
        if (req.user?.role === 'trainer' && booking.assignedTrainerId !== req.user.trainerId) {
          return fail(req, res, 403, 'FORBIDDEN_BOOKING', 'Trainer can update only assigned bookings');
        }
        booking.trainerStatus = body.trainerStatus;
        createNotification(db, {
          recipientRole: 'admin',
          recipientId: 'admin-local',
          type: 'trainer_response_required',
          channel: 'in_app',
          title: 'Trainer status updated',
          message: `Trainer status for ${booking.date} booking changed to ${body.trainerStatus}.`,
          bookingId: booking.id,
        });
        createNotification(db, {
          recipientRole: 'manager',
          recipientId: 'manager-local',
          type: 'trainer_response_required',
          channel: 'in_app',
          title: 'Trainer status updated',
          message: `Trainer status for ${booking.date} booking changed to ${body.trainerStatus}.`,
          bookingId: booking.id,
        });
        saveDb();
        return ok(req, res, booking);
      }

      if (method === 'DELETE' && parts.length === 2) {
        db.bookings = db.bookings.filter((item) => item.id !== booking.id);
        saveDb();
        return ok(req, res, { id: booking.id });
      }
    }

    if (parts[0] === 'notifications') {
      if (method === 'POST' && parts.length === 1) {
        const notification = createNotification(db, body);
        saveDb();
        return created(req, res, notification);
      }

      if (method === 'GET' && parts.length === 1) {
        const recipientRole = query.get('recipientRole');
        const recipientId = query.get('recipientId');
        const items = (db.notifications || [])
          .filter((item) => (recipientRole ? item.recipientRole === recipientRole : true))
          .filter((item) => (recipientId ? item.recipientId === recipientId : true))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return ok(req, res, items);
      }

      if (method === 'GET' && parts[1] === 'unread-count') {
        const recipientId = query.get('recipientId');
        const count = (db.notifications || []).filter((item) => !item.isRead && (!recipientId || item.recipientId === recipientId)).length;
        return ok(req, res, count);
      }

      if (method === 'PATCH' && parts[2] === 'read') {
        const notification = (db.notifications || []).find((item) => item.id === parts[1]);
        if (!notification) return fail(req, res, 404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
        notification.isRead = true;
        saveDb();
        return ok(req, res, notification);
      }

      if (method === 'PATCH' && parts[1] === 'read-all') {
        const recipientId = body.recipientId;
        db.notifications = (db.notifications || []).map((item) => (!recipientId || item.recipientId === recipientId ? { ...item, isRead: true } : item));
        saveDb();
        return ok(req, res, db.notifications);
      }
    }

    if (parts[0] === 'manager') {
      if (method === 'GET' && parts[1] === 'bookings' && !parts[2]) {
        const filters = Object.fromEntries(query.entries());
        const items = filterBookings(db.bookings, filters).sort((a, b) => toDateTime(a.date, a.startTime).getTime() - toDateTime(b.date, b.startTime).getTime());
        return ok(req, res, items);
      }
      if (method === 'GET' && parts[1] === 'bookings' && parts[2]) return ok(req, res, clone(db.bookings.find((item) => item.id === parts[2])));
      if (method === 'GET' && parts[1] === 'dashboard' && parts[2] === 'stats') return ok(req, res, buildDashboardStats(db));
      if (method === 'GET' && parts[1] === 'attention-bookings') return ok(req, res, buildAttentionBookings(db));
      if (method === 'GET' && parts[1] === 'workload' && parts[2] === 'trainers') return ok(req, res, buildTrainerWorkload(db, query.get('dateFrom'), query.get('dateTo')));
      if (method === 'GET' && parts[1] === 'workload' && parts[2] === 'horses') return ok(req, res, buildHorseWorkload(db, query.get('dateFrom'), query.get('dateTo')));
      if (method === 'GET' && parts[1] === 'reference-data') return ok(req, res, { services: db.services, trainers: db.trainers, horses: db.horses });
      if (method === 'GET' && parts[1] === 'today-schedule') {
        const today = new Date().toISOString().slice(0, 10);
        return ok(req, res, db.bookings.filter((booking) => booking.date === today).sort((a, b) => a.startTime.localeCompare(b.startTime)));
      }
    }

    if (parts[0] === 'trainer') {
      const session = getSession(req);
      const trainerId = query.get('trainerId') || session?.trainerId || session?.id;
      if (method === 'GET' && parts[1] === 'me') return ok(req, res, clone(db.trainers.find((trainer) => trainer.id === trainerId)));
      if (method === 'GET' && parts[1] === 'bookings' && !parts[2]) {
        return ok(req, res, clone(db.bookings.filter((booking) => booking.assignedTrainerId === trainerId)));
      }
      if (method === 'GET' && parts[1] === 'bookings' && parts[2]) {
        const booking = db.bookings.find((item) => item.id === parts[2] && (!trainerId || item.assignedTrainerId === trainerId));
        return ok(req, res, clone(booking));
      }
    }

    if (parts[0] === 'pages' && parts[2] === 'content' && method === 'GET') {
      const pageKey = parts[1];
      return ok(req, res, db.contentBlocks.filter((block) => block.pageKey === pageKey).sort((a, b) => a.order - b.order));
    }

    if (parts[0] === 'content-blocks') {
      if (method === 'POST' && parts.length === 1) {
        const block = { ...body, id: body.id || newId('content-block') };
        db.contentBlocks = [block, ...db.contentBlocks];
        saveDb();
        return created(req, res, block);
      }

      if (method === 'POST' && parts[1] === 'reorder') {
        const pageKey = body.pageKey;
        const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds : [];
        const pageBlocks = db.contentBlocks.filter((block) => block.pageKey === pageKey);
        const untouched = db.contentBlocks.filter((block) => block.pageKey !== pageKey);
        const ordered = orderedIds
          .map((id, index) => {
            const block = pageBlocks.find((item) => item.id === id);
            return block ? { ...block, order: index + 1 } : undefined;
          })
          .filter(Boolean);
        const remaining = pageBlocks
          .filter((block) => !orderedIds.includes(block.id))
          .sort((a, b) => a.order - b.order)
          .map((block, index) => ({ ...block, order: ordered.length + index + 1 }));
        db.contentBlocks = [...untouched, ...ordered, ...remaining];
        saveDb();
        return ok(req, res, [...ordered, ...remaining]);
      }

      if (method === 'PATCH' && parts[1]) return ok(req, res, patchCollectionItem(db, 'contentBlocks', parts[1], body));
      if (method === 'DELETE' && parts[1]) return ok(req, res, deleteCollectionItem(db, 'contentBlocks', parts[1]));
    }

    if (parts[0] === 'media') {
      if (method === 'GET' && parts.length === 1) return ok(req, res, clone(db.mediaAssets));
      if (method === 'POST' && parts.length === 1) return created(req, res, createCollectionItem(db, 'mediaAssets', 'media', { ...body, createdAt: new Date().toISOString() }));
      if (method === 'PATCH' && parts[1]) return ok(req, res, patchCollectionItem(db, 'mediaAssets', parts[1], body));
      if (method === 'DELETE' && parts[1]) return ok(req, res, deleteCollectionItem(db, 'mediaAssets', parts[1]));
    }

    if (parts[0] === 'media-folders') {
      if (method === 'GET' && parts.length === 1) return ok(req, res, clone(db.mediaFolders));
      if (method === 'POST' && parts.length === 1) return created(req, res, createCollectionItem(db, 'mediaFolders', 'media-folder', body));
      if (method === 'PATCH' && parts[1]) return ok(req, res, patchCollectionItem(db, 'mediaFolders', parts[1], body));
      if (method === 'DELETE' && parts[1]) return ok(req, res, deleteCollectionItem(db, 'mediaFolders', parts[1]));
    }

    return fail(req, res, 404, 'NOT_FOUND', `Route ${method} ${pathname} not found`);
  } catch (error) {
    return fail(req, res, error.statusCode || 500, error.code || 'INTERNAL_ERROR', error.message || 'Internal server error');
  }
}

function createServer() {
  return http.createServer((req, res) => {
    handleRequest(req, res);
  });
}

function startServer() {
  const port = Number(process.env.BACKEND_PORT || process.env.PORT || 8080);
  const host = process.env.BACKEND_HOST || '127.0.0.1';
  const server = createServer();
  server.listen(port, host, () => {
    console.log(`Sivka-Burka backend listening on http://${host}:${port}/api`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createServer,
  startServer,
};
