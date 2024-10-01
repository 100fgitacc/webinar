
import { Pool } from 'pg';
// const connectionString = "postgres://default:RAQX5hP6aTuk@ep-withered-base-a4foo3ho.us-east-1.aws.neon.tech:5432/verceldb?sslmode=require";
const connectionString = "postgresql://admin:r9hZmRdc5qAdry7RUmL@85.209.154.162:5432/webinar";

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, 
  },
});

export default pool;