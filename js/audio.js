/* =========================================================
   Motor de áudio do Synthesis
   Todo o som é gerado por código com a Web Audio API:
   não existe nenhum arquivo de áudio no site.
   ========================================================= */
window.Synthesis = window.Synthesis || {};

(function (S) {
  'use strict';

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NOTE_NAMES_PT = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];

  // Ondas quadrada e dente de serra soam muito mais altas, então usam volume menor
  const TONE_LEVELS = { sine: 0.32, triangle: 0.32, square: 0.1, sawtooth: 0.13 };

  // "Ingredientes" do timbre do piano: cada oscilador é um harmônico
  const PIANO_PARTIALS = [
    { type: 'triangle', ratio: 1, gain: 1 },
    { type: 'sine', ratio: 2, gain: 0.35 },
    { type: 'sine', ratio: 3, gain: 0.12 },
  ];
  const PIANO_HARMONICS = 32;
  const REVERB_SECONDS = 1.4;

  // Modo leve (classe .lite no <html>): sem reverb e com limite de notas soando ao mesmo tempo
  const LITE_MODE = document.documentElement.classList.contains('lite');
  const LITE_MAX_VOICES = 8;
  const activeVoices = []; // notas ainda soando, da mais antiga para a mais nova

  let context = null;
  let pianoBus = null;   // entrada das notas do piano (passa pelo reverb)
  let dryBus = null;     // entrada sem reverb (tom contínuo da seção "O Som")
  let masterGain = null;
  let analyser = null;
  let pianoWave = null;  // timbre do piano pronto, reaproveitado por todas as notas
  let volume = 0.7;

  /* ---------- Conversões entre notas e frequências ---------- */

  // MIDI é um número para cada nota: 60 = Dó central, 69 = Lá 440 Hz
  function midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function frequencyToMidi(frequency) {
    return 69 + 12 * Math.log2(frequency / 440);
  }

  function noteInfo(midi) {
    const index = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    return {
      name: NOTE_NAMES[index] + octave,
      namePt: NOTE_NAMES_PT[index],
      isBlack: NOTE_NAMES[index].includes('#'),
    };
  }

  /* ---------- Montagem da "mesa de som" ---------- */

  // Soma os harmônicos de PIANO_PARTIALS numa única forma de onda.
  // Assim cada nota usa 1 oscilador em vez de 3 (mesmo som, bem menos processamento).
  function createPianoWave(ctx) {
    const real = new Float32Array(PIANO_HARMONICS);
    const imag = new Float32Array(PIANO_HARMONICS);
    PIANO_PARTIALS.forEach(({ type, ratio, gain }) => {
      if (type === 'sine') {
        imag[ratio] += gain;
        return;
      }
      // Onda triangular = harmônicos ímpares com amplitude 8 / (π·n)², alternando o sinal
      for (let n = 1; n * ratio < PIANO_HARMONICS; n += 2) {
        const sign = ((n - 1) / 2) % 2 === 0 ? 1 : -1;
        imag[n * ratio] += gain * sign * 8 / (Math.PI * n) ** 2;
      }
    });
    return ctx.createPeriodicWave(real, imag, { disableNormalization: true });
  }

  // Cria um eco de sala artificial (ruído que vai sumindo) para o reverb
  function createReverbImpulse(ctx, seconds, decay) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  // Reverb: o nó mais pesado do áudio, por isso fica de fora no modo leve
  function connectReverb(ctx, input, output) {
    const reverb = ctx.createConvolver();
    reverb.buffer = createReverbImpulse(ctx, REVERB_SECONDS, 2.5);
    const reverbLevel = ctx.createGain();
    reverbLevel.gain.value = 0.28;
    input.connect(reverb);
    reverb.connect(reverbLevel);
    reverbLevel.connect(output);
  }

  // Caminho do som: notas -> reverb -> compressor -> volume -> analisador -> caixas de som
  function buildAudioGraph(ctx) {
    pianoBus = ctx.createGain();
    dryBus = ctx.createGain();

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 4;

    masterGain = ctx.createGain();
    masterGain.gain.value = volume;

    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.82;

    pianoBus.connect(dryBus);
    if (!LITE_MODE) connectReverb(ctx, pianoBus, compressor);
    dryBus.connect(compressor);
    compressor.connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);

    pianoWave = createPianoWave(ctx);
  }

  // O navegador só libera o áudio depois de um clique/tecla, então criamos sob demanda
  function getContext() {
    if (!context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      try {
        // "balanced" pede um buffer de áudio maior: alguns ms a mais de atraso,
        // mas o som não estala quando o processador está ocupado
        context = new AudioContextClass({ latencyHint: 'balanced' });
        buildAudioGraph(context);
      } catch (error) {
        console.warn('Áudio indisponível neste navegador:', error);
        context = null;
        return null;
      }
    }
    if (context.state === 'suspended') {
      context.resume().catch(() => { /* o navegador ainda não liberou o áudio */ });
    }
    return context;
  }

  // Congela um parâmetro no valor atual antes de mudar a automação
  function holdAt(param, time) {
    if (param.cancelAndHoldAtTime) {
      param.cancelAndHoldAtTime(time);
    } else {
      const current = param.value;
      param.cancelScheduledValues(time);
      param.setValueAtTime(current, time);
    }
  }

  function safeStop(oscillator, time) {
    try {
      oscillator.stop(time);
    } catch (error) {
      /* oscilador já parado */
    }
  }

  /* ---------- Nota de piano ---------- */

  // Modo leve: se já há notas demais soando, a mais antiga some rapidinho para abrir espaço
  function makeRoomForVoice() {
    if (!LITE_MODE) return;
    while (activeVoices.length >= LITE_MAX_VOICES) {
      activeVoices.shift().silence();
    }
  }

  function forgetVoice(voice) {
    const index = activeVoices.indexOf(voice);
    if (index !== -1) activeVoices.splice(index, 1);
  }

  // Toca uma nota e devolve um objeto com release() para soltar a tecla
  function playNote(midi, velocity = 0.8) {
    const ctx = getContext();
    if (!ctx) return null;
    makeRoomForVoice();

    const now = ctx.currentTime;
    const frequency = midiToFrequency(midi);
    const peak = 0.35 * velocity;

    // Filtro que deixa o som mais "abafado" com o tempo, como uma corda real
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(Math.min(frequency * 8, 12000), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(frequency * 2, 600), now + 1.5);

    const voiceGain = ctx.createGain();
    filter.connect(voiceGain);
    voiceGain.connect(pianoBus);

    const oscillator = ctx.createOscillator();
    oscillator.setPeriodicWave(pianoWave);
    oscillator.frequency.value = frequency;
    oscillator.connect(filter);
    oscillator.start(now);
    oscillator.stop(now + 10); // segurança: nenhuma nota dura para sempre

    // Envelope: ataque rápido (martelo), queda (corda perdendo energia) e silêncio
    const gain = voiceGain.gain;
    gain.setValueAtTime(0.0001, now);
    gain.exponentialRampToValueAtTime(peak, now + 0.008);
    gain.setTargetAtTime(peak * 0.25, now + 0.008, 0.4);
    gain.setTargetAtTime(0.0001, now + 2, 1.5);

    let released = false;
    const voice = {
      release() {
        if (released) return;
        released = true;
        const time = ctx.currentTime;
        holdAt(gain, time);
        gain.setTargetAtTime(0.0001, time, 0.12);
        safeStop(oscillator, time + 1.2);
      },
      // Corte rápido (sem estalo) usado pelo limite de notas do modo leve
      silence() {
        released = true;
        const time = ctx.currentTime;
        holdAt(gain, time);
        gain.setTargetAtTime(0.0001, time, 0.015);
        safeStop(oscillator, time + 0.08);
      },
    };

    activeVoices.push(voice);
    oscillator.onended = () => {
      voiceGain.disconnect();
      forgetVoice(voice);
    };
    return voice;
  }

  /* ---------- Tom contínuo (laboratório de ondas) ---------- */

  function createTone(type) {
    const ctx = getContext();
    if (!ctx) return null;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    let currentType = type;
    let amplitude = 0.6;

    oscillator.type = type;
    gainNode.gain.value = 0;
    oscillator.connect(gainNode);
    gainNode.connect(dryBus);
    oscillator.start();

    // setTargetAtTime faz a mudança suave, evitando estalos
    function applyGain() {
      gainNode.gain.setTargetAtTime(amplitude * TONE_LEVELS[currentType], ctx.currentTime, 0.03);
    }
    applyGain();

    return {
      setFrequency(frequency) {
        oscillator.frequency.setTargetAtTime(frequency, ctx.currentTime, 0.02);
      },
      setType(newType) {
        currentType = newType;
        oscillator.type = newType;
        applyGain();
      },
      setAmplitude(value) {
        amplitude = value;
        applyGain();
      },
      stop() {
        const time = ctx.currentTime;
        holdAt(gainNode.gain, time);
        gainNode.gain.setTargetAtTime(0, time, 0.05);
        safeStop(oscillator, time + 0.4);
        oscillator.onended = () => gainNode.disconnect();
      },
    };
  }

  /* ---------- Volume e analisador ---------- */

  function setVolume(value) {
    volume = value;
    if (masterGain) masterGain.gain.setTargetAtTime(value, context.currentTime, 0.02);
  }

  function getAnalyser() {
    return analyser;
  }

  S.audio = {
    getContext,
    playNote,
    createTone,
    setVolume,
    getAnalyser,
    midiToFrequency,
    frequencyToMidi,
    noteInfo,
  };
})(window.Synthesis);
