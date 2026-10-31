// Abuse limits for public bookings. Many Georgian mobile users share one IP address,
// so the per-IP limit stays generous and the per-phone limits do the real work.
export const PUBLIC_BOOKING_LIMITS = {
  perIpPerHour: 20,
  perPhonePerDay: 5,
  upcomingPerPhonePerSalon: 2,
} as const;

export type PublicBookingGuard = { blocked: boolean; upcoming: number };

/** Returns the message to show when a phone number may not book online, or null when it may. */
export function publicBookingGuardError(guard: PublicBookingGuard): string | null {
  if (guard.blocked) {
    return "ამ ნომრით ონლაინ ჯავშანი შეუძლებელია. დაუკავშირდით სალონს. / Online booking is not available for this number. Please contact the salon.";
  }
  if (guard.upcoming >= PUBLIC_BOOKING_LIMITS.upcomingPerPhonePerSalon) {
    return `ამ ნომერზე უკვე ${guard.upcoming} მომავალი ჯავშანია. ახლის დასამატებლად დაუკავშირდით სალონს. / This number already has ${guard.upcoming} upcoming bookings. Please contact the salon to add more.`;
  }
  return null;
}
