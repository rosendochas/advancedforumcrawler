export function layout(title, content, extraHead = '') {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Mecatol Foros</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f0f0; color: #222; min-height: 100vh; }
    .container { max-width: 900px; margin: 0 auto; padding: 20px; }
    .header { background: #1a3a5c; color: #fff; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; }
    .header h1 { font-size: 1.1rem; }
    .header .user-info { font-size: 0.9rem; color: #aac; }
    .btn { display: inline-block; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem; text-decoration: none; }
    .btn-primary { background: #1a3a5c; color: #fff; }
    .btn-primary:hover { background: #2a4a6c; }
    .btn-primary:disabled { background: #8a9aac; cursor: not-allowed; }
    .btn-danger { background: #c0392b; color: #fff; }
    .btn-danger:hover { background: #e74c3c; }
    .btn-secondary { background: #7f8c8d; color: #fff; }
    .btn-secondary:hover { background: #95a5a6; }
    .card { background: #fff; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.12); padding: 20px; margin-bottom: 16px; }
    .form-group { margin-bottom: 14px; }
    .form-group label { display: block; font-weight: 600; margin-bottom: 4px; font-size: 0.9rem; }
    .form-group input, .form-group select { width: 100%; padding: 8px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.95rem; }
    .form-group input:disabled { background: #eee; }
    .error { color: #c0392b; background: #fce4e4; padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; font-size: 0.9rem; }
    .loader-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .loader-overlay.hidden { display: none; }
    .spinner { width: 40px; height: 40px; border: 4px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .checkbox-group { display: flex; align-items: center; gap: 8px; }
    .checkbox-group input[type="checkbox"] { width: auto; }
    ${extraHead}
  </style>
</head>
<body>
  <div class="loader-overlay hidden" id="loader">
    <div class="spinner"></div>
  </div>
  ${content}
  <script>
    function showLoader() { document.getElementById('loader').classList.remove('hidden'); }
    function hideLoader() { document.getElementById('loader').classList.add('hidden'); }
    document.addEventListener('submit', function(e) {
      if (!e.target.classList.contains('no-loader')) showLoader();
    });
    let timeoutId = null;
    document.addEventListener('submit', function() {
      timeoutId = setTimeout(function() { hideLoader(); alert('La petición ha superado el tiempo máximo de espera.'); }, 15000);
    });
    document.addEventListener('DOMContentLoaded', function() {
      const forms = document.querySelectorAll('form');
      for (const form of forms) {
        form.addEventListener('submit', function() {
          timeoutId = setTimeout(function() { hideLoader(); alert('La petición ha superado el tiempo máximo de espera.'); }, 15000);
        });
      }
    });
    window.loaderDone = function() { clearTimeout(timeoutId); hideLoader(); };
  </script>
</body>
</html>`;
}

export function loginPage(error = '') {
  const errorHtml = error ? `<div class="error">${error}</div>` : '';
  return layout('Identificarse', `
    <div class="container" style="max-width: 400px; margin-top: 80px;">
      <div class="card">
        <h2 style="margin-bottom: 20px;">Identificarse en los foros</h2>
        ${errorHtml}
        <form method="POST" action="/login">
          <div class="form-group">
            <label for="email">Email o nombre de usuario</label>
            <input type="text" id="email" name="email" required placeholder="tu@email.com o usuario">
          </div>
          <div class="form-group">
            <label for="password">Contraseña</label>
            <input type="password" id="password" name="password" required>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;">Identificarse</button>
        </form>
      </div>
    </div>
  `);
}

export function calendarPage(username, year, months, selectedDays) {
  const daysList = selectedDays.length
    ? selectedDays.map(d => `<li>${d}</li>`).join('')
    : '<li style="color:#888;">Ningún día seleccionado</li>';

  return layout('Calendario', `
    <div class="header">
      <div>
        <h1>Mecatol Foros</h1>
        <span class="user-info">Suplantando a: ${username}</span>
      </div>
      <a href="/logout" class="btn btn-danger">Cerrar sesión</a>
    </div>
    <div class="container">
      <div class="card">
        <form method="GET" action="/bookings" id="calendar-form">
          <div class="form-group" style="display:flex;gap:12px;">
            <div style="flex:1;">
              <label for="year">Año</label>
              <select id="year" name="year">
                <option value="${year}" selected>${year}</option>
                <option value="${year + 1}">${year + 1}</option>
              </select>
            </div>
            <div style="flex:1;">
              <label for="month">Mes</label>
              <select id="month" name="month">
                ${months.map(m => `<option value="${m.value}" ${m.selected ? 'selected' : ''}>${m.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Días</label>
            <div id="calendar-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;"></div>
          </div>
          <div class="form-group">
            <label>Días seleccionados</label>
            <ul id="selected-days-list" style="list-style:none;padding:0;">${daysList}</ul>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn btn-secondary" id="clear-btn" ${selectedDays.length ? '' : 'disabled'}>Limpiar selección</button>
            <button type="submit" class="btn btn-primary" id="consult-btn" ${selectedDays.length ? '' : 'disabled'}>Consultar reservas</button>
          </div>
        </form>
      </div>
    </div>
    <script>
      const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const dayHeaders = ['L','M','X','J','V','S','D'];
      let selectedDays = ${JSON.stringify(selectedDays)};
      let currentYear = ${year};
      let currentMonth = parseInt(document.getElementById('month').value);
      let userPosts = {};

      function renderCalendar() {
        const grid = document.getElementById('calendar-grid');
        grid.innerHTML = '';
        dayHeaders.forEach(d => { const div = document.createElement('div'); div.textContent = d; div.style.fontWeight = 'bold'; div.style.padding = '4px'; grid.appendChild(div); });
        const firstDay = new Date(currentYear, currentMonth - 1, 1);
        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
        const startOffset = (firstDay.getDay() + 6) % 7;
        const today = new Date();
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        for (let i = 0; i < startOffset; i++) { const div = document.createElement('div'); grid.appendChild(div); }
        for (let day = 1; day <= daysInMonth; day++) {
          const div = document.createElement('div');
          div.style.padding = '6px 8px 4px';
          div.style.borderRadius = '4px';
          div.style.cursor = 'pointer';
          div.style.display = 'flex';
          div.style.flexDirection = 'column';
          div.style.alignItems = 'center';
          const daySpan = document.createElement('span');
          daySpan.textContent = day;
          div.appendChild(daySpan);
          const dateStr = String(day).padStart(2,'0') + '/' + String(currentMonth).padStart(2,'0') + '/' + String(currentYear).slice(-2);
          const cellDate = new Date(currentYear, currentMonth - 1, day);
          if (cellDate < todayDate && currentYear === today.getFullYear() && currentMonth === today.getMonth() + 1) {
            div.style.background = '#e0e0e0';
            div.style.color = '#aaa';
            div.style.cursor = 'not-allowed';
          } else {
            if (selectedDays.includes(dateStr)) {
              div.style.background = '#3498db';
              div.style.color = '#fff';
            } else {
              div.style.background = '#e0e0e0';
              div.style.color = '#333';
            }
            div.addEventListener('click', function() {
              const idx = selectedDays.indexOf(dateStr);
              if (idx === -1) { selectedDays.push(dateStr); selectedDays.sort(); }
              else { selectedDays.splice(idx, 1); }
              renderCalendar();
              updateSelectedList();
            });
          }
          if (userPosts[day] && !(cellDate < todayDate && currentYear === today.getFullYear() && currentMonth === today.getMonth() + 1)) {
            const dot = document.createElement('span');
            dot.style.display = 'block';
            dot.style.width = '6px';
            dot.style.height = '6px';
            dot.style.borderRadius = '50%';
            dot.style.marginTop = '2px';
            dot.style.background = userPosts[day].announcement ? '#2ecc71' : '#e67e22';
            div.appendChild(dot);
          }
          grid.appendChild(div);
        }
      }

      async function fetchUserPosts() {
        try {
          const resp = await fetch('/user-posts?year=' + currentYear + '&month=' + currentMonth);
          if (resp.ok) {
            userPosts = await resp.json();
            renderCalendar();
          }
        } catch {}
      }

      function updateSelectedList() {
        const list = document.getElementById('selected-days-list');
        list.innerHTML = selectedDays.length ? selectedDays.map(d => '<li>' + d + '</li>').join('') : '<li style="color:#888;">Ningún día seleccionado</li>';
        document.getElementById('clear-btn').disabled = selectedDays.length === 0;
        document.getElementById('consult-btn').disabled = selectedDays.length === 0;
      }

      document.getElementById('clear-btn').addEventListener('click', function() {
        selectedDays = [];
        renderCalendar();
        updateSelectedList();
      });

      document.getElementById('year').addEventListener('change', function() {
        currentYear = parseInt(this.value);
        updateMonthOptions();
        fetchUserPosts();
      });

      document.getElementById('month').addEventListener('change', function() {
        currentMonth = parseInt(this.value);
        renderCalendar();
        fetchUserPosts();
      });

      function updateMonthOptions() {
        const monthSel = document.getElementById('month');
        const currentVal = monthSel.value;
        monthSel.innerHTML = '';
        const today = new Date();
        const startMonth = (currentYear === today.getFullYear()) ? today.getMonth() + 1 : 1;
        for (let m = startMonth; m <= 12; m++) {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = monthNames[m - 1];
          if (m === parseInt(currentVal)) opt.selected = true;
          monthSel.appendChild(opt);
        }
        currentMonth = parseInt(monthSel.value);
        renderCalendar();
      }

      document.getElementById('calendar-form').addEventListener('submit', function(e) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'days';
        input.value = selectedDays.join(',');
        this.appendChild(input);
      });

      renderCalendar();
      fetchUserPosts();
    </script>
  `);
}

export function bookingsPage(username, rooms, bookingsData, announceError = '') {
  let roomsHtml = '';
  for (const room of rooms) {
    const data = bookingsData[room.name];
    let sectionContent = '';
    if (!data) {
      sectionContent = '<p style="color:#888;">Sin reservas</p>';
    } else if (data.error === 'no-thread') {
      sectionContent = '<p style="color:#888;">Aún no hay hilo para el mes seleccionado</p>';
    } else if (data.rows && data.rows.length) {
      let rowsHtml = data.rows.map(r => `
        <tr>
          <td>${r.date}</td>
          <td>${r.time}</td>
          <td>${r.user}</td>
          <td>${r.activity}</td>
        </tr>
      `).join('');
      sectionContent = `<table style="width:100%;border-collapse:collapse;">
        <thead><tr><th style="text-align:left;padding:6px;border-bottom:2px solid #ddd;">Fecha</th><th style="text-align:left;padding:6px;border-bottom:2px solid #ddd;">Hora</th><th style="text-align:left;padding:6px;border-bottom:2px solid #ddd;">Usuario</th><th style="text-align:left;padding:6px;border-bottom:2px solid #ddd;">Actividad</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;
    } else {
      sectionContent = '<p style="color:#888;">Sin reservas</p>';
    }

    roomsHtml += `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3>${room.name} <a href="${room.url}" target="_blank" style="font-size:0.8rem;font-weight:normal;">(tablón original)</a></h3>
          <a href="/reserve?room=${encodeURIComponent(room.name)}&days=${encodeURIComponent(data?.days || '')}" class="btn btn-primary">Reservar</a>
        </div>
        ${sectionContent}
      </div>
    `;
  }

  const announceModal = announceError ? `
    <div id="announce-modal" class="modal-overlay">
      <div class="modal">
        <h3>Aviso</h3>
        <p>${announceError}</p>
        <button class="btn btn-primary" onclick="document.getElementById('announce-modal').classList.add('hidden')">Aceptar</button>
      </div>
    </div>
    <style>
      .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; }
      .modal-overlay.hidden { display: none; }
      .modal { background: #fff; border-radius: 8px; padding: 24px; max-width: 480px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
      .modal h3 { margin-bottom: 12px; }
      .modal p { margin-bottom: 16px; line-height: 1.4; }
    </style>
  ` : '';

  return layout('Reservas', `
    <div class="header">
      <div>
        <h1>Mecatol Foros</h1>
        <span class="user-info">Suplantando a: ${username}</span>
      </div>
      <a href="/calendar" class="btn btn-secondary">Volver al calendario</a>
    </div>
    <div class="container">
      ${roomsHtml}
    </div>
    ${announceModal}
  `);
}

export function reservePage(username, room, days, formData, error) {
  const errorHtml = error ? `<div class="error">${error}</div>` : '';
  const dayOptions = days.split(',').map(d => `<option value="${d.trim()}">${d.trim()}</option>`).join('');

  return layout('Reservar', `
    <div class="header">
      <div>
        <h1>Mecatol Foros</h1>
        <span class="user-info">Suplantando a: ${username}</span>
      </div>
      <a href="/bookings?days=${encodeURIComponent(days)}" class="btn btn-secondary">Volver</a>
    </div>
    <div class="container">
      <div class="card">
        <h2 style="margin-bottom:16px;">Reservar en ${room}</h2>
        ${errorHtml}
        <form method="POST" action="/reserve">
          <input type="hidden" name="room" value="${room}">
          <input type="hidden" name="days" value="${days}">
          <div class="form-group">
            <label for="date">Fecha</label>
            <select id="date" name="date" required>
              <option value="">Seleccionar día</option>
              ${dayOptions}
            </select>
          </div>
          <div style="display:flex;gap:12px;">
            <div class="form-group" style="flex:1;">
              <label for="start_hours">Hora inicio (horas)</label>
              <select id="start_hours" name="start_hours">${hoursOptions(formData?.startHours)}</select>
            </div>
            <div class="form-group" style="flex:1;">
              <label for="start_minutes">Hora inicio (minutos)</label>
              <select id="start_minutes" name="start_minutes">${minutesOptions(formData?.startMinutes)}</select>
            </div>
          </div>
          <div style="display:flex;gap:12px;">
            <div class="form-group" style="flex:1;">
              <label for="end_hours">Hora fin (horas)</label>
              <select id="end_hours" name="end_hours">${hoursOptions(formData?.endHours)}</select>
            </div>
            <div class="form-group" style="flex:1;">
              <label for="end_minutes">Hora fin (minutos)</label>
              <select id="end_minutes" name="end_minutes">${minutesOptions(formData?.endMinutes)}</select>
            </div>
          </div>
          <div class="form-group">
            <label for="activity">Actividad</label>
            <input type="text" id="activity" name="activity" required maxlength="200" placeholder="Nombre de la actividad">
          </div>
          <div class="form-group checkbox-group">
            <input type="checkbox" id="announce" name="announce" value="1">
            <label for="announce" style="margin:0;">Anunciar</label>
          </div>
          <div class="form-group">
            <label for="who">Quienes</label>
            <input type="text" id="who" name="who" disabled placeholder="Nombres de los asistentes">
          </div>
          <button type="submit" class="btn btn-primary">Reservar</button>
        </form>
      </div>
    </div>
    <script>
      const announceCheck = document.getElementById('announce');
      const whoField = document.getElementById('who');
      announceCheck.addEventListener('change', function() {
        whoField.disabled = !this.checked;
        if (!this.checked) { whoField.value = ''; whoField.required = false; }
        else { whoField.required = true; }
      });
      const startH = document.getElementById('start_hours');
      const startM = document.getElementById('start_minutes');
      const endH = document.getElementById('end_hours');
      const endM = document.getElementById('end_minutes');
      function updateEndHours() {
        const sh = parseInt(startH.value) || 0;
        const eh = Math.min(sh + 4, 23);
        endH.value = eh;
      }
      startH.addEventListener('change', updateEndHours);
      startM.addEventListener('change', function() { endM.value = this.value; });
    </script>
  `);
}

function hoursOptions(selected) {
  const s = selected !== undefined ? parseInt(selected) : new Date().getHours();
  return Array.from({ length: 24 }, (_, i) =>
    `<option value="${String(i).padStart(2, '0')}" ${i === s ? 'selected' : ''}>${String(i).padStart(2, '0')}</option>`
  ).join('');
}

function minutesOptions(selected) {
  const now = new Date();
  const m = Math.round(now.getMinutes() / 15) * 15;
  const s = selected !== undefined ? parseInt(selected) : (m >= 60 ? 0 : m);
  return ['00', '15', '30', '45'].map(v =>
    `<option value="${v}" ${v === String(s).padStart(2, '0') ? 'selected' : ''}>${v}</option>`
  ).join('');
}
