import { DB_PATH, resetDatabase } from "./db.ts"

resetDatabase()
console.log(`WSL database reset and re-seeded at ${DB_PATH}`)
