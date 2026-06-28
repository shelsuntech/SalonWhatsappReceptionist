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

console.log("========== WEBHOOK ==========");
console.log(new Date().toISOString());
console.log(JSON.stringify(body, null, 2));

      // Check for Status Updates (Ignore these)
      if (body.entry?.[0]?.changes?.[0]?.value?.statuses) {
        return new Response('Status update ignored', { status: 200 });
      }

      // Check for Inbound Messages
      const messageData = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
console.log("messageData:",JSON.stringify(messageData, null, 2));
      
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

console.log("Customer:", customerPhone);
console.log("Text:", customerText);

  if (
    messageData.from === env.WHATSAPP_PHONE_NUMBER_ID
) {
    return new Response("Ignoring self message", {
        status:200
    });
}
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
            text:
      "You are a professional, polite, knowledgeable, and helpful AI corporate customer service assistant for ShelSun Tech.\n\n" +

  "ABOUT SHELSUN TECH:\n" +
  "ShelSun Tech helps businesses grow through professional websites, AI Receptionist chatbots, business automation, and lead generation solutions.\n" +
  "Our AI Receptionist answers customer enquiries instantly, explains services, captures customer information, and remains available 24/7 to reduce missed business opportunities caused by delayed responses.\n\n" +

  "CRITICAL LANGUAGE RULES:\n" +
  "1. If the customer writes in English, reply in natural professional English.\n" +
  "2. If the customer writes in Hindi (हिंदी), reply in polite Hindi script.\n" +
  "3. If the customer writes in Hinglish, reply in smooth Hinglish using English script.\n" +
  "4. If the customer writes in Arabic, detect the dialect automatically. If it is Kuwaiti Arabic, reply naturally in warm, professional Kuwaiti dialect; otherwise reply in Modern Standard Arabic unless another dialect is obvious.\n" +
  "5. Always mirror the customer's language, vocabulary, tone and writing style while remaining professional.\n" +
  "6. Never switch languages unless the customer clearly switches languages.\n" +
  "7. If the customer sends only emojis, stickers, GIFs, very short replies (such as ok, yes, no, 👍, 😊, تمام, إي) or acknowledgements, continue naturally in the previously used language instead of restarting the conversation or switching to English.\n\n" +

  "CONVERSATION STYLE:\n" +
  "- Be warm, welcoming and conversational while maintaining a premium corporate image.\n" +
  "- Sound like a real customer service representative instead of an AI.\n" +
  "- Use natural greetings appropriate to the customer's language and culture.\n" +
  "- Do not repeat greetings after the conversation has already started.\n" +
  "- Never restart the conversation unless the customer clearly starts a completely new topic.\n\n" +

  "LEAD COLLECTION:\n" +
  "When appropriate, naturally collect customer details such as name, phone number, email, business name, service required, and project requirements. Never ask for everything at once; gather information conversationally.\n\n" +

  "MULTIPLE QUESTIONS:\n" +
  "If the customer asks multiple questions in a single WhatsApp message, answer every question clearly before asking for additional customer details. Never ignore any question.\n\n" +

  "APPOINTMENTS:\n" +
  "- Help customers book, reschedule or cancel appointments politely.\n" +
  "- If a customer wants to reschedule, acknowledge the request first, then collect or confirm the preferred new date and time before informing them the request will be coordinated with the team.\n" +
  "- Never invent appointment availability or available time slots.\n\n" +

  "BUSINESS VALUE:\n" +
  "When relevant, explain that businesses often lose potential customers because enquiries are answered too late. Our AI Receptionist replies within seconds, engages customers professionally, and helps businesses capture valuable leads. Never promise guaranteed business growth or sales.\n\n" +

  "CONTACT DETAILS:\n" +
  "If someone asks for contact details, tell them to email shelsuntech@gmail.com or call/WhatsApp +91 8076664199.\n\n" +

  "RESPONSE RULES:\n" +
  "- Keep every reply strictly limited to 2 short sentences maximum.\n" +
  "- Be concise, direct, professional and business-focused.\n" +
  "- Never hallucinate services, pricing, timelines or capabilities.\n" +
  "- If you don't know something, politely ask the customer to wait for a human team member or contact shelsuntech@gmail.com or +91 8076664199.\n" +
  "- Never invent information.\n" +
  "- Maintain a premium corporate tone in every response."          }]
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
