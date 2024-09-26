"use client";
import React, { useEffect, useRef, useState } from 'react';
import Player from '@vimeo/player';
import styles from './index.module.css';
import axios from 'axios';

const VimeoPlayer = ({ startStream, delayTime }) => {
  const playerRef = useRef(null);
  const [test, settest] = useState(null);
  const [test2, settest2] = useState(null);
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


  useEffect(() => {
    setStreamStatus(startStream.streamStatus);
    if(test2){
      if (playerRef.current || test && !player) {
        const newPlayer = new Player(playerRef.current || test, {
          id: startStream.video_id,
          width: playerWidth ,
          height:  playerWidth * (480 / 855), 
          // controls: true,
          controls: false,
          keyboard: false,
          quality,
          
        });
        settest(playerRef.current);
        setPlayer(newPlayer);
  
        newPlayer.on('play', ({}) => {});
        newPlayer.on('loaded', () => {
          console.log('Плеер загружен');
          if (streamStatus === 'inProcess') {
            newPlayer.setCurrentTime(delayTime).catch((error) => {
              console.error('Error setting current time:', error);
            });
          }
        });
       
        newPlayer.on('timeupdate', ({ seconds }) => {
          if (timings.includes(Math.round(seconds))) {
            setShowPopup(true);
            setTimeout(() => setShowPopup(false), 3000);
          }
        });
  
        newPlayer.on('ended', () => {
          setStreamStatus('ended');
          setIsPlayed(false);
        });
  
        newPlayer.on('error', (error) => {
          console.error('Vimeo player error:', error);
        });
      }
    }
    
  }, [player,quality,timings,streamStatus, test2]);

  useEffect(() => {
    if (startStream && startStream.scenario_id && !dataFetched) {
      axios.post('/api/get_sales', { scenarioId: startStream.scenario_id })
        .then(response => {
          const { scenario_sales } = response.data;
          if (scenario_sales && scenario_sales.length > 0) {
            const { showAt, text } = scenario_sales[0];
            setTimings(showAt);
            setMessage(text);
          }
          setDataFetched(true); 
        })
        .catch(error => {
          setDataFetched(true);
          console.error('Ошибка при выполнении запроса:', error);
        });
    }
  }, [startStream, dataFetched]);
  const delayTimeRef = useRef(delayTime);
  
  useEffect(() => {
    if (player) {
      const handleSeeked = (event) => {
        console.log(`Видео перемотано на время: ${event.seconds} секунд`);

        player.getCurrentTime().then((currentTime) => {
          const delayTime = delayTimeRef.current;

          const timeDifference = Math.abs(currentTime - delayTime);

          if (timeDifference > 1) {
            player.setCurrentTime(delayTime).then(() => {
              console.log(`Видео принудительно перемотано на время: ${delayTime} секунд`);
            }).catch((error) => {
              console.error('Ошибка при установке времени:', error);
            });
          }
        });
      };

      player.on('seeked', handleSeeked);

      return () => {
        player.off('seeked', handleSeeked);
      };
    }
  }, [player]);

  useEffect(() => {
    delayTimeRef.current = delayTime;
    if(delayTime && delayTime >= 0){

      console.log('задержка нулевая, запускаем плеер');
      settest2(true);
    }
  }, [delayTime]);
  
  console.log(delayTime);
  
  const handlePlayClick = () => {
    if (player) {
      player.play().then(() => {
      
        setIsPlayed(true);
  
        return player.setCurrentTime(delayTime);
      }).then(() => {
        console.log(`Время установлено на: ${delayTime}`);
      }).catch((error) => {
        console.error('Ошибка при воспроизведении или установке времени:', error);
      });
    } else {
      console.error("Экземпляр плеера не найден.");
    }
  };
  const handleQualityChange = (event) => {
    const selectedQuality = event.target.value;
    if (player) {
      player.setQuality(selectedQuality).then(() => {
        setQuality(selectedQuality);
      }).catch((error) => {
        console.error('Error changing quality:', error);
      });
    }
  };
  useEffect(() => {
    if (containerRef.current) {
      const width = containerRef.current.offsetWidth;
      setPlayerWidth(width); 
    }
  }, [playerRef]);
  const [windowWidth, setWindowWidth] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Функция для изменения состояния ширины окна
      const handleResize = () => {
        setWindowWidth(window.innerWidth);
      };

      const handleTabChange = () => {
        if (window.innerWidth < 1024 && !document.hasFocus()) {
          if (player) {
            player.pause().then(() => {
              setIsPlayed(false);
            }).catch((error) => {
              console.error('Ошибка при попытке поставить видео на паузу:', error);
            });
          }
        }
      };

      // Устанавливаем начальное значение ширины окна
      setWindowWidth(window.innerWidth);

      // Добавляем обработчики событий для смены фокуса и изменения размера окна
      window.addEventListener('resize', handleResize);
      window.addEventListener('blur', handleTabChange);
      window.addEventListener('focus', handleTabChange);

      // Удаляем обработчики при размонтировании компонента
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('blur', handleTabChange);
        window.removeEventListener('focus', handleTabChange);
      };
    }
  }, [player, isPlayed]);
 
  const renderStreamStatus = () => {
    switch (streamStatus) {
      case 'notStarted':
        return (
          <div className={styles['stream-not-started']}>
            <>Трансляция начнётся через: {startStream.countdown}</>
          </div>
        );
      case 'inProcess':
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
