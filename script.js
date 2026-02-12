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
  // New feature elements
  soundToggle: document.getElementById('soundToggle'),
  statsBtn: document.getElementById('statsBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  statsModal: document.getElementById('statsModal'),
  statsClose: document.getElementById('statsClose'),
  settingsModal: document.getElementById('settingsModal'),
  settingsClose: document.getElementById('settingsClose'),
  customTextModal: document.getElementById('customTextModal'),
  customTextClose: document.getElementById('customTextClose'),
  customTextArea: document.getElementById('customTextArea'),
  startCustomBtn: document.getElementById('startCustomBtn'),
  capslockWarning: document.getElementById('capslockWarning'),
  quoteInfo: document.getElementById('quoteInfo'),
  quoteAuthor: document.getElementById('quoteAuthor'),
  difficultyOptions: document.getElementById('difficultyOptions'),
  heatmapContainer: document.getElementById('heatmapContainer'),
  keyboardHeatmap: document.getElementById('keyboardHeatmap'),
  exportBtn: document.getElementById('exportBtn'),
  streakCount: document.getElementById('streakCount'),
  goalBarFill: document.getElementById('goalBarFill'),
  goalText: document.getElementById('goalText'),
  dailyGoalInput: document.getElementById('dailyGoalInput'),
  saveGoalBtn: document.getElementById('saveGoalBtn'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  // Stats display
  statsTotalTests: document.getElementById('statsTotalTests'),
  statsAvgWpm: document.getElementById('statsAvgWpm'),
  statsBestWpm: document.getElementById('statsBestWpm'),
  statsTotalTime: document.getElementById('statsTotalTime'),
  statsAvgAcc: document.getElementById('statsAvgAcc'),
  statsStreak: document.getElementById('statsStreak'),
  historyTableBody: document.getElementById('historyTableBody'),
};

// ===== STATE =====
const state = {
  mode: 'time',           // 'time', 'words', 'quote', or 'custom'
  modeValue: 15,          // seconds or word count
  isActive: false,        // test started
  isFinished: false,      // test ended
  punctuation: false,
  numbers: false,
  difficulty: 'medium',   // 'easy', 'medium', 'hard', 'expert'
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
  caretStyle: 'line',     // 'line', 'block', 'underline'
  // Chart instance
  chartInstance: null,
  // Tab+Enter
  tabPressed: false,
  // Sound
  soundEnabled: false,
  audioCtx: null,
  // Quote
  currentQuote: null,
  // Key error tracking for heatmap
  keyErrors: {},          // { key: errorCount }
  keyTotal: {},           // { key: totalPresses }
  // Capslock
  capsLockOn: false,
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

  if (state.mode === 'quote') {
    state.currentQuote = getRandomQuote();
    state.words = state.currentQuote.text.split(' ');
    return;
  }

  if (state.mode === 'custom') {
    // words already set from custom text modal
    return;
  }

  if (state.mode === 'words') {
    count = state.modeValue;
  } else {
    // For time mode, generate plenty of words
    count = Math.max(200, state.modeValue * 5);
  }

  let words = getRandomWords(count, state.difficulty);
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

  // Shake animation on new error
  if (hasError && inputValue.length > 0) {
    const lastCharIndex = inputValue.length - 1;
    if (lastCharIndex < currentWord.length && inputValue[lastCharIndex] !== currentWord[lastCharIndex]) {
      triggerShake(activeWordEl);
      playErrorSound();
    } else if (lastCharIndex >= currentWord.length) {
      triggerShake(activeWordEl);
      playErrorSound();
    }
  }

  updateCaret();

  // Update live WPM/accuracy on every keystroke for responsiveness
  if (state.isActive) {
    updateLiveDisplay();
  }
}

function handleKeydown(e) {
  // Capslock detection
  if (e.getModifierState) {
    const capsOn = e.getModifierState('CapsLock');
    if (capsOn !== state.capsLockOn) {
      state.capsLockOn = capsOn;
      dom.capslockWarning.classList.toggle('hidden', !capsOn);
    }
  }

  // Track key presses for heatmap
  if (e.key.length === 1 && state.isActive) {
    const key = e.key.toLowerCase();
    state.keyTotal[key] = (state.keyTotal[key] || 0) + 1;
    // Check if this will be an error
    const currentWord = state.words[state.currentWordIndex];
    const idx = state.currentLetterIndex;
    if (idx < currentWord.length) {
      if (e.key !== currentWord[idx]) {
        state.keyErrors[key] = (state.keyErrors[key] || 0) + 1;
      }
    }
    // Play typing sound
    playClickSound();
  }

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
  if ((state.mode === 'words' || state.mode === 'quote' || state.mode === 'custom') && state.currentWordIndex >= state.words.length) {
    endTest();
    return;
  }

  // If time mode and running low on words, add more
  if (state.mode === 'time' && state.currentWordIndex >= state.words.length - 20) {
    const moreWords = getRandomWords(100, state.difficulty);
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
  } else if (state.mode === 'quote' || state.mode === 'custom') {
    dom.liveTimer.textContent = Math.floor(elapsed);
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
  dom.resultTestType.textContent = `${state.mode}${state.mode === 'time' || state.mode === 'words' ? ' ' + state.modeValue : ''}${state.punctuation ? ' punctuation' : ''}${state.numbers ? ' numbers' : ''}${state.difficulty !== 'medium' ? ' ' + state.difficulty : ''}`;

  // Check personal best
  checkPersonalBest(finalWpm);

  // Show result, hide test
  dom.typingTest.classList.add('hidden');
  dom.modeSelector.classList.add('hidden');
  dom.result.classList.remove('hidden');

  // Render chart
  renderChart();

  // Render keyboard heatmap
  renderHeatmap();

  // Save to history
  saveTestHistory(finalWpm, finalRawWpm, finalAcc, elapsed);

  // Update streak and daily goal
  updateStreak();
  updateDailyGoal(finalWpm);
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
  state.keyErrors = {};
  state.keyTotal = {};
  state.currentQuote = null;

  // Reset DOM
  dom.result.classList.add('hidden');
  dom.typingTest.classList.remove('hidden');
  dom.modeSelector.classList.remove('hidden');
  dom.liveStats.classList.remove('visible');

  dom.liveWpm.textContent = '0';
  dom.liveAcc.textContent = '100';

  // Quote info
  dom.quoteInfo.classList.add('hidden');
  dom.quoteAuthor.textContent = '';

  if (state.mode === 'time') {
    dom.liveTimer.textContent = state.modeValue;
    dom.liveTimerLabel.textContent = 'time';
  } else if (state.mode === 'quote' || state.mode === 'custom') {
    dom.liveTimer.textContent = '0';
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

  // Show quote author if applicable
  if (state.mode === 'quote' && state.currentQuote) {
    dom.quoteInfo.classList.remove('hidden');
    dom.quoteAuthor.textContent = '— ' + state.currentQuote.author;
  }

  // Focus
  dom.inputField.focus();
  updateCaret();
}

// ===== MODE SWITCHING =====
function initModeListeners() {
  // Main mode buttons (time / words / quote / custom)
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
        restartTest();
      } else if (state.mode === 'words') {
        dom.timeOptions.classList.add('hidden');
        dom.wordOptions.classList.remove('hidden');
        const activeWordSub = dom.wordOptions.querySelector('.sub-mode-btn.active');
        state.modeValue = parseInt(activeWordSub.dataset.value);
        restartTest();
      } else if (state.mode === 'quote') {
        dom.timeOptions.classList.add('hidden');
        dom.wordOptions.classList.add('hidden');
        restartTest();
      } else if (state.mode === 'custom') {
        dom.timeOptions.classList.add('hidden');
        dom.wordOptions.classList.add('hidden');
        // Show custom text modal
        dom.customTextModal.classList.remove('hidden');
      }
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

  // Difficulty buttons
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.difficulty = btn.dataset.diff;
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
    localStorage.setItem('velotype-theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
  });

  // Sound toggle
  dom.soundToggle.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    dom.soundToggle.classList.toggle('active', state.soundEnabled);
    localStorage.setItem('velotype-sound', state.soundEnabled ? 'on' : 'off');
    updateSoundButtons();
  });

  // Restart button
  dom.restartBtn.addEventListener('click', restartTest);

  // Logo click — go home (restart test)
  const logoLink = document.querySelector('.logo-link');
  if (logoLink) {
    logoLink.addEventListener('click', (e) => {
      e.preventDefault();
      restartTest();
    });
  }

  // Stats button
  dom.statsBtn.addEventListener('click', () => {
    openStatsModal();
  });
  dom.statsClose.addEventListener('click', () => {
    dom.statsModal.classList.add('hidden');
  });
  dom.statsModal.addEventListener('click', (e) => {
    if (e.target === dom.statsModal) dom.statsModal.classList.add('hidden');
  });

  // Settings button
  dom.settingsBtn.addEventListener('click', () => {
    dom.settingsModal.classList.remove('hidden');
  });
  dom.settingsClose.addEventListener('click', () => {
    dom.settingsModal.classList.add('hidden');
  });
  dom.settingsModal.addEventListener('click', (e) => {
    if (e.target === dom.settingsModal) dom.settingsModal.classList.add('hidden');
  });

  // Caret style settings
  document.querySelectorAll('[data-caret]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-caret]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.caretStyle = btn.dataset.caret;
      applyCaretStyle();
      localStorage.setItem('velotype-caret', state.caretStyle);
    });
  });

  // Sound setting buttons in modal
  document.querySelectorAll('[data-sound]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-sound]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.soundEnabled = btn.dataset.sound === 'on';
      dom.soundToggle.classList.toggle('active', state.soundEnabled);
      localStorage.setItem('velotype-sound', state.soundEnabled ? 'on' : 'off');
    });
  });

  // Daily goal save
  dom.saveGoalBtn.addEventListener('click', () => {
    const goal = parseInt(dom.dailyGoalInput.value) || 50;
    localStorage.setItem('velotype-daily-goal', goal);
    updateDailyGoalDisplay();
  });

  // Clear history
  dom.clearHistoryBtn.addEventListener('click', () => {
    localStorage.removeItem('velotype-history');
    openStatsModal();
  });

  // Custom text modal
  dom.customTextClose.addEventListener('click', () => {
    dom.customTextModal.classList.add('hidden');
  });
  dom.customTextModal.addEventListener('click', (e) => {
    if (e.target === dom.customTextModal) dom.customTextModal.classList.add('hidden');
  });
  dom.startCustomBtn.addEventListener('click', () => {
    const text = dom.customTextArea.value.trim();
    if (!text) return;
    state.words = text.split(/\s+/);
    dom.customTextModal.classList.add('hidden');
    restartCustomTest();
  });

  // Export button
  dom.exportBtn.addEventListener('click', exportResults);
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
  // Load settings from browser cache
  loadSettings();

  // Set initial timer display
  if (state.mode === 'time') {
    dom.liveTimer.textContent = state.modeValue;
    dom.liveTimerLabel.textContent = 'time';
  } else if (state.mode === 'quote' || state.mode === 'custom') {
    dom.liveTimer.textContent = '0';
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

  // Update streak and goal display on load
  loadStreakDisplay();
  updateDailyGoalDisplay();

  // Apply caret style
  applyCaretStyle();

  // Initial focus
  setTimeout(() => {
    dom.inputField.focus();
    updateCaret();
  }, 100);
}

// ===== FEATURE 1: SOUND EFFECTS (Web Audio API) =====
function initAudioContext() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playClickSound() {
  if (!state.soundEnabled) return;
  try {
    initAudioContext();
    const ctx = state.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(800 + Math.random() * 400, ctx.currentTime);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) { /* ignore audio errors */ }
}

function playErrorSound() {
  if (!state.soundEnabled) return;
  try {
    initAudioContext();
    const ctx = state.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.type = 'square';
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) { /* ignore audio errors */ }
}

function updateSoundButtons() {
  const onBtn = document.getElementById('soundOnBtn');
  const offBtn = document.getElementById('soundOffBtn');
  if (onBtn && offBtn) {
    onBtn.classList.toggle('active', state.soundEnabled);
    offBtn.classList.toggle('active', !state.soundEnabled);
  }
}

// ===== FEATURE 2: TYPING HISTORY / STATS DASHBOARD =====
function saveTestHistory(wpm, rawWpm, acc, time) {
  const history = JSON.parse(localStorage.getItem('velotype-history') || '[]');
  history.unshift({
    wpm,
    rawWpm,
    acc,
    mode: `${state.mode} ${state.mode === 'time' || state.mode === 'words' ? state.modeValue : ''}`.trim(),
    difficulty: state.difficulty,
    time: parseFloat(time.toFixed(1)),
    date: new Date().toISOString(),
  });
  // Keep last 100 entries
  if (history.length > 100) history.length = 100;
  localStorage.setItem('velotype-history', JSON.stringify(history));
}

function openStatsModal() {
  const history = JSON.parse(localStorage.getItem('velotype-history') || '[]');

  // Summary stats
  const totalTests = history.length;
  const avgWpm = totalTests > 0 ? Math.round(history.reduce((s, h) => s + h.wpm, 0) / totalTests) : 0;
  const bestWpm = totalTests > 0 ? Math.max(...history.map(h => h.wpm)) : 0;
  const totalTimeSec = history.reduce((s, h) => s + h.time, 0);
  const totalTimeMin = Math.round(totalTimeSec / 60);
  const avgAcc = totalTests > 0 ? Math.round(history.reduce((s, h) => s + h.acc, 0) / totalTests) : 0;
  const streakData = JSON.parse(localStorage.getItem('velotype-streak') || '{}');

  dom.statsTotalTests.textContent = totalTests;
  dom.statsAvgWpm.textContent = avgWpm;
  dom.statsBestWpm.textContent = bestWpm;
  dom.statsTotalTime.textContent = totalTimeMin + 'm';
  dom.statsAvgAcc.textContent = avgAcc + '%';
  dom.statsStreak.textContent = streakData.count || 0;

  // History table
  dom.historyTableBody.innerHTML = '';
  history.slice(0, 50).forEach(h => {
    const tr = document.createElement('tr');
    const d = new Date(h.date);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    tr.innerHTML = `<td>${h.wpm}</td><td>${h.rawWpm}</td><td>${h.acc}%</td><td>${h.mode}</td><td>${h.time}s</td><td>${dateStr}</td>`;
    dom.historyTableBody.appendChild(tr);
  });

  dom.statsModal.classList.remove('hidden');
}

// ===== FEATURE 3: DIFFICULTY (already handled in words.js + mode listeners) =====

// ===== FEATURE 4: CARET STYLE OPTIONS =====
function applyCaretStyle() {
  dom.caret.classList.remove('caret-block', 'caret-underline');
  if (state.caretStyle === 'block') {
    dom.caret.classList.add('caret-block');
  } else if (state.caretStyle === 'underline') {
    dom.caret.classList.add('caret-underline');
  }
}

// ===== FEATURE 5: SHAKE ANIMATION =====
function triggerShake(element) {
  element.classList.remove('shake');
  // Force reflow to restart animation
  void element.offsetWidth;
  element.classList.add('shake');
  element.addEventListener('animationend', () => {
    element.classList.remove('shake');
  }, { once: true });
}

// ===== FEATURE 6: CAPSLOCK WARNING (handled in handleKeydown) =====

// ===== FEATURE 7: CUSTOM TEXT / QUOTE MODE =====
function restartCustomTest() {
  // Reset state for custom mode after words are set
  clearInterval(state.timer);
  clearInterval(state.historyTimer);

  state.isActive = false;
  state.isFinished = false;
  state.currentWordIndex = 0;
  state.currentLetterIndex = 0;
  state.currentInput = '';
  state.inputHistory = [];
  state.startTime = 0;
  state.timeElapsed = 0;
  state.wpmHistory = [];
  state.rawWpmHistory = [];
  state.errorCountHistory = [];
  state.correctChars = 0;
  state.incorrectChars = 0;
  state.extraChars = 0;
  state.missedChars = 0;
  state.totalKeystrokes = 0;
  state.keyErrors = {};
  state.keyTotal = {};

  dom.result.classList.add('hidden');
  dom.typingTest.classList.remove('hidden');
  dom.modeSelector.classList.remove('hidden');
  dom.liveStats.classList.remove('visible');
  dom.liveWpm.textContent = '0';
  dom.liveAcc.textContent = '100';
  dom.liveTimer.textContent = '0';
  dom.liveTimerLabel.textContent = 'time';
  dom.inputField.value = '';

  if (state.chartInstance) {
    state.chartInstance.destroy();
    state.chartInstance = null;
  }

  renderWords();
  dom.inputField.focus();
  updateCaret();
}

// ===== FEATURE 8: KEYBOARD HEATMAP =====
function renderHeatmap() {
  const rows = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
    ['space']
  ];

  dom.keyboardHeatmap.innerHTML = '';

  // Calculate max error ratio for color scaling
  let maxRatio = 0;
  for (const key of Object.keys(state.keyTotal)) {
    const total = state.keyTotal[key] || 0;
    const errors = state.keyErrors[key] || 0;
    if (total > 0) {
      const ratio = errors / total;
      if (ratio > maxRatio) maxRatio = ratio;
    }
  }

  rows.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';

    row.forEach(key => {
      const keyEl = document.createElement('div');
      keyEl.className = 'kb-key' + (key === 'space' ? ' space' : '');
      keyEl.textContent = key === 'space' ? 'space' : key;

      const lookupKey = key === 'space' ? ' ' : key;
      const total = state.keyTotal[lookupKey] || 0;
      const errors = state.keyErrors[lookupKey] || 0;

      if (total > 0) {
        const errorRatio = errors / total;
        const hue = Math.max(0, 120 - (errorRatio / Math.max(maxRatio, 0.01)) * 120);
        const saturation = 70;
        const lightness = 45;
        keyEl.style.background = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        keyEl.style.color = '#fff';

        // Show error count
        const countEl = document.createElement('span');
        countEl.className = 'key-count';
        countEl.textContent = errors > 0 ? errors : '';
        keyEl.appendChild(countEl);
      }

      rowEl.appendChild(keyEl);
    });

    dom.keyboardHeatmap.appendChild(rowEl);
  });
}

// ===== FEATURE 9: STREAK COUNTER & DAILY GOAL =====
function updateStreak() {
  const today = new Date().toISOString().split('T')[0];
  const streakData = JSON.parse(localStorage.getItem('velotype-streak') || '{}');

  if (streakData.lastDate === today) {
    // Already practiced today, no change
    return;
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (streakData.lastDate === yesterday) {
    // Consecutive day
    streakData.count = (streakData.count || 0) + 1;
  } else if (!streakData.lastDate) {
    // First time
    streakData.count = 1;
  } else {
    // Streak broken
    streakData.count = 1;
  }

  streakData.lastDate = today;
  localStorage.setItem('velotype-streak', JSON.stringify(streakData));
  loadStreakDisplay();
}

function loadStreakDisplay() {
  const streakData = JSON.parse(localStorage.getItem('velotype-streak') || '{}');
  dom.streakCount.textContent = streakData.count || 0;
}

function updateDailyGoal(wpm) {
  const today = new Date().toISOString().split('T')[0];
  const goalData = JSON.parse(localStorage.getItem('velotype-daily-progress') || '{}');

  if (goalData.date !== today) {
    goalData.date = today;
    goalData.bestWpm = 0;
    goalData.testsToday = 0;
  }

  goalData.testsToday = (goalData.testsToday || 0) + 1;
  goalData.bestWpm = Math.max(goalData.bestWpm || 0, wpm);
  localStorage.setItem('velotype-daily-progress', JSON.stringify(goalData));
  updateDailyGoalDisplay();
}

function updateDailyGoalDisplay() {
  const goal = parseInt(localStorage.getItem('velotype-daily-goal')) || 50;
  const today = new Date().toISOString().split('T')[0];
  const goalData = JSON.parse(localStorage.getItem('velotype-daily-progress') || '{}');

  let bestToday = 0;
  if (goalData.date === today) {
    bestToday = goalData.bestWpm || 0;
  }

  const percent = Math.min(100, Math.round((bestToday / goal) * 100));
  dom.goalBarFill.style.width = percent + '%';
  dom.goalText.textContent = `${bestToday}/${goal} wpm goal`;
  dom.dailyGoalInput.value = goal;
}

// ===== FEATURE 10: EXPORT RESULTS =====
function exportResults() {
  const wpm = dom.resultWpm.textContent;
  const acc = dom.resultAcc.textContent;
  const raw = dom.resultRaw.textContent;
  const consistency = dom.resultConsistency.textContent;
  const chars = dom.resultChars.textContent;
  const time = dom.resultTime.textContent;
  const testType = dom.resultTestType.textContent;

  const text = `\u26a1 VeloType Results\n${'='.repeat(30)}\nWPM: ${wpm}\nAccuracy: ${acc}\nRaw WPM: ${raw}\nConsistency: ${consistency}\nCharacters: ${chars}\nTime: ${time}\nTest Type: ${testType}\nDate: ${new Date().toLocaleString()}\n${'='.repeat(30)}\nhttps://velotype.app`;

  navigator.clipboard.writeText(text).then(() => {
    const original = dom.exportBtn.innerHTML;
    dom.exportBtn.innerHTML = '<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\"><polyline points=\"20 6 9 17 4 12\"/></svg> copied!';
    setTimeout(() => {
      dom.exportBtn.innerHTML = original;
    }, 2000);
  }).catch(() => {
    // Fallback: download as text file
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `velotype-result-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ===== LOAD SETTINGS FROM CACHE =====
function loadSettings() {
  // Theme
  const theme = localStorage.getItem('velotype-theme');
  if (theme === 'light') document.body.classList.add('light-theme');

  // Sound
  const sound = localStorage.getItem('velotype-sound');
  if (sound === 'on') {
    state.soundEnabled = true;
    dom.soundToggle.classList.add('active');
  }
  updateSoundButtons();

  // Caret style
  const caret = localStorage.getItem('velotype-caret');
  if (caret) {
    state.caretStyle = caret;
    document.querySelectorAll('[data-caret]').forEach(b => {
      b.classList.toggle('active', b.dataset.caret === caret);
    });
  }

  // Daily goal
  const goal = localStorage.getItem('velotype-daily-goal');
  if (goal) dom.dailyGoalInput.value = goal;
}

// Start the app
init();
