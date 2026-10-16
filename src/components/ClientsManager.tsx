"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  Plus,
  Search,
  Archive,
  ArchiveRestore,
  Edit3,
  Eye,
  Mail,
  Phone,
  Calendar,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { Client } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";

interface ClientsManagerProps {
  initialClients: Client[];
}

export default function ClientsManager({
  initialClients,
}: ClientsManagerProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "active" | "archived" | "all"
  >("active");

  // Modal state for Add / Edit
  const [modalOpen, setModalOpen] = useState(searchParams.get("new") === "1");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [emailConsent, setEmailConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Confirmation modal for archiving
  const [archiveTarget, setArchiveTarget] = useState<Client | null>(null);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (statusFilter === "active" && c.is_archived) return false;
      if (statusFilter === "archived" && !c.is_archived) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          c.full_name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [clients, statusFilter, search]);

  function openNewClientModal() {
    setEditingClient(null);
    setFullName("");
    setEmail("");
    setPhone("");
    setNotes("");
    setEmailConsent(true);
    setFormError(null);
    setModalOpen(true);
  }

  function openEditClientModal(client: Client) {
    setEditingClient(client);
    setFullName(client.full_name);
    setEmail(client.email);
    setPhone(client.phone ?? "");
    setNotes(client.notes ?? "");
    setEmailConsent(client.email_consent);
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSaveClient(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        notes: notes.trim() || null,
        email_consent: emailConsent,
      };

      const url = editingClient
        ? `/api/clients/${editingClient.id}`
        : "/api/clients";
      const method = editingClient ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(
          data.error ||
            t("კლიენტის შენახვა ვერ მოხერხდა.", "Could not save client.")
        );
        setSubmitting(false);
        return;
      }

      if (editingClient) {
        setClients((prev) =>
          prev.map((c) => (c.id === data.client.id ? data.client : c))
        );
        setToast(
          t(
            `განახლდა კლიენტის პროფილი: ${data.client.full_name}.`,
            `Updated profile for ${data.client.full_name}.`
          )
        );
      } else {
        setClients((prev) => [data.client, ...prev]);
        setToast(
          t(
            `${data.client.full_name} დაემატა კლიენტების ბაზაში.`,
            `Added ${data.client.full_name} to your salon client list.`
          )
        );
      }

      setModalOpen(false);
      router.refresh();
    } catch {
      setFormError(
        t(
          "ქსელური შეცდომა კლიენტის შენახვისას.",
          "Network error while saving client."
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmArchiveToggle(client: Client) {
    const nextArchived = !client.is_archived;
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: nextArchived }),
      });
      const data = await res.json();
      if (res.ok && data.client) {
        setClients((prev) =>
          prev.map((c) => (c.id === client.id ? data.client : c))
        );
        setToast(
          nextArchived
            ? t(
                `კლიენტი ${client.full_name} გადატანილია არქივში. ვიზიტების ისტორია შენარჩუნებულია, ხოლო მოლოდინში მყოფი შეხსენებები გაუქმდა.`,
                `Archived ${client.full_name}. Historical appointments are preserved and pending reminders were canceled.`
              )
            : t(
                `კლიენტი ${client.full_name} დაბრუნდა აქტიურ სიაში.`,
                `Restored ${client.full_name} to active clients.`
              )
        );
        router.refresh();
      }
    } finally {
      setArchiveTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-rose-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-rose-600" />
            {t("კლიენტების ბაზა", "Client Directory")}
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            {t(
              "მართეთ კლიენტების პროფილები, ელ-ფოსტის შეხსენების თანხმობა და ეპილაციის ისტორია.",
              "Manage client profiles, email reminder consent, and historical epilation records."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={openNewClientModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-sm shadow-rose-600/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t("ახალი კლიენტის დამატება", "Add New Client")}
        </button>
      </div>

      {toast && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toast}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs font-semibold text-emerald-800 underline cursor-pointer"
          >
            {t("დახურვა", "Dismiss")}
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-rose-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(
              "მოძებნეთ კლიენტი სახელით, ელ-ფოსტით ან ტელეფონით...",
              "Search clients by name, email address, or phone..."
            )}
            aria-label="Search clients"
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 bg-stone-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl">
          {(["active", "archived", "all"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer ${
                statusFilter === tab
                  ? "bg-white text-rose-700 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {tab === "active"
                ? t("აქტიური", "Active")
                : tab === "archived"
                ? t("არქივი", "Archived")
                : t("ყველა", "All")}
            </button>
          ))}
        </div>
      </div>

      {/* Clients List / Table */}
      <div className="bg-white rounded-3xl border border-rose-100 shadow-sm overflow-hidden">
        {filteredClients.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-rose-300 mx-auto" />
            <h3 className="mt-3 text-base font-semibold text-stone-800">
              {t("კლიენტები ვერ მოიძებნა", "No matching clients found")}
            </h3>
            <p className="mt-1 text-xs text-stone-500 max-w-md mx-auto">
              {statusFilter === "archived"
                ? t(
                    "არქივში კლიენტები არ არის.",
                    "You do not have any archived clients."
                  )
                : t(
                    "დაარეგისტრირეთ კლიენტი სახელითა და ელ-ფოსტით 21-დღიანი შეხსენებების ჩასართავად.",
                    "Register a client with their full name and email address to start scheduling 21-day epilation reminders."
                  )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-rose-100 bg-rose-50/40 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  <th className="py-3.5 px-6">{t("კლიენტი", "Client")}</th>
                  <th className="py-3.5 px-4">
                    {t(
                      "კონტაქტი (მხოლოდ ელ-ფოსტით შეხსენება)",
                      "Contact (Email Only for Reminders)"
                    )}
                  </th>
                  <th className="py-3.5 px-4">
                    {t("ელ-ფოსტის თანხმობა", "Email Consent")}
                  </th>
                  <th className="py-3.5 px-4">
                    {t(
                      "ბოლო ეპილაცია / მომდევნო ვიზიტი",
                      "Last Epilation / Next Expected"
                    )}
                  </th>
                  <th className="py-3.5 px-6 text-right">
                    {t("მოქმედება", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm">
                {filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    className={`hover:bg-rose-50/25 transition ${
                      client.is_archived ? "opacity-65 bg-stone-50/50" : ""
                    }`}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-semibold text-stone-900 hover:text-rose-600 transition"
                        >
                          {client.full_name}
                        </Link>
                        {client.is_archived && (
                          <span className="px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 text-[10px] font-bold uppercase">
                            {t("არქივი", "Archived")}
                          </span>
                        )}
                      </div>
                      {client.notes && (
                        <p className="text-xs text-stone-500 line-clamp-1 mt-0.5 max-w-xs">
                          {client.notes}
                        </p>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 text-stone-800 text-xs font-medium">
                        <Mail className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        {client.email}
                      </div>
                      {client.phone && (
                        <div
                          title={t(
                            "მხოლოდ საცნობაროდ — არ გამოიყენება შეტყობინებებისთვის",
                            "Reference only — never used for notifications"
                          )}
                          className="flex items-center gap-1.5 text-stone-400 text-xs mt-0.5"
                        >
                          <Phone className="w-3 h-3 shrink-0" />
                          {client.phone} ({t("მხოლოდ კონტაქტი", "ref only")})
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      {client.email_consent && !client.unsubscribed_at ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                          {t("გამოწერილია", "Subscribed")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium">
                          {t("გამოწერა გაუქმებულია", "Unsubscribed")}
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-xs">
                      {client.last_completed_epilation_date ? (
                        <div>
                          <div className="text-stone-600">
                            {t("ბოლო:", "Last:")}{" "}
                            <strong>
                              {client.last_completed_epilation_date}
                            </strong>
                          </div>
                          {client.next_expected_appointment_date && (
                            <div className="text-rose-700 font-semibold mt-0.5 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {t("მომდევნო (+21დ):", "Next (+21d):")}{" "}
                              {client.next_expected_appointment_date}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-stone-400">
                          {t(
                            "დასრულებული ეპილაცია ჯერ არ აქვს",
                            "No completed epilation yet"
                          )}
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/clients/${client.id}`}
                          className="p-2 rounded-xl border border-stone-200 hover:bg-rose-50 text-stone-600 hover:text-rose-700 transition"
                          title={t(
                            "კლიენტის პროფილი და ისტორია",
                            "View Client Profile & History"
                          )}
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditClientModal(client)}
                          className="p-2 rounded-xl border border-stone-200 hover:bg-rose-50 text-stone-600 hover:text-rose-700 transition cursor-pointer"
                          title={t("რედაქტირება", "Edit Client")}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setArchiveTarget(client)}
                          className="p-2 rounded-xl border border-stone-200 hover:bg-amber-50 text-stone-600 hover:text-amber-800 transition cursor-pointer"
                          title={
                            client.is_archived
                              ? t("აღდგენა", "Restore Client")
                              : t("დაარქივება", "Archive Client")
                          }
                        >
                          {client.is_archived ? (
                            <ArchiveRestore className="w-4 h-4" />
                          ) : (
                            <Archive className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Client Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl border border-rose-100 shadow-2xl max-w-lg w-full p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-stone-900">
                {editingClient
                  ? t("კლიენტის პროფილის რედაქტირება", "Edit Client Profile")
                  : t("ახალი კლიენტის დამატება", "Add New Client")}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveClient} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  {t("სრული სახელი და გვარი *", "Full Name *")}
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("ნინო ბერიძე", "Sophia Beaumont")}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  {t(
                    "ელ-ფოსტის მისამართი * (21-დღიანი შეხსენებებისთვის)",
                    "Email Address * (Used for 21-Day Reminders)"
                  )}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nino@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  {t(
                    "ტელეფონის ნომერი (არასავალდებულო — არ გამოიყენება შეტყობინებისთვის)",
                    "Phone Number (Optional — Never Used for Notifications)"
                  )}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+995 555 12 34 56"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <p className="mt-1 text-[11px] text-stone-400">
                  {t(
                    "შეხსენებები იგზავნება მხოლოდ ელ-ფოსტაზე. ტელეფონის ნომერი ინახება მხოლოდ ადმინისტრაციული ცნობისთვის.",
                    "Email is the exclusive notification channel. Phone numbers are stored for desk reference only."
                  )}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                  {t(
                    "შენიშვნები და პრეფერენციები (არასავალდებულო)",
                    "Treatment Preferences & Notes (Optional)"
                  )}
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t(
                    "კანის მგრძნობელობა, სასურველი ლაზერის პარამეტრები...",
                    "Skin sensitivity notes, preferred laser settings, etc."
                  )}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-50/50 border border-rose-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailConsent}
                  onChange={(e) => setEmailConsent(e.target.checked)}
                  className="mt-0.5 rounded border-stone-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-xs text-stone-700 leading-relaxed">
                  <strong>
                    {t(
                      "კლიენტი თანახმაა მიიღოს ავტომატური ელ-ფოსტის შეხსენება",
                      "Client consents to receive automated email reminders"
                    )}
                  </strong>{" "}
                  {t(
                    "დასრულებული ეპილაციის ვიზიტიდან 21 დღის შემდეგ.",
                    "21 days after completed epilation appointments."
                  )}
                </span>
              </label>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 cursor-pointer"
                >
                  {t("გაუქმება", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold shadow-sm cursor-pointer"
                >
                  {submitting
                    ? t("ინახება...", "Saving...")
                    : editingClient
                    ? t("ცვლილებების შენახვა", "Save Changes")
                    : t("კლიენტის რეგისტრაცია", "Register Client")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Archive / Restore */}
      {archiveTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl border border-rose-100 shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-stone-900">
              {archiveTarget.is_archived
                ? t(
                    `აღვადგინოთ ${archiveTarget.full_name}?`,
                    `Restore ${archiveTarget.full_name}?`
                  )
                : t(
                    `დავაარქივოთ ${archiveTarget.full_name}?`,
                    `Archive ${archiveTarget.full_name}?`
                  )}
            </h3>
            <p className="mt-2 text-xs text-stone-600 leading-relaxed">
              {archiveTarget.is_archived
                ? t(
                    "კლიენტი დაბრუნდება აქტიურ სიაში და შეძლებს მომავალი შეხსენებების მიღებას.",
                    "This client will be restored to your active client list and can receive future reminders when new epilation appointments are completed."
                  )
                : t(
                    "დაარქივება დამალავს კლიენტს აქტიური სიიდან და გააუქმებს მის მომავალ შეხსენებებს, თუმცა სრულად შეინახავს ვიზიტებისა და ელ-ფოსტის ისტორიას.",
                    "Archiving hides this client from your active booking list and cancels any pending scheduled email reminders, while preserving all historical appointment and email records."
                  )}
            </p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
              >
                {t("გაუქმება", "Cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmArchiveToggle(archiveTarget)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                {archiveTarget.is_archived
                  ? t("დიახ, აღდგენა", "Confirm Restore")
                  : t("დიახ, დაარქივება", "Confirm Archive")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
