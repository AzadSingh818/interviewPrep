import { env } from '@/lib/env';

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_TIMEOUT_MS = 15_000;

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

export async function fetchGroqChatCompletion(
  body: Record<string, unknown>,
  timeoutMs = DEFAULT_GROQ_TIMEOUT_MS,
): Promise<Response> {
  return fetch(GROQ_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(body),
  });
}
