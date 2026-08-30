# Shared Seed Data for T2 Bug Tracker
#
# Each project gets its OWN thematic backlog (web / mobile / API / design),
# so the demo looks representative instead of repetitive. Entries are ordered
# new->triaged->in progress->verified->closed so the dashboard triage queue
# surfaces the interesting open work.

USERS = [
    {"id": "a0000000-0000-0000-0000-000000000001", "email": "alice@example.com",   "display_name": "Alice Chen"},
    {"id": "a0000000-0000-0000-0000-000000000002", "email": "bob@example.com",     "display_name": "Bob Martinez"},
    {"id": "a0000000-0000-0000-0000-000000000003", "email": "carol@example.com",   "display_name": "Carol Johnson"},
    {"id": "a0000000-0000-0000-0000-000000000004", "email": "dave@example.com",    "display_name": "Dave Kim"},
    {"id": "a0000000-0000-0000-0000-000000000005", "email": "eve@example.com",     "display_name": "Eve Nakamura"},
    {"id": "a0000000-0000-0000-0000-000000000006", "email": "frank@example.com",   "display_name": "Frank Alvarez"},
    {"id": "a0000000-0000-0000-0000-000000000007", "email": "grace@example.com",   "display_name": "Grace Liu"},
    {"id": "a0000000-0000-0000-0000-000000000008", "email": "henry@example.com",   "display_name": "Henry Osei"},
]

PROJECTS = [
    {"id": "b0000000-0000-0000-0000-000000000001", "name": "T2 Bug Tracker",    "description": "Core web platform for tracking, triaging and resolving bugs"},
    {"id": "b0000000-0000-0000-0000-000000000002", "name": "T2 Mobile App",     "description": "iOS / Android companion with offline sync and push"},
    {"id": "b0000000-0000-0000-0000-000000000003", "name": "T2 API Gateway",    "description": "Public API gateway, rate-limiter and webhook delivery"},
    {"id": "b0000000-0000-0000-0000-000000000004", "name": "T2 Design System",   "description": "Shared UI components, tokens and accessibility patterns"},
]

ROLES = ["ADMIN", "DEVELOPER", "QA", "REPORTER"]

# Which team works on which project. Keeps memberships realistic: different
# people, different projects, different per-project member counts. The demo
# user is ALWAYS a member and ADMIN on every project (added in demo.py), so the
# one-click demo login keeps working everywhere.
PROJECT_MEMBERS = {
    "b0000000-0000-0000-0000-000000000001": [  # T2 Bug Tracker — the core team
        "a0000000-0000-0000-0000-000000000001",  # Alice Chen
        "a0000000-0000-0000-0000-000000000002",  # Bob Martinez
        "a0000000-0000-0000-0000-000000000003",  # Carol Johnson
        "a0000000-0000-0000-0000-000000000004",  # Dave Kim
        "a0000000-0000-0000-0000-000000000005",  # Eve Nakamura
        "a0000000-0000-0000-0000-000000000006",  # Frank Alvarez
        "a0000000-0000-0000-0000-000000000007",  # Grace Liu
        "a0000000-0000-0000-0000-000000000008",  # Henry Osei
    ],
    "b0000000-0000-0000-0000-000000000002": [  # T2 Mobile App — mobile squad
        "a0000000-0000-0000-0000-000000000002",  # Bob Martinez
        "a0000000-0000-0000-0000-000000000003",  # Carol Johnson
        "a0000000-0000-0000-0000-000000000004",  # Dave Kim
        "a0000000-0000-0000-0000-000000000005",  # Eve Nakamura
    ],
    "b0000000-0000-0000-0000-000000000003": [  # T2 API Gateway — platform team
        "a0000000-0000-0000-0000-000000000001",  # Alice Chen
        "a0000000-0000-0000-0000-000000000004",  # Dave Kim
        "a0000000-0000-0000-0000-000000000005",  # Eve Nakamura
        "a0000000-0000-0000-0000-000000000006",  # Frank Alvarez
        "a0000000-0000-0000-0000-000000000008",  # Henry Osei
    ],
    "b0000000-0000-0000-0000-000000000004": [  # T2 Design System — design/QA
        "a0000000-0000-0000-0000-000000000001",  # Alice Chen
        "a0000000-0000-0000-0000-000000000002",  # Bob Martinez
        "a0000000-0000-0000-0000-000000000003",  # Carol Johnson
        "a0000000-0000-0000-0000-000000000007",  # Grace Liu
    ],
}

COMPONENTS_PER_PROJECT = [
    "Frontend", "Backend", "Database", "DevOps", "Mobile", "API",
]

PROJECT_BUG_TEMPLATES = {
    # ──────────────────────────── Web: T2 Bug Tracker ────────────────────────────
    "b0000000-0000-0000-0000-000000000001": [
        # NEW — freshly filed
        (
            "Application crashes on login with special characters",
            "The app throws an unhandled exception and terminates when a user signs in with special characters in the password field. Stack trace points into the auth middleware; reproduces on Chrome 120, Firefox 121 and Safari 17 on all OSes.",
            "BLOCKER", "P1", "NEW", None,
        ),
        (
            "Checkout freezes after applying a discount code",
            "Entering a promo code on the checkout page spins the spinner forever after the cart totals update. Network tab shows the discount endpoint returns 500 before the UI recovers.",
            "CRITICAL", "P1", "NEW", None,
        ),
        (
            "Bug count in project stats is incorrect",
            "The project statistics page shows 47 open bugs but the list view returns 52. The count query appears to exclude REOPENED status from open totals.",
            "MAJOR", "P2", "NEW", None,
        ),
        (
            "Comments render markdown inconsistently",
            "Bold text (**word**) renders correctly in the comment preview but shows raw asterisks after saving, so reporters see broken formatting on their own posts.",
            "NORMAL", "P3", "NEW", None,
        ),
        (
            "Session expires mid-form and loses draft",
            "Users who type a long bug report, walk away, and come back after the session timeout are silently redirected to login and lose their entire draft.",
            "MAJOR", "P2", "NEW", None,
        ),
        (
            "Dark mode toggle reverts after page reload",
            "The theme choice is stored in memory only; reloading the page resets to the system preference instead of the saved selection.",
            "MINOR", "P4", "NEW", None,
        ),
        (
            "Onboarding wizard skips project setup step",
            "When a new team completes onboarding, the 'create your first project' step is skipped entirely if the user presses Enter too fast between screens.",
            "MINOR", "P4", "NEW", None,
        ),

        # CONFIRMED — reproduced
        (
            "Security: JWT tokens not invalidated on logout",
            "After logout, already-issued JWT access tokens remain valid until expiry. A leaked token from a shared workstation can keep accessing protected project data.",
            "CRITICAL", "P1", "CONFIRMED", None,
        ),
        (
            "Dashboard render exceeds 8 seconds on large projects",
            "The main dashboard takes 8-12s to paint on projects with more than 200 bugs. The network waterfall shows the statistics aggregation endpoint is the bottleneck.",
            "MAJOR", "P2", "CONFIRMED", None,
        ),
        (
            "CSV export silently truncates deep descriptions",
            "Exporting to CSV cuts descriptions with newlines at the first line break, so exported data is incomplete and cannot be re-imported.",
            "NORMAL", "P3", "CONFIRMED", None,
        ),
        (
            "Billable hours clock stops at 99:59",
            "Time entry widget caps at 99:59 even though tracked hours fill the database correctly; durations over 100h display a frozen counter.",
            "MINOR", "P4", "CONFIRMED", None,
        ),
        (
            "Keyboard navigation skips comment form",
            "Tab on the bug detail page jumps from the description straight to the submit button, bypassing the comment textarea entirely.",
            "MAJOR", "P2", "CONFIRMED", None,
        ),
        (
            "Timezone offset wrong for UTC+5:30",
            "Issues created close to midnight report the previous calendar day for users in IST because the offset is applied after rounding.",
            "NORMAL", "P3", "CONFIRMED", None,
        ),

        # IN_PROGRESS — being fixed
        (
            "Data loss on concurrent profile updates",
            "Two browser tabs updating the profile simultaneously: the second write silently overwrites the first with no conflict warning, losing the first edit.",
            "CRITICAL", "P1", "IN_PROGRESS", None,
        ),
        (
            "Search returns duplicate results",
            "Global search terms that match both title and description surface the same bug twice in results because the join fan-out is not deduplicated.",
            "NORMAL", "P3", "IN_PROGRESS", None,
        ),
        (
            "Attachment upload stalls on 2G networks",
            "Uploading a screenshot over throttled connections shows no progress and eventually fails with a generic network error; resumable upload is pending.",
            "MAJOR", "P2", "IN_PROGRESS", None,
        ),
        (
            "Team invite emails land in spam",
            "Invitation emails sent via the transactional provider are consistently classified as spam due to missing DKIM alignment on the shared sending domain.",
            "NORMAL", "P3", "IN_PROGRESS", None,
        ),

        # RESOLVED / VERIFIED / CLOSED
        (
            "No notification when a bug is assigned",
            "When a developer is assigned to a bug they receive no in-app or email notification and only learn about it by refreshing their dashboard.",
            "NORMAL", "P3", "RESOLVED", "FIXED",
        ),
        (
            "Database connection pool exhaustion under load",
            "Peak-hour benchmark exceeded max DB connections; pool sizing and idle timeouts were tuned and load-tested at 2x peak.",
            "CRITICAL", "P1", "RESOLVED", "FIXED",
        ),
        (
            "Reports page shows zero for empty components",
            "A component with no bugs rendered a 0/open/0/resolved split instead of a blank state. Confirmed intended behavior, not a defect.",
            "MINOR", "P4", "RESOLVED", "INVALID",
        ),
        (
            "Duplicated reports about missing pagination",
            "Several tickets describe the same missing pagination on the audit log page; they share a single root cause and are linked.",
            "MINOR", "P4", "RESOLVED", "DUPLICATE",
        ),
        (
            "Animated hero spins GPU fans on laptops",
            "Parallax animation pinned the GPU at 100% on 13\" laptops. Animation now disabled for reduced-motion users and idle tabs.",
            "TRIVIAL", "P5", "RESOLVED", "WONT_FIX",
        ),
        (
            "Login session survives an unexpected browser kill",
            "After a hard browser kill the session cookie kept users signed in for days; capped at 8 hours with an idle-session refresh.",
            "MAJOR", "P2", "VERIFIED", "FIXED",
        ),
        (
            "Stale list shown after quick back-navigation",
            "Navigating back to the issue list within 5 seconds showed seconds-old data. Cache invalidation verified against the fresh query.",
            "NORMAL", "P3", "VERIFIED", "FIXED",
        ),
        (
            "Typo in 404 error message",
            "The not-found page displayed 'Resourse not found' instead of 'Resource not found'.",
            "TRIVIAL", "P5", "CLOSED", "FIXED",
        ),
        (
            "Signup form accepts duplicate emails",
            "Double-submitting the signup form created duplicate user records because the unique index was on the wrong column.",
            "MAJOR", "P2", "CLOSED", "FIXED",
        ),
        (
            "Milestone progress bar always shows 100%",
            "Milestones with any closed issue rendered a full progress bar because the denominator excluded open items.",
            "NORMAL", "P3", "CLOSED", "FIXED",
        ),

        # REOPENED — regressions
        (
            "Watched-issue email regression after v3.0.1",
            "The assignment-notification fix worked in staging, then emails stopped again after the v3.0.1 deploy due to a swapped env flag.",
            "NORMAL", "P3", "REOPENED", None,
        ),
            (
            "Export crashes a second time after reload",
            "The large-export memory fix regressed: exporting with 10k+ bugs again OOMs once additional columns were added to the report.",
            "MAJOR", "P2", "REOPENED", None,
        ),
    ],

    # ──────────────────────────── Mobile: T2 Mobile App ────────────────────────────
    "b0000000-0000-0000-0000-000000000002": [
        # NEW
        (
            "Push notifications arrive 20 minutes late on iOS",
            "Notifications sent through the APNs sandbox surface 15-25 minutes after send on iOS 17 when the app is backgrounded behind other apps.",
            "MAJOR", "P2", "NEW", None,
        ),
        (
            "Offline-created bug never syncs after reconnect",
            "Creating a bug on a plane with no connectivity queues it locally, but reconnection only syncs it if the user opens the exact project screen.",
            "CRITICAL", "P1", "NEW", None,
        ),
        (
            "Keyboard covers the comment field on small phones",
            "On devices under 360dp wide, the on-screen keyboard overlaps the comment input; the field never scrolls into view.",
            "MAJOR", "P2", "NEW", None,
        ),
        (
            "Deep links open the app but ignore the bug id",
            "Opening a push deep-link like t2://bug/abc lands on the home screen instead of the referenced bug because the route param is dropped on cold start.",
            "NORMAL", "P3", "NEW", None,
        ),
        (
            "Screen reader announces buttons in wrong order",
            "TalkBack/VoiceOver order on the bug detail screen reads the status badge before the bug title.",
            "MINOR", "P4", "NEW", None,
        ),

        # CONFIRMED
        (
            "Battery drain while bug list is open",
            "Keeping the list screen open for 30 minutes drains ~8% battery: the live-update websocket stays connected even when the screen is idle.",
            "NORMAL", "P3", "CONFIRMED", None,
        ),
        (
            "Landscape rotation crashes detail view",
            "Rotating to landscape while a comment is uploading crashes the native module with an IndexOutOfBounds in the AV layer.",
            "MAJOR", "P2", "CONFIRMED", None,
        ),
        (
            "Photo picker drops EXIF orientation",
            "Attached photos taken in portrait on Android render sideways because EXIF orientation tags are stripped in the image pipeline.",
            "MINOR", "P4", "CONFIRMED", None,
        ),

        # IN_PROGRESS
        (
            "Swipe-to-refresh conflicts with horizontal gallery",
            "The refresh gesture steals horizontal swipes inside the screenshot gallery, so users cannot scroll images without flicking to refresh.",
            "NORMAL", "P3", "IN_PROGRESS", None,
        ),
        (
            "Older Android versions crash on start",
            "Milestone 28 (Android 9 and below) reports a startup crash from an unsupported ICU API used by the mention autocomplete.",
            "CRITICAL", "P1", "IN_PROGRESS", None,
        ),

        # RESOLVED / VERIFIED / CLOSED
        (
            "Buttons overlap on sub-375px screens",
            "Action buttons on the bug detail screen overlapped and were untappable on narrow devices; gutter widths fixed.",
            "MINOR", "P4", "RESOLVED", "FIXED",
        ),
        (
            "Stale unread badge after reading notifications",
            "The tab badge only cleared after app restart; it now clears when the notifications screen is opened.",
            "NORMAL", "P3", "VERIFIED", "FIXED",
        ),
        (
            "Touch target under 44px for delete action",
            "The delete bug action was 32px tall, failing mobile accessibility guidance; enlarged and verified with axe-mobile.",
            "MINOR", "P4", "RESOLVED", "FIXED",
        ),
        (
            "Duplicate auth failure toasts on login",
            "Failed logins fired both an inline error and a system toast. Intent was toast-only; inline error removed.",
            "TRIVIAL", "P5", "CLOSED", "INVALID",
        ),
    ],

    # ──────────────────────────── API: T2 API Gateway ────────────────────────────
    "b0000000-0000-0000-0000-000000000003": [
        # NEW
        (
            "Rate limiter allows bursts of 500 requests",
            "Configured for 100 req/min, but a burst of 500 requests in 10 seconds passes untouched: the counter resets on every window rollover.",
            "MAJOR", "P2", "NEW", None,
        ),
        (
            "Webhook retries never fire on 429 responses",
            "Delivery attempts stop after the first rate-limit response from the receiver; the retry counter is not incremented, so retries are silently skipped.",
            "NORMAL", "P3", "NEW", None,
        ),
        (
            "Cursor pagination skips records on live insert",
            "Listing bugs with cursor pagination while a new bug is created skips one record because the cursor is computed from an unordered column.",
            "MAJOR", "P2", "NEW", None,
        ),
        (
            "Preflight CORS fails on the images endpoint",
            "POSTs to /v1/images from browser SDKs fail the preflight for the allowed origin set because the path-level CORS headers are missing.",
            "CRITICAL", "P1", "NEW", None,
        ),
        (
            "Webhook payloads older than 24h are dropped silently",
            "If delivery is delayed past 24 hours the payload is discarded with no dead-letter entry, hiding integration failures from customers.",
            "MAJOR", "P2", "NEW", None,
        ),

        # CONFIRMED
        (
            "Idempotency key collisions under concurrency",
            "Two simultaneous requests with the same idempotency key return different responses: the key lookup is not atomic.",
            "CRITICAL", "P1", "CONFIRMED", None,
        ),
        (
            "Refresh token rotation races in SDK",
            "The official SDK rotates refresh tokens in parallel from two tabs, invalidating one token and logging the user out.",
            "MAJOR", "P2", "CONFIRMED", None,
        ),
        (
            "Header over 8KB returns non-JSON error",
            "Requests with composite headers exceeding 8KB get a 431 from the edge as plain text, breaking clients that always parse JSON.",
            "NORMAL", "P3", "CONFIRMED", None,
        ),
        (
            "Unhandled enum values return vague 500",
            "Sending an unknown status value in a PATCH payload surfaces a generic 500 instead of a validation 422 with the offending field.",
            "NORMAL", "P3", "CONFIRMED", None,
        ),

        # IN_PROGRESS
        (
            "Signature verification fails on retried webhooks",
            "Replayed webhooks with a stale timestamp fail HMAC signature checks because the clock-skew window does not allow the 5-minute retry delay.",
            "MAJOR", "P2", "IN_PROGRESS", None,
        ),
        (
            "Gateway stream response buffered in full",
            "SSE and large streaming responses are buffered before relay, adding seconds of latency and spiking memory on big exports.",
            "NORMAL", "P3", "IN_PROGRESS", None,
        ),

        # RESOLVED / VERIFIED / CLOSED
        (
            "Missing idempotency header docs",
            "The API reference did not document the Idempotency-Key header for checkout calls, causing duplicate charges on retry.",
            "MINOR", "P4", "RESOLVED", "FIXED",
        ),
        (
            "Deprecated /v0 endpoints returned 200",
            "Legacy endpoints kept returning 200 with a deprecation body instead of 410 Gone, hiding breaking changes from callers.",
            "NORMAL", "P3", "RESOLVED", "FIXED",
        ),
        (
            "Timeout value below free-plan limit",
            "Free-plan timeout showed 30s in docs but enforced 20s in code; docs corrected to match enforcement.",
            "TRIVIAL", "P5", "CLOSED", "INVALID",
        ),
        (
            "Silent failure when downstream times out",
            "Downstream timeouts returned a 504 with no body, breaking SDKs; a structured error payload was added and verified.",
            "MAJOR", "P2", "VERIFIED", "FIXED",
        ),
    ],

    # ──────────────────────────── Design: T2 Design System ────────────────────────────
    "b0000000-0000-0000-0000-000000000004": [
        # NEW
        (
            "Status badge contrast fails WCAG AA",
            "The light-green RESOLVED and light-yellow IN_PROGRESS badge colors do not meet the 4.5:1 contrast ratio required by WCAG AA.",
            "MINOR", "P4", "NEW", None,
        ),
        (
            "Focus ring invisible on orange primary button",
            "The 2px orange focus ring on the primary button is unreadable against the orange fill for keyboard users.",
            "NORMAL", "P3", "NEW", None,
        ),
        (
            "RTL layouts clip the sidebar labels",
            "Arabic/Hebrew builds clip long sidebar labels because padding and margins are hard-coded left/right instead of logical properties.",
            "MAJOR", "P2", "NEW", None,
        ),
        (
            "Component-library update breaks TS imports",
            "After upgrading the shared library to v3.2 every TypeScript import fails with 'Cannot find module' because the v3 export map is malformed.",
            "CRITICAL", "P1", "NEW", None,
        ),
        (
            "System font renders inconsistently on Windows",
            "Using 'Segoe UI Variable' without a fallback leaves Windows 10 with metrics changes that clip avatar initials.",
            "MINOR", "P4", "NEW", None,
        ),

        # CONFIRMED
        (
            "Dark-mode tokens missing for new surface",
            "The new command-palette surface falls back to light tokens in dark mode, producing a bright flash panel at night.",
            "NORMAL", "P3", "CONFIRMED", None,
        ),
        (
            "Icon set lacks 20px optical sizing",
            "Icons render blurry at 20px because the set only ships 16px and 24px; optical sizing was added to the roadmap.",
            "MINOR", "P4", "CONFIRMED", None,
        ),
        (
            "Tooltip dismissible state conflicts with keyboard",
            "University demos passed, but focus-triggered tooltips trap the Tab key and cannot be dismissed with Escape.",
            "MAJOR", "P2", "CONFIRMED", None,
        ),
        (
            "Spinner on 1Hz displays stutters",
            "The CSS spinner animates at 60 steps/s and stutters visibly on 30Hz and accessibility reduced-motion displays.",
            "NORMAL", "P3", "CONFIRMED", None,
        ),

        # IN_PROGRESS
        (
            "Table headers not sticky on mobile",
            "Wide data tables scroll the header out of view on mobile; sticky headers with shadow separator are in development.",
            "NORMAL", "P3", "IN_PROGRESS", None,
        ),
        (
            "Primary button height inconsistent across breakpoints",
            "The 40px height is overridden to 48px on large screens by an orphaned media query nobody owns.",
            "MINOR", "P4", "IN_PROGRESS", None,
        ),

        # RESOLVED / VERIFIED / CLOSED
        (
            "Toast stacking order unstable",
            "Notifications swapped order on rapid succession because z-index was reassigned per render; stack index is now stable.",
            "NORMAL", "P3", "RESOLVED", "FIXED",
        ),
        (
            "Avatar fallback shows broken image icon",
            "Users without an avatar saw the browser's broken-image glyph; a deterministic initials fallback now renders.",
            "MINOR", "P4", "VERIFIED", "FIXED",
        ),
        (
            "Green success token looked blue on some monitors",
            "The success token shifted toward teal on wide-gamut displays; palette swatch verified under P3 and sRGB.",
            "TRIVIAL", "P5", "CLOSED", "FIXED",
        ),
        (
            "Duplicated accessibility guidance tickets",
            "Several tickets requested the same keyboard-focus outline fix; linked to a single tracking issue.",
            "MINOR", "P4", "RESOLVED", "DUPLICATE",
        ),
    ],
}

COMMENTS = [
    "I can reproduce this issue consistently on Chrome 120 and Firefox 121.",
    "This was introduced in the v2.4 release — the previous version worked correctly.",
    "Seems related to the recent Supabase migration. Checking the query plan now.",
    "Adding the stack trace from the error logs for additional context.",
    "This affects all users on the Pro plan. Free tier appears unaffected.",
    "Workaround: clear browser cache and hard-reload the page.",
    "Assigned to the backend team for root-cause investigation.",
    "Root cause identified — a missing null check in the parser. PR incoming.",
    "Ready for QA review. Fix is on the `fix/login-crash` branch.",
    "Verified fix in the staging environment. Closing after a 24h soak test.",
    "The fix needs a database migration. Scheduling for the next maintenance window.",
    "Re-tested after the fix — all 12 test cases pass.",
    "This is a duplicate of an existing ticket. Linking the two.",
    "Escalating to P1 based on the customer impact report received today.",
    "Regression confirmed after the v3.0.1 deploy. Reopening.",
    "Confirms our instrumentation — p95 latency is now under 400ms.",
    "Can repro on a clean profile, so it is not a cache issue.",
    "Fixed upstream; pulling the change into this sprint's release.",
]

RELATIONSHIP_TYPES = ["blocks", "depends_on", "related_to"]

ACTIVITY_ACTIONS = [
    "BUG_CREATED",
    "BUG_ASSIGNED",
    "BUG_STATUS_CHANGED",
    "BUG_SEVERITY_CHANGED",
    "BUG_PRIORITY_CHANGED",
    "BUG_RESOLVED",
    "BUG_REOPENED",
    "COMMENT_CREATED",
]