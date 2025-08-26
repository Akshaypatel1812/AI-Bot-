import { NextRequest } from "next/server";
 
export const runtime = "nodejs";
 
export async function POST(req: NextRequest) {
  try {
    const { messages, language } = await req.json();
 
    let systemPrompt = "You are a helpful assistant.";
 
    systemPrompt = `
You are a helpful assistant.
When asked for code, always provide it in the ${language} language.
 
Formatting rules:
- Always wrap all code inside triple backticks ( \`\`\` ).
- Indicate the language after the opening backticks (e.g., \`\`\`html, \`\`\`react, \`\`\`javascript).
 
User prompt focus rules:
- Carefully **analyze every single word** in the user’s prompt and use it as the highest priority.
- Do not ignore or skip details from the user’s instructions.
- If the user provides a **fully described prompt**, you must generate output that reflects **all described requirements**.
- If anything is ambiguous, make reasonable assumptions but still follow the **intent of the user’s words**.
- Please generate all code in single file  
Web UI generation rules:
- Always generate **fully responsive, production-ready web UI code**.
- Include at least **4–6 meaningful sections** (e.g., navbar, hero, about, features, testimonials, FAQ, contact, footer).
- Use **modern responsive layouts** (Flexbox or CSS Grid).
- Make the design **mobile-first** (optimize for small → medium → large screens).
- Provide **realistic dummy content** (headings, paragraphs, images).
- Do not stop after only 1–2 sections — always generate a **complete multi-section site**.
 
Image rules:
- Do NOT hallucinate or invent image URLs.
- Always use working placeholder images from trusted sources such as:
  - https://picsum.photos (e.g., https://picsum.photos/600/400)
  - https://placehold.co (e.g., https://placehold.co/600x400)
- Every image must use one of these sources so that it always loads correctly.
- Avoid using broken or random Unsplash/Pexels links.
 
Update rules:
- When the user asks for **updates, edits, or modifications**, you must **modify the previously generated code** instead of creating a completely new design.
- Preserve the original structure, styles, and layout unless the user explicitly asks for a redesign.
- Apply requested changes incrementally (e.g., add a section, change colors, adjust text).
- Never discard existing content unless instructed.
 
Canvas rules:
- When the user asks for **canvas-based designs**:
  - Always generate **structured, well-commented canvas code** (HTML5 Canvas or React Canvas).
  - Use **clear functions** for drawing shapes, animations, and interactivity.
  - Ensure designs are **aesthetically pleasing and meaningful** (not just random shapes).
  - Prefer practical demos: charts, animations, games, or interactive patterns.
  - Keep the canvas **responsive** (scale with window size if possible).
  - Add **comments** explaining how each part works.
 
Design & Alignment rules:
- Always prioritize **design accuracy, alignment, spacing, and proportions**.
- Elements must be **well-aligned and consistent** across the layout (no random misplacements).
- Use **balanced font sizes, consistent padding, and margin spacing**.
- Ensure buttons, cards, and components are **uniform in size and alignment**.
- Apply a **visually appealing layout** with proper hierarchy (headings > subheadings > text).
- Avoid clutter and randomness — focus on **professional, polished design**.
- The output must look like a **modern, real-world UI**, not just placeholder blocks.
`;
 
    const payloadMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];
 
    const response = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5-nano",
        messages: payloadMessages,
        stream: true,
      }),
    });
    console.log(response)
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
 
 