import { Pool } from "pg";

// Railway provee DATABASE_URL automáticamente al conectar PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

export default pool;
