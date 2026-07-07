import { calendarPage } from '../lib/templates.js';
import { getSession } from '../lib/session.js';

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export async function handleCalendar(request, env) {
  const session = await getSession(request, env);
  if (!session.forumCookies || !session.username) {
    return new Response(null, { status: 302, headers: { Location: '/' } });
  }

  const now = new Date();
  const currentYear = now.getFullYear();

  const url = new URL(request.url);
  const selectedYear = parseInt(url.searchParams.get('year')) || currentYear;
  const selectedMonth = parseInt(url.searchParams.get('month')) || now.getMonth() + 1;
  const daysParam = url.searchParams.get('days') || '';
  const selectedDays = daysParam ? daysParam.split(',').filter(Boolean) : [];

  const months = generateMonthOptions(selectedYear, now, selectedMonth);

  const html = calendarPage(session.username, selectedYear, months, selectedDays, env.BUILD_VERSION);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function generateMonthOptions(year, now, selectedMonth) {
  const months = [];
  const startMonth = year === now.getFullYear() ? now.getMonth() + 1 : 1;

  for (let m = startMonth; m <= 12; m++) {
    months.push({
      value: m,
      label: MONTHS_ES[m - 1],
      selected: m === selectedMonth,
    });
  }
  return months;
}
