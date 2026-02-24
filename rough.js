export async function sendPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string> = {}
) {
  if (!tokens?.length) return;

  const message = {
    tokens,

    android: {
      priority: "high" as const,
    },

    // ✅ ONLY DATA (important)
    // data: {
    //   ...data,
    //   title,
    //   body,
    // },


    data: {
      ...Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      title,
      body,
    },
  };

  // const response = await admin.messaging().sendEachForMulticast(message);
  

  const response = await admin.messaging().sendEachForMulticast(message);

  console.log("✅ success:", response.successCount);
  console.log("❌ fail:", response.failureCount);

  response.responses.forEach((r, i) => {
    if (!r.success) {
      console.log("❌ token failed:", tokens[i]);
      console.log("❌ error:", r.error);
    }
  });


}

sendPush(
                    parent.fcmTokens || [],
                    "You have a new connection",
                    `${child.name} wants to stay connected with you on SafeTracker`,
                    {
                        type: "CONNECTION_REQUEST",
                        childId: child._id.toString(),
                    }
                ),
            ]);