import { describe, expect, it } from "vitest";

import { summarizeAlerts } from "./alertSummary";
import type { PortfolioAlerts, PortfolioMeta } from "../types";

describe("summarizeAlerts", () => {
  it("counts missing cost by holding id items", () => {
    const alerts: PortfolioAlerts = {
      concentration: [],
      stale_data: false,
      last_sync: null,
      missing_cost_basis: [
        { holding_id: "a", name: "Fund A" },
        { holding_id: "b", name: "Fund B" },
      ],
    };
    const meta = { data_completeness: { missing_cost_basis_count: 2 } } as PortfolioMeta;
    const s = summarizeAlerts(alerts, meta, []);
    expect(s.missingCostHoldings).toBe(2);
    expect(s.total).toBe(2);
  });
});
