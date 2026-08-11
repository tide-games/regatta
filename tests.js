// tests.js — run: node tests.js  (exits non-zero on failure)
import { createHash } from 'node:crypto';
import {
  BOATS, WEIGHT_SPACE, EDGE_BPS,
  rollFromHash, winnerIndex, quote, settle, verifyRace, raceTrace,
} from './regatta.js';

let fails = 0;
function ok(cond, name) {
  if (cond) console.log('  ok ', name);
  else { fails++; console.error('  FAIL', name); }
}
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

// ---- weights & bands
ok(BOATS.reduce((s, b) => s + b.weight, 0) === WEIGHT_SPACE, 'weights sum to the space');
ok(winnerIndex(0) === 0, 'roll 0 goes to the first boat');
ok(winnerIndex(WEIGHT_SPACE - 1) === BOATS.length - 1, 'last roll goes to the last boat');
{
  let start = 0;
  let allEdges = true;
  BOATS.forEach((b, i) => {
    if (winnerIndex(start) !== i) allEdges = false;
    if (winnerIndex(start + b.weight - 1) !== i) allEdges = false;
    start += b.weight;
  });
  ok(allEdges, 'every band edge lands in its own boat');
}
{
  let threw = false;
  try { winnerIndex(WEIGHT_SPACE); } catch { threw = true; }
  ok(threw, 'roll outside the space throws');
}

// ---- rolls
ok(rollFromHash('ff') === 255 % WEIGHT_SPACE, 'small hex rolls exactly');
ok(rollFromHash(sha256('a')) === rollFromHash(sha256('a')), 'rolls are deterministic');
ok(rollFromHash(sha256('a')) !== rollFromHash(sha256('b')), 'different seeds differ');
{
  let inRange = true;
  for (let i = 0; i < 500; i++) {
    const r = rollFromHash(sha256('seed' + i));
    if (r < 0 || r >= WEIGHT_SPACE || !Number.isInteger(r)) inRange = false;
  }
  ok(inRange, '500 rolls all land inside the space');
}

// ---- pricing: the house edge is exactly EDGE_BPS in expectation
{
  let evOk = true;
  BOATS.forEach((b, i) => {
    const q = quote(i, 1_000_000);
    const ev = q.chance * q.multiplier; // expected return per coin staked
    if (Math.abs(ev - (1 - EDGE_BPS / 10_000)) > 1e-9) evOk = false;
  });
  ok(evOk, 'every boat has identical expected value: 1 - edge');
}
ok(quote(4, 100).payout > quote(0, 100).payout, 'the longshot pays more than the favorite');
ok(quote(0, 100).payout > 100, 'even the favorite pays better than the stake');
{
  let threw = 0;
  for (const bad of [0, -5, 1.5, NaN]) { try { quote(0, bad); } catch { threw++; } }
  ok(threw === 4, 'non-positive / fractional stakes are refused');
}

// ---- settle
{
  const winRoll = 0;                       // band of boat 0
  const s = settle({ boatIndex: 0, stake: 100, roll: winRoll });
  ok(s.won && s.payout === quote(0, 100).payout && s.delta === s.payout - 100,
    'a winning bet pays the quoted amount');
  const l = settle({ boatIndex: 4, stake: 100, roll: winRoll });
  ok(!l.won && l.payout === 0 && l.delta === -100, 'a losing bet pays nothing');
}

// ---- verifyRace recomputes everything from the seed
{
  const seed = sha256(sha256('blockhash') + '|' + 'mark123');
  const v = verifyRace({ seedHex: seed, boatIndex: 2, stake: 250 });
  ok(v.roll === rollFromHash(seed), 'verify re-derives the roll');
  ok(v.winner === winnerIndex(v.roll), 'verify re-derives the winner');
  const again = verifyRace({ seedHex: seed, boatIndex: 2, stake: 250 });
  ok(JSON.stringify(v) === JSON.stringify(again), 'verification is deterministic');
}

// ---- the replay is honest
{
  const seed = sha256('race-seed');
  const winner = winnerIndex(rollFromHash(seed));
  const trace = raceTrace(seed, winner);
  const last = trace[trace.length - 1];
  ok(last[winner] === 1, 'the decided winner crosses the line');
  let winnerFirst = true;
  for (let i = 0; i < last.length; i++) {
    if (i !== winner && last[i] >= 1) winnerFirst = false;
  }
  ok(winnerFirst, 'nobody else reaches the line');
  let monotone = true;
  for (let t = 1; t < trace.length; t++) {
    for (let i = 0; i < last.length; i++) {
      if (trace[t][i] < trace[t - 1][i]) monotone = false;
    }
  }
  ok(monotone, 'boats never sail backwards');
  const replay = raceTrace(seed, winner);
  ok(JSON.stringify(trace.map((f) => [...f])) === JSON.stringify(replay.map((f) => [...f])),
    'the same seed replays the identical race');
  // Every possible winner can be traced (the UI animates any outcome).
  let allWinners = true;
  for (let w = 0; w < BOATS.length; w++) {
    const t = raceTrace(sha256('s' + w), w);
    if (t[t.length - 1][w] !== 1) allWinners = false;
  }
  ok(allWinners, 'raceTrace honors any decided winner');
}

// ---- long-run fairness: empirical win rates track the weights
{
  const wins = new Array(BOATS.length).fill(0);
  const N = 20_000;
  for (let i = 0; i < N; i++) wins[winnerIndex(rollFromHash(sha256('fair' + i)))]++;
  let fair = true;
  BOATS.forEach((b, i) => {
    const expected = (b.weight / WEIGHT_SPACE) * N;
    if (Math.abs(wins[i] - expected) > 4 * Math.sqrt(expected)) fair = false; // 4σ
  });
  ok(fair, '20k races: every boat wins at its posted odds (within 4 sigma)');
}

if (fails) { console.error(`\n${fails} failing`); process.exit(1); }
console.log('\nall tests pass');
