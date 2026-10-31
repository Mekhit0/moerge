"use client";

import { useState } from "react";
import { CalendarDays, Plus, Search, Trash2, Users, Wallet } from "lucide-react";
import {
  Alert, Badge, Button, Card, CardHeader, Chip, ChipRow, DayChips, Dialog, EmptyState, Field, IconButton,
  Input, Select, Sheet, Skeleton, StatCard, StatusBadge, Tabs, Textarea, TimeChips, useToast,
} from "@/components/ui";
import { tbilisiDate } from "@/lib/dates";

export default function UiKitPreview() {
  const toast = useToast();
  const [tab, setTab] = useState<"day" | "week" | "month">("day");
  const [chip, setChip] = useState("all");
  const [date, setDate] = useState(tbilisiDate());
  const [time, setTime] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <h1 className="text-2xl font-bold">MOARGE UI kit</h1>

      <Card>
        <CardHeader title="Buttons" description="One primary button per screen." />
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={<Plus className="h-4 w-4" />}>ახალი ჯავშანი</Button>
          <Button variant="secondary">შენახვა</Button>
          <Button variant="ghost">გაუქმება</Button>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />}>წაშლა</Button>
          <Button loading>ინახება</Button>
          <Button size="sm" variant="secondary">პატარა</Button>
          <Button size="lg">დიდი ღილაკი</Button>
          <IconButton label="ძებნა"><Search className="h-5 w-5" /></IconButton>
        </div>
      </Card>

      <Card>
        <CardHeader title="Badges and statuses" />
        <div className="flex flex-wrap gap-2">
          {["scheduled", "arrived", "completed", "no_show", "canceled"].map((status) => <StatusBadge key={status} status={status} />)}
          <Badge tone="brand">VIP</Badge><Badge tone="warning">რისკის ქვეშ</Badge><Badge tone="success">ახალი</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="დღევანდელი ვიზიტები" value="8" hint="დარჩენილია 5" icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label="გადახდილი დღეს" value="420 ₾" icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="ახალი კლიენტები" value="3" icon={<Users className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader title="Tabs and chips" />
        <Tabs label="ხედი" value={tab} onChange={setTab} items={[{ value: "day", label: "დღე" }, { value: "week", label: "კვირა" }, { value: "month", label: "თვე", count: 42 }]} />
        <ChipRow className="mt-4">
          {[["all", "ყველა", ""], ["ana", "ანა", "#e11d48"], ["tamar", "თამარი", "#7c3aed"], ["lika", "ლიკა", "#0284c7"]].map(([value, label, color]) => (
            <Chip key={value} selected={chip === value} dotColor={color || undefined} onClick={() => setChip(value)}>{label}</Chip>
          ))}
        </ChipRow>
      </Card>

      <Card>
        <CardHeader title="Day and time pickers" />
        <DayChips value={date} onChange={setDate} />
        <TimeChips className="mt-4" times={["10:00", "11:30", "13:00", "14:00", "16:30", "18:00"]} value={time} onChange={setTime} />
      </Card>

      <Card>
        <CardHeader title="Form fields" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="სახელი">{(props) => <Input {...props} placeholder="ნინო ბერიძე" />}</Field>
          <Field label="ტელეფონი" error="შეიყვანეთ ქართული მობილურის ნომერი.">{(props) => <Input {...props} defaultValue="123" />}</Field>
          <Field label="სერვისი">{(props) => <Select {...props}><option>მანიკური</option><option>პედიკური</option></Select>}</Field>
          <Field label="შენიშვნა" optionalLabel="(არასავალდებულო)" hint="ჩანს მხოლოდ სალონისთვის.">{(props) => <Textarea {...props} />}</Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Feedback" />
        <div className="space-y-3">
          <Alert tone="success">ცვლილება შენახულია.</Alert>
          <Alert tone="warning">სატესტო პერიოდი 3 დღეში მთავრდება.</Alert>
          <Alert tone="error">შენახვა ვერ მოხერხდა. სცადეთ თავიდან.</Alert>
          <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12 w-2/3" /></div>
          <EmptyState icon={<CalendarDays />} title="დღეს ვიზიტები არ არის." text="დაამატეთ ახალი ჯავშანი ან გაუზიარეთ ბმული კლიენტებს." action={<Button icon={<Plus className="h-4 w-4" />}>ახალი ჯავშანი</Button>} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => toast.success("ვიზიტი შენახულია.")}>Toast: success</Button>
            <Button variant="secondary" onClick={() => toast.error("ეს დრო უკვე დაკავებულია.")}>Toast: error</Button>
            <Button variant="secondary" onClick={() => toast.show("ვიზიტი გაუქმდა.", { action: { label: "დაბრუნება", onClick: () => toast.success("აღდგა.") } })}>Toast: undo</Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Sheet and dialog" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setSheetOpen(true)}>Sheet</Button>
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>Dialog</Button>
        </div>
      </Card>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="ვიზიტი" description="ნინო ბ. · მანიკური · 11:30"
        footer={<div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => setSheetOpen(false)}>დახურვა</Button><Button onClick={() => { setSheetOpen(false); toast.success("მოვიდა."); }}>მოვიდა</Button></div>}>
        <div className="space-y-3">{Array.from({ length: 12 }, (_, index) => <p key={index} className="text-sm text-stone-600">სტრიქონი {index + 1}</p>)}</div>
      </Sheet>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="გაუქმდეს ვიზიტი?"
        footer={<div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => setDialogOpen(false)}>არა</Button><Button variant="danger" onClick={() => setDialogOpen(false)}>დიახ, გაუქმება</Button></div>}>
        <p className="text-sm text-stone-600">კლიენტს გაუქმების შესახებ შეტყობინება მიუვა.</p>
      </Dialog>
    </main>
  );
}
