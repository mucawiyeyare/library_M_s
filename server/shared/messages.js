import { pick } from './localized.js'

// Applicant-facing messages in each supported language (English is the fallback).
const messages = {
  approved: {
    subject: {
      en: 'Your library membership was approved',
      so: 'Xubinnimadaada maktabadda waa la ogolaaday',
      ar: 'تمت الموافقة على عضويتك في المكتبة',
    },
    body: {
      en: 'Welcome! Your membership application was approved. Set your password using this link (valid for 7 days):',
      so: 'Soo dhawow! Codsigaaga xubinnimo waa la ogolaaday. Samee erayga sirta ah adigoo isticmaalaya xiriirkan (wuxuu shaqaynayaa 7 maalmood):',
      ar: 'مرحبًا بك! تمت الموافقة على طلب عضويتك. عيّن كلمة المرور من خلال هذا الرابط (صالح لمدة 7 أيام):',
    },
    notice: {
      en: 'Your membership was approved. Welcome to the library!',
      so: 'Xubinnimadaada waa la ogolaaday. Ku soo dhawow maktabadda!',
      ar: 'تمت الموافقة على عضويتك. مرحبًا بك في المكتبة!',
    },
  },
  rejected: {
    subject: {
      en: 'About your library membership application',
      so: 'Ku saabsan codsigaaga xubinnimo ee maktabadda',
      ar: 'بخصوص طلب عضويتك في المكتبة',
    },
    body: {
      en: 'Thank you for applying. We could not approve your membership application at this time.',
      so: 'Waad ku mahadsan tahay codsiga. Wakhtigan ma aanaan ogolaan karin codsigaaga xubinnimo.',
      ar: 'شكرًا لتقديمك. لم نتمكن من الموافقة على طلب عضويتك في الوقت الحالي.',
    },
    reason: { en: 'Reason', so: 'Sabab', ar: 'السبب' },
  },
}

export const message = (key, part, lang) => pick(messages[key][part], lang)
