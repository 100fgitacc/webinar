import { NextResponse } from 'next/server';
import schedule from 'node-schedule';
import pool from '/app/connection'; 
let isScheduled = false;
let previousStartTime = null;

const clients = []; 

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

    const startTime = streamRows[0]?.start_date; 
    const scenarioId = streamRows[0]?.scenario_id;
    const videoDuration = streamRows[0]?.video_duration * 1000;

    if (!startTime || !scenarioId) {
      throw new Error('Не удалось найти время начала или ID сценария');
    }

    if (previousStartTime !== startTime) {
      isScheduled = false;
      previousStartTime = startTime; 
    }

    if (!isScheduled) {
      console.log(`Планируем задачи для стрима, начавшегося в ${startTime}`);
      isScheduled = true;
      
      const queryScenario = `
        SELECT scenario_text
        FROM scenario
        WHERE id = $1
      `;
      const { rows: scenarioRows } = await client.query(queryScenario, [scenarioId]);
      const commentsSchedule = scenarioRows[0]?.scenario_text || '[]';

      commentsSchedule.forEach(({ showAt, text, sender, pinned, isAdmin }) => {
        const scheduleTime = new Date(startTime).getTime() + showAt * 1000;
        
        if (!schedule.scheduledJobs[`${text}-${scheduleTime}`]) { 
          
          schedule.scheduleJob(`${text}-${scheduleTime}`, new Date(scheduleTime), async () => {

            const taskClient = await pool.connect(); 
            try {
              const message = {
                id: Date.now(),
                sender,
                text,
                sending_time: new Date().toISOString(),
                pinned: pinned || false,
                isadmin: isAdmin
              };
              
              await saveMessageToDb(message, taskClient);
              broadcastMessages([message]);
            } catch (error) {
              console.error('Ошибка во время выполнения запланированного задания:', error);
            } finally {
              taskClient.release(); 
            }
          });
        } 
        // else {
        //   console.log(`Задача для сообщения "${text}" уже запланирована, пропускаем.`);
        // }
      });

      const videoEndTime = new Date(startTime).getTime() + videoDuration;
      if (!schedule.scheduledJobs['saveAndClearMessages']) {
        console.log(`Планируем задачу очистки сообщений на время ${new Date(videoEndTime)}`);
        
        schedule.scheduleJob('saveAndClearMessages', new Date(videoEndTime), async () => {
          console.log(`Выполняем задачу по сохранению и очистке сообщений`);
          
          const taskClient = await pool.connect(); 
          try {
            const messagesQuery = 'SELECT * FROM messages ORDER BY sending_time ASC';
            const { rows: messages } = await taskClient.query(messagesQuery);
        
            const saveQuery = `
              INSERT INTO archived_messages (messages)
              VALUES ($1)
            `;
            await taskClient.query(saveQuery, [JSON.stringify(messages)]);
        
            console.log('Все сообщения сохранены в таблице archived_messages.');
        
            // Логируем установку задачи на удаление через 5 секунд
            const clearMessagesTime = new Date(Date.now() + 5000);
            console.log('Запланирована задача по удалению сообщений на:', clearMessagesTime);
            
            schedule.scheduleJob('clearMessages', clearMessagesTime, async () => {
              console.log('Начинаю задачу по удалению сообщений');
              
              const deleteClient = await pool.connect(); 
              try {
                console.log('Удаляем сообщения из таблицы messages...');
                
                const deleteQuery = 'DELETE FROM messages';
                const result = await deleteClient.query(deleteQuery);
                
                console.log(`Удалено строк: ${result.rowCount}`);
                console.log('Все сообщения успешно удалены из таблицы messages.');
                broadcastMessages([], null, true);
              } catch (error) {
                console.error('Ошибка при очистке таблицы сообщений:', error);
              } finally {
                deleteClient.release();
              }
            });
        
          } catch (error) {
            console.error('Ошибка при сохранении сообщений в архив:', error);
          } finally {
            taskClient.release(); 
          }
        });
      } else {
        console.log('Задача "saveAndClearMessages" уже существует, пропускаем.');
      }
    }

    console.log('Текущие запланированные задачи:', Object.keys(schedule.scheduledJobs));

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    clients.push(writer);
    const currentMessages = await loadMessagesFromDb();
    writer.write(`data: ${JSON.stringify({ messages: currentMessages, clientsCount: clients.length })}\n\n`);

    const onClose = () => {
      clients.splice(clients.indexOf(writer), 1);
      broadcastMessages(); 
    };
    writer.closed.then(onClose, onClose);

    const response = new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Ошибка при запуске потока' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request) {
  
  try {
    const body = await request.json();
    const { newMessages = [], pinnedMessageId, pinned, sender } = body;
    if (pinnedMessageId !== undefined) {
      await updatePinnedStatus(pinnedMessageId, pinned);
    }else{
      let message = newMessages[0];
      message.id = new Date().now();
      message.sending_time = new Date().toISOString();

      await saveMessageToDb(message);

      broadcastMessages([message], sender);
    }
    return NextResponse.json({ message: 'Сообщение обновлено' });
  } catch (error) {
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
async function updatePinnedStatus(messageId, pinned) {
  const client = await pool.connect();
  try {
    const updateQuery = 'UPDATE messages SET pinned = $1 WHERE id = $2';
    await client.query(updateQuery, [pinned, messageId]);
    await updateAndBroadcastPinnedStatus(messageId, pinned);
  } catch (error) {
  } finally {
    client.release();
  }
}
async function updateAndBroadcastPinnedStatus(messageId, pinned) {
  try {
    const messagePayload = {
      messageId,
      pinned
    };

    const messageData = `data: ${JSON.stringify(messagePayload)}\n\n`;

    clients.forEach((client) => {
      client.write(messageData).catch(err => {
        const clientIndex = clients.indexOf(client);
        if (clientIndex !== -1) {
          clients.splice(clientIndex, 1);
        }
      });
    });

  } catch (error) {
    console.error('Ошибка при обновлении и трансляции статуса закрепленного сообщения:', error);
  }
}
async function broadcastMessages(newMessages = [], excludeSender, streamEnded = false) {
  try {
    const messagePayload = {
      messages: excludeSender
        ? newMessages.filter(msg => msg.sender !== excludeSender)
        : newMessages.map(msg => ({
            ...msg,
            id: msg.id.toString() ,
            streamEnded
          })),
      clientsCount: clients.length
    };
    const messageData = `data: ${JSON.stringify(messagePayload)}\n\n`;

    clients.forEach((client) => {
      client.write(messageData).catch(err => {
        const clientIndex = clients.indexOf(client);
        if (clientIndex !== -1) {
          clients.splice(clientIndex, 1);
        }
      });
    });

  } catch (error) {
    console.error('Ошибка в процессе трансляции сообщений:', error);
  }
}

async function saveMessageToDb(message) {
  const client = await pool.connect();
  try {

    const insertQuery = `
      INSERT INTO messages (id, sender, text, sending_time, pinned, isadmin)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await client.query(insertQuery, [
      message.id,
      message.sender,
      message.text,
      new Date().toISOString(), 
      message.pinned,
      message.isadmin,
    ]);
  } catch (error) {
    console.error('Ошибка при сохранении сообщения в базе данных:', error);
  } finally {
    client.release();
  }
}
async function loadMessagesFromDb() {
  const client = await pool.connect();
  try {
    const query = 'SELECT * FROM messages ORDER BY sending_time ASC';
    const { rows } = await client.query(query);
    return rows;
  } catch (error) {
    console.error('Ошибка при загрузке сообщений из базы данных:', error);
    return [];
  } finally {
    client.release();
  }
}
