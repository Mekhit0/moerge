/** The About page, in Georgian and English. Only true statements: moarge is new and says so. */
import { COMPANY_LEGAL_NAME_EN, COMPANY_LEGAL_NAME_KA, SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY } from "./contact";
import type { LegalDocument } from "./legal";

export const ABOUT: LegalDocument = {
  title: { ka: "moarge-ის შესახებ", en: "About moarge" },
  updated: { ka: "2026 წლის 8 ნოემბერი", en: "8 November 2026" },
  intro: {
    ka: "moarge (მოარგე) არის სალონის მართვის პროგრამა ქართულად: ონლაინ ჯავშანი, გუნდის კალენდარი, კლიენტების ბაზა, SMS შეხსენებები და სპეციალისტების საკომისიო. ის შეიქმნა საქართველოს სილამაზის სალონებისთვის, ბარბერშოპებისთვის და კოსმეტოლოგებისთვის.",
    en: "moarge (მოარგე) is salon management software in Georgian: online booking, a team calendar, a client base, SMS reminders and specialists' commission. It is built for beauty salons, barbershops and cosmetologists in Georgia.",
  },
  sections: [
    {
      title: { ka: "რატომ შევქმენით", en: "Why we built it" },
      paragraphs: [
        { ka: "საქართველოში სალონების უმეტესობა ჯავშნებს ჯერ კიდევ რვეულში, ტელეფონში და Instagram-ის მიმოწერაში აწარმოებს. ჯავშნები ერთმანეთს ეფარება, კლიენტებს ვიზიტი ავიწყდებათ, თვის ბოლოს კი საკომისიოს ხელით ითვლიან.", en: "Most salons in Georgia still keep bookings in a notebook, on the phone and in Instagram messages. Bookings clash, clients forget visits, and commission is counted by hand at the end of the month." },
        { ka: "გვინდოდა პროგრამა, რომელიც ქართულად ფიქრობს, ტელეფონზე მარტივად მუშაობს და გუნდიან სალონს არ აიძულებს, ყოველ სპეციალისტში ცალკე გადაიხადოს.", en: "We wanted software that thinks in Georgian, works simply on a phone and does not make a salon with a team pay separately for every specialist." },
      ],
    },
    {
      title: { ka: "რას გპირდებით", en: "What we promise" },
      list: [
        { ka: "ქართული პირველ ადგილზე: პროგრამა, შეხსენებები და დახმარება ქართულად.", en: "Georgian first: the software, reminders and support are in Georgian." },
        { ka: "ღია ფასები: ყველა ფასი საიტზე წერია, დამალული გადასახადის გარეშე.", en: "Open prices: every price is on the site, with no hidden fees." },
        { ka: "თქვენი მონაცემები თქვენია: კლიენტების ექსპორტი ნებისმიერ დროს, სალონის წაშლა თავად შეგიძლიათ.", en: "Your data is yours: export your clients any time, and delete the salon yourself." },
        { ka: "რეკლამა და თვალთვალი არ გვაქვს: ვიყენებთ მხოლოდ აუცილებელ ქუქი-ფაილებს.", en: "No ads, no tracking: we only use the cookies the site needs." },
        { ka: "გულწრფელობა: ვწერთ მხოლოდ იმას, რაც უკვე მუშაობს. რაც ჯერ არ არის, ასეც ვამბობთ.", en: "Honesty: we only describe what already works, and say so when something is not ready." },
      ],
    },
    {
      title: { ka: "როგორ ვინახავთ მონაცემებს", en: "How we keep data" },
      paragraphs: [{ ka: "მონაცემები ინახება ევროკავშირში (ირლანდია), კავშირი დაშიფრულია, თითოეული სალონის მონაცემები კი ერთმანეთისგან ბაზის დონეზეა გამოყოფილი. დაწვრილებით: კონფიდენციალურობის პოლიტიკაში.", en: "Data is stored in the EU (Ireland), connections are encrypted, and each salon's data is separated at database level. More in the privacy policy." }],
    },
    {
      title: { ka: "ვინ ვართ", en: "Who we are" },
      paragraphs: [
        { ka: `moarge-ს ქმნის და მართავს ${COMPANY_LEGAL_NAME_KA}, საქართველოში რეგისტრირებული ინდივიდუალური მეწარმე. პროდუქტი ახალია: სალონებთან ერთად 2026 წლის ნოემბრიდან ვმუშაობთ და ყოველ კვირას ვაუმჯობესებთ მათი რჩევებით.`, en: `moarge is built and run by ${COMPANY_LEGAL_NAME_EN}, an individual entrepreneur registered in Georgia. The product is new: we have worked with salons since November 2026 and improve it every week from their feedback.` },
        { ka: "moarge არ არის დაკავშირებული მსგავსი სახელის მქონე ავტოაქსესუარების მაღაზიასთან.", en: "moarge is not connected to the car accessories shop with a similar name." },
      ],
    },
    {
      title: { ka: "დაგვიკავშირდით", en: "Contact us" },
      list: [
        { ka: `ტელეფონი: ${SUPPORT_PHONE_DISPLAY}`, en: `Phone: ${SUPPORT_PHONE_DISPLAY}` },
        { ka: `ელ-ფოსტა: ${SUPPORT_EMAIL}`, en: `Email: ${SUPPORT_EMAIL}` },
        { ka: "Instagram: @moarge.salon", en: "Instagram: @moarge.salon" },
      ],
      after: [{ ka: "თუ სალონის გადასვლაში დახმარება გჭირდებათ, მოგვწერეთ: კლიენტების სიის შეყვანაში დაგეხმარებით.", en: "If you need help moving your salon over, write to us: we will help enter your client list." }],
    },
  ],
};
