"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, graphql } from "@/lib/api";
import {
  normalizeCalculation,
  normalizeExpense,
  normalizeProduct,
  normalizeSale,
  normalizeSettings,
  expenseToPayload,
  productToPayload,
  saleToPayload,
  type ExpenseDraft,
  type SaleDraft,
} from "@/lib/normalize";
import {
  DEFAULT_SETTINGS,
  type Calculation,
  type Expense,
  type Product,
  type Sale,
  type Settings,
} from "@/lib/types";
import { useAuth } from "./AuthProvider";

const EXPENSES_QUERY = `
  query Expenses($limit: Int) {
    expenses(limit: $limit) {
      _id
      type
      description
      amount
      paymentMethod
      category
      notes
      expenseDate
      createdAt
    }
  }
`;

const ROW_LIMIT = 1000;

interface DataContextValue {
  sales: Sale[];
  expenses: Expense[];
  products: Product[];
  calculations: Calculation[];
  settings: Settings;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastSyncedAt: string | null;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  createSale: (draft: SaleDraft) => Promise<Sale>;
  updateSale: (id: string, draft: SaleDraft) => Promise<Sale>;
  deleteSale: (id: string) => Promise<void>;
  createExpense: (draft: ExpenseDraft) => Promise<Expense>;
  updateExpense: (id: string, draft: ExpenseDraft) => Promise<Expense>;
  deleteExpense: (id: string) => Promise<void>;
  createProduct: (draft: ProductDraft) => Promise<Product>;
  updateProduct: (id: string, draft: ProductDraft) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;
  createCalculation: (draft: {
    name: string;
    expression: string;
    result: number;
    savedAt?: string;
  }) => Promise<Calculation>;
  deleteCalculation: (id: string) => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<Settings>;
}

export interface ProductDraft {
  name: string;
  price: number;
  imageUri: string;
  category: string;
  details: string;
  sourceUrl: string;
}

const DataContext = createContext<DataContextValue | null>(null);

const byDateDesc = <T extends { date: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const loadedFor = useRef<string | null>(null);

  const load = useCallback(async (silent: boolean) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const results = await Promise.allSettled([
      api.get<unknown[]>(`/api/sales?limit=${ROW_LIMIT}`),
      graphql<{ expenses: unknown[] }>(EXPENSES_QUERY, { limit: ROW_LIMIT }),
      api.get<unknown[]>("/api/products"),
      api.get<unknown>("/api/settings"),
      api.get<unknown[]>("/api/calculations"),
    ]);

    const failures: string[] = [];

    const [salesResult, expensesResult, productsResult, settingsResult, calcResult] =
      results;

    if (salesResult.status === "fulfilled") {
      const list = Array.isArray(salesResult.value)
        ? salesResult.value
        : ((salesResult.value as { sales?: unknown[] })?.sales ?? []);
      setSales(byDateDesc(list.map(normalizeSale)));
    } else {
      failures.push(message(salesResult.reason));
    }

    if (expensesResult.status === "fulfilled") {
      const list = expensesResult.value?.expenses ?? [];
      setExpenses(byDateDesc(list.map(normalizeExpense)));
    } else {
      failures.push(message(expensesResult.reason));
    }

    if (productsResult.status === "fulfilled") {
      const list = Array.isArray(productsResult.value)
        ? productsResult.value
        : ((productsResult.value as { products?: unknown[] })?.products ?? []);
      setProducts(list.map(normalizeProduct));
    } else {
      failures.push(message(productsResult.reason));
    }

    if (settingsResult.status === "fulfilled") {
      setSettings(normalizeSettings(settingsResult.value));
    } else {
      failures.push(message(settingsResult.reason));
    }

    if (calcResult.status === "fulfilled") {
      const list = Array.isArray(calcResult.value) ? calcResult.value : [];
      setCalculations(list.map(normalizeCalculation));
    } else {
      failures.push(message(calcResult.reason));
    }

    setError(failures.length ? failures[0] : null);
    setLastSyncedAt(new Date().toISOString());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!user) {
      loadedFor.current = null;
      return;
    }
    if (loadedFor.current === user.id) return;
    loadedFor.current = user.id;
    void load(false);
  }, [user, load]);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      await load(options?.silent ?? true);
    },
    [load]
  );

  /* ---------------- Sales ---------------- */
  const createSale = useCallback(async (draft: SaleDraft) => {
    const created = normalizeSale(await api.post("/api/sales", saleToPayload(draft)));
    setSales((current) => byDateDesc([created, ...current]));
    return created;
  }, []);

  const updateSale = useCallback(async (id: string, draft: SaleDraft) => {
    const updated = normalizeSale(await api.put(`/api/sales/${id}`, saleToPayload(draft)));
    setSales((current) => byDateDesc(current.map((sale) => (sale.id === id ? updated : sale))));
    return updated;
  }, []);

  const deleteSale = useCallback(async (id: string) => {
    await api.delete(`/api/sales/${id}`);
    setSales((current) => current.filter((sale) => sale.id !== id));
  }, []);

  /* ---------------- Expenses ---------------- */
  const createExpense = useCallback(async (draft: ExpenseDraft) => {
    const created = normalizeExpense(await api.post("/api/expenses", expenseToPayload(draft)));
    setExpenses((current) => byDateDesc([created, ...current]));
    return created;
  }, []);

  const updateExpense = useCallback(async (id: string, draft: ExpenseDraft) => {
    const updated = normalizeExpense(await api.put(`/api/expenses/${id}`, expenseToPayload(draft)));
    setExpenses((current) =>
      byDateDesc(current.map((expense) => (expense.id === id ? updated : expense)))
    );
    return updated;
  }, []);

  const deleteExpense = useCallback(async (id: string) => {
    await api.delete(`/api/expenses/${id}`);
    setExpenses((current) => current.filter((expense) => expense.id !== id));
  }, []);

  /* ---------------- Products ---------------- */
  const createProduct = useCallback(async (draft: ProductDraft) => {
    const created = normalizeProduct(await api.post("/api/products", productToPayload(draft)));
    setProducts((current) => [created, ...current]);
    return created;
  }, []);

  const updateProduct = useCallback(async (id: string, draft: ProductDraft) => {
    const updated = normalizeProduct(
      await api.put(`/api/products/${id}`, productToPayload(draft))
    );
    setProducts((current) => current.map((product) => (product.id === id ? updated : product)));
    return updated;
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    await api.delete(`/api/products/${id}`);
    setProducts((current) => current.filter((product) => product.id !== id));
  }, []);

  /* ---------------- Calculations ---------------- */
  const createCalculation = useCallback(
    async (draft: { name: string; expression: string; result: number; savedAt?: string }) => {
      const created = normalizeCalculation(await api.post("/api/calculations", draft));
      setCalculations((current) =>
        [created, ...current].sort(
          (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        )
      );
      return created;
    },
    []
  );

  const deleteCalculation = useCallback(async (id: string) => {
    await api.delete(`/api/calculations/${id}`);
    setCalculations((current) => current.filter((entry) => entry.id !== id));
  }, []);

  /* ---------------- Settings ---------------- */
  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    const updated = normalizeSettings(await api.put("/api/settings", updates));
    setSettings(updated);
    return updated;
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      sales,
      expenses,
      products,
      calculations,
      settings,
      loading,
      refreshing,
      error,
      lastSyncedAt,
      refresh,
      createSale,
      updateSale,
      deleteSale,
      createExpense,
      updateExpense,
      deleteExpense,
      createProduct,
      updateProduct,
      deleteProduct,
      createCalculation,
      deleteCalculation,
      updateSettings,
    }),
    [
      sales,
      expenses,
      products,
      calculations,
      settings,
      loading,
      refreshing,
      error,
      lastSyncedAt,
      refresh,
      createSale,
      updateSale,
      deleteSale,
      createExpense,
      updateExpense,
      deleteExpense,
      createProduct,
      updateProduct,
      deleteProduct,
      createCalculation,
      deleteCalculation,
      updateSettings,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

function message(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  return String(reason);
}

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within DataProvider");
  return context;
}
