
import { Pool } from 'pg';
const connectionString = "postgres://default:6MtWFzg3OGEr@ep-floral-cloud-a46xmgzv.us-east-1.aws.neon.tech:5432/verceldb?sslmode=require";
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, 
  },
});

export default pool;