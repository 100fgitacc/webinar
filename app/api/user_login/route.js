import { SignJWT } from 'jose';
import pool from '/app/connection';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const client = await pool.connect();
  try {
    const { name, phone, password, is_admin, streamEndSeconds } = await req.json();
    if (name.length > 12) {
      return NextResponse.json({ error: 'Имя не должно превышать 12 символов' }, { status: 400 });
    }
    const { rows: existingUser } = await client.query(
      'SELECT * FROM users WHERE name = $1 AND phone = $2',
      [name, phone]
    );

    let user;

    if (existingUser.length > 0) {
      user = existingUser[0];
    } else {
      const result = await client.query(
        'INSERT INTO users (name, phone, password, is_admin) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, phone, password, is_admin]
      );

      user = result.rows[0];
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

    const response = NextResponse.json({ message: 'Успешно вошли' });
    response.cookies.set('authToken', accessToken, {  maxAge: 3600 });

    return response;
  } catch (error) {
    console.error('Ошибка при обработке данных:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  } finally {
    client.release(); // Освобождаем клиент
  }
}
