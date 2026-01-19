// lib/excel/intentContract.js
export const INTENT_CONTRACT = {
  domain: "finance_personal | business_tpv | hospital | agenda | generic",
  period: "daily | weekly | monthly | annual | one_time",
  layout: "simple_table | ledger | dashboard | report",
  features: {
    payment_methods: true,
    commissions: true,
    categories: true,
    budget: false,
    taxes: false,
    charts: ["bar", "pie", "line"],
    kpis: ["total_income", "total_expense", "net", "by_payment_method"],
  },
  columns: ["date", "concept", "amount", "type", "payment_method", "notes"],
  currency: "MXN",
  locale: "es-MX",
};
