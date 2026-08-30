import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { createUserClient } from "../lib/supabase";
import { buildBusinessSnapshot, buildSystemPrompt } from "../lib/ai";

export const ai = new Hono<{ Bindings: Env; Variables: Variables }>();

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

ai.post("/ask", async (c) => {
  const { businessId, userId } = c.get("auth");
  const body = await c.req.json<{ question: string }>();
  const question = (body.question || "").trim();

  if (!question) return c.json({ error: "Ask a question first" }, 400);
  if (question.length > 500) return c.json({ error: "Question is too long" }, 400);

  const supabase = createUserClient(c.env, c.get("accessToken"));
  const snapshot = await buildBusinessSnapshot(supabase, businessId);
  const systemPrompt = buildSystemPrompt(snapshot);

  let answer: string;
  try {
    const result = await c.env.AI.run(MODEL, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
      max_tokens: 400,
      temperature: 0.2, // low temperature: this is a numbers assistant, not a creative one
    });
    answer = (result as any).response?.trim() || "I couldn't work that out from the current data.";
  } catch (err: any) {
    return c.json({ error: "AI service is temporarily unavailable. Please try again." }, 502);
  }

  // Audit trail: exact data used to produce this answer, for trust & debugging.
  await supabase.from("ai_query_log").insert({
    business_id: businessId,
    user_id: userId,
    question,
    answer,
    data_snapshot: snapshot,
  });

  return c.json({ answer, data_used: snapshot });
});

// Suggested quick questions for the UI
ai.get("/suggestions", async (c) => {
  return c.json({
    suggestions: [
      "How much did I sell today?",
      "How much profit this month?",
      "Who owes me money?",
      "Which products are low on stock?",
      "What happened this month?",
      "What should I focus on today?",
    ],
  });
});
