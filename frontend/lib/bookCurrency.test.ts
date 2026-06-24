import { describe, expect, it } from "vitest";

import { bookCurrencyLabel, formatBookAmount } from "./bookCurrency";

describe("bookCurrency", () => {
  it("converts INR book to USD with FX", () => {
    const s = formatBookAmount(9461, { displayCurrency: "USD", fxUsdInr: 94.61 });
    expect(s).toMatch(/\$100/);
  });

  it("masks label includes FX", () => {
    expect(bookCurrencyLabel("USD", 94.61)).toContain("94.61");
  });
});
