export type AssetType = string;
export type Country = string;
export type Currency = string;

export interface NormalizedHolding {
  id: string;
  name: string;
  symbol: string | null;
  isin: string | null;
  asset_type: AssetType;
  country: Country;
  currency: Currency;
  quantity: number;
  avg_cost: number | null;
  last_price: number | null;
  market_value: number;
  unrealized_pnl: number | null;
  day_change_value: number | null;
  weight: number;
  source: string;
  updated_at: string;
  asset_class_l2?: string | null;
  inr_market_value?: number;
  inr_unrealized_pnl?: number | null;
  inr_day_change_value?: number | null;
  fx_usd_inr_used?: number | null;
  fx_as_of?: string | null;
  return_local_pct?: number | null;
  return_fx_inr_pct?: number | null;
  return_total_inr_pct?: number | null;
  book_include?: boolean;
  cost_basis_source?: "mcp" | "manual" | string | null;
}

export interface AllocationSlice {
  key: string;
  value: number;
  pct: number;
}

export interface PortfolioTotals {
  market_value: number;
  day_change_value: number;
  day_change_pct: number | null;
  unrealized_pnl: number | null;
  base_currency?: string;
}

export interface DataCompleteness {
  score: number;
  fx_mode: string;
  missing_cost_basis_count: number;
  transactions_available: boolean;
  ohlc_coverage_pct: number;
  excluded_suspicious_price_count?: number;
  invalid_price_count?: number;
  excluded_suspicious_price_hint?: string;
}

export interface PortfolioCoverage {
  provided: string[];
  absent: string[];
}

export interface ActiveViewSummary {
  id: string;
  name: string;
  include_asset_groups: Record<string, boolean>;
}

export interface McpToolSummary {
  name: string;
  description?: string | null;
}

export interface PortfolioMeta {
  last_holdings_sync: string | null;
  last_price_sync: string | null;
  mode: string;
  mcp_endpoint: string | null;
  mcp_connected: boolean;
  mcp_degraded: boolean;
  tool_inventory: string[];
  mcp_tools?: McpToolSummary[];
  mcp_holdings_tool?: string | null;
  mcp_transactions_tool?: string | null;
  mcp_bearer_configured?: boolean;
  indmoney_oauth_connected?: boolean;
  base_currency?: string;
  fx_usd_inr?: number | null;
  fx_as_of?: string | null;
  data_completeness?: DataCompleteness;
  active_view?: ActiveViewSummary | null;
  full_book_totals?: PortfolioTotals | null;
  excluded_value?: number;
  coverage?: PortfolioCoverage;
  history_matches_view?: boolean;
  last_snapshot_at?: string | null;
  confidence?: string;
  last_error?: string | null;
  confidence_notes?: string[];
}

export interface PortfolioAllocationSlices {
  by_asset_type: AllocationSlice[];
  by_currency: AllocationSlice[];
  by_country: AllocationSlice[];
}

export interface ConcentrationAlert {
  holding_id: string;
  name: string;
  weight: number;
  threshold: number;
  target_weight_pct?: number;
  inr_market_value?: number;
  suggested_trim_inr?: number;
  suggested_dilute_inr?: number;
}

export interface MissingCostBasisItem {
  holding_id: string;
  name: string;
}

export interface ShieldSnapshot {
  data_pct: number;
  risk_pct: number;
  align_pct: number;
  score: number;
  missing_cost: number;
  invalid_price: number;
  breach_text: string;
  align_subline: string;
  formula: string;
}

export interface PortfolioAlerts {
  concentration: ConcentrationAlert[];
  stale_data: boolean;
  last_sync: string | null;
  missing_cost_basis: MissingCostBasisItem[];
}

export interface ActionPlanItem {
  rank: number;
  issue: string;
  why_it_matters: string;
  fix_a: string;
  fix_b: string;
  constraints: string;
  confidence: string;
  suggested_trim_inr?: number | null;
  suggested_dilute_inr?: number | null;
  holding_id?: string | null;
}

export interface PortfolioPerformance {
  xirr_annualized?: number | null;
  xirr_status: string;
  twrr_since_first_snapshot?: number | null;
  max_drawdown_pct?: number | null;
  current_drawdown_pct?: number | null;
  vol_30d_ann_pct?: number | null;
  vol_90d_ann_pct?: number | null;
  sharpe_90d?: number | null;
}

export interface MfFundSummary {
  holding_id: string;
  name: string;
  symbol: string | null;
  category: string | null;
  expense_ratio: number | null;
  benchmark_name: string | null;
  data_status: string;
}

export interface HistoryPoint {
  snapshot_date: string;
  inr_market_value: number;
  inr_full_book?: number;
}

export interface PortfolioResponse {
  totals: PortfolioTotals;
  allocation: PortfolioAllocationSlices;
  top_holdings: NormalizedHolding[];
  alerts: PortfolioAlerts;
  holdings: NormalizedHolding[];
  meta: PortfolioMeta;
  action_plan: ActionPlanItem[];
  performance: PortfolioPerformance;
  mf_lab: MfFundSummary[];
  history: HistoryPoint[];
  /** USD-denominated native lines only (% of INR book); Indian listings are INR in the model. */
  usd_exposure_pct?: number;
  /** US-listed equity (US stocks + US ETFs) as % of active INR book. */
  global_equity_offshore_pct?: number;
  /** Full-book allocation when the active view excludes sleeves (API root). */
  allocation_full_book?: PortfolioAllocationSlices | null;
  shield?: ShieldSnapshot | null;
}
