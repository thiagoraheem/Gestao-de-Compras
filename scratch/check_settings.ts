import { db } from "../server/db";
import { appSettings } from "../shared/schema";

async function checkSettings() {
  try {
    const settings = await db.select().from(appSettings);
    console.log("Settings found:", settings.length);
    for (const s of settings) {
      console.log(`Key: ${s.key}, IsSecret: ${s.isSecret}, Value: ${s.value}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSettings();
