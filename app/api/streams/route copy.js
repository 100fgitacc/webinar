import pool from '/app/connection'; 
import { NextResponse } from 'next/server';

export async function GET() {
  const client = await pool.connect(); 
  try {
    const query = `
      SELECT id, name, start_date, scenario_id, video_id, video_duration, button_show_at
      FROM streams
      WHERE ended = false
      ORDER BY start_date ASC
      LIMIT 1
    `;
    const { rows } = await client.query(query);

    return NextResponse.json(rows[0] || {});
  } catch (error) {
    console.error('Ошибка при получении данных:', error);
    return NextResponse.json({ error: 'Не удалось получить данные' }, { status: 500 });
  } finally {
    client.release(); 
  }
}
