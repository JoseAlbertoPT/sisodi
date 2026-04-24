import { Pool } from 'pg'

const pool = new Pool({
 connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/postgres",

})

export default pool
