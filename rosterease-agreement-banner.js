/* ---------------------------------------------------------------------------
   RosterEase — "you haven't signed the agreement yet" profile banner
   Paste into the RosterEase app (the Cloud Run / Firebase Studio project).

   The signing page (sprucesaustralia.github.io/BellaMarequiz/agreement.html)
   writes to the SAME Realtime Database the app already uses, under the
   cleaner's own profile node. Nothing new to configure.

   WHAT IT WRITES  —  teamData/{staffId}
     agreementSigned    true
     agreementSignedAt  "2026-09-19T03:56:27.163Z"   ISO
     agreementVersion   "v1.0-2026-09-19"
     agreementName      "Julius Alejandre"
     agreement          { fullName, signedAt, signedAtQld, signatureImage (PNG
                          data URL), sectionsRead[], acknowledged{...},
                          version, employmentType, userAgent }
     ackPayment / ackVariable / ackContractor / ackTimezone   all set true

   NOTE: the database rules reject writes to any NEW top-level key, which is
   why everything lives under teamData. (That is also why the old sign box on
   payments.html, which wrote to `onboarding-signatures`, never saved a single
   signature — every write was PERMISSION_DENIED, silently.)
--------------------------------------------------------------------------- */

export const AGREEMENT_VERSION = 'v1.0-2026-09-19';
export const AGREEMENT_LAUNCH  = '2026-09-19T00:00:00+10:00';
export const SIGN_WINDOW_DAYS  = 7;
export const AGREEMENT_URL     = 'https://sprucesaustralia.github.io/BellaMarequiz/agreement.html';

/**
 * The single source of truth for "has this person signed, and are they late".
 * @param {object} staff  the teamData/{id} record
 */
export function agreementState(staff) {
  const signed   = !!staff?.agreementSigned && staff?.agreementVersion === AGREEMENT_VERSION;
  const joined   = staff?.createdAt ? new Date(staff.createdAt).getTime() : 0;
  const launch   = new Date(AGREEMENT_LAUNCH).getTime();
  // clock starts when they joined OR when the agreement went live, whichever is later,
  // so someone already on the team is never instantly overdue
  const deadline = Math.max(joined, launch) + SIGN_WINDOW_DAYS * 86400000;
  const daysLeft = Math.ceil((deadline - Date.now()) / 86400000);

  return {
    signed,
    daysLeft,
    overdue: !signed && daysLeft <= 0,
    // TRUE = do not give this person rooms
    blockAllocation: !signed && daysLeft <= 0,
    signedAt: staff?.agreementSignedAt || null,
    link: `${AGREEMENT_URL}?staff=${encodeURIComponent(staff.id)}`
  };
}

/* ----------------------- React banner for the profile ---------------------- */

export function AgreementBanner({ staff }) {
  const s = agreementState(staff);
  if (s.signed) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
        <span>✓</span>
        <span>Team agreement signed {new Date(s.signedAt).toLocaleDateString('en-AU')}</span>
      </div>
    );
  }
  return (
    <a href={s.link} target="_blank" rel="noopener"
       className={`block rounded-lg border-2 px-4 py-3 ${s.overdue
         ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'}`}>
      <p className={`font-bold ${s.overdue ? 'text-red-900' : 'text-amber-900'}`}>
        {s.overdue
          ? 'You have not signed the team agreement'
          : `Sign the team agreement — ${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left`}
      </p>
      <p className={`text-sm mt-0.5 ${s.overdue ? 'text-red-800' : 'text-amber-800'}`}>
        {s.overdue
          ? 'Rooms cannot be allocated to you until it is signed. Tap to sign now.'
          : 'Tap to read and sign. Takes about five minutes.'}
      </p>
    </a>
  );
}

/* ------------------- allocation guard (roster / auto-assign) --------------- */
/**
 * Drop into wherever cleaners are chosen for a day.
 *   const eligible = staffList.filter(canBeAllocated);
 */
export function canBeAllocated(staff) {
  return !agreementState(staff).blockAllocation;
}

/* ------------------------- admin list, if useful --------------------------- */
export function unsignedStaff(teamData) {
  return Object.values(teamData || {})
    .filter(s => s && typeof s === 'object' && (s.fullName || s.name) && !s.isArchived && !s.isHidden)
    .map(s => ({ ...s, ...agreementState(s) }))
    .filter(s => !s.signed)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
