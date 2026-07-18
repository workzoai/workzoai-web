/**
 * app/api/stripe/webhook/route.ts
 *
 * LEGACY Stripe webhook URL, kept alive only so an endpoint already registered
 * in the Stripe dashboard does not start 404ing mid-migration.
 *
 * It shares the exact implementation used by the canonical /api/webhooks/stripe
 * route, so both behave identically. Register only ONE of the two in Stripe:
 * if both are registered, every event is delivered and processed twice.
 *
 * Once the Stripe dashboard points at /api/webhooks/stripe, delete this file.
 */

import { handleStripeWebhook } from "@/lib/stripe/webhookHandler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = handleStripeWebhook;
