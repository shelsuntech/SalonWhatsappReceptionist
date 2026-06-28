export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
console.log("=================1=================");
    // 1. ROUTE FOR WHATSAPP HANDSHAKE (GET /) or (GET /webhook)
    if (request.method === 'GET') {
      console.log("Incoming verification handshake request received");
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
        return new Response(challenge, { status: 200 });
      }
      return new Response('Forbidden', { status: 403 });
    }

    // 2. ROUTE FOR INCOMING LIVE WHATSAPP CHATS (POST /)
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        console.log("Webhook payload payload body extracted:", JSON.stringify(body));

        // Safe layer verification checks
        if (!body.object || !body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
          console.log("Ignored: Payload structure does not match message layout format");
          return new Response('Event ignored', { status: 200 });
        }

        const messageData = body.entry[0].changes[0].value.messages[0];
        const customerPhone = messageData.from;

        if (messageData.type !== 'text') {
          console.log("Ignored: Received a non-text format payload category style");
          return new Response('Not a text message', { status: 200 });
        }
        const customerText = messageData.text.body;
        console.log(`Processing message from ${customerPhone}: "${customerText}"`);

        // VERIFIED GEMINI 3.1 FLASH LITE ENDPOINT
        //const geminiUrl = `https://googleapis.com{env.GEMINI_API_KEY}`;
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`;

        console.log("Calling Google AI Studio engine framework...");
        const geminiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: customerText }] }],
            //systemInstruction: { 
              //parts: [{ text: "You are a professional customer service assistant for ShelSun Tech. Keep answers to 2 sentences max." }] 
            
            //}
            systemInstruction: { 
  parts: [{ text: 
    "You are a professional, polite, and helpful AI corporate customer service assistant for ShelSun Tech.\n\n" +
    "CRITICAL LANGUAGES RULE:\n" +
    "1. If the user messages you in English, reply in natural English.\n" +
    "2. If the user messages you in Hindi script (हिंदी), reply in pure, polite Hindi script.\n" +
    "3. If the user messages you in Hinglish (Hindi words written using English alphabets, e.g., 'bhai price kya hai' or 'meri query solve karo'), you MUST reply back in smooth, natural Hinglish using the English script.\n" +
    "4. Always perfectly mirror the vocabulary, tone, and script style used by the customer.\n\n" +
    "5. If someone asks for contact details tell them to write on shelsuntech@gmail.com or call on +918076664199.\n\n"+
    
    "RESPONSE RULES:\n" +
    "- Keep all answers strictly limited to 2 short sentences maximum.\n" +
    "- Be concise, direct, and business-focused.\n" +
    "- Do not hallucinate capabilities; if you don't know something about ShelSun Tech, ask them politely to wait for a human team member or write to shelsuntech@gmail.com or call on +918076664199."
  //  "- If someone asks for contact details tell them to write on shelsuntech@gmail.com or call on +918076664199."
  }] 
}

          })
        });

        const geminiData = await geminiResponse.json();
        const botReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I am having trouble responding right now.";
        console.log(`Gemini response parsed successfully: "${botReply}"`);

        // VERIFIED META GRAPH API v20.0 ENDPOINT
        //const metaUrl = `https://facebook.com{env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
        const metaUrl = `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

        console.log(`Sending response payload back to phone ${customerPhone}...`);
        const metaResponse = await fetch(metaUrl, {
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

        const metaResult = await metaResponse.text();
        console.log("Meta execution delivery confirmation:", metaResult);

        return new Response('Success', { status: 200 });
      } catch (error) {
        console.error("Critical Runtime Bot Exception:", error.message);
        return new Response('Internal Server Error', { status: 500 });
      }
    }

    return new Response('ShelSun Tech Bot API Live Node.', { status: 200 });
  }
};
