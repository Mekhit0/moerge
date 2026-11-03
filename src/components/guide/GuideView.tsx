"use client";

import React, { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, ExternalLink, GraduationCap } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { ButtonLink, Button, Card, cn } from "@/components/ui";
import { DeviceFrame, SCENES, type Text } from "@/components/tour/Scenes";
import { useOnScreen, usePrefersReducedMotion, useStepTimer } from "@/components/tour/useSceneLoop";

type Audience = "office" | "master";
type Group = "start" | "daily" | "clients" | "salon" | "help";

const GROUPS: Record<Group, Text> = {
  start: { ka: "დაწყება", en: "Getting started" },
  daily: { ka: "ყოველდღე", en: "Every day" },
  clients: { ka: "კლიენტები და SMS", en: "Clients and SMS" },
  salon: { ka: "სალონის მართვა", en: "Running the salon" },
  help: { ka: "პაკეტი და დახმარება", en: "Package and help" },
};

interface Lesson {
  id: string;
  group: Group;
  scene: keyof typeof SCENES;
  title: Text;
  intro: Text;
  steps: Text[];
  /** "Good to know": what a setting means, limits, small details. */
  tips?: Text[];
  link?: { href: string; label: Text };
  /** Extra links, e.g. for the setup checklist. */
  links?: Array<{ href: string; label: Text }>;
}

const OFFICE: Lesson[] = [
  {
    id: "start", group: "start", scene: "today",
    title: { ka: "დაწყება 5 ნაბიჯში", en: "Get started in 5 steps" },
    intro: { ka: "ერთხელ მოამზადეთ სალონი და შემდეგ ყველაფერი თავად მუშაობს.", en: "Set up your salon once and the rest runs by itself." },
    steps: [
      { ka: "პარამეტრები › სალონი: შეავსეთ სახელი, ტელეფონი და მისამართი. ეს ჩანს ჯავშნის გვერდზე და SMS-ში.", en: "Settings › Salon: fill in the name, phone and address. They show on the booking page and in SMS." },
      { ka: "პარამეტრები › სერვისები: დაამატეთ, რას აკეთებთ, ფასით და ხანგრძლივობით.", en: "Settings › Services: add what you do, with price and length." },
      { ka: "პარამეტრები › სპეციალისტები: დაამატეთ თავი და გუნდი, თითოეულს მიუთითეთ სერვისები.", en: "Settings › Specialists: add yourself and the team, and the services each one does." },
      { ka: "პარამეტრები › სამუშაო საათები: მიუთითეთ, ვინ როდის მუშაობს. ონლაინ ჯავშანი მხოლოდ ამ დროს ჩანს.", en: "Settings › Working hours: set who works when. Online booking shows only those times." },
      { ka: "„დღეს“ გვერდზე დააკოპირეთ ჯავშნის ბმული ან ჩამოტვირთეთ QR კოდი და გააზიარეთ.", en: "On Today, copy the booking link or download the QR code and share it." },
    ],
    tips: [
      { ka: "სპეციალისტი, რომელსაც სერვისი ან სამუშაო საათები არ აქვს, ონლაინ ჯავშანში არ ჩანს.", en: "A specialist with no services or working hours does not show in online booking." },
      { ka: "„დღეს“ გვერდზე ჩამონათვალი გაჩვენებთ, რა დარჩა მოსამზადებელი.", en: "The checklist on Today shows what is still left to set up." },
    ],
    links: [
      { href: "/settings", label: { ka: "სალონი", en: "Salon" } },
      { href: "/settings/services", label: { ka: "სერვისები", en: "Services" } },
      { href: "/settings/staff", label: { ka: "სპეციალისტები", en: "Specialists" } },
      { href: "/settings/schedules", label: { ka: "სამუშაო საათები", en: "Working hours" } },
      { href: "/dashboard", label: { ka: "ჯავშნის ბმული და QR", en: "Booking link and QR" } },
    ],
  },
  {
    id: "online", group: "start", scene: "booking",
    title: { ka: "ონლაინ ჩაწერა", en: "Online booking" },
    intro: { ka: "კლიენტები თავად ეწერებიან დღე და ღამე, დარეკვა არ სჭირდებათ.", en: "Clients book themselves day and night, no call needed." },
    steps: [
      { ka: "გააზიარეთ ბმული Instagram-ზე, Facebook-ზე, Viber-ში, ან დაბეჭდეთ QR კოდი სალონისთვის.", en: "Share the link on Instagram, Facebook or Viber, or print the QR code for the salon." },
      { ka: "კლიენტი ირჩევს სერვისს, სპეციალისტს (ან „ნებისმიერს“), დღეს და თავისუფალ დროს.", en: "The client picks a service, a specialist (or Anyone), a day and a free time." },
      { ka: "წერს სახელს და ტელეფონს. აპლიკაცია და რეგისტრაცია არ სჭირდება.", en: "They type a name and phone number. No app, no account." },
      { ka: "იღებს ჯავშნის კოდს. ჯავშანი კალენდარში მაშინვე ჩანს.", en: "They get a booking code. The booking shows in your calendar at once." },
      { ka: "კოდით და ტელეფონით კლიენტი თავად გადაიტანს ან გააუქმებს ვიზიტს: moarge.com › ჩემი ჯავშანი.", en: "With the code and phone the client moves or cancels on their own: moarge.com › My booking." },
    ],
    tips: [
      { ka: "დროის ნაბიჯი: რა ინტერვალით ხედავს კლიენტი თავისუფალ დროებს. 30 წუთზე: 10:00, 10:30, 11:00. პარამეტრები › სალონი.", en: "Time step: how far apart clients see free times. With 30 minutes: 10:00, 10:30, 11:00. Settings › Salon." },
      { ka: "გაუქმების ვადა: რამდენი საათით ადრე შეუძლია კლიენტს თავად გადატანა ან გაუქმება. შემდეგ უნდა დაგირეკოთ.", en: "Cancel deadline: how many hours before the visit clients can still move or cancel themselves. After that they call you." },
      { ka: "ჯავშნის გვერდის ფერი, სათაური და მოკლე ტექსტი იცვლება პარამეტრები › სალონში.", en: "The booking page color, heading and short text are in Settings › Salon." },
      { ka: "სერვისი, რომელსაც „ჩანს ონლაინ ჯავშანში“ გამორთული აქვს, მხოლოდ თქვენ შეგიძლიათ ჩაწეროთ.", en: "A service with Shown for online booking off can only be booked by you." },
    ],
    link: { href: "/settings", label: { ka: "ონლაინ ჯავშნის პარამეტრები", en: "Online booking settings" } },
  },
  {
    id: "book", group: "daily", scene: "calendar",
    title: { ka: "ვიზიტის ჩაწერა", en: "Booking a visit" },
    intro: { ka: "კლიენტმა დარეკა? ჩაწერას რამდენიმე წამი სჭირდება.", en: "A client called? Booking takes a few seconds." },
    steps: [
      { ka: "გახსენით კალენდარი. თითოეულ სპეციალისტს თავისი სვეტი და ფერი აქვს.", en: "Open the Calendar. Each specialist has a column and a color." },
      { ka: "შეეხეთ ცარიელ დროს სასურველი სპეციალისტის სვეტში.", en: "Tap an empty time in the right specialist's column." },
      { ka: "მოძებნეთ კლიენტი სახელით ან ნომრით, ან დაამატეთ ახალი იქვე.", en: "Find the client by name or number, or add a new one right there." },
      { ka: "აირჩიეთ სერვისი. ხანგრძლივობა სერვისიდან ავტომატურად ითვლება.", en: "Pick the service. Its length is taken from the service." },
      { ka: "შეინახეთ. დაკავებულ დროზე ორმაგი ჩაწერა შეუძლებელია.", en: "Save. A taken time cannot be double booked." },
    ],
    tips: [
      { ka: "კალენდარში ნებისმიერ 15 წუთზე შეგიძლიათ ჩაწეროთ, დროის ნაბიჯის მიუხედავად.", en: "In the calendar you can book any quarter hour, whatever the time step." },
      { ka: "დღის და კვირის ხედი ზემოთ გადაირთვება.", en: "Switch between day and week view at the top." },
    ],
    link: { href: "/appointments", label: { ka: "კალენდრის გახსნა", en: "Open the calendar" } },
  },
  {
    id: "move", group: "daily", scene: "calendar",
    title: { ka: "გადატანა და დროის დაბლოკვა", en: "Moving visits and blocking time" },
    intro: { ka: "გეგმები იცვლება. კალენდარი ამას მარტივად ართმევს თავს.", en: "Plans change. The calendar handles it easily." },
    steps: [
      { ka: "შეეხეთ ვიზიტს და აირჩიეთ „სხვა დროზე გადატანა“.", en: "Tap the visit and choose Move to another time." },
      { ka: "შეეხეთ ახალ დროს, სხვა სპეციალისტთანაც.", en: "Tap the new time, even with another specialist." },
      { ka: "კომპიუტერზე ვიზიტი თაგვით გადაათრიეთ.", en: "On a computer, drag the visit with the mouse." },
      { ka: "შესვენებისთვის შეეხეთ ცარიელ დროს და აირჩიეთ „დაბლოკვა“. დაბლოკილ დროზე ონლაინ ვერავინ ჩაეწერება.", en: "For a break, tap an empty time and choose Block time. Nobody can book it online." },
    ],
    tips: [
      { ka: "გადატანისას ძველი SMS შეხსენება უქმდება და ახალი დრო თავად ეწყობა.", en: "When a visit moves, its old SMS reminder is canceled and the new time is scheduled by itself." },
    ],
    link: { href: "/appointments", label: { ka: "კალენდრის გახსნა", en: "Open the calendar" } },
  },
  {
    id: "visit", group: "daily", scene: "visit",
    title: { ka: "ვიზიტის დღე და გადახდა", en: "The visit day and payment" },
    intro: { ka: "მოვიდა, დასრულდა, გადახდა: სამი შეხება და დღე დახურულია.", en: "Arrived, done, paid: three taps and the day is in order." },
    steps: [
      { ka: "„დღეს“ გვერდზე ჩანს დღის ყველა ვიზიტი, შემდეგი კლიენტი ზემოთაა.", en: "Today shows every visit of the day, with the next client on top." },
      { ka: "კლიენტი მოვიდა? შეეხეთ „მოვიდა“.", en: "Client is here? Tap Arrived." },
      { ka: "დასრულებისას შეიყვანეთ გადახდა: ფასი, ფასდაკლება, თიფი, ნაღდი, ბარათი ან ორივე.", en: "When done, enter the payment: price, discount, tip, cash, card or both." },
      { ka: "„არ მოვიდა“ და „გაუქმება“ მენიუშია. შეცდომა? დააბრუნეთ ერთი შეხებით.", en: "No-show and Cancel are in the menu. A mistake? Undo with one tap." },
    ],
    tips: [
      { ka: "„დასრულებული“ ვიზიტი ითვლება შემოსავალში, საკომისიოში და კლიენტის ისტორიაში.", en: "A completed visit counts in earnings, commission and the client's history." },
      { ka: "დაბრუნების SMS მხოლოდ დასრულებული ვიზიტის შემდეგ იგზავნება.", en: "The come-back SMS is only sent after a completed visit." },
    ],
    link: { href: "/dashboard", label: { ka: "„დღეს“ გვერდზე გადასვლა", en: "Go to Today" } },
  },
  {
    id: "sms", group: "clients", scene: "reminder",
    title: { ka: "SMS შეხსენებები", en: "SMS reminders" },
    intro: { ka: "კლიენტს ვიზიტამდე მოკლე SMS მიდის, რომ არ დაავიწყდეს და დროულად მოვიდეს.", en: "Clients get a short SMS before the visit, so they remember and come on time." },
    steps: [
      { ka: "გახსენით პარამეტრები › SMS.", en: "Open Settings › SMS." },
      { ka: "აირჩიეთ, რა გაეგზავნოს: დღით ადრე, ორი საათით ადრე ან დადასტურება ჯავშნისას.", en: "Choose what to send: a day before, two hours before, or a confirmation when booking." },
      { ka: "თითოეულთან ხედავთ ზუსტ ტექსტს, რასაც კლიენტი მიიღებს, და რამდენ SMS-ად ითვლება.", en: "Under each you see the exact text the client gets and how many SMS it counts as." },
      { ka: "გვერდის ბოლოს ჩანს ბოლო 50 SMS: გაიგზავნა, მივიდა, ან რატომ არ გაიგზავნა.", en: "At the bottom you see the last 50 SMS: sent, delivered, or why one was not sent." },
    ],
    tips: [
      { ka: "SMS მიდის მხოლოდ იმ კლიენტებთან, ვინც ჯავშნისას SMS შეხსენება აირჩია.", en: "SMS only go to clients who chose SMS reminders when booking." },
      { ka: "SMS ფასიან პაკეტებშია, 1 დეკემბრიდან. ბიზნესში თვეში 1 000 SMS შედის. დამატებით 1 000 SMS 20 ₾.", en: "SMS come with paid plans, from 1 December. Business includes 1,000 SMS a month. Extra 1,000 SMS for 20 ₾." },
      { ka: "ქართული SMS-ში 70 სიმბოლო ეტევა. გრძელი ტექსტი 2 SMS-ად ითვლება.", en: "A Georgian SMS fits 70 characters. A longer text counts as 2 SMS." },
      { ka: "SMS იგზავნება moarge-ის სახელით, ტექსტში თქვენი სალონის სახელია.", en: "SMS are sent from moarge, with your salon's name in the text." },
    ],
    link: { href: "/settings/sms", label: { ka: "SMS პარამეტრები", en: "SMS settings" } },
  },
  {
    id: "comeback", group: "clients", scene: "clients",
    title: { ka: "დაბრუნების SMS", en: "Come-back SMS" },
    intro: { ka: "ვიზიტიდან რამდენიმე დღეში კლიენტს SMS-ით ეპატიჟებით ხელახლა, რომ უკან დაბრუნდეს.", en: "Some days after a visit, an SMS invites the client back." },
    steps: [
      { ka: "პარამეტრები › SMS: ჩართეთ „დაბრუნების SMS-ის გაგზავნა“.", en: "Settings › SMS: turn on Send come-back SMS." },
      { ka: "ჩაწერეთ ან აირჩიეთ, რამდენი დღის შემდეგ წავიდეს: მაგალითად 21 ან 30.", en: "Type or pick after how many days it goes: for example 21 or 30." },
      { ka: "სერვისს შეგიძლიათ თავისი ვადა მისცეთ: სერვისები › როდის დაბრუნდეს კლიენტი. ეს ზოგად დღეებს ცვლის.", en: "Give a service its own period: Services › When the client should come back. It replaces the general days." },
      { ka: "SMS მიდის დილის 11 საათზე და შეიცავს ჩაწერის ბმულს.", en: "The SMS goes out at 11 in the morning with a booking link." },
    ],
    tips: [
      { ka: "ეს მარკეტინგული SMS-ია: მიდის მხოლოდ იმ კლიენტებთან, ვინც სარეკლამო SMS-ზე დათანხმდა. თანხმობა ცალკეა და წინასწარ მონიშნული არ არის.", en: "This is a marketing SMS: it only goes to clients who agreed to offer SMS. That consent is separate and never pre-ticked." },
      { ka: "უკვე ჩაწერილ კლიენტს არ ეგზავნება. ახალი ვიზიტის შემდეგ ძველი მოსაწვევი ახლით იცვლება.", en: "Not sent to a client who has already booked again. A newer visit replaces the waiting invitation." },
      { ka: "ყველა SMS-ში არის შეწყვეტის ბმული. შეწყვეტა მხოლოდ შეთავაზებებს აჩერებს, ვიზიტის შეხსენებებს არა.", en: "Every SMS has a stop link. Stopping ends offers only, not visit reminders." },
    ],
    link: { href: "/settings/sms", label: { ka: "დაბრუნების SMS", en: "Come-back SMS" } },
  },
  {
    id: "clients", group: "clients", scene: "clients",
    title: { ka: "კლიენტების ბაზა", en: "Your client base" },
    intro: { ka: "ყველა კლიენტის ისტორია ერთ ადგილას და ყოველთვის იცით, ვის დაურეკოთ.", en: "Every client's history in one place, and you always know whom to call." },
    steps: [
      { ka: "სიები თავად ივსება: დაბრუნების დროა, საფრთხეშია, დაბადების დღე, VIP.", en: "Lists fill themselves: due back, at risk, birthday, VIP." },
      { ka: "ბარათზე: ვიზიტები, დახარჯული თანხა, ჩვეული პერიოდი და შემდეგი ვიზიტი.", en: "On the card: visits, money spent, usual gap and next visit." },
      { ka: "ჩაწერეთ ალერგიები, ფერის ფორმულები და შენიშვნები, რომ არავის დაავიწყდეს.", en: "Note allergies, colour formulas and notes so nobody forgets." },
      { ka: "დარეკვა, Viber, WhatsApp და ჯავშანი ერთი შეხებით.", en: "Call, Viber, WhatsApp and Book with one tap." },
      { ka: "კლიენტები Excel-ში გაქვთ? შეინახეთ CSV ფაილად და ატვირთეთ კლიენტების გვერდზე.", en: "Clients in Excel? Save it as a CSV file and upload it on the Clients page." },
      { ka: "ერთი ადამიანის ორი ბარათი? გააერთიანეთ, ისტორია ერთად შეინახება.", en: "Two cards for one person? Merge them and keep the history together." },
    ],
    tips: [
      { ka: "ბარათზე ორი თანხმობაა: SMS შეხსენებები და სარეკლამო SMS. მონიშნეთ მხოლოდ კლიენტის სურვილით.", en: "A card has two consents: SMS reminders and offer SMS. Tick them only if the client wants." },
      { ka: "„დაბრუნების დროა“: კლიენტი, რომელიც თავის ჩვეულ პერიოდზე მეტ ხანს არ მოსულა.", en: "Due back: a client who has stayed away longer than their usual gap." },
    ],
    link: { href: "/clients", label: { ka: "კლიენტების გახსნა", en: "Open clients" } },
  },
  {
    id: "services", group: "salon", scene: "booking",
    title: { ka: "სერვისები და ფასები", en: "Services and prices" },
    intro: { ka: "რას სთავაზობთ, რა ღირს და რამდენ ხანს გრძელდება.", en: "What you offer, what it costs and how long it takes." },
    steps: [
      { ka: "პარამეტრები › სერვისები › სერვისის დამატება.", en: "Settings › Services › Add service." },
      { ka: "ჩაწერეთ სახელი, ფასი და ხანგრძლივობა წუთებში, ან აირჩიეთ სწრაფი ღილაკით.", en: "Type the name, price and length in minutes, or pick a quick value." },
      { ka: "აირჩიეთ, რომელი სპეციალისტები ასრულებენ.", en: "Choose which specialists do it." },
      { ka: "სერვისზე დაჭერით ყველაფერი იცვლება. გამორთული სერვისები ცალკე ჯგუფშია და ხელახლა ჩაირთვება.", en: "Tap a service to change anything. Switched-off services are kept in their own group and can be turned back on." },
    ],
    tips: [
      { ka: "„როდის დაბრუნდეს კლიენტი“: რამდენ დღეში წავიდეს დაბრუნების SMS ამ სერვისის შემდეგ.", en: "When the client should come back: after how many days the come-back SMS goes for this service." },
      { ka: "გამორთვა წაშლა არ არის: ძველი ვიზიტები და შემოსავალი რჩება.", en: "Switching off is not deleting: past visits and earnings stay." },
    ],
    link: { href: "/settings/services", label: { ka: "სერვისები", en: "Services" } },
  },
  {
    id: "hours", group: "salon", scene: "calendar",
    title: { ka: "სამუშაო საათები და დასვენება", en: "Working hours and days off" },
    intro: { ka: "თითოეული სპეციალისტის განრიგი. ონლაინ ჯავშანი მხოლოდ სამუშაო დროს ჩანს.", en: "Each specialist's schedule. Online booking shows only working time." },
    steps: [
      { ka: "პარამეტრები › სამუშაო საათები: აირჩიეთ სპეციალისტი.", en: "Settings › Working hours: pick a specialist." },
      { ka: "თითოეულ დღეს ჩართეთ ან გამორთეთ და მიუთითეთ საათები.", en: "Turn each day on or off and set its hours." },
      { ka: "საჭიროების შემთხვევაში დაამატეთ შესვენება. ამ დროს ჯავშანი არ მიიღება.", en: "Add a break if needed. No bookings are taken then." },
      { ka: "ერთნაირი საათებისთვის: „პირველი დღის საათები ყველა დღეზე“.", en: "Same hours every day? Use the first day's hours for all." },
      { ka: "შვებულება ან დღესასწაული: პარამეტრები › დასვენება, მთელი სალონისთვის ან ერთი სპეციალისტისთვის.", en: "Holidays: Settings › Days off, for the whole salon or one specialist." },
    ],
    tips: [
      { ka: "დასვენება შეიძლება იყოს მთელი დღეები ან რამდენიმე საათი, მიზეზით.", en: "Days off can be whole days or a few hours, with a reason." },
    ],
    links: [
      { href: "/settings/schedules", label: { ka: "სამუშაო საათები", en: "Working hours" } },
      { href: "/settings/time-off", label: { ka: "დასვენება", en: "Days off" } },
    ],
  },
  {
    id: "team", group: "salon", scene: "team",
    title: { ka: "გუნდი და როლები", en: "Team and roles" },
    intro: { ka: "ყველა თავისი სახელით შედის და ხედავს მხოლოდ იმას, რაც სჭირდება.", en: "Everyone signs in with their own name and sees only what they need." },
    steps: [
      { ka: "პარამეტრები › სპეციალისტები: დაამატეთ სპეციალისტი, მიეცით ფერი და სერვისები.", en: "Settings › Specialists: add a specialist, give them a color and services." },
      { ka: "იქვე, „გუნდის წვდომა“ › მოწვევა: აირჩიეთ როლი.", en: "Right there, Team access › Invite: choose a role." },
      { ka: "გაუგზავნეთ ბმული Viber-ით ან WhatsApp-ით. მოქმედებს 7 დღე.", en: "Send the link by Viber or WhatsApp. It works for 7 days." },
      { ka: "სპეციალისტი, რომელიც აღარ მუშაობს, გამორთეთ. მისი ისტორია რჩება.", en: "Switch off a specialist who no longer works here. Their history stays." },
    ],
    tips: [
      { ka: "სპეციალისტი: ხედავს თავის ვიზიტებს, თავის კლიენტებს და თავის შემოსავალს.", en: "Specialist: sees their own visits, clients and earnings." },
      { ka: "ადმინისტრატორი: მართავს მთელ სალონს, კალენდარს და პარამეტრებს.", en: "Admin: runs the whole salon, the calendar and settings." },
      { ka: "საცდელ პერიოდში და ბიზნესში 10 სპეციალისტი შედის.", en: "The trial and Business include 10 specialists." },
    ],
    link: { href: "/settings/staff", label: { ka: "გუნდის მართვა", en: "Manage the team" } },
  },
  {
    id: "earnings", group: "salon", scene: "earnings",
    title: { ka: "შემოსავალი და საკომისიო", en: "Earnings and commission" },
    intro: { ka: "თვის ბოლოს ხელით დათვლა აღარ გჭირდებათ.", en: "No more counting by hand at the end of the month." },
    steps: [
      { ka: "აირჩიეთ პერიოდი: დღეს, კვირა, თვე ან სხვა.", en: "Pick a period: today, week, month or custom." },
      { ka: "ნახეთ გადახდილი, ნაღდი, ბარათი, თიფი და შედარება წინა პერიოდთან.", en: "See paid, cash, card, tips and the comparison with before." },
      { ka: "მიუთითეთ თითოეული სპეციალისტის საკომისიო პროცენტი.", en: "Set each specialist's commission percent." },
      { ka: "გასაცემები ჩამოტვირთეთ Excel-ში ერთი ღილაკით.", en: "Download payouts to Excel with one button." },
    ],
    tips: [
      { ka: "გასაცემი = საკომისიო + თიფი.", en: "Payout = commission + tips." },
      { ka: "ახალი პროცენტი მოქმედებს ახალ გადახდებზე, ძველი არ იცვლება.", en: "A new percent applies to new payments; old ones do not change." },
    ],
    link: { href: "/reports", label: { ka: "შემოსავლის გახსნა", en: "Open earnings" } },
  },
  {
    id: "plan", group: "help", scene: "today",
    title: { ka: "პაკეტი და ფასები", en: "Your package and prices" },
    intro: { ka: "რა ღირს moarge და რა შედის თითოეულ პაკეტში.", en: "What moarge costs and what each package includes." },
    steps: [
      { ka: "ნოემბერში moarge უფასოა. 1 დეკემბრიდან ახალ სალონებს 7 დღე უფასოდ აქვთ.", en: "moarge is free in November. From 1 December new salons get 7 days free." },
      { ka: "სოლო, 19 ₾ თვეში: ერთი სპეციალისტი, SMS ცალკე იყიდება.", en: "Solo, 19 ₾ a month: one specialist, SMS bought separately." },
      { ka: "ბიზნესი, 59 ₾ თვეში: 10 სპეციალისტი, 1 000 SMS თვეში, გუნდი და საკომისიო.", en: "Business, 59 ₾ a month: 10 specialists, 1,000 SMS a month, team and commission." },
      { ka: "6 თვით გადახდისას 10% ფასდაკლებაა, 12 თვით 20%.", en: "Pay for 6 months for 10% off, 12 months for 20% off." },
    ],
    tips: [
      { ka: "უფასო პერიოდის დასრულების თარიღს მფლობელი და ადმინისტრატორი პანელის თავში ხედავენ.", en: "Owners and admins see the end date of the free period at the top of the dashboard." },
      { ka: "თუ პაკეტს არ აირჩევთ, ანგარიში მხოლოდ სანახავი ხდება. მონაცემები არ იშლება.", en: "If you do not pick a package, the account turns view only. Nothing is deleted." },
    ],
    link: { href: "/pricing", label: { ka: "ფასების ნახვა", en: "See prices" } },
  },
  {
    id: "help", group: "help", scene: "today",
    title: { ka: "დახმარება და პატარა ხრიკები", en: "Help and small tricks" },
    intro: { ka: "რაღაც არ გამოგდით ან იდეა გაქვთ? მოგვწერეთ.", en: "Something not working, or an idea? Write to us." },
    steps: [
      { ka: "ღილაკი „უკუკავშირი“ ყველა გვერდის კუთხეშია. ჩაწერეთ, რა გინდათ, და პირდაპირ ჩვენთან მოვა.", en: "The Feedback button is in the corner of every page. Write what you need and it comes straight to us." },
      { ka: "ტელეფონზე დაამატეთ moarge მთავარ ეკრანზე და აპლიკაციასავით გაიხსნება.", en: "On your phone, add moarge to the home screen and it opens like an app." },
      { ka: "ენა იცვლება ზემოთ: ქართული ან ინგლისური.", en: "Switch the language at the top: Georgian or English." },
      { ka: "პარამეტრები › სალონი › დამატებითი › სატესტო რეჟიმი: SMS კლიენტებს არ გაეგზავნება, სანამ ყველაფერს სცდით.", en: "Settings › Salon › Advanced › Test mode: SMS are not sent to clients while you try things out." },
    ],
    tips: [
      { ka: "„ჩემი ჯავშნის გვერდი“ გვერდით მენიუშია: ნახეთ, რას ხედავს კლიენტი.", en: "My booking page is in the side menu: see what clients see." },
    ],
    link: { href: "/settings", label: { ka: "პარამეტრები", en: "Settings" } },
  },
];

const MASTER: Lesson[] = [
  {
    id: "my-day", group: "daily", scene: "today",
    title: { ka: "შენი დღე", en: "Your day" },
    intro: { ka: "ხედავ მხოლოდ შენს ვიზიტებს და შენს კლიენტებს.", en: "You see only your own visits and clients." },
    steps: [
      { ka: "„დღეს“ გვერდზე შენი დღის ვიზიტებია, შემდეგი კლიენტი ზემოთაა.", en: "Today shows your visits for the day, with the next client on top." },
      { ka: "კალენდარში შენი სვეტი და კვირის ხედი.", en: "The Calendar shows your column and your week." },
      { ka: "შეეხე ვიზიტს: კლიენტის ნომერი და მოქმედებები.", en: "Tap a visit: the client's number and actions." },
    ],
    link: { href: "/dashboard", label: { ka: "„დღეს“ გვერდზე გადასვლა", en: "Go to Today" } },
  },
  {
    id: "my-visits", group: "daily", scene: "visit",
    title: { ka: "მოვიდა და დასრულდა", en: "Arrived and done" },
    intro: { ka: "მონიშნე ვიზიტის მდგომარეობა. გადახდას ადმინისტრაცია იღებს.", en: "Mark the visit status. The front desk takes the payment." },
    steps: [
      { ka: "კლიენტი მოვიდა? შეეხე „მოვიდა“.", en: "Client is here? Tap Arrived." },
      { ka: "დამთავრდა? შეეხე „დასრულება“.", en: "Finished? Tap Done." },
      { ka: "არ მოვიდა? აირჩიე „არ მოვიდა“.", en: "Didn't come? Choose No-show." },
    ],
    tips: [
      { ka: "დასრულებული ვიზიტი ითვლება შენს შემოსავალსა და საკომისიოში.", en: "A completed visit counts in your earnings and commission." },
    ],
    link: { href: "/dashboard", label: { ka: "„დღეს“ გვერდზე გადასვლა", en: "Go to Today" } },
  },
  {
    id: "my-time", group: "daily", scene: "calendar",
    title: { ka: "შენი დროის დაბლოკვა", en: "Blocking your time" },
    intro: { ka: "შესვენება ან ექიმთან ვიზიტი? დაბლოკე დრო და მასზე ვერავინ ჩაეწერება.", en: "A break or a doctor's visit? Block the time and nobody can book it." },
    steps: [
      { ka: "კალენდარში შეეხე „დაბლოკვა“ ან ცარიელ დროს.", en: "In the Calendar, tap Block time or an empty time." },
      { ka: "აირჩიე დასაწყისი და დასასრული, შეგიძლია მიზეზიც დაწერო.", en: "Pick the start and end; you can add a reason." },
      { ka: "გასაუქმებლად შეეხე დაბლოკილ დროს.", en: "To remove it, tap the blocked time." },
    ],
    link: { href: "/appointments", label: { ka: "კალენდრის გახსნა", en: "Open the calendar" } },
  },
  {
    id: "my-clients", group: "clients", scene: "clients",
    title: { ka: "შენი კლიენტები", en: "Your clients" },
    intro: { ka: "ნახე ისტორია და ჩაწერე, რაც უნდა გახსოვდეს.", en: "See the history and note what you need to remember." },
    steps: [
      { ka: "კლიენტების გვერდზე ის კლიენტები არიან, ვინც შენთან იყო ან ჩაწერილია.", en: "Clients shows the people who came to you or are booked with you." },
      { ka: "ბარათზე ჩაწერე ალერგია, ფორმულა ან შენიშვნა.", en: "On the card, add an allergy, a formula or a note." },
    ],
    link: { href: "/clients", label: { ka: "კლიენტების გახსნა", en: "Open clients" } },
  },
  {
    id: "my-earnings", group: "salon", scene: "earnings",
    title: { ka: "შენი შემოსავალი", en: "Your earnings" },
    intro: { ka: "ნახე შენი საკომისიო, თიფი და გასაცემი ნებისმიერი პერიოდისთვის.", en: "See your commission, tips and payout for any period." },
    steps: [
      { ka: "გახსენი „ჩემი შემოსავალი“ და აირჩიე პერიოდი.", en: "Open My earnings and pick a period." },
      { ka: "გასაცემი = საკომისიო + თიფი.", en: "Payout = commission + tips." },
    ],
    link: { href: "/reports", label: { ka: "ჩემი შემოსავალი", en: "My earnings" } },
  },
  {
    id: "my-help", group: "help", scene: "today",
    title: { ka: "დახმარება", en: "Help" },
    intro: { ka: "კითხვა ან იდეა? მოგვწერე.", en: "A question or an idea? Write to us." },
    steps: [
      { ka: "ღილაკი „უკუკავშირი“ ყველა გვერდის კუთხეშია.", en: "The Feedback button is in the corner of every page." },
      { ka: "ტელეფონზე დაამატე moarge მთავარ ეკრანზე და აპლიკაციასავით გაიხსნება.", en: "On your phone, add moarge to the home screen and it opens like an app." },
    ],
    link: { href: "/dashboard", label: { ka: "„დღეს“ გვერდზე გადასვლა", en: "Go to Today" } },
  },
];

const STORAGE_KEY = "moarge.guide.viewed";
const STEP_MS = 2400;

function readViewed(): string[] {
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as string[]; } catch { return []; }
}

/** A short, animated guide to the dashboard. Masters get their own lessons. */
export default function GuideView({ audience, initialLesson }: { audience: Audience; initialLesson?: string }) {
  const { lang, t } = useLanguage();
  const lessons = audience === "master" ? MASTER : OFFICE;
  const [index, setIndex] = useState(() => Math.max(0, lessons.findIndex((lesson) => lesson.id === initialLesson)));
  const [viewed, setViewed] = useState<string[]>([]);
  const lesson = lessons[index];
  const scene = SCENES[lesson.scene];
  const reducedMotion = usePrefersReducedMotion();
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const [step, setStep] = useStepTimer({ count: scene.captions.length, interval: STEP_MS, running: onScreen && !reducedMotion });
  const shownStep = reducedMotion && step === 0 ? scene.captions.length - 1 : step;

  useEffect(() => { setViewed(readViewed()); }, []);

  // Opening a lesson counts as seen; remembered only in this browser.
  useEffect(() => {
    setViewed((current) => {
      if (current.includes(lesson.id)) return current;
      const next = [...current, lesson.id];
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage may be off */ }
      return next;
    });
    window.history.replaceState(null, "", `/guide?lesson=${lesson.id}`);
  }, [lesson.id]);

  function open(next: number) {
    setIndex(next);
    setStep(0);
  }

  const done = lessons.filter((item) => viewed.includes(item.id)).length;
  const Scene = scene.Scene;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-brand"><GraduationCap className="h-4 w-4" />{t("გზამკვლევი", "Guide")}</p>
          <h1 className="mt-1 text-2xl font-bold text-stone-900 sm:text-3xl">{t("როგორ მუშაობს moarge", "How moarge works")}</h1>
          <p className="mt-1 text-sm text-stone-500">{t("ყველაფერი, რაც moarge-ში შეგიძლიათ, მოკლე გაკვეთილებად, ანიმაციით და განმარტებებით.", "Everything moarge can do, in short animated lessons with explanations.")}</p>
        </div>
        <div className="w-full max-w-xs">
          <p className="text-sm text-stone-600">{t(`ნანახია ${done} / ${lessons.length}`, `Seen ${done} / ${lessons.length}`)}</p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-soft">
            <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${(done / lessons.length) * 100}%` }} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
        <nav aria-label={t("გაკვეთილები", "Lessons")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          {lessons.map((item, itemIndex) => {
            const active = itemIndex === index;
            const seen = viewed.includes(item.id);
            const firstOfGroup = itemIndex === 0 || lessons[itemIndex - 1].group !== item.group;
            return (
              <React.Fragment key={item.id}>
              {firstOfGroup && <p className="hidden px-1 pt-3 text-xs font-bold uppercase tracking-wide text-stone-400 first:pt-0 lg:block">{GROUPS[item.group][lang]}</p>}
              <button type="button" onClick={() => open(itemIndex)} aria-current={active ? "step" : undefined}
                className={cn("flex min-h-12 shrink-0 items-center gap-3 rounded-2xl border px-3 text-left text-sm font-semibold transition",
                  active ? "border-brand bg-brand text-white shadow-sm" : "border-stone-200 bg-white text-stone-700 hover:border-rose-300 hover:bg-brand-soft")}>
                <span className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs",
                  active ? "bg-white/20 text-white" : seen ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500")}>
                  {seen && !active ? <Check className="h-4 w-4" /> : itemIndex + 1}
                </span>
                <span className="whitespace-nowrap lg:whitespace-normal">{item.title[lang]}</span>
              </button>
              </React.Fragment>
            );
          })}
        </nav>

        <Card key={lesson.id} className="step-in">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_auto] xl:items-start">
            <div className="min-w-0 space-y-4">
              <div>
                <p className="text-sm font-semibold text-brand">{t(`გაკვეთილი ${index + 1}`, `Lesson ${index + 1}`)}</p>
                <h2 className="mt-1 text-xl font-bold text-stone-900 sm:text-2xl">{lesson.title[lang]}</h2>
                <p className="mt-1 text-stone-600">{lesson.intro[lang]}</p>
              </div>
              <ol className="space-y-2.5">
                {lesson.steps.map((item, stepIndex) => (
                  <li key={stepIndex} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-strong">{stepIndex + 1}</span>
                    <span className="text-stone-800">{item[lang]}</span>
                  </li>
                ))}
              </ol>
              {lesson.tips && <div className="rounded-2xl bg-stone-50 p-4">
                <p className="text-sm font-bold text-stone-900">{t("კარგი იცოდეთ", "Good to know")}</p>
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-stone-700">
                  {lesson.tips.map((tip, tipIndex) => <li key={tipIndex} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{tip[lang]}</li>)}
                </ul>
              </div>}
              {lesson.links && <div className="flex flex-wrap gap-2">
                {lesson.links.map((link) => (
                  <ButtonLink key={link.href} href={link.href} variant="secondary" icon={<ExternalLink className="h-4 w-4 text-brand" />}>{link.label[lang]}</ButtonLink>
                ))}
              </div>}
              <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-4">
                {lesson.link && <ButtonLink href={lesson.link.href} icon={<ArrowRight className="h-4 w-4" />}>{lesson.link.label[lang]}</ButtonLink>}
                {index + 1 < lessons.length
                  ? <Button variant="secondary" onClick={() => open(index + 1)} icon={<ChevronRight className="h-4 w-4" />}>{t("შემდეგი გაკვეთილი", "Next lesson")}</Button>
                  : <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Check className="h-4 w-4" />{t("ყველა გაკვეთილი ნანახია. წარმატებები!", "That was the last lesson. Good luck!")}</p>}
              </div>
            </div>

            <div ref={ref} className="mx-auto w-full max-w-[480px] xl:w-[300px]">
              <div aria-hidden="true" className="flex justify-center">
                <div className={cn("w-full", scene.frame === "phone" && "max-w-[232px]")}>
                  <DeviceFrame frame={scene.frame}><Scene step={shownStep} /></DeviceFrame>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button type="button" onClick={() => setStep((shownStep - 1 + scene.captions.length) % scene.captions.length)} aria-label={t("წინა", "Previous")}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 hover:bg-brand-soft"><ChevronLeft className="h-5 w-5" /></button>
                <p className="min-w-0 flex-1 text-center text-sm font-semibold text-stone-800">{scene.captions[shownStep][lang]}</p>
                <button type="button" onClick={() => setStep((shownStep + 1) % scene.captions.length)} aria-label={t("შემდეგი", "Next")}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 hover:bg-brand-soft"><ChevronRight className="h-5 w-5" /></button>
              </div>
              <div className="mt-2 flex justify-center gap-1">
                {scene.captions.map((_, dot) => <span key={dot} className={cn("h-1.5 rounded-full transition-all duration-300", dot === shownStep ? "w-6 bg-brand" : "w-1.5 bg-rose-200")} />)}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
