/* =========================================================
   Piano principal
   Teclado do computador, músicas de demonstração, gravação e visualizador.
   ========================================================= */
(function (S) {
  'use strict';

  const container = document.getElementById('mainKeyboard');
  if (!container) return;

  const liteMode = document.documentElement.classList.contains('lite');

  // Tecla física do computador (event.code) -> nota MIDI. Funciona em teclado ABNT2 e americano
  const KEY_MAP = {
    KeyZ: 60, KeyS: 61, KeyX: 62, KeyD: 63, KeyC: 64, KeyV: 65, KeyG: 66,
    KeyB: 67, KeyH: 68, KeyN: 69, KeyJ: 70, KeyM: 71,
    KeyQ: 72, Digit2: 73, KeyW: 74, Digit3: 75, KeyE: 76, KeyR: 77, Digit5: 78,
    KeyT: 79, Digit6: 80, KeyY: 81, Digit7: 82, KeyU: 83, KeyI: 84,
  };

  // Músicas em domínio público: [nota MIDI, duração em tempos]
  const SONGS = {
    furElise: {
      bpm: 150,
      notes: [
        [76, 0.5], [75, 0.5], [76, 0.5], [75, 0.5], [76, 0.5], [71, 0.5], [74, 0.5], [72, 0.5], [69, 1],
        [60, 0.5], [64, 0.5], [69, 0.5], [71, 1],
        [64, 0.5], [68, 0.5], [71, 0.5], [72, 1],
        [64, 0.5], [76, 0.5], [75, 0.5], [76, 0.5], [75, 0.5], [76, 0.5], [71, 0.5], [74, 0.5], [72, 0.5], [69, 1],
        [60, 0.5], [64, 0.5], [69, 0.5], [71, 1],
        [64, 0.5], [72, 0.5], [71, 0.5], [69, 2],
      ],
    },
    odeToJoy: {
      bpm: 132,
      notes: [
        [76, 1], [76, 1], [77, 1], [79, 1], [79, 1], [77, 1], [76, 1], [74, 1],
        [72, 1], [72, 1], [74, 1], [76, 1], [76, 1.5], [74, 0.5], [74, 2],
        [76, 1], [76, 1], [77, 1], [79, 1], [79, 1], [77, 1], [76, 1], [74, 1],
        [72, 1], [72, 1], [74, 1], [76, 1], [74, 1.5], [72, 0.5], [72, 2],
      ],
    },
    twinkle: {
      bpm: 120,
      notes: [
        [60, 1], [60, 1], [67, 1], [67, 1], [69, 1], [69, 1], [67, 2],
        [65, 1], [65, 1], [64, 1], [64, 1], [62, 1], [62, 1], [60, 2],
        [67, 1], [67, 1], [65, 1], [65, 1], [64, 1], [64, 1], [62, 2],
        [67, 1], [67, 1], [65, 1], [65, 1], [64, 1], [64, 1], [62, 2],
        [60, 1], [60, 1], [67, 1], [67, 1], [69, 1], [69, 1], [67, 2],
        [65, 1], [65, 1], [64, 1], [64, 1], [62, 1], [62, 1], [60, 2],
      ],
    },
  };

  const noteEl = document.getElementById('pianoNote');
  const noteNameEl = document.getElementById('pianoNoteName');
  const recordBtn = document.getElementById('recordBtn');
  const playRecordingBtn = document.getElementById('playRecordingBtn');
  const volumeInput = document.getElementById('volume');
  const showLabelsInput = document.getElementById('showLabels');
  const songButtons = document.querySelectorAll('[data-song]');

  const player = S.createScheduler();
  const recording = { active: false, events: [], startTime: 0 };
  let playingButton = null;

  const labels = {};
  Object.entries(KEY_MAP).forEach(([code, midi]) => {
    labels[midi] = code.replace('Key', '').replace('Digit', '');
  });

  const keyboard = S.createKeyboard(container, {
    startMidi: 60,
    endMidi: 84,
    labels,
    particleLayer: container.closest('.piano'),
    onPress: handlePress,
    onRelease: handleRelease,
  });

  /* ---------- Mostrador da nota ---------- */

  function showNote(midi) {
    const info = S.audio.noteInfo(midi);
    noteEl.textContent = info.name;
    noteNameEl.textContent = `${info.namePt} · ${S.audio.midiToFrequency(midi).toFixed(1)} Hz`;
    if (liteMode) return;
    // Reinicia a animação de "pulo"
    noteEl.classList.remove('is-pop');
    void noteEl.offsetWidth;
    noteEl.classList.add('is-pop');
  }

  function handlePress(midi, source) {
    showNote(midi);
    if (recording.active && source === 'user') {
      recording.events.push({ type: 'on', midi, time: performance.now() - recording.startTime });
    }
  }

  function handleRelease(midi, source) {
    if (recording.active && source === 'user') {
      recording.events.push({ type: 'off', midi, time: performance.now() - recording.startTime });
    }
  }

  /* ---------- Teclado do computador ---------- */

  const heldCodes = new Set();

  function isTypingField(element) {
    return element && (element.tagName === 'TEXTAREA' || element.isContentEditable
      || (element.tagName === 'INPUT' && !['range', 'checkbox'].includes(element.type)));
  }

  document.addEventListener('keydown', (event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || isTypingField(event.target)) return;
    const midi = KEY_MAP[event.code];
    if (midi === undefined) return;
    event.preventDefault();
    heldCodes.add(event.code);
    keyboard.press(midi, 'user');
  });

  document.addEventListener('keyup', (event) => {
    if (!heldCodes.has(event.code)) return;
    heldCodes.delete(event.code);
    keyboard.release(KEY_MAP[event.code], 'user');
  });

  // Se a janela perder o foco com tecla apertada, solta tudo
  window.addEventListener('blur', () => {
    heldCodes.clear();
    keyboard.releaseAll('user');
  });

  /* ---------- Reprodução (músicas e gravação) ---------- */

  function markPlaying(button) {
    playingButton = button;
    button.dataset.label = button.textContent;
    button.textContent = '■ Parar';
    button.classList.add('is-playing');
  }

  function stopPlayback() {
    player.cancel();
    keyboard.releaseAll();
    if (playingButton) {
      playingButton.textContent = playingButton.dataset.label;
      playingButton.classList.remove('is-playing');
      playingButton = null;
    }
  }

  function playSong(name, button) {
    stopPlayback();
    const song = SONGS[name];
    const beatMs = 60000 / song.bpm;
    let time = 0;
    song.notes.forEach(([midi, beats]) => {
      const duration = beats * beatMs;
      player.at(time, () => keyboard.press(midi, 'auto'));
      player.at(time + duration * 0.85, () => keyboard.release(midi, 'auto'));
      time += duration;
    });
    player.at(time + 300, stopPlayback);
    markPlaying(button);
  }

  function playRecording() {
    stopPlayback();
    recording.events.forEach((event) => {
      player.at(event.time, () => {
        if (event.type === 'on') keyboard.press(event.midi, 'auto');
        else keyboard.release(event.midi, 'auto');
      });
    });
    const lastTime = recording.events[recording.events.length - 1].time;
    player.at(lastTime + 600, stopPlayback);
    markPlaying(playRecordingBtn);
  }

  function toggleRecording() {
    if (recording.active) {
      recording.active = false;
      recordBtn.textContent = '● Gravar';
      recordBtn.classList.remove('is-recording');
      playRecordingBtn.disabled = recording.events.length === 0;
      return;
    }
    stopPlayback();
    recording.active = true;
    recording.events = [];
    recording.startTime = performance.now();
    recordBtn.textContent = '■ Parar gravação';
    recordBtn.classList.add('is-recording');
    playRecordingBtn.disabled = true;
  }

  songButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (playingButton === button) stopPlayback();
      else playSong(button.dataset.song, button);
    });
  });

  recordBtn.addEventListener('click', toggleRecording);
  playRecordingBtn.addEventListener('click', () => {
    if (playingButton === playRecordingBtn) stopPlayback();
    else playRecording();
  });

  volumeInput.addEventListener('input', () => S.audio.setVolume(Number(volumeInput.value)));
  showLabelsInput.addEventListener('change', () => {
    container.classList.toggle('hide-labels', !showLabelsInput.checked);
  });

  /* ---------- Visualizador de ondas ---------- */

  function setupVisualizer() {
    const canvas = document.getElementById('pianoVisualizer');
    if (!canvas || liteMode) return;

    const ctx = canvas.getContext('2d');
    const BAR_COUNT = 64;
    const WAVE_SAMPLES = 600; // quantas amostras do som aparecem na tela
    let width = 0;
    let height = 0;
    let gradient = null;
    let timeData = null;
    let frequencyData = null;
    let running = false;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gradient = createWaveGradient();
    }

    // O degradê só depende da largura, então é criado uma vez (e não a cada quadro)
    function createWaveGradient() {
      const result = ctx.createLinearGradient(0, 0, width, 0);
      result.addColorStop(0, 'rgba(212, 175, 55, 0)');
      result.addColorStop(0.15, '#d4af37');
      result.addColorStop(0.5, '#f3dc93');
      result.addColorStop(0.85, '#d4af37');
      result.addColorStop(1, 'rgba(212, 175, 55, 0)');
      return result;
    }

    function drawBars(analyser) {
      analyser.getByteFrequencyData(frequencyData);
      const barWidth = width / BAR_COUNT;
      const usableBins = Math.floor(frequencyData.length * 0.25); // graves e médios, onde está o piano
      for (let i = 0; i < BAR_COUNT; i++) {
        const value = frequencyData[Math.floor((i / BAR_COUNT) * usableBins)] / 255;
        const barHeight = value * height * 0.9;
        ctx.fillStyle = `rgba(212, 175, 55, ${0.06 + value * 0.35})`;
        ctx.fillRect(i * barWidth + 1, height - barHeight, barWidth - 2, barHeight);
      }
    }

    function drawWave(analyser, now) {
      if (analyser) analyser.getByteTimeDomainData(timeData);

      ctx.beginPath();
      for (let x = 0; x <= width; x += 2) {
        const idle = Math.sin(x * 0.03 + now * 0.002) * 1.5; // "respiração" quando não há som
        let sample = 0;
        if (analyser) {
          sample = (timeData[Math.floor((x / width) * WAVE_SAMPLES)] - 128) / 128;
        }
        const y = height / 2 + Math.max(-1, Math.min(1, sample * 2)) * height * 0.42 + idle;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(212, 175, 55, 0.8)';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    function draw(now) {
      if (!running) return;
      requestAnimationFrame(draw);
      ctx.clearRect(0, 0, width, height);
      const analyser = S.audio.getAnalyser();
      if (analyser && !timeData) {
        timeData = new Uint8Array(analyser.fftSize);
        frequencyData = new Uint8Array(analyser.frequencyBinCount);
      }
      if (analyser) drawBars(analyser);
      drawWave(analyser, now);
    }

    window.addEventListener('resize', resize);
    resize();

    new IntersectionObserver((entries) => {
      const visible = entries[0].isIntersecting;
      if (visible && !running) {
        running = true;
        requestAnimationFrame(draw);
      } else if (!visible) {
        running = false;
      }
    }).observe(canvas);
  }

  setupVisualizer();
})(window.Synthesis);
