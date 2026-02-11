/* ============================================
   TypeFlow — Main Application Logic
   ============================================ */

// ===== DOM ELEMENTS =====
const dom = {
  wordsWrapper: document.getElementById('wordsWrapper'),
  wordsContainer: document.getElementById('words'),
  inputField: document.getElementById('inputField'),
  caret: document.getElementById('caret'),
  focusWarning: document.getElementById('focusWarning'),
  liveStats: document.getElementById('liveStats'),
  liveWpm: document.querySelector('#liveWpm .stat-value'),
  liveAcc: document.querySelector('#liveAcc .stat-value'),
  liveTimer: document.querySelector('#liveTimer .stat-value'),
  liveTimerLabel: document.querySelector('#liveTimer .stat-label'),
  typingTest: document.getElementById('typingTest'),
  result: document.getElementById('result'),
  modeSelector: document.getElementById('modeSelector'),
  header: document.getElementById('header'),
  footer: document.getElementById('footer'),
  // Result elements
  resultWpm: document.getElementById('resultWpm'),
  resultAcc: document.getElementById('resultAcc'),
  resultRaw: document.getElementById('resultRaw'),
  resultConsistency: document.getElementById('resultConsistency'),
  resultChars: document.getElementById('resultChars'),
  resultTime: document.getElementById('resultTime'),
  resultTestType: document.getElementById('resultTestType'),
  pbIndicator: document.getElementById('pbIndicator'),
  wpmChart: document.getElementById('wpmChart'),
  restartBtn: document.getElementById('restartBtn'),
  // Mode buttons
  timeOptions: document.getElementById('timeOptions'),
  wordOptions: document.getElementById('wordOptions'),
  togglePunctuation: document.getElementById('togglePunctuation'),
  toggleNumbers: document.getElementById('toggleNumbers'),
  themeToggle: document.getElementById('themeToggle'),
};

// ===== STATE =====
const state = {
  mode: 'time',           // 'time' or 'words'
  modeValue: 15,          // seconds or word count
  isActive: false,        // test started
  isFinished: false,      // test ended
  punctuation: false,
  numbers: false,
  words: [],              // array of word strings
  currentWordIndex: 0,
  currentLetterIndex: 0,
  inputHistory: [],       // per-word input strings
  currentInput: '',
  timer: null,
  historyTimer: null,
  startTime: 0,
  timeElapsed: 0,
  timeRemaining: 15,
  // Stats tracking per second
  wpmHistory: [],
  rawWpmHistory: [],
  errorCountHistory: [],
  // Character counts
  correctChars: 0,
  incorrectChars: 0,
  extraChars: 0,
  missedChars: 0,
  totalKeystrokes: 0,
  // Caret
  caretBlinkTimeout: null,
  // Chart instance
  chartInstance: null,
  // Tab+Enter
  tabPressed: false,
};

// ===== PUNCTUATION & NUMBER HELPERS =====
const PUNCTUATION_MARKS = ['.', ',', '!', '?', ';', ':', "'", '"'];

function applyPunctuation(word, index, total) {
  if (!state.punctuation) return word;
  const rand = Math.random();
  // ~30% chance to add punctuation
  if (rand < 0.15) {
    word = word.charAt(0).toUpperCase() + word.slice(1);
  }
  if (rand > 0.7 || index === total - 1) {
    word += PUNCTUATION_MARKS[Math.floor(Math.random() * PUNCTUATION_MARKS.length)];
  }
  return word;
}

function applyNumbers(words) {
  if (!state.numbers) return words;
  const result = [...words];
  const numCount = Math.max(1, Math.floor(words.length * 0.1));
  for (let i = 0; i < numCount; i++) {
    const pos = Math.floor(Math.random() * result.length);
    result[pos] = String(Math.floor(Math.random() * 10000));
  }
  return result;
}

// ===== WORD GENERATION =====
function generateWords() {
  let count;
  if (state.mode === 'words') {
    count = state.modeValue;
  } else {
    // For time mode, generate plenty of words
    count = Math.max(200, state.modeValue * 5);
  }

  let words = getRandomWords(count);
  words = applyNumbers(words);
  words = words.map((w, i) => applyPunctuation(w, i, words.length));
  state.words = words;
}

// ===== WORD RENDERING =====
function renderWords() {
  dom.wordsContainer.innerHTML = '';
  dom.wordsContainer.style.marginTop = '0px';

  state.words.forEach((word, wi) => {
    const wordEl = document.createElement('div');
    wordEl.className = 'word' + (wi === 0 ? ' active' : '');
    wordEl.dataset.index = wi;

    word.split('').forEach((letter) => {
      const letterEl = document.createElement('span');
      letterEl.className = 'letter';
      letterEl.textContent = letter;
      wordEl.appendChild(letterEl);
    });

    dom.wordsContainer.appendChild(wordEl);
  });
}

// ===== CARET =====
function updateCaret() {
  const activeWord = dom.wordsContainer.querySelector('.word.active');
  if (!activeWord) return;

  const letters = activeWord.querySelectorAll('.letter');
  let target;

  if (state.currentLetterIndex < letters.length) {
    target = letters[state.currentLetterIndex];
  } else {
    // Past end of word — position after last letter
    target = letters[letters.length - 1];
  }

  if (!target) return;

  const wrapperRect = dom.wordsWrapper.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  let left, top;

  if (state.currentLetterIndex >= letters.length) {
    // Position caret after the last letter
    left = targetRect.right - wrapperRect.left;
  } else {
    left = targetRect.left - wrapperRect.left;
  }
  top = targetRect.top - wrapperRect.top;

  dom.caret.style.left = left + 'px';
  dom.caret.style.top = top + 'px';
  dom.caret.style.height = targetRect.height + 'px';
}

function resetCaretBlink() {
  dom.caret.classList.add('typing');
  clearTimeout(state.caretBlinkTimeout);
  state.caretBlinkTimeout = setTimeout(() => {
    dom.caret.classList.remove('typing');
  }, 1500);
}

// ===== LINE SCROLLING =====
function handleLineScroll() {
  const activeWord = dom.wordsContainer.querySelector('.word.active');
  if (!activeWord) return;

  const wrapperRect = dom.wordsWrapper.getBoundingClientRect();
  const wordRect = activeWord.getBoundingClientRect();
  const lineHeight = parseFloat(getComputedStyle(dom.wordsWrapper).lineHeight) || 40;

  // If the active word is below the second line, scroll up
  const relativeTop = wordRect.top - wrapperRect.top;
  const currentMargin = parseInt(dom.wordsContainer.style.marginTop) || 0;

  if (relativeTop > lineHeight * 1.5) {
    const linesToScroll = Math.floor(relativeTop / lineHeight) - 1;
    dom.wordsContainer.style.marginTop = (currentMargin - linesToScroll * lineHeight) + 'px';
  }
}

// ===== INPUT HANDLING =====
function handleInput(e) {
  let inputValue = dom.inputField.value;

  if (inputValue.includes(' ')) {
    const parts = inputValue.split(' ');
    const lastPart = parts.pop() ?? '';

    parts.forEach((part) => {
      if (part.length === 0) return;
      if (!state.isActive && !state.isFinished) {
        startTest();
      }
      finalizeWord(part);
      moveToNextWord();
    });

    dom.inputField.value = lastPart;
    inputValue = lastPart;
  }

  const currentWord = state.words[state.currentWordIndex];
  const activeWordEl = dom.wordsContainer.querySelector('.word.active');

  if (!activeWordEl) return;

  // Start test on first keypress
  if (!state.isActive && !state.isFinished) {
    startTest();
  }

  resetCaretBlink();

  const letters = activeWordEl.querySelectorAll('.letter');

  // Update letter states
  // First, clear all states from active word
  letters.forEach((l) => {
    if (!l.classList.contains('extra')) {
      l.classList.remove('correct', 'incorrect', 'missed');
    }
  });

  // Remove extra letters
  activeWordEl.querySelectorAll('.letter.extra').forEach(el => el.remove());

  // Apply states based on input
  for (let i = 0; i < inputValue.length; i++) {
    if (i < currentWord.length) {
      if (inputValue[i] === currentWord[i]) {
        letters[i].classList.add('correct');
      } else {
        letters[i].classList.add('incorrect');
      }
    } else {
      // Extra characters
      const extraEl = document.createElement('span');
      extraEl.className = 'letter extra';
      extraEl.textContent = inputValue[i];
      activeWordEl.appendChild(extraEl);
    }
  }

  state.currentLetterIndex = inputValue.length;
  state.currentInput = inputValue;

  // Check if word has errors for underline color
  let hasError = false;
  for (let i = 0; i < inputValue.length; i++) {
    if (i >= currentWord.length || inputValue[i] !== currentWord[i]) {
      hasError = true;
      break;
    }
  }
  activeWordEl.classList.toggle('error', hasError);

  updateCaret();

  // Update live WPM/accuracy on every keystroke for responsiveness
  if (state.isActive) {
    updateLiveDisplay();
  }
}

function handleKeydown(e) {
  // Tab+Enter restart
  if (e.key === 'Tab') {
    e.preventDefault();
    state.tabPressed = true;
    setTimeout(() => { state.tabPressed = false; }, 800);
    return;
  }

  if (e.key === 'Enter' && state.tabPressed) {
    e.preventDefault();
    state.tabPressed = false;
    restartTest();
    return;
  }

  // Space — move to next word
  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();

    if (!state.isActive) return;

    const inputValue = dom.inputField.value;
    if (inputValue.length === 0) return;

    finalizeWord(inputValue);
    moveToNextWord();
    return;
  }

  // Backspace at start of word — go back to previous word
  if (e.key === 'Backspace' && dom.inputField.value.length === 0 && state.currentWordIndex > 0) {
    e.preventDefault();
    goToPreviousWord();
    return;
  }

  // Ctrl+Backspace — delete whole word
  if (e.key === 'Backspace' && e.ctrlKey) {
    e.preventDefault();
    dom.inputField.value = '';
    handleInput();
    return;
  }
}

function countWordChars(input, word) {
  let correct = 0, incorrect = 0, extra = 0, missed = 0;
  for (let i = 0; i < Math.max(input.length, word.length); i++) {
    if (i < input.length && i < word.length) {
      if (input[i] === word[i]) correct++;
      else incorrect++;
    } else if (i >= word.length) {
      extra++;
    } else {
      missed++;
    }
  }
  return { correct, incorrect, extra, missed };
}

function finalizeWord(input) {
  const currentWord = state.words[state.currentWordIndex];
  const activeWordEl = dom.wordsContainer.querySelector('.word.active');

  if (!activeWordEl) return;

  // Count characters
  const counts = countWordChars(input, currentWord);
  state.correctChars += counts.correct;
  state.incorrectChars += counts.incorrect;
  state.extraChars += counts.extra;
  state.missedChars += counts.missed;

  // Mark missed letters in DOM
  if (counts.missed > 0) {
    const letters = activeWordEl.querySelectorAll('.letter:not(.extra)');
    for (let i = input.length; i < currentWord.length; i++) {
      if (letters[i]) letters[i].classList.add('missed');
    }
  }

  // Count space as correct char
  state.correctChars++;
  state.totalKeystrokes += input.length + 1;

  // Store input history
  state.inputHistory.push(input);

  // Remove active state from current word
  activeWordEl.classList.remove('active');
}

function goToPreviousWord() {
  if (state.currentWordIndex <= 0) return;

  // Remove active from current word
  const currentActiveEl = dom.wordsContainer.querySelector('.word.active');
  if (currentActiveEl) currentActiveEl.classList.remove('active');

  // Get the previous word's input
  const prevInput = state.inputHistory.pop();
  const prevWordIndex = state.currentWordIndex - 1;
  const prevWord = state.words[prevWordIndex];

  // Undo the character counts from the finalized word
  const counts = countWordChars(prevInput, prevWord);
  state.correctChars -= counts.correct;
  state.incorrectChars -= counts.incorrect;
  state.extraChars -= counts.extra;
  state.missedChars -= counts.missed;
  // Undo the space char
  state.correctChars--;
  state.totalKeystrokes -= (prevInput.length + 1);

  // Move back
  state.currentWordIndex = prevWordIndex;

  // Restore the previous word as active
  const prevWordEl = dom.wordsContainer.querySelector(`.word[data-index="${prevWordIndex}"]`);
  if (!prevWordEl) return;
  prevWordEl.classList.add('active');
  prevWordEl.classList.remove('error');

  // Remove extra letters and clear letter states
  prevWordEl.querySelectorAll('.letter.extra').forEach(el => el.remove());
  prevWordEl.querySelectorAll('.letter').forEach(l => {
    l.classList.remove('correct', 'incorrect', 'missed');
  });

  // Restore the input text and re-render letter states
  dom.inputField.value = prevInput;
  state.currentInput = prevInput;
  state.currentLetterIndex = prevInput.length;

  // Re-apply letter coloring from the restored input
  const letters = prevWordEl.querySelectorAll('.letter');
  for (let i = 0; i < prevInput.length; i++) {
    if (i < prevWord.length) {
      if (prevInput[i] === prevWord[i]) {
        letters[i].classList.add('correct');
      } else {
        letters[i].classList.add('incorrect');
      }
    } else {
      const extraEl = document.createElement('span');
      extraEl.className = 'letter extra';
      extraEl.textContent = prevInput[i];
      prevWordEl.appendChild(extraEl);
    }
  }

  // Check error state
  let hasError = false;
  for (let i = 0; i < prevInput.length; i++) {
    if (i >= prevWord.length || prevInput[i] !== prevWord[i]) {
      hasError = true;
      break;
    }
  }
  prevWordEl.classList.toggle('error', hasError);

  updateCaret();
}

function moveToNextWord() {
  state.currentWordIndex++;
  state.currentLetterIndex = 0;
  state.currentInput = '';
  dom.inputField.value = '';

  // Check if test is over (word mode)
  if (state.mode === 'words' && state.currentWordIndex >= state.modeValue) {
    endTest();
    return;
  }

  // If time mode and running low on words, add more
  if (state.mode === 'time' && state.currentWordIndex >= state.words.length - 20) {
    const moreWords = getRandomWords(100);
    moreWords.forEach((word, i) => {
      const w = applyPunctuation(word, i, 100);
      state.words.push(w);
      const wordEl = document.createElement('div');
      wordEl.className = 'word';
      wordEl.dataset.index = state.words.length - 1;
      w.split('').forEach(letter => {
        const letterEl = document.createElement('span');
        letterEl.className = 'letter';
        letterEl.textContent = letter;
        wordEl.appendChild(letterEl);
      });
      dom.wordsContainer.appendChild(wordEl);
    });
  }

  // Set new active word
  const newActive = dom.wordsContainer.querySelector(`.word[data-index="${state.currentWordIndex}"]`);
  if (newActive) {
    newActive.classList.add('active');
  }

  handleLineScroll();
  updateCaret();
}

// ===== TIMER & STATS =====
function startTest() {
  state.isActive = true;
  state.startTime = performance.now();
  state.timeElapsed = 0;

  if (state.mode === 'time') {
    state.timeRemaining = state.modeValue;
  }

  dom.liveStats.classList.add('visible');

  // Fast interval (200ms) for smooth live stats display
  state.timer = setInterval(liveStatsTick, 200);
  // 1-second interval for WPM history (used in chart)
  state.historyTimer = setInterval(historyTick, 1000);
}

function getElapsedSeconds() {
  return (performance.now() - state.startTime) / 1000;
}

// Gets correct chars from the word currently being typed (not yet finalized)
function getCurrentWordCorrectChars() {
  const input = dom.inputField.value;
  const currentWord = state.words[state.currentWordIndex];
  if (!input || !currentWord) return { correct: 0, incorrect: 0, extra: 0 };
  let correct = 0, incorrect = 0, extra = 0;
  for (let i = 0; i < input.length; i++) {
    if (i < currentWord.length) {
      if (input[i] === currentWord[i]) correct++;
      else incorrect++;
    } else {
      extra++;
    }
  }
  return { correct, incorrect, extra };
}

function liveStatsTick() {
  const elapsed = getElapsedSeconds();
  state.timeElapsed = elapsed;

  if (state.mode === 'time') {
    const remaining = Math.max(0, Math.ceil(state.modeValue - elapsed));
    state.timeRemaining = remaining;
    dom.liveTimer.textContent = remaining;

    if (elapsed >= state.modeValue) {
      // Finalize current word if partially typed
      if (state.currentInput.length > 0) {
        finalizeWord(state.currentInput);
      }
      state.timeElapsed = state.modeValue; // clamp to exact duration
      endTest();
      return;
    }
  } else {
    dom.liveTimer.textContent = `${state.currentWordIndex}/${state.modeValue}`;
  }

  // Update live stats including current in-progress word
  updateLiveDisplay();
}

function historyTick() {
  if (!state.isActive) return;
  // Record WPM snapshot for chart (uses precise elapsed time)
  const wpm = calculateWPM();
  const rawWpm = calculateRawWPM();
  state.wpmHistory.push(wpm);
  state.rawWpmHistory.push(rawWpm);

  // Count errors for this second
  const totalErrors = state.incorrectChars + state.extraChars;
  state.errorCountHistory.push(totalErrors);
}

function updateLiveDisplay() {
  const wpm = calculateWPM();
  const acc = calculateAccuracy();
  dom.liveWpm.textContent = Math.round(wpm);
  dom.liveAcc.textContent = Math.round(acc);
}

function calculateWPM() {
  const elapsed = getElapsedSeconds();
  if (elapsed < 0.5) return 0;
  // Include current in-progress word's correct chars
  const currentWordChars = getCurrentWordCorrectChars();
  const totalCorrect = state.correctChars + currentWordChars.correct;
  return (totalCorrect / 5) * (60 / elapsed);
}

function calculateRawWPM() {
  const elapsed = getElapsedSeconds();
  if (elapsed < 0.5) return 0;
  const currentWordChars = getCurrentWordCorrectChars();
  const totalChars = state.correctChars + state.incorrectChars + state.extraChars
    + currentWordChars.correct + currentWordChars.incorrect + currentWordChars.extra;
  return (totalChars / 5) * (60 / elapsed);
}

function calculateAccuracy() {
  const currentWordChars = getCurrentWordCorrectChars();
  const totalCorrect = state.correctChars + currentWordChars.correct;
  const totalIncorrect = state.incorrectChars + currentWordChars.incorrect;
  const totalExtra = state.extraChars + currentWordChars.extra;
  const total = totalCorrect + totalIncorrect + totalExtra;
  if (total === 0) return 100;
  return (totalCorrect / total) * 100;
}

function calculateConsistency() {
  if (state.wpmHistory.length < 2) return 100;
  const mean = state.wpmHistory.reduce((a, b) => a + b, 0) / state.wpmHistory.length;
  const variance = state.wpmHistory.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / state.wpmHistory.length;
  const stdDev = Math.sqrt(variance);
  // Convert to consistency percentage (lower stddev = higher consistency)
  const cv = mean > 0 ? (stdDev / mean) * 100 : 0;
  return Math.max(0, Math.round(100 - cv));
}

// ===== END TEST =====
function endTest() {
  state.isActive = false;
  state.isFinished = true;
  clearInterval(state.timer);
  clearInterval(state.historyTimer);

  // Use precise elapsed time for final calculation
  const elapsed = (state.mode === 'time') ? state.modeValue : getElapsedSeconds();
  state.timeElapsed = elapsed;

  // Final stats (use only finalized chars, not in-progress word)
  const finalWpm = Math.round((state.correctChars / 5) * (60 / elapsed));
  const finalRawWpm = Math.round(((state.correctChars + state.incorrectChars + state.extraChars) / 5) * (60 / elapsed));
  const finalTotal = state.correctChars + state.incorrectChars + state.extraChars;
  const finalAcc = finalTotal > 0 ? Math.round((state.correctChars / finalTotal) * 100) : 100;
  const finalConsistency = calculateConsistency();

  // Update result DOM
  dom.resultWpm.textContent = finalWpm;
  dom.resultAcc.textContent = finalAcc + '%';
  dom.resultRaw.textContent = finalRawWpm;
  dom.resultConsistency.textContent = finalConsistency + '%';
  dom.resultChars.textContent = `${state.correctChars}/${state.incorrectChars}/${state.extraChars}/${state.missedChars}`;
  dom.resultTime.textContent = elapsed.toFixed(1) + 's';
  dom.resultTestType.textContent = `${state.mode} ${state.modeValue}${state.punctuation ? ' punctuation' : ''}${state.numbers ? ' numbers' : ''}`;

  // Check personal best
  checkPersonalBest(finalWpm);

  // Show result, hide test
  dom.typingTest.classList.add('hidden');
  dom.modeSelector.classList.add('hidden');
  dom.result.classList.remove('hidden');

  // Render chart
  renderChart();
}

// ===== CHART =====
function renderChart() {
  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  const labels = state.wpmHistory.map((_, i) => i + 1);

  // Build error data (show dots where errors increased)
  const errorData = [];
  for (let i = 0; i < state.errorCountHistory.length; i++) {
    const prevErrors = i > 0 ? state.errorCountHistory[i - 1] : 0;
    const newErrors = state.errorCountHistory[i] - prevErrors;
    if (newErrors > 0) {
      errorData.push({ x: i + 1, y: state.rawWpmHistory[i] || 0 });
    }
  }

  const ctx = dom.wpmChart.getContext('2d');
  const mainColor = getComputedStyle(document.documentElement).getPropertyValue('--main').trim();
  const subColor = getComputedStyle(document.documentElement).getPropertyValue('--sub').trim();
  const errorColor = getComputedStyle(document.documentElement).getPropertyValue('--error').trim();
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();

  state.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'WPM',
          data: state.wpmHistory,
          borderColor: mainColor,
          backgroundColor: mainColor + '20',
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 5,
          borderWidth: 2,
        },
        {
          label: 'Raw',
          data: state.rawWpmHistory,
          borderColor: subColor,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius: 1,
          pointHoverRadius: 4,
          borderWidth: 1.5,
          borderDash: [5, 5],
        },
        {
          label: 'Errors',
          data: errorData,
          type: 'scatter',
          pointBackgroundColor: errorColor,
          pointBorderColor: errorColor,
          pointRadius: 6,
          pointStyle: 'crossRot',
          showLine: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: {
          title: { display: true, text: 'seconds', color: subColor },
          ticks: { color: subColor },
          grid: { color: subColor + '20' },
        },
        y: {
          title: { display: true, text: 'wpm', color: subColor },
          ticks: { color: subColor },
          grid: { color: subColor + '20' },
          beginAtZero: true,
        }
      },
      plugins: {
        legend: {
          labels: { color: textColor, font: { family: "'Roboto Mono', monospace" } }
        }
      }
    }
  });
}

// ===== PERSONAL BEST =====
function checkPersonalBest(wpm) {
  const key = `velotype-pb-${state.mode}-${state.modeValue}`;
  const stored = localStorage.getItem(key);
  const prevBest = stored ? parseInt(stored) : 0;

  if (wpm > prevBest) {
    localStorage.setItem(key, wpm);
    dom.pbIndicator.classList.remove('hidden');
  } else {
    dom.pbIndicator.classList.add('hidden');
  }
}

// ===== RESTART =====
function restartTest() {
  // Clear timers
  clearInterval(state.timer);
  clearInterval(state.historyTimer);

  // Reset state
  state.isActive = false;
  state.isFinished = false;
  state.currentWordIndex = 0;
  state.currentLetterIndex = 0;
  state.currentInput = '';
  state.inputHistory = [];
  state.startTime = 0;
  state.timeElapsed = 0;
  state.timeRemaining = state.mode === 'time' ? state.modeValue : 0;
  state.wpmHistory = [];
  state.rawWpmHistory = [];
  state.errorCountHistory = [];
  state.correctChars = 0;
  state.incorrectChars = 0;
  state.extraChars = 0;
  state.missedChars = 0;
  state.totalKeystrokes = 0;

  // Reset DOM
  dom.result.classList.add('hidden');
  dom.typingTest.classList.remove('hidden');
  dom.modeSelector.classList.remove('hidden');
  dom.liveStats.classList.remove('visible');

  dom.liveWpm.textContent = '0';
  dom.liveAcc.textContent = '100';

  if (state.mode === 'time') {
    dom.liveTimer.textContent = state.modeValue;
    dom.liveTimerLabel.textContent = 'time';
  } else {
    dom.liveTimer.textContent = `0/${state.modeValue}`;
    dom.liveTimerLabel.textContent = 'words';
  }

  dom.inputField.value = '';

  // Destroy chart
  if (state.chartInstance) {
    state.chartInstance.destroy();
    state.chartInstance = null;
  }

  // Generate new words
  generateWords();
  renderWords();

  // Focus
  dom.inputField.focus();
  updateCaret();
}

// ===== MODE SWITCHING =====
function initModeListeners() {
  // Main mode buttons (time / words)
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      state.mode = btn.dataset.mode;

      if (state.mode === 'time') {
        dom.timeOptions.classList.remove('hidden');
        dom.wordOptions.classList.add('hidden');
        const activeTimeSub = dom.timeOptions.querySelector('.sub-mode-btn.active');
        state.modeValue = parseInt(activeTimeSub.dataset.value);
      } else {
        dom.timeOptions.classList.add('hidden');
        dom.wordOptions.classList.remove('hidden');
        const activeWordSub = dom.wordOptions.querySelector('.sub-mode-btn.active');
        state.modeValue = parseInt(activeWordSub.dataset.value);
      }

      restartTest();
    });
  });

  // Sub-mode buttons (15/30/60/120 or 10/25/50/100)
  document.querySelectorAll('.sub-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.mode-group');
      parent.querySelectorAll('.sub-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.modeValue = parseInt(btn.dataset.value);
      restartTest();
    });
  });

  // Punctuation toggle
  dom.togglePunctuation.addEventListener('click', () => {
    state.punctuation = !state.punctuation;
    dom.togglePunctuation.classList.toggle('active', state.punctuation);
    restartTest();
  });

  // Numbers toggle
  dom.toggleNumbers.addEventListener('click', () => {
    state.numbers = !state.numbers;
    dom.toggleNumbers.classList.toggle('active', state.numbers);
    restartTest();
  });

  // Theme toggle
  dom.themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
  });

  // Restart button
  dom.restartBtn.addEventListener('click', restartTest);
}

// ===== FOCUS MANAGEMENT =====
function initFocusManagement() {
  dom.inputField.addEventListener('focus', () => {
    dom.focusWarning.classList.remove('visible');
  });

  dom.inputField.addEventListener('blur', () => {
    if (!state.isFinished) {
      dom.focusWarning.classList.add('visible');
    }
  });

  dom.wordsWrapper.addEventListener('click', () => {
    dom.inputField.focus();
  });

  dom.focusWarning.addEventListener('click', () => {
    dom.inputField.focus();
  });

  // Any key press focuses the input
  document.addEventListener('keydown', (e) => {
    if (state.isFinished && e.key !== 'Tab' && e.key !== 'Enter') return;
    if (e.key === 'Escape') return;

    // Don't re-focus if typing in some other input
    if (document.activeElement !== dom.inputField &&
        !state.isFinished &&
        e.key !== 'Tab') {
      dom.inputField.focus();
    }
  });
}

// ===== INPUT EVENT LISTENERS =====
function initInputListeners() {
  dom.inputField.addEventListener('input', handleInput);
  dom.inputField.addEventListener('keydown', handleKeydown);

  // Global keydown for Tab+Enter when on results screen
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      state.tabPressed = true;
      setTimeout(() => { state.tabPressed = false; }, 800);
    }
    if (e.key === 'Enter' && state.tabPressed) {
      e.preventDefault();
      state.tabPressed = false;
      restartTest();
    }
  });
}

// ===== INITIALIZATION =====
function init() {
  // Set initial timer display
  if (state.mode === 'time') {
    dom.liveTimer.textContent = state.modeValue;
    dom.liveTimerLabel.textContent = 'time';
  } else {
    dom.liveTimer.textContent = `0/${state.modeValue}`;
    dom.liveTimerLabel.textContent = 'words';
  }

  generateWords();
  renderWords();
  initModeListeners();
  initFocusManagement();
  initInputListeners();

  // Initial focus
  setTimeout(() => {
    dom.inputField.focus();
    updateCaret();
  }, 100);
}

// Start the app
init();
