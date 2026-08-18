/**
 * User-facing text, in one place.
 *
 * Not an i18n layer — there is one language here and the ceremony of a
 * framework would cost more than it saves. This exists for three narrower
 * reasons, each of which has already bitten:
 *
 * - **Renames.** `goals` → `targets` had to find every copy of every string by
 *   hand, and missed some: the header button said "My weekly activities" while
 *   the modal it opened said "My activities", and a Strava toast pointed users
 *   at a third name again.
 * - **Exhaustiveness.** The status label maps used to be `Record<string,
 *   string>` declared at the top of whichever component rendered them, so a
 *   typo'd key type-checked perfectly happily and rendered a blank span. Keyed
 *   by their status union, a missing state is now a compile error.
 * - **The sentence-case rule.** `AGENTS.md` requires it and nothing enforced
 *   it. `copy.test.ts` walks this object and fails on title case.
 *
 * What does *not* belong here: `error:` strings in `app/api/` route handlers.
 * Those are diagnostics read by the code that handles them, and hoisting them
 * away from the branch that explains them makes both harder to follow.
 *
 * Sentence case throughout. Proper nouns ("Google Calendar", "Strava") and
 * acronyms ("CSV") keep their capitals; nothing else does.
 */

import type { CalendarSyncStatus } from '@/hooks/useCalendarSyncStatus';
import type { StravaSyncStatus } from '@/hooks/useStravaStatus';
import type { StravaSportGroup } from '@/lib/stravaSports';

/**
 * The one name for the template set of activities, used by the header button,
 * the modal it opens, the fill-week source list and the Strava toast that tells
 * someone where to go. It was four different strings.
 */
const MY_ACTIVITIES = 'My activities';

export const COPY = {
  nav: {
    myActivities: MY_ACTIVITIES,
    links: 'Links',
    logoTitle: '7 train',
  },

  account: {
    menuLabel: 'Account',
    signIn: 'Sign in with Google',
    integrations: 'Integrations',
    settings: 'Settings',
    terms: 'Terms of service',
    privacy: 'Privacy policy',
    logout: 'Logout',
  },

  /** The header pill. One story told in order: held, sent, confirmed. */
  sync: {
    label: {
      off: '',
      pending: 'Unsaved changes',
      pulling: 'Syncing…',
      syncing: 'Syncing…',
      synced: 'Saved',
      error: 'Could not save',
    } satisfies Record<CalendarSyncStatus, string>,
    /**
     * The pill is a button, so the title says what pressing it does rather
     * than restating the label beside it.
     */
    action: 'Press to check your calendar for changes',
    actionError: 'Could not save — press to try again',
  },

  calendar: {
    sectionTitle: 'Google Calendar',
    /** The header's way out to where the plan is really kept. */
    open: 'Open Google Calendar',
    /** Shown before Google has told us what the calendar is called. */
    unnamed: 'Your workouts calendar',
    creating: 'Setting one up…',
    creatingHint: 'Making a calendar in Google…',
    description:
      'Your plan is saved in this Google calendar. Changes to time and duration made in Google Calendar show up here.',
    pullFailed:
      'The last sync did not go through. Your plan is safe on this device — try again from the header.',
    createFailed: 'Could not set up your Workouts calendar',
    syncFailed: 'Could not sync your Workouts calendar',
    updateFailed: 'Could not update your Workouts calendar',
  },

  strava: {
    sectionTitle: 'Strava',
    connect: 'Connect',
    disconnect: 'Disconnect',
    syncNow: 'Sync now',
    notConnected: 'Bring in your recorded workouts',
    blurb:
      'Connect Strava to automatically update your calendar with your workout recordings.',
    label: {
      off: '',
      waiting: 'Waiting for your calendar…',
      reading: 'Reading Strava…',
      synced: 'Up to date',
      error: 'Could not read Strava',
    } satisfies Record<StravaSyncStatus, string>,
    /** How the trip through Strava's consent screen went. */
    outcome: {
      connected: { message: 'Strava connected', isError: false },
      denied: { message: 'Strava was not connected', isError: true },
      scope: { message: 'Strava needs permission to read your activities', isError: true },
      failed: { message: 'Could not connect Strava', isError: true },
    } satisfies Record<string, { message: string; isError: boolean }>,
    readFailed: 'Could not read your Strava activities',
    /**
     * A recording no activity answers to used to vanish without a word, which
     * reads as Strava being broken. Name the sport, because the fix is to add
     * it to an activity and nobody can guess that from silence.
     */
    noActivityFor: (sports: string) => `No activity for ${sports}`,
    noActivityHint: `Add the sport to an activity under "${MY_ACTIVITIES}" to bring these in.`,
    sportGroup: {
      Run: 'On foot',
      Ride: 'On wheels',
      Water: 'On water',
      Winter: 'On snow and ice',
      Gym: 'Indoors',
      Racquet: 'Racquet sports',
      Other: 'Everything else',
    } satisfies Record<StravaSportGroup, string>,
  },

  sheets: {
    sectionTitle: 'Google Sheets',
    exportNow: 'Export now',
    exporting: 'Exporting…',
    exported: 'History exported to Google Sheets',
    failed: 'Could not write to Google Sheets',
  },

  integrations: {
    title: 'Integrations',
    signInTitle: 'Sign in',
    checking: 'Checking your sign in…',
    tab: {
      google: 'Google',
      strava: 'Strava',
    },
    /** Shown on the Strava tab when there is no connection yet. */
    stravaNotConnected: 'Not connected',
    signInBlurb:
      'Sign in to keep your plan in Google Calendar, so it follows you between devices. Your plan stays on this device either way.',
    reauth: 'Google access expired. Sign in again to restore it.',
    reconnect: 'Reconnect',
    connect: 'Connect',
  },

  user: {
    loadFailed: 'Could not load your settings from the server',
  },

  activities: {
    modalTitle: MY_ACTIVITIES,
    namePlaceholder: 'e.g. Running, Lifting',
    /** Each example is its own value, so each gets one capital, not two. */
    workoutTypePlaceholder: 'e.g. Long run, Recovery',
    unitPlaceholder: 'e.g. miles',
    edit: 'Edit',
    delete: 'Delete',
    deleteActivity: 'Delete activity',
  },

  targets: {
    add: 'Add target',
    addLong: 'Add new target',
    addFromDefault: 'Add my weekly targets',
    addFromPrevious: "Add last week's targets",
    remove: 'Remove target',
    removeConfirm: 'Remove',
    scrollLeft: 'Scroll targets left',
    scrollRight: 'Scroll targets right',
    links: 'Links',
  },

  week: {
    progress: 'Week progress',
    fill: 'Fill week',
    clear: 'Clear week',
    clearMessage: 'This will remove all events and notes from this week. Are you sure?',
    confirm: 'Confirm',
    notesPlaceholder: 'Notes…',
    showEarlier: 'Show more past weeks',
    showLater: 'Show more upcoming weeks',
    jumpToToday: 'Jump to today',
    source: {
      current: 'Current week',
      previous: 'Previous week',
      default: MY_ACTIVITIES,
    },
    copyActivities: 'Activities and targets',
    copySchedule: 'Schedule',
    copyNotes: 'Notes',
  },

  events: {
    add: 'Add an event',
    /** The day feed's slot says what it is; the week board's is wordless. */
    addLabel: 'Add a workout',
    remove: 'Remove event',
    /** The picker has nothing to list because the week has no targets yet. */
    noActivities: 'No activities on this week yet',
    estimated: 'Estimated',
    lengthLabel: 'Length, in minutes',
    /** The unit beside a length field, short enough to sit on a card. */
    minutes: 'mins',
    viewOnStrava: 'View on Strava',
    /** The day feed's editor, which is how a phone changes a workout. */
    editTitle: 'Edit workout',
    date: 'Date',
    workoutType: 'Type',
    /** The row labels in that editor: how much of the workout, and how long. */
    distance: 'Distance',
    length: 'Length',
    noType: 'No type',
    done: 'Done',
  },

  links: {
    modalTitle: 'Links',
    titlePlaceholder: 'Link title',
    urlPlaceholder: 'URL',
    delete: 'Delete link',
    bookmarks: 'Bookmarks',
  },

  settings: {
    title: 'Settings',
    weekStartsOn: 'Week starts on',
    confirm: {
      reset: {
        title: 'Full reset',
        message:
          'Are you sure you want to completely reset the app? This will erase all activities, events, history, and links.',
      },
      clear: {
        title: 'Clear all data',
        message:
          'Are you sure you want to erase everything? Every activity, event, note, target, link, and history entry will be gone, with nothing put back in their place. This cannot be undone. Your Workouts calendar in Google is left as it is.',
      },
      import: {
        title: 'Import backup',
        message:
          'Importing replaces everything currently in the app with the contents of the backup file. This cannot be undone.',
      },
    },
  },

  modal: {
    close: 'Close modal',
  },
} as const;
