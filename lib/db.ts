import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.jdbc:postgresql://localhost:5432/postgres,
})

export default pool
