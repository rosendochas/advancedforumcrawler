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
  const daysParam = url.searchParams.get('days') || '';
  const announceError = url.searchParams.get('announce_error') || '';

  if (!daysParam) {
    return redirect('/calendar');
  }

  const config = CONFIG(env);
  const client = new ForumClient(env);
  client.setCookies(session.forumCookies);

  const months = groupDaysByMonth(daysParam);
  log(`Grouped days into ${months.length} month(s):`, months.map(m => `${MONTHS_ES[m.month - 1]} ${m.year}`));

  const bookingsData = {};

  for (const room of config.ROOMS) {
    try {
      const result = await fetchRoomBookingsMultiMonth(client, room, months, daysParam);
      bookingsData[room.name] = result;
    } catch (err) {
      if (err === SESSION_EXPIRED) {
        return redirect('/');
      }
      logError(`Error fetching room ${room.name}:`, err);
      bookingsData[room.name] = null;
    }
  }

  const html = bookingsPage(session.username, config.ROOMS, bookingsData, announceError, env.BUILD_VERSION);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function groupDaysByMonth(daysParam) {
  const map = {};
  for (const d of daysParam.split(',')) {
    const parts = d.match(/^(\d+)\/(\d+)\/(\d+)$/);
    if (!parts) continue;
    const day = parseInt(parts[1]);
    const month = parseInt(parts[2]);
    const year = 2000 + parseInt(parts[3]);
    const key = `${year}-${month}`;
    if (!map[key]) map[key] = { year, month, days: [] };
    map[key].days.push(day);
  }
  return Object.values(map);
}

async function fetchRoomBookingsMultiMonth(client, room, months, daysParam) {
  log(`Fetching board: ${room.name} (${room.url})`);
  const boardResp = await client.get(room.url);
  const boardHtml = await boardResp.text();

  if (isGuestPage(boardHtml)) throw SESSION_EXPIRED;

  const threads = findBoardThreads(boardHtml);
  log(`Board ${room.name}: found ${threads.length} threads`);

  let combinedRows = [];
  let hasMissing = false;

  for (const { year, month, days } of months) {
    const label = `${MONTHS_ES[month - 1]} ${year}`;
    log(`  Looking for thread: "${label}"`);

    const targetThread = threads.find(t =>
      t.title.toLowerCase().trim() === label.toLowerCase().trim()
    );

    if (!targetThread) {
      log(`  No thread found for "${label}"`);
      hasMissing = true;
      continue;
    }

    const threadUrl = resolveUrl(targetThread.href, client.baseUrl);
    const threadResp = await client.get(threadUrl);
    const threadHtml = await threadResp.text();

    if (isGuestPage(threadHtml)) throw SESSION_EXPIRED;

    const rows = parseBookingTable(threadHtml).map(r => {
      const dayNum = parseInt(r.date.match(/\d+/)?.[0] || '0');
      const dayNames = ['D','L','M','X','J','V','S'];
      const d = new Date(year, month - 1, dayNum);
      const dayLetter = dayNames[d.getDay()];
      const formattedDate = `${String(dayNum).padStart(2,'0')}/${String(month).padStart(2,'0')}/${String(year).slice(-2)} (${dayLetter})`;
      return { ...r, _dayNum: dayNum, _sortKey: year * 10000 + month * 100 + dayNum, formattedDate };
    });
    log(`  Thread "${label}": parsed ${rows.length} rows`);

    const filtered = rows.filter(row => days.includes(row._dayNum));
    log(`  Thread "${label}": ${filtered.length} rows match selected days`, days);
    if (filtered.length === 0 && rows.length > 0) {
      log(`  First 5 row dates:`, rows.slice(0, 5).map(r => r.date));
    }

    combinedRows.push(...filtered);
  }

  combinedRows.sort((a, b) => {
    if (a._sortKey !== b._sortKey) return a._sortKey - b._sortKey;
    const timeA = a.time.match(/^(\d+):(\d+)/);
    const timeB = b.time.match(/^(\d+):(\d+)/);
    if (timeA && timeB) {
      const minA = parseInt(timeA[1]) * 60 + parseInt(timeA[2]);
      const minB = parseInt(timeB[1]) * 60 + parseInt(timeB[2]);
      return minA - minB;
    }
    return 0;
  });

  if (combinedRows.length === 0 && hasMissing) {
    return { error: 'no-thread', days: daysParam };
  }

  return { rows: combinedRows, days: daysParam };
}

function resolveUrl(href, baseUrl) {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  const base = baseUrl.replace(/\/+$/, '');
  return href.startsWith('/') ? base + href : base + '/' + href;
}

function redirect(location) {
  return new Response(null, { status: 302, headers: { Location: location } });
}
