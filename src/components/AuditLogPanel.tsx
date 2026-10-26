"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";

type Entry = { id:string; action:string; entity_type:string; entity_id:string; changed_fields:string[]; actor_id:string|null; created_at:string };
export default function AuditLogPanel() {
 const { t } = useLanguage(); const [rows,setRows]=useState<Entry[]>([]); const [error,setError]=useState("");
 useEffect(()=>{void fetch("/api/audit").then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error);setRows(j.entries??[])}).catch(e=>setError(e instanceof Error?e.message:t("ჟურნალი ვერ ჩაიტვირთა.","Could not load audit log.")))},[t]);
 return <section className="mx-auto my-8 max-w-6xl rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">{t("ცვლილებების ჟურნალი","Change log")}</h2><p className="mt-1 text-sm text-stone-500">{t("ინახება ცვლილების ველები და ავტორი. პირადი მნიშვნელობები არ იწერება.","Changed field names and actor are recorded. Personal values are not stored.")}</p>{error&&<p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}<div className="mt-4 divide-y">{rows.map(row=><div key={row.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[140px_150px_1fr]"> <time className="text-stone-500">{new Date(row.created_at).toLocaleString()}</time><span>{row.action} · {row.entity_type}</span><span className="break-all text-stone-600">{row.changed_fields.join(", ")||"—"}</span></div>)}{!error&&rows.length===0&&<p className="py-4 text-sm text-stone-500">{t("ცვლილებები ჯერ არ არის.","No changes recorded yet.")}</p>}</div></section>
}
