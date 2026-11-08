import { EARLY_BIRD, PACKAGES, PILOT_TRIAL_DAYS, REFUND, SMS_PACK, SMS_PACK_PRICE_GEL, TRIAL_DAYS, formatGel, type Offer } from "./pricing";

type Text = { ka: string; en: string };

const solo = PACKAGES.find((pkg) => pkg.code === "solo")!;
const business = PACKAGES.find((pkg) => pkg.code === "business")!;

/** Questions people ask before paying. Used on the pricing page and in its structured data. */
export function pricingFaq(offer: Offer): Array<{ q: Text; a: Text }> {
  return [
    offer.pilot
      ? {
          q: { ka: "ნოემბერში რეგისტრაცია უფასოა?", en: "Is signing up in November free?" },
          a: {
            ka: `დიახ. ნოემბერში დარეგისტრირებული სალონები ${PILOT_TRIAL_DAYS} დღე სრულიად უფასოდ იყენებენ moarge-ს, ბარათის გარეშე. შემდეგ აირჩევთ პაკეტს.`,
            en: `Yes. Salons that sign up in November use moarge free for ${PILOT_TRIAL_DAYS} days, no card needed. Then you pick a package.`,
          },
        }
      : {
          q: { ka: "როგორ მუშაობს უფასო საცდელი?", en: "How does the free trial work?" },
          a: {
            ka: `პირველი ${TRIAL_DAYS} დღე უფასოა და ბარათი არ გჭირდებათ. ამ დროში ყველაფერს სცდით 10-მდე სპეციალისტით.`,
            en: `The first ${TRIAL_DAYS} days are free and you don't need a card. You can try everything with up to 10 specialists.`,
          },
        },
    {
      q: { ka: "რა ხდება საცდელის შემდეგ?", en: "What happens after the trial?" },
      a: {
        ka: "აირჩევთ პაკეტს და გადაიხდით ბარათით, პირდაპირ პანელიდან. თუ არ აირჩევთ, ანგარიში მხოლოდ სანახავი ხდება, მონაცემები კი შენახული რჩება.",
        en: "You pick a package and pay by card right from the dashboard. If you don't, the account turns view only and your data stays.",
      },
    },
    {
      q: { ka: "როგორ შემიძლია გადახდა?", en: "How can I pay?" },
      a: {
        ka: "ბარათით, ონლაინ. იხდით ყოველთვე, ან 6 თვით 10% ფასდაკლებით, ან 12 თვით 20% ფასდაკლებით.",
        en: "By card, online. Pay monthly, or for 6 months with 10% off, or for 12 months with 20% off.",
      },
    },
    {
      q: { ka: "რა ფასდაკლებაა დეკემბერში?", en: "What is the December discount?" },
      a: {
        ka: `დეკემბერში პირველ ${EARLY_BIRD.salons} სალონს, ვინც პაკეტს იყიდის, პირველ გადახდაზე ${EARLY_BIRD.discountPercent}% ფასდაკლება აქვს. ის 6 და 12 თვის ფასდაკლებასაც ემატება.`,
        en: `In December the first ${EARLY_BIRD.salons} salons to buy a package get ${EARLY_BIRD.discountPercent}% off their first payment, on top of the 6 or 12 month discount.`,
      },
    },
    {
      q: { ka: `ბიზნესში ${business.staffIncluded}-ზე მეტი სპეციალისტი მყავს. რა ღირს?`, en: `I have more than ${business.staffIncluded} specialists on Business. What does it cost?` },
      a: {
        ka: `ყოველი დამატებითი სპეციალისტი ${business.extraStaffGel} ₾ თვეში, ${business.staffLimit}-მდე.`,
        en: `Each extra specialist is ${business.extraStaffGel} ₾ a month, up to ${business.staffLimit}.`,
      },
    },
    {
      q: { ka: "რა ხდება, თუ SMS ამოიწურა?", en: "What if I run out of SMS?" },
      a: {
        ka: `იყიდით დამატებით პაკეტს: ${formatGel(SMS_PACK.minimum)} SMS ${formatGel(SMS_PACK_PRICE_GEL)} ₾. ნაყიდი SMS არ იწვება და გადადის შემდეგ თვეში. პაკეტში შემავალი SMS ყოველთვე ახლდება.${offer.smsLive ? "" : " SMS შეხსენებები ირთვება 1 დეკემბრიდან, ფასიან პაკეტებზე."}`,
        en: `Buy an extra pack: ${formatGel(SMS_PACK.minimum)} SMS for ${formatGel(SMS_PACK_PRICE_GEL)} ₾. Bought SMS never expire and carry over. The SMS in your package renew every month.${offer.smsLive ? "" : " SMS reminders start on 1 December, on paid plans."}`,
      },
    },
    {
      q: { ka: "სოლოში SMS შედის?", en: "Does Solo include SMS?" },
      a: {
        ka: `დიახ, თვეში ${formatGel(solo.smsIncluded)} SMS. მეტი თუ დაგჭირდათ, იყიდით: ${formatGel(SMS_PACK.minimum)} SMS ${formatGel(SMS_PACK_PRICE_GEL)} ₾.${offer.smsLive ? "" : " SMS შეხსენებები ირთვება 1 დეკემბრიდან, ფასიან პაკეტებზე."}`,
        en: `Yes, ${formatGel(solo.smsIncluded)} SMS a month. Need more? Buy ${formatGel(SMS_PACK.minimum)} SMS for ${formatGel(SMS_PACK_PRICE_GEL)} ₾.${offer.smsLive ? "" : " SMS reminders start on 1 December, on paid plans."}`,
      },
    },
    {
      q: { ka: "თანხას დამიბრუნებთ, თუ არ მომეწონა?", en: "Can I get my money back if it is not for me?" },
      a: {
        ka: `დიახ. პირველი გადახდიდან ${REFUND.withinDays} დღის განმავლობაში მოგვწერეთ და ${REFUND.percent}%-ს დაგიბრუნებთ იმავე ბარათზე. მიზეზის ახსნა არ გჭირდებათ.`,
        en: `Yes. Write to us within ${REFUND.withinDays} days of your first payment and we refund ${REFUND.percent}% to the same card. No reason needed.`,
      },
    },
    {
      q: { ka: "როდის იქნება მრავალი ფილიალის პაკეტი?", en: "When is Multi-branch coming?" },
      a: {
        ka: "ვამზადებთ. თუ რამდენიმე ფილიალი გაქვთ, მოგვწერეთ და პირველს შეგატყობინებთ.",
        en: "We're building it. If you have several locations, write to us and you'll hear first.",
      },
    },
  ];
}
