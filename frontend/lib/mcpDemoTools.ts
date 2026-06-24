export type DemoTool = {
  name: string;
  desc: string;
  req: Record<string, unknown>;
  res: Record<string, unknown>;
};

export const MCP_PUBLIC_ENDPOINT = "https://mcp.indmoney.com/mcp";

export const DEMO_TOOLS: DemoTool[] = [
  {
    name: "tools/list",
    desc: "List tools exposed by the MCP server.",
    req: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
    res: {
      jsonrpc: "2.0",
      id: 1,
      result: {
        tools: [
          { name: "portfolio/holdings", description: "Fetch current holdings" },
          { name: "portfolio/transactions", description: "Fetch transactions (if available)" },
          { name: "mutualfunds/compare", description: "Compare mutual funds" },
        ],
      },
    },
  },
  {
    name: "portfolio/holdings",
    desc: "Fetch current holdings across assets and accounts.",
    req: {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "portfolio/holdings", arguments: {} },
    },
    res: {
      jsonrpc: "2.0",
      id: 2,
      result: {
        holdings: [
          {
            name: "HDFC Bank Ltd",
            asset_type: "IN_STOCK",
            currency: "INR",
            quantity: 50,
            avg_cost: 1450.2,
            last_price: 1520.25,
          },
          {
            name: "Parag Parikh Flexi Cap Fund",
            asset_type: "MF",
            currency: "INR",
            quantity: 1240.532,
            nav: 58.2,
          },
          { name: "Liquid Cash", asset_type: "CASH", currency: "INR", amount: 125000 },
        ],
      },
    },
  },
  {
    name: "portfolio/transactions",
    desc: "Fetch buys, sells, dividends, and corporate actions if provided.",
    req: {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "portfolio/transactions", arguments: { from: "2025-04-01" } },
    },
    res: {
      jsonrpc: "2.0",
      id: 3,
      result: {
        transactions: [
          { date: "2026-06-10", type: "BUY", name: "HDFC Bank Ltd", quantity: 10, price: 1488.0 },
          { date: "2026-06-14", type: "DIVIDEND", name: "HDFC Bank Ltd", amount: 210.0 },
        ],
      },
    },
  },
  {
    name: "mutualfunds/compare",
    desc: "Compare mutual funds by returns, risk, fees, and overlap.",
    req: {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "mutualfunds/compare", arguments: { a: "PPFAS", b: "QUANT" } },
    },
    res: {
      jsonrpc: "2.0",
      id: 4,
      result: {
        comparison: {
          a: { name: "Parag Parikh Flexi Cap", expense_ratio: 0.62, aum_cr: 65000 },
          b: { name: "Quant Flexi Cap", expense_ratio: 0.74, aum_cr: 22000 },
          overlap_pct: 31,
        },
      },
    },
  },
];

export const QUICKSTART_SNIPPET = `# Minimal integration outline (pseudo-code)

MCP_ENDPOINT = "${MCP_PUBLIC_ENDPOINT}"

# 1) Discover tools
request = {
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}

# POST MCP_ENDPOINT with JSON, parse response
# tools = response["result"]["tools"]

# 2) Call holdings (name comes from inventory)
call_req = {
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "<holdings_tool_name>",
    "arguments": {}
  }
}

# 3) Normalize to a stable schema in your app
# 4) Stream updates to UI — show last refresh time always
`;
