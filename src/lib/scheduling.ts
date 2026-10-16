import {
  AppointmentStatus,
  Reminder,
  TreatmentType,
} from "./types";
import {
  isEpilationTreatment,
  isValidCalendarDate,
  isValidTimeZone,
} from "./validation";

export interface CalculatedReminderSchedule {
  scheduledForDate: string; // YYYY-MM-DD in salon timezone
  scheduledSendAtIso: string; // Exact UTC ISO timestamp for 09:00 local salon time
  intervalDays: number;
  timeZone: string;
}

/**
 * Adds `days` calendar days to a YYYY-MM-DD date string deterministically.
 */
export function addCalendarDays(dateStr: string, days: number): string {
  if (!isValidCalendarDate(dateStr)) {
    throw new Error(`Invalid treatment date "${dateStr}". Expected YYYY-MM-DD.`);
  }
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error(`Invalid reminder interval "${days}". Expected integer between 1 and 365.`);
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day + days));

  const y = utcDate.getUTCFullYear();
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utcDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Converts a local calendar date (YYYY-MM-DD) and local time (default 09:00:00)
 * in a specific IANA timeZone into an exact UTC Date object, accurately accounting
 * for Daylight Saving Time (DST) offsets on that target date.
 */
export function zonedDateTimeToUtc(
  dateStr: string,
  timeZone: string,
  hourLocal = 9,
  minuteLocal = 0
): Date {
  const safeTz = isValidTimeZone(timeZone) ? timeZone.trim() : "UTC";
  const [year, month, day] = dateStr.split("-").map(Number);

  // Start with a UTC guess at the target local hour
  const utcGuessMs = Date.UTC(year, month - 1, day, hourLocal, minuteLocal, 0, 0);

  const getOffsetMsAt = (instantMs: number): number => {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: safeTz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const parts = dtf.formatToParts(new Date(instantMs));
    const map: Record<string, number> = {};
    for (const part of parts) {
      if (part.type !== "literal") {
        map[part.type] = Number(part.value);
      }
    }
    const hourVal = map.hour === 24 ? 0 : map.hour;
    const zonedAsUtcMs = Date.UTC(
      map.year,
      map.month - 1,
      map.day,
      hourVal,
      map.minute,
      map.second
    );
    return zonedAsUtcMs - instantMs;
  };

  // First pass offset
  const offset1 = getOffsetMsAt(utcGuessMs);
  const adjusted1 = utcGuessMs - offset1;
  // Second pass in case the target crosses a DST transition boundary
  const offset2 = getOffsetMsAt(adjusted1);
  return new Date(utcGuessMs - offset2);
}

/**
 * Returns the current YYYY-MM-DD calendar date in the salon's configured timezone.
 */
export function getTodayInTimeZone(timeZone: string, referenceNow: Date = new Date()): string {
  const safeTz = isValidTimeZone(timeZone) ? timeZone.trim() : "UTC";
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(referenceNow);
}

/**
 * Calculates the 21-day (or custom salon interval) reminder date and UTC send timestamp
 * from a completed appointment's treatment date in the salon's configured time zone.
 */
export function calculateReminderSchedule(
  treatmentDateStr: string,
  intervalDays = 21,
  timeZone = "UTC",
  sendHourLocal = 9
): CalculatedReminderSchedule {
  if (!isValidTimeZone(timeZone)) {
    throw new Error(`Invalid salon time zone "${timeZone}".`);
  }
  const scheduledForDate = addCalendarDays(treatmentDateStr, intervalDays);
  const utcSendAt = zonedDateTimeToUtc(scheduledForDate, timeZone, sendHourLocal, 0);

  return {
    scheduledForDate,
    scheduledSendAtIso: utcSendAt.toISOString(),
    intervalDays,
    timeZone: timeZone.trim(),
  };
}

/**
 * Generates a deterministic idempotency key for a reminder so duplicate sends
 * and duplicate active reminder records are prevented.
 */
export function generateReminderIdempotencyKey(
  salonId: string,
  appointmentId: string,
  scheduledForDate: string
): string {
  return `rem:${salonId.trim()}:${appointmentId.trim()}:${scheduledForDate.trim()}`;
}

export interface EligibilityCheckResult {
  eligible: boolean;
  reason?: string;
}

/**
 * Determines whether an appointment & client combination should have an active
 * automated 21-day epilation reminder.
 */
export function checkReminderEligibility(
  appointment: {
    status: AppointmentStatus;
    treatment_type: TreatmentType;
    is_epilation?: boolean;
  },
  client: {
    is_archived: boolean;
    email_consent: boolean;
    unsubscribed_at?: string | null;
  }
): EligibilityCheckResult {
  if (client.is_archived) {
    return {
      eligible: false,
      reason: "Client profile is archived.",
    };
  }

  if (!client.email_consent || client.unsubscribed_at) {
    return {
      eligible: false,
      reason: "Client has unsubscribed or opted out of email reminders.",
    };
  }

  const isEpilation =
    typeof appointment.is_epilation === "boolean"
      ? appointment.is_epilation
      : isEpilationTreatment(appointment.treatment_type);

  if (!isEpilation) {
    return {
      eligible: false,
      reason: "Only epilation appointments trigger automatic 21-day reminders.",
    };
  }

  if (appointment.status !== "completed") {
    return {
      eligible: false,
      reason: `Appointment status is "${appointment.status}". Only completed epilation appointments trigger reminders.`,
    };
  }

  return { eligible: true };
}

export type ReconciliationAction =
  | {
      action: "create";
      scheduledForDate: string;
      scheduledSendAtIso: string;
      idempotencyKey: string;
    }
  | {
      action: "update_existing";
      reminderId: string;
      scheduledForDate: string;
      scheduledSendAtIso: string;
      idempotencyKey: string;
    }
  | {
      action: "cancel_existing";
      reminderId: string;
      cancelReason: string;
    }
  | {
      action: "noop";
      reason: string;
    };

/**
 * Determines the exact database action to take on reminders when an appointment
 * is created, edited, rescheduled, or canceled, guaranteeing zero duplicate active
 * reminders.
 */
export function planReminderReconciliation(params: {
  salonId: string;
  appointmentId: string;
  treatmentDate: string;
  treatmentType: TreatmentType;
  status: AppointmentStatus;
  client: {
    is_archived: boolean;
    email_consent: boolean;
    unsubscribed_at?: string | null;
  };
  existingReminders: Array<
    Pick<
      Reminder,
      "id" | "status" | "scheduled_for_date" | "scheduled_send_at" | "idempotency_key"
    >
  >;
  intervalDays?: number;
  timeZone?: string;
}): ReconciliationAction {
  const {
    salonId,
    appointmentId,
    treatmentDate,
    treatmentType,
    status,
    client,
    existingReminders,
    intervalDays = 21,
    timeZone = "UTC",
  } = params;

  const eligibility = checkReminderEligibility(
    { status, treatment_type: treatmentType },
    client
  );

  // Check if an active or already-dispatched reminder exists for this appointment
  const dispatchedReminder = existingReminders.find((r) =>
    ["processing", "sent", "delivered"].includes(r.status)
  );
  const scheduledReminder = existingReminders.find((r) => r.status === "scheduled");

  if (!eligibility.eligible) {
    if (scheduledReminder) {
      return {
        action: "cancel_existing",
        reminderId: scheduledReminder.id,
        cancelReason: eligibility.reason || "Appointment is no longer eligible for a reminder.",
      };
    }
    return {
      action: "noop",
      reason: eligibility.reason || "Not eligible for reminder.",
    };
  }

  // Appointment IS eligible (completed + epilation + consented active client)
  if (dispatchedReminder) {
    return {
      action: "noop",
      reason: `Reminder ${dispatchedReminder.id} has already been ${dispatchedReminder.status} for this appointment.`,
    };
  }

  const schedule = calculateReminderSchedule(treatmentDate, intervalDays, timeZone);
  const idempotencyKey = generateReminderIdempotencyKey(
    salonId,
    appointmentId,
    schedule.scheduledForDate
  );

  if (scheduledReminder) {
    if (
      scheduledReminder.scheduled_for_date === schedule.scheduledForDate &&
      scheduledReminder.idempotency_key === idempotencyKey
    ) {
      return {
        action: "noop",
        reason: "Active scheduled reminder is already up to date.",
      };
    }
    return {
      action: "update_existing",
      reminderId: scheduledReminder.id,
      scheduledForDate: schedule.scheduledForDate,
      scheduledSendAtIso: schedule.scheduledSendAtIso,
      idempotencyKey,
    };
  }

  return {
    action: "create",
    scheduledForDate: schedule.scheduledForDate,
    scheduledSendAtIso: schedule.scheduledSendAtIso,
    idempotencyKey,
  };
}

export interface ClassifiedEmailError {
  isPermanent: boolean;
  statusCode: number;
  message: string;
}

/**
 * Classifies email provider / network errors into temporary (retryable)
 * vs. permanent (non-retryable) failures.
 */
export function classifyEmailError(
  error: unknown,
  explicitStatusCode?: number
): ClassifiedEmailError {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : JSON.stringify(error ?? "Unknown email delivery error");

  const statusCode =
    explicitStatusCode ??
    (typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
      ? ((error as { statusCode: number }).statusCode)
      : 500);

  const lowerMsg = rawMessage.toLowerCase();

  // Permanent errors: invalid recipient, unverified domain, invalid API key, validation error
  if (
    [400, 401, 403, 404, 422].includes(statusCode) ||
    lowerMsg.includes("invalid email") ||
    lowerMsg.includes("domain is not verified") ||
    lowerMsg.includes("unverified") ||
    lowerMsg.includes("suppressed") ||
    lowerMsg.includes("bounced") ||
    lowerMsg.includes("validation_error")
  ) {
    return {
      isPermanent: true,
      statusCode: statusCode === 500 ? 422 : statusCode,
      message: rawMessage,
    };
  }

  // Temporary errors: 429 rate limits, 5xx server errors, network timeouts
  return {
    isPermanent: false,
    statusCode,
    message: rawMessage,
  };
}

export interface RetryPlan {
  shouldRetry: boolean;
  nextRetryAtIso: string | null;
  delayMinutes: number;
}

/**
 * Computes retry eligibility and exponential backoff delay:
 * Attempt 1 failed -> retry in 15 minutes
 * Attempt 2 failed -> retry in 60 minutes
 * Attempt 3 failed -> maxAttempts (3) reached -> do not retry automatically
 */
export function calculateRetryPlan(
  attemptCount: number,
  maxAttempts = 3,
  isPermanentError = false,
  referenceNow: Date = new Date()
): RetryPlan {
  if (isPermanentError || attemptCount >= maxAttempts) {
    return {
      shouldRetry: false,
      nextRetryAtIso: null,
      delayMinutes: 0,
    };
  }

  const backoffMinutesByAttempt: Record<number, number> = {
    1: 15,
    2: 60,
    3: 240,
  };

  const delayMinutes = backoffMinutesByAttempt[attemptCount] ?? 240;
  const nextRetryDate = new Date(referenceNow.getTime() + delayMinutes * 60 * 1000);

  return {
    shouldRetry: true,
    nextRetryAtIso: nextRetryDate.toISOString(),
    delayMinutes,
  };
}

export const STANDARD_TIME_SLOTS = [
  "09:30",
  "10:30",
  "11:30",
  "13:00",
  "14:30",
  "16:00",
  "17:30",
  "18:30",
] as const;

export function parseTimeMinutes(timeStr: string): number {
  const parts = timeStr.trim().split(":").map(Number);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
}

export function formatMinutesToHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Generates dynamic time slots between working_hours_start and working_hours_end
 * (e.g. "10:00" to "20:00" every 60 minutes -> ["10:00", "11:00", ..., "20:00"]).
 */
export function generateDynamicTimeSlots(
  startStr = "10:00",
  endStr = "20:00",
  intervalMinutes = 60
): string[] {
  const startMins = parseTimeMinutes(startStr);
  const endMins = parseTimeMinutes(endStr);
  const step = Math.max(15, Math.min(180, intervalMinutes || 60));

  if (endMins < startMins) {
    return [...STANDARD_TIME_SLOTS];
  }

  const result: string[] = [];
  for (let curr = startMins; curr <= endMins; curr += step) {
    result.push(formatMinutesToHHMM(curr));
  }
  return result.length > 0 ? result : [...STANDARD_TIME_SLOTS];
}

export interface SmartSlotEvaluation {
  requestedTime: string;
  isAvailable: boolean;
  conflictingTime: string | null;
  slots: Array<{ time: string; available: boolean }>;
  standardSlots: Array<{ time: string; available: boolean }>;
  availableSlots: string[];
  bookedTimes: string[];
  bookedSlots: string[];
}

/**
 * Evaluates whether a requested HH:MM time on a given date conflicts with
 * existing active appointments (within a buffer) and computes
 * available slots and suggestions.
 */
export function evaluateSmartSlotAvailability(
  requestedTime: string,
  bookedAppointmentTimes: string[],
  bufferMinutes = 45,
  candidateSlots?: readonly string[]
): SmartSlotEvaluation {
  const normalizedBooked = bookedAppointmentTimes.map((t) => t.slice(0, 5));
  const reqNorm = requestedTime.slice(0, 5);
  const reqMins = parseTimeMinutes(reqNorm);

  let conflictingTime: string | null = null;
  for (const booked of normalizedBooked) {
    const diff = Math.abs(parseTimeMinutes(booked) - reqMins);
    if (diff < bufferMinutes) {
      conflictingTime = booked;
      break;
    }
  }

  const targetSlots =
    candidateSlots && candidateSlots.length > 0
      ? candidateSlots
      : STANDARD_TIME_SLOTS;

  const slots = targetSlots.map((slot) => {
    const slotMins = parseTimeMinutes(slot);
    const hasConflict = normalizedBooked.some(
      (b) => Math.abs(parseTimeMinutes(b) - slotMins) < bufferMinutes
    );
    return {
      time: slot,
      available: !hasConflict,
    };
  });

  const availableSlots = slots.filter((s) => s.available).map((s) => s.time);

  return {
    requestedTime: reqNorm,
    isAvailable: conflictingTime === null,
    conflictingTime,
    slots,
    standardSlots: slots,
    availableSlots,
    bookedTimes: normalizedBooked,
    bookedSlots: normalizedBooked,
  };
}



