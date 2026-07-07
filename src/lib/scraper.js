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
