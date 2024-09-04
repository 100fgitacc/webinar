import { NextResponse } from 'next/server';
import schedule from 'node-schedule';
import pool from '/app/connection'; 

let currentOnlineUsers = 0; // Начальное количество пользователей
const clients = []; // Массив для хранения клиентов SSE
let isScheduled = false; // Флаг, чтобы не запускать задачу повторно

// Функция изменения количества пользователей
function simulateUserActivity() {
  const minUsers = 0;
  const maxUsers = 300;

  // Рандомное изменение количества пользователей
  const change = Math.floor(Math.random() * 5) - 2; 
  currentOnlineUsers = Math.max(minUsers, Math.min(maxUsers, currentOnlineUsers + change));

  // Трансляция количества пользователей всем клиентам
  broadcastOnlineUsers(currentOnlineUsers);
}

// Трансляция обновленного количества пользователей
async function broadcastOnlineUsers(count) {
  const userPayload = {
    onlineUsers: count,
  };
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

    // Если задача еще не была запланирована
    if (!isScheduled) {
      isScheduled = true;

      // Планируем задачи для изменения онлайн пользователей до начала стрима
      const preStreamStartOffset = -600000; // -10 минут до начала стрима
      const preStreamTime = new Date(startTime.getTime() + preStreamStartOffset);

      // Если есть время перед началом стрима, запланировать изменение пользователей
      if (preStreamTime.getTime() > Date.now()) {
        schedule.scheduleJob(preStreamTime, () => {
          console.log(`Началось изменение онлайн пользователей за 10 минут до начала стрима.`);

          // Запускаем изменение количества онлайн пользователей до начала стрима
          schedule.scheduleJob('preStreamUserActivity', '*/10 * * * * *', simulateUserActivity);
        });
      }

      // Планируем задачу по времени начала стрима
      schedule.scheduleJob(startTime, () => {
        console.log(`Стрим начался в ${startTime}`);
        
        // Останавливаем предстримовые изменения онлайн пользователей
        const preStreamJob = schedule.scheduledJobs['preStreamUserActivity'];
        if (preStreamJob) {
          preStreamJob.cancel();
        }

        // Запускаем задачу на изменение количества онлайн пользователей каждые 10 секунд во время стрима
        schedule.scheduleJob('userActivity', '*/10 * * * * *', simulateUserActivity);
      });

      // Планируем задачу для завершения стрима по времени окончания видео
      const endStreamTime = new Date(startTime.getTime() + videoDuration);
      schedule.scheduleJob(endStreamTime, () => {
        console.log(`Стрим закончился в ${endStreamTime}`);
        isScheduled = false; // Сбрасываем флаг для возможности планирования нового стрима
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
