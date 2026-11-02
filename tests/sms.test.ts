import { describe, expect, it } from "vitest";
import { UbillError, sendUbillSms, smsParts, ubillBalance, ubillNumber } from "../src/lib/sms";
import { createUbilSmsProvider, processNotification, type NotificationJob } from "../src/lib/notifications";

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })) as typeof fetch;
}
const config = { apiKey: "test-key", brandId: "1" };

describe("SMS parts", () => {
  it("fits 160 plain characters or 70 Georgian ones in one SMS", () => {
    expect(smsParts("")).toBe(0);
    expect(smsParts("a".repeat(160))).toBe(1);
    expect(smsParts("a".repeat(161))).toBe(2);
    expect(smsParts("a".repeat(307))).toBe(3);
    expect(smsParts("ა".repeat(70))).toBe(1);
    expect(smsParts("ა".repeat(71))).toBe(2);
    expect(smsParts("ა".repeat(135))).toBe(3);
  });

  it("counts the default Georgian reminder as one SMS", () => {
    expect(smsParts("სალონი ია: ხვალ 12:30-ზე გელოდებით. მანიკური. კოდი 750934")).toBe(1);
  });

  it("treats accents and unusual symbols as Unicode, never undercounting", () => {
    expect(smsParts("Café 12:30" + "a".repeat(70))).toBe(2);
  });
});

describe("uBill client", () => {
  it("writes numbers the way uBill wants them", () => {
    expect(ubillNumber("+995 555 12 34 56")).toBe("995555123456");
    expect(ubillNumber("00995555123456")).toBe("995555123456");
  });

  it("returns the message ID when uBill accepts", async () => {
    await expect(sendUbillSms({ number: "+995555123456", text: "hi" }, { ...config, fetcher: fakeFetch(200, { statusID: 0, smsID: 117345 }) }))
      .resolves.toEqual({ id: "117345" });
  });

  it("retries later when the uBill balance is empty or uBill is down", async () => {
    await expect(sendUbillSms({ number: "995555123456", text: "hi" }, { ...config, fetcher: fakeFetch(200, { statusID: 40 }) }))
      .rejects.toMatchObject({ statusCode: 503, ubillStatus: 40 });
    await expect(sendUbillSms({ number: "995555123456", text: "hi" }, { ...config, fetcher: fakeFetch(502, {}) }))
      .rejects.toMatchObject({ statusCode: 503 });
    const offline = (async () => { throw new TypeError("network down"); }) as typeof fetch;
    await expect(sendUbillSms({ number: "995555123456", text: "hi" }, { ...config, fetcher: offline }))
      .rejects.toMatchObject({ statusCode: 503 });
  });

  it("gives up on requests uBill will never accept", async () => {
    await expect(sendUbillSms({ number: "995555123456", text: "hi" }, { ...config, fetcher: fakeFetch(200, { statusID: 50 }) }))
      .rejects.toMatchObject({ statusCode: 422, ubillStatus: 50 });
  });

  it("refuses to send without a key and brand", async () => {
    await expect(sendUbillSms({ number: "995555123456", text: "hi" }, { apiKey: "", brandId: "" })).rejects.toBeInstanceOf(UbillError);
  });

  it("reads the balance", async () => {
    await expect(ubillBalance({ apiKey: "k", fetcher: fakeFetch(200, { statusID: 0, sms: 5000 }) })).resolves.toBe(5000);
    await expect(ubillBalance({ apiKey: "k", fetcher: fakeFetch(200, { statusID: 99 }) })).rejects.toBeInstanceOf(UbillError);
  });
});

describe("SMS through the notification worker", () => {
  const job: NotificationJob = {
    id: "n1", salon_id: "s1", client_id: "c1", appointment_id: "a1", message_type: "reminder_24h", channel: "sms", language: "ka",
    recipient: "+995555123456", subject: null, body: "სალონი ია: ხვალ 12:30-ზე გელოდებით.", attempt_count: 1, max_attempts: 5,
    idempotency_key: "k1", salon_name: "სალონი ია", reply_to: "a@b.c", unsubscribe_url: "https://x", client_allowed: true,
    client_archived: false, dry_run_mode: false, sms_parts: 2,
  };

  it("records uBill's ID and what the parts cost", async () => {
    const provider = createUbilSmsProvider({ ...config, fetcher: fakeFetch(200, { statusID: 0, smsID: "9" }) });
    await expect(processNotification(job, provider)).resolves.toMatchObject({ status: "sent", providerMessageId: "9", cost: 0.02 });
  });

  it("schedules a retry when uBill is out of SMS", async () => {
    const provider = createUbilSmsProvider({ ...config, fetcher: fakeFetch(200, { statusID: 40 }) });
    await expect(processNotification(job, provider)).resolves.toMatchObject({ status: "retry" });
  });
});
