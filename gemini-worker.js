export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. ROUTE FOR WHATSAPP HANDSHAKE
    if (request.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
        return new Response(challenge, { status: 200 });
      }
      return new Response('Forbidden', { status: 403 });
    }

    // 2. ROUTE FOR INCOMING LIVE WHATSAPP CHATS
    if (request.method === 'POST') {
      const body = await request.json();

      // Check for Status Updates (Ignore these)
      if (body.entry?.[0]?.changes?.[0]?.value?.statuses) {
        return new Response('Status update ignored', { status: 200 });
      }

      // Check for Inbound Messages
      const messageData = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!messageData || messageData.type !== 'text') {
        return new Response('Event ignored', { status: 200 });
      }

      // Use ctx.waitUntil to handle AI processing in the background
      ctx.waitUntil(handleProcessing(messageData, body, env));
      return new Response('OK', { status: 200 });
    }

    return new Response('ShelSun Tech Bot API Live Node.', { status: 200 });
  }
};

async function handleProcessing(messageData, body, env) {
  const customerPhone = messageData.from;
  const customerText = messageData.text.body;
  let botReply = "Sorry, I am having trouble responding right now.";

  // A. TRY GEMINI FIRST
  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`;
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: customerText }] }],
        systemInstruction: {
          parts: [{
            text: "You are a professional, polite, and helpful AI corporate customer service assistant for ShelSun Tech.\n\n" +
              "CRITICAL LANGUAGES RULE:\n" +
              "1. If the user messages you in English, reply in natural English.\n" +
              "2. If the user messages you in Hindi script (हिंदी), reply in pure, polite Hindi script.\n" +
              "3. If the user messages you in Hinglish (Hindi words written using English alphabets), you MUST reply back in smooth, natural Hinglish using the English script.\n" +
              "4. Always perfectly mirror the vocabulary, tone, and script style used by the customer.\n\n" +
              "5. If someone asks for contact details tell them to write on shelsuntech@gmail.com or call on +918076664199.\n\n" +
              "RESPONSE RULES:\n" +
              "- Keep all answers strictly limited to 2 short sentences maximum.\n" +
              "- Be concise, direct, and business-focused.\n" +
              "- Do not hallucinate capabilities; if you don't know something about ShelSun Tech, ask them politely to wait for a human team member or write to shelsuntech@gmail.com or call on +918076664199."
          }]
        }
      })
    });

    if (!geminiResponse.ok) throw new Error("Gemini API Error");
    const geminiData = await geminiResponse.json();
    botReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || botReply;

  } catch (error) {
    // B. FALLBACK TO LLAMA
    console.error("Gemini failed, switching to Llama:", error.message);
    try {
      const aiResponse = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
        messages: [{ role: "user", content: customerText }]
      });
      botReply = aiResponse.response || botReply;
    } catch (llamaError) {
      console.error("Llama also failed:", llamaError.message);
    }
  }

  // C. SEND TO WHATSAPP
  await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: customerPhone,
      type: "text",
      text: { preview_url: false, body: botReply }
    })
  });
}
