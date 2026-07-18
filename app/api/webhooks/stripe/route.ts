/**
 * app/api/webhooks/stripe/route.ts
 *
 * CANONICAL Stripe webhook URL. Point the Stripe dashboard here.
 *
 * The implementation lives in lib/stripe/webhookHandler.ts and is shared with
 * the legacy /api/stripe/webhook path, so the two can never drift apart again.
 */

import { handleStripeWebhook } from "@/lib/stripe/webhookHandler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = handleStripeWebhook;
