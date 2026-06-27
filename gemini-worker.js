export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    console.log("=================1=================");

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

    // 2. ROUTE FOR INCOMING LIVE WHATSAPP CHATS (POST /)
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        
        // ... (Keep your existing safe layer verification checks)
        if (!body.object || !body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) return new Response('Event ignored', { status: 200 });

        const messageData = body.entry[0].changes[0].value.messages[0];
        const customerPhone = messageData.from;
        if (messageData.type !== 'text') return new Response('Not a text message', { status: 200 });
        
        const customerText = messageData.text.body;

        // --- NEW GATEWAY INTEGRATION START ---
        // We now route through the Cloudflare Dynamic Route instead of direct to Google
        const GATEWAY_URL = `https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/${env.GATEWAY_ID}/dynamic/receptionist-flow`;

        console.log("Routing request through AI Gateway flow...");
        /*const gatewayResponse = await fetch(GATEWAY_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'cf-aig-authorization': `Bearer ${env.CF_AIG_TOKEN}` // Ensure this secret is set
          },
          body: JSON.stringify({
            messages: [
              { 
                role: "system", 
                content: "You are a professional, polite, and helpful AI corporate customer service assistant for ShelSun Tech..." // Add your full prompt here
              },
              { role: "user", content: customerText }
            ]
          })
        }); */
        // --- REPLACE YOUR GATEWAY FETCH BLOCK WITH THIS ---
console.log("Sending to Gateway...");
const gatewayResponse = await fetch(GATEWAY_URL, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'cf-aig-authorization': `Bearer ${env.CF_AIG_TOKEN}`
  },
  body: JSON.stringify({
    messages: [
      { role: "system", content: "You are a helpful assistant for ShelSun Tech." },
      { role: "user", content: customerText }
    ]
  })
});

// LOG THE STATUS AND RAW TEXT
console.log("Gateway HTTP Status:", gatewayResponse.status);
const rawResponse = await gatewayResponse.text();
console.log("Raw Gateway Response:", rawResponse);

// NOW ATTEMPT PARSING
let botReply = "Sorry, I am having trouble.";
try {
  const data = JSON.parse(rawResponse);
  // Support both OpenAI-style and direct Google-style responses
  botReply = data.choices?.[0]?.message?.content || 
             data.candidates?.[0]?.content?.parts?.[0]?.text || 
             "No response content found.";
} catch (e) {
  botReply = "Failed to parse JSON response.";
}
// --- END DEBUG BLOCK ---

       /* const gatewayData = await gatewayResponse.json();
        // The Gateway returns the response from either Gemini or the Llama fallback automatically
        const botReply = gatewayData.choices?.[0]?.message?.content || gatewayData.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I am having trouble responding.";
        console.log(`Gateway response received: "${botReply}"`);*/
        // Replace your parsing section with this:
const gatewayData = await gatewayResponse.json();

// Log the whole object so you can see it in your Dashboard Logs
console.log("Full Gateway Data:", JSON.stringify(gatewayData));

// Extract content safely
//let botReply = "";
if (gatewayData.choices && gatewayData.choices[0].message) {
  botReply = gatewayData.choices[0].message.content;
} else if (gatewayData.candidates && gatewayData.candidates[0].content) {
  botReply = gatewayData.candidates[0].content.parts[0].text;
} else {
  botReply = "Data format unrecognized: " + JSON.stringify(gatewayData);
}
        // --- NEW GATEWAY INTEGRATION END ---

        // 3. VERIFIED META GRAPH API v20.0 ENDPOINT
        const metaUrl = `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
        await fetch(metaUrl, {
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

        return new Response('Success', { status: 200 });
      } catch (error) {
        console.error("Critical Runtime Bot Exception:", error.message);
        return new Response('Internal Server Error', { status: 500 });
      }
    }

    return new Response('ShelSun Tech Bot API Live Node.', { status: 200 });
  }
};
