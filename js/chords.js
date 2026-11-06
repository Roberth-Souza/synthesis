/* =========================================================
   Seção de acordes
   Cada botão toca um acorde e mostra as teclas que o formam.
   ========================================================= */
(function (S) {
  'use strict';

  const container = document.getElementById('chordKeyboard');
  if (!container) return;

  const buttonsEl = document.getElementById('chordButtons');
  const infoEl = document.getElementById('chordInfo');
  const nameEl = document.getElementById('chordName');
  const formulaEl = document.getElementById('chordFormula');
  const notesEl = document.getElementById('chordNotes');
  const progressionBtn = document.getElementById('progressionBtn');

  const CHORD_TYPES = {
    major: 'Tônica + terça maior (4 semitons) + quinta justa (7 semitons). Som alegre e estável.',
    minor: 'Tônica + terça menor (3 semitons) + quinta justa (7 semitons). Som melancólico.',
    dominant7: 'Acorde maior + sétima menor (10 semitons). Cria uma tensão que "pede" para resolver.',
    major7: 'Acorde maior + sétima maior (11 semitons). Som sofisticado, marca da bossa nova e do jazz.',
  };

  const CHORDS = [
    { symbol: 'C', name: 'Dó maior', type: 'major', notes: [60, 64, 67] },
    { symbol: 'Dm', name: 'Ré menor', type: 'minor', notes: [62, 65, 69] },
    { symbol: 'Em', name: 'Mi menor', type: 'minor', notes: [64, 67, 71] },
    { symbol: 'F', name: 'Fá maior', type: 'major', notes: [65, 69, 72] },
    { symbol: 'G', name: 'Sol maior', type: 'major', notes: [67, 71, 74] },
    { symbol: 'Am', name: 'Lá menor', type: 'minor', notes: [69, 72, 76] },
    { symbol: 'G7', name: 'Sol com sétima', type: 'dominant7', notes: [67, 71, 74, 77] },
    { symbol: 'C7M', name: 'Dó com sétima maior', type: 'major7', notes: [60, 64, 67, 71] },
  ];

  const PROGRESSION = ['C', 'G', 'Am', 'F'];
  const STRUM_MS = 70;    // atraso entre as notas, como dedilhar um violão
  const CHORD_MS = 1400;  // quanto tempo cada acorde soa

  const chordTimers = S.createScheduler();
  const progressionTimers = S.createScheduler();
  const progressionLabel = progressionBtn.textContent;
  let progressionPlaying = false;

  const keyboard = S.createKeyboard(container, {
    startMidi: 60,
    endMidi: 83,
    particleLayer: container.closest('.chords__stage'),
  });

  function findChord(symbol) {
    return CHORDS.find((chord) => chord.symbol === symbol);
  }

  function showInfo(chord) {
    nameEl.textContent = `${chord.name} (${chord.symbol})`;
    formulaEl.textContent = CHORD_TYPES[chord.type];
    notesEl.innerHTML = '';
    chord.notes.forEach((midi, index) => {
      const chip = document.createElement('span');
      chip.className = 'note-chip';
      chip.style.setProperty('--delay', `${index * 0.08}s`);
      chip.textContent = S.audio.noteInfo(midi).namePt;
      notesEl.appendChild(chip);
    });
    if (document.documentElement.classList.contains('lite')) return;
    // Reinicia a animação do título
    infoEl.classList.remove('is-updated');
    void infoEl.offsetWidth;
    infoEl.classList.add('is-updated');
  }

  function playChord(chord) {
    chordTimers.cancel();
    keyboard.releaseAll();
    keyboard.clearHighlight();
    keyboard.highlight(chord.notes);

    chord.notes.forEach((midi, index) => {
      chordTimers.at(index * STRUM_MS, () => keyboard.press(midi, 'auto'));
      chordTimers.at(CHORD_MS, () => keyboard.release(midi, 'auto'));
    });

    CHORDS.forEach((other) => other.button.classList.toggle('is-active', other === chord));
    showInfo(chord);
  }

  function stopProgression() {
    progressionTimers.cancel();
    progressionPlaying = false;
    progressionBtn.textContent = progressionLabel;
    progressionBtn.classList.remove('is-playing');
  }

  function toggleProgression() {
    if (progressionPlaying) {
      stopProgression();
      return;
    }
    progressionPlaying = true;
    progressionBtn.textContent = '■ Parar';
    progressionBtn.classList.add('is-playing');
    PROGRESSION.forEach((symbol, index) => {
      progressionTimers.at(index * CHORD_MS, () => playChord(findChord(symbol)));
    });
    progressionTimers.at(PROGRESSION.length * CHORD_MS, stopProgression);
  }

  // Cria um botão para cada acorde
  CHORDS.forEach((chord) => {
    const button = document.createElement('button');
    button.className = 'chord-btn';
    button.innerHTML = `<span class="chord-btn__symbol">${chord.symbol}</span>`
      + `<span class="chord-btn__name">${chord.name}</span>`;
    button.addEventListener('click', () => {
      stopProgression();
      playChord(chord);
    });
    buttonsEl.appendChild(button);
    chord.button = button;
  });

  progressionBtn.addEventListener('click', toggleProgression);
})(window.Synthesis);
