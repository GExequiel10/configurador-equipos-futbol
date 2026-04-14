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
  teams: {            // Equipos generados
    team1: [],
    team2: []
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
  App.teams    = loadFromStorage(STORAGE_KEYS.TEAMS)    || { team1:[], team2:[] };
  App.expenses = loadFromStorage(STORAGE_KEYS.EXPENSES) || { total:0, currency:'ARS', excluded:[] };
  App.history  = loadFromStorage(STORAGE_KEYS.HISTORY)  || [];

  // Si había equipos guardados, marcar como generados
  if (App.teams.team1.length > 0 || App.teams.team2.length > 0) {
    App.teamsGenerated = true;
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
  App.teams.team1 = App.teams.team1.filter(p => p.id !== id);
  App.teams.team2 = App.teams.team2.filter(p => p.id !== id);
  saveToStorage(STORAGE_KEYS.TEAMS, App.teams);

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
  App.teams = { team1: [], team2: [] };
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
 * Algoritmo de división equilibrada por nivel.
 * Usa un enfoque greedy: ordena jugadores por nivel DESC
 * y los asigna alternando al equipo con menor suma de niveles.
 * @param {Array} players - Lista de jugadores
 * @returns {{ team1: Array, team2: Array }}
 */
function divideTeamsBalanced(players) {
  // Mezclar aleatoriamente primero (Fisher-Yates)
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Ordenar por nivel descendente para greedy
  const sorted = [...shuffled].sort((a, b) => b.level - a.level);

  const team1 = [];
  const team2 = [];
  let sum1 = 0;
  let sum2 = 0;

  sorted.forEach(player => {
    if (sum1 <= sum2) {
      team1.push(player);
      sum1 += player.level;
    } else {
      team2.push(player);
      sum2 += player.level;
    }
  });

  return { team1, team2 };
}

/**
 * División aleatoria simple (sin considerar niveles).
 * @param {Array} players
 * @returns {{ team1: Array, team2: Array }}
 */
function divideTeamsRandom(players) {
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const half = Math.ceil(shuffled.length / 2);
  return {
    team1: shuffled.slice(0, half),
    team2: shuffled.slice(half)
  };
}

/** Genera los equipos según la configuración actual. */
function generateTeams() {
  if (App.players.length < 2) {
    showToast('Necesitás al menos 2 jugadores', 'error');
    return;
  }

  const byLevel = document.getElementById('balance-by-level').checked;
  const btn = document.getElementById('generate-teams-btn');

  // Animación del botón
  btn.classList.add('btn--generating');
  setTimeout(() => btn.classList.remove('btn--generating'), 700);

  // Dividir equipos
  const result = byLevel
    ? divideTeamsBalanced(App.players)
    : divideTeamsRandom(App.players);

  App.teams = result;
  App.teamsGenerated = true;

  saveToStorage(STORAGE_KEYS.TEAMS, App.teams);

  // Habilitar botones
  document.getElementById('reshuffle-btn').disabled = false;
  document.getElementById('copy-teams-btn').disabled = false;

  // Renderizar
  renderTeams();
  renderBalanceIndicator();

  showToast('⚽ ¡Equipos generados!', 'success');
}

/** Re-mezcla los equipos (misma lógica, nueva aleatoriedad). */
function reshuffleTeams() {
  generateTeams();
  showToast('🔀 Equipos mezclados de nuevo', 'info');
}

/** Renderiza los equipos en el DOM. */
function renderTeams() {
  const area    = document.getElementById('teams-area');
  const emptyEl = document.getElementById('empty-teams');

  if (!App.teamsGenerated || (App.teams.team1.length === 0 && App.teams.team2.length === 0)) {
    // Mostrar empty state
    area.innerHTML = '';
    area.classList.remove('edit-mode');
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.id = 'empty-teams';
    empty.innerHTML = `
      <div class="empty-icon">⚽</div>
      <p class="empty-text">No hay equipos generados.</p>
      <p class="empty-subtext">Agregá jugadores y presioná "Generar Equipos".</p>
    `;
    area.appendChild(empty);

    // Ocultar balance indicator
    document.getElementById('balance-indicator').style.display = 'none';
    return;
  }

  // Determinar si estamos en modo edición
  const isEditMode = document.getElementById('edit-mode-toggle').checked;
  if (isEditMode) {
    area.classList.add('edit-mode');
  } else {
    area.classList.remove('edit-mode');
  }

  // Calcular sumas de niveles
  const sum1 = App.teams.team1.reduce((acc, p) => acc + p.level, 0);
  const sum2 = App.teams.team2.reduce((acc, p) => acc + p.level, 0);

  area.innerHTML = `
    ${renderTeamCard(1, App.teams.team1, sum1, isEditMode)}
    ${renderTeamCard(2, App.teams.team2, sum2, isEditMode)}
  `;

  // Eventos para mover jugadores en modo edición
  if (isEditMode) {
    area.querySelectorAll('.move-player-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const playerId  = btn.dataset.playerId;
        const fromTeam  = parseInt(btn.dataset.fromTeam, 10);
        movePlayerBetweenTeams(playerId, fromTeam);
      });
    });
  }

  // Mostrar y actualizar balance indicator
  document.getElementById('balance-indicator').style.display = 'block';
  renderBalanceIndicator();
}

/**
 * Genera el HTML de una tarjeta de equipo.
 * @param {number} teamNum - 1 o 2
 * @param {Array}  players - Jugadores del equipo
 * @param {number} levelSum - Suma de niveles
 * @param {boolean} editMode - Si está en modo edición
 */
function renderTeamCard(teamNum, players, levelSum, editMode) {
  const names = ['', 'Equipo Verde', 'Equipo Azul'];
  const icons = ['', '🟢', '🔵'];

  const playerRows = players.map(p => `
    <div class="team-player-item">
      <span class="level-badge level-${p.level}">${p.level}</span>
      <span style="flex:1; font-size:0.9rem;">${escapeHtml(p.name)}</span>
      ${editMode ? `<button class="move-player-btn" data-player-id="${p.id}" data-from-team="${teamNum}" title="Mover al otro equipo">⇄</button>` : ''}
    </div>
  `).join('');

  return `
    <div class="team-card team-card--${teamNum}">
      <div class="team-header">
        <div class="team-name team-name--${teamNum}">${icons[teamNum]} ${names[teamNum]}</div>
        <div class="team-meta">
          <span>👥 ${players.length} jugadores</span>
          <span>⭐ Nivel total: ${levelSum}</span>
        </div>
      </div>
      <div class="team-players-list">
        ${playerRows || '<p style="padding:8px; color:var(--color-text-dim); font-size:0.85rem;">Sin jugadores</p>'}
      </div>
    </div>
  `;
}

/**
 * Mueve un jugador entre equipos (modo edición).
 * @param {string} playerId
 * @param {number} fromTeam - Equipo de origen (1 o 2)
 */
function movePlayerBetweenTeams(playerId, fromTeam) {
  const fromKey = `team${fromTeam}`;
  const toKey   = fromTeam === 1 ? 'team2' : 'team1';

  const playerIndex = App.teams[fromKey].findIndex(p => p.id === playerId);
  if (playerIndex === -1) return;

  const [player] = App.teams[fromKey].splice(playerIndex, 1);
  App.teams[toKey].push(player);

  saveToStorage(STORAGE_KEYS.TEAMS, App.teams);
  renderTeams();

  showToast(`↔️ ${player.name} movido al otro equipo`, 'info');
}

/** Renderiza el indicador de equilibrio de equipos. */
function renderBalanceIndicator() {
  const display = document.getElementById('balance-display');
  if (!display) return;

  const sum1 = App.teams.team1.reduce((acc, p) => acc + p.level, 0);
  const sum2 = App.teams.team2.reduce((acc, p) => acc + p.level, 0);
  const total = sum1 + sum2;

  if (total === 0) return;

  const ratio    = sum1 / total; // 0 a 1
  const diff     = Math.abs(sum1 - sum2);
  const percent1 = Math.round(ratio * 100);

  // Calcular color de estado
  let statusClass = 'balance-status--ok';
  let statusText  = '✅ Equipos muy equilibrados';
  if (diff > 5) { statusClass = 'balance-status--bad';  statusText = '❌ Gran diferencia de niveles'; }
  else if (diff > 2) { statusClass = 'balance-status--warn'; statusText = '⚠️ Diferencia leve'; }

  display.innerHTML = `
    <div class="balance-team-info">
      <div class="balance-team-label">🟢 Equipo 1</div>
      <div class="balance-score balance-score--team1">${sum1}</div>
    </div>
    <div class="balance-bar-container">
      <div class="balance-bar-track">
        <div class="balance-bar-fill" style="width: ${percent1}%"></div>
        <div class="balance-bar-mid"></div>
      </div>
      <div class="balance-status ${statusClass}">${statusText} (dif: ${diff})</div>
    </div>
    <div class="balance-team-info" style="text-align:right;">
      <div class="balance-team-label">🔵 Equipo 2</div>
      <div class="balance-score balance-score--team2">${sum2}</div>
    </div>
  `;
}

/** Copia los equipos para compartir por WhatsApp. */
function copyTeamsForWhatsApp() {
  if (!App.teamsGenerated) {
    showToast('Generá los equipos primero', 'error');
    return;
  }

  const sum1 = App.teams.team1.reduce((acc, p) => acc + p.level, 0);
  const sum2 = App.teams.team2.reduce((acc, p) => acc + p.level, 0);

  const listPlayers = (players) =>
    players.map((p, i) => `  ${i + 1}. ${p.name} (Niv. ${p.level})`).join('\n');

  let text = '⚽ *EQUIPOS DEL PARTIDO* ⚽\n';
  text += '━━━━━━━━━━━━━━━━━━\n\n';
  text += `🟢 *EQUIPO VERDE* (nivel total: ${sum1})\n`;
  text += listPlayers(App.teams.team1) + '\n\n';
  text += `🔵 *EQUIPO AZUL* (nivel total: ${sum2})\n`;
  text += listPlayers(App.teams.team2) + '\n';
  text += '━━━━━━━━━━━━━━━━━━';

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
  if (!App.teamsGenerated) {
    showToast('Generá los equipos antes de guardar', 'error');
    return;
  }

  const score1 = parseInt(document.getElementById('score-team1').value, 10) || 0;
  const score2 = parseInt(document.getElementById('score-team2').value, 10) || 0;

  const record = {
    id:      generateId(),
    savedAt: Date.now(),
    matchInfo: { ...App.matchInfo },
    teams: {
      team1: [...App.teams.team1.map(p => ({ name: p.name, level: p.level }))],
      team2: [...App.teams.team2.map(p => ({ name: p.name, level: p.level }))],
    },
    score: { team1: score1, team2: score2 },
    expenses: {
      total: App.expenses.total,
      currency: App.expenses.currency,
    }
  };

  App.history.unshift(record); // Agregar al inicio (más reciente primero)

  // Limitar historial a los últimos 50 partidos
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

  // Limpiar
  const existing = listEl.querySelectorAll('.history-item');
  existing.forEach(el => el.remove());

  if (App.history.length === 0) {
    emptyEl.style.display = 'flex';
    return;
  }

  emptyEl.style.display = 'none';

  App.history.forEach(record => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const date  = record.matchInfo?.date
      ? formatDateDisplay(record.matchInfo.date)
      : formatDateDisplay(new Date(record.savedAt).toISOString().split('T')[0]);

    const place  = record.matchInfo?.place || 'Sin lugar';
    const score1 = record.score?.team1 ?? '—';
    const score2 = record.score?.team2 ?? '—';

    const team1Names = record.teams?.team1?.map(p => p.name).join(', ') || '—';
    const team2Names = record.teams?.team2?.map(p => p.name).join(', ') || '—';

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
        <div class="history-teams-mini">
          <div class="history-team-mini">
            <strong>Equipo Verde</strong>
            <span>${escapeHtml(team1Names)}</span>
          </div>
          <div class="history-team-mini">
            <strong>Equipo Azul</strong>
            <span>${escapeHtml(team2Names)}</span>
          </div>
        </div>
      </div>
    `;

    // Evento eliminar
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
