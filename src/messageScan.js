// Finds appointments and due dates in text messages. Pure logic, so it can be tested anywhere.
import { parseEvents } from './parseEvents';
import { todayKey } from './dates';

// One-time codes and marketing texts often mention dates but are never things to put on a calendar
const SKIP =
  /\b(otp|one[- ]time (?:password|code)|verification code|passcode|security code|login code|\d+% off|discount|coupon|promo(?:tion)?|offer|sale|cashback|unsubscribe|reply stop|txt stop|text stop|opt out)\b/i;

const LEAD_INS = [
  /^(?:hi|hello|hey|dear|good (?:morning|afternoon|evening))\b[^,!:.]{0,30}[,!:.]\s*/i,
  /^(?:this is (?:a )?(?:friendly |quick )?reminder|friendly reminder|reminder|just a reminder|kind reminder)\b\s*(?:that|of|for|about|:|-)?\s*/i,
];

function tidy(body) {
  let text = body.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) for (const re of LEAD_INS) text = text.replace(re, '');
  return text;
}

// messages: [{ id, address, body, date }]. Returns calendar-event drafts for the ones with a usable date.
export function findMessageEvents(messages, { seen = new Set(), dayFirst = false } = {}) {
  const today = todayKey();
  const found = [];
  for (const message of messages) {
    if (seen.has(message.id) || !message.body || SKIP.test(message.body)) continue;
    // Read the whole text as one item; "today"/"tomorrow" mean the day the message arrived
    const [event] = parseEvents(tidy(message.body), {
      now: new Date(message.date),
      dayFirst,
      single: true,
    });
    if (event.missingDate) continue;
    if (!event.repeat && event.date < today) continue;
    const title = event.title.length > 60 ? `${event.title.slice(0, 57).trimEnd()}…` : event.title;
    found.push({
      ...event,
      title,
      notes: `Text from ${message.address}: ${message.body}`,
      messageId: message.id,
      messageFrom: message.address,
      messageText: message.body,
    });
  }
  return found;
}
