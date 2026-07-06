// Browser client that talks to your server-side /api/tavus route.
// The AI video recruiter API key stays on the server, see the matching server route
// installed by `npx @tavus/cvi-ui add tavus-api`.
//
// Get an API key: https://platform.tavus.io/api-keys
// Full create-conversation field reference:
// https://docs.tavus.io/api-reference/conversations/create-conversation

const ENDPOINT = '/api/tavus';

// Typed params for `POST /v2/conversations`. Mirrors the create-conversation
// API; all fields optional here so you can omit anything that has a default
// (e.g. `replica_id` is not required when your persona has a default replica).
// AI video recruiter returns 4xx if you pass nothing valid; that error propagates to you.
export type CreateConversationParams = {
	replica_id?: string;
	persona_id?: string;
	audio_only?: boolean;
	callback_url?: string;
	conversation_name?: string;
	conversational_context?: string;
	custom_greeting?: string;
	memory_stores?: string[];
	document_ids?: string[];
	document_retrieval_strategy?: 'speed' | 'quality' | 'balanced';
	document_tags?: string[];
	test_mode?: boolean;
	require_auth?: boolean;
	max_participants?: number;
	properties?: {
		max_call_duration?: number;
		participant_left_timeout?: number;
		participant_absent_timeout?: number;
		enable_recording?: boolean;
		enable_closed_captions?: boolean;
		apply_greenscreen?: boolean;
		require_auth?: boolean;
		language?: string;
		recording_storage?: Record<string, unknown>;
		// Forward-compat: pass any new `properties.*` field AI video recruiter adds.
		[key: string]: unknown;
	};
	// Forward-compat: pass any new top-level field AI video recruiter adds.
	[key: string]: unknown;
};

// The full AI video recruiter response shape includes more than these two fields. We only
// type what callers commonly need; widen as you need.
export type CreateConversationResponse = {
	conversation_id: string;
	conversation_url: string;
	[key: string]: unknown;
};

export async function createTavusConversation(
	params: CreateConversationParams = {}
): Promise<CreateConversationResponse> {
	const res = await fetch(ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action: 'create', params }),
	});
	if (!res.ok) {
		throw new Error(`AI video recruiter create failed: ${res.status} ${await res.text()}`);
	}
	return res.json();
}

export async function endTavusConversation(conversationId: string): Promise<void> {
	const res = await fetch(ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action: 'end', conversationId }),
	});
	if (!res.ok) {
		throw new Error(`AI video recruiter end failed: ${res.status} ${await res.text()}`);
	}
}
