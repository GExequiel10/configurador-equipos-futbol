/**
 * ============================================================
 * FUTBOLAPP – app.js
 * Organizador de partidos de fútbol entre amigos
 * Vanilla JS, sin dependencias externas
 * Persistencia: localStorage
 * ============================================================
 */

'use strict';

/* ============================================================
   ESTADO GLOBAL DE LA APLICACIÓN
   ============================================================ */
const App = {
  // Datos persistidos en localStorage
  players: [],        // Array de objetos { id, name, level }
  matchInfo: {        // Datos del partido
    place: '',
    date: '',
    time: '',
    notes: ''
  },
  teams: {            // Equipos generados (array dinámico de arrays)
    list: []          // [ [jugadores equipo 1], [jugadores equipo 2], ... ]
  },
  expenses: {         // Calculadora de gastos
    total: 0,
    currency: 'ARS',
    excluded: []      // IDs de jugadores excluidos del pago
  },
  history: [],        // Historial de partidos guardados

  // Estado de UI (no persistido)
  selectedLevel: 3,
  teamsGenerated: false,
  editMode: false,
  numTeams: 3,        // Cantidad de equipos a generar
};

/* ============================================================
   CLAVES DE LOCALSTORAGE
   ============================================================ */
const STORAGE_KEYS = {
  PLAYERS: 'futbolapp_players',
  MATCH:   'futbolapp_match',
  TEAMS:   'futbolapp_teams',
  EXPENSES:'futbolapp_expenses',
  HISTORY: 'futbolapp_history',
};

/* ============================================================
   UTILIDADES DE LOCALSTORAGE
   ============================================================ */

/** Guarda un valor en localStorage con la clave dada. */
function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Error guardando en localStorage:', e);
  }
}

/** Lee y parsea un valor de localStorage. Retorna null si no existe. */
function loadFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Error leyendo localStorage:', e);
    return null;
  }
}

/** Carga todos los datos persistidos al iniciar la app. */
function loadAllData() {
  App.players  = loadFromStorage(STORAGE_KEYS.PLAYERS)  || [];
  App.matchInfo= loadFromStorage(STORAGE_KEYS.MATCH)    || { place:'', date:'', time:'', notes:'' };
  App.teams    = loadFromStorage(STORAGE_KEYS.TEAMS)    || { list: [] };
  App.expenses = loadFromStorage(STORAGE_KEYS.EXPENSES) || { total:0, currency:'ARS', excluded:[] };
  App.history  = loadFromStorage(STORAGE_KEYS.HISTORY)  || [];

  // Migrar formato viejo (team1/team2) al nuevo (list)
  if (App.teams.team1 !== undefined) {
    App.teams = { list: [App.teams.team1 || [], App.teams.team2 || []] };
    saveToStorage(STORAGE_KEYS.TEAMS, App.teams);
  }

  // Si había equipos guardados, marcar como generados
  if (App.teams.list && App.teams.list.some(t => t.length > 0)) {
    App.teamsGenerated = true;
    App.numTeams = App.teams.list.length;
  }
}

/* ============================================================
   GENERADOR DE IDs ÚNICOS
   ============================================================ */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
let toastTimeout = null;

/**
 * Muestra un mensaje toast en la pantalla.
 * @param {string} message - Texto del mensaje
 * @param {'success'|'error'|'info'} type - Tipo de toast
 * @param {number} duration - Duración en ms (por defecto 2500)
 */
function showToast(message, type = 'success', duration = 2500) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  // Limpiar timeout anterior
  if (toastTimeout) clearTimeout(toastTimeout);

  // Resetear clases
  toast.className = 'toast';
  toast.textContent = message;

  // Agregar tipo y mostrar
  void toast.offsetWidth; // Forzar reflow para reiniciar animación
  toast.classList.add('show', `toast--${type}`);

  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

/* ============================================================
   MODAL DE CONFIRMACIÓN
   ============================================================ */
let modalResolve = null;

/**
 * Muestra un modal de confirmación y devuelve una promesa.
 * @param {string} title
 * @param {string} body
 * @returns {Promise<boolean>}
 */
function showConfirm(title, body) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').textContent = body;
    overlay.style.display = 'flex';
    modalResolve = resolve;
  });
}

function closeModal(result) {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = 'none';
  if (modalResolve) {
    modalResolve(result);
    modalResolve = null;
  }
}

/* ============================================================
   SISTEMA DE TABS
   ============================================================ */
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  // Desactivar todos los tabs y contenidos
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.tab-content').forEach(section => {
    section.classList.remove('active');
  });

  // Activar el seleccionado
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  const content = document.getElementById(`tab-${tabId}`);

  if (btn) {
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
  }
  if (content) {
    content.classList.add('active');
  }

  // Actualizar vistas según el tab
  if (tabId === 'gastos')   renderPayersList();
  if (tabId === 'equipos')  renderTeams();
  if (tabId === 'historial') renderHistory();
  if (tabId === 'partido')   renderMatchSummary();
}

/* ============================================================
   MÓDULO: JUGADORES
   ============================================================ */

/** Renderiza la lista de jugadores en el DOM. */
function renderPlayers() {
  const listEl   = document.getElementById('players-list');
  const emptyEl  = document.getElementById('empty-players');
  const countEl  = document.getElementById('total-count');

  // Actualizar contador
  const count = App.players.length;
  countEl.textContent = `${count} jugador${count !== 1 ? 'es' : ''}`;

  // Limpiar lista (excepto el empty state)
  const existingItems = listEl.querySelectorAll('.player-item');
  existingItems.forEach(el => el.remove());

  if (count === 0) {
    emptyEl.style.display = 'flex';
    return;
  }

  emptyEl.style.display = 'none';

  // Renderizar cada jugador
  App.players.forEach((player, index) => {
    const item = document.createElement('div');
    item.className = 'player-item';
    item.dataset.playerId = player.id;

    item.innerHTML = `
      <span class="player-number">${index + 1}</span>
      <span class="player-name">${escapeHtml(player.name)}</span>
      <div class="player-level-display">
        <span class="level-badge level-${player.level}">${player.level}</span>
      </div>
      <button class="delete-player-btn" data-id="${player.id}" title="Eliminar jugador" aria-label="Eliminar a ${escapeHtml(player.name)}">✕</button>
    `;

    listEl.appendChild(item);
  });

  // Delegar eventos de eliminación
  listEl.querySelectorAll('.delete-player-btn').forEach(btn => {
    btn.addEventListener('click', () => deletePlayer(btn.dataset.id));
  });
}

/** Agrega un jugador nuevo a la lista. */
function addPlayer() {
  const nameInput  = document.getElementById('player-name-input');
  const name       = nameInput.value.trim();
  const level      = App.selectedLevel;

  // Validación
  if (!name) {
    showToast('Escribí el nombre del jugador', 'error');
    nameInput.focus();
    return;
  }

  if (name.length < 2) {
    showToast('El nombre debe tener al menos 2 caracteres', 'error');
    return;
  }

  // Verificar duplicados (case-insensitive)
  const duplicate = App.players.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    showToast(`"${name}" ya está en la lista`, 'error');
    return;
  }

  // Crear y guardar jugador
  const newPlayer = {
    id: generateId(),
    name: name,
    level: level,
    addedAt: Date.now()
  };

  App.players.push(newPlayer);
  saveToStorage(STORAGE_KEYS.PLAYERS, App.players);

  // Limpiar input
  nameInput.value = '';
  nameInput.focus();

  // Re-renderizar
  renderPlayers();
  renderPayersList(); // Actualizar sección gastos

  showToast(`✅ ${name} agregado (nivel ${level})`, 'success');
}

/** Elimina un jugador por ID. */
async function deletePlayer(id) {
  const player = App.players.find(p => p.id === id);
  if (!player) return;

  const confirmed = await showConfirm(
    '¿Eliminar jugador?',
    `Se va a eliminar a "${player.name}" de la lista. Si ya hay equipos generados, deberás volver a generarlos.`
  );

  if (!confirmed) return;

  App.players = App.players.filter(p => p.id !== id);
  saveToStorage(STORAGE_KEYS.PLAYERS, App.players);

  // Eliminar también de equipos si estaba
  if (App.teams.list) {
    App.teams.list = App.teams.list.map(team => team.filter(p => p.id !== id));
    saveToStorage(STORAGE_KEYS.TEAMS, App.teams);
  }

  // Eliminar de excluidos
  App.expenses.excluded = App.expenses.excluded.filter(eid => eid !== id);
  saveToStorage(STORAGE_KEYS.EXPENSES, App.expenses);

  renderPlayers();
  renderPayersList();
  showToast(`🗑️ ${player.name} eliminado`, 'info');
}

/** Limpia toda la lista de jugadores. */
async function clearAllPlayers() {
  if (App.players.length === 0) {
    showToast('No hay jugadores para limpiar', 'info');
    return;
  }

  const confirmed = await showConfirm(
    '¿Limpiar toda la lista?',
    `Se eliminarán los ${App.players.length} jugadores y los equipos generados. Esta acción no se puede deshacer.`
  );

  if (!confirmed) return;

  App.players = [];
  App.teams = { list: [] };
  App.expenses.excluded = [];
  App.teamsGenerated = false;

  saveToStorage(STORAGE_KEYS.PLAYERS, App.players);
  saveToStorage(STORAGE_KEYS.TEAMS, App.teams);
  saveToStorage(STORAGE_KEYS.EXPENSES, App.expenses);

  renderPlayers();
  renderTeams();
  renderPayersList();

  showToast('🗑️ Lista limpiada', 'info');
}

/** Inicializa el selector de nivel de jugador. */
function initLevelSelector() {
  const buttons = document.querySelectorAll('.level-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      App.selectedLevel = parseInt(btn.dataset.level, 10);
    });
  });
}

/* ============================================================
   MÓDULO: EXPORTAR / IMPORTAR JUGADORES (JSON)
   ============================================================ */

/** Exporta la lista de jugadores como archivo JSON. */
function exportPlayers() {
  if (App.players.length === 0) {
    showToast('No hay jugadores para exportar', 'error');
    return;
  }

  const exportData = {
    app: 'FútbolApp',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    players: App.players.map(p => ({ name: p.name, level: p.level }))
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href  = url;
  link.download = `futbolapp-jugadores-${formatDateSimple(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);

  showToast(`📤 ${App.players.length} jugadores exportados`, 'success');
}

/** Importa jugadores desde un archivo JSON. */
function importPlayers(file) {
  if (!file || file.type !== 'application/json') {
    showToast('Por favor seleccioná un archivo .json válido', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);

      // Validar estructura
      if (!data.players || !Array.isArray(data.players)) {
        throw new Error('Formato inválido');
      }

      const imported = data.players.filter(p => p.name && typeof p.name === 'string');
      if (imported.length === 0) {
        showToast('El archivo no contiene jugadores válidos', 'error');
        return;
      }

      const confirmed = await showConfirm(
        'Importar jugadores',
        `Se importarán ${imported.length} jugadores. ¿Querés reemplazar la lista actual o agregar a la existente?`
      );

      // Si confirma, limpiar y reemplazar; si cancela, agregar
      if (confirmed) {
        App.players = [];
      }

      let added = 0;
      imported.forEach(p => {
        const name  = p.name.trim().substring(0, 30);
        const level = Math.min(5, Math.max(1, parseInt(p.level, 10) || 3));

        // Evitar duplicados
        if (!App.players.find(ex => ex.name.toLowerCase() === name.toLowerCase())) {
          App.players.push({ id: generateId(), name, level, addedAt: Date.now() });
          added++;
        }
      });

      saveToStorage(STORAGE_KEYS.PLAYERS, App.players);
      renderPlayers();
      renderPayersList();
      showToast(`📥 ${added} jugadores importados`, 'success');

    } catch (err) {
      showToast('Error al leer el archivo JSON', 'error');
    }
  };
  reader.readAsText(file);
}

/* ============================================================
   MÓDULO: DATOS DEL PARTIDO
   ============================================================ */

/** Inicializa los campos del partido con los datos guardados. */
function initMatchForm() {
  const place = document.getElementById('match-place');
  const date  = document.getElementById('match-date');
  const time  = document.getElementById('match-time');
  const notes = document.getElementById('match-notes');

  // Cargar datos guardados
  place.value = App.matchInfo.place || '';
  date.value  = App.matchInfo.date  || '';
  time.value  = App.matchInfo.time  || '';
  notes.value = App.matchInfo.notes || '';

  // Auto-guardar con debounce
  [place, date, time, notes].forEach(input => {
    input.addEventListener('input', debounce(saveMatchInfo, 600));
  });
}

/** Guarda la información del partido en localStorage. */
function saveMatchInfo() {
  App.matchInfo = {
    place: document.getElementById('match-place').value.trim(),
    date:  document.getElementById('match-date').value,
    time:  document.getElementById('match-time').value,
    notes: document.getElementById('match-notes').value.trim(),
  };
  saveToStorage(STORAGE_KEYS.MATCH, App.matchInfo);

  // Mostrar indicador de guardado
  const indicator = document.getElementById('match-save-indicator');
  indicator.classList.add('visible');
  setTimeout(() => indicator.classList.remove('visible'), 2000);

  // Actualizar resumen
  renderMatchSummary();
}

/** Renderiza el resumen del partido. */
function renderMatchSummary() {
  const summary = document.getElementById('match-summary');
  if (!summary) return;

  const { place, date, time, notes } = App.matchInfo;
  const playerCount = App.players.length;

  summary.innerHTML = `
    <div class="summary-item">
      <div class="summary-label">📍 Lugar</div>
      <div class="summary-value">${escapeHtml(place) || '—'}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">📅 Fecha</div>
      <div class="summary-value">${date ? formatDateDisplay(date) : '—'}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">⏰ Hora</div>
      <div class="summary-value">${time || '—'}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">👥 Jugadores</div>
      <div class="summary-value">${playerCount} jugador${playerCount !== 1 ? 'es' : ''}</div>
    </div>
    ${notes ? `
    <div class="summary-item summary-item--full">
      <div class="summary-label">📝 Notas</div>
      <div class="summary-value">${escapeHtml(notes)}</div>
    </div>` : ''}
  `;
}

/** Copia la info del partido para WhatsApp. */
function copyMatchInfo() {
  const { place, date, time, notes } = App.matchInfo;
  const playerCount = App.players.length;

  let text = '⚽ *PARTIDO DE FÚTBOL* ⚽\n';
  text += '━━━━━━━━━━━━━━━━━━\n';
  if (place) text += `📍 *Lugar:* ${place}\n`;
  if (date)  text += `📅 *Fecha:* ${formatDateDisplay(date)}\n`;
  if (time)  text += `⏰ *Hora:* ${time}\n`;
  if (playerCount > 0) text += `👥 *Jugadores confirmados:* ${playerCount}\n`;
  if (notes) text += `📝 *Notas:* ${notes}\n`;
  text += '━━━━━━━━━━━━━━━━━━';

  copyToClipboard(text, '📋 Info del partido copiada');
}

/* ============================================================
   MÓDULO: EQUIPOS
   ============================================================ */

/**
 * Algoritmo de división equilibrada por nivel para N equipos.
 * Ordena jugadores por nivel DESC y los asigna al equipo
 * con menor suma acumulada (greedy).
 * @param {Array} players - Lista de jugadores
 * @param {number} n - Número de equipos
 * @returns {Array} Array de N arrays (equipos)
 */
function divideTeamsBalanced(players, n) {
  // Mezclar aleatoriamente primero (Fisher-Yates)
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Ordenar por nivel descendente para greedy
  const sorted = [...shuffled].sort((a, b) => b.level - a.level);

  // Inicializar N equipos vacíos con suma 0
  const teams = Array.from({ length: n }, () => []);
  const sums  = Array(n).fill(0);

  sorted.forEach(player => {
    // Asignar al equipo con menor suma
    const minIdx = sums.indexOf(Math.min(...sums));
    teams[minIdx].push(player);
    sums[minIdx] += player.level;
  });

  return teams;
}

/**
 * División aleatoria simple para N equipos (sin niveles).
 * @param {Array} players
 * @param {number} n - Número de equipos
 * @returns {Array} Array de N arrays (equipos)
 */
function divideTeamsRandom(players, n) {
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const teams = Array.from({ length: n }, () => []);
  shuffled.forEach((player, i) => {
    teams[i % n].push(player);
  });

  return teams;
}

/** Genera los equipos según la configuración actual. */
function generateTeams() {
  if (App.players.length < App.numTeams) {
    showToast(`Necesitás al menos ${App.numTeams} jugadores para ${App.numTeams} equipos`, 'error');
    return;
  }

  const byLevel = document.getElementById('balance-by-level').checked;
  const btn = document.getElementById('generate-teams-btn');

  // Animación del botón
  btn.classList.add('btn--generating');
  setTimeout(() => btn.classList.remove('btn--generating'), 700);

  // Dividir equipos
  const teamsList = byLevel
    ? divideTeamsBalanced(App.players, App.numTeams)
    : divideTeamsRandom(App.players, App.numTeams);

  App.teams = { list: teamsList };
  App.teamsGenerated = true;

  saveToStorage(STORAGE_KEYS.TEAMS, App.teams);

  // Habilitar botones
  document.getElementById('reshuffle-btn').disabled = false;
  document.getElementById('copy-teams-btn').disabled = false;

  // Renderizar
  renderTeams();
  renderBalanceIndicator();

  showToast(`⚽ ¡${App.numTeams} equipos generados!`, 'success');
}

/** Re-mezcla los equipos (misma lógica, nueva aleatoriedad). */
function reshuffleTeams() {
  generateTeams();
  showToast('🔀 Equipos mezclados de nuevo', 'info');
}

/** Renderiza los equipos en el DOM. */
function renderTeams() {
  const area = document.getElementById('teams-area');

  if (!App.teamsGenerated || !App.teams.list || App.teams.list.every(t => t.length === 0)) {
    area.innerHTML = '';
    area.className = 'teams-area';
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.id = 'empty-teams';
    empty.innerHTML = `
      <div class="empty-icon">⚽</div>
      <p class="empty-text">No hay equipos generados.</p>
      <p class="empty-subtext">Agregá jugadores y presioná "Generar Equipos".</p>
    `;
    area.appendChild(empty);
    document.getElementById('balance-indicator').style.display = 'none';
    return;
  }

  const isEditMode = document.getElementById('edit-mode-toggle').checked;
  const n = App.teams.list.length;

  // Aplicar clase de grid según cantidad de equipos
  area.className = `teams-area teams-count-${n}${isEditMode ? ' edit-mode' : ''}`;

  area.innerHTML = App.teams.list.map((players, idx) =>
    renderTeamCard(idx, players, isEditMode)
  ).join('');

  // Eventos para mover jugadores en modo edición
  if (isEditMode) {
    area.querySelectorAll('.move-player-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        movePlayerBetweenTeams(btn.dataset.playerId, parseInt(btn.dataset.fromTeam, 10));
      });
    });
  }

  document.getElementById('balance-indicator').style.display = 'block';
  renderBalanceIndicator();
}

/**
 * Genera el HTML de una tarjeta de equipo.
 * @param {number} idx   - Índice del equipo (0-based)
 * @param {Array}  players - Jugadores del equipo
 * @param {boolean} editMode - Si está en modo edición
 */
function renderTeamCard(idx, players, editMode) {
  const teamNum = idx + 1;
  const names   = ['Verde', 'Azul', 'Amarillo', 'Naranja'];
  const icons   = ['🟢', '🔵', '🟡', '🟠'];
  const name    = names[idx] || `Equipo ${teamNum}`;
  const icon    = icons[idx] || '⚽';
  const levelSum = players.reduce((acc, p) => acc + p.level, 0);

  // Los jugadores se muestran SIN nivel (para no generar comparaciones)
  const playerRows = players.map(p => `
    <div class="team-player-item">
      <span style="flex:1; font-size:0.9rem;">${escapeHtml(p.name)}</span>
      ${editMode ? `<button class="move-player-btn" data-player-id="${p.id}" data-from-team="${idx}" title="Mover a otro equipo">⇄</button>` : ''}
    </div>
  `).join('');

  return `
    <div class="team-card team-card--${teamNum}">
      <div class="team-header">
        <div class="team-name team-name--${teamNum}">${icon} Equipo ${name}</div>
        <div class="team-meta">
          <span>👥 ${players.length} jugadores</span>
        </div>
      </div>
      <div class="team-players-list">
        ${playerRows || '<p style="padding:8px; color:var(--color-text-dim); font-size:0.85rem;">Sin jugadores</p>'}
      </div>
    </div>
  `;
}

/**
 * Mueve un jugador a otro equipo. Si hay más de 2 equipos,
 * lo rota al siguiente (índice + 1 en ciclo).
 * @param {string} playerId
 * @param {number} fromIdx - Índice del equipo de origen (0-based)
 */
function movePlayerBetweenTeams(playerId, fromIdx) {
  const n = App.teams.list.length;
  const toIdx = (fromIdx + 1) % n;

  const playerIndex = App.teams.list[fromIdx].findIndex(p => p.id === playerId);
  if (playerIndex === -1) return;

  const [player] = App.teams.list[fromIdx].splice(playerIndex, 1);
  App.teams.list[toIdx].push(player);

  saveToStorage(STORAGE_KEYS.TEAMS, App.teams);
  renderTeams();

  const teamNames = ['Verde', 'Azul', 'Amarillo', 'Naranja'];
  showToast(`↔️ ${player.name} → Equipo ${teamNames[toIdx] || toIdx + 1}`, 'info');
}

/** Renderiza el indicador de equilibrio de equipos. */
function renderBalanceIndicator() {
  const display = document.getElementById('balance-display');
  if (!display || !App.teams.list) return;

  const sums  = App.teams.list.map(team => team.reduce((acc, p) => acc + p.level, 0));
  const total = sums.reduce((a, b) => a + b, 0);
  if (total === 0) return;

  const maxSum  = Math.max(...sums);
  const minSum  = Math.min(...sums);
  const diff    = maxSum - minSum;
  const names   = ['Verde', 'Azul', 'Amarillo', 'Naranja'];
  const colors  = ['var(--team-1-color)', 'var(--team-2-color)', 'var(--team-3-color)', 'var(--team-4-color)'];

  let statusClass = 'balance-status--ok';
  let statusText  = '✅ Equipos muy equilibrados';
  if (diff > 5)    { statusClass = 'balance-status--bad';  statusText = '❌ Gran diferencia de niveles'; }
  else if (diff > 2) { statusClass = 'balance-status--warn'; statusText = '⚠️ Diferencia leve'; }

  const teamsHtml = sums.map((sum, idx) => `
    <div style="text-align:center;">
      <div style="font-size:0.7rem; font-weight:700; text-transform:uppercase; color:var(--color-text-dim); letter-spacing:0.04em; margin-bottom:2px;">
        ${names[idx] || 'Eq. ' + (idx+1)}
      </div>
      <div style="font-family:var(--font-display); font-weight:800; font-size:1.4rem; color:${colors[idx]};">${sum}</div>
    </div>
  `).join('');

  // Barra proporcional al equipo con más nivel
  const barsHtml = sums.map((sum, idx) => `
    <div title="Equipo ${names[idx]}: nivel ${sum}" style="
      height: 8px;
      flex: ${sum || 1};
      background: ${colors[idx]};
      border-radius: 2px;
      transition: flex 0.5s ease;
    "></div>
  `).join('');

  display.innerHTML = `
    <div style="display:flex; justify-content:space-around; gap:var(--space-md); flex-wrap:wrap; margin-bottom:var(--space-md);">
      ${teamsHtml}
    </div>
    <div style="display:flex; gap:3px; border-radius:var(--radius-full); overflow:hidden; margin-bottom:var(--space-sm);">
      ${barsHtml}
    </div>
    <div class="balance-status ${statusClass}">${statusText} (diferencia: ${diff} pts)</div>
  `;
}

/** Copia los equipos para compartir por WhatsApp. */
function copyTeamsForWhatsApp() {
  if (!App.teamsGenerated || !App.teams.list) {
    showToast('Generá los equipos primero', 'error');
    return;
  }

  const names  = ['Verde', 'Azul', 'Amarillo', 'Naranja'];
  const icons  = ['🟢', '🔵', '🟡', '🟠'];
  const listPlayers = (players) =>
    players.map((p, i) => `  ${i + 1}. ${p.name}`).join('\n');

  let text = '⚽ *EQUIPOS DEL PARTIDO* ⚽\n';
  text += '━━━━━━━━━━━━━━━━━━\n\n';

  App.teams.list.forEach((players, idx) => {
    const icon = icons[idx] || '⚽';
    const name = names[idx] || `Equipo ${idx + 1}`;
    text += `${icon} *EQUIPO ${name.toUpperCase()}*\n`;
    text += listPlayers(players) + '\n\n';
  });

  text = text.trimEnd();
  text += '\n━━━━━━━━━━━━━━━━━━';

  if (App.matchInfo.place || App.matchInfo.date) {
    text += `\n📍 ${App.matchInfo.place || ''}`;
    if (App.matchInfo.date) text += ` | ${formatDateDisplay(App.matchInfo.date)}`;
    if (App.matchInfo.time) text += ` ${App.matchInfo.time}hs`;
  }

  copyToClipboard(text, '📋 Equipos copiados para WhatsApp');
}

/* ============================================================
   MÓDULO: CALCULADORA DE GASTOS
   ============================================================ */

/** Renderiza la lista de jugadores que pagan. */
function renderPayersList() {
  const listEl  = document.getElementById('payers-list');
  const emptyEl = document.getElementById('empty-payers');

  if (!listEl) return;

  // Limpiar lista
  const existing = listEl.querySelectorAll('.payer-item');
  existing.forEach(el => el.remove());

  if (App.players.length === 0) {
    emptyEl.style.display = 'flex';
    return;
  }

  emptyEl.style.display = 'none';

  App.players.forEach(player => {
    const isExcluded = App.expenses.excluded.includes(player.id);
    const item = document.createElement('div');
    item.className = `payer-item${isExcluded ? ' excluded' : ''}`;
    item.innerHTML = `
      <input
        type="checkbox"
        class="payer-checkbox"
        id="payer-${player.id}"
        data-id="${player.id}"
        ${!isExcluded ? 'checked' : ''}
        aria-label="${escapeHtml(player.name)}"
      />
      <label class="payer-name" for="payer-${player.id}">${escapeHtml(player.name)}</label>
      <span class="level-badge level-${player.level}">${player.level}</span>
    `;
    listEl.appendChild(item);

    // Evento checkbox
    const checkbox = item.querySelector('.payer-checkbox');
    checkbox.addEventListener('change', () => {
      togglePlayerPayment(player.id, checkbox.checked);
      item.classList.toggle('excluded', !checkbox.checked);
    });
  });

  // Calcular con la configuración actual
  calculateExpenses();
}

/** Activa/desactiva si un jugador paga. */
function togglePlayerPayment(playerId, pays) {
  if (pays) {
    App.expenses.excluded = App.expenses.excluded.filter(id => id !== playerId);
  } else {
    if (!App.expenses.excluded.includes(playerId)) {
      App.expenses.excluded.push(playerId);
    }
  }
  saveToStorage(STORAGE_KEYS.EXPENSES, App.expenses);
  calculateExpenses();
}

/** Calcula y muestra cuánto paga cada jugador. */
function calculateExpenses() {
  const resultEl = document.getElementById('expense-result');
  const costInput = document.getElementById('total-cost');
  const total = parseFloat(costInput.value) || 0;
  const currency = App.expenses.currency;

  App.expenses.total    = total;
  App.expenses.currency = currency;
  saveToStorage(STORAGE_KEYS.EXPENSES, App.expenses);

  if (!resultEl) return;

  // Jugadores que pagan
  const payers = App.players.filter(p => !App.expenses.excluded.includes(p.id));

  if (total <= 0 || payers.length === 0) {
    resultEl.innerHTML = `
      <div class="empty-state" style="padding: var(--space-lg);">
        <p class="empty-text">${total <= 0 ? 'Ingresá el costo total.' : 'No hay jugadores que paguen.'}</p>
      </div>`;
    return;
  }

  const perPerson = total / payers.length;
  const symb = getCurrencySymbol(currency);

  // Renderizar resultado
  resultEl.innerHTML = `
    <div class="expense-total-display">
      <div class="expense-total-label">Total del partido</div>
      <div class="expense-total-amount">${symb}${formatNumber(total)}</div>
      <div class="expense-per-player">${symb}${formatNumber(perPerson)} por jugador × ${payers.length} jugadores que pagan</div>
    </div>
    ${payers.map(p => `
      <div class="expense-player-row">
        <span class="expense-player-name">
          <span class="level-badge level-${p.level}" style="margin-right:6px;">${p.level}</span>
          ${escapeHtml(p.name)}
        </span>
        <span class="expense-player-amount">${symb}${formatNumber(perPerson)}</span>
      </div>
    `).join('')}
    ${App.expenses.excluded.length > 0 ? `
      <p style="font-size:0.8rem; color:var(--color-text-dim); margin-top:var(--space-sm); text-align:center;">
        🆓 ${App.expenses.excluded.length} jugador${App.expenses.excluded.length > 1 ? 'es' : ''} no paga${App.expenses.excluded.length > 1 ? 'n' : ''}
      </p>` : ''}
  `;
}

/** Copia el resumen de gastos para WhatsApp. */
function copyExpenses() {
  const total   = App.expenses.total;
  const payers  = App.players.filter(p => !App.expenses.excluded.includes(p.id));
  const symb    = getCurrencySymbol(App.expenses.currency);

  if (total <= 0 || payers.length === 0) {
    showToast('Ingresá el costo y los jugadores', 'error');
    return;
  }

  const perPerson = total / payers.length;

  let text = '💰 *GASTOS DEL PARTIDO* 💰\n';
  text += '━━━━━━━━━━━━━━━━━━\n';
  text += `Total: ${symb}${formatNumber(total)}\n`;
  text += `Por jugador: ${symb}${formatNumber(perPerson)}\n\n`;
  text += payers.map(p => `✅ ${p.name}: ${symb}${formatNumber(perPerson)}`).join('\n');

  if (App.expenses.excluded.length > 0) {
    const excluded = App.players.filter(p => App.expenses.excluded.includes(p.id));
    text += '\n\n🆓 No pagan:\n';
    text += excluded.map(p => `  - ${p.name}`).join('\n');
  }
  text += '\n━━━━━━━━━━━━━━━━━━';

  copyToClipboard(text, '📋 Gastos copiados para WhatsApp');
}

/** Inicializa el selector de moneda. */
function initCurrencySelector() {
  const buttons = document.querySelectorAll('.currency-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      App.expenses.currency = btn.dataset.currency;
      calculateExpenses();
    });
  });

  // Activar la moneda guardada
  const savedCurrency = App.expenses.currency || 'ARS';
  buttons.forEach(btn => {
    if (btn.dataset.currency === savedCurrency) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Cargar total guardado
  const costInput = document.getElementById('total-cost');
  if (costInput && App.expenses.total > 0) {
    costInput.value = App.expenses.total;
  }
}

/* ============================================================
   MÓDULO: HISTORIAL DE PARTIDOS
   ============================================================ */

/** Guarda el partido actual en el historial. */
async function saveMatchToHistory() {
  if (!App.teamsGenerated || !App.teams.list) {
    showToast('Generá los equipos antes de guardar', 'error');
    return;
  }

  const score1 = parseInt(document.getElementById('score-team1').value, 10) || 0;
  const score2 = parseInt(document.getElementById('score-team2').value, 10) || 0;

  const record = {
    id:      generateId(),
    savedAt: Date.now(),
    matchInfo: { ...App.matchInfo },
    teams: App.teams.list.map(team => team.map(p => ({ name: p.name, level: p.level }))),
    score: { team1: score1, team2: score2 },
    expenses: {
      total: App.expenses.total,
      currency: App.expenses.currency,
    }
  };

  App.history.unshift(record);

  if (App.history.length > 50) {
    App.history = App.history.slice(0, 50);
  }

  saveToStorage(STORAGE_KEYS.HISTORY, App.history);
  renderHistory();

  showToast('💾 Partido guardado en el historial', 'success');
  switchTab('historial');
}

/** Renderiza el historial de partidos. */
function renderHistory() {
  const listEl   = document.getElementById('history-list');
  const emptyEl  = document.getElementById('empty-history');

  if (!listEl) return;

  const existing = listEl.querySelectorAll('.history-item');
  existing.forEach(el => el.remove());

  if (App.history.length === 0) {
    emptyEl.style.display = 'flex';
    return;
  }

  emptyEl.style.display = 'none';

  const teamNames = ['Verde', 'Azul', 'Amarillo', 'Naranja'];

  App.history.forEach(record => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const date  = record.matchInfo?.date
      ? formatDateDisplay(record.matchInfo.date)
      : formatDateDisplay(new Date(record.savedAt).toISOString().split('T')[0]);

    const place  = record.matchInfo?.place || 'Sin lugar';
    const score1 = record.score?.team1 ?? '—';
    const score2 = record.score?.team2 ?? '—';

    // Soportar tanto formato nuevo (teams: array) como viejo (teams: {team1, team2})
    let teamsList = [];
    if (Array.isArray(record.teams)) {
      teamsList = record.teams;
    } else if (record.teams?.team1) {
      teamsList = [record.teams.team1, record.teams.team2];
    }

    const teamsHtml = teamsList.map((team, idx) => `
      <div class="history-team-mini">
        <strong style="color:${['var(--team-1-color)','var(--team-2-color)','var(--team-3-color)','var(--team-4-color)'][idx] || 'inherit'}">
          Equipo ${teamNames[idx] || idx + 1}
        </strong>
        <span>${escapeHtml(team.map(p => p.name).join(', ')) || '—'}</span>
      </div>
    `).join('');

    item.innerHTML = `
      <div class="history-item-header">
        <span class="history-date">📅 ${date}</span>
        <span class="history-place">📍 ${escapeHtml(place)}</span>
        <button class="history-delete-btn" data-id="${record.id}" title="Eliminar registro">✕</button>
      </div>
      <div class="history-item-body">
        <div class="history-score">
          <span class="history-team-score history-team-score--1">🟢 ${score1}</span>
          <span class="history-vs">vs</span>
          <span class="history-team-score history-team-score--2">🔵 ${score2}</span>
        </div>
        <div class="history-teams-mini">${teamsHtml}</div>
      </div>
    `;

    item.querySelector('.history-delete-btn').addEventListener('click', () => {
      deleteHistoryRecord(record.id);
    });

    listEl.appendChild(item);
  });
}

/** Elimina un registro del historial. */
async function deleteHistoryRecord(id) {
  const confirmed = await showConfirm(
    '¿Eliminar este partido?',
    'Se eliminará este registro del historial. No se puede deshacer.'
  );
  if (!confirmed) return;

  App.history = App.history.filter(r => r.id !== id);
  saveToStorage(STORAGE_KEYS.HISTORY, App.history);
  renderHistory();
  showToast('🗑️ Registro eliminado', 'info');
}

/** Limpia todo el historial. */
async function clearHistory() {
  if (App.history.length === 0) {
    showToast('El historial ya está vacío', 'info');
    return;
  }

  const confirmed = await showConfirm(
    '¿Borrar todo el historial?',
    `Se eliminarán los ${App.history.length} partidos guardados. Esta acción no se puede deshacer.`
  );

  if (!confirmed) return;

  App.history = [];
  saveToStorage(STORAGE_KEYS.HISTORY, App.history);
  renderHistory();
  showToast('🗑️ Historial borrado', 'info');
}

/* ============================================================
   UTILIDADES GENERALES
   ============================================================ */

/**
 * Escapa caracteres HTML para prevenir XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

/**
 * Copia texto al portapapeles con feedback visual.
 * @param {string} text
 * @param {string} successMsg
 */
function copyToClipboard(text, successMsg = 'Copiado al portapapeles') {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(() => showToast(successMsg, 'success'))
      .catch(() => fallbackCopy(text, successMsg));
  } else {
    fallbackCopy(text, successMsg);
  }
}

/** Fallback para copiar texto en navegadores/contextos sin clipboard API. */
function fallbackCopy(text, successMsg) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand('copy');
    showToast(successMsg, 'success');
  } catch (e) {
    showToast('No se pudo copiar automáticamente', 'error');
  }
  document.body.removeChild(textarea);
}

/**
 * Formatea un número con separadores de miles.
 * @param {number} num
 * @returns {string}
 */
function formatNumber(num) {
  return num.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

/**
 * Formatea una fecha ISO (YYYY-MM-DD) para mostrar.
 * @param {string} dateStr
 * @returns {string}
 */
function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-');
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                    'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Formatea una fecha como YYYYMMDD para nombres de archivo.
 * @param {Date} date
 * @returns {string}
 */
function formatDateSimple(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Retorna el símbolo de la moneda.
 * @param {string} currency
 * @returns {string}
 */
function getCurrencySymbol(currency) {
  const symbols = { ARS: '$', EUR: '€', USD: 'U$S ' };
  return symbols[currency] || '$';
}

/**
 * Debounce: retrasa la ejecución de una función.
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/* ============================================================
   INICIALIZACIÓN PRINCIPAL
   ============================================================ */

/** Registra todos los event listeners de la aplicación. */
function bindEvents() {
  // ---- JUGADORES ----
  // Botón agregar
  document.getElementById('add-player-btn')
    .addEventListener('click', addPlayer);

  // Enter en el input de nombre
  document.getElementById('player-name-input')
    .addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addPlayer();
    });

  // Limpiar lista
  document.getElementById('clear-all-btn')
    .addEventListener('click', clearAllPlayers);

  // Exportar JSON
  document.getElementById('export-players-btn')
    .addEventListener('click', exportPlayers);

  // Importar JSON
  document.getElementById('import-players-input')
    .addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) importPlayers(file);
      e.target.value = ''; // Reset para permitir reimportar el mismo archivo
    });

  // ---- PARTIDO ----
  document.getElementById('copy-match-btn')
    .addEventListener('click', copyMatchInfo);

  // ---- EQUIPOS ----
  // Selector de cantidad de equipos
  document.querySelectorAll('.num-teams-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.num-teams-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      App.numTeams = parseInt(btn.dataset.num, 10);
    });
  });

  document.getElementById('generate-teams-btn')
    .addEventListener('click', generateTeams);

  document.getElementById('reshuffle-btn')
    .addEventListener('click', reshuffleTeams);

  document.getElementById('copy-teams-btn')
    .addEventListener('click', copyTeamsForWhatsApp);

  document.getElementById('edit-mode-toggle')
    .addEventListener('change', renderTeams);

  // ---- GASTOS ----
  document.getElementById('total-cost')
    .addEventListener('input', debounce(calculateExpenses, 400));

  document.getElementById('copy-expenses-btn')
    .addEventListener('click', copyExpenses);

  // ---- HISTORIAL ----
  document.getElementById('save-match-btn')
    .addEventListener('click', saveMatchToHistory);

  document.getElementById('clear-history-btn')
    .addEventListener('click', clearHistory);

  // ---- MODAL ----
  document.getElementById('modal-confirm-btn')
    .addEventListener('click', () => closeModal(true));

  document.getElementById('modal-cancel-btn')
    .addEventListener('click', () => closeModal(false));

  document.getElementById('modal-overlay')
    .addEventListener('click', (e) => {
      // Cerrar al click en el overlay (fuera del modal)
      if (e.target === e.currentTarget) closeModal(false);
    });
}

/**
 * Punto de entrada de la aplicación.
 * Se ejecuta cuando el DOM está completamente cargado.
 */
function init() {
  // 1. Cargar datos persistidos
  loadAllData();

  // 2. Inicializar módulos de UI
  initTabs();
  initLevelSelector();
  initMatchForm();
  initCurrencySelector();

  // 3. Registrar eventos
  bindEvents();

  // 4. Renderizar estado inicial
  renderPlayers();
  renderMatchSummary();
  renderTeams();
  renderPayersList();
  renderHistory();

  // Sincronizar selector de número de equipos con el estado cargado
  document.querySelectorAll('.num-teams-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.num, 10) === App.numTeams);
  });

  // 5. Si había equipos generados, habilitar botones
  if (App.teamsGenerated) {
    document.getElementById('reshuffle-btn').disabled = false;
    document.getElementById('copy-teams-btn').disabled = false;
    renderBalanceIndicator();
    document.getElementById('balance-indicator').style.display = 'block';
  }

  console.log('⚽ FútbolApp iniciada correctamente. Versión 1.0');
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);
