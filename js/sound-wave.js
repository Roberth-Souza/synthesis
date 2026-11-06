/* =========================================================
   Laboratório de ondas (seção "A Física do Som")
   Desenha a onda e toca um som com frequência, volume e timbre ajustáveis.
   ========================================================= */
(function (S) {
  'use strict';

  const canvas = document.getElementById('waveCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  // No modo leve a onda fica parada e só é redesenhada quando um controle muda
  const liteMode = document.documentElement.classList.contains('lite');
  const freqSlider = document.getElementById('freqSlider');
  const ampSlider = document.getElementById('ampSlider');
  const freqLabel = document.getElementById('waveFreq');
  const noteLabel = document.getElementById('waveNote');
  const playBtn = document.getElementById('wavePlay');
  const typeButtons = document.querySelectorAll('#waveTypes [data-type]');
  const presetButtons = document.querySelectorAll('#wavePresets [data-freq]');

  // O slider vai de 110 Hz a 1760 Hz (4 oitavas) em escala logarítmica,
  // assim cada pedaço do slider corresponde ao mesmo "salto" musical
  const MIN_FREQUENCY = 110;
  const OCTAVES = 4;

  const state = { frequency: 440, amplitude: 0.6, type: 'sine', playing: false, phase: 0 };
  let tone = null;
  let width = 0;
  let height = 0;
  let running = false;

  function sliderToFrequency(value) {
    return MIN_FREQUENCY * Math.pow(2, (value / 1000) * OCTAVES);
  }

  function frequencyToSlider(frequency) {
    return (Math.log2(frequency / MIN_FREQUENCY) / OCTAVES) * 1000;
  }

  // Valor da onda (-1 a 1) em um ponto, de acordo com o timbre escolhido
  function waveValue(type, angle) {
    switch (type) {
      case 'square':
        return Math.sin(angle) >= 0 ? 1 : -1;
      case 'triangle':
        return (2 / Math.PI) * Math.asin(Math.sin(angle));
      case 'sawtooth': {
        const cycle = angle / (2 * Math.PI);
        return 2 * (cycle - Math.floor(cycle + 0.5));
      }
      default:
        return Math.sin(angle);
    }
  }

  function updateReadout() {
    freqLabel.textContent = `${state.frequency.toFixed(1)} Hz`;
    const midi = Math.round(S.audio.frequencyToMidi(state.frequency));
    const info = S.audio.noteInfo(midi);
    const cents = Math.round(1200 * Math.log2(state.frequency / S.audio.midiToFrequency(midi)));
    const tuning = cents === 0 ? 'afinado' : `${cents > 0 ? '+' : ''}${cents} cents`;
    noteLabel.textContent = `≈ ${info.namePt} (${info.name}) · ${tuning}`;
  }

  /* ---------- Desenho ---------- */

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  function traceWave() {
    // Frequência mais alta = mais ciclos na tela
    const cycles = 1 + (state.frequency / MIN_FREQUENCY) * 1.2;
    const amplitude = state.amplitude * height * 0.36;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 2) {
      const angle = (x / width) * cycles * Math.PI * 2 - state.phase;
      const y = height / 2 - waveValue(state.type, angle) * amplitude;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }

  function renderFrame() {
    ctx.clearRect(0, 0, width, height);
    drawGrid();

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'rgba(212, 175, 55, 0)');
    gradient.addColorStop(0.12, '#d4af37');
    gradient.addColorStop(0.5, '#fff3cf');
    gradient.addColorStop(0.88, '#d4af37');
    gradient.addColorStop(1, 'rgba(212, 175, 55, 0)');

    // Primeiro um traço largo e fraco (brilho), depois o traço nítido por cima
    traceWave();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
    ctx.lineWidth = 10;
    ctx.stroke();

    traceWave();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.2;
    // Brilho borrado só no modo normal: sem placa de vídeo o desfoque é o efeito mais caro do canvas
    if (!liteMode) {
      ctx.shadowColor = 'rgba(212, 175, 55, 0.9)';
      ctx.shadowBlur = state.playing ? 18 : 8;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function draw() {
    if (!running) return;
    // A onda "anda" mais rápido quando está tocando
    state.phase += state.playing ? 0.09 : 0.025;
    renderFrame();
    requestAnimationFrame(draw);
  }

  // Modo leve: um único desenho por mudança, agrupado no próximo quadro
  let renderQueued = false;
  function requestRender() {
    if (!liteMode || renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderFrame();
    });
  }

  /* ---------- Som ---------- */

  function startTone() {
    tone = S.audio.createTone(state.type);
    if (!tone) return;
    tone.setFrequency(state.frequency);
    tone.setAmplitude(state.amplitude);
    state.playing = true;
    playBtn.textContent = '■ Parar';
    playBtn.classList.add('is-playing');
    requestRender();
  }

  function stopTone() {
    if (tone) tone.stop();
    tone = null;
    state.playing = false;
    playBtn.textContent = '▶ Ouvir a onda';
    playBtn.classList.remove('is-playing');
    requestRender();
  }

  function setFrequency(frequency) {
    state.frequency = frequency;
    if (tone) tone.setFrequency(frequency);
    updateReadout();
    requestRender();
  }

  /* ---------- Controles ---------- */

  freqSlider.addEventListener('input', () => setFrequency(sliderToFrequency(Number(freqSlider.value))));

  ampSlider.addEventListener('input', () => {
    state.amplitude = Number(ampSlider.value);
    if (tone) tone.setAmplitude(state.amplitude);
    requestRender();
  });

  typeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      typeButtons.forEach((other) => other.classList.remove('is-active'));
      button.classList.add('is-active');
      state.type = button.dataset.type;
      if (tone) tone.setType(state.type);
      requestRender();
    });
  });

  presetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      freqSlider.value = frequencyToSlider(Number(button.dataset.freq));
      // Dispara o evento para atualizar a frequência e o preenchimento dourado do slider
      freqSlider.dispatchEvent(new Event('input'));
      if (!state.playing) startTone();
    });
  });

  playBtn.addEventListener('click', () => {
    if (state.playing) stopTone();
    else startTone();
  });

  window.addEventListener('resize', () => {
    resize();
    requestRender();
  });
  resize();
  updateReadout();
  requestRender();

  // Para de desenhar (e de tocar) quando a seção sai da tela
  new IntersectionObserver((entries) => {
    const visible = entries[0].isIntersecting;
    if (visible && !running && !liteMode) {
      running = true;
      requestAnimationFrame(draw);
    } else if (!visible) {
      running = false;
      if (state.playing) stopTone();
    }
  }).observe(canvas);
})(window.Synthesis);
