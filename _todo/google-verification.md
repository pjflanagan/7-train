# Access blocked: "7Train has not completed the Google verification process"

That error is the OAuth consent screen blocking sign in. Nothing in the app is
wrong. Two different situations produce the same message, and the fix is very
different for each.

---

## First — you probably do not need verification

If you are the only one using this, stay in **Testing** and add yourself as a
test user.

**Google Cloud console → Google Auth Platform → Audience.** This used to live at
_APIs & services → OAuth consent screen_; Google renamed it, so you may see
either depending on how stale your bookmark is. Under **Test users**, click
**Add users** and enter your own Gmail address. Up to 100 accounts, no review,
works immediately.

Which situation you are in depends on the publishing status shown on that page:

| Status            | What the error means                                                              | Fix                                                    |
| ----------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Testing**       | The account you signed in with is not on the test user list. Everyone else is blocked. | Add the account under **Test users**.                  |
| **In production** | A published but unverified app requesting sensitive scopes is hard-blocked.       | Switch back to **Testing**, then add yourself.         |

`_todo/done/2026-08-12-manual-google-setup.md` already covered this in step 2's
"Test users" bullet — this doc is the expanded version for when it actually bit.

### The 7-day refresh token catch

In Testing mode Google expires refresh tokens after **7 days**. Roughly weekly
you will hit the `refresh_failed` path: the warning dot on the header avatar and
the **Reconnect** button in the integrations modal.

That is the code working as designed, but it is why the reconnect flow matters
more for this app than you would expect for something personal. Publishing, once
verified, removes the 7-day expiry.

---

## If you do want other people signing in

Then you go through verification properly.

### 1. Check what tier your scopes are

In the console under **Data Access**, every scope is labelled
_Non-sensitive_ / _Sensitive_ / _Restricted_.

The narrow scopes were chosen deliberately — `calendar.app.created` (only
calendars this app created) and `drive.file` (only files this app created) — and
that choice is what keeps this out of the **Restricted** tier. Restricted would
additionally require a third-party CASA security assessment, which is expensive
and slow.

> Trust the console's own labels over anything written here. Google's scope
> classifications shift, and the console is the live answer.

### 2. Own a domain and verify it

In Google Search Console, using the same account that owns the Cloud project.
It has to match the **Authorized domains** on the consent screen.

### 3. Publish a homepage and a privacy policy

Both on that domain, with the privacy policy linked from the homepage. Google
checks that these are real, reachable, and actually about this app.

**This is the step that usually stalls people.**

### 4. Record a demo video

Unlisted YouTube is fine. It has to show:

- The OAuth consent screen, with the client ID visible in the URL bar.
- Granting each scope.
- The app actually using the data that scope gives it — the Workouts calendar
  filling in, and the spreadsheet export running.

### 5. Write a justification per scope

One or two sentences each on why the app cannot work without it. The narrow
scopes make this easy:

> Creates and manages only the `Workouts` calendar it created; never reads the
> user's other calendars.

### 6. Submit and wait

From the console. Days to several weeks, and reviewers often come back with
questions.

---

## Recommendation

The app works fully signed out and keeps everything in `localStorage` either
way. Testing mode plus a test user list is very likely all this ever needs.

## Also worth doing

- Update `_todo/done/2026-08-12-manual-google-setup.md` with the
  **Google Auth Platform → Audience** rename and the 7-day refresh token
  caveat, so the setup doc does not send you to a console page that no longer
  exists under that name.
