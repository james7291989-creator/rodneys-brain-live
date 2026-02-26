import { streamText } from 'ai';
import { google } from '@ai-sdk/google';

export const maxDuration = 30;

export async function POST(req) {
  const { messages } = await req.json();

  const result = streamText({
    model: google('gemini-1.5-pro-latest'),
    system: 'You are Rodneys Brain, an elite 10x senior software engineer. Provide the best production-ready code. Never provide lazy snippets. Write full, secure, bug-free code.',
    messages,
  });

  return result.toDataStreamResponse();
}
