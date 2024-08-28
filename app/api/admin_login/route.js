import { SignJWT } from 'jose';
import pool from '/app/connection';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { username, phone = '', password, is_admin } = await req.json();
    const { rows: existingUser } = await pool.query(
      'SELECT * FROM users WHERE name = $1 AND phone = $2',
      [username, phone]
    );

    let user;

    if (existingUser.length > 0) {
      user = existingUser[0];
    } else {
      await pool.query(
        'INSERT INTO users (name, phone, password, is_admin) VALUES ($1, $2, $3, $4)',
        [username, phone, password, is_admin]
      );

      const { rows: newUser } = await pool.query(
        'SELECT * FROM users WHERE name = $1 AND phone = $2',
        [username, phone]
      );

      user = newUser[0];
    }
    const accessToken = await new SignJWT({ id: user.id, name: user.name, is_admin: user.is_admin })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setExpirationTime('1d')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    const response = NextResponse.json({ message: 'Успешно вошли' });
    response.cookies.set('authToken', accessToken);
    return response;
  } catch (error) {
    console.error('Ошибка при обработке данных:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
