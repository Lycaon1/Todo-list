// Turns typed or dictated sentences into calendar events, entirely on the phone.
// Example: "Soccer every Tuesday and Thursday from 5 to 6:30pm. Mom's birthday is March 3rd."
import { toKey, fromKey } from './dates';

const MONTH_INDEX = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};
const MONTH = '(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)';
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY = '(sunday|monday|tuesday|wednesday|thursday|friday|saturday)';
const TIME = '(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?';
const DAY_PREFIX = '(?:(?:on\\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday),?\\s+(?:the\\s+)?)?';

const NUMBER_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const NUMBER = `(\\d+|${Object.keys(NUMBER_WORDS).join('|')})`;
const ORDINALS = [
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth',
];
const ORDINAL_VALUES = Object.fromEntries(ORDINALS.map((w, i) => [w, i + 1]));
ORDINAL_VALUES.thirtieth = 30;
ORDINALS.slice(0, 9).forEach((w, i) => {
  ORDINAL_VALUES[`twenty-${w}`] = 21 + i;
});
ORDINAL_VALUES['thirty-first'] = 31;
const ORDINAL = `(${Object.keys(ORDINAL_VALUES).sort((a, b) => b.length - a.length).join('|')})`;

const toNumber = (s) => NUMBER_WORDS[s.toLowerCase()] ?? Number(s);
const pad = (n) => String(n).padStart(2, '0');

function normalize(text) {
  return text
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\b([ap])\.\s?m\b\.?/gi, '$1m')
    .replace(/\b(dr|mr|mrs|ms|st|jr|sr|ave|mt|prof)\./gi, '$1')
    .replace(/(^|[^\d$₹£€.,])(\d{1,2})\.(\d{2})\b/g, '$1$2:$3')
    .replace(/\bo'?clock\b/gi, '')
    .replace(/\b(twenty|thirty)[\s-]+(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)\b/gi, '$1-$2')
    .replace(new RegExp(`\\b${ORDINAL}\\b`, 'gi'), (w) => `${ORDINAL_VALUES[w.toLowerCase()]}th`)
    .replace(/\b(\d{1,2})\s+(thirty|fifteen|forty[\s-]five)\b/gi, (m, h, w) => `${h}:${w.toLowerCase() === 'thirty' ? '30' : w.toLowerCase() === 'fifteen' ? '15' : '45'}`)
    .replace(/\b(at|from|to|until|till|by|around|between|and|past|after)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b(?=\s*(?:am|pm|:|in the|$|[,.]|\s+(?:to|and|until)\b))/gi, (m, p, w) => `${p} ${NUMBER_WORDS[w.toLowerCase()]}`)
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(\s*)(am|pm)\b/gi, (m, w, s, ap) => `${NUMBER_WORDS[w.toLowerCase()]} ${ap}`);
}

function validKey(year, month, day) {
  const d = new Date(year, month, day);
  return d.getMonth() === month && d.getDate() === day ? toKey(d) : null;
}

function to24h(hour, minute, meridiem, context) {
  let h = Number(hour);
  const m = Number(minute || 0);
  if (h > 23 || m > 59) return null;
  const mer = meridiem?.toLowerCase();
  if (mer === 'pm' && h < 12) h += 12;
  else if (mer === 'am' && h === 12) h = 0;
  else if (!mer && h <= 12) {
    if (/\b(morning|breakfast)\b/.test(context)) h = h === 12 ? 0 : h;
    else if (/\b(afternoon|evening|tonight|night|dinner)\b/.test(context)) h = h < 12 ? h + 12 : h;
    else if (h >= 1 && h <= 6) h += 12; // "at 5" usually means 5 PM
  }
  return `${pad(h)}:${pad(m)}`;
}

function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function shiftKey(key, { days = 0, months = 0 }) {
  const d = fromKey(key);
  if (months) {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }
  d.setDate(d.getDate() + days);
  return toKey(d);
}

// Small helper that finds a pattern in the remaining text, removes it, and returns the match
function makeTaker(text) {
  const state = { rest: ` ${text} ` };
  state.take = (re) => {
    const m = state.rest.match(re);
    if (!m) return null;
    state.rest = `${state.rest.slice(0, m.index)} ${state.rest.slice(m.index + m[0].length)}`;
    return m;
  };
  return state;
}

// Finds one date phrase. Returns { key, year, monthOnly } or null.
function takeDate(t, today, dayFirst) {
  const now = fromKey(today);
  let m = t.take(new RegExp(`${DAY_PREFIX}\\b${MONTH}\\.?\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s*(\\d{4}))?`, 'i'));
  if (m) {
    const year = m[3] ? Number(m[3]) : null;
    return { key: validKey(year ?? now.getFullYear(), MONTH_INDEX[m[1].toLowerCase()], Number(m[2])), year };
  }
  m = t.take(new RegExp(`${DAY_PREFIX}\\b(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\b(?:,?\\s*(\\d{4}))?`, 'i'));
  if (m) {
    const year = m[3] ? Number(m[3]) : null;
    return { key: validKey(year ?? now.getFullYear(), MONTH_INDEX[m[2].toLowerCase()], Number(m[1])), year };
  }
  m = t.take(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const [day, month] = dayFirst ? [a, b] : [b, a];
    let year = m[3] ? Number(m[3]) : null;
    if (year !== null && year < 100) year += 2000;
    return { key: validKey(year ?? now.getFullYear(), month - 1, day), year };
  }
  if (t.take(/\b(?:the\s+)?day\s+after\s+tomorrow\b/i)) return { key: shiftKey(today, { days: 2 }), relative: true };
  if (t.take(/\b(?:tomorrow|tmrw|tmr)\b/i)) return { key: shiftKey(today, { days: 1 }), relative: true };
  if (t.take(/\b(?:today|tonight|this evening|this afternoon|this morning|this week)\b/i)) return { key: today, relative: true };
  m = t.take(new RegExp(`\\bin\\s+${NUMBER}\\s+(days?|weeks?|months?)\\b`, 'i'));
  if (m) {
    const n = toNumber(m[1]);
    const unit = m[2].toLowerCase();
    if (unit.startsWith('month')) return { key: shiftKey(today, { months: n }), relative: true };
    return { key: shiftKey(today, { days: unit.startsWith('week') ? n * 7 : n }), relative: true };
  }
  if (t.take(/\bnext\s+week\b/i)) return { key: shiftKey(today, { days: 7 }), relative: true };
  if (t.take(/\bnext\s+month\b/i)) return { key: shiftKey(today, { months: 1 }), relative: true };
  m = t.take(new RegExp(`\\b(?:(this|next|coming|on)\\s+)?(?:(this|next|coming)\\s+)?${DAY}\\b`, 'i'));
  if (m) {
    const modifier = (m[2] || m[1] || '').toLowerCase();
    const target = DAY_NAMES.indexOf(m[3].toLowerCase());
    let diff = (target - now.getDay() + 7) % 7;
    if (diff === 0 && modifier !== 'this') diff = 7;
    // "next Friday" said early in the week means Friday of next week, not this one
    if (modifier === 'next' && now.getDay() + diff <= 6) diff += 7;
    return { key: shiftKey(today, { days: diff }), relative: true };
  }
  m = t.take(/\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/i);
  if (m) return { key: validKey(now.getFullYear(), now.getMonth(), Number(m[1])), dayOfMonth: true };
  m = t.take(new RegExp(`\\b${MONTH}\\b(?:\\s+(\\d{4}))?`, 'i'));
  if (m) {
    const month = MONTH_INDEX[m[1].toLowerCase()];
    const year = m[2] ? Number(m[2]) : now.getFullYear();
    return { key: validKey(year, month, new Date(year, month + 1, 0).getDate()), monthOnly: true, year: m[2] ? year : null };
  }
  return null;
}

const CATEGORY_PATTERNS = [
  ['birthday', /\b(birthday|b-day|bday)\b/i],
  ['anniversary', /\banniversary\b/i],
  ['appointment', /\b(doctor|dr|dentist|dental|appointment|appt|check-?up|clinic|hospital|vet|therapy|therapist|physio|surgery|pediatrician|optometrist|eye exam|lab test|blood test|scan|x-ray|vaccin\w*|consultation|salon|haircut)\b/i],
  ['kids', /\b(school|class|practice|lesson|tuition|tutor|recital|game|match|pick ?up|drop ?off|soccer|football|cricket|basketball|swim(?:ming)?|dance|piano|guitar|karate|ballet|homework|exam|ptm|pta|parent[\s-]teacher|teacher|report card|uniform|field trip|camp|play ?date|kids?|son|daughter|children)\b/i],
  ['property', /\b(tenants?|rent|lease|repairs?|plumber|plumbing|electrician|hvac|roof|pest control|inspection|property|landlord|maintenance|contractor|unit \w+|property tax)\b/i],
  ['bills', /\b(bill|invoice|payment|amount due|due amount|emi|premium|insurance|subscription|renewal|renew|credit card|statement|utility|electricity|water bill|gas bill|internet bill|phone bill|tax)\b/i],
];

function cleanTitle(text, category) {
  let t = text.replace(/\s+/g, ' ').trim();
  t = t.replace(/\b(?:on|to|in|into)\s+(?:my|the)\s+calendar\b/gi, ' ');
  const intro =
    /^(?:(?:ok(?:ay)?|so|um+|uh+|and|also|then|please|hey|oh)\b[\s,]*|(?:remind me (?:to|about|of|that)|don't forget (?:to|about)?|i (?:have|need to|want to|'ve got|got|am|'m)|we (?:have|need to|are|'re)|there(?:'s| is| are)|it'?s|it is|add|schedule|put|set up|create|starting|beginning)\b\s*)/i;
  for (let i = 0; i < 6 && intro.test(t); i++) t = t.replace(intro, '').trim();
  t = t.replace(/^(?:a|an)\s+/i, '');
  for (let i = 0; i < 4; i++) t = t.replace(/\b(?:on|at|from|by|for)\s+(?=(?:on|at|from|by|for)\b|,|$)/gi, '').trim();
  const trailing = /[\s,:;-]*\b(?:on|at|from|every|each|is|are|was|and|the|for|in|of|by|this|next|starting|beginning|which|that|it|will be|be|until|till|around|between|with|to)\s*$/i;
  for (let i = 0; i < 6 && trailing.test(t); i++) t = t.replace(trailing, '').trim();
  t = t.replace(/^(?:on|at|is|for|the|and)\s+/i, '');
  t = t.replace(/\s+,/g, ',').replace(/^[\s,:;-]+|[\s,:;-]+$/g, '').replace(/\s{2,}/g, ' ');
  if (!t) return { birthday: 'Birthday', anniversary: 'Anniversary', appointment: 'Appointment' }[category] ?? 'Event';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function parseSentence(sentence, today, dayFirst) {
  const t = makeTaker(sentence);
  const context = sentence.toLowerCase();
  const event = {
    title: '',
    category: 'event',
    date: null,
    time: null,
    endTime: null,
    repeat: null,
    weekdays: null,
    interval: 1,
    until: null,
    birthYear: null,
    missingDate: false,
    source: sentence.trim(),
  };
  for (const [category, re] of CATEGORY_PATTERNS) {
    if (re.test(sentence)) {
      event.category = category;
      break;
    }
  }

  // Times
  let m =
    t.take(new RegExp(`\\b(?:from|between)\\s+${TIME}\\s*(?:-|–|to|until|till|and)\\s*${TIME}`, 'i')) ||
    t.take(new RegExp(`\\b${TIME}\\s*(?:-|–|to)\\s*(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)\\b`, 'i'));
  if (m) {
    const endMer = m[6]?.toLowerCase();
    let startMer = m[3]?.toLowerCase();
    if (!startMer && endMer) {
      const s = Number(m[1]) % 12;
      const e = Number(m[4]) % 12;
      startMer = s <= e ? endMer : endMer === 'pm' ? 'am' : 'pm';
    }
    event.time = to24h(m[1], m[2], startMer, context);
    event.endTime = to24h(m[4], m[5], endMer ?? startMer, context);
    if (event.endTime && event.time && event.endTime <= event.time && !endMer) {
      event.endTime = to24h(Number(m[4]) + 12, m[5], null, context);
    }
  }
  if (!event.time) {
    if (t.take(/\b(?:at\s+)?(?:noon|midday)\b/i)) event.time = '12:00';
    else if (t.take(/\b(?:at\s+)?midnight\b/i)) event.time = '00:00';
    else if ((m = t.take(/\b(?:at\s+)?(half|quarter)\s+(past|after|to)\s+(\d{1,2})\s*(am|pm)?/i))) {
      const hour = Number(m[3]);
      const offset = m[1].toLowerCase() === 'half' ? 30 : 15;
      event.time =
        m[2].toLowerCase() === 'to'
          ? to24h(hour === 1 ? 12 : hour - 1, 60 - offset, m[4], context)
          : to24h(hour, offset, m[4], context);
    } else if ((m = t.take(new RegExp(`\\b(?:at|@|by|around)\\s+${TIME}(?![\\d:/]|(?:st|nd|rd|th)\\b)`, 'i')))) {
      event.time = to24h(m[1], m[2], m[3], context);
    } else if ((m = t.take(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i))) {
      event.time = to24h(m[1], m[2], m[3], context);
    } else if ((m = t.take(/\b(\d{1,2})\s*(am|pm)\b/i))) {
      event.time = to24h(m[1], 0, m[2], context);
    }
  }
  t.take(/\b(?:in the\s+)?(?:morning|afternoon|evening)\b(?!\s*(?:every|each))/i);
  t.take(/\bat night\b/i);
  m = t.take(new RegExp(`\\bfor\\s+(half an?|${NUMBER.slice(1, -1)}|\\d+(?:\\.\\d+)?)\\s*(hours?|hrs?|minutes?|mins?)\\b`, 'i'));
  if (m && event.time) {
    const amount = /^half/i.test(m[1]) ? 0.5 : toNumber(m[1]);
    event.endTime = addMinutes(event.time, Math.round(/^h/i.test(m[2]) ? amount * 60 : amount));
  }

  // End date: "until June 30", "for the next 6 weeks"
  m = t.take(/\b(?:until|till|til|through|thru|ending(?:\s+on)?)\s+(.+)$/i);
  if (m) {
    const until = takeDate(makeTaker(m[1]), today, dayFirst);
    if (until?.key) event.until = until.key;
  }
  const forNext = t.take(new RegExp(`\\bfor\\s+(?:the\\s+)?(?:next\\s+)?${NUMBER}\\s+(weeks?|months?)\\b`, 'i'));

  // Repeats
  if (t.take(new RegExp(`\\bevery\\s+other\\b(?=\\s+(?:week|${DAY.slice(1, -1)}))`, 'i')) || t.take(/\bbi-?weekly\b|\bevery\s+(?:two|2)\s+weeks\b/i)) {
    event.repeat = 'weekly';
    event.interval = 2;
  }
  if (t.take(/\b(?:every|each)\s+weekdays?\b|\b(?:on\s+)?weekdays\b|\bmonday\s+(?:to|through|thru|-)\s+friday\b/i)) {
    event.repeat = 'weekly';
    event.weekdays = [1, 2, 3, 4, 5];
  } else if (t.take(/\b(?:every|each|on)\s+weekends?\b|\bweekends\b/i)) {
    event.repeat = 'weekly';
    event.weekdays = [0, 6];
  } else {
    const dayMatches = [...t.rest.matchAll(new RegExp(`\\b${DAY}(s)?\\b`, 'gi'))];
    const recurring =
      dayMatches.length > 0 &&
      (event.repeat === 'weekly' ||
        dayMatches.some((d) => d[2]) ||
        new RegExp(`\\b(?:every|each)\\s+${DAY}`, 'i').test(t.rest));
    if (recurring) {
      event.repeat = 'weekly';
      event.weekdays = [...new Set(dayMatches.map((d) => DAY_NAMES.indexOf(d[1].toLowerCase())))].sort();
      t.take(new RegExp(`\\b(?:(?:every|each|on)\\s+)?${DAY}s?(?:\\s*(?:,|and|&|or)\\s*(?:on\\s+)?${DAY}s?)*`, 'i'));
    }
  }
  if (!event.repeat || (event.repeat === 'weekly' && !event.weekdays && event.interval === 1)) {
    if (t.take(/\b(?:every|each)\s+(?:day|morning|evening|night)\b|\bdaily\b|\beveryday\b/i)) event.repeat = 'daily';
    else if (t.take(/\b(?:every|each)\s+week\b|\bweekly\b/i)) event.repeat = 'weekly';
    else if (t.take(/\b(?:of\s+)?(?:every|each)\s+month\b|\bmonthly\b/i)) event.repeat = 'monthly';
    else if (t.take(/\b(?:every|each)\s+year\b|\byearly\b|\bannually\b/i)) event.repeat = 'yearly';
  }
  t.take(/\bevery\s+week\b/i);
  if ((event.category === 'birthday' || event.category === 'anniversary') && !event.repeat) event.repeat = 'yearly';

  // Date
  m = t.take(/\b(?:born|married)\s+(?:in\s+)?(\d{4})\b/i);
  if (m) event.birthYear = Number(m[1]);
  t.take(/\b(?:starting|beginning|from)\b(?=\s+(?:on\s+|next\s+|this\s+|the\s+)?(?:\d|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december))/i);
  const found = takeDate(t, today, dayFirst);
  if (found?.key) {
    event.date = found.key;
    if (found.year && (event.category === 'birthday' || event.category === 'anniversary')) event.birthYear = found.year;
    if (!found.year && !found.relative && event.date < today && event.repeat !== 'yearly') {
      event.date = found.dayOfMonth ? shiftKey(event.date, { months: 1 }) : shiftKey(event.date, { months: 12 });
    }
  }
  if (!event.date) {
    event.date = today;
    if (!event.repeat || event.repeat === 'yearly') event.missingDate = true;
  }
  if (event.repeat === 'weekly' && !event.weekdays) event.weekdays = [fromKey(event.date).getDay()];
  if (event.repeat === 'weekly' && event.weekdays) {
    // Start on the first matching day so the event doesn't appear before it should
    for (let i = 0; i < 7 && !event.weekdays.includes(fromKey(event.date).getDay()); i++) event.date = shiftKey(event.date, { days: 1 });
  }
  while (event.until && event.until < event.date) event.until = shiftKey(event.until, { months: 12 });
  if (forNext && !event.until) {
    const n = toNumber(forNext[1]);
    event.until = /^month/i.test(forNext[2]) ? shiftKey(event.date, { months: n }) : shiftKey(event.date, { days: n * 7 - 1 });
  }

  event.title = cleanTitle(t.rest, event.category);
  return event;
}

// Returns a list of events found in the text (one per sentence)
// single: read the whole text as one item (used for text messages) and title it from its first sentence
export function parseEvents(text, { now = new Date(), dayFirst = false, single = false } = {}) {
  const today = toKey(now);
  if (single) {
    const event = parseSentence(normalize(text).replace(/\s+/g, ' '), today, dayFirst);
    const first = event.title.split(/[.!?]+(?:\s+|$)/).find((part) => /[a-z]/i.test(part));
    event.title = cleanTitle(first ?? '', event.category);
    return [event];
  }
  return normalize(text)
    .split(/[.!?;\n]+|\s+(?:and then|and also|also)\s+/i)
    .map((s) => s.trim())
    .filter((s) => /[a-z]/i.test(s))
    .map((s) => parseSentence(s, today, dayFirst));
}

// True when dates like 3/4 mean 3 April (most countries) rather than March 4 (US)
export function prefersDayFirst() {
  try {
    const sample = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'numeric' }).formatToParts(new Date(2000, 0, 31));
    return sample.findIndex((p) => p.type === 'day') < sample.findIndex((p) => p.type === 'month');
  } catch {
    return false;
  }
}
