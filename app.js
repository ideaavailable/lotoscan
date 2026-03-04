/* ====================================
   LOTOSCAN - Application Logic
   ==================================== */

(function () {
  'use strict';

  // --- Configuration ---
  const GAMES = {
    loto6: { max: 43, pick: 6, label: 'LOTO6' },
    loto7: { max: 37, pick: 7, label: 'LOTO7' },
  };

  // --- State ---
  let currentGame = 'loto6';
  let currentSets = 1;

  // --- DOM Elements ---
  const gameTabs = document.querySelectorAll('.game-tab');
  const setBtns = document.querySelectorAll('.set-btn');
  const generateBtn = document.getElementById('generate-btn');
  const resultsArea = document.getElementById('results-area');

  // --- Initialize Particles ---
  function createParticles() {
    const container = document.getElementById('particles');
    const colors = ['#fbbf24', '#60a5fa', '#a78bfa', '#22d3ee', '#f472b6'];
    for (let i = 0; i < 30; i++) {
      const el = document.createElement('div');
      el.className = 'particle';
      const size = Math.random() * 4 + 2;
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.style.left = Math.random() * 100 + '%';
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.animationDuration = (Math.random() * 15 + 10) + 's';
      el.style.animationDelay = (Math.random() * 10) + 's';
      container.appendChild(el);
    }
  }

  // --- Cryptographic-quality random number (where available) ---
  function secureRandom(max) {
    if (window.crypto && window.crypto.getRandomValues) {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      return (arr[0] % max) + 1;
    }
    return Math.floor(Math.random() * max) + 1;
  }

  // --- Generate one set of numbers ---
  function generateNumbers(max, pick) {
    const nums = new Set();
    while (nums.size < pick) {
      nums.add(secureRandom(max));
    }
    return Array.from(nums).sort((a, b) => a - b);
  }

  // --- Render results ---
  function renderResults(sets, gameKey) {
    resultsArea.innerHTML = '';
    const game = GAMES[gameKey];

    sets.forEach((numbers, idx) => {
      const card = document.createElement('div');
      card.className = `number-set ${gameKey}`;
      card.style.animationDelay = `${idx * 80}ms`;

      const header = document.createElement('div');
      header.className = 'set-header';

      const label = document.createElement('span');
      label.className = 'set-label';
      label.textContent = game.label;

      const index = document.createElement('span');
      index.className = 'set-index';
      index.textContent = `SET ${idx + 1}`;

      header.appendChild(label);
      header.appendChild(index);
      card.appendChild(header);

      const row = document.createElement('div');
      row.className = 'numbers-row';

      numbers.forEach((num, ballIdx) => {
        const ball = document.createElement('div');
        ball.className = 'number-ball';
        ball.textContent = String(num).padStart(2, '0');
        ball.style.animationDelay = `${idx * 80 + ballIdx * 100 + 200}ms`;
        row.appendChild(ball);
      });

      card.appendChild(row);
      resultsArea.appendChild(card);
    });
  }

  // --- Event: Game Tab ---
  gameTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      gameTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentGame = tab.dataset.game;
    });
  });

  // --- Event: Set Count Buttons ---
  setBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      setBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentSets = parseInt(btn.dataset.sets, 10);
    });
  });

  // --- Event: Generate ---
  generateBtn.addEventListener('click', () => {
    const game = GAMES[currentGame];
    const sets = [];
    for (let i = 0; i < currentSets; i++) {
      sets.push(generateNumbers(game.max, game.pick));
    }
    renderResults(sets, currentGame);

    // Pulse button
    generateBtn.style.transform = 'scale(0.97)';
    setTimeout(() => {
      generateBtn.style.transform = '';
    }, 150);
  });

  // =============================================
  //  ★ Weekly Recommendation Feature ★
  // =============================================

  function getWeekLabel() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    // 今週の月曜日を算出
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(day + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const mMonth = monday.getMonth() + 1;
    const mDay = monday.getDate();
    const sMonth = sunday.getMonth() + 1;
    const sDay = sunday.getDate();

    return `${year}年 ${mMonth}/${mDay}〜${sMonth}/${sDay}`;
  }

  function renderRecommendedBalls(containerId, numbers, gameKey) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    numbers.forEach((num, idx) => {
      const ball = document.createElement('div');
      ball.className = 'rec-ball';
      ball.textContent = String(num).padStart(2, '0');
      ball.style.animationDelay = `${idx * 120 + 300}ms`;
      container.appendChild(ball);
    });
  }

  function renderAnalysisTags(containerId, report, recNumbers) {
    const container = document.getElementById(containerId);
    if (!container || !report) return;
    container.innerHTML = '';

    // 推薦番号のうちホットな番号を特定
    const hotInRec = recNumbers.filter(n => report.hot.includes(n));
    const coldInRec = recNumbers.filter(n => report.cold.includes(n));
    const freqInRec = recNumbers.filter(n => report.frequent.includes(n));

    if (hotInRec.length > 0) {
      const tag = document.createElement('span');
      tag.className = 'rec-tag hot';
      tag.textContent = '🔥 ホット: ' + hotInRec.map(n => String(n).padStart(2, '0')).join(', ');
      container.appendChild(tag);
    }

    if (coldInRec.length > 0) {
      const tag = document.createElement('span');
      tag.className = 'rec-tag cold';
      tag.textContent = '❄️ 回帰: ' + coldInRec.map(n => String(n).padStart(2, '0')).join(', ');
      container.appendChild(tag);
    }

    if (freqInRec.length > 0) {
      const tag = document.createElement('span');
      tag.className = 'rec-tag freq';
      tag.textContent = '📊 高頻度: ' + freqInRec.map(n => String(n).padStart(2, '0')).join(', ');
      container.appendChild(tag);
    }

    // 偶奇バランスタグ
    const evens = recNumbers.filter(n => n % 2 === 0).length;
    const odds = recNumbers.length - evens;
    const balanceTag = document.createElement('span');
    balanceTag.className = 'rec-tag';
    balanceTag.textContent = `⚖️ 偶${evens}:奇${odds}`;
    container.appendChild(balanceTag);
  }

  function renderAnalysisDetails() {
    const detailsContainer = document.getElementById('rec-details');
    if (!detailsContainer) return;
    detailsContainer.innerHTML = '';

    const report6 = RecommendationEngine.getReport('loto6');
    const report7 = RecommendationEngine.getReport('loto7');

    if (!report6 || !report7) return;

    // LOTO6 分析
    const rows = [
      {
        icon: '🔥',
        label: 'LOTO6 ホット番号（直近15回）:',
        nums: report6.hot,
        cls: 'hot-nums',
      },
      {
        icon: '❄️',
        label: 'LOTO6 コールド番号（久しぶり）:',
        nums: report6.cold,
        cls: 'cold-nums',
      },
      {
        icon: '🔥',
        label: 'LOTO7 ホット番号（直近15回）:',
        nums: report7.hot,
        cls: 'hot-nums',
      },
      {
        icon: '❄️',
        label: 'LOTO7 コールド番号（久しぶり）:',
        nums: report7.cold,
        cls: 'cold-nums',
      },
      {
        icon: '📊',
        label: '分析データ:',
        text: `LOTO6 ${report6.dataSize}回分 / LOTO7 ${report7.dataSize}回分`,
        cls: 'freq-nums',
      },
    ];

    rows.forEach(row => {
      const el = document.createElement('div');
      el.className = 'rec-detail-row';

      const icon = document.createElement('span');
      icon.className = 'detail-icon';
      icon.textContent = row.icon;
      el.appendChild(icon);

      const labelSpan = document.createElement('span');
      labelSpan.textContent = row.label;
      el.appendChild(labelSpan);

      const numsSpan = document.createElement('span');
      numsSpan.className = 'detail-nums ' + row.cls;
      if (row.nums) {
        numsSpan.textContent = row.nums.map(n => String(n).padStart(2, '0')).join('  ');
      } else if (row.text) {
        numsSpan.textContent = row.text;
      }
      el.appendChild(numsSpan);

      detailsContainer.appendChild(el);
    });
  }

  function initRecommendation() {
    // 週ラベル
    const badge = document.getElementById('rec-week-badge');
    if (badge) {
      badge.textContent = getWeekLabel();
    }

    // LOTO6 推薦番号を生成
    const rec6 = RecommendationEngine.generate('loto6');
    const report6 = RecommendationEngine.getReport('loto6');
    if (rec6) {
      renderRecommendedBalls('rec-numbers-loto6', rec6, 'loto6');
      renderAnalysisTags('rec-analysis-loto6', report6, rec6);
    }

    // LOTO7 推薦番号を生成
    const rec7 = RecommendationEngine.generate('loto7');
    const report7 = RecommendationEngine.getReport('loto7');
    if (rec7) {
      renderRecommendedBalls('rec-numbers-loto7', rec7, 'loto7');
      renderAnalysisTags('rec-analysis-loto7', report7, rec7);
    }

    // 分析詳細
    renderAnalysisDetails();
  }

  // --- Auto-generate one set on load ---
  function init() {
    createParticles();
    const game = GAMES[currentGame];
    renderResults([generateNumbers(game.max, game.pick)], currentGame);

    // Initialize recommendation section
    if (typeof RecommendationEngine !== 'undefined') {
      initRecommendation();
    }
  }

  init();
})();
