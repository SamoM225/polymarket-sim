# Polymarket Simulator

Frontend pre prediction market simuláciu - Next.js - Supabase
## SQL súbory sa nachádzajú pod priečinkom supabase a v jeho podadresároch



## Spustenie

```bash
npm i
npm run dev
```

## API

> **FE priamo volá Supabase RPC**

### `buy_outcome`

Nakup YES/NO pozicie s slippage protection.

**Request:**
```typescript
await supabase.rpc('buy_outcome', {
  p_market_id: "uuid",
  p_outcome_id: "uuid",
  p_investment_usdc: 100.0,
  p_user_id: "uuid",
  p_bet_type: "YES",  // alebo "NO"
  p_min_shares_out: 49.75,  // min shares (slippage protection)
  p_accept_new_odds: false  // akceptovať zmenenú cenu
})
```

**Response (success):**
```json
{
  "success": true,
  "shares_bought": 50.25,
  "price": 1.99,
  "total_shares": 50.25
}
```

**Response (slippage):**
```json
{
  "success": false,
  "error": "SLIPPAGE_DETECTED",
  "expected_shares": 49.75,
  "new_shares": 45.10,
  "new_price": 2.21
}
```

---

### `sell_outcome`

Predaj akcií.

**Request:**
```typescript
await supabase.rpc('sell_outcome', {
  p_market_id: "uuid",
  p_outcome_id: "uuid",
  p_shares_to_sell: 10.0,
  p_user_id: "uuid"
})
```

**Response:**
```json
{
  "success": true,
  "proceeds": 9.85
}
```

---

## Architektura

### Kľúčové súbory

**Libs:**
- `lib/realtimeManager.ts` - Realtime subscription manager
- `lib/hooks.ts` - React hooks pre data fetching
- `lib/supabaseClient.ts` - Supabase init

**Utils:**
- `utils/math.ts` - Kurzy (1/pool vzorec)
- `utils/odds.ts` - Price normalizácia + fee

**Components:**
- `components/OrderBook.tsx` - Order book display
- `components/PriceChart.tsx` - Ceny chart
- `components/PortfolioDropdown.tsx` - User pozicie
- `components/right-panel/BuyPanel.tsx` - Buy UI
- `components/right-panel/SellPanel.tsx` - Sell UI

### Database

**Hlavné tabuľky:**
- `markets` - Markety (type, status, liquidity, risk_multiplier)
- `outcomes` - Outcomes (label, pool, current_fee_rate)
- `positions` - User pozície (shares, avg_price)
- `price_history` - Price tracking
- `trades` - Trade história

**RPC Functions:**
- `buy_outcome(market_id, outcome_id, investment, user_id, bet_type)` - Nakup
- `sell_outcome(market_id, outcome_id, shares, user_id)` - Predaj

### Realtime

Manager (`realtimeManager.ts`) subscribuje na:
- `markets` - price updates
- `outcomes` - pool changes
- `positions` - user balance
- `trades` - order book feed

Auto-reconnect pri network issues.

---

### Niektoré BE funkcie majú dev response, ktoré je možné vymazať

---

## Development

```bash
# Lint
npm run lint

# Build
npm run build

# Start production
npm start
```
