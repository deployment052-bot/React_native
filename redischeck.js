const redis = require("redis");

const client = redis.createClient({
  url: process.env.REDIS_URL,
  socket: { tls: true, rejectUnauthorized: false } // required if SSL enabled
});

client.on("error", (err) => console.log("Redis Error:", err));

async function connectRedis() {
  try {
    await client.connect();
    console.log("✅ Redis connected");
  } catch (err) {
    console.error("Redis connection failed:", err);
  }
}

connectRedis();

module.exports = { client };
