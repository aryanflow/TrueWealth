"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const LS_HIDE = "tw_hide_balances";
const LS_CCY = "tw_display_ccy";

export type DisplayCurrency = "INR" | "USD";

type DisplayPreferencesValue = {
  hideBalances: boolean;
  setHideBalances: (v: boolean) => void;
  toggleHideBalances: () => void;
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (c: DisplayCurrency) => void;
};

const DisplayPreferencesContext = createContext<DisplayPreferencesValue | null>(null);

export function DisplayPreferencesProvider({ children }: { children: ReactNode }) {
  const [hideBalances, setHideBalancesState] = useState(false);
  const [displayCurrency, setDisplayCurrencyState] = useState<DisplayCurrency>("INR");

  useEffect(() => {
    try {
      setHideBalancesState(window.localStorage.getItem(LS_HIDE) === "1");
      const c = window.localStorage.getItem(LS_CCY);
      if (c === "USD" || c === "INR") setDisplayCurrencyState(c);
    } catch {
      /* ignore */
    }
  }, []);

  const setHideBalances = useCallback((v: boolean) => {
    setHideBalancesState(v);
    try {
      window.localStorage.setItem(LS_HIDE, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleHideBalances = useCallback(() => setHideBalances(!hideBalances), [hideBalances, setHideBalances]);

  const setDisplayCurrency = useCallback((c: DisplayCurrency) => {
    setDisplayCurrencyState(c);
    try {
      window.localStorage.setItem(LS_CCY, c);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      hideBalances,
      setHideBalances,
      toggleHideBalances,
      displayCurrency,
      setDisplayCurrency,
    }),
    [hideBalances, setHideBalances, toggleHideBalances, displayCurrency, setDisplayCurrency],
  );

  return (
    <DisplayPreferencesContext.Provider value={value}>
      <div className={hideBalances ? "tw-hide-balances" : undefined}>{children}</div>
    </DisplayPreferencesContext.Provider>
  );
}

export function useDisplayPreferences(): DisplayPreferencesValue {
  const v = useContext(DisplayPreferencesContext);
  if (!v) throw new Error("useDisplayPreferences must be used within DisplayPreferencesProvider");
  return v;
}

export function useDisplayPreferencesOptional(): DisplayPreferencesValue | null {
  return useContext(DisplayPreferencesContext);
}
