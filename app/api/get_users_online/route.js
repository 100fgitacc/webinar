export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import schedule from 'node-schedule';
import pool from '/app/connection';

const clients = [];
let currentOnlineUsers = 0;
let isScheduled = false;
let previousStartTime = null;
let endStreamTime;
let firstShowAt;

// Функция для трансляции обновленного количества пользователей
async function broadcastOnlineUsers(count) {
  console.log('11111111111111111111111111111111');
  
  const serverTime = new Date();
  const switchTime = new Date(previousStartTime.getTime() + firstShowAt * 1000);
 
  
  let userPayload;
  console.log('Server time:', serverTime);
  console.log('Switch time:', switchTime);

  if (serverTime >= switchTime) {
    userPayload = { onlineUsers: count }; 
  } else {
    userPayload = { onlineUsers: clients.length }; 
  }
  
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
      WHERE ended = false
      ORDER BY start_date ASC
      LIMIT 1
    `;
    const { rows: streamRows } = await client.query(queryStream);

    const startTime = new Date(streamRows[0]?.start_date);
    const videoDuration = streamRows[0]?.video_duration * 1000;
    const scenarioId = streamRows[0]?.scenario_id;

    if (!previousStartTime || previousStartTime?.getTime() !== startTime.getTime()) {
      isScheduled = false;
      previousStartTime = startTime;
    }
    
    if (!isScheduled) {
      console.log(`Планируем расписание онлайна !`);
      isScheduled = true;
      const queryScenario = `
        SELECT scenario_online
        FROM scenario
        WHERE id = $1
      `;
      const { rows: scenarioRows } = await client.query(queryScenario, [scenarioId]);
      const scenarioOnline = JSON.parse(scenarioRows[0]?.scenario_online) || '[]';
      console.log(scenarioOnline);
      firstShowAt = scenarioOnline.length > 0 ? scenarioOnline[0].time : null;
      console.log('firstShowAt',firstShowAt);
      const switchTime = new Date(previousStartTime.getTime() + firstShowAt * 1000);
      console.log('switchTime',switchTime);
      
      if (!schedule.scheduledJobs[`broadcast-switch-time-${switchTime.getTime()}`]) {
        console.log('Создаем задачу для переключения онлайн статуса на:', switchTime);
        schedule.scheduleJob(`broadcast-switch-time-${switchTime.getTime()}`, switchTime, () => {
          currentOnlineUsers = clients.length; 
          broadcastOnlineUsers(currentOnlineUsers);
          console.log('55555555555555555555555555');
        });
      } else {
        console.log('Задача уже существует для:', switchTime);
      }

      scenarioOnline.forEach(({ time, count }) => {
        const scheduleTime = new Date(startTime.getTime() + time * 1000);
        console.log('Планируем задачу на время:', scheduleTime);
        
        if (!schedule.scheduledJobs[`users-${scheduleTime.getTime()}`]) {
          console.log('Создаем задачу для количества пользователей:', count);
          schedule.scheduleJob(`users-${scheduleTime.getTime()}`, scheduleTime, () => {
            currentOnlineUsers = count;
            broadcastOnlineUsers(currentOnlineUsers);
            console.log('22222222222222222222');
          });
        }
      });
      endStreamTime = new Date(startTime.getTime() + videoDuration);
      if (!schedule.scheduledJobs[`end-stream-${endStreamTime.getTime()}`]) {
        const endStreamJob = schedule.scheduleJob(`end-stream-${endStreamTime.getTime()}`, endStreamTime, () => {
          broadcastOnlineUsers(currentOnlineUsers);
          console.log('1333333333333333333');
          endStreamJob.cancel();
          console.log('Показываем реальный онлайн', currentOnlineUsers);
        });
      }
    }
    
    console.log('previousStartTime:', previousStartTime);
console.log('firstShowAt:', firstShowAt);
console.log('Расчет switchTime:', new Date(previousStartTime.getTime() + firstShowAt * 1000));
    // Создаем поток данных для SSE
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    clients.push(writer);

    const serverTime = new Date();
    const switchTime = new Date(previousStartTime.getTime() + firstShowAt * 1000);

    // Если текущее время после switchTime, отправляем данные из сценария, иначе — реальное количество клиентов
    if (serverTime >= switchTime) {
      writer.write(`data: ${JSON.stringify({ onlineUsers: currentOnlineUsers })}\n\n`);
    } else {
      writer.write(`data: ${JSON.stringify({ onlineUsers: clients.length })}\n\n`);
    }

    const onClose = () => {
      const index = clients.indexOf(writer);
      if (index !== -1) {
        clients.splice(index, 1);
      }

      if (serverTime >= switchTime) {
        currentOnlineUsers = currentOnlineUsers; 
      } else {
        currentOnlineUsers = clients.length; 
      }

      broadcastOnlineUsers(currentOnlineUsers);
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
