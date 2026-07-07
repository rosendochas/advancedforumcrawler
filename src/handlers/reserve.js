import { reservePage } from '../lib/templates.js';
import { getSession } from '../lib/session.js';
import { ForumClient } from '../lib/forum-client.js';
import { CONFIG } from '../lib/config.js';
import { findBoardThreads, parseBookingTable, extractPostFormData } from '../lib/scraper.js';
import { log, warn, error as logError } from '../lib/logger.js';

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export async function handleReserve(request, env) {
  const session = await getSession(request, env);
  if (!session.forumCookies || !session.username) {
    return new Response(null, { status: 302, headers: { Location: '/' } });
  }

  if (request.method === 'POST') {
    const formData = await request.formData();
    const roomName = formData.get('room') || '';
    const days = formData.get('days') || '';
    if (!roomName || !days) {
      return new Response(null, { status: 302, headers: { Location: '/calendar' } });
    }
    const config = CONFIG(env);
    const room = config.ROOMS.find(r => r.name === roomName);
    if (!room) {
      return new Response(null, { status: 302, headers: { Location: '/calendar' } });
    }
    const postFields = Object.fromEntries(formData.entries());
    return handleReservePost(env, session, room, days, postFields);
  }

  const url = new URL(request.url);
  const roomName = url.searchParams.get('room') || '';
  const days = url.searchParams.get('days') || '';

  if (!roomName || !days) {
    return new Response(null, { status: 302, headers: { Location: '/calendar' } });
  }

  const config = CONFIG(env);
  const room = config.ROOMS.find(r => r.name === roomName);
  if (!room) {
    return new Response(null, { status: 302, headers: { Location: '/calendar' } });
  }

  const html = reservePage(session.username, roomName, days, null, '');
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function handleReservePost(env, session, room, days, postFields) {
  const date = postFields.date || '';
  const startHours = postFields.start_hours || '';
  const startMinutes = postFields.start_minutes || '';
  const endHours = postFields.end_hours || '';
  const endMinutes = postFields.end_minutes || '';
  const activity = postFields.activity || '';
  const announce = postFields.announce === '1';
  const who = postFields.who || '';

  if (!date || !startHours || !startMinutes || !endHours || !endMinutes || !activity) {
    const html = reservePage(session.username, room.name, days,
      { startHours, startMinutes, endHours, endMinutes },
      'Todos los campos obligatorios deben estar rellenados.');
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (announce && !who) {
    const html = reservePage(session.username, room.name, days,
      { startHours, startMinutes, endHours, endMinutes },
      'Debes especificar los asistentes si marcas "Anunciar".');
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const client = new ForumClient(env);
  client.setCookies(session.forumCookies);

  try {
    const result = await postReservation(client, room, date, startHours, startMinutes, endHours, endMinutes, activity);

    if (!result.success) {
      const html = reservePage(session.username, room.name, days,
        { startHours, startMinutes, endHours, endMinutes },
        result.error || 'Error al realizar la reserva.');
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    console.warn(`announce=${announce}, who="${who}"`);
    let announceError = '';
    if (announce && who) {
      const announceResult = await postAnnouncement(client, date, startHours, startMinutes, endHours, endMinutes, activity, who);
      if (!announceResult) {
        announceError = 'No se ha podido encontrar el hilo de anuncio para la fecha seleccionada. La reserva se ha creado correctamente pero no se ha publicado el anuncio.';
      }
    }

    let bookingsUrl = `/bookings?days=${encodeURIComponent(days)}`;
    if (announceError) {
      bookingsUrl += `&announce_error=${encodeURIComponent(announceError)}`;
    }

    return new Response(null, {
      status: 302,
      headers: { Location: bookingsUrl },
    });
  } catch (err) {
    logError('Reserve error:', err);
    const html = reservePage(session.username, room.name, days,
      { startHours, startMinutes, endHours, endMinutes },
      'Error de conexión con el foro.');
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function postReservation(client, room, date, startH, startM, endH, endM, activity) {
  const boardResp = await client.get(room.url);
  const boardHtml = await boardResp.text();

  const dateParts = date.match(/^(\d+)\/(\d+)\/(\d+)$/);
  if (!dateParts) return { success: false, error: 'Fecha inválida.' };

  const [, day, month, yearShort] = dateParts;
  const year = 2000 + parseInt(yearShort);

  const threads = findBoardThreads(boardHtml);
  const monthYearLabel = `${MONTHS_ES[parseInt(month) - 1]} ${year}`;
  const targetThread = threads.find(t =>
    t.title.toLowerCase() === monthYearLabel.toLowerCase()
  );

  if (!targetThread) {
    return { success: false, error: 'Aún no hay hilo para el mes seleccionado.' };
  }

  const threadUrl = resolveUrl(targetThread.href, client.baseUrl);
  const threadResp = await client.get(threadUrl);
  const threadHtml = await threadResp.text();

  const existingRows = parseBookingTable(threadHtml);
  if (hasOverlap(existingRows, day, startH, startM, endH, endM)) {
    return { success: false, error: 'La franja solicitada solapa con una reserva existente.' };
  }

  const { fields, action } = extractPostFormData(threadHtml, targetThread.topicId);
  if (!fields || Object.keys(fields).length === 0) {
    logError(`No post form found in thread ${targetThread.topicId}`);
    log(`Thread HTML snippet: ${threadHtml.slice(2000, 3000)}`);
    return { success: false, error: 'No se pudo obtener el formulario de respuesta del foro.' };
  }

  log(`Post form fields found: ${JSON.stringify(Object.keys(fields))}`);
  log(`Post form action: ${action}`);

  const postBody = `Solicito reserva para el ${date} en la franja de ${startH}:${startM}-${endH}:${endM} para ${activity}.`;

  const postAction = action && !action.startsWith('http')
    ? (action.startsWith('/') ? `${client.baseUrl}${action}` : `${client.baseUrl}/${action}`)
    : '/index.php?action=post2';

  const postData = { ...fields, message: postBody };
  delete postData.message_editor;

  log(`POST to: ${postAction}`);
  log(`POST data keys: ${Object.keys(postData).join(', ')}`);
  log(`Message: "${postBody}"`);

  const postResp = await client.post(postAction, postData);
  log(`Post response status: ${postResp.status}`);
  log(`Post response headers:`, Object.fromEntries(postResp.headers.entries()));

  const postBodyResp = await postResp.text();
  log(`Post response body (first 1000 chars): ${postBodyResp.slice(0, 1000)}`);

  return { success: true };
}

async function postAnnouncement(client, date, startH, startM, endH, endM, activity, who) {
  try {
    const whoResp = await client.get(client.config.WHO);
    const whoHtml = await whoResp.text();

    const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const dateParts = date.match(/^(\d+)\/(\d+)\/(\d+)$/);
    if (!dateParts) return false;

    const dayNum = parseInt(dateParts[1]);
    const monthNum = parseInt(dateParts[2]) - 1;
    const yearNum = 2000 + parseInt(dateParts[3]);
    const d = new Date(yearNum, monthNum, dayNum);
    const dayName = dayNames[d.getDay()];
    const monthName = MONTHS_ES[monthNum];

    const whoTitle = `${dayName} ${dayNum} de ${monthName}`;
    log(`Looking for announcement thread: "${whoTitle}"`);

    const threads = findBoardThreads(whoHtml);
    log(`Found ${threads.length} threads in WHO board`);
    if (threads.length > 0) {
      log(`Thread titles:`, threads.slice(0, 5).map(t => `"${t.title}"`));
    }

    const whoThread = threads.find(t =>
      t.title.toLowerCase().includes(whoTitle.toLowerCase())
    );

    if (!whoThread) {
      warn(`No announcement thread found matching: "${whoTitle}"`);
      return false;
    }
    log(`Found announcement thread: "${whoThread.title}" (topic=${whoThread.topicId})`);

    const whoThreadUrl = resolveUrl(whoThread.href, client.baseUrl);
    const whoThreadResp = await client.get(whoThreadUrl);
    const whoThreadHtml = await whoThreadResp.text();

    const { fields, action } = extractPostFormData(whoThreadHtml, whoThread.topicId);
    if (!fields || Object.keys(fields).length === 0) {
      warn('Announcement: no post form found');
      return false;
    }

    const announceBody = `De ${startH}:${startM}-${endH}:${endM} estaremos con ${activity} las siguientes personas: ${who}.`;

    const postAction = action && !action.startsWith('http')
      ? (action.startsWith('/') ? `${client.baseUrl}${action}` : `${client.baseUrl}/${action}`)
      : '/index.php?action=post2';

    const postData = { ...fields, message: announceBody };
    delete postData.message_editor;

    console.warn(`Announcement POST to: ${postAction}`);
    console.warn(`Announcement data keys: ${Object.keys(postData).join(', ')}`);
    console.warn(`Announcement form fields:`, postData);

    const announceResp = await client.post(postAction, postData);
    const announceText = await announceResp.text();
    console.warn(`Announcement response status: ${announceResp.status}`);
    console.warn(`Announcement response body (first 1500 chars): ${announceText.slice(0, 1500)}`);

    if (announceResp.status !== 200 && announceResp.status !== 302) {
      console.warn('Announcement post appears to have failed');
      return false;
    }
    if (announceResp.status === 200 && announceText.includes('tu sesión')) {
      console.warn('Session expired - announcement not posted');
      return false;
    }
    return true;
  } catch (err) {
    logError('Announcement error:', err);
    return false;
  }
}

function resolveUrl(href, baseUrl) {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  const base = baseUrl.replace(/\/+$/, '');
  return href.startsWith('/') ? base + href : base + '/' + href;
}

function hasOverlap(rows, day, startH, startM, endH, endM) {
  const newStart = parseInt(startH) * 60 + parseInt(startM);
  const newEnd = parseInt(endH) * 60 + parseInt(endM);

  return rows.some(row => {
    const dayNum = parseInt(row.date.match(/\d+/)?.[0] || '0');
    if (dayNum !== parseInt(day)) return false;

    const timeMatch = row.time.match(/(\d+):(\d+)-(\d+):(\d+)/);
    if (!timeMatch) return false;

    const existingStart = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
    const existingEnd = parseInt(timeMatch[3]) * 60 + parseInt(timeMatch[4]);

    return newStart < existingEnd && newEnd > existingStart;
  });
}
