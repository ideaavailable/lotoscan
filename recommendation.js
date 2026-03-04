/* ====================================
   LOTOSCAN - Recommendation Engine
   数学的・確率的・トレンド分析による
   オススメ番号生成エンジン
   ==================================== */

const RecommendationEngine = (function () {
    'use strict';

    // --- ユーティリティ ---
    function secureRandom(max) {
        if (window.crypto && window.crypto.getRandomValues) {
            const arr = new Uint32Array(1);
            window.crypto.getRandomValues(arr);
            return arr[0] / (0xFFFFFFFF + 1);
        }
        return Math.random();
    }

    function weightedRandomPick(weights) {
        const total = weights.reduce((s, w) => s + w, 0);
        let r = secureRandom() * total;
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r <= 0) return i;
        }
        return weights.length - 1;
    }

    // --- 1. 出現頻度分析 ---
    function computeFrequencies(history, maxNum) {
        const freq = new Array(maxNum + 1).fill(0);
        history.forEach(draw => {
            draw.forEach(n => freq[n]++);
        });
        return freq;
    }

    // --- 2. 直近トレンド（ホット/コールド番号）---
    function computeRecentTrend(history, maxNum, recentCount) {
        const recent = history.slice(0, recentCount);
        const older = history.slice(recentCount, recentCount * 2);

        const recentFreq = new Array(maxNum + 1).fill(0);
        const olderFreq = new Array(maxNum + 1).fill(0);

        recent.forEach(draw => draw.forEach(n => recentFreq[n]++));
        older.forEach(draw => draw.forEach(n => olderFreq[n]++));

        // トレンドスコア = 直近出現率 - 過去出現率
        const trend = new Array(maxNum + 1).fill(0);
        for (let i = 1; i <= maxNum; i++) {
            trend[i] = (recentFreq[i] / Math.max(recent.length, 1)) -
                (olderFreq[i] / Math.max(older.length, 1));
        }
        return { trend, recentFreq, olderFreq };
    }

    // --- 3. 出現間隔（ギャップ）分析 ---
    function computeGaps(history, maxNum) {
        const lastSeen = new Array(maxNum + 1).fill(Infinity);
        for (let i = 0; i < history.length; i++) {
            history[i].forEach(n => {
                if (lastSeen[n] === Infinity) {
                    lastSeen[n] = i;
                }
            });
        }
        return lastSeen; // 小さいほど最近出た、大きいほど久しぶり
    }

    // --- 4. 合計値の最適レンジ ---
    function computeOptimalSumRange(history) {
        const sums = history.map(draw => draw.reduce((a, b) => a + b, 0));
        sums.sort((a, b) => a - b);
        const q1 = sums[Math.floor(sums.length * 0.25)];
        const q3 = sums[Math.floor(sums.length * 0.75)];
        const median = sums[Math.floor(sums.length * 0.5)];
        return { min: q1, max: q3, median };
    }

    // --- 5. 偶数/奇数バランス ---
    function computeEvenOddRatio(history) {
        let totalEvens = 0;
        let totalNums = 0;
        history.forEach(draw => {
            draw.forEach(n => {
                if (n % 2 === 0) totalEvens++;
                totalNums++;
            });
        });
        return totalEvens / totalNums;
    }

    // --- 6. ゾーン分布分析（低/中/高）---
    function computeZoneDistribution(history, maxNum) {
        const third = maxNum / 3;
        const zones = [0, 0, 0]; // low, mid, high
        let total = 0;
        history.forEach(draw => {
            draw.forEach(n => {
                if (n <= third) zones[0]++;
                else if (n <= third * 2) zones[1]++;
                else zones[2]++;
                total++;
            });
        });
        return zones.map(z => z / total);
    }

    // --- 7. 連番ペア頻度 ---
    function computeConsecutivePairRate(history) {
        let totalPairs = 0;
        let consecutivePairs = 0;
        history.forEach(draw => {
            for (let i = 0; i < draw.length - 1; i++) {
                totalPairs++;
                if (draw[i + 1] - draw[i] === 1) consecutivePairs++;
            }
        });
        return consecutivePairs / totalPairs;
    }

    // --- 過去の当選組み合わせとの照合 ---
    function isDuplicateCombination(combo, history) {
        const key = combo.join(',');
        return history.some(draw => draw.join(',') === key);
    }

    // --- 今週の日付からシード生成 ---
    function getWeeklySeed() {
        const now = new Date();
        const year = now.getFullYear();
        const weekNum = Math.ceil(
            ((now - new Date(year, 0, 1)) / 86400000 + new Date(year, 0, 1).getDay() + 1) / 7
        );
        return year * 100 + weekNum;
    }

    // --- シード付き擬似乱数（週ごとに固定化）---
    function seededRandom(seed) {
        let s = seed;
        return function () {
            s = (s * 1103515245 + 12345) & 0x7fffffff;
            return s / 0x7fffffff;
        };
    }

    // --- メイン: オススメ番号を生成 ---
    function generateRecommendation(gameKey) {
        const config = {
            loto6: { max: 43, pick: 6 },
            loto7: { max: 37, pick: 7 },
        };
        const { max, pick } = config[gameKey];
        const history = HISTORICAL_DATA[gameKey];

        if (!history || history.length === 0) {
            return null;
        }

        // 各分析を実行
        const freq = computeFrequencies(history, max);
        const { trend, recentFreq } = computeRecentTrend(history, max, 15);
        const gaps = computeGaps(history, max);
        const sumRange = computeOptimalSumRange(history);
        const evenOddRatio = computeEvenOddRatio(history);
        const zoneDistribution = computeZoneDistribution(history, max);
        const consecutiveRate = computeConsecutivePairRate(history);

        // 各番号の総合スコアを計算
        const scores = new Array(max + 1).fill(0);
        const totalDraws = history.length;

        for (let n = 1; n <= max; n++) {
            // (A) 出現頻度スコア（高頻度 → 高スコア）
            const freqScore = freq[n] / totalDraws;

            // (B) トレンドスコア（上昇トレンド → 加点）
            const trendScore = trend[n];

            // (C) ギャップスコア（久しぶりの番号 → 加点、"回帰の法則"）
            const gapScore = Math.min(gaps[n] / 20, 1.0);

            // (D) ゾーンバランスボーナス
            // あまり偏らないようにするため、比較的少ないゾーンの番号を加点
            const third = max / 3;
            let zoneBonus = 0;
            if (n <= third) zoneBonus = (1 - zoneDistribution[0]) * 0.3;
            else if (n <= third * 2) zoneBonus = (1 - zoneDistribution[1]) * 0.3;
            else zoneBonus = (1 - zoneDistribution[2]) * 0.3;

            // 総合スコア（各要素を重み付き合算）
            scores[n] = (freqScore * 0.30) +      // 頻度重視: 30%
                (trendScore * 0.25) +       // トレンド重視: 25%
                (gapScore * 0.25) +          // ギャップ回帰: 25%
                (zoneBonus * 0.20);           // ゾーンバランス: 20%
        }

        // スコアを正規化して重み付きピック
        const minScore = Math.min(...scores.slice(1));
        const weights = scores.map((s, i) => i === 0 ? 0 : Math.max(s - minScore + 0.01, 0.01));

        // 週ごとのシードで安定化（同じ週なら同じ結果に）
        const weekSeed = getWeeklySeed();
        const rng = seededRandom(weekSeed + (gameKey === 'loto7' ? 7777 : 6666));

        const maxAttempts = 1000;
        let bestCombo = null;
        let bestScore = -Infinity;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const combo = [];
            const used = new Set();

            // 重み付きランダム選択
            for (let i = 0; i < pick; i++) {
                let tries = 0;
                let chosen;
                do {
                    // シードRNGとスコアを組み合わせて選択
                    const r = rng() * weights.reduce((s, w, idx) => s + (used.has(idx) ? 0 : w), 0);
                    let acc = 0;
                    chosen = 1;
                    for (let n = 1; n <= max; n++) {
                        if (used.has(n)) continue;
                        acc += weights[n];
                        if (acc >= r) { chosen = n; break; }
                    }
                    tries++;
                } while (used.has(chosen) && tries < 100);
                used.add(chosen);
                combo.push(chosen);
            }

            combo.sort((a, b) => a - b);

            // 過去の当選番号と同じなら再試行
            if (isDuplicateCombination(combo, history)) continue;

            // 品質チェック：合計値が最適レンジ内か
            const sum = combo.reduce((a, b) => a + b, 0);
            if (sum < sumRange.min || sum > sumRange.max) continue;

            // 品質チェック：偶奇バランス
            const evens = combo.filter(n => n % 2 === 0).length;
            const evenRatio = evens / pick;
            if (Math.abs(evenRatio - evenOddRatio) > 0.3) continue;

            // 品質チェック：連番が多すぎないか
            let consecutiveCount = 0;
            for (let i = 0; i < combo.length - 1; i++) {
                if (combo[i + 1] - combo[i] === 1) consecutiveCount++;
            }
            if (consecutiveCount > 2) continue;

            // 総合スコア計算
            const comboScore = combo.reduce((s, n) => s + weights[n], 0);
            if (comboScore > bestScore) {
                bestScore = comboScore;
                bestCombo = [...combo];
            }
        }

        // フォールバック: 最良が見つからない場合
        if (!bestCombo) {
            const sorted = [];
            for (let i = 1; i <= max; i++) sorted.push({ num: i, weight: weights[i] });
            sorted.sort((a, b) => b.weight - a.weight);
            bestCombo = sorted.slice(0, pick).map(x => x.num).sort((a, b) => a - b);
        }

        return bestCombo;
    }

    // --- 分析レポートを生成 ---
    function getAnalysisReport(gameKey) {
        const config = {
            loto6: { max: 43, pick: 6, label: 'LOTO6' },
            loto7: { max: 37, pick: 7, label: 'LOTO7' },
        };
        const { max, label } = config[gameKey];
        const history = HISTORICAL_DATA[gameKey];
        if (!history || history.length === 0) return null;

        const freq = computeFrequencies(history, max);
        const { recentFreq } = computeRecentTrend(history, max, 15);
        const gaps = computeGaps(history, max);

        // ホット番号（直近15回で高頻度）
        const hotNums = [];
        for (let i = 1; i <= max; i++) hotNums.push({ num: i, freq: recentFreq[i] });
        hotNums.sort((a, b) => b.freq - a.freq);
        const hot = hotNums.slice(0, 5).map(x => x.num);

        // コールド番号（長期間未出現）
        const coldNums = [];
        for (let i = 1; i <= max; i++) coldNums.push({ num: i, gap: gaps[i] });
        coldNums.sort((a, b) => b.gap - a.gap);
        const cold = coldNums.slice(0, 5).map(x => x.num);

        // 高頻度番号（全期間）
        const topFreq = [];
        for (let i = 1; i <= max; i++) topFreq.push({ num: i, freq: freq[i] });
        topFreq.sort((a, b) => b.freq - a.freq);
        const frequent = topFreq.slice(0, 5).map(x => x.num);

        return {
            label,
            hot,       // 🔥 直近のホット番号
            cold,      // ❄️ コールド番号（久しぶり）
            frequent,  // 📊 全期間高頻度
            dataSize: history.length,
        };
    }

    // Public API
    return {
        generate: generateRecommendation,
        getReport: getAnalysisReport,
    };
})();
