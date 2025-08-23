import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { messages, language } = await req.json();

    let systemPrompt = "You are a helpful assistant.";
    if (language && language !== "No Language") {
      systemPrompt = `You are a helpful assistant. When asked for code, always provide it in the ${language} language.`;
    }

    const payloadMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const response = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages: payloadMessages,
        temperature: 0.7,
        stream: true,
        private: false,
      }),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `API call failed with ${response.status}` }),
        { status: response.status }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("API error:", err);
    return new Response(JSON.stringify({ error: "Something went wrong" }), {
      status: 500,
    });
  }
}
