
# Generate complete fixed implementation for Phase 2 Arbitrage Engine
# Fixes: proper type separation (anomaly vs arbitrage), transport cost calculation, filter query

implementation = """# Phase 2: Fixed Arbitrage Engine Implementation

> **Fixes applied**:
> 1. Anomali vs Arbitrase properly separated by `type`
> 2. Transport cost from vendor DB included in profit calculation
> 3. Filter query uses correct `.eq('type', ...)`
> 4. Gemini insight only for arbitrage opportunities, not anomalies

---

## 1. Constants (lib/constants.ts)

```typescript
// lib/constants.ts
export const HET_ANOMALY_THRESHOLD = 1.02;
export const MIN_PROFIT_THRESHOLD = 50000;      // Rp 50.000
export const MIN_SPREAD_PERCENT = 0.10;         // 10%
export const TRANSPORT_COST_PER_KM = 500;       // Rp 500/km fallback

export const PROVINCE_MAP: Record<string, string> = {
  '31': 'DKI Jakarta', '32': 'Jawa Barat', '33': 'Jawa Tengah',
  '34': 'DI Yogyakarta', '35': 'Jawa Timur', '36': 'Banten',
  '51': 'Bali', '52': 'Nusa Tenggara Barat'
};

export const ISLAND_MAP: Record<string, string> = {
  '31': 'Jawa', '32': 'Jawa', '33': 'Jawa', '34': 'Jawa',
  '35': 'Jawa', '36': 'Jawa', '51': 'Bali', '52': 'Lombok'
};
```

---

## 2. Types (lib/analytics/arbitrage.ts)

```typescript
// lib/analytics/arbitrage.ts

export interface PricePoint {
  kode_wilayah: string;
  city_name: string;
  commodity_id: number;
  commodity_name: string;
  price: number;
  het_ha: number | null;
  date: string;
}

export interface TransportCost {
  from_kode: string;
  to_kode: string;
  from_city: string;
  to_city: string;
  cost_per_kg: number;
  distance_km: number;
  mode: string;
}

// ANOMALY: 1 kota, harga > HET
export interface AnomalyAlert {
  type: 'anomaly';
  severity: 'high' | 'medium' | 'low';
  commodity: string;
  city: string;
  kode_wilayah: string;
  price: number;
  het_ha: number;
  excess_percent: number;
  reason: string;
}

// ARBITRAGE: 2 kota, profit > threshold
export interface ArbitrageOpportunity {
  type: 'arbitrage';
  severity: 'high' | 'medium' | 'low';
  commodity: string;
  from_city: string;
  to_city: string;
  from_kode: string;
  to_kode: string;
  buy_price: number;
  sell_price: number;
  price_spread: number;
  transport_cost: number;
  profit_estimate: number;
  profit_percent: number;
  confidence: number;
  reason: string;
}

export type AlertResult = AnomalyAlert | ArbitrageOpportunity;
```

---

## 3. Anomaly Detection (1 Kota)

```typescript
// lib/analytics/arbitrage.ts

import { HET_ANOMALY_THRESHOLD } from '@/lib/constants';

/**
 * Detect HET anomalies: harga di 1 kota melebihi HET * threshold
 * Output: type = 'anomaly' — selalu 1 kota, tidak ada transport
 */
export function detectAnomalies(
  prices: PricePoint[],
  threshold: number = HET_ANOMALY_THRESHOLD
): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  
  for (const p of prices) {
    if (!p.het_ha || p.price <= p.het_ha * threshold) continue;
    
    const excess = ((p.price - p.het_ha) / p.het_ha) * 100;
    
    alerts.push({
      type: 'anomaly',                    // ← PENTING: type = 'anomaly'
      severity: excess > 20 ? 'high' : excess > 10 ? 'medium' : 'low',
      commodity: p.commodity_name,
      city: p.city_name,
      kode_wilayah: p.kode_wilayah,
      price: p.price,
      het_ha: p.het_ha,
      excess_percent: Math.round(excess * 100) / 100,
      reason: `Harga Rp ${p.price.toLocaleString()} melebihi HET Rp ${p.het_ha.toLocaleString()} (${excess.toFixed(1)}%)`
    });
  }
  
  return alerts.sort((a, b) => b.excess_percent - a.excess_percent);
}
```

---

## 4. Arbitrage Detection (2 Kota + Transport)

```typescript
// lib/analytics/arbitrage.ts

import { MIN_PROFIT_THRESHOLD, MIN_SPREAD_PERCENT } from '@/lib/constants';

/**
 * Find arbitrage: beli di kota A (murah), jual di kota B (mahal)
 * Profit = sell_price - buy_price - transport_cost
 * Output: type = 'arbitrage' — selalu 2 kota, ada transport
 */
export function findArbitrage(
  prices: PricePoint[],
  transportCosts: TransportCost[]
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  
  // Group by commodity
  const byCommodity = groupBy(prices, 'commodity_id');
  
  for (const [commodityId, commodityPrices] of Object.entries(byCommodity)) {
    if (commodityPrices.length < 2) continue;
    
    // Sort: cheapest first
    const sorted = [...commodityPrices].sort((a, b) => a.price - b.price);
    
    // Check all pairs (cheapest vs all others)
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const buy = sorted[i];   // Kota termurah
        const sell = sorted[j];  // Kota lain (lebih mahal)
        
        const spread = sell.price - buy.price;
        const spreadPercent = spread / buy.price;
        
        // Skip if spread too small
        if (spreadPercent < MIN_SPREAD_PERCENT) continue;
        
        // Find transport cost from vendor DB
        const transport = findTransportCost(
          buy.kode_wilayah, 
          sell.kode_wilayah, 
          transportCosts
        );
        
        // Skip if no transport route
        if (!transport) continue;
        
        const profit = spread - transport.cost_per_kg;
        
        // Skip if not profitable
        if (profit < MIN_PROFIT_THRESHOLD) continue;
        
        opportunities.push({
          type: 'arbitrage',              // ← PENTING: type = 'arbitrage'
          severity: profit > 200000 ? 'high' : profit > 100000 ? 'medium' : 'low',
          commodity: buy.commodity_name,
          from_city: buy.city_name,
          to_city: sell.city_name,
          from_kode: buy.kode_wilayah,
          to_kode: sell.kode_wilayah,
          buy_price: buy.price,
          sell_price: sell.price,
          price_spread: spread,
          transport_cost: transport.cost_per_kg,
          profit_estimate: profit,
          profit_percent: Math.round((profit / buy.price) * 100),
          confidence: Math.min(95, Math.round((profit / spread) * 100)),
          reason: `Beli Rp ${buy.price.toLocaleString()} di ${buy.city_name} → Jual Rp ${sell.price.toLocaleString()} di ${sell.city_name}. Transport Rp ${transport.cost_per_kg.toLocaleString()}. Profit Rp ${profit.toLocaleString()}`
        });
      }
    }
  }
  
  return opportunities.sort((a, b) => b.profit_estimate - a.profit_estimate);
}

// Helper: find transport cost between 2 cities
function findTransportCost(
  fromKode: string,
  toKode: string,
  transportCosts: TransportCost[]
): TransportCost | null {
  // Direct route
  const direct = transportCosts.find(
    t => t.from_kode === fromKode && t.to_kode === toKode
  );
  if (direct) return direct;
  
  // Reverse route (A→B or B→A)
  const reverse = transportCosts.find(
    t => t.from_kode === toKode && t.to_kode === fromKode
  );
  if (reverse) return { ...reverse, from_kode: fromKode, to_kode: toKode };
  
  return null;
}

// Helper: group array by key
function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key]);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
```

---

## 5. Gemini Insight (Hanya untuk Arbitrage)

```typescript
// lib/ai/agents/arbitrage/gemini-agent.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ArbitrageOpportunity, AnomalyAlert } from '@/lib/analytics/arbitrage';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface GeminiInsight {
  insights: string[];
  recommendedActions: string[];
  riskFactors: string[];
}

/**
 * Gemini insight HANYA untuk arbitrage opportunities
 * Anomalies tidak perlu Gemini (sudah jelas dari HET)
 */
export async function analyzeArbitrageWithGemini(
  opportunities: ArbitrageOpportunity[]
): Promise<GeminiInsight> {
  if (opportunities.length === 0) {
    return {
      insights: ['Tidak ada opportunity arbitrase yang menguntungkan saat ini'],
      recommendedActions: ['Pantau pergerakan harga secara berkala'],
      riskFactors: ['Harga bisa berubah sewaktu-waktu']
    };
  }
  
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: `Kamu adalah analis arbitrase pangan profesional. Berikan insight strategis untuk opportunity arbitrase antar kota. Fokus pada: (1) Kenapa spread harga terjadi, (2) Faktor risiko, (3) Rekomendasi aksi konkret.`
  });
  
  const context = opportunities.slice(0, 5).map(o => 
    `- ${o.commodity}: ${o.from_city} (Rp ${o.buy_price.toLocaleString()}) → ${o.to_city} (Rp ${o.sell_price.toLocaleString()}). Profit Rp ${o.profit_estimate.toLocaleString()} (${o.profit_percent}%)`
  ).join('\n');
  
  const prompt = `\nTop 5 Opportunity Arbitrase:\n${context}\n\nBerikan:\n1. Kenapa spread harga terjadi (3 bullet)\n2. Faktor risiko (3 bullet)\n3. Rekomendasi aksi konkret (3 bullet)\n\nFormat JSON: { "insights": [], "recommendedActions": [], "riskFactors": [] }`;
  
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1] || jsonMatch[0]);
    }
  } catch (e) {
    console.error('Gemini failed:', e);
  }
  
  return {
    insights: [`Ditemukan ${opportunities.length} opportunity arbitrase`],
    recommendedActions: ['Evaluasi transport dan logistik sebelum eksekusi'],
    riskFactors: ['Harga bisa berubah sebelum barang sampai']
  };
}
```

---

## 6. API Route (Fixed)

```typescript
// app/api/agents/arbitrage/route.ts

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectAnomalies, findArbitrage, PricePoint, TransportCost } from '@/lib/analytics/arbitrage';
import { analyzeArbitrageWithGemini } from '@/lib/ai/agents/arbitrage/gemini-agent';

export async function POST(req: NextRequest) {
  try {
    const { date } = await req.json().catch(() => ({}));
    const supabase = createClient();
    
    // 1. Fetch latest prices
    const { data: prices, error: pricesError } = await supabase
      .rpc('get_sp2kp_latest', { p_island: null, p_province: null });
    
    if (pricesError) throw pricesError;
    
    // 2. Fetch transport costs from vendor DB
    const { data: transportCosts, error: transportError } = await supabase
      .from('transport_vendors')
      .select('from_kode, to_kode, from_city, to_city, cost_per_kg, distance_km, mode');
    
    if (transportError) throw transportError;
    
    // 3. Transform to PricePoint
    const pricePoints: PricePoint[] = prices.map((p: any) => ({
      kode_wilayah: p.kode_wilayah,
      city_name: p.city_name || p.kode_wilayah,
      commodity_id: p.commodity_id,
      commodity_name: p.commodity_name,
      price: p.price_latest,
      het_ha: p.het_ha,
      date: p.date
    }));
    
    // 4. Statistical analysis
    const anomalies = detectAnomalies(pricePoints);
    const opportunities = findArbitrage(pricePoints, transportCosts || []);
    
    // 5. Gemini insight (HANYA untuk arbitrage)
    const geminiInsight = await analyzeArbitrageWithGemini(opportunities);
    
    // 6. Store ANOMALIES (type = 'anomaly')
    const anomalyRows = anomalies.map(a => ({
      type: 'anomaly' as const,           // ← EXPLICIT type
      severity: a.severity,
      commodity: a.commodity,
      from_location: a.city,              // 1 kota
      to_location: null,                  // ← NULL untuk anomali
      from_kode: a.kode_wilayah,
      to_kode: null,                      // ← NULL untuk anomali
      price_spread: a.excess_percent,
      profit_estimate: null,              // ← NULL untuk anomali
      confidence: Math.min(100, Math.round(a.excess_percent * 5)),
      reason: a.reason,
      insights: [`HET anomaly: ${a.excess_percent.toFixed(1)}% di atas batas`],
      recommended_actions: ['Pantau harga', 'Evaluasi pasokan'],
      is_read: false,
      created_at: new Date().toISOString()
    }));
    
    // 7. Store ARBITRAGE (type = 'arbitrage')
    const arbitrageRows = opportunities.map(o => ({
      type: 'arbitrage' as const,         // ← EXPLICIT type
      severity: o.severity,
      commodity: o.commodity,
      from_location: o.from_city,         // Kota asal
      to_location: o.to_city,               // Kota tujuan ← WAJIB ADA
      from_kode: o.from_kode,
      to_kode: o.to_kode,                   // ← WAJIB ADA
      price_spread: o.price_spread,
      profit_estimate: o.profit_estimate,   // ← WAJIB ADA
      confidence: o.confidence,
      reason: o.reason,
      insights: geminiInsight.insights,
      recommended_actions: geminiInsight.recommended_actions,
      is_read: false,
      created_at: new Date().toISOString()
    }));
    
    // 8. Bulk insert
    const allRows = [...anomalyRows, ...arbitrageRows];
    
    if (allRows.length > 0) {
      const { error: insertError } = await supabase
        .from('arbitrage_alerts')
        .insert(allRows);
      
      if (insertError) throw insertError;
    }
    
    // 9. Return
    return Response.json({
      success: true,
      anomalies: anomalies.length,
      arbitrage: opportunities.length,
      total: allRows.length,
      insights: geminiInsight.insights,
      recommendedActions: geminiInsight.recommendedActions
    });
    
  } catch (error) {
    console.error('Arbitrage analysis failed:', error);
    return Response.json(
      { 
        success: false, 
        error: (error as Error).message,
        // Fallback: return empty but don't crash
        anomalies: 0,
        arbitrage: 0
      },
      { status: 500 }
    );
  }
}
```

---

## 7. Database Migration (Fixed)

```sql
-- supabase/migrations/015_arbitrage_alerts.sql

CREATE TABLE arbitrage_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Type: PENTING untuk filter
  type TEXT NOT NULL CHECK (type IN ('anomaly', 'arbitrage')),
  
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  commodity TEXT NOT NULL,
  
  -- Location: anomaly = 1 kota (to_location NULL)
  --          arbitrage = 2 kota (both filled)
  from_location TEXT NOT NULL,
  to_location TEXT,
  from_kode TEXT NOT NULL,
  to_kode TEXT,
  
  -- Metrics
  price_spread DECIMAL,
  profit_estimate DECIMAL,        -- NULL untuk anomaly
  confidence INT CHECK (confidence >= 0 AND confidence <= 100),
  
  -- Content
  reason TEXT NOT NULL,
  insights TEXT[],
  recommended_actions TEXT[],
  
  -- State
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Indexes for filtering
CREATE INDEX idx_arbitrage_alerts_type ON arbitrage_alerts(type);
CREATE INDEX idx_arbitrage_alerts_unread ON arbitrage_alerts(is_read) WHERE is_read = false;
CREATE INDEX idx_arbitrage_alerts_commodity ON arbitrage_alerts(commodity);
CREATE INDEX idx_arbitrage_alerts_created ON arbitrage_alerts(created_at DESC);
CREATE INDEX idx_arbitrage_alerts_severity ON arbitrage_alerts(severity);

-- RLS
ALTER TABLE arbitrage_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read arbitrage alerts" 
  ON arbitrage_alerts FOR SELECT USING (true);
```

---

## 8. Frontend Filter (Fixed)

```typescript
// components/arbitrase/AlertFilter.tsx

'use client';

import { useState } from 'react';
import useSWR from 'swr';

export function AlertCenter() {
  const [filterType, setFilterType] = useState<'all' | 'anomaly' | 'arbitrage'>('all');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  
  const { data: alerts, error, isLoading } = useSWR(
    `/api/agents/arbitrage/list?type=${filterType}&severity=${filterSeverity}`,
    fetcher,
    { refreshInterval: 30000 } // Auto refresh every 30s
  );
  
  return (
    <div>
      {/* Type Filter */}
      <div className="flex gap-2 mb-4">
        <button 
          onClick={() => setFilterType('all')}
          className={filterType === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}
        >
          Semua ({alerts?.total || 0})
        </button>
        <button 
          onClick={() => setFilterType('anomaly')}
          className={filterType === 'anomaly' ? 'bg-red-600 text-white' : 'bg-gray-200'}
        >
          ⚠️ Anomali ({alerts?.anomalies || 0})
        </button>
        <button 
          onClick={() => setFilterType('arbitrage')}
          className={filterType === 'arbitrage' ? 'bg-green-600 text-white' : 'bg-gray-200'}
        >
          💰 Arbitrase ({alerts?.arbitrage || 0})
        </button>
      </div>
      
      {/* Severity Filter */}
      <div className="flex gap-2 mb-4">
        {['all', 'high', 'medium', 'low'].map(s => (
          <button
            key={s}
            onClick={() => setFilterSeverity(s as any)}
            className={filterSeverity === s ? 'bg-yellow-500' : 'bg-gray-200'}
          >
            {s === 'all' ? 'Semua' : s === 'high' ? '🔴 High' : s === 'medium' ? '🟡 Medium' : '🟢 Low'}
          </button>
        ))}
      </div>
      
      {/* Alert List */}
      {isLoading && <p>Memuat...</p>}
      {error && <p className="text-red-500">Error: {error.message}</p>}
      
      {alerts?.data?.map((alert: any) => (
        <AlertCard key={alert.id} alert={alert} />
      ))}
    </div>
  );
}

function AlertCard({ alert }: { alert: any }) {
  const isAnomaly = alert.type === 'anomaly';
  const isArbitrage = alert.type === 'arbitrage';
  
  return (
    <div className={`p-4 mb-2 rounded-lg ${
      isAnomaly ? 'border-l-4 border-red-500 bg-red-50' : 
      isArbitrage ? 'border-l-4 border-green-500 bg-green-50' : 
      'bg-gray-100'
    }`}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <span className={`text-xs font-bold px-2 py-1 rounded ${
            isAnomaly ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'
          }`}>
            {isAnomaly ? '⚠️ ANOMALI HET' : '💰 ARBITRASE'}
          </span>
          <span className={`ml-2 text-xs px-2 py-1 rounded ${
            alert.severity === 'high' ? 'bg-red-100 text-red-700' :
            alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
            'bg-green-100 text-green-700'
          }`}>
            {alert.severity.toUpperCase()}
          </span>
        </div>
        <span className="text-gray-400 text-sm">
          {new Date(alert.created_at).toLocaleString('id-ID')}
        </span>
      </div>
      
      {/* Content */}
      <h3 className="font-bold mt-2">{alert.commodity}</h3>
      
      {isAnomaly && (
        <div className="mt-2">
          <p>Kota: <strong>{alert.from_location}</strong></p>
          <p>Harga: Rp {alert.price_spread?.toLocaleString()}% di atas HET</p>
        </div>
      )}
      
      {isArbitrage && (
        <div className="mt-2">
          <p>Rute: <strong>{alert.from_location}</strong> → <strong>{alert.to_location}</strong></p>
          <p>Spread: Rp {alert.price_spread?.toLocaleString()}</p>
          <p className="text-green-700 font-bold">
            Profit: Rp {alert.profit_estimate?.toLocaleString()} ({alert.confidence}% confidence)
          </p>
        </div>
      )}
      
      <p className="text-gray-600 mt-2 text-sm">{alert.reason}</p>
      
      {/* Gemini Insights (only for arbitrage) */}
      {isArbitrage && alert.insights?.length > 0 && (
        <div className="mt-3 p-2 bg-blue-50 rounded">
          <p className="text-xs font-bold text-blue-800">💡 AI Insight:</p>
          <ul className="text-sm text-blue-700 list-disc list-inside">
            {alert.insights.map((i: string, idx: number) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const fetcher = (url: string) => fetch(url).then(r => r.json());
```

---

## 9. API List Route (For Filter)

```typescript
// app/api/agents/arbitrage/list/route.ts

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createClient();
  
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'all';
  const severity = searchParams.get('severity') || 'all';
  const limit = parseInt(searchParams.get('limit') || '100');
  
  let query = supabase
    .from('arbitrage_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  // FIX: Proper type filtering
  if (type !== 'all') {
    query = query.eq('type', type);  // 'anomaly' or 'arbitrage'
  }
  
  if (severity !== 'all') {
    query = query.eq('severity', severity);
  }
  
  const { data, error } = await query;
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  
  // Count by type
  const anomalies = data?.filter(d => d.type === 'anomaly').length || 0;
  const arbitrage = data?.filter(d => d.type === 'arbitrage').length || 0;
  
  return Response.json({
    data,
    total: data?.length || 0,
    anomalies,
    arbitrage
  });
}
```

---

## 10. Auto-Trigger dari Ingest

```typescript
// app/api/ingest/sp2kp/route.ts (tambahkan di akhir)

// After successful insert:
try {
  const triggerRes = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/agents/arbitrage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        date: new Date().toISOString().split('T')[0] 
      })
    }
  );
  
  if (!triggerRes.ok) {
    console.error('Arbitrage trigger failed:', await triggerRes.text());
  }
} catch (e) {
  console.error('Failed to trigger arbitrage:', e);
  // Don't fail ingest if trigger fails
}
```

---

## ✅ Checklist Fix

| File | Fix | Status |
|------|-----|--------|
| `lib/constants.ts` | Add MIN_PROFIT, MIN_SPREAD, TRANSPORT_COST | ✅ |
| `lib/analytics/arbitrage.ts` | `detectAnomalies()` returns `type: 'anomaly'` | ✅ |
| `lib/analytics/arbitrage.ts` | `findArbitrage()` returns `type: 'arbitrage'` | ✅ |
| `lib/analytics/arbitrage.ts` | Transport cost from vendor DB included | ✅ |
| `lib/ai/agents/arbitrage/gemini-agent.ts` | Only called for arbitrage, not anomalies | ✅ |
| `app/api/agents/arbitrage/route.ts` | Insert with correct `type` | ✅ |
| `app/api/agents/arbitrage/route.ts` | Fetch transport_vendors | ✅ |
| `app/api/agents/arbitrage/list/route.ts` | Filter `.eq('type', ...)` | ✅ |
| `supabase/migrations/015_arbitrage_alerts.sql` | `type` column with CHECK constraint | ✅ |
| `components/arbitrase/AlertCard.tsx` | Render based on `type` prop | ✅ |
| `components/arbitrase/AlertFilter.tsx` | Buttons set correct filter type | ✅ |

---

*Fixed implementation. Key changes: explicit type separation, transport cost calculation, Gemini only for arbitrage.*
"""

with open('/mnt/agents/output/PHASE2_FIXED_IMPLEMENTATION.md', 'w') as f:
    f.write(implementation)

print(f"✅ PHASE2_FIXED_IMPLEMENTATION.md generated: {len(implementation)} chars, {implementation.count(chr(10))} lines")
print(f"📄 Saved to: /mnt/agents/output/PHASE2_FIXED_IMPLEMENTATION.md")
