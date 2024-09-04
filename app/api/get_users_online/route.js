export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import schedule from 'node-schedule';
import pool from '/app/connection'; 

const clients = []; // Массив для хранения клиентов SSE
let isScheduled = false; // Флаг, чтобы не запускать задачу повторно
let scenarioData = []; // Данные сценария для симуляции пользователей
let currentOnlineUsers = 0; // Инициализация начального значения пользователей

function simulateUserActivity(timeElapsed) {
  console.log(`Simulating user activity at ${timeElapsed} seconds.`);
  
  // Найти данные, соответствующие времени timeElapsed
  const scenarioPoint = scenarioData.find(point => point.showAt === timeElapsed);
  console.log('Scenario point found:', scenarioPoint);

  if (scenarioPoint) {
    currentOnlineUsers = scenarioPoint.count;
    console.log(`Updating online users to: ${currentOnlineUsers}`);
    
    // Трансляция количества пользователей всем клиентам
    broadcastOnlineUsers(currentOnlineUsers);
  } else {
    console.log('No scenario point matched the current time.');
  }
}

// Трансляция обновленного количества пользователей
async function broadcastOnlineUsers(count) {
  console.log('Broadcasting updated online users to clients:', count);

  const userPayload = {
    onlineUsers: count,
  };
  const userData = `data: ${JSON.stringify(userPayload)}\n\n`;

  clients.forEach((client, index) => {
    client.write(userData).catch((err) => {
      console.error(`Error sending data to client ${index}:`, err);
      const clientIndex = clients.indexOf(client);
      if (clientIndex !== -1) {
        clients.splice(clientIndex, 1);
        console.log(`Removed client ${clientIndex} from the clients array.`);
      }
    });
  });
}

// SSE для клиентов, которые запрашивают количество онлайн пользователей
export async function GET() {
  console.log('Starting GET request for online users...');
  const client = await pool.connect();

  try {
    const queryStream = `
      SELECT start_date, scenario_id, video_duration
      FROM streams
      ORDER BY start_date DESC
      LIMIT 1
    `;
    const { rows: streamRows } = await client.query(queryStream);

    if (!streamRows.length) {
      console.error('No stream data found.');
      return NextResponse.json({ error: 'No stream data found' }, { status: 500 });
    }

    console.log('Stream data found:', streamRows[0]);

    const startTime = new Date(streamRows[0]?.start_date); // Время начала стрима
    const videoDuration = streamRows[0]?.video_duration * 1000; // Продолжительность видео
    const scenarioId = streamRows[0]?.scenario_id; // Получаем scenario_id для использования

    console.log(`Scenario ID: ${scenarioId}, Video Duration: ${videoDuration}`);

    const queryScenario = `
      SELECT scenario_online
      FROM scenario
      WHERE id = $1
    `;
    const { rows: scenarioRows } = await client.query(queryScenario, [scenarioId]);
    if (!scenarioRows.length) {
      console.error('No scenario data found.');
      return NextResponse.json({ error: 'No scenario data found' }, { status: 500 });
    }

    console.log('Scenario data found:', scenarioRows[0]);

    // Парсим данные из колонки scenario_online
    scenarioData = scenarioRows[0]?.scenario_online || '[]';
    console.log('Parsed scenario data:', scenarioData);

    // Если задача еще не была запланирована
    if (!isScheduled) {
      console.log('Scheduling tasks...');
      isScheduled = true;

      scenarioData.forEach(({ showAt }) => {
        const userActivityTime = new Date(startTime.getTime() + showAt * 1000);
        schedule.scheduleJob(userActivityTime, () => simulateUserActivity(showAt));
        console.log(`Scheduled simulation at ${userActivityTime}`);
      });

      // Планируем задачу для завершения стрима по времени окончания видео
      const endStreamTime = new Date(startTime.getTime() + videoDuration);
      schedule.scheduleJob(endStreamTime, () => {
        isScheduled = false; // Сбрасываем флаг для возможности планирования нового стрима
        console.log('Stream ended. Flag reset.');
      });
    }

    // Создаем поток данных для SSE
    console.log('Creating data stream for SSE...');
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    clients.push(writer);
    console.log('Client connected, total clients:', clients.length);

    // Отправляем начальные данные
    writer.write(`data: ${JSON.stringify({ onlineUsers: currentOnlineUsers })}\n\n`);

    // Убираем клиента при закрытии соединения
    const onClose = () => {
      const index = clients.indexOf(writer);
      if (index !== -1) {
        clients.splice(index, 1);
        console.log('Client disconnected, total clients:', clients.length);
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
    console.error('Error while processing SSE:', error);
    return NextResponse.json({ error: 'Ошибка при запуске потока', details: error.message }, { status: 500 });
  } finally {
    client.release();
    console.log('Database connection released.');
  }
}
