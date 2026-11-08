/**
 * The privacy policy and terms of service, in Georgian and English. Describe only what moarge really
 * does; when the product changes, change these too and move LEGAL_UPDATED. Not legal advice: a
 * Georgian lawyer should review before big changes.
 */
import { COMPANY_LEGAL_NAME_EN, COMPANY_LEGAL_NAME_KA, SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY } from "./contact";
import { EARLY_BIRD, PILOT_TRIAL_DAYS, REFUND, SMS_PACK, TRIAL_DAYS } from "./pricing";

export type Text = { ka: string; en: string };
export interface LegalSection {
  id?: string;
  title: Text;
  paragraphs?: Text[];
  list?: Text[];
  after?: Text[];
}
export interface LegalDocument {
  title: Text;
  updated: Text;
  intro: Text;
  sections: LegalSection[];
}

/** Moved whenever either document changes; also used in the sitemap. */
export const LEGAL_UPDATED = "2026-11-08";
const UPDATED: Text = { ka: "2026 წლის 8 ნოემბერი", en: "8 November 2026" };
const RETENTION_DAYS = 90;
const PRICE_NOTICE_DAYS = 30;
const GRACE_DAYS = 14;

const WHO_KA = `moarge-ს მართავს ${COMPANY_LEGAL_NAME_KA}, საქართველოში რეგისტრირებული ინდივიდუალური მეწარმე`;
const WHO_EN = `moarge is run by ${COMPANY_LEGAL_NAME_EN}, an individual entrepreneur registered in Georgia`;
const CONTACT: Text = { ka: `ელ-ფოსტა: ${SUPPORT_EMAIL}, ტელეფონი: ${SUPPORT_PHONE_DISPLAY}.`, en: `Email: ${SUPPORT_EMAIL}, phone: ${SUPPORT_PHONE_DISPLAY}.` };

export const PRIVACY: LegalDocument = {
  title: { ka: "კონფიდენციალურობის პოლიტიკა", en: "Privacy policy" },
  updated: UPDATED,
  intro: {
    ka: "ეს პოლიტიკა აღწერს, რა მონაცემებს ამუშავებს moarge, რისთვის, ვის უზიარებს და რა უფლებები გაქვთ. ის ეყრდნობა საქართველოს კანონს „პერსონალურ მონაცემთა დაცვის შესახებ“.",
    en: "This policy explains what data moarge processes, why, who it is shared with and what rights you have. It follows the Law of Georgia on Personal Data Protection.",
  },
  sections: [
    {
      title: { ka: "1. ვინ ვართ", en: "1. Who we are" },
      paragraphs: [{ ka: `${WHO_KA}. მონაცემებთან დაკავშირებული ნებისმიერი კითხვით მოგვწერეთ ან დაგვირეკეთ.`, en: `${WHO_EN}. For any question about your data, write to us or call.` }, CONTACT],
    },
    {
      title: { ka: "2. ვინ რაზე აგებს პასუხს", en: "2. Who is responsible for what" },
      list: [
        { ka: "სალონის ანგარიშის მონაცემებზე (მფლობელი, სპეციალისტები, ანგარიშსწორება) დამმუშავებელი არის moarge.", en: "For salon account data (owner, specialists, billing), moarge is the data controller." },
        { ka: "სალონის კლიენტების მონაცემებზე დამმუშავებელი არის თავად სალონი. moarge არის უფლებამოსილი პირი: ამ მონაცემებს ინახავს და ამუშავებს მხოლოდ სალონის დავალებით, სერვისის მისაწოდებლად.", en: "For the salon's clients' data, the salon is the controller. moarge is the processor: it stores and processes this data only on the salon's instructions, to provide the service." },
        { ka: "თუ სალონის კლიენტი ხართ და თქვენს მონაცემებზე გაქვთ მოთხოვნა, ჯერ სალონს მიმართეთ. ჩვენ სალონს დავეხმარებით მოთხოვნის შესრულებაში.", en: "If you are a salon's client and have a request about your data, contact the salon first. We help the salon fulfil it." },
      ],
    },
    {
      title: { ka: "3. რა მონაცემებს ვამუშავებთ", en: "3. What data we process" },
      list: [
        { ka: "სალონის ანგარიში: სალონის სახელი, მისამართი და ტელეფონი, მფლობელისა და სპეციალისტების სახელი, ელ-ფოსტა და ტელეფონი, პაროლი (დაშიფრული სახით, ჩვენ მას ვერ ვხედავთ), სერვისები, ფასები, სამუშაო საათები, საკომისიოს პროცენტი და შემოსავლის ჩანაწერები.", en: "Salon account: salon name, address and phone, the owner's and specialists' names, emails and phones, password (stored hashed, we cannot see it), services, prices, working hours, commission rates and earnings records." },
        { ka: "სალონის კლიენტი: სახელი, ტელეფონის ნომერი, ვიზიტები, გადახდები (თანხა, ნაღდი ან ბარათი, ფასდაკლება, თიფი), გაცდენის აღნიშვნა, ჯავშნის კოდი, SMS შეხსენების და მარკეტინგული SMS-ის თანხმობა. სალონს შეუძლია დაამატოს დაბადების დღე, თეგები, შენიშვნები, ფერის ფორმულა და ალერგია.", en: "Salon client: name, phone number, visits, payments (amount, cash or card, discount, tip), no-show marks, booking code, consent to SMS reminders and to marketing SMS. The salon may add a birthday, tags, notes, a colour formula and allergies." },
        { ka: "ანგარიშსწორება: პაკეტი, ინვოისები და გადახდის სტატუსი. ბარათის მონაცემებს ამუშავებს გადახდის პროვაიდერი Flitt; moarge ბარათის ნომერს არ ინახავს.", en: "Billing: plan, invoices and payment status. Card details are processed by the payment provider Flitt; moarge does not store card numbers." },
        { ka: "ტექნიკური: IP მისამართი (ზედმეტი მოთხოვნებისა და ბოტების შესაზღუდად), შესვლის სესია, შეცდომების ჩანაწერები (გვერდი და შეცდომის ტექსტი, გასაღებებისა და პაროლების გარეშე).", en: "Technical: IP address (to limit abuse and bots), sign-in session, error records (page and error text, with keys and passwords removed)." },
      ],
    },
    {
      title: { ka: "4. ალერგია და ჯანმრთელობის ინფორმაცია", en: "4. Allergies and health information" },
      paragraphs: [{
        ka: "ალერგია ჯანმრთელობის მონაცემად შეიძლება ჩაითვალოს და კანონი მას განსაკუთრებულად იცავს. სალონმა ეს ველი უნდა შეავსოს მხოლოდ კლიენტის თანხმობით და მხოლოდ იმდენი, რამდენიც უსაფრთხო მომსახურებისთვის სჭირდება. ამ ინფორმაციას ხედავს მხოლოდ ამ სალონის გუნდი, ის არ გამოიყენება სხვა მიზნით და არ გადაეცემა სხვა სალონს.",
        en: "Allergies may count as health data, which the law protects specially. The salon should fill in this field only with the client's consent and only as much as safe service needs. Only that salon's team sees it; it is not used for anything else and never shared with another salon.",
      }],
    },
    {
      title: { ka: "5. რისთვის და რა საფუძვლით", en: "5. Why, and on what basis" },
      list: [
        { ka: "სერვისის მიწოდება (ჯავშანი, კალენდარი, კლიენტების ბაზა, შემოსავალი): სალონთან ხელშეკრულება.", en: "Providing the service (booking, calendar, client base, earnings): our contract with the salon." },
        { ka: "SMS შეხსენება და ჯავშნის დადასტურება: კლიენტის თანხმობა, რომელსაც ჯავშნისას ან სალონში აძლევს.", en: "SMS reminders and booking confirmations: the client's consent, given when booking or at the salon." },
        { ka: "დაბრუნების (მარკეტინგული) SMS: კლიენტის ცალკე თანხმობა. ყოველ შეტყობინებაში არის ბმული, რომლითაც შეთავაზებებზე უარს ამბობს.", en: "Come-back (marketing) SMS: the client's separate consent. Every such message has a link to stop offers." },
        { ka: "უსაფრთხოება, ბოტებისგან დაცვა და შეცდომების გასწორება: ჩვენი კანონიერი ინტერესი.", en: "Security, bot protection and fixing errors: our legitimate interest." },
        { ka: "ინვოისები და გადახდები: საგადასახადო და ბუღალტრული ვალდებულება.", en: "Invoices and payments: tax and accounting obligations." },
      ],
    },
    {
      title: { ka: "6. ვის ვუზიარებთ", en: "6. Who we share data with" },
      paragraphs: [{ ka: "მონაცემებს არ ვყიდით და რეკლამისთვის არ ვიყენებთ. ვუზიარებთ მხოლოდ იმ მომწოდებლებს, ვისი დახმარებითაც სერვისი მუშაობს:", en: "We never sell data or use it for ads. We share it only with the providers that make the service work:" }],
      list: [
        { ka: "Supabase: მონაცემთა ბაზა და შესვლა. სერვერები ირლანდიაში (ევროკავშირი).", en: "Supabase: database and sign-in. Servers in Ireland (EU)." },
        { ka: "Vercel: საიტის ჰოსტინგი. ძირითადი სერვერები ლონდონში.", en: "Vercel: website hosting. Main servers in London." },
        { ka: "uBill: SMS-ის გაგზავნა (საქართველო). იღებს ტელეფონის ნომერს და შეტყობინების ტექსტს.", en: "uBill: sending SMS (Georgia). Receives the phone number and message text." },
        { ka: "Flitt: ბარათით გადახდა (საქართველო).", en: "Flitt: card payments (Georgia)." },
        { ka: "Cloudflare: ფორმების დაცვა ბოტებისგან (Turnstile).", en: "Cloudflare: protecting forms from bots (Turnstile)." },
        { ka: "Resend: სისტემური ელ-წერილები, მაგალითად გუნდში მოწვევა.", en: "Resend: system emails, such as team invitations." },
      ],
      after: [
        { ka: "ზოგი მომწოდებელი საქართველოს ფარგლებს გარეთ ამუშავებს მონაცემებს. ვირჩევთ მომწოდებლებს, რომლებიც იყენებენ სახელშეკრულებო და ტექნიკურ დაცვას. მონაცემებს გავცემთ სახელმწიფო ორგანოზე მხოლოდ მაშინ, თუ ამას კანონი მოითხოვს.", en: "Some providers process data outside Georgia. We choose providers that use contractual and technical safeguards. We give data to a public authority only when the law requires it." },
      ],
    },
    {
      title: { ka: "7. რამდენ ხანს ვინახავთ", en: "7. How long we keep data" },
      list: [
        { ka: "სანამ სალონის ანგარიში აქტიურია, მონაცემები ინახება.", en: "While a salon account is active, its data is kept." },
        { ka: `თუ საცდელი პერიოდი გადახდის გარეშე დასრულდა ან პაკეტი გაუქმდა, ანგარიში მხოლოდ სანახავი ხდება და მონაცემები ${RETENTION_DAYS} დღე ინახება. ამ დროში შეგიძლიათ ექსპორტი ან პაკეტის განახლება. შემდეგ მონაცემებს ვშლით.`, en: `If a trial ends without payment or a plan is cancelled, the account becomes view-only and data is kept for ${RETENTION_DAYS} days. During that time you can export it or renew. After that we delete it.` },
        { ka: "ინვოისებსა და გადახდებს ვინახავთ იმდენ ხანს, რამდენსაც საქართველოს საგადასახადო კანონმდებლობა მოითხოვს.", en: "Invoices and payments are kept as long as Georgian tax law requires." },
        { ka: `შეცდომების ჩანაწერები ${RETENTION_DAYS} დღის შემდეგ ავტომატურად იშლება.`, en: `Error records are deleted automatically after ${RETENTION_DAYS} days.` },
      ],
    },
    {
      title: { ka: "8. როგორ ვიცავთ", en: "8. How we protect data" },
      list: [
        { ka: "კავშირი დაშიფრულია (HTTPS / TLS).", en: "Connections are encrypted (HTTPS / TLS)." },
        { ka: "თითოეული სალონის მონაცემები ბაზის დონეზე გამოყოფილია. ერთი სალონი მეორის მონაცემებს ვერ ხედავს.", en: "Each salon's data is separated at database level. One salon cannot see another's data." },
        { ka: "წვდომა როლების მიხედვითაა: სპეციალისტი ხედავს მხოლოდ თავის ვიზიტებს და შემოსავალს.", en: "Access follows roles: a specialist sees only their own visits and earnings." },
        { ka: "პაროლები დაშიფრული სახით ინახება. ჯავშნის ფორმა დაცულია ზედმეტი მოთხოვნებისა და ბოტებისგან.", en: "Passwords are stored hashed. The booking form is protected against abuse and bots." },
      ],
      after: [{ ka: "თუ მონაცემები გაჟონავს, ამის შესახებ კანონით დადგენილ ვადაში ვაცნობებთ პერსონალურ მონაცემთა დაცვის სამსახურს, სალონს და, საჭიროების შემთხვევაში, დაზარალებულ პირებს.", en: "If data leaks, we inform the Personal Data Protection Service, the salon and, where needed, the people affected, within the time the law sets." }],
    },
    {
      title: { ka: "9. თქვენი უფლებები", en: "9. Your rights" },
      list: [
        { ka: "გაიგოთ, რა მონაცემებს ვამუშავებთ, და მიიღოთ მათი ასლი.", en: "To know what data we process and get a copy." },
        { ka: "მოითხოვოთ არაზუსტი მონაცემის გასწორება.", en: "To have inaccurate data corrected." },
        { ka: "მოითხოვოთ წაშლა ან დამუშავების შეჩერება, თუ კანონი შენახვას არ გვავალდებულებს. სალონის მფლობელს სალონის წაშლა თავად შეუძლია „ჩემი ანგარიშის“ გვერდიდან, გუნდის წევრს კი საკუთარი შესვლის წაშლა.", en: "To ask for deletion or for processing to stop, unless the law requires us to keep it. A salon owner can delete the salon themselves on the My account page, and a team member can delete their own login." },
        { ka: "მიიღოთ მონაცემები ფაილად (სალონს შეუძლია კლიენტების ექსპორტი ნებისმიერ დროს).", en: "To get your data as a file (a salon can export its clients at any time)." },
        { ka: "გაიხმოთ თანხმობა: შეხსენებებზე სალონს უთხარით, შეთავაზებებზე SMS-ის ბმულით თქვით უარი.", en: "To withdraw consent: tell the salon for reminders; use the link in the SMS to stop offers." },
        { ka: "გაასაჩივროთ პერსონალურ მონაცემთა დაცვის სამსახურში (personaldata.ge).", en: "To complain to the Personal Data Protection Service (personaldata.ge)." },
      ],
      after: [{ ka: `მოთხოვნა გამოგზავნეთ ${SUPPORT_EMAIL}-ზე. ვუპასუხებთ კანონით დადგენილ ვადაში.`, en: `Send requests to ${SUPPORT_EMAIL}. We answer within the time the law sets.` }],
    },
    {
      id: "cookies",
      title: { ka: "10. ქუქი-ფაილები და ბრაუზერის მეხსიერება", en: "10. Cookies and browser storage" },
      paragraphs: [{ ka: "ვიყენებთ მხოლოდ იმას, რაც საიტის მუშაობისთვისაა აუცილებელი. რეკლამის, ანალიტიკის და თვალთვალის ქუქი-ფაილები არ გვაქვს.", en: "We only use what the site needs to work. We have no advertising, analytics or tracking cookies." }],
      list: [
        { ka: "შესვლის სესია (Supabase): რომ ანგარიშში დარჩეთ.", en: "Sign-in session (Supabase): to keep you signed in." },
        { ka: "ენის არჩევანი, გზამკვლევის პროგრესი და დახურული შეტყობინებები: ბრაუზერის მეხსიერებაში, მხოლოდ თქვენს მოწყობილობაზე.", en: "Language choice, guide progress and closed notices: in browser storage, on your device only." },
        { ka: "Cloudflare Turnstile: ამოწმებს, რომ ფორმას ადამიანი ავსებს.", en: "Cloudflare Turnstile: checks that a person, not a bot, fills in a form." },
        { ka: "აპლიკაციის ფაილები (service worker): რომ moarge ტელეფონის მთავარ ეკრანზე დაამატოთ.", en: "App files (service worker): so you can add moarge to your phone's home screen." },
      ],
      after: [{ ka: "თუ ოდესმე ანალიტიკას ან სარეკლამო ქუქი-ფაილებს დავამატებთ, მათ მხოლოდ თქვენი თანხმობით ჩავრთავთ.", en: "If we ever add analytics or advertising cookies, we will only turn them on with your consent." }],
    },
    {
      title: { ka: "11. ცვლილებები", en: "11. Changes" },
      paragraphs: [{ ka: "პოლიტიკის ახალი ვერსია ამ გვერდზე ქვეყნდება განახლების თარიღით. მნიშვნელოვან ცვლილებას სალონებს წინასწარ ვაცნობებთ ელ-ფოსტით ან პანელში.", en: "New versions are published on this page with the update date. We tell salons about important changes in advance, by email or in the dashboard." }],
    },
  ],
};

export const TERMS: LegalDocument = {
  title: { ka: "წესები და პირობები", en: "Terms of service" },
  updated: UPDATED,
  intro: {
    ka: "ეს პირობები არის შეთანხმება moarge-სა და სალონს შორის, რომელიც moarge-ს იყენებს. რეგისტრაციით ან სერვისის გამოყენებით ეთანხმებით ამ პირობებს და კონფიდენციალურობის პოლიტიკას.",
    en: "These terms are the agreement between moarge and the salon that uses it. By signing up or using the service you agree to them and to the privacy policy.",
  },
  sections: [
    {
      title: { ka: "1. ვინ ვართ", en: "1. Who we are" },
      paragraphs: [{ ka: `${WHO_KA}.`, en: `${WHO_EN}.` }, CONTACT],
    },
    {
      title: { ka: "2. რას გთავაზობთ", en: "2. The service" },
      paragraphs: [{ ka: "moarge არის ბრაუზერში მომუშავე სალონის მართვის პროგრამა: ონლაინ ჯავშანი, გუნდის კალენდარი, კლიენტების ბაზა, ვიზიტები და გადახდები, შემოსავალი და საკომისიო, SMS შეხსენებები. რა შედის თითოეულ პაკეტში, წერია ფასების გვერდზე.", en: "moarge is salon management software that runs in the browser: online booking, a team calendar, a client base, visits and payments, earnings and commission, and SMS reminders. What each plan includes is on the pricing page." }],
    },
    {
      title: { ka: "3. ანგარიში და გუნდი", en: "3. Account and team" },
      list: [
        { ka: "რეგისტრაციისას მიუთითეთ სწორი ინფორმაცია. ანგარიშზე და მასში მოწვეულ გუნდზე პასუხისმგებელია სალონის მფლობელი.", en: "Give accurate details when signing up. The salon owner is responsible for the account and the team they invite." },
        { ka: "პაროლი არავის გაუზიაროთ. თუ ფიქრობთ, რომ ანგარიშში სხვა შევიდა, მაშინვე შეგვატყობინეთ.", en: "Do not share passwords. If you think someone else got into the account, tell us right away." },
      ],
    },
    {
      title: { ka: "4. სალონის ვალდებულებები კლიენტების მიმართ", en: "4. The salon's duties towards its clients" },
      list: [
        { ka: "კლიენტების მონაცემებზე პასუხისმგებელია სალონი. მათ შეიყვანთ მხოლოდ კანონიერად და იმდენს, რამდენიც მომსახურებისთვის გჭირდებათ.", en: "The salon is responsible for its clients' data. Enter it only lawfully and only as much as the service needs." },
        { ka: "SMS შეხსენება და დადასტურება გაუგზავნეთ მხოლოდ თანხმობის მქონე კლიენტებს. დაბრუნების (მარკეტინგული) SMS მხოლოდ მათ, ვინც ამაზე ცალკე დათანხმდა.", en: "Send SMS reminders and confirmations only to clients who agreed. Send come-back (marketing) SMS only to those who separately agreed to it." },
        { ka: "ალერგია ჩაწერეთ მხოლოდ კლიენტის თანხმობით.", en: "Record allergies only with the client's consent." },
        { ka: "სალონში გაწეულ მომსახურებაზე, მის ხარისხსა და ფასზე პასუხისმგებელია სალონი. moarge არის ტექნოლოგია, რომელიც ჯავშანს და აღრიცხვას ამარტივებს.", en: "The salon is responsible for the services it provides, their quality and price. moarge is the technology that makes booking and records easier." },
      ],
    },
    {
      title: { ka: "5. ონლაინ ჯავშანი", en: "5. Online booking" },
      paragraphs: [{ ka: "თავისუფალი დრო ითვლება სალონის სამუშაო საათების, შესვენებების, დასვენებისა და არსებული ჯავშნების მიხედვით (დრო თბილისის). კლიენტი ჯავშანს თავისი კოდით გადაიტანს ან გააუქმებს სალონის მიერ არჩეულ ვადამდე. ჯავშნასთან დაკავშირებული დავა სალონსა და კლიენტს შორის წყდება.", en: "Free times follow the salon's working hours, breaks, days off and existing bookings (Tbilisi time). A client can move or cancel a booking with their code until the deadline the salon sets. Disputes about a booking are between the salon and the client." }],
    },
    {
      title: { ka: "6. საცდელი პერიოდი, პაკეტები და გადახდა", en: "6. Trial, plans and payment" },
      list: [
        { ka: `ახალ სალონს აქვს უფასო საცდელი პერიოდი ბარათის გარეშე: ${TRIAL_DAYS} დღე (2026 წლის 1 დეკემბრამდე დარეგისტრირებულებს ${PILOT_TRIAL_DAYS} დღე). საცდელის დროს SMS არ იგზავნება.`, en: `New salons get a free trial without a card: ${TRIAL_DAYS} days (${PILOT_TRIAL_DAYS} days for salons that signed up before 1 December 2026). No SMS are sent during the trial.` },
        { ka: "ფასები მოცემულია ფასების გვერდზე და საბოლოოა: ყველა გადასახადი შედის.", en: "Prices are on the pricing page and are final: all taxes are included." },
        { ka: "პაკეტი არის გამოწერა. ის ავტომატურად განახლდება არჩეული პერიოდის (1, 6 ან 12 თვე) ბოლოს და თანხა ავტომატურად ჩამოიჭრება შენახული ბარათიდან, სანამ გამოწერას არ გააუქმებთ.", en: "A plan is a subscription. It renews automatically at the end of the chosen period (1, 6 or 12 months) and is charged automatically to the saved card until you cancel." },
        { ka: "გაუქმება შეგიძლიათ ნებისმიერ დროს, გადახდის გვერდიდან. გაუქმება მოქმედებს გადახდილი პერიოდის ბოლოს; შემდეგი თანხა აღარ ჩამოიჭრება.", en: "You can cancel at any time on the billing page. Cancellation takes effect at the end of the paid period; nothing more is charged." },
        { ka: `თუ გადახდა ვერ მოხერხდა, გაქვთ ${GRACE_DAYS} დღე გადასახდელად. შემდეგ ანგარიში მხოლოდ სანახავი ხდება.`, en: `If a payment fails, you have ${GRACE_DAYS} days to pay. After that the account becomes view-only.` },
        { ka: `პაკეტში შემავალი SMS ყოველთვიურად ახლდება და გამოუყენებელი არ გადადის. დამატებით SMS იყიდება ${SMS_PACK.minimum}-იანი პაკეტებით; ნაყიდი SMS არ იწვება. SMS-ის ამოწურვისას შეხსენებები ჩერდება.`, en: `Included SMS renew every month and unused ones do not carry over. Extra SMS are sold in packs of ${SMS_PACK.minimum}; bought SMS never expire. When SMS run out, reminders stop.` },
        { ka: `დეკემბერში პირველ ${EARLY_BIRD.salons} სალონს პირველ გადახდაზე ${EARLY_BIRD.discountPercent}% ფასდაკლება აქვს.`, en: `In December the first ${EARLY_BIRD.salons} salons get ${EARLY_BIRD.discountPercent}% off their first payment.` },
      ],
    },
    {
      title: { ka: "7. თანხის დაბრუნება", en: "7. Refunds" },
      paragraphs: [{ ka: `თუ პირველი გადახდიდან ${REFUND.withinDays} დღის განმავლობაში მოგვწერთ, რომ moarge არ გჭირდებათ, ამ გადახდის ${REFUND.percent}%-ს დაგიბრუნებთ იმავე ბარათზე, მიზეზის ახსნის გარეშე. ეს მოქმედებს მხოლოდ პირველ გადახდაზე. სხვა შემთხვევაში გადახდილი თანხა არ ბრუნდება, გაუქმება კი შემდეგ ჩამოჭრას აჩერებს.`, en: `If you write to us within ${REFUND.withinDays} days of your first payment that moarge is not for you, we refund ${REFUND.percent}% of that payment to the same card, no reason needed. This applies to the first payment only. Otherwise payments are not refunded; cancelling stops future charges.` }],
    },
    {
      title: { ka: "8. ფასის ცვლილება", en: "8. Price changes" },
      paragraphs: [{ ka: `ფასის ცვლილებას ვაცნობებთ მინიმუმ ${PRICE_NOTICE_DAYS} დღით ადრე, ელ-ფოსტით ან პანელში. უკვე გადახდილ პერიოდზე ფასი არ იცვლება.`, en: `We announce price changes at least ${PRICE_NOTICE_DAYS} days in advance, by email or in the dashboard. The price of a period already paid does not change.` }],
    },
    {
      title: { ka: "9. გაუქმების შემდეგ", en: "9. After it ends" },
      paragraphs: [{ ka: `საცდელის ან პაკეტის დასრულების შემდეგ ანგარიში მხოლოდ სანახავი ხდება და მონაცემები ${RETENTION_DAYS} დღე ინახება. ამ დროში შეგიძლიათ კლიენტების ექსპორტი ან პაკეტის განახლება. შემდეგ მონაცემებს ვშლით, გარდა იმისა, რისი შენახვაც კანონითაა სავალდებულო.`, en: `When a trial or plan ends, the account becomes view-only and data is kept for ${RETENTION_DAYS} days. During that time you can export your clients or renew. After that we delete the data, except what the law requires us to keep.` }],
    },
    {
      title: { ka: "10. აკრძალული გამოყენება", en: "10. What is not allowed" },
      list: [
        { ka: "სპამი ან SMS-ის გაგზავნა თანხმობის გარეშე.", en: "Spam, or sending SMS without consent." },
        { ka: "უკანონო შინაარსი ან სხვისი უფლებების დარღვევა.", en: "Illegal content or breaking other people's rights." },
        { ka: "სისტემის უსაფრთხოების გვერდის ავლის, გატეხვის ან გადატვირთვის მცდელობა.", en: "Trying to bypass security, break into or overload the system." },
        { ka: "სერვისის ხელახლა გაყიდვა ან ავტომატური მასობრივი შეგროვება ჩვენი თანხმობის გარეშე.", en: "Reselling the service or scraping it without our permission." },
      ],
      after: [{ ka: "ამ წესების დარღვევისას შეიძლება ანგარიში შევაჩეროთ, წინასწარ გაფრთხილებით, თუ საფრთხე დაუყოვნებელი არ არის.", en: "If these rules are broken we may suspend the account, with notice unless the risk is immediate." }],
    },
    {
      title: { ka: "11. სერვისის ხელმისაწვდომობა", en: "11. Availability" },
      paragraphs: [{ ka: "ვცდილობთ, moarge მუდმივად მუშაობდეს, მაგრამ შეუფერხებელ მუშაობას ვერ ვიძლევით. შეიძლება იყოს ტექნიკური სამუშაოები ან მომწოდებლის (ჰოსტინგი, SMS, გადახდა) შეფერხება. SMS-ის მიწოდება დამოკიდებულია ოპერატორზე. ფუნქციებს შეიძლება ვაუმჯობესებდეთ ან ვცვლიდეთ.", en: "We work to keep moarge running at all times but cannot promise it will never stop. There may be maintenance or problems at a provider (hosting, SMS, payments). SMS delivery depends on the operator. We may improve or change features." }],
    },
    {
      title: { ka: "12. პასუხისმგებლობის შეზღუდვა", en: "12. Limits of liability" },
      paragraphs: [{ ka: "კანონით დაშვებულ ფარგლებში moarge არ აგებს პასუხს არაპირდაპირ ზიანზე, მიუღებელ შემოსავალზე ან სალონის მომსახურებასთან დაკავშირებულ დავაზე. moarge-ის ჯამური პასუხისმგებლობა არ აღემატება თანხას, რომელიც სალონმა გადაიხადა მოთხოვნამდე ბოლო 12 თვეში. ეს არ ზღუდავს პასუხისმგებლობას, რომლის შეზღუდვაც კანონით დაუშვებელია.", en: "To the extent the law allows, moarge is not liable for indirect loss, lost income or disputes about the salon's services. moarge's total liability is limited to what the salon paid in the 12 months before the claim. This does not limit liability that the law does not allow to be limited." }],
    },
    {
      title: { ka: "13. ვისია რა", en: "13. Who owns what" },
      paragraphs: [{ ka: "პროგრამა და მისი დიზაინი ეკუთვნის moarge-ს. სალონის და მისი კლიენტების მონაცემები ეკუთვნის სალონს; moarge მათ იყენებს მხოლოდ სერვისის მისაწოდებლად.", en: "The software and its design belong to moarge. The salon's and its clients' data belong to the salon; moarge uses it only to provide the service." }],
    },
    {
      title: { ka: "14. ანგარიშის დახურვა", en: "14. Closing the account" },
      paragraphs: [{ ka: "სალონის მფლობელს შეუძლია სალონი თავად წაშალოს: „ჩემი ანგარიში“ → „სალონის წაშლა“. იშლება სალონის ყველა მონაცემი და გუნდის წევრების შესვლა, თუ სხვა სალონი არ აქვთ. გუნდის წევრს შეუძლია წაშალოს მხოლოდ საკუთარი შესვლა. წაშლა სამუდამოა; მანამდე ჩამოტვირთეთ კლიენტების სია. ინვოისები ინახება იმდენ ხანს, რამდენსაც საგადასახადო კანონი მოითხოვს, კლიენტების მონაცემების გარეშე. აქტიური პაკეტი წაშლისას წყდება.", en: "The salon owner can delete the salon themselves: My account → Delete the salon. All the salon's data is deleted, and so are team members' logins if they have no other salon. A team member can delete only their own login. Deletion is permanent; download your client list first. Invoices are kept as long as tax law requires, without client data. An active plan ends on deletion." }],
    },
    {
      title: { ka: "15. პირობების ცვლილება", en: "15. Changes to these terms" },
      paragraphs: [{ ka: `მნიშვნელოვან ცვლილებას ვაცნობებთ მინიმუმ ${PRICE_NOTICE_DAYS} დღით ადრე, ელ-ფოსტით ან პანელში. თუ არ ეთანხმებით, შეგიძლიათ გამოწერა გააუქმოთ.`, en: `We announce important changes at least ${PRICE_NOTICE_DAYS} days in advance, by email or in the dashboard. If you do not agree, you can cancel.` }],
    },
    {
      title: { ka: "16. მოქმედი კანონი და დავა", en: "16. Law and disputes" },
      paragraphs: [{ ka: "ამ პირობებზე ვრცელდება საქართველოს კანონმდებლობა. დავას ჯერ მოლაპარაკებით ვცდილობთ, შემდეგ კი ის თბილისის საქალაქო სასამართლოში განიხილება.", en: "These terms are governed by the laws of Georgia. We first try to settle a dispute by talking; otherwise it goes to Tbilisi City Court." }],
    },
  ],
};
