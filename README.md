# The Regatta ⛵

**Bet on the boats. The next Blake block runs the race.**

Five boats, posted odds, one course. The tide is **Blake's testnet4** — the
BLAKE2b hardfork of Bitcoin, which parted from plain testnet4 at block 150308
and is served by [mempool.guide](https://mempool.guide/testnet4). In **⚓ Tide**
mode your bet names a Blake block that does not exist yet; when it is mined,
the race seed is
`sha256(blockHash | mark)` — so nobody, not even this page, knows the winner
before the tide comes in, and anyone can recompute it afterwards from public
chain data. Even the race replay is honest: every gust and stall is drawn from
the same seed, so two replays of the same race are identical, anywhere.

Pure static — a single `index.html` plus [`regatta.js`](regatta.js), every
pixel and sound from code. No build, no assets, no server, no dependencies.

**Play: <https://tide-games.github.io/regatta/>**

## How the tide decides

1. Your bet fixes a **mark** (random nonce) and the **height** of the next
   block, before that block exists.
2. The block is mined. `seed = sha256(blockHash | mark)`.
3. The seed rolls a number on a 10,000-point line; each boat owns a band of it
   sized by its odds (weights in `regatta.js`, append-only).
4. A winning bet pays `10000/weight × (1 − 3% edge)` — every boat has the
   identical expected value, and **verify ✓** in the log recomputes the whole
   race in your browser.

Practice mode is seeded locally and marked as such — instant, but not provable.

## The maths is a library

`regatta.js` is pure — no DOM, no clock, no network, no crypto (the caller
supplies hashes). It runs identically in the page, in node, in an offline
verifier, or vendored into a game server that wants to re-check a claimed win.

```sh
node tests.js   # 24 checks: bands, pricing EV, settlement, replay honesty, 20k-race fairness
```

## Part of tide-games

Built on the [seal pattern](https://github.com/melvincarvalho/tideholm/blob/gh-pages/BUILDING-GAMES.md):
one secp256k1 key is simultaneously a nostr identity, a Bitcoin address, and a
signer for balance moves. The roadmap, one baby step at a time:

- [x] The game — provably fair races, play-money purse, offline verification
- [ ] Courier in: arrive from Tideholm with `?did=&seal=&return=` and race with sealed gold
- [ ] Courier out: signed slips home, redeemed against the trail (needs the
      bet-before-block rule of [tideholm#154](https://github.com/melvincarvalho/tideholm/issues/154))

Doubloons are play money. Testnet4 only. When a boundary isn't airtight, it
says so on the page.
