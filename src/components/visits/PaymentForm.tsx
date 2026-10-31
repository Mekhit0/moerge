"use client";

import React, { useMemo, useState } from "react";
import { Banknote, CreditCard, SplitSquareHorizontal } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { computePayment, formatGel, type DiscountMode, type PaymentBreakdown, type PaymentMethod } from "@/lib/visit-flow";
import { Button, Chip, Field, Input, Tabs, cn } from "@/components/ui";

const toNumber = (value: string) => {
  const parsed = Number(value.replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const TIP_PRESETS = [0, 5, 10, 20];

/**
 * Take payment for one visit: price (pre-filled, editable for extra work), discount in ₾ or %,
 * tip, and cash, card or a split. The total to collect is always shown large at the bottom.
 */
export function PaymentForm({ defaultPrice, busy, onSubmit, onCancel }: {
  defaultPrice: number;
  busy: boolean;
  onSubmit: (breakdown: PaymentBreakdown) => void;
  onCancel: () => void;
}) {
  const { lang, t } = useLanguage();
  const [price, setPrice] = useState(String(defaultPrice));
  const [discountMode, setDiscountMode] = useState<DiscountMode>("gel");
  const [discountValue, setDiscountValue] = useState("");
  const [tip, setTip] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [splitCash, setSplitCash] = useState("");

  const breakdown = useMemo(() => computePayment({
    price: toNumber(price),
    discountMode,
    discountValue: toNumber(discountValue),
    tip: toNumber(tip),
    method,
    splitCash: toNumber(splitCash),
  }), [price, discountMode, discountValue, tip, method, splitCash]);

  const errors: Record<NonNullable<PaymentBreakdown["error"]>, string> = {
    price: t("ფასი არასწორია.", "The price is not valid."),
    discount: t("ფასდაკლება ფასზე მეტია.", "The discount is larger than the price."),
    tip: t("თიფი არასწორია.", "The tip is not valid."),
    split: t("ნაღდი თანხა მთლიან თანხაზე მეტია.", "The cash part is more than the total."),
  };

  const methods: Array<{ value: PaymentMethod; label: string; icon: React.ReactNode }> = [
    { value: "cash", label: t("ნაღდი", "Cash"), icon: <Banknote className="h-5 w-5" /> },
    { value: "card", label: t("ბარათი", "Card"), icon: <CreditCard className="h-5 w-5" /> },
    { value: "split", label: t("ორივე", "Both"), icon: <SplitSquareHorizontal className="h-5 w-5" /> },
  ];

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => { event.preventDefault(); if (!breakdown.error) onSubmit(breakdown); }}
    >
      <Field label={t("ფასი", "Price")} hint={t("შეცვალეთ, თუ დამატებითი სამუშაო შესრულდა.", "Change it if extra work was done.")}>
        {(props) => <Input {...props} type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} />}
      </Field>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-stone-700">{t("ფასდაკლება", "Discount")}</span>
          <Tabs label={t("ფასდაკლების ტიპი", "Discount type")} value={discountMode} onChange={setDiscountMode}
            items={[{ value: "gel", label: "₾" }, { value: "percent", label: "%" }]} />
        </div>
        <Input aria-label={t("ფასდაკლება", "Discount")} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0"
          value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} />
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-stone-700">{t("თიფი", "Tip")}</span>
        <div className="flex flex-wrap gap-2">
          {TIP_PRESETS.map((amount) => (
            <Chip key={amount} selected={toNumber(tip) === amount && (tip !== "" || amount === 0)} onClick={() => setTip(amount === 0 ? "" : String(amount))}>
              {amount === 0 ? t("არა", "None") : formatGel(amount, lang)}
            </Chip>
          ))}
          <Input aria-label={t("სხვა თიფი", "Other tip")} type="number" inputMode="decimal" min="0" step="0.01" placeholder={t("სხვა", "Other")}
            className="w-28 min-h-11" value={TIP_PRESETS.includes(toNumber(tip)) ? "" : tip} onChange={(event) => setTip(event.target.value)} />
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-stone-700">{t("გადახდის ხერხი", "Paid by")}</span>
        <div className="grid grid-cols-3 gap-2">
          {methods.map((item) => (
            <button key={item.value} type="button" aria-pressed={method === item.value} onClick={() => setMethod(item.value)}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border text-sm font-semibold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                method === item.value ? "border-brand bg-brand-soft text-brand-strong" : "border-stone-200 bg-white text-stone-600 hover:border-rose-300"
              )}>
              {item.icon}{item.label}
            </button>
          ))}
        </div>
        {method === "split" && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label={t("ნაღდი", "Cash")}>
              {(props) => <Input {...props} type="number" inputMode="decimal" min="0" step="0.01" value={splitCash} onChange={(event) => setSplitCash(event.target.value)} />}
            </Field>
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-stone-700">{t("ბარათი", "Card")}</span>
              <p className="flex min-h-12 items-center rounded-xl bg-stone-50 px-4 text-base font-semibold text-stone-800">{formatGel(Math.max(breakdown.card, 0), lang)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-stone-50 p-4 text-sm">
        <div className="flex justify-between text-stone-600"><span>{t("ფასი", "Price")}</span><span>{formatGel(breakdown.price, lang)}</span></div>
        {breakdown.discount > 0 && <div className="mt-1 flex justify-between text-stone-600"><span>{t("ფასდაკლება", "Discount")}</span><span>−{formatGel(breakdown.discount, lang)}</span></div>}
        {breakdown.tip > 0 && <div className="mt-1 flex justify-between text-stone-600"><span>{t("თიფი", "Tip")}</span><span>+{formatGel(breakdown.tip, lang)}</span></div>}
        <div className="mt-3 flex items-end justify-between border-t border-stone-200 pt-3">
          <span className="font-semibold text-stone-800">{t("გადასახდელი", "To collect")}</span>
          <span className="text-3xl font-black text-stone-900">{formatGel(breakdown.collect, lang)}</span>
        </div>
      </div>

      {breakdown.error && <p role="alert" className="text-sm font-medium text-red-700">{errors[breakdown.error]}</p>}

      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Button variant="secondary" size="lg" onClick={onCancel}>{t("უკან", "Back")}</Button>
        <Button type="submit" size="lg" loading={busy} disabled={Boolean(breakdown.error)}>
          {t(`მიღება · ${formatGel(breakdown.collect, lang)}`, `Take ${formatGel(breakdown.collect, lang)}`)}
        </Button>
      </div>
    </form>
  );
}
