// Date helpers for the salon's time zone. Georgia has no daylight saving time (always UTC+4).
// Many browsers have no Georgian names in Intl, so day and month names are spelled out here.

export type Lang = "ka" | "en";

export const KA_WEEKDAYS = ["კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"];
export const KA_WEEKDAYS_SHORT = ["კვი", "ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ"];
export const KA_MONTHS = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];
export const EN_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** YYYY-MM-DD in Tbilisi, `daysAhead` days from today. */
export function tbilisiDate(daysAhead = 0, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  const date = new Date(Date.UTC(part("year"), part("month") - 1, part("day") + daysAhead));
  return date.toISOString().slice(0, 10);
}

/** Minutes since midnight in Tbilisi. */
export function tbilisiNowMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  return get("hour") * 60 + get("minute");
}

/** "HH:MM" to minutes since midnight. */
export const timeToMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export function dateParts(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return { weekday: date.getUTCDay(), day: date.getUTCDate(), month: date.getUTCMonth() };
}

/** "ხუთშაბათი, 1 ნოემბერი" / "Thursday, 1 November" */
export function formatLongDate(value: string, lang: Lang): string {
  const { weekday, day, month } = dateParts(value);
  return lang === "ka"
    ? `${KA_WEEKDAYS[weekday]}, ${day} ${KA_MONTHS[month]}`
    : `${EN_WEEKDAYS[weekday]}, ${day} ${EN_MONTHS[month]}`;
}

/** Short labels for a day chip: weekday ("ორშ"), day number, month ("ნოე"). */
export function shortDayLabels(value: string, lang: Lang) {
  const { weekday, day, month } = dateParts(value);
  return {
    weekday: lang === "ka" ? KA_WEEKDAYS_SHORT[weekday] : EN_WEEKDAYS[weekday].slice(0, 3),
    day,
    month: lang === "ka" ? KA_MONTHS[month].slice(0, 3) : EN_MONTHS[month].slice(0, 3),
  };
}
