import { bookingsPage } from '../lib/templates.js';
import { getSession } from '../lib/session.js';
import { ForumClient } from '../lib/forum-client.js';
import { CONFIG } from '../lib/config.js';
import { findBoardThreads, parseBookingTable, isGuestPage } from '../lib/scraper.js';
import { log, error as logError } from '../lib/logger.js';

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const SESSION_EXPIRED = Symbol('SESSION_EXPIRED');

export async function handleBookings(request, env) {
  const session = await getSession(request, env);
  if (!session.forumCookies || !session.username) {
    return redirect('/');
  }

  const url = new URL(request.url);
  const year = url.searchParams.get('year');
  const month = url.searchParams.get('month');
  const daysParam = url.searchParams.get('days') || '';
  const announceError = url.searchParams.get('announce_error') || '';

  if (!year || !month || !daysParam) {
    return redirect('/calendar');
  }

  const config = CONFIG(env);
  const client = new ForumClient(env);
  client.setCookies(session.forumCookies);

  const monthYearLabel = `${MONTHS_ES[parseInt(month) - 1]} ${year}`;
  log(`Looking for threads matching: "${monthYearLabel}"`);
  const bookingsData = {};

  for (const room of config.ROOMS) {
    try {
      const result = await fetchRoomBookings(client, room, monthYearLabel, daysParam);
      bookingsData[room.name] = result;
    } catch (err) {
      if (err === SESSION_EXPIRED) {
        return redirect('/');
      }
      logError(`Error fetching room ${room.name}:`, err);
      bookingsData[room.name] = null;
    }
  }

  const html = bookingsPage(session.username, config.ROOMS, bookingsData, announceError);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function fetchRoomBookings(client, room, monthYearLabel, daysParam) {
  log(`Fetching board: ${room.name} (${room.url})`);
  const boardResp = await client.get(room.url);
  const boardHtml = await boardResp.text();
  log(`Board ${room.name}: status=${boardResp.status}, length=${boardHtml.length}`);

  if (isGuestPage(boardHtml)) throw SESSION_EXPIRED;

  const threads = findBoardThreads(boardHtml);
  log(`Board ${room.name}: found ${threads.length} threads`);
  if (threads.length > 0) {
    log(`Board ${room.name}: first 3 thread titles:`, threads.slice(0, 3).map(t => `"${t.title}"`));
  }

  const targetThread = threads.find(t => {
    const match = t.title.toLowerCase().trim() === monthYearLabel.toLowerCase().trim();
    return match;
  });

  if (!targetThread) {
    log(`Board ${room.name}: no thread found matching "${monthYearLabel}"`);
    return { error: 'no-thread', days: daysParam };
  }

  log(`Board ${room.name}: found thread "${targetThread.title}" (topic=${targetThread.topicId})`);

  const threadUrl = resolveUrl(targetThread.href, client.baseUrl);
  log(`Board ${room.name}: fetching thread URL: ${threadUrl}`);

  const threadResp = await client.get(threadUrl);
  const threadHtml = await threadResp.text();
  log(`Thread ${room.name}: status=${threadResp.status}, length=${threadHtml.length}`);

  if (isGuestPage(threadHtml)) throw SESSION_EXPIRED;

  const allRows = parseBookingTable(threadHtml);
  log(`Thread ${room.name}: parsed ${allRows.length} rows from table`);
  if (allRows.length > 0) {
    log(`Thread ${room.name}: first row:`, allRows[0]);
  }

  const filteredRows = filterRowsBySelectedDays(allRows, daysParam);
  log(`Thread ${room.name}: ${filteredRows.length} rows after day filter`);

  return { rows: filteredRows, days: daysParam };
}

function resolveUrl(href, baseUrl) {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  const base = baseUrl.replace(/\/+$/, '');
  return href.startsWith('/') ? base + href : base + '/' + href;
}

function filterRowsBySelectedDays(rows, daysParam) {
  if (!rows.length || !daysParam) return rows;
  const selectedDays = daysParam.split(',').map(d => d.trim());
  return rows.filter(row => {
    const dayNum = parseInt(row.date.match(/\d+/)?.[0] || '0');
    const dayStr = String(dayNum).padStart(2, '0');
    return selectedDays.some(sd => sd.startsWith(dayStr));
  });
}

function redirect(location) {
  return new Response(null, { status: 302, headers: { Location: location } });
}
