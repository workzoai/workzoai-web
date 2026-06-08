Add login/logout UI:

1. Add these files:
components/auth/AuthNavButton.tsx
app/logout/route.ts
app/account/page.tsx

2. In your landing page/header component, import:
import AuthNavButton from "@/components/auth/AuthNavButton";

3. Replace the old Login button with:
<AuthNavButton />

This shows Login when logged out, and Account + Logout when logged in.
