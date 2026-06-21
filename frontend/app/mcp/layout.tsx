import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "INDmoney MCP · True Wealth",
  description:
    "A programmable, read-only view of your INDmoney portfolio: MCP tools, discovery, and integration quickstart.",
};

export default function McpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
