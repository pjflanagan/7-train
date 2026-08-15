import React from 'react';
import { LegalPage } from '@/components/LegalPage/LegalPage';

/** The privacy policy, rendered by `app/privacy/page.tsx`. */
export const PrivacyPage: React.FC = () => (
  <LegalPage title="Privacy policy" lastUpdated="15 August 2026">
    <p>
      7 Train is a personal workout planner built to hold as little of your data as possible.
      There is no application database: your plan lives in your own browser and, if you ask for
      it, in your own Google account.
    </p>

    <h2>What the app stores</h2>
    <ul>
      <li>
        <strong>In your browser.</strong> Your activities, weekly targets and scheduled events
        are saved to this browser&apos;s local storage, along with display settings such as your
        units. Clearing site data removes them.
      </li>
      <li>
        <strong>In your Google account.</strong> If you connect Google Calendar, the app creates
        a calendar it owns inside your account and writes your scheduled events and weekly
        targets there. If you export to Google Sheets, it creates one spreadsheet in your Drive.
      </li>
      <li>
        <strong>In a sign-in cookie.</strong> When you sign in, an encrypted session cookie in
        your browser holds your name, email address, profile picture URL and Google access
        tokens. Nothing about your account is stored on a server.
      </li>
    </ul>

    <h2>Google account access</h2>
    <p>
      Signing in requests only your basic identity — <strong>openid</strong>,{' '}
      <strong>email</strong> and <strong>profile</strong> — so the app can show who you are.
      Integrations are granted separately, one at a time, and only when you turn them on:
    </p>
    <ul>
      <li>
        <strong>calendar.app.created</strong> — read and write access limited to calendars this
        app itself created. It cannot see or change the rest of your calendar.
      </li>
      <li>
        <strong>drive.file</strong> — access limited to the single spreadsheet this app creates.
        It cannot see anything else in your Drive.
      </li>
    </ul>
    <p>
      Data received from Google APIs is used only to provide these features to you. It is never
      sold, never used for advertising, and never shared with anyone else. You can revoke access
      at any time from your{' '}
      <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
        Google account permissions
      </a>{' '}
      page, or by signing out.
    </p>

    <h2>Weather and location</h2>
    <p>
      Day cards can show a forecast. To do that the app asks for a rough location — either your
      browser&apos;s geolocation, if you allow it, or an approximate city looked up from your IP
      address — and sends those coordinates to{' '}
      <a href="https://open-meteo.com" target="_blank" rel="noreferrer">
        Open-Meteo
      </a>{' '}
      for the forecast, and to{' '}
      <a href="https://www.bigdatacloud.com" target="_blank" rel="noreferrer">
        BigDataCloud
      </a>{' '}
      or{' '}
      <a href="https://ipapi.co" target="_blank" rel="noreferrer">
        ipapi.co
      </a>{' '}
      to turn them into a place name. Your location is not stored beyond the life of the
      request.
    </p>

    <h2>Analytics and tracking</h2>
    <p>
      There is no advertising, no analytics product and no cross-site tracking. The only cookie
      the app sets is the sign-in session cookie described above.
    </p>

    <h2>Deleting your data</h2>
    <ul>
      <li>Clear this site&apos;s data in your browser to remove the local plan and settings.</li>
      <li>Sign out to drop the session cookie and its tokens.</li>
      <li>Delete the app&apos;s calendar or exported spreadsheet from your Google account.</li>
      <li>Revoke the app&apos;s access from your Google account permissions page.</li>
    </ul>

    <h2>Children</h2>
    <p>
      The app is not directed at children under 13, and it does not knowingly collect their
      information.
    </p>

    <h2>Changes</h2>
    <p>
      If this policy changes, the date at the top of the page will change with it. Material
      changes to how data is used will be reflected here before they take effect.
    </p>

    <h2>Contact</h2>
    <p>
      Privacy questions can go to{' '}
      <a href="mailto:pjflanagan1@gmail.com">pjflanagan1@gmail.com</a>. See also the{' '}
      <a href="/terms">terms of service</a>.
    </p>
  </LegalPage>
);
