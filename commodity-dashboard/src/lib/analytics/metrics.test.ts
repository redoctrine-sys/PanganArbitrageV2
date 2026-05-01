import { describe, it, expect } from "vitest";
import {
  calcChangePct,
  calcVolatility,
  calcVsAvg,
  calcTrend,
  formatRupiah,
  formatRupiahShort,
  formatPct,
  volatilityBucket,
} from "./metrics";

describe("calcChangePct", () => {
  it("calculates positive change", () => {
    expect(calcChangePct(110, 100)).toBeCloseTo(10);
  });

  it("calculates negative change", () => {
    expect(calcChangePct(90, 100)).toBeCloseTo(-10);
  });

  it("returns null when prev is null", () => {
    expect(calcChangePct(110, null)).toBeNull();
  });

  it("returns null when prev is undefined", () => {
    expect(calcChangePct(110, undefined)).toBeNull();
  });

  it("returns null when prev is 0 (avoid division by zero)", () => {
    expect(calcChangePct(110, 0)).toBeNull();
  });
});

describe("calcVolatility", () => {
  it("calculates (max - min) / avg × 100", () => {
    expect(calcVolatility(120, 80, 100)).toBeCloseTo(40);
  });

  it("returns null when max is null", () => {
    expect(calcVolatility(null, 80, 100)).toBeNull();
  });

  it("returns null when min is null", () => {
    expect(calcVolatility(120, null, 100)).toBeNull();
  });

  it("returns null when avg is null", () => {
    expect(calcVolatility(120, 80, null)).toBeNull();
  });

  it("returns null when avg is 0", () => {
    expect(calcVolatility(120, 80, 0)).toBeNull();
  });
});

describe("calcVsAvg", () => {
  it("calculates positive deviation", () => {
    expect(calcVsAvg(110, 100)).toBeCloseTo(10);
  });

  it("calculates negative deviation", () => {
    expect(calcVsAvg(90, 100)).toBeCloseTo(-10);
  });

  it("returns null when avg is null", () => {
    expect(calcVsAvg(110, null)).toBeNull();
  });

  it("returns null when avg is 0", () => {
    expect(calcVsAvg(110, 0)).toBeNull();
  });
});

describe("calcTrend", () => {
  it("returns flat when fewer than 3 prices", () => {
    expect(calcTrend([100, 110])).toBe("flat");
    expect(calcTrend([100])).toBe("flat");
    expect(calcTrend([])).toBe("flat");
  });

  it("returns up when recent prices are rising (latest > earliest in window)", () => {
    expect(calcTrend([110, 105, 100])).toBe("up");
  });

  it("returns down when recent prices are falling", () => {
    expect(calcTrend([100, 105, 110])).toBe("down");
  });

  it("returns flat when slope is below TREND_FLAT_THRESHOLD", () => {
    // slope = (100 - 100) / 100 = 0 < 0.01
    expect(calcTrend([100, 100, 100])).toBe("flat");
  });

  it("returns flat when slope magnitude < 1%", () => {
    // slope = (100.5 - 100) / 100 = 0.005 < 0.01
    expect(calcTrend([100.5, 100.2, 100])).toBe("flat");
  });
});

describe("formatRupiah", () => {
  it("formats integer rupiah", () => {
    expect(formatRupiah(35000)).toBe("Rp 35.000");
  });

  it("returns em dash for null", () => {
    expect(formatRupiah(null)).toBe("—");
  });

  it("returns em dash for undefined", () => {
    expect(formatRupiah(undefined)).toBe("—");
  });

  it("returns em dash for NaN", () => {
    expect(formatRupiah(NaN)).toBe("—");
  });
});

describe("formatRupiahShort", () => {
  it("formats millions", () => {
    expect(formatRupiahShort(1_500_000)).toBe("Rp 1.5jt");
  });

  it("formats thousands", () => {
    expect(formatRupiahShort(35_000)).toBe("Rp 35k");
  });

  it("formats sub-thousand", () => {
    expect(formatRupiahShort(500)).toBe("Rp 500");
  });

  it("returns em dash for null", () => {
    expect(formatRupiahShort(null)).toBe("—");
  });
});

describe("formatPct", () => {
  it("formats positive with + sign", () => {
    expect(formatPct(10)).toBe("+10.0%");
  });

  it("formats negative without + sign", () => {
    expect(formatPct(-5)).toBe("-5.0%");
  });

  it("respects digits parameter", () => {
    expect(formatPct(10.123, 2)).toBe("+10.12%");
  });

  it("returns em dash for null", () => {
    expect(formatPct(null)).toBe("—");
  });
});

describe("volatilityBucket", () => {
  it("null → lo", () => expect(volatilityBucket(null)).toBe("lo"));
  it("< 5 → lo", () => expect(volatilityBucket(4.9)).toBe("lo"));
  it("5–14.9 → mid", () => expect(volatilityBucket(10)).toBe("mid"));
  it(">= 15 → hi", () => expect(volatilityBucket(15)).toBe("hi"));
});
