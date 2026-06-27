import { createDb } from "./index.js";

const db = createDb();

try {
  await db.migrate();
  console.log("migrations applied");
} finally {
  await db.close();
}
