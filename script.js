/* ═══════════════════════════════════════════════════════════════
   SALA DE TRABAJO — JavaScript
   Temporizador Pomodoro + Ambiente + Tareas + Historial
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const RING_CIRCUMFERENCE = 628;
  const STORAGE_KEY = 'sala_trabajo_history';

  const $ = (sel) => document.querySelector(sel);

  // Timer
  const timerDisplay = $('#js-timer-display');
  const ringProgress = $('#js-ring-progress');
  const timerContainer = $('.timer');
  const sessionBadge = $('#js-session-label');
  const sessionText = $('#js-session-text');
  const blocksIndicator = $('#js-blocks-indicator');

  // Controls
  const btnStart = $('#js-btn-start');
  const btnPause = $('#js-btn-pause');
  const btnReset = $('#js-btn-reset');
  const btnSkip = $('#js-btn-skip');
  const sessionControls = $('.session-controls');

  // Config
  const configToggle = $('#js-config-toggle');
  const configBody = $('#js-config-body');
  const cfgStudy = $('#js-cfg-study');
  const cfgShort = $('#js-cfg-short');
  const cfgLong = $('#js-cfg-long');
  const cfgBlocks = $('#js-cfg-blocks');
  const cfgLongEvery = $('#js-cfg-long-every');
  const configApply = $('#js-config-apply');
  const configEstimate = $('#js-config-estimate');

  // Ambient
  const btnAmbient = $('#js-btn-ambient');
  const ambientSelect = $('#js-ambient-select');
  const volumeSlider = $('#js-volume');

  // Tasks
  const taskForm = $('#js-task-form');
  const taskInput = $('#js-task-input');
  const taskList = $('#js-task-list');
  const taskCount = $('#js-task-count');
  const tasksEmpty = $('#js-tasks-empty');
  const btnClearDone = $('#js-clear-done');

  // Workspace
  const workspaceTitle = $('#js-workspace-title');
  const btnEnd = $('#js-btn-end');
  const modalOverlay = $('#js-modal-overlay');
  const modalBody = $('#js-modal-body');
  const modalNew = $('#js-modal-new');

  // History
  const btnHistory = $('#js-btn-history');
  const historyOverlay = $('#js-history-overlay');
  const historyDate = $('#js-history-date');
  const historyPrev = $('#js-history-prev');
  const historyNext = $('#js-history-next');
  const historyList = $('#js-history-list');
  const historyClose = $('#js-history-close');

  // Detail
  const detailOverlay = $('#js-detail-overlay');
  const detailTitle = $('#js-detail-title');
  const detailBody = $('#js-detail-body');
  const detailDelete = $('#js-detail-delete');
  const detailClose = $('#js-detail-close');

  // Welcome & Tutorial buttons
  const welcomeOverlay = $('#js-welcome-overlay');
  const welcomeSkip = $('#js-welcome-skip');
  const welcomeStart = $('#js-welcome-start');
  const btnTutorial = $('#js-btn-tutorial');

  /* ─────────────────────────── STATE ──────────────────────────── */
  let config = {
    studyMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    totalBlocks: 4,
    longBreakEvery: 4,
  };

  let timerState = {
    mode: 'focus',
    totalSeconds: 25 * 60,
    remainingSeconds: 25 * 60,
    isRunning: false,
    intervalId: null,
    currentBlock: 1,
    blocksCompleted: 0,
  };

  let ambientState = {
    isPlaying: false,
    audioContext: null,
    gainNode: null,
    noiseNode: null,
    currentSound: 'rain',
  };

  let tasks = [];
  let activeTaskId = null;
  let nextTaskId = 1;

  let sessionStartTime = null;
  let totalStudySeconds = 0;
  let studyIntervalId = null;

  let currentDetailId = null;

  /* ═══════════════════════════════════════════════════════════════
     LOCALSTORAGE
  ════════════════════════════════════════════════════════════════ */

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {}
  }

  function addToHistory(entry) {
    const history = loadHistory();
    history.unshift(entry);
    saveHistory(history);
  }

  function deleteFromHistory(id) {
    let history = loadHistory();
    history = history.filter((h) => h.id !== id);
    saveHistory(history);
  }

  function getHistoryByDate(dateStr) {
    const history = loadHistory();
    return history.filter((h) => h.date === dateStr);
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function getDateStr(d) {
    const date = d || new Date();
    return date.toISOString().split('T')[0];
  }

  function formatDateTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }

  /* ═══════════════════════════════════════════════════════════════
     CONFIGURACIÓN
  ════════════════════════════════════════════════════════════════ */

  function formatTimeEstimate(totalMinutes) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h}h`;
    return `${m}min`;
  }

  function updateEstimate() {
    const study = Math.max(1, parseInt(cfgStudy.value) || 25);
    const shortBrk = Math.max(1, parseInt(cfgShort.value) || 5);
    const longBrk = Math.max(1, parseInt(cfgLong.value) || 15);
    const blocks = Math.max(1, parseInt(cfgBlocks.value) || 4);
    const longEvery = Math.max(1, parseInt(cfgLongEvery.value) || 4);

    const totalStudyMin = study * blocks;

    const longBreaks = Math.floor((blocks - 1) / longEvery);
    const shortBreaks = (blocks - 1) - longBreaks;
    const totalBreakMin = (shortBreaks * shortBrk) + (longBreaks * longBrk);
    const totalMin = totalStudyMin + totalBreakMin;

    const now = new Date();
    const end = new Date(now.getTime() + totalMin * 60000);
    const endStr = end.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

    configEstimate.innerHTML = `
      Estudiarás <span class="config-estimate__highlight">${formatTimeEstimate(totalStudyMin)}</span>
      en ${blocks} bloque${blocks > 1 ? 's' : ''}.
      Fin aprox: <span class="config-estimate__time">${endStr}</span>
      <span style="opacity:0.6">(+${formatTimeEstimate(totalBreakMin)} descanso)</span>
    `;
  }

  configToggle.addEventListener('click', () => {
    const isOpen = configBody.style.display !== 'none';
    configBody.style.display = isOpen ? 'none' : 'flex';
    if (!isOpen) updateEstimate();
  });

  [cfgStudy, cfgShort, cfgLong, cfgBlocks, cfgLongEvery].forEach((input) => {
    input.addEventListener('input', updateEstimate);
  });

  configApply.addEventListener('click', () => {
    config.studyMinutes = Math.max(1, Math.min(120, parseInt(cfgStudy.value) || 25));
    config.shortBreakMinutes = Math.max(1, Math.min(30, parseInt(cfgShort.value) || 5));
    config.longBreakMinutes = Math.max(1, Math.min(60, parseInt(cfgLong.value) || 15));
    config.totalBlocks = Math.max(1, Math.min(20, parseInt(cfgBlocks.value) || 4));
    config.longBreakEvery = Math.max(1, Math.min(10, parseInt(cfgLongEvery.value) || 4));

    cfgStudy.value = config.studyMinutes;
    cfgShort.value = config.shortBreakMinutes;
    cfgLong.value = config.longBreakMinutes;
    cfgBlocks.value = config.totalBlocks;
    cfgLongEvery.value = config.longBreakEvery;

    pauseTimer();
    timerState.currentBlock = 1;
    timerState.blocksCompleted = 0;
    switchMode('focus');
    renderBlocksIndicator();

    configBody.style.display = 'none';
  });

  /* ═══════════════════════════════════════════════════════════════
     TEMPLATES
  ════════════════════════════════════════════════════════════════ */

  document.querySelectorAll('.template-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const study = parseInt(btn.dataset.study) || 30;
      const short = parseInt(btn.dataset.short) || 10;
      const long = parseInt(btn.dataset.long) || 15;
      const blocks = parseInt(btn.dataset.blocks) || 2;
      const longEvery = parseInt(btn.dataset.longEvery) || 4;

      config.studyMinutes = study;
      config.shortBreakMinutes = short;
      config.longBreakMinutes = long;
      config.totalBlocks = blocks;
      config.longBreakEvery = longEvery;

      cfgStudy.value = study;
      cfgShort.value = short;
      cfgLong.value = long;
      cfgBlocks.value = blocks;
      cfgLongEvery.value = longEvery;

      pauseTimer();
      timerState.currentBlock = 1;
      timerState.blocksCompleted = 0;
      switchMode('focus');
      renderBlocksIndicator();

      configBody.style.display = 'none';
    });
  });

  /* ═══════════════════════════════════════════════════════════════
     BLOQUES INDICADOR
  ════════════════════════════════════════════════════════════════ */

  function renderBlocksIndicator() {
    blocksIndicator.innerHTML = '';

    for (let i = 1; i <= config.totalBlocks; i++) {
      const pip = document.createElement('span');
      pip.className = 'block-pip';
      pip.textContent = i;

      if (i <= timerState.blocksCompleted) {
        pip.classList.add('block-pip--done');
      } else if (i === timerState.currentBlock && timerState.mode === 'focus') {
        pip.classList.add('block-pip--active');
      }

      blocksIndicator.appendChild(pip);

      if (i < config.totalBlocks) {
        const restPip = document.createElement('span');
        restPip.className = 'block-pip--rest';

        const isLongBreak = (i % config.longBreakEvery === 0);
        const restDone = i < timerState.currentBlock || (i === timerState.currentBlock && timerState.mode !== 'focus');

        if (restDone) {
          restPip.classList.add('block-pip--rest-done');
        }

        restPip.title = isLongBreak ? `Descanso largo ${config.longBreakMinutes}m` : `Descanso corto ${config.shortBreakMinutes}m`;

        blocksIndicator.appendChild(restPip);
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     TEMPORIZADOR
  ════════════════════════════════════════════════════════════════ */

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function formatTimeLong(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function getCurrentBlock() {
    return timerState.currentBlock;
  }

  function updateTimerDisplay() {
    timerDisplay.textContent = formatTime(timerState.remainingSeconds);
    updateBrowserTitle();
  }

  function updateRingProgress() {
    const elapsed = timerState.totalSeconds - timerState.remainingSeconds;
    const progress = timerState.totalSeconds > 0 ? elapsed / timerState.totalSeconds : 0;
    const offset = RING_CIRCUMFERENCE * (1 - progress);
    ringProgress.style.strokeDashoffset = offset;
  }

  function updateSessionBadge() {
    const isRest = timerState.mode !== 'focus';
    sessionBadge.classList.toggle('is-rest', isRest);
    timerContainer.classList.toggle('is-rest', isRest);

    const labels = {
      focus: `Bloque ${timerState.currentBlock}`,
      short: 'Descanso corto',
      long: 'Descanso largo',
    };
    sessionText.textContent = labels[timerState.mode] || 'Estudio';
  }

  function updateBrowserTitle() {
    const time = formatTime(timerState.remainingSeconds);
    const prefix = timerState.mode === 'focus'
      ? `B${timerState.currentBlock}`
      : timerState.mode === 'short' ? 'Desc' : 'Desc+';

    document.title = `${time} ${prefix} | Sala de trabajo`;
  }

  function resetBrowserTitle() {
    document.title = 'Sala de Trabajo';
  }

  function updateControls() {
    const { isRunning } = timerState;
    sessionControls.classList.toggle('is-running', isRunning);
    btnStart.disabled = isRunning;
    btnPause.disabled = !isRunning;
  }

  function startStudyTracking() {
    if (!sessionStartTime) {
      sessionStartTime = Date.now();
    }
    if (!studyIntervalId) {
      studyIntervalId = setInterval(() => {
        if (timerState.mode === 'focus' && timerState.isRunning) {
          totalStudySeconds++;
        }
      }, 1000);
    }
  }

  function stopStudyTracking() {
    if (studyIntervalId) {
      clearInterval(studyIntervalId);
      studyIntervalId = null;
    }
  }

  function startTimer() {
    if (timerState.isRunning) return;
    timerState.isRunning = true;
    if (timerState.mode === 'focus') {
      startStudyTracking();
    }
    updateControls();

    timerState.intervalId = setInterval(() => {
      timerState.remainingSeconds--;
      updateTimerDisplay();
      updateRingProgress();

      if (timerState.remainingSeconds <= 0) {
        clearInterval(timerState.intervalId);
        timerState.isRunning = false;
        updateControls();
        onTimerComplete();
      }
    }, 1000);
  }

  function pauseTimer() {
    if (!timerState.isRunning) return;
    clearInterval(timerState.intervalId);
    timerState.isRunning = false;
    updateControls();
  }

  function resetTimer() {
    clearInterval(timerState.intervalId);
    timerState.isRunning = false;
    timerState.remainingSeconds = timerState.totalSeconds;
    updateTimerDisplay();
    updateRingProgress();
    updateControls();
  }

  function onTimerComplete() {
    playNotificationSound();

    if (timerState.mode === 'focus') {
      timerState.blocksCompleted = Math.min(timerState.blocksCompleted + 1, config.totalBlocks);

      if (timerState.blocksCompleted >= config.totalBlocks) {
        showSummary();
        return;
      }

      const isLong = (timerState.blocksCompleted % config.longBreakEvery === 0);
      switchMode(isLong ? 'long' : 'short');
    } else {
      timerState.currentBlock++;
      switchMode('focus');
    }
  }

  function skipToNext() {
    pauseTimer();
    playNotificationSound();

    if (timerState.mode === 'focus') {
      timerState.blocksCompleted = Math.min(timerState.blocksCompleted + 1, config.totalBlocks);

      if (timerState.blocksCompleted >= config.totalBlocks) {
        showSummary();
        return;
      }

      const isLong = (timerState.blocksCompleted % config.longBreakEvery === 0);
      switchMode(isLong ? 'long' : 'short');
    } else {
      timerState.currentBlock++;
      switchMode('focus');
    }
  }

  function switchMode(mode) {
    pauseTimer();

    const minutes = {
      focus: config.studyMinutes,
      short: config.shortBreakMinutes,
      long: config.longBreakMinutes,
    };

    timerState.mode = mode;
    timerState.totalSeconds = (minutes[mode] || 25) * 60;
    timerState.remainingSeconds = timerState.totalSeconds;

    updateTimerDisplay();
    updateRingProgress();
    updateSessionBadge();
    updateControls();
    renderBlocksIndicator();
  }

  function playNotificationSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
    } catch (_) {}
  }

  btnStart.addEventListener('click', startTimer);
  btnPause.addEventListener('click', pauseTimer);
  btnReset.addEventListener('click', resetTimer);
  btnSkip.addEventListener('click', skipToNext);

  /* ═══════════════════════════════════════════════════════════════
     PANEL DE AMBIENTE
  ════════════════════════════════════════════════════════════════ */

  const soundGenerators = {
    rain(ctx, gainNode) {
      const bufferSize = 2 * ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;

      noise.connect(filter);
      filter.connect(gainNode);
      noise.start();
      return noise;
    },

    forest(ctx, gainNode) {
      const bufferSize = 2 * ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.3;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800;
      filter.Q.value = 0.5;

      noise.connect(filter);
      filter.connect(gainNode);
      noise.start();
      return noise;
    },

    cafe(ctx, gainNode) {
      const bufferSize = 2 * ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.4;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200;

      noise.connect(filter);
      filter.connect(gainNode);
      noise.start();
      return noise;
    },

    ocean(ctx, gainNode) {
      const bufferSize = 4 * ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const wave = Math.sin(i / (ctx.sampleRate * 0.5)) * 0.5 + 0.5;
        data[i] = (Math.random() * 2 - 1) * wave * 0.6;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;

      noise.connect(filter);
      filter.connect(gainNode);
      noise.start();
      return noise;
    },

    fire(ctx, gainNode) {
      const bufferSize = 2 * ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const crackle = Math.random() > 0.98 ? (Math.random() * 2 - 1) * 0.8 : 0;
        data[i] = (Math.random() * 2 - 1) * 0.15 + crackle;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;

      noise.connect(filter);
      filter.connect(gainNode);
      noise.start();
      return noise;
    },

    white(ctx, gainNode) {
      const bufferSize = 2 * ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      noise.connect(gainNode);
      noise.start();
      return noise;
    },
  };

  function startAmbient() {
    if (ambientState.isPlaying) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const gainNode = ctx.createGain();
    gainNode.gain.value = volumeSlider.value / 100;
    gainNode.connect(ctx.destination);

    const generator = soundGenerators[ambientState.currentSound];
    const source = generator ? generator(ctx, gainNode) : null;

    ambientState.audioContext = ctx;
    ambientState.gainNode = gainNode;
    ambientState.noiseNode = source;
    ambientState.isPlaying = true;

    btnAmbient.querySelector('.icon-play').style.display = 'none';
    btnAmbient.querySelector('.icon-pause').style.display = '';
  }

  function stopAmbient() {
    if (!ambientState.isPlaying) return;

    if (ambientState.noiseNode) {
      try { ambientState.noiseNode.stop(); } catch (_) {}
    }
    if (ambientState.audioContext) {
      try { ambientState.audioContext.close(); } catch (_) {}
    }

    ambientState.isPlaying = false;
    ambientState.audioContext = null;
    ambientState.gainNode = null;
    ambientState.noiseNode = null;

    btnAmbient.querySelector('.icon-play').style.display = '';
    btnAmbient.querySelector('.icon-pause').style.display = 'none';
  }

  function updateVolume() {
    if (ambientState.gainNode) {
      ambientState.gainNode.gain.value = volumeSlider.value / 100;
    }
  }

  btnAmbient.addEventListener('click', () => {
    if (ambientState.isPlaying) {
      stopAmbient();
    } else {
      startAmbient();
    }
  });

  ambientSelect.addEventListener('change', () => {
    const wasPlaying = ambientState.isPlaying;
    if (wasPlaying) stopAmbient();
    ambientState.currentSound = ambientSelect.value;
    if (wasPlaying) startAmbient();
  });

  volumeSlider.addEventListener('input', updateVolume);

  /* ═══════════════════════════════════════════════════════════════
     LISTA DE TAREAS
  ════════════════════════════════════════════════════════════════ */

  function createTaskElement(task) {
    const li = document.createElement('li');
    li.className = `task-item ${task.done ? 'task-item--done' : 'task-item--active'}`;
    li.dataset.id = task.id;

    const blockText = task.doneBlock ? `Bloque ${task.doneBlock}` : '';

    li.innerHTML = `
      <div class="task-item__left">
        <button class="task-item__complete" type="button"
                aria-label="${task.done ? 'Marcar como pendiente' : 'Marcar como completada'}"
                aria-pressed="${task.done}">
          <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
      </div>
      <div class="task-item__body">
        <span class="task-item__text">${escapeHtml(task.text)}</span>
        <span class="task-item__active-badge">En foco</span>
        <span class="task-item__block-badge">${blockText}</span>
      </div>
      <div class="task-item__actions">
        <button class="task-item__focus" type="button" aria-label="Establecer como tarea activa" title="Poner en foco">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
          </svg>
        </button>
        <button class="task-item__delete" type="button" aria-label="Eliminar tarea">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    `;

    li.querySelector('.task-item__complete').addEventListener('click', () => {
      toggleTaskComplete(task.id);
    });

    li.querySelector('.task-item__focus').addEventListener('click', () => {
      setActiveTask(task.id);
    });

    li.querySelector('.task-item__delete').addEventListener('click', () => {
      deleteTask(task.id);
    });

    return li;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderTasks() {
    taskList.innerHTML = '';

    if (tasks.length === 0) {
      tasksEmpty.style.display = 'flex';
      tasksEmpty.setAttribute('aria-hidden', 'false');
    } else {
      tasksEmpty.style.display = 'none';
      tasksEmpty.setAttribute('aria-hidden', 'true');

      const sorted = [
        ...tasks.filter((t) => !t.done && t.id === activeTaskId),
        ...tasks.filter((t) => !t.done && t.id !== activeTaskId),
        ...tasks.filter((t) => t.done),
      ];

      sorted.forEach((task) => {
        const el = createTaskElement(task);
        taskList.appendChild(el);
      });
    }

    updateTaskCount();
  }

  function updateTaskCount() {
    const pending = tasks.filter((t) => !t.done).length;
    taskCount.textContent = `${pending} pendiente${pending !== 1 ? 's' : ''}`;
  }

  function addTask(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const task = {
      id: nextTaskId++,
      text: trimmed,
      done: false,
      createdAt: Date.now(),
      doneBlock: null,
      doneAt: null,
    };

    tasks.push(task);

    if (tasks.filter((t) => !t.done).length === 1) {
      activeTaskId = task.id;
    }

    renderTasks();
  }

  function toggleTaskComplete(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    task.done = !task.done;

    if (task.done) {
      task.doneBlock = getCurrentBlock();
      task.doneAt = Date.now();
      if (activeTaskId === id) {
        activeTaskId = tasks.find((t) => !t.done && t.id !== id)?.id || null;
      }
    } else {
      task.doneBlock = null;
      task.doneAt = null;
    }

    renderTasks();
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);

    if (activeTaskId === id) {
      activeTaskId = tasks.find((t) => !t.done)?.id || null;
    }

    renderTasks();
  }

  function setActiveTask(id) {
    activeTaskId = id;
    renderTasks();
  }

  function clearDoneTasks() {
    tasks = tasks.filter((t) => !t.done);
    renderTasks();
  }

  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addTask(taskInput.value);
    taskInput.value = '';
    taskInput.focus();
  });

  btnClearDone.addEventListener('click', clearDoneTasks);

  /* ═══════════════════════════════════════════════════════════════
     TERMINAR ESPACIO + GUARDAR
  ════════════════════════════════════════════════════════════════ */

  function buildSummaryHtml(data) {
    const doneTasks = data.tasks.filter((t) => t.done);
    const pendingTasks = data.tasks.filter((t) => !t.done);

    let html = `
      <div class="modal__stat">
        <span class="modal__stat-label">Espacio</span>
        <span class="modal__stat-value">${escapeHtml(data.title)}</span>
      </div>
      <div class="modal__stat">
        <span class="modal__stat-label">Hora</span>
        <span class="modal__stat-value">${formatDateTime(data.startTime)} - ${formatDateTime(data.endTime)}</span>
      </div>
      <div class="modal__stat">
        <span class="modal__stat-label">Tiempo de estudio</span>
        <span class="modal__stat-value">${formatTimeLong(data.studySeconds)}</span>
      </div>
      <div class="modal__stat">
        <span class="modal__stat-label">Bloques completados</span>
        <span class="modal__stat-value">${data.blocksDone} / ${data.totalBlocks}</span>
      </div>
      <div class="modal__stat">
        <span class="modal__stat-label">Tareas completadas</span>
        <span class="modal__stat-value">${doneTasks.length} / ${data.tasks.length}</span>
      </div>
    `;

    if (doneTasks.length > 0) {
      html += `<div style="margin-top:8px;font-size:12px;color:var(--text-muted)">Tareas completadas:</div>`;
      doneTasks.forEach((t) => {
        const elapsed = t.doneAt && t.createdAt
          ? formatTimeLong(Math.round((t.doneAt - t.createdAt) / 1000))
          : '—';
        html += `
          <div class="modal__task-summary">
            ${escapeHtml(t.text)}
            <br><span style="font-size:11px;color:var(--text-muted)">Bloque ${t.doneBlock} · Tardó ${elapsed}</span>
          </div>
        `;
      });
    }

    if (pendingTasks.length > 0) {
      html += `<div style="margin-top:8px;font-size:12px;color:var(--text-muted)">Pendientes:</div>`;
      pendingTasks.forEach((t) => {
        html += `<div class="modal__task-summary" style="opacity:0.5">${escapeHtml(t.text)}</div>`;
      });
    }

    return html;
  }

  function showSummary() {
    pauseTimer();
    stopStudyTracking();
    stopAmbient();

    const now = Date.now();
    const title = workspaceTitle.value.trim() || 'Sin nombre';

    const entry = {
      id: generateId(),
      title: title,
      date: getDateStr(),
      startTime: sessionStartTime || now,
      endTime: now,
      studySeconds: totalStudySeconds,
      blocksDone: timerState.blocksCompleted,
      totalBlocks: config.totalBlocks,
      config: { ...config },
      tasks: tasks.map((t) => ({ ...t })),
    };

    addToHistory(entry);

    modalBody.innerHTML = buildSummaryHtml(entry);
    modalOverlay.style.display = 'flex';
  }

  function resetWorkspace() {
    modalOverlay.style.display = 'none';

    // Reset timer state
    pauseTimer();
    stopStudyTracking();
    timerState.currentBlock = 1;
    timerState.blocksCompleted = 0;

    // Reset session tracking
    sessionStartTime = null;
    totalStudySeconds = 0;

    // Reset tasks (keep pending, clear done)
    tasks = tasks.filter((t) => !t.done).map((t) => ({
      ...t,
      doneBlock: null,
      doneAt: null,
    }));
    activeTaskId = tasks.find((t) => !t.done)?.id || null;
    nextTaskId = tasks.length > 0 ? Math.max(...tasks.map((t) => t.id)) + 1 : 1;

    // Clear workspace title
    workspaceTitle.value = '';

    // Reset browser title
    resetBrowserTitle();

    // Reset timer to study mode
    switchMode('focus');

    // Re-render
    renderTasks();
    renderBlocksIndicator();
  }

  btnEnd.addEventListener('click', showSummary);
  modalNew.addEventListener('click', resetWorkspace);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) resetWorkspace();
  });

  /* ═══════════════════════════════════════════════════════════════
     HISTORIAL
  ════════════════════════════════════════════════════════════════ */

  function renderHistoryList(dateStr) {
    const entries = getHistoryByDate(dateStr);
    historyList.innerHTML = '';

    if (entries.length === 0) {
      historyList.innerHTML = `<div class="history-empty">No hay espacios guardados este día</div>`;
      return;
    }

    entries.forEach((entry) => {
      const doneCount = entry.tasks.filter((t) => t.done).length;

      const card = document.createElement('div');
      card.className = 'history-card';
      card.innerHTML = `
        <div class="history-card__info">
          <div class="history-card__title">${escapeHtml(entry.title)}</div>
          <div class="history-card__meta">${formatDateTime(entry.startTime)} - ${formatDateTime(entry.endTime)}</div>
        </div>
        <div class="history-card__stats">
          <div class="history-card__stat">
            <div class="history-card__stat-value">${formatTimeLong(entry.studySeconds)}</div>
            <div class="history-card__stat-label">estudio</div>
          </div>
          <div class="history-card__stat">
            <div class="history-card__stat-value">${entry.blocksDone}/${entry.totalBlocks}</div>
            <div class="history-card__stat-label">bloques</div>
          </div>
          <div class="history-card__stat">
            <div class="history-card__stat-value">${doneCount}/${entry.tasks.length}</div>
            <div class="history-card__stat-label">tareas</div>
          </div>
        </div>
        <button class="history-card__delete" data-id="${entry.id}" type="button" aria-label="Eliminar">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      `;

      card.querySelector('.history-card__info').addEventListener('click', () => {
        showDetail(entry.id);
      });

      card.querySelector('.history-card__delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFromHistory(entry.id);
        renderHistoryList(historyDate.value);
      });

      historyList.appendChild(card);
    });
  }

  function showHistory() {
    historyDate.value = getDateStr();
    renderHistoryList(historyDate.value);
    historyOverlay.style.display = 'flex';
  }

  function closeHistory() {
    historyOverlay.style.display = 'none';
  }

  btnHistory.addEventListener('click', showHistory);
  historyClose.addEventListener('click', closeHistory);
  historyOverlay.addEventListener('click', (e) => {
    if (e.target === historyOverlay) closeHistory();
  });

  historyDate.addEventListener('change', () => {
    renderHistoryList(historyDate.value);
  });

  historyPrev.addEventListener('click', () => {
    const d = new Date(historyDate.value);
    d.setDate(d.getDate() - 1);
    historyDate.value = getDateStr(d);
    renderHistoryList(historyDate.value);
  });

  historyNext.addEventListener('click', () => {
    const d = new Date(historyDate.value);
    d.setDate(d.getDate() + 1);
    historyDate.value = getDateStr(d);
    renderHistoryList(historyDate.value);
  });

  /* ═══════════════════════════════════════════════════════════════
     DETALLE DE ESPACIO GUARDADO
  ════════════════════════════════════════════════════════════════ */

  function showDetail(id) {
    const history = loadHistory();
    const entry = history.find((h) => h.id === id);
    if (!entry) return;

    currentDetailId = id;
    detailTitle.textContent = entry.title || 'Sin nombre';
    detailBody.innerHTML = buildSummaryHtml(entry);
    detailOverlay.style.display = 'flex';
  }

  function closeDetail() {
    detailOverlay.style.display = 'none';
    currentDetailId = null;
  }

  detailClose.addEventListener('click', closeDetail);
  detailOverlay.addEventListener('click', (e) => {
    if (e.target === detailOverlay) closeDetail();
  });

  detailDelete.addEventListener('click', () => {
    if (currentDetailId) {
      deleteFromHistory(currentDetailId);
      closeDetail();
      renderHistoryList(historyDate.value);
    }
  });

  /* ═══════════════════════════════════════════════════════════════
     TUTORIAL
  ════════════════════════════════════════════════════════════════ */

  const TUTORIAL_KEY = 'sala_trabajo_skip_tutorial';
  const tutorialOverlay = $('#js-tutorial-overlay');
  const tutorialSpotlight = $('#js-tutorial-spotlight');
  const tutorialCard = $('#js-tutorial-card');
  const tutorialStepNum = $('#js-tutorial-step-num');
  const tutorialTitle = $('#js-tutorial-title');
  const tutorialText = $('#js-tutorial-text');
  const tutorialPrev = $('#js-tutorial-prev');
  const tutorialNext = $('#js-tutorial-next');
  const tutorialSkip = $('#js-tutorial-skip');

  const tutorialSteps = [
    {
      target: '#js-workspace-title',
      title: 'Nombre del espacio',
      text: 'Escribe un nombre para tu sesión de trabajo. Esto te ayudará a identificarla en el historial.',
    },
    {
      target: '#js-timer-display',
      title: 'Temporizador',
      text: 'Aquí se muestra el tiempo restante del bloque actual. El anillo verde indica el progreso.',
    },
    {
      target: '.session-controls',
      title: 'Controles',
      text: 'Inicia, pausa o reinicia el temporizador. Con "Saltar" pasas directamente al siguiente bloque o descanso.',
    },
    {
      target: '#js-blocks-indicator',
      title: 'Progreso de bloques',
      text: 'Muestra cuántos bloques has completado. Los puntos entre ellos indican los descansos.',
    },
    {
      target: '.templates-panel',
      title: 'Plantillas rápidas',
      text: 'Selecciona una plantilla para configurar rápidamente tu sesión: 1h, 2h o 3h de estudio.',
    },
    {
      target: '#js-config-toggle',
      title: 'Configuración personalizada',
      text: 'Aquí puedes ajustar los tiempos de estudio, descansos y cantidad de bloques a tu medida.',
    },
    {
      target: '.ambient-panel',
      title: 'Sonidos de ambiente',
      text: 'Elige un sonido de fondo (lluvia, bosque, café...) para concentrarte mejor. Ajusta el volumen a tu gusto.',
    },
    {
      target: '#js-task-input',
      title: 'Lista de tareas',
      text: 'Agrega las tareas que quieres completar. Al terminarlas, se registra en qué bloque lo hiciste.',
    },
    {
      target: '#js-btn-end',
      title: 'Terminar espacio',
      text: 'Cuando termines, presiona aquí para ver tu resumen: tiempo de estudio, bloques y tareas completadas.',
    },
    {
      target: '#js-btn-history',
      title: 'Historial',
      text: 'Revisa tus espacios anteriores organizados por fecha. Puedes ver estadísticas y eliminarlos.',
    },
  ];

  let tutorialStep = 0;

  function positionTutorial() {
    const step = tutorialSteps[tutorialStep];
    const target = document.querySelector(step.target);

    if (!target) return;

    const rect = target.getBoundingClientRect();
    const padding = 8;

    // Position spotlight
    tutorialSpotlight.style.top = `${rect.top - padding}px`;
    tutorialSpotlight.style.left = `${rect.left - padding}px`;
    tutorialSpotlight.style.width = `${rect.width + padding * 2}px`;
    tutorialSpotlight.style.height = `${rect.height + padding * 2}px`;

    // Position card
    const cardWidth = 340;
    const cardHeight = 200;
    const margin = 16;

    let cardTop, cardLeft;

    // Try below, then above, then right, then left
    if (rect.bottom + cardHeight + margin < window.innerHeight) {
      cardTop = rect.bottom + margin;
      cardLeft = rect.left + rect.width / 2 - cardWidth / 2;
    } else if (rect.top - cardHeight - margin > 0) {
      cardTop = rect.top - cardHeight - margin;
      cardLeft = rect.left + rect.width / 2 - cardWidth / 2;
    } else if (rect.right + cardWidth + margin < window.innerWidth) {
      cardTop = rect.top + rect.height / 2 - cardHeight / 2;
      cardLeft = rect.right + margin;
    } else {
      cardTop = rect.top + rect.height / 2 - cardHeight / 2;
      cardLeft = rect.left - cardWidth - margin;
    }

    // Clamp to viewport
    cardLeft = Math.max(margin, Math.min(cardLeft, window.innerWidth - cardWidth - margin));
    cardTop = Math.max(margin, Math.min(cardTop, window.innerHeight - cardHeight - margin));

    tutorialCard.style.top = `${cardTop}px`;
    tutorialCard.style.left = `${cardLeft}px`;
    tutorialCard.style.transform = 'none';
  }

  function renderTutorialStep() {
    const step = tutorialSteps[tutorialStep];
    const total = tutorialSteps.length;

    tutorialStepNum.textContent = `Paso ${tutorialStep + 1} de ${total}`;
    tutorialTitle.textContent = step.title;
    tutorialText.textContent = step.text;

    tutorialPrev.style.visibility = tutorialStep === 0 ? 'hidden' : 'visible';
    tutorialNext.textContent = tutorialStep === total - 1 ? 'Finalizar' : 'Siguiente';

    positionTutorial();
  }

  function startTutorial() {
    tutorialStep = 0;
    tutorialOverlay.style.display = 'block';
    renderTutorialStep();
  }

  function closeTutorial() {
    tutorialOverlay.style.display = 'none';
    if (tutorialSkip.checked) {
      localStorage.setItem(TUTORIAL_KEY, '1');
    }
  }

  tutorialNext.addEventListener('click', () => {
    if (tutorialStep < tutorialSteps.length - 1) {
      tutorialStep++;
      renderTutorialStep();
    } else {
      closeTutorial();
    }
  });

  tutorialPrev.addEventListener('click', () => {
    if (tutorialStep > 0) {
      tutorialStep--;
      renderTutorialStep();
    }
  });

  tutorialOverlay.addEventListener('click', (e) => {
    if (e.target === tutorialOverlay) closeTutorial();
  });

  // Recalculate on resize
  window.addEventListener('resize', () => {
    if (tutorialOverlay.style.display !== 'none') {
      positionTutorial();
    }
  });

  /* ═══════════════════════════════════════════════════════════════
     WELCOME + TUTORIAL LAUNCH
  ════════════════════════════════════════════════════════════════ */

  const WELCOME_KEY = 'sala_trabajo_skip_welcome';

  function showWelcome() {
    welcomeOverlay.style.display = 'flex';
  }

  function closeWelcome() {
    welcomeOverlay.style.display = 'none';
    if (welcomeSkip.checked) {
      localStorage.setItem(WELCOME_KEY, '1');
    }
    // Start tutorial after welcome
    const skipTutorial = localStorage.getItem(TUTORIAL_KEY);
    if (!skipTutorial) {
      setTimeout(startTutorial, 300);
    }
  }

  welcomeStart.addEventListener('click', closeWelcome);
  welcomeOverlay.addEventListener('click', (e) => {
    if (e.target === welcomeOverlay) closeWelcome();
  });

  btnTutorial.addEventListener('click', startTutorial);

  /* ═══════════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════════════ */

  function init() {
    tasks = [
      { id: 1, text: 'Revisar apuntes de la sesión anterior', done: false, createdAt: Date.now(), doneBlock: null, doneAt: null },
      { id: 2, text: 'Configurar entorno de trabajo', done: true, createdAt: Date.now() - 300000, doneBlock: 1, doneAt: Date.now() - 60000 },
    ];
    nextTaskId = 3;
    activeTaskId = 1;

    renderTasks();
    renderBlocksIndicator();

    updateTimerDisplay();
    updateRingProgress();
    updateSessionBadge();
    updateControls();

    // Show welcome if not skipped
    const skipWelcome = localStorage.getItem(WELCOME_KEY);
    if (!skipWelcome) {
      setTimeout(showWelcome, 400);
    }
  }

  init();
})();
