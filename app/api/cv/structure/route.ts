/*
 * WorkZo AI - /api/cv/structure
 *
 * This endpoint is a thin alias for the canonical CV pipeline implemented in
 * app/api/cv/route.ts. Next.js requires route-segment configuration exports
 * to be declared as static literals in the route file where they are used;
 * runtime, dynamic, and maxDuration therefore must not be re-exported.
 */

import { POST as handleCvPost } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = handleCvPost;
