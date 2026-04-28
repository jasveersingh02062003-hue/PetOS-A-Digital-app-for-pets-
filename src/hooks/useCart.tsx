import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type CartItem = {
  product_id: string;
  seller_id: string;
  title: string;
  price_inr: number;
  image_url: string | null;
  qty: number;
};

type CartCtx = {
  items: CartItem[];
  add: (i: Omit<CartItem, "qty">, qty?: number) => void;
  remove: (product_id: string) => void;
  setQty: (product_id: string, qty: number) => void;
  clear: () => void;
  total: number;
  count: number;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "petpals.cart.v1";

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const add: CartCtx["add"] = (i, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((p) => p.product_id === i.product_id);
      if (existing) {
        return prev.map((p) =>
          p.product_id === i.product_id ? { ...p, qty: p.qty + qty } : p,
        );
      }
      return [...prev, { ...i, qty }];
    });
  };
  const remove: CartCtx["remove"] = (id) =>
    setItems((p) => p.filter((x) => x.product_id !== id));
  const setQty: CartCtx["setQty"] = (id, qty) =>
    setItems((p) =>
      p.map((x) => (x.product_id === id ? { ...x, qty: Math.max(1, qty) } : x)),
    );
  const clear = () => setItems([]);
  const total = items.reduce((s, i) => s + i.price_inr * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <Ctx.Provider value={{ items, add, remove, setQty, clear, total, count }}>
      {children}
    </Ctx.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
};
