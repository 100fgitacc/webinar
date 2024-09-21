"use client";
import React, { useState, useEffect } from 'react';
import VimeoPlayer from '/components/vimeoPlayer';
import Header from '/components/header';
import Chat from '/components/chat';
import styles from './index.module.css';
import Link from 'next/link';
import Cookies from 'js-cookie';
import { decodeJwt } from 'jose';
import axios from 'axios';
import Image from 'next/image';

const HomePage = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [startStream, setStartStream] = useState({
    startTime: null,
    streamStatus: '',
    countdown: null,
  });
  const [userName, setUserName] = useState(null);
  const [userOnline, setUserOnline] = useState(null);
  const [counter, setCounter] = useState(null);
  const [windowWidth, setWindowWidth] = useState(0);

  const getStreamData = async () => {
    try {
      const response = await axios.get('/api/streams', { headers: { 'Cache-Control': 'no-cache' } });
      const newData = response.data;
      
      const { start_date, video_duration, scenario_id, video_id, button_show_at, serverTime} = newData;
      
      return { start_date, video_duration, scenario_id, video_id, button_show_at, serverTime };
    } catch (error) {
      console.error('Error fetching stream data:', error);
      return {};
    }
  };
  const [delayTime, setDelayTime] = useState(null);

  const initializeStream = async () => {
    try {
      const streamsData = await getStreamData();
  
      if (!streamsData || !streamsData.start_date) {
        console.error('No streams data available');
        return;
      }
      
      const { start_date, video_duration, scenario_id, video_id, button_show_at, serverTime } = streamsData;
  
      const startTime = new Date(start_date);
  
      if (isNaN(startTime.getTime())) {
        console.error('Invalid start date');
        return;
      }
  
      const now = new Date(serverTime);
      const duration = video_duration || 0;
      const streamEndTime = new Date(startTime);
      streamEndTime.setSeconds(streamEndTime.getSeconds() + duration);
      const streamEndSeconds = streamEndTime.getTime();
  
      let streamStatus = '';
      if (now < startTime) {
        streamStatus = 'notStarted';
      } else if (now > streamEndSeconds) {
        streamStatus = 'ended';
      } else {
        streamStatus = 'inProgress';
      }
  
      const clientTimeAtStart = Date.now();
      const serverTimeAtStart = new Date(serverTime).getTime();
      const timeDifference = clientTimeAtStart - serverTimeAtStart;
  
      setStartStream(prevState => {
        const updatedState = {
          ...prevState,
          startTime,
          streamStatus,
          scenario_id,
          video_id,
          button_show_at,
          serverTime,
          timeDifference,  
        };
  
        if (streamStatus !== 'ended') {
          updatedState.streamEndSeconds = streamEndSeconds;
        }
        startInternalTimer(startTime, button_show_at);
        return updatedState;
      });
  
      if (streamStatus === 'notStarted') {
        const interval = setInterval(() => {
          const now = Date.now() - timeDifference;  
          const timeDifferenceFromStart = startTime - now;
  
          if (timeDifferenceFromStart <= 0) {
            clearInterval(interval);
            setStartStream(prevState => ({
              ...prevState,
              countdown: '00:00:00',
              streamStatus: 'inProgress'
            }));
          } else {
            const hours = Math.floor(timeDifferenceFromStart / (1000 * 60 * 60));
            const minutes = Math.floor((timeDifferenceFromStart % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeDifferenceFromStart % (1000 * 60)) / 1000);
            setStartStream(prevState => ({
              ...prevState,
              countdown: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
            }));
          }
        }, 1000);
      }
  
    } catch (error) {
      console.error('Error initializing stream:', error);
    }
  };
  

  useEffect(() => {
      // Вычисляем начальную задержку только один раз
      const initialDelay = Math.round((Date.now() - startStream.startTime + startStream.timeDifference) / 1000);
      setDelayTime(initialDelay);
      
      const interval = setInterval(() => {
        setDelayTime((prevDelayTime) => {
          // Если значение отрицательное, увеличиваем его к 0
          if (prevDelayTime < 0) {
            return prevDelayTime + 1;
          }
         
          return prevDelayTime + 1;
        });
      }, 1000);
  
      // Очищаем интервал при размонтировании компонента
      return () => clearInterval(interval);
  }, [startStream.startTime]);
    
  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowWidth(window.innerWidth);

      const handleResize = () => setWindowWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);

      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  useEffect(() => {
    const token = Cookies.get('authToken');

    if (token) {
      try {
        const decodedToken = decodeJwt(token);
        const currentTime = Date.now() / 1000;
        if (decodedToken.exp < currentTime) {
          Cookies.remove('authToken');
          window.location.href = '/';
        } else {
          if (decodedToken.is_admin === 1) {
            setIsAdmin(true);
          }else{
            setUserName(decodedToken.name)
          }
        }
      } catch (error) {
        console.error('Ошибка при декодировании токена:', error);
        handleLogout();
        window.location.href = '/';
      }
    }
    initializeStream();
  }, []);
 

  const handleLogout = async () => {
    try {
      await fetch('/api/user_logout', {
        method: 'POST',
        credentials: 'include',
      });
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleClientsCount = (e) => {
    setUserOnline(e);
  };
  useEffect(() => {
    // Функция для установки высоты видимой области экрана
    const setViewportHeight = () => {
      let vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    
    };
  
    setViewportHeight();
  
    window.addEventListener('resize', setViewportHeight);
    return () => {
      window.removeEventListener('resize', setViewportHeight);
    };
  }, []);
  const [showButton, setShowButton] = useState(false);

  const startInternalTimer = (startTime, buttonShowAt) => {
    const interval = setInterval(() => {
      const now = new Date();
      const elapsedTime = Math.max((now - startTime) / 1000, 0); 
      
      if (elapsedTime >= buttonShowAt) {
        setShowButton(true);
        clearInterval(interval);
      }
    }, 1000);
  };

  const [refreshStreamData, setRefreshStreamData] = useState(null);

  const handleRefreshStreamData = (e) =>{
    setRefreshStreamData(e);
  }
  
  useEffect(() => {
    if (refreshStreamData === true) {
      initializeStream(); 
      
      const eventSource = new EventSource('/api/messages');
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
        } catch (error) {
          console.error('Ошибка при обработке сообщений SSE:', error);
        }
      };
    
      return () => {
        eventSource.close();
      };
    }
    setRefreshStreamData(false);
  }, [refreshStreamData]);

  return (
    <section className={styles.homePage}>
          <Header isAdmin={isAdmin} userOnline={userOnline} />
          <h1 className={styles['main-title']}>
          10+ актуальных сегодня способов заработка на крипте (даже без вложений)
          </h1>
        <div className={styles.container}>
          <div className={styles['player-container']}>
            <VimeoPlayer startStream={startStream}  delayTime={delayTime}/>
            {showButton && (
              <Link className={`${styles["banner-wrapper"]} ${showButton ? styles.show : ''}`} href='https://4.100f.com/web-offer/?utm_source=efir' target="_blank">
                <p className={styles.banner} >Забронировать место</p>
                <span className={styles["banner-underlay"]}></span>
              </Link>
            )}
          </div>
          <div className={styles['comments-container']}>
            {/* <h3 className={styles['comments-title']}>
              КОММЕНТАРИИ <span>({counter ? counter : 0})</span>
            </h3> */}
            <Chat streamEndSeconds={startStream.streamEndSeconds} isAdmin={isAdmin} setClientsCount={handleClientsCount} userName={userName} setMessagesCount={setCounter} setStreamEnded={handleRefreshStreamData}/>
          </div>
        </div>
        {windowWidth >= 525 &&
          <p className={styles.copyright}>
            © 2024 - 100f.com
          </p>
        } 
    </section>
  );
};

export default HomePage;
