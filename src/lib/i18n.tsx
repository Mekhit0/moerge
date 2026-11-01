"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  TreatmentType,
  StandardTreatmentType,
  AppointmentStatus,
  ReminderStatus,
  CustomBookingService,
} from "./types";

export type AppLocale = "ka" | "en";

export const GEORGIAN_DEFAULT_EMAIL_SUBJECT = "დროა ისევ გვეწვიოთ";

export const GEORGIAN_DEFAULT_EMAIL_BODY = `გამარჯობა, {{client_name}}!

ბოლო ვიზიტიდან უკვე დრო გავიდა და სიამოვნებით გნახავთ ისევ.

დაჯავშნეთ თქვენთვის მოსახერხებელი დრო:

{{booking_link}}

გელოდებით,
{{salon_name}}`;

export const TREATMENT_LABELS_I18N: Record<
  AppLocale,
  Record<string, string>
> = {
  ka: {
    epilation: "კლასიკური ეპილაცია",
    laser_epilation: "დიოდური ლაზერული ეპილაცია",
    wax_epilation: "ცვილით (ვაქს) ეპილაცია",
    sugaring_epilation: "შუგარინგი (ორგანული ეპილაცია)",
    facial: "სახის წმენდა და მოვლა",
    massage: "სხეულის მასაჟი",
    manicure: "მანიკური და ფრჩხილის მოვლა",
    consultation: "კანის კონსულტაცია",
  },
  en: {
    epilation: "Classic Epilation",
    laser_epilation: "Diode Laser Epilation",
    wax_epilation: "Warm Wax Epilation",
    sugaring_epilation: "Organic Sugaring Epilation",
    facial: "Signature Facial",
    massage: "Body Massage",
    manicure: "Manicure & Nail Care",
    consultation: "Skin Consultation",
  },
};

export function getTreatmentLabel(
  type: string,
  lang: AppLocale,
  customServices?: CustomBookingService[]
): string {
  if (customServices && customServices.length > 0) {
    const found = customServices.find(
      (s) => s.id === type || s.type === type || s.name_ka === type || s.name_en === type
    );
    if (found) {
      return lang === "ka" ? found.name_ka : found.name_en;
    }
  }
  const dict = TREATMENT_LABELS_I18N[lang];
  return dict[type] || type;
}

export const TREATMENT_DESC_I18N: Record<
  AppLocale,
  Record<string, string | undefined>
> = {
  ka: {
    laser_epilation:
      "უახლესი თაობის დიოდური ლაზერული ეპილაცია მოყინვის მეთოდით (~45 წთ). რეკომენდებული 21-დღიანი ციკლი.",
    sugaring_epilation:
      "ნაზი ორგანული შუგარინგი მგრძნობიარე კანისთვის (~40 წთ). რეკომენდებული 21-დღიანი ციკლი.",
    wax_epilation:
      "პრემიუმ ხარისხის თბილი ცვილით ეპილაცია (~35 წთ). რეკომენდებული 21-დღიანი ციკლი.",
    epilation:
      "სტანდარტული ეპილაციის პროცედურა დამამშვიდებელი მოვლით (~35 წთ). რეკომენდებული 21-დღიანი ციკლი.",
    facial: "სახის ღრმა დატენიანება და კანის ბარიერის აღდგენა (~60 წთ).",
    massage: "სარელაქსაციო არომათერაპიული მასაჟი (~60 წთ).",
    manicure: "კლასიკური და გელ-ლაქით მანიკური (~45 წთ).",
    consultation: "უფასო კონსულტაცია და სატესტო იმპულსი (~20 წთ).",
  },
  en: {
    laser_epilation:
      "Medical-grade diode laser hair removal with cooling comfort (~45 min). Optimal 21-day cycle.",
    sugaring_epilation:
      "Gentle organic sugar paste epilation for sensitive skin (~40 min). Optimal 21-day cycle.",
    wax_epilation:
      "Luxury low-temperature rose-resin wax epilation (~35 min). Optimal 21-day cycle.",
    epilation:
      "Classic full-zone epilation session with soothing post-care balm (~35 min). Optimal 21-day cycle.",
    facial: "Hydrating botanical facial & skin barrier renewal (~60 min).",
    massage: "Relaxing aromatherapy body massage (~60 min).",
    manicure: "Nail shaping, cuticle care & gel polish (~45 min).",
    consultation: "Complimentary skin & laser patch test consultation (~20 min).",
  },
};

export const APPOINTMENT_STATUS_I18N: Record<
  AppLocale,
  Record<string, string>
> = {
  ka: {
    scheduled: "დაგეგმილი",
    arrived: "მივიდა",
    completed: "დასრულებული",
    no_show: "არ გამოცხადდა",
    missed: "გაცდენილი",
    canceled: "გაუქმებული",
  },
  en: {
    scheduled: "Scheduled",
    arrived: "Arrived",
    completed: "Completed",
    no_show: "No show",
    missed: "Missed",
    canceled: "Canceled",
  },
};

export const REMINDER_STATUS_I18N: Record<
  AppLocale,
  Record<string, string>
> = {
  ka: {
    scheduled: "დაგეგმილი",
    processing: "მუშავდება",
    sent: "გაგზავნილი (API მიღებულია)",
    delivered: "მიწოდებულია",
    bounced: "უარყოფილია (Bounce)",
    failed: "შეცდომა (Failed)",
    canceled: "გაუქმებული",
  },
  en: {
    scheduled: "Scheduled",
    processing: "Processing",
    sent: "Sent (API Accepted)",
    delivered: "Delivered",
    bounced: "Bounced",
    failed: "Failed",
    canceled: "Canceled",
  },
};

export function getAppointmentStatusLabel(status: string, lang: AppLocale): string {
  const dict = lang === "ka" ? APPOINTMENT_STATUS_I18N.ka : APPOINTMENT_STATUS_I18N.en;
  return dict[status] || status;
}

export function getReminderStatusLabel(status: string, lang: AppLocale): string {
  const dict = lang === "ka" ? REMINDER_STATUS_I18N.ka : REMINDER_STATUS_I18N.en;
  return dict[status] || status;
}

interface LanguageContextValue {
  lang: AppLocale;
  setLang: (locale: AppLocale) => void;
  t: (ka: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "ka",
  setLang: () => {},
  t: (ka) => ka,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AppLocale>("ka");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("salon_locale") as AppLocale | null;
      if (saved === "ka" || saved === "en") {
        setLangState(saved);
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  function setLang(next: AppLocale) {
    setLangState(next);
    try {
      window.localStorage.setItem("salon_locale", next);
    } catch {
      // Ignore
    }
  }

  function t(ka: string, en: string): string {
    return lang === "ka" ? ka : en;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      className={`inline-flex items-center bg-stone-100 p-0.5 rounded-xl border border-stone-200/80 ${className}`}
      role="group"
      aria-label="Language Switcher / ენის არჩევა"
    >
      <button
        type="button"
        onClick={() => setLang("ka")}
        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
          lang === "ka"
            ? "bg-rose-600 text-white shadow-xs"
            : "text-stone-600 hover:text-stone-900"
        }`}
      >
        ქარ
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
          lang === "en"
            ? "bg-rose-600 text-white shadow-xs"
            : "text-stone-600 hover:text-stone-900"
        }`}
      >
        ENG
      </button>
    </div>
  );
}
