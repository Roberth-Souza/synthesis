/* =========================================================
   Teclado de piano reutilizável
   Usado no piano principal, na seção de acordes e no jogo.
   ========================================================= */
window.Synthesis = window.Synthesis || {};

(function (S) {
  'use strict';

  const PARTICLE_SYMBOLS = ['♪', '♫', '♩', '♬'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const liteMode = document.documentElement.classList.contains('lite');

  /* Agenda ações no futuro (ex.: tocar notas de uma música) e permite cancelar todas */
  S.createScheduler = function () {
    let timers = [];
    return {
      at(milliseconds, callback) {
        timers.push(setTimeout(callback, milliseconds));
      },
      cancel() {
        timers.forEach(clearTimeout);
        timers = [];
      },
    };
  };

  /*
    Cria um teclado dentro de "container".
    Opções:
      startMidi / endMidi  primeira e última nota (números MIDI)
      whiteOnly            só teclas brancas
      labels               { midi: 'texto' } escrito em cada tecla
      particleLayer        elemento onde as notinhas animadas aparecem
      onPress / onRelease  funções chamadas com (midi, origem); origem é 'user' ou 'auto'
  */
  S.createKeyboard = function (container, options) {
    const {
      startMidi,
      endMidi,
      whiteOnly = false,
      labels = {},
      particleLayer = null,
      onPress = null,
      onRelease = null,
    } = options;

    const keys = new Map();         // midi -> elemento da tecla
    const voices = new Map();       // midi -> som tocando
    const pointerNotes = new Map(); // dedo/mouse -> nota que ele está segurando

    /* ---------- Montagem das teclas ---------- */

    function createKey(midi, color) {
      const info = S.audio.noteInfo(midi);
      const key = document.createElement('div');
      key.className = `key key--${color}`;
      key.dataset.midi = midi;
      key.setAttribute('role', 'button');
      key.setAttribute('aria-label', `${info.namePt} (${info.name})`);

      // Marca o Dó de cada oitava, como os pianos de estudo
      if (info.name.startsWith('C') && !info.isBlack) {
        const octave = document.createElement('span');
        octave.className = 'key__octave';
        octave.textContent = info.name;
        key.appendChild(octave);
      }
      if (labels[midi]) {
        const label = document.createElement('span');
        label.className = 'key__label';
        label.textContent = labels[midi];
        key.appendChild(label);
      }

      container.appendChild(key);
      keys.set(midi, key);
      return key;
    }

    function buildKeys() {
      container.innerHTML = '';
      let whiteCount = 0;
      for (let midi = startMidi; midi <= endMidi; midi++) {
        if (!S.audio.noteInfo(midi).isBlack) whiteCount++;
      }
      container.style.setProperty('--white-count', whiteCount);

      // Teclas brancas ocupam o espaço por igual; as pretas ficam por cima, na divisa entre duas brancas
      let whiteIndex = 0;
      for (let midi = startMidi; midi <= endMidi; midi++) {
        if (S.audio.noteInfo(midi).isBlack) {
          if (whiteOnly) continue;
          const key = createKey(midi, 'black');
          key.style.left = `calc(${(whiteIndex / whiteCount) * 100}% - var(--black-width) / 2)`;
        } else {
          createKey(midi, 'white');
          whiteIndex++;
        }
      }
    }

    /* ---------- Notinhas animadas ---------- */

    function spawnParticle(key) {
      if (!particleLayer || reducedMotion || liteMode) return;
      const layerRect = particleLayer.getBoundingClientRect();
      const keyRect = key.getBoundingClientRect();
      const particle = document.createElement('span');
      particle.className = 'note-particle';
      particle.textContent = PARTICLE_SYMBOLS[Math.floor(Math.random() * PARTICLE_SYMBOLS.length)];
      particle.style.left = `${keyRect.left + keyRect.width / 2 - layerRect.left}px`;
      particle.style.top = `${keyRect.top - layerRect.top}px`;
      particle.style.setProperty('--drift', `${(Math.random() - 0.5) * 90}px`);
      particle.style.setProperty('--spin', `${(Math.random() - 0.5) * 60}deg`);
      particleLayer.appendChild(particle);
      particle.addEventListener('animationend', () => particle.remove());
    }

    /* ---------- Tocar e soltar ---------- */

    function press(midi, source = 'user') {
      const key = keys.get(midi);
      if (!key) return;
      if (voices.has(midi)) voices.get(midi).release();
      const voice = S.audio.playNote(midi);
      if (voice) voices.set(midi, voice);
      key.classList.add('is-active');
      spawnParticle(key);
      if (onPress) onPress(midi, source);
    }

    function release(midi, source = 'user') {
      const voice = voices.get(midi);
      if (voice) {
        voice.release();
        voices.delete(midi);
      }
      const key = keys.get(midi);
      if (key) key.classList.remove('is-active');
      if (onRelease) onRelease(midi, source);
    }

    function releaseAll(source = 'auto') {
      keys.forEach((key, midi) => {
        if (key.classList.contains('is-active') || voices.has(midi)) release(midi, source);
      });
    }

    function highlight(midis, className = 'is-highlight') {
      midis.forEach((midi) => {
        const key = keys.get(midi);
        if (key) key.classList.add(className);
      });
    }

    function clearHighlight(className = 'is-highlight') {
      keys.forEach((key) => key.classList.remove(className));
    }

    /* ---------- Mouse e toque (inclui deslizar o dedo pelas teclas) ---------- */

    function midiFromEvent(event) {
      const key = event.target.closest('.key');
      return key ? Number(key.dataset.midi) : null;
    }

    container.addEventListener('pointerdown', (event) => {
      const midi = midiFromEvent(event);
      if (midi === null) return;
      event.preventDefault();
      // No toque, o navegador "prende" o dedo na primeira tecla; liberamos para permitir deslizar
      if (event.target.hasPointerCapture && event.target.hasPointerCapture(event.pointerId)) {
        event.target.releasePointerCapture(event.pointerId);
      }
      pointerNotes.set(event.pointerId, midi);
      press(midi, 'user');
    });

    container.addEventListener('pointerover', (event) => {
      if (!pointerNotes.has(event.pointerId)) return;
      const midi = midiFromEvent(event);
      const previous = pointerNotes.get(event.pointerId);
      if (midi === null || midi === previous) return;
      release(previous, 'user');
      pointerNotes.set(event.pointerId, midi);
      press(midi, 'user');
    });

    function endPointer(event) {
      if (!pointerNotes.has(event.pointerId)) return;
      release(pointerNotes.get(event.pointerId), 'user');
      pointerNotes.delete(event.pointerId);
    }
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);
    container.addEventListener('pointerleave', endPointer);

    buildKeys();

    return { press, release, releaseAll, highlight, clearHighlight };
  };
})(window.Synthesis);
