export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ============================================================
    // WHATSAPP WEBHOOK VERIFICATION (GET)
    // ============================================================
    if (request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (
        mode === "subscribe" &&
        token === env.WHATSAPP_VERIFY_TOKEN
      ) {
        return new Response(challenge, { status: 200 });
      }

      return new Response("Forbidden", { status: 403 });
    }

    // ============================================================
    // WHATSAPP WEBHOOK EVENTS (POST)
    // ============================================================
    if (request.method === "POST") {

      const requestId = crypto.randomUUID();

      let body;

      try {
        body = await request.json();
      } catch (err) {
        console.error(`[${requestId}] Invalid JSON`, err);
        return new Response("Invalid JSON", { status: 400 });
      }

      console.log("");
      console.log("================================================");
      console.log(`[${requestId}] WEBHOOK RECEIVED`);
      console.log(`[${requestId}] Time: ${new Date().toISOString()}`);
      console.log(`[${requestId}] Payload:`);
      console.log(JSON.stringify(body, null, 2));

      // ------------------------------------------------------------
      // Ignore WhatsApp status events
      // ------------------------------------------------------------
      if (
        body.entry?.[0]?.changes?.[0]?.value?.statuses
      ) {

        console.log(
          `[${requestId}] Ignored: WhatsApp status event`
        );

        return new Response(
          "Status event ignored",
          { status: 200 }
        );
      }

      // ------------------------------------------------------------
      // Extract incoming message
      // ------------------------------------------------------------
      const messageData =
        body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      if (!messageData) {

        console.log(
          `[${requestId}] Ignored: No message object`
        );

        return new Response(
          "No message",
          { status: 200 }
        );
      }

      console.log(
        `[${requestId}] Message ID: ${messageData.id}`
      );

      console.log(
        `[${requestId}] From: ${messageData.from}`
      );

      console.log(
        `[${requestId}] Type: ${messageData.type}`
      );

      console.log(
        `[${requestId}] Message Object:`
      );

      console.log(
        JSON.stringify(messageData, null, 2)
      );

      // ------------------------------------------------------------
      // Ignore unsupported message types
      // ------------------------------------------------------------
      if (messageData.type !== "text") {

        console.log(
          `[${requestId}] Ignored: Non-text message`
        );

        return new Response(
          "Non-text message ignored",
          { status: 200 }
        );
      }

      const customerText =
        messageData.text?.body?.trim() || "";

      if (!customerText) {

        console.log(
          `[${requestId}] Ignored: Empty text message`
        );

        return new Response(
          "Empty message",
          { status: 200 }
        );
      }

      console.log(
        `[${requestId}] Customer Text: ${customerText}`
      );

      // ------------------------------------------------------------
      // Ignore messages coming from our own business number
      // ------------------------------------------------------------
      if (
        messageData.from === env.WHATSAPP_PHONE_NUMBER_ID
      ) {

        console.log(
          `[${requestId}] Ignored: Self message`
        );

        return new Response(
          "Self message ignored",
          { status: 200 }
        );
      }

      // ------------------------------------------------------------
      // Run AI in background
      // ------------------------------------------------------------
      ctx.waitUntil(

        handleProcessing(
          messageData,
          body,
          env,
          requestId
        ).catch(err => {

          console.error(
            `[${requestId}] handleProcessing crashed`
          );

          console.error(err);

        })

      );

      return new Response("OK", { status: 200 });

    }

    return new Response(
      "ShelSun Tech Bot API Live Node.",
      { status: 200 }
    );
  }
};





async function handleProcessing(messageData, body, env, requestId) {

  //const customerPhone = messageData.from;
 // const customerText = messageData.text.body.trim();
  
const customerPhone =messageData.from?.trim();
  
const customerText =messageData.text?.body?.trim() || "";
  
  console.log(`[${requestId}] ===== PROCESSING START =====`);
  console.log(`[${requestId}] Customer: ${customerPhone}`);
  console.log(`[${requestId}] Text: ${customerText}`);

  let botReply = "Sorry, I am having trouble responding right now.";

  try {

    console.log(`[${requestId}] Calling Gemini...`);

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({

        contents: [
          {
            parts: [
              {
                text: customerText
              }
            ]
          }
        ],

        systemInstruction: {
          parts: [
            {
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
  "- Maintain a premium corporate tone in every response."
            }
          ]
        }

      })
    });

    console.log(
      `[${requestId}] Gemini HTTP Status: ${geminiResponse.status}`
    );

    if (!geminiResponse.ok) {

      const errorBody = await geminiResponse.text();

      console.error(
        `[${requestId}] Gemini Error: ${errorBody}`
      );

      throw new Error("Gemini API Error");
    }

    const geminiData = await geminiResponse.json();

    console.log(
      `[${requestId}] Gemini Raw Response:`
    );

    console.log(
      JSON.stringify(geminiData, null, 2)
    );

    botReply =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
      || botReply;

    console.log(
      `[${requestId}] Gemini Reply: ${botReply}`
    );

  } catch (error) {

    console.error(
      `[${requestId}] Gemini failed`
    );

    console.error(error);

    try {

      console.log(
        `[${requestId}] Falling back to Cloudflare AI`
      );

      const aiResponse = await env.AI.run(
        "@cf/meta/llama-3.1-8b-instruct-fast",
        {
          messages: [
            {
              role: "user",
              content: customerText
            }
          ]
        }
      );

      botReply =
        aiResponse.response || botReply;

      console.log(
        `[${requestId}] Llama Reply: ${botReply}`
      );

    } catch (llamaError) {

      console.error(
        `[${requestId}] Llama also failed`
      );

      console.error(llamaError);
    }
  }

  console.log(
    `[${requestId}] Sending WhatsApp reply...`
  );

  const waResponse = await fetch(

    `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,

    {

      method: "POST",

      headers: {

        Authorization:
          `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,

        "Content-Type":
          "application/json"

      },

      body: JSON.stringify({

        messaging_product: "whatsapp",

        recipient_type: "individual",

        to: customerPhone,

        type: "text",

        text: {

          preview_url: false,

          body: botReply

        }

      })

    }

  );

  console.log(
    `[${requestId}] WhatsApp Status: ${waResponse.status}`
  );

  const waResponseBody =
    await waResponse.text();

  console.log(
    `[${requestId}] WhatsApp Response: ${waResponseBody}`
  );

  console.log(
    `[${requestId}] ===== PROCESSING COMPLETE =====`
  );

}



// ============================================================
// HELPER FUNCTIONS
// ============================================================

function log(requestId, message) {
  console.log(`[${requestId}] ${message}`);
}

function logError(requestId, message, error) {
  console.error(`[${requestId}] ${message}`);

  if (error) {
    console.error(error);
  }
}

function isStatusEvent(body) {
  return !!body.entry?.[0]?.changes?.[0]?.value?.statuses;
}

function getIncomingMessage(body) {
  return body.entry?.[0]?.changes?.[0]?.value?.messages?.[0] || null;
}

function isSupportedTextMessage(messageData) {

  if (!messageData) return false;

  if (messageData.type !== "text") return false;

  if (!messageData.text?.body?.trim()) return false;

  return true;

}

// Google Sheet Place holder
async function saveLeadToGoogleSheet(
  env,
  requestId,
  lead
) {

  log(
    requestId,
    "Google Sheets integration not enabled."
  );

}
//Duplicate capture placeholder
async function isDuplicateMessage(
  env,
  messageId
) {

  // Future:
  // Cloudflare KV lookup

  return false;

}


/*
==================================================

FUTURE FEATURES

[ ] Cloudflare KV
    - duplicate detection
    - conversation memory

[ ] Google Sheets Lead Capture

[ ] Appointment Booking

[ ] Human Handover

[ ] Business Knowledge Base

==================================================
*/
