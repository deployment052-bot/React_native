import admin from "firebase-admin";


export async function sendPush(tokens, title, body, data = {}) {

  if (!tokens || tokens.length === 0) return;

  try {

    const message = {
      tokens: tokens,

      android: {
        priority: "high",
      },

      /**
       * 🔥 DATA ONLY (VERY IMPORTANT)
       * Background fast response ke liye
       */
      data: {
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
        title: String(title),
        body: String(body),
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    console.log("✅ Success:", response.successCount);
    console.log("❌ Fail:", response.failureCount);

    response.responses.forEach((r, i) => {
      if (!r.success) {
        console.log("❌ Token Failed:", tokens[i]);
        console.log("❌ Error:", r.error);
      }
    });

  } catch (error) {
    console.log("❌ Push Send Error:", error);
  }
}
 

