import React, { useEffect, useRef, useState } from 'react';
import Player from '@vimeo/player';
import styles from './index.module.css';
import axios from 'axios';

const VimeoPlayer = ({ startStream, delayTime }) => {
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const [player, setPlayer] = useState(null);
  const [isPlayed, setIsPlayed] = useState(false);
  const [quality, setQuality] = useState('720p');
  const [showPopup, setShowPopup] = useState(false);
  const [streamStatus, setStreamStatus] = useState(null);
  const [playerWidth, setPlayerWidth] = useState(null);
  const [timings, setTimings] = useState([]);
  const [message, setMessage] = useState('');
  const [dataFetched, setDataFetched] = useState(false);

  // Инициализация плеера
  useEffect(() => {
    if (playerRef.current && !player) {
      console.log('Инициализация нового плеера...');
      const newPlayer = new Player(playerRef.current, {
        id: startStream.video_id,
        width: playerWidth,
        height: playerWidth * (480 / 855),
        controls: false,
        keyboard: false,
        quality,
      });
  
      setPlayer(newPlayer);
  
      newPlayer.on('loaded', () => {
        console.log('Плеер загружен');
        if (streamStatus === 'inProgress') {
          newPlayer.setCurrentTime(delayTime).then(() => {
            console.log('Текущее время плеера установлено:', delayTime);
          }).catch((error) => {
            console.error('Ошибка при установке времени плеера после загрузки:', error);
          });
        }
      });
  
      // Событие окончания видео
      newPlayer.on('ended', () => {
        console.log('Видео завершено, обновляем статус на ended');
        setStreamStatus((prevStatus) => {
          console.log('Предыдущее состояние:', prevStatus);
          
          if (typeof prevStatus !== 'object') {
            console.error('Ошибка: предыдущий статус не является объектом');
            return { ...startStream, streamStatus: 'ended' };
          }
  
          return {
            ...prevStatus,
            streamStatus: 'ended'
          };
        });
      });
  
      newPlayer.on('error', (error) => {
        console.error('Ошибка Vimeo плеера:', error);
      });
    }
  
    console.log('Текущий статус потока:', streamStatus);
  
    // Обновляем плеер при изменении streamStatus
    setStreamStatus(startStream.streamStatus);
  
  }, [player, startStream, quality, streamStatus]);

  // Этот useEffect отвечает за воспроизведение и остановку в зависимости от статуса
  useEffect(() => {
    if (player && streamStatus === 'inProgress' && !isPlayed) {
      console.log('Стрим в процессе, воспроизведение...');
      player.play().then(() => {
        setIsPlayed(true);
        console.log('Воспроизведение начато.');
      }).catch((error) => {
        console.error('Ошибка при воспроизведении плеера:', error);
      });
    }

    if (player && streamStatus === 'ended') {
      console.log('Стрим завершён, останавливаем воспроизведение...');
      player.pause().then(() => {
        setIsPlayed(false);
      }).catch((error) => {
        console.error('Ошибка при паузе плеера:', error);
      });
    }
  }, [player, streamStatus, isPlayed]);

  // Запрос данных по сценарию
  useEffect(() => {
    if (startStream && startStream.scenario_id && !dataFetched) {
      console.log('Выполняем запрос на получение сценария...');
      axios.post('/api/get_sales', { scenarioId: startStream.scenario_id })
        .then(response => {
          const { scenario_sales } = response.data;
          if (scenario_sales && scenario_sales.length > 0) {
            const { showAt, text } = scenario_sales[0];
            setTimings(showAt);
            setMessage(text);
            console.log('Сценарий получен:', scenario_sales);
          }
          setDataFetched(true); 
        })
        .catch(error => {
          setDataFetched(true);
          console.error('Ошибка при выполнении запроса:', error);
        });
    }
  }, [startStream, dataFetched]);

  // Обработка нажатия на кнопку play
  const handlePlayClick = () => {
    if (player) {
      player.setCurrentTime(delayTime).then(() => {
        console.log("Успешно установлено время:", delayTime);
  
        player.play().then(() => {
          console.log("Плеер начал воспроизведение с времени:", delayTime);
          setIsPlayed(true);
        }).catch((error) => {
          console.error('Ошибка при запуске воспроизведения:', error);
        });
      }).catch((error) => {
        console.error('Ошибка при установке текущего времени:', error);
      });
    } else {
      console.error("Экземпляр плеера не найден.");
    }
  };

  // Обработка изменения качества
  const handleQualityChange = (event) => {
    const selectedQuality = event.target.value;
    console.log('Изменение качества на:', selectedQuality);
    if (player) {
      player.setQuality(selectedQuality).then(() => {
        setQuality(selectedQuality);
        console.log('Качество изменено на:', selectedQuality);
      }).catch((error) => {
        console.error('Ошибка при изменении качества:', error);
      });
    }
  };

  // Установка размеров плеера
  useEffect(() => {
    if (containerRef.current) {
      const width = containerRef.current.offsetWidth;
      setPlayerWidth(width); 
      console.log('Ширина плеера установлена:', width);
    }
  }, [playerRef]);

  const renderStreamStatus = () => {
    switch (streamStatus) {
      case 'notStarted':
        return (
          <div className={styles['stream-not-started']}>
            <>Трансляция начнётся через: {startStream.countdown}</>
          </div>
        );
      case 'inProgress':
        return (
          <>
            <div ref={playerRef} className={styles.player}>
              {!isPlayed && (
                <div className={styles['play-btn-container']} onClick={handlePlayClick}>
                  <button className={styles['play-btn']} ></button>
                </div>
              )}
              <div className={styles['quality-selector']}>
                <label htmlFor="quality">Quality: </label>
                <select id="quality" onChange={handleQualityChange} value={quality}>
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                  <option value="540p">540p</option>
                  <option value="360p">360p</option>
                  <option value="240p">240p</option>
                </select>
              </div>
            </div>
          </>
        );
      case 'ended':
        return (
          <div className={styles['stream-end']}>
            <p>Трансляция завершена</p>
          </div>
        );
      default:
        return <div className={styles['stream-end']}></div>;
    }
  };

  return (
    <div ref={containerRef} className={styles.player}>
      {renderStreamStatus()}
      <div className={`${styles.popup} ${showPopup ? styles.showPopup : ''}`}>
        {message}
      </div> 
    </div>
  );
};

export default VimeoPlayer;
