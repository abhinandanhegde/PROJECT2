# Shared Seed Data for T2 Bug Tracker

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
    {"id": "b0000000-0000-0000-0000-000000000001", "name": "T2 Bug Tracker",    "description": "Core bug tracking platform"},
    {"id": "b0000000-0000-0000-0000-000000000002", "name": "T2 Mobile App",     "description": "iOS / Android companion app"},
    {"id": "b0000000-0000-0000-0000-000000000003", "name": "T2 API Gateway",    "description": "Public API gateway and rate-limiter"},
    {"id": "b0000000-0000-0000-0000-000000000004", "name": "T2 Design System",   "description": "Shared UI components and tokens"},
]

ROLES = ["ADMIN", "DEVELOPER", "QA", "REPORTER"]

COMPONENTS_PER_PROJECT = [
    "Frontend", "Backend", "Database", "DevOps", "Mobile", "API",
]

BUG_TEMPLATES = [
    # NEW — freshly filed
    (
        "Application crashes on login",
        "The application throws an unhandled exception and terminates when a user attempts to log in with special characters in the password field. Stack trace points to the authentication middleware. Affects all browsers.",
        "BLOCKER", "P1", "NEW", None,
    ),
    (
        "Bug count in project stats is incorrect",
        "The project statistics page shows 47 open bugs but the actual list returns 52. The count query appears to exclude REOPENED status.",
        "MAJOR", "P2", "NEW", None,
    ),
    (
        "Comments render markdown inconsistently",
        "Bold text (**word**) renders correctly in the comment preview but shows raw asterisks after saving.",
        "NORMAL", "P3", "NEW", None,
    ),
    (
        "Component library update breaks TypeScript imports",
        "After upgrading the shared component library to v3.2, all TypeScript imports fail with 'Cannot find module'. The v3.x release changed the export map.",
        "CRITICAL", "P1", "NEW", None,
    ),
    (
        "Export to CSV fails for large datasets",
        "Exporting 10,000+ bugs causes the process to run out of memory and return a 500 error.",
        "MAJOR", "P2", "NEW", None,
    ),
    (
        "Dark mode toggle reverts after page reload",
        "The theme choice is stored in memory only; reloading the page resets to the system preference.",
        "MINOR", "P4", "NEW", None,
    ),
    (
        "Onboarding wizard skips the project setup step",
        "When onboarding a new team, the 'create your first project' step is skipped entirely if the user presses Enter too fast.",
        "MINOR", "P4", "NEW", None,
    ),

    # CONFIRMED — reproduced
    (
        "Security: JWT tokens not invalidated on logout",
        "After logout, previously issued JWT tokens remain valid until expiry. An attacker with a stolen token can continue accessing protected resources. This is a security vulnerability requiring immediate attention.",
        "CRITICAL", "P1", "CONFIRMED", None,
    ),
    (
        "Dashboard load time exceeds 8 seconds",
        "The main dashboard takes 8-12 seconds to render on projects with more than 200 bugs. Network waterfall shows the statistics endpoint is the bottleneck.",
        "MAJOR", "P2", "CONFIRMED", None,
    ),
    (
        "Color contrast fails WCAG AA on status badges",
        "The status badge colors (light green for RESOLVED, light yellow for IN_PROGRESS) do not meet the 4.5:1 contrast ratio required by WCAG AA.",
        "MINOR", "P4", "CONFIRMED", None,
    ),
    (
        "Keyboard navigation skips comment form",
        "Tab navigation on the bug detail page jumps from the description to the submit button, bypassing the comment textarea entirely.",
        "MAJOR", "P2", "CONFIRMED", None,
    ),
    (
        "Timezone offset computed incorrectly for UTC+5:30",
        "Issues created close to midnight report the previous day's date for users in IST.",
        "NORMAL", "P3", "CONFIRMED", None,
    ),

    # IN_PROGRESS — being fixed
    (
        "Data loss on concurrent profile updates",
        "When two browser tabs update the user profile simultaneously, the second write silently overwrites the first without warning. Users lose data without any indication.",
        "CRITICAL", "P1", "IN_PROGRESS", None,
    ),
    (
        "Search returns duplicate results",
        "Using the global search with terms that match both title and description causes the same bug to appear twice in results.",
        "NORMAL", "P3", "IN_PROGRESS", None,
    ),
    (
        "Payload size limit too low for bulk import",
        "Bulk import rejects valid payloads above 1 MB. Raising the limit and switching to streaming.",
        "MAJOR", "P2", "IN_PROGRESS", None,
    ),
    (
        "Webhook retries never fire on 429 responses",
        "Delivery attempts stop after the first rate-limit response; retry count is not incremented.",
        "NORMAL", "P3", "IN_PROGRESS", None,
    ),

    # RESOLVED — fixed / declined (carries a resolution)
    (
        "No notification sent when bug is assigned",
        "When a developer is assigned to a bug, they receive no email or in-app notification. They only discover the assignment by checking their dashboard.",
        "NORMAL", "P3", "RESOLVED", "FIXED",
    ),
    (
        "Database connection pool exhaustion under load",
        "Max connections reached during peak hour benchmarks. Pool size and idle timeout were tuned.",
        "CRITICAL", "P1", "RESOLVED", "FIXED",
    ),
    (
        "Animated background causes GPU fan spin on laptops",
        "The parallax hero animation pinned the GPU at 100%. Removed animation from reduced-motion users and idle tabs.",
        "TRIVIAL", "P5", "RESOLVED", "WONT_FIX",
    ),
    (
        "Duplicate issue reports about missing pagination",
        "Several reports describe the same missing pagination on the audit log. Same root cause.",
        "MINOR", "P4", "RESOLVED", "DUPLICATE",
    ),
    (
        "Reports page renders zero for empty components",
        "A component with no bugs displayed 0/open/0 split instead of a blank state. Behavior is intended, not a bug.",
        "MINOR", "P4", "RESOLVED", "INVALID",
    ),

    # VERIFIED — QA confirmed the fix
    (
        "Mobile: buttons misaligned on small screens",
        "On screens narrower than 375px, the action buttons on the bug detail page overlap and are not tappable.",
        "MINOR", "P4", "VERIFIED", "FIXED",
    ),
    (
        "Login session survives browser crash unexpectedly",
        "After a hard browser kill, the session cookie kept the user signed in for days. Now capped at 8 hours.",
        "MAJOR", "P2", "VERIFIED", "FIXED",
    ),
    (
        "Stale cache returned after quick re-navigation",
        "Navigating back to the issue list within 5 seconds showed seconds-old data. Cache invalidation confirmed working.",
        "NORMAL", "P3", "VERIFIED", "FIXED",
    ),

    # CLOSED — done
    (
        "Typo in 404 error message",
        "The 404 page displays 'Resourse not found' instead of 'Resource not found'.",
        "TRIVIAL", "P5", "CLOSED", "FIXED",
    ),
    (
        "Signup form allows duplicate emails",
        "The email field accepted duplicate addresses, leading to duplicate user records on double-submit.",
        "MAJOR", "P2", "CLOSED", "FIXED",
    ),
    (
        "Milestone progress bar always shows 100%",
        "Milestones with any closed issue rendered a full progress bar due to an off-by-one in the total calculation.",
        "NORMAL", "P3", "CLOSED", "FIXED",
    ),

    # REOPENED — regressions / came back
    (
        "API rate limiter allows burst of 500 requests",
        "The rate limiter is configured for 100 req/min but a burst of 500 requests in 10 seconds went through without being throttled.",
        "MAJOR", "P2", "REOPENED", None,
    ),
    (
        "Recovered notification bug reappears after deploy",
        "Fix for assignment notifications worked in staging but the emails stopped again after the v3.0.1 deploy.",
        "NORMAL", "P3", "REOPENED", None,
    ),
]

COMMENTS = [
    "I can reproduce this issue consistently on Chrome 120 and Firefox 121.",
    "This was introduced in the v2.4 release — the previous version worked correctly.",
    "Seems related to the recent Supabase migration. Checking the query plan now.",
    "Adding stack trace from the error logs for additional context.",
    "This affects all users on the Pro plan. Free tier appears unaffected.",
    "Workaround: clear browser cache and hard-reload the page.",
    "Assigned to the backend team for root-cause investigation.",
    "Root cause identified — a missing null check in the parser. PR incoming.",
    "Ready for QA review. Fix is on the `fix/login-crash` branch.",
    "Verified fix in the staging environment. Closing after 24h soak test.",
    "The fix needs a database migration. Scheduling for the next maintenance window.",
    "Re-tested after the fix — all 12 test cases pass.",
    "This is a duplicate of an existing ticket. Linking the two.",
    "Escalating to P1 based on customer impact report received today.",
    "Regression confirmed after the v3.0.1 deploy. Reopening.",
    "Confirms our instrumentation — the 95th percentile p95 latency is now under 400ms.",
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
