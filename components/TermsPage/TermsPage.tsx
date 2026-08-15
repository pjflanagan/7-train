import React from 'react';
import { LegalPage } from '@/components/LegalPage/LegalPage';

/** The terms of service, rendered by `app/terms/page.tsx`. */
export const TermsPage: React.FC = () => (
  <LegalPage title="Terms of service" lastUpdated="15 August 2026">
    <p>
      7 Train is a personal workout planner. By using it you agree to the terms below. If you
      do not agree, please stop using the app.
    </p>

    <h2>The service</h2>
    <p>
      7 Train lets you define activities, set weekly targets, and schedule events against them.
      It is offered free of charge, as-is, and may change or stop being available at any time.
      There is no uptime commitment.
    </p>

    <h2>Your account</h2>
    <p>
      Signing in is optional and happens through Google. You are responsible for your Google
      account and for anything done through it in this app. You can sign out at any time, and
      you can revoke the app&apos;s access from your{' '}
      <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
        Google account permissions
      </a>{' '}
      page.
    </p>

    <h2>Your content</h2>
    <p>
      Your plan — activities, targets and scheduled events — is yours. You keep all rights to
      it. It lives in your browser, and, if you connect the Google Calendar integration, in a
      calendar that this app creates inside your own Google account. Deleting your browser
      storage or that calendar deletes the data; keeping your own backups is up to you.
    </p>

    <h2>Acceptable use</h2>
    <ul>
      <li>Do not use the app to break the law or to infringe anyone&apos;s rights.</li>
      <li>
        Do not attempt to disrupt the service, probe it for vulnerabilities without permission,
        or access other people&apos;s data.
      </li>
      <li>Do not resell or rebrand the service as your own.</li>
    </ul>

    <h2>Not health advice</h2>
    <p>
      7 Train is a scheduling tool, not a coach and not a medical device. Nothing in it is
      medical, fitness or nutritional advice. Training carries risk of injury — talk to a
      qualified professional before starting or changing a training plan, and train within your
      own limits.
    </p>

    <h2>Third-party services</h2>
    <p>
      The app talks to services it does not control, including Google (sign-in, Calendar,
      Sheets) and a weather provider. Their own terms govern your use of them, and this app is
      not responsible for their behaviour or availability.
    </p>

    <h2>Disclaimer and liability</h2>
    <p>
      The service is provided &quot;as is&quot;, without warranties of any kind, express or
      implied. To the fullest extent the law allows, 7 Train and its maintainer are not liable
      for any indirect, incidental or consequential damages, for lost data, or for any injury
      arising from training you planned with the app.
    </p>

    <h2>Changes</h2>
    <p>
      These terms may be updated. The date at the top of this page shows when they last
      changed, and continuing to use the app after a change means you accept the new terms.
    </p>

    <h2>Contact</h2>
    <p>
      Questions about these terms can go to{' '}
      <a href="mailto:pjflanagan1@gmail.com">pjflanagan1@gmail.com</a>. See also the{' '}
      <a href="/privacy">privacy policy</a>.
    </p>
  </LegalPage>
);
