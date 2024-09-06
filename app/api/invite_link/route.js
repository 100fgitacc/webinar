import { SignJWT } from 'jose';
import pool from '/app/connection';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const client = await pool.connect();
  try {
    // http://localhost:3000/api/invite_link?name=&phone=
    const url = new URL(req.url);
    const name = url.searchParams.get('name');
    const phone = url.searchParams.get('phone');

    if (!name || !phone) {
      return NextResponse.json({ error: 'Не указаны имя или телефон' }, { status: 400 });
    }


    const query = `
      SELECT * FROM users WHERE name = $1 AND phone = $2
    `;
    const { rows: existingUser } = await client.query(query, [name, phone]);

    let user;

    if (existingUser.length > 0) {
      user = existingUser[0];
    } else {
      const insertQuery = `
        INSERT INTO users (name, phone, password, is_admin) VALUES ($1, $2, $3, $4) RETURNING *
      `;
      const { rows: newUserRows } = await client.query(insertQuery, [name, phone, '', 0]);
      user = newUserRows[0];
    }

    let tokenExpirationTime;

    const now = Math.floor(Date.now() / 1000); 

    if (streamEndSeconds && streamEndSeconds > now) {
      tokenExpirationTime = streamEndSeconds + 3600;
    } else {
      tokenExpirationTime = now + 3600;
    }
    const accessToken = await new SignJWT({ id: user.id, name: user.name, is_admin: user.is_admin })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setExpirationTime(tokenExpirationTime)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    const response = NextResponse.redirect(new URL('/stream', req.url));
    response.cookies.set('authToken', accessToken);

    return response;
  } catch (error) {
    console.error('Ошибка при обработке данных:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  } finally {
    client.release(); 
  }
}
