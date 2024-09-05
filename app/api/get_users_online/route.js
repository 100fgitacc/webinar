export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import schedule from 'node-schedule';
import pool from '/app/connection'; 

let currentOnlineUsers = 0; // Начальное количество пользователей
const clients = []; // Массив для хранения клиентов SSE
let isScheduled = false; // Флаг, чтобы не запускать задачу повторно

// Функция для трансляции обновленного количества пользователей
async function broadcastOnlineUsers(count) {
  const userPayload = { onlineUsers: count };
  const userData = `data: ${JSON.stringify(userPayload)}\n\n`;
 
  
  clients.forEach((client) => {
    client.write(userData).catch((err) => {
      const clientIndex = clients.indexOf(client);
      if (clientIndex !== -1) {
        clients.splice(clientIndex, 1);
      }
    });
  });
}

// SSE для клиентов, которые запрашивают количество онлайн пользователей
export async function GET() {
  const client = await pool.connect();
  try {
    const queryStream = `
      SELECT start_date, scenario_id, video_duration
      FROM streams
      ORDER BY start_date DESC
      LIMIT 1
    `;
    const { rows: streamRows } = await client.query(queryStream);

    const startTime = new Date(streamRows[0]?.start_date); // Время начала стрима
    const videoDuration = streamRows[0]?.video_duration * 1000; // Продолжительность видео
    const scenarioId = streamRows[0]?.scenario_id;

    // Получаем данные сценария для онлайн пользователей
    const queryScenario = `
      SELECT scenario_online
      FROM scenario
      WHERE id = $1
    `;
    const { rows: scenarioRows } = await client.query(queryScenario, [scenarioId]);
    const scenarioOnline = scenarioRows[0]?.scenario_online || [];

    // Сбрасываем текущее количество пользователей перед началом нового цикла планирования
    currentOnlineUsers = 0;

    // Если задача ещё не была запланирована
    if (!isScheduled) {
      isScheduled = true;

      // Планируем изменение онлайн пользователей
      scenarioOnline.forEach(({ showAt, count }) => {
        const scheduleTime = new Date(startTime.getTime() + showAt * 1000);
      
        // Если время задачи в прошлом (отрицательное значение showAt)
        if (scheduleTime < new Date()) {
          currentOnlineUsers = count;
          broadcastOnlineUsers(currentOnlineUsers);
        } else {
          // Планируем задачу на будущее время
          schedule.scheduleJob(scheduleTime, () => {
            currentOnlineUsers = count;
            broadcastOnlineUsers(currentOnlineUsers);
          });
        }
      });

      // Планируем завершение задачи по времени окончания видео
      const endStreamTime = new Date(startTime.getTime() + videoDuration);
      schedule.scheduleJob(endStreamTime, () => {
        isScheduled = false; // Сбрасываем флаг для возможности планирования нового стрима
        currentOnlineUsers = 0; // Сбрасываем количество пользователей после окончания стрима
        broadcastOnlineUsers(currentOnlineUsers); // Обновляем всех клиентов
      });
    }

    // Создаем поток данных для SSE
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    clients.push(writer);

    // Отправляем начальные данные
    writer.write(`data: ${JSON.stringify({ onlineUsers: currentOnlineUsers })}\n\n`);

    // Убираем клиента при закрытии соединения
    const onClose = () => {
      const index = clients.indexOf(writer);
      if (index !== -1) {
        clients.splice(index, 1);
      }
    };
    writer.closed.then(onClose, onClose);

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Ошибка при запуске потока' }, { status: 500 });
  } finally {
    client.release();
  }
}
