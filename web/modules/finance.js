import { state } from "./state.js";

export function getSalesRevenue(period = "all") {
  const sales = state.transactions.filter(transaction => {
    if (String(transaction.type || "").trim().toUpperCase() !== "SALE") return false;
    if (period !== "today") return true;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const timestamp = Number(transaction.timestamp);
    return Number.isFinite(timestamp) && timestamp >= start && timestamp <= now.getTime();
  });
  return sales.reduce(
    (total, sale) => total + Number(sale.amount || 0),
    0
  );
}

export function getProfitBreakdown() {
  const sales = state.transactions.filter(
    transaction => String(transaction.type || "").trim().toUpperCase() === "SALE"
  );
  const revenue = sales.reduce((total, sale) => total + Number(sale.amount || 0), 0);
  const cogs = sales.reduce(
    (total, sale) => total + (
      sale.cogs != null
        ? Number(sale.cogs)
        : Number(sale.costPerUnit || 0) * Number(sale.qty || 0)
    ),
    0
  );
  const grossProfit = revenue - cogs;
  const operatingExpenses = Number(state.operatingExpenses || 0);
  const interest = Number(state.interest || 0);
  const taxes = Number(state.taxes || 0);
  const netProfit = grossProfit - operatingExpenses - interest - taxes;

  return {
    revenue,
    cogs,
    grossProfit,
    operatingExpenses,
    interest,
    taxes,
    netProfit
  };
}

export function getProfitValue(type = "gross") {
  const breakdown = getProfitBreakdown();
  return type === "net" ? breakdown.netProfit : breakdown.grossProfit;
}
