"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Copy, Mail, MessageCircle, Send, UserPlus, Users } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Alert, Badge, Button, Card, CardHeader, Chip, ChipRow, Dialog, EmptyState, Field, Input, Sheet, Skeleton, useToast } from "@/components/ui";

type Role = "owner" | "admin" | "staff";
interface Member { user_id: string; role: Role; is_active: boolean; full_name: string; email: string }
interface StaffRow { id: string; full_name: string; color: string | null; user_id: string | null; is_active: boolean }
interface Invite { id: string; email: string; role: "admin" | "staff"; staff_id: string | null; expires_at: string; created_at: string }
interface TeamData { me: { user_id: string; role: Role }; members: Member[]; staff: StaffRow[]; invites: Invite[] }
interface Created { email: string; link: string; emailed: boolean }

function localMessage(message: string, lang: "ka" | "en") {
  const [ka, en] = message.split(" / ");
  return lang === "en" && en ? en : ka;
}

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data, error: response.ok ? null : String(data.error ?? "Error") };
}

/**
 * Who can sign in to the salon. The owner and admins invite people by a one-time link (sent by email
 * when email is set up, and easy to share by WhatsApp or Viber). Only the owner changes roles.
 */
export default function TeamAccess() {
  const { lang, t } = useLanguage();
  const toast = useToast();
  const [data, setData] = useState<TeamData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [presetStaff, setPresetStaff] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<Member | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await send("/api/team", "GET");
    if (!result.ok) { setLoadError(localMessage(result.error ?? "", lang)); return; }
    setData(result.data as TeamData);
    setLoadError(null);
  }, [lang]);

  useEffect(() => { void load(); }, [load]);

  const roleLabel = (role: Role) => role === "owner" ? t("მფლობელი", "Owner") : role === "admin" ? t("ადმინისტრატორი", "Admin") : t("სპეციალისტი", "Specialist");
  const isOwner = data?.me.role === "owner";
  const staffById = new Map((data?.staff ?? []).map((row) => [row.id, row]));
  const staffOfUser = (userId: string) => data?.staff.find((row) => row.user_id === userId) ?? null;
  const pendingStaffIds = new Set((data?.invites ?? []).map((invite) => invite.staff_id).filter(Boolean));
  const withoutLogin = (data?.staff ?? []).filter((row) => row.is_active && !row.user_id);
  const active = (data?.members ?? []).filter((member) => member.is_active);

  async function changeRole(member: Member, role: "admin" | "staff") {
    setBusy(member.user_id);
    const result = await send("/api/team", "PATCH", { user_id: member.user_id, role, is_active: true });
    setBusy(null);
    if (!result.ok) { toast.error(localMessage(result.error ?? "", lang)); return; }
    toast.success(t("როლი შეიცვალა.", "Role changed."));
    void load();
  }

  async function remove(member: Member) {
    setBusy(member.user_id);
    const result = await send("/api/team", "PATCH", { user_id: member.user_id, role: member.role === "owner" ? "admin" : member.role, is_active: false });
    setBusy(null);
    setToRemove(null);
    if (!result.ok) { toast.error(localMessage(result.error ?? "", lang)); return; }
    toast.success(t("წვდომა გაუქმდა.", "Access removed."));
    void load();
  }

  async function cancelInvite(invite: Invite) {
    setBusy(invite.id);
    const result = await send(`/api/team?id=${invite.id}`, "DELETE");
    setBusy(null);
    if (!result.ok) { toast.error(localMessage(result.error ?? "", lang)); return; }
    toast.success(t("მოწვევა გაუქმდა.", "Invite canceled."));
    void load();
  }

  return (
    <Card className="mt-6">
      <CardHeader
        title={t("გუნდის წვდომა", "Team access")}
        description={t("ვის შეუძლია შესვლა. სპეციალისტი ნახავს მხოლოდ თავის ვიზიტებს და კლიენტებს.", "Who can sign in. A specialist sees only their own visits and clients.")}
        action={data && <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => { setPresetStaff(null); setInviting(true); }}>{t("მოწვევა", "Invite")}</Button>}
      />

      {loadError && <Alert tone="error">{loadError}</Alert>}
      {!data && !loadError && <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>}

      {data && <div className="space-y-6">
        <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-100">
          {active.map((member) => {
            const linked = staffOfUser(member.user_id);
            const canEdit = isOwner && member.role !== "owner";
            return (
              <li key={member.user_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-stone-900">{member.full_name || member.email}</p>
                    <Badge tone={member.role === "owner" ? "brand" : "neutral"}>{roleLabel(member.role)}</Badge>
                    {member.user_id === data.me.user_id && <span className="text-xs text-stone-400">{t("თქვენ", "You")}</span>}
                  </div>
                  <p className="truncate text-sm text-stone-500">
                    {member.email}
                    {linked && <> · <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: linked.color ?? "#e11d48" }} />{linked.full_name}</span></>}
                  </p>
                </div>
                {canEdit && <div className="flex flex-wrap gap-2">
                  {member.role === "staff"
                    ? <Button variant="secondary" loading={busy === member.user_id} onClick={() => void changeRole(member, "admin")}>{t("ადმინისტრატორად", "Make admin")}</Button>
                    : linked && <Button variant="secondary" loading={busy === member.user_id} onClick={() => void changeRole(member, "staff")}>{t("სპეციალისტად", "Make specialist")}</Button>}
                  <Button variant="ghost" className="text-red-700" onClick={() => setToRemove(member)}>{t("წაშლა", "Remove")}</Button>
                </div>}
              </li>
            );
          })}
        </ul>

        {data.invites.length > 0 && <div>
          <h3 className="mb-2 text-sm font-semibold text-stone-700">{t("მოლოდინში", "Waiting to join")}</h3>
          <ul className="divide-y divide-stone-100 rounded-2xl border border-dashed border-stone-200">
            {data.invites.map((invite) => {
              const expired = new Date(invite.expires_at).getTime() < Date.now();
              const staff = invite.staff_id ? staffById.get(invite.staff_id) : null;
              return (
                <li key={invite.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-stone-900">{invite.email}</p>
                      <Badge tone={expired ? "danger" : "warning"}>{expired ? t("ვადაგასული", "Expired") : t("გაგზავნილია", "Invited")}</Badge>
                    </div>
                    <p className="text-sm text-stone-500">{roleLabel(invite.role)}{staff && ` · ${staff.full_name}`}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => { setPresetStaff(invite.staff_id); setInviting(true); }}>{t("ახალი ბმული", "New link")}</Button>
                    <Button variant="ghost" loading={busy === invite.id} onClick={() => void cancelInvite(invite)}>{t("გაუქმება", "Cancel")}</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>}

        {withoutLogin.length > 0 && <div>
          <h3 className="mb-2 text-sm font-semibold text-stone-700">{t("სპეციალისტები შესვლის გარეშე", "Specialists without a login")}</h3>
          <ChipRow>
            {withoutLogin.map((row) => (
              <Chip key={row.id} dotColor={row.color ?? undefined} onClick={() => { setPresetStaff(row.id); setInviting(true); }}>
                {row.full_name}{pendingStaffIds.has(row.id) ? ` · ${t("მოწვეულია", "invited")}` : ""}
              </Chip>
            ))}
          </ChipRow>
        </div>}

        {active.length <= 1 && data.invites.length === 0 && withoutLogin.length === 0 && (
          <EmptyState icon={<Users className="h-6 w-6" />} title={t("ჯერ მხოლოდ თქვენ ხართ", "It's just you so far")} text={t("დაამატეთ სპეციალისტები და მოიწვიეთ ისინი.", "Add specialists and invite them.")} />
        )}
      </div>}

      {data && <InviteSheet
        open={inviting}
        canInviteAdmin={isOwner}
        staff={withoutLogin}
        presetStaff={presetStaff}
        invites={data.invites}
        onClose={() => setInviting(false)}
        onCreated={() => void load()}
      />}

      <Dialog open={Boolean(toRemove)} onClose={() => setToRemove(null)} title={t("წვდომის გაუქმება", "Remove access")}
        description={toRemove ? `${toRemove.full_name || toRemove.email}` : undefined}
        footer={<div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="lg" onClick={() => setToRemove(null)}>{t("არა", "No")}</Button>
          <Button variant="danger" size="lg" loading={busy === toRemove?.user_id} onClick={() => toRemove && void remove(toRemove)}>{t("დიახ, გაუქმება", "Yes, remove")}</Button>
        </div>}>
        <p className="text-sm text-stone-600">{t("ვეღარ შევა სალონში. ვიზიტები და კლიენტები შენახული დარჩება. მოგვიანებით შეგიძლიათ ხელახლა მოიწვიოთ.", "They can no longer sign in. Visits and clients stay. You can invite them again later.")}</p>
      </Dialog>
    </Card>
  );
}

function InviteSheet({ open, canInviteAdmin, staff, presetStaff, invites, onClose, onCreated }: {
  open: boolean;
  canInviteAdmin: boolean;
  staff: StaffRow[];
  presetStaff: string | null;
  invites: Invite[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { lang, t } = useLanguage();
  const toast = useToast();
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [wasOpen, setWasOpen] = useState(false);

  // Start fresh only when the sheet opens. The team list reloads after an invite is created, and that
  // must not wipe the link the owner still needs to send.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const pending = presetStaff ? invites.find((invite) => invite.staff_id === presetStaff) : null;
      setRole("staff");
      setStaffId(presetStaff ?? (staff.length === 1 ? staff[0].id : null));
      setEmail(pending?.email ?? "");
      setError(null);
      setCreated(null);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (role === "staff" && !staffId) { setError(t("აირჩიეთ სპეციალისტი.", "Choose the specialist.")); return; }
    setBusy(true);
    setError(null);
    const result = await send("/api/team", "POST", { email: email.trim(), role, staff_id: role === "staff" ? staffId : null });
    setBusy(false);
    if (!result.ok) { setError(localMessage(result.error ?? "", lang)); return; }
    setCreated({ email: email.trim().toLowerCase(), link: String(result.data.link), emailed: Boolean(result.data.emailed) });
    onCreated();
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t("ბმული დაკოპირდა.", "Link copied."));
    } catch {
      toast.error(t("ვერ დაკოპირდა. მონიშნეთ ბმული ხელით.", "Could not copy. Select the link by hand."));
    }
  }

  const shareText = created ? `${t("მოწვევა moarge-ში", "Invitation to moarge")}: ${created.link}` : "";

  return (
    <Sheet open={open} onClose={onClose} title={created ? t("მოწვევა მზადაა", "Invite ready") : t("გუნდში მოწვევა", "Invite to the team")}
      description={created ? created.email : undefined}
      footer={created
        ? <Button size="lg" block onClick={onClose}>{t("მზადაა", "Done")}</Button>
        : <Button type="submit" form="team-invite-form" size="lg" block loading={busy} icon={<Send className="h-5 w-5" />}>{t("მოწვევის შექმნა", "Create invite")}</Button>}>
      {created ? (
        <div className="space-y-4">
          <Alert tone={created.emailed ? "success" : "info"}>
            {created.emailed
              ? t("ბმული გაიგზავნა ელ-ფოსტაზე. შეგიძლიათ გაუგზავნოთ Viber-ით ან WhatsApp-ითაც.", "The link was emailed. You can also send it by Viber or WhatsApp.")
              : t("გაუგზავნეთ ეს ბმული Viber-ით ან WhatsApp-ით. მოქმედებს 7 დღე.", "Send this link by Viber or WhatsApp. It works for 7 days.")}
          </Alert>
          <div className="break-all rounded-2xl bg-stone-50 p-4 font-mono text-xs text-stone-700 select-all">{created.link}</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => void copy(created.link)}>{t("კოპირება", "Copy")}</Button>
            <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 hover:bg-rose-50" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 text-emerald-600" />WhatsApp
            </a>
            <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 hover:bg-rose-50" href={`viber://forward?text=${encodeURIComponent(shareText)}`}>
              <MessageCircle className="h-4 w-4 text-violet-600" />Viber
            </a>
          </div>
          <p className="text-xs text-stone-500">{t("ბმული მხოლოდ ამ ელ-ფოსტისთვისაა და ერთხელ მუშაობს.", "The link is only for this email and works once.")}</p>
        </div>
      ) : (
        <form id="team-invite-form" onSubmit={submit} className="space-y-5" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <div>
            <p className="mb-2 text-sm font-semibold text-stone-700">{t("როლი", "Role")}</p>
            <ChipRow>
              <Chip selected={role === "staff"} onClick={() => setRole("staff")}>{t("სპეციალისტი", "Specialist")}</Chip>
              {canInviteAdmin && <Chip selected={role === "admin"} onClick={() => setRole("admin")}>{t("ადმინისტრატორი", "Admin")}</Chip>}
            </ChipRow>
            <p className="mt-2 text-xs text-stone-500">
              {role === "staff"
                ? t("ნახავს თავის ვიზიტებს და კლიენტების ნომრებს, მონიშნავს მოსვლას და დასრულებას.", "Sees their own visits and client numbers, marks arrivals and done visits.")
                : t("ჯავშნავს, გადაიტანს, იღებს გადახდას და მართავს კლიენტებს.", "Books, moves, takes payment and manages clients.")}
            </p>
          </div>

          {role === "staff" && <div>
            <p className="mb-2 text-sm font-semibold text-stone-700">{t("რომელი სპეციალისტია?", "Which specialist?")}</p>
            {staff.length === 0
              ? <Alert tone="info">{t("ყველა სპეციალისტს უკვე აქვს შესვლა. ჯერ დაამატეთ ახალი სპეციალისტი ზემოთ.", "Every specialist already has a login. Add a new specialist above first.")}</Alert>
              : <ChipRow>{staff.map((row) => (
                <Chip key={row.id} selected={staffId === row.id} dotColor={row.color ?? undefined} onClick={() => setStaffId(row.id)}>{row.full_name}</Chip>
              ))}</ChipRow>}
          </div>}

          <Field label={t("ელ-ფოსტა", "Email")} hint={t("ამ ელ-ფოსტით შევა სისტემაში.", "They will sign in with this email.")}>
            {(props) => <Input {...props} type="email" inputMode="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required />}
          </Field>
          <p className="flex items-center gap-2 text-xs text-stone-500"><Mail className="h-4 w-4" />{t("ბმულს მიიღებთ აქვე, რომ გაუგზავნოთ Viber-ით ან WhatsApp-ით.", "You will get the link here to send by Viber or WhatsApp.")}</p>
        </form>
      )}
    </Sheet>
  );
}
