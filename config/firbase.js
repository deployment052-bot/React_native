
const admin = require("firebase-admin");
const serviceAccount = require("../firbase/sdk.json"); // path check karo

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;