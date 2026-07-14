export function extractUsernameFromProfile(html) {
  // SMF 2.1: <title>Perfil de rudesindus</title>
  const titleMatch = html.match(/<title>(?:Perfil de|Profile of)\s+([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();
  const rawTitleMatch = html.match(/<title>([^<]+)<\/title>/i);
  return rawTitleMatch ? rawTitleMatch[1].trim() : null;
}

export function parseLoginResponse(html) {
  if (/class="error"/.test(html) || /mensaje de error/i.test(html)) {
    return { success: false };
  }
  const text = html.replace(/<[^>]*>/g, '');
  if (/Bienvenido,\s*Invitado/i.test(text)) {
    return { success: false };
  }
  const memberIdMatch = html.match(/var\s+smf_member_id\s*=\s*(\d+)/);
  if (memberIdMatch && memberIdMatch[1] !== '0') {
    return { success: true };
  }
  return { success: false };
}

export function isGuestPage(html) {
  return /class="guest"/.test(html) || /Bienvenido,\s*Invitado/i.test(html);
}

export function extractUsername(html) {
  return extractUsernameFromText(html);
}

export function extractScToken(html) {
  const match = html.match(/name="sc"[^>]*value="([^"]+)"/i);
  if (match) return match[1];
  const matches = html.match(/name="([a-f0-9]+)"[^>]*value="([a-f0-9]+)"/i);
  return matches ? matches[2] : null;
}

export function extractSessionVars(html) {
  const scMatch = html.match(/name="sc"[^>]*value="([^"]+)"/i);
  const seqnumMatch = html.match(/name="seqnum"[^>]*value="([^"]+)"/i);
  if (scMatch || seqnumMatch) {
    return { sc: scMatch ? scMatch[1] : null, seqnum: seqnumMatch ? seqnumMatch[1] : null };
  }
  const hiddenInputs = extractHiddenInputs(html);
  return { sc: hiddenInputs.sc || null, seqnum: hiddenInputs.seqnum || null, _fields: hiddenInputs };
}

export function extractHiddenInputs(html) {
  const inputs = {};
  const regex = /<input[^>]*type="hidden"[^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const nameMatch = match[0].match(/name="([^"]+)"/i);
    const valueMatch = match[0].match(/value="([^"]*)"/i);
    if (nameMatch) {
      inputs[nameMatch[1]] = valueMatch ? valueMatch[1] : '';
    }
  }
  return inputs;
}

export function extractLoginFormData(html) {
  const formMatch = html.match(/<form[^>]*action="[^>]*action=login2[^"]*"[^>]*>([\s\S]*?)<\/form>/i);
  if (!formMatch) return {};
  return extractHiddenInputs(formMatch[0]);
}

export function extractPostFormData(html, topicId) {
  const formMatch = html.match(/<form[^>]*action="[^"]*action=post2[^"]*"[^>]*>([\s\S]*?)<\/form>/i);
  if (!formMatch) return { fields: {}, action: null };

  const fields = extractHiddenInputs(formMatch[0]);

  if (!fields.topic) {
    const topicInput = formMatch[0].match(/<input[^>]*name="topic"[^>]*value="(\d+)"[^>]*>/i);
    if (topicInput) fields.topic = topicInput[1];
  }

  if (topicId && (!fields.topic || fields.topic !== String(topicId))) {
    fields.topic = String(topicId);
  }

  const actionMatch = formMatch[0].match(/action="([^"]+)"/i);
  const action = actionMatch ? actionMatch[1] : null;

  return { fields, action };
}

export function findBoardThreads(html) {
  const threads = [];
  const linkRegex = /<a[^>]*href="([^"]*topic=(\d+)(?:\.(\d+))?[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const topicId = match[2];
    const msgPart = match[3];
    const linkText = match[4].replace(/<[^>]*>/g, '').trim();

    if (!linkText || linkText.length < 2) continue;
    if (msgPart !== undefined && msgPart !== '0') continue;

    const tagEnd = match[0].indexOf('>');
    const openingTag = tagEnd > -1 ? match[0].slice(0, tagEnd) : '';
    if (/\bclass\s*=\s*"[^"]*\bnew_posts\b[^"]*"/i.test(openingTag)) continue;

    if (!threads.find(t => t.topicId === topicId)) {
      threads.push({ title: linkText, href, topicId });
    }
  }
  return threads;
}

export function parseBookingTable(html) {
  const rows = [];

  let tableHtml = null;
  const classMatch = html.match(/<table[^>]*class="[^"]*bbc_table[^"]*"[\s\S]*?<\/table>/i);
  if (classMatch) {
    tableHtml = classMatch[0];
  } else {
    const genericMatch = html.match(/<table[\s\S]*?<\/table>/i);
    if (genericMatch && /\b(Fecha|Hora|Usuario|Actividad)\b/i.test(genericMatch[0])) {
      tableHtml = genericMatch[0];
    }
  }

  if (!tableHtml) return rows;

  const cleanedHtml = tableHtml.replace(/<thead>|<\/thead>|<tbody>|<\/tbody>/gi, '');
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(cleanedHtml)) !== null) {
    const trHtml = trMatch[1];
    const cells = [];

    const tdRegex = /<t[dh][^>]*>(?:<b>|<strong>)?\s*([\s\S]*?)\s*(?:<\/b>|<\/strong>)?<\/t[dh]>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(trHtml)) !== null) {
      const cellText = tdMatch[1].replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
      if (cellText || cells.length > 0) {
        cells.push(cellText);
      }
    }

    if (cells.length < 3) continue;

    const allHeaders = /^(Fecha|Hora|Usuario|Actividad)$/i;
    if (cells.some(c => allHeaders.test(c))) continue;

    const textCells = cells.filter(c => c.length > 0);
    if (textCells.length < 2) continue;

    const date = textCells[0] || '';
    const second = textCells.length >= 2 ? textCells[1] || '' : '';
    const third = textCells.length >= 3 ? textCells[2] || '' : '';
    const fourth = textCells.length >= 4 ? textCells[3] || '' : '';

    if (/^\d+:\d+-\d+:\d+$/.test(second)) {
      rows.push({ date, time: second, user: third, activity: fourth });
    } else if (/^\d+:\d+-\d+:\d+$/.test(third) && textCells.length >= 3) {
      rows.push({ date: `${date} ${second}`, time: third, user: fourth, activity: textCells.length >= 5 ? textCells[4] : '' });
    } else {
      rows.push({ date, time: second, user: third, activity: fourth });
    }
  }

  return rows;
}

const ES_MONTHS = {
  'enero':1,'febrero':2,'marzo':3,'abril':4,'mayo':5,'junio':6,
  'julio':7,'agosto':8,'septiembre':9,'octubre':10,'noviembre':11,'diciembre':12
};
const EN_MONTHS = {
  'jan':1,'feb':2,'mar':3,'apr':4,'may':5,'jun':6,
  'jul':7,'aug':8,'sep':9,'oct':10,'nov':11,'dec':12
};

export function parseSMFDate(dateStr) {
  const m = dateStr.match(/^(\w+)\s+(\d+),\s+(\d{4})/);
  if (!m) return null;
  const month = EN_MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  return { year: parseInt(m[3]), month, day: parseInt(m[2]) };
}

function extractDateFromSubject(subject) {
  const m = subject.match(/^Re:\w+\s+(\d+)\s+(?:de\s+)?(\w+?)(?:\s+del?\s+(\d{4}))?\s*$/i);
  if (!m) return null;
  const month = ES_MONTHS[m[2].toLowerCase().replace(/[\.]$/, '')];
  if (!month) return null;
  return { day: parseInt(m[1]), month, year: m[3] ? parseInt(m[3]) : null };
}

function extractDatesFromReservationBody(bodyText, pubDate) {
  const dates = [];
  const cleaned = bodyText.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();

  const withMonth = /(?:para|reserva[:\s])\s*(?:el|la|)\s*(?:\w+\s+)?(\d+)\s+de\s+(\w+)/gi;
  let m;
  while ((m = withMonth.exec(cleaned)) !== null) {
    const month = ES_MONTHS[m[2].toLowerCase()];
    if (month) dates.push({ day: parseInt(m[1]), month, year: null });
  }

  if (dates.length === 0) {
    const dayOnly = cleaned.match(/(?:para\s+(?:el|la|)\s*(?:\w+\s+)?|^reserva[:\s]+)(\d+)\s+de\s+/i);
    if (dayOnly) {
      dates.push({ day: parseInt(dayOnly[1]), month: pubDate.month, year: pubDate.year });
    }
  }

  return dates.map(d => ({ day: d.day, month: d.month, year: d.year || pubDate.year }));
}

export function parseUserPostsPage(html) {
  const posts = [];
  const blocks = html.split(/<div class="windowbg">/);
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const topicMatch = block.match(/<div class="topic_details">([\s\S]*?)<\/div>/);
    if (!topicMatch) continue;

    const boardMatch = topicMatch[1].match(/<a[^>]*href="[^"]*board=(\d+)[^"]*"[^>]*>([^<]*)<\/a>/);
    const subjectMatch = topicMatch[1].match(/<a[^>]*href="[^"]*topic=\d+\.msg\d+#msg\d+[^"]*"[^>]*>([^<]*)<\/a>/);
    if (!boardMatch || !subjectMatch) continue;

    const dateMatch = block.match(/<span class="smalltext">([^<]*)<\/span>/);
    const bodyMatch = block.match(/<div class="post">[\s\S]*?<div class="inner">([\s\S]*?)<\/div>/);
    const bodyText = bodyMatch ? bodyMatch[1].replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim() : '';

    const pubDate = dateMatch ? parseSMFDate(dateMatch[1].trim()) : null;
    if (!pubDate) continue;

    posts.push({
      boardId: boardMatch[1],
      boardName: boardMatch[2].trim(),
      subject: subjectMatch[1].trim(),
      pubDate,
      bodyText,
    });
  }
  return posts;
}

export function classifyPostDates(posts, whoBoardId, roomBoardIds) {
  const reservations = {};
  const announcements = {};

  for (const post of posts) {
    if (post.boardId === whoBoardId) {
      const d = extractDateFromSubject(post.subject);
      if (d) announcements[`${d.day}-${d.month}`] = true;
    } else if (roomBoardIds.includes(post.boardId)) {
      const dates = extractDatesFromReservationBody(post.bodyText, post.pubDate);
      for (const d of dates) {
        reservations[`${d.day}-${d.month}`] = true;
      }
    }
  }

  return { reservations, announcements };
}

export function extractBoardId(url) {
  const m = url.match(/board=(\d+)/);
  return m ? m[1] : null;
}
