'use client';
import { useTranslations } from 'next-intl';
import { expiryInfo } from './utils';

// Category display label: global categories translate via their stable id
// (Categories.* keys); user-created ones fall back to the label stored in the DB.
export function useCatLabel() {
  const t = useTranslations('Categories');
  return (id, cat) => (id && t.has(id) ? t(id) : (cat?.label ?? id ?? ''));
}

// Expiry status text with ICU plurals; mirrors the old wksUntil/wksShort
// semantics (<7 days → days, otherwise weeks; overdue under a week → days).
export function useExpiryText() {
  const t = useTranslations('Expiry');
  return (dateStr, { short = false } = {}) => {
    const { overdue, days, weeks } = expiryInfo(dateStr);
    if (overdue) {
      if (weeks === 0) return t(short ? 'sDaysOver' : 'daysOver', { days });
      return t(short ? 'sWeeksOver' : 'weeksOver', { weeks });
    }
    if (days < 7) return t(short ? 'sDays' : 'daysLeft', { days });
    return t(short ? 'sWeeks' : 'weeksLeft', { weeks });
  };
}

// Display fallback for calendar event titles. Untitled events are stored with
// an empty title (legacy rows may hold the literal 'Brez naslova') — translated
// at render time in the viewer's locale. `t` must be scoped to 'Calendar'.
export const eventTitle = (title, t) => (!title || title === 'Brez naslova' ? t('noTitle') : title);

// Known Slovenian `raise exception` messages from the DB RPC functions,
// mapped to message keys. Unknown messages pass through as raw text
// (Toaster and page.js render unmapped strings verbatim).
const RPC_ERRORS = {
  'Neveljavna koda': 'Errors.rpc.invalidCode',
  'Član ne obstaja': 'Errors.rpc.memberMissing',
  'Samo lastnik lahko odstrani člane': 'Errors.rpc.ownerOnly',
  'Lastnika ni mogoče odstraniti': 'Errors.rpc.cannotRemoveOwner',
  'Ne moreš ustvariti gospodinjstva za drugega uporabnika': 'Errors.rpc.wrongUserCreate',
  'Ne moreš pridružiti drugega uporabnika': 'Errors.rpc.wrongUserJoin',
};
export const rpcErrorKey = (msg) => RPC_ERRORS[msg] ?? null;
