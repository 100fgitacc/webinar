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
  const getUsersOnline = async () => {
    const eventSource = new EventSource('/api/get_users_online');
  
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        setUserOnline(data.onlineUsers);
      } catch (error) {
        console.error('Ошибка при обработке сообщений SSE:', error);
      }
    };
    return () => {
      eventSource.close();
    };
  }
  const [delayTime, setDelayTime] = useState(null);

  const initializeStream = async () => {
    try {
      const streamsData = await getStreamData();
      await getUsersOnline();
      if (!streamsData || !streamsData.start_date) {
        console.error('No streams data available');
        return;
      }
      
      const { start_date, video_duration, scenario_id, video_id, button_show_at, serverTime } = streamsData;
  
      const startTime = new Date(start_date);
  
      const now = new Date(serverTime);
      const duration = video_duration || 0;
      const streamEndTime = new Date(startTime);
      streamEndTime.setSeconds(streamEndTime.getSeconds() + duration);
      console.log('now', now);
      console.log('startTime', startTime);

      const streamEndSeconds = streamEndTime.getTime();
      let streamStatus = '';
      if (now < startTime) {
        streamStatus = 'notStarted';
      } 
      else if (now > streamEndSeconds) {
        streamStatus = 'ended';
      }else {
        streamStatus = 'inProcess';
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
          video_duration,
          streamEndSeconds
        };
        
        if (streamStatus !== 'ended') {
          updatedState.streamEndSeconds = streamEndSeconds;
        }
        return updatedState;
      });
  
  
    } catch (error) {
      console.error('Error initializing stream:', error);
    }
  };
 
  

  const [refreshStreamData, setRefreshStreamData] = useState(false);
  console.log(startStream.streamStatus);
  
  useEffect(() => {
    if (startStream.startTime && startStream.timeDifference) {
      const interval = setInterval(() => {
        const now = Date.now() - startStream.timeDifference;
  
        const timeDifferenceFromStart = new Date(startStream.startTime) - now;
        setStartStream(prevState => {
          if (timeDifferenceFromStart <= 0 && prevState.streamStatus === 'notStarted') {
            console.log('11111111111');
  
            return {
              ...prevState,
              countdown: '00:00:00',
              streamStatus: 'inProcess'
            };
          } else {
            const hours = Math.floor(timeDifferenceFromStart / (1000 * 60 * 60));
            const minutes = Math.floor((timeDifferenceFromStart % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeDifferenceFromStart % (1000 * 60)) / 1000);
            return {
              ...prevState,
              countdown: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
            };
          }
        });
  
        // Обновление delayTime
        const clientCurrentTime = Date.now() - startStream.timeDifference;
        const newDelayTime = Math.round((clientCurrentTime - new Date(startStream.startTime).getTime()) / 1000);
        setDelayTime(newDelayTime);
  
      }, 1000);
  
      return () => clearInterval(interval);
    }
  }, [startStream.startTime, startStream.timeDifference, refreshStreamData]);

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
    getUsersOnline();
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

  useEffect(() => {
    if (delayTime >= startStream.button_show_at) {
      setShowButton(true);
    }
    if (delayTime >= startStream.video_duration) {
      setStartStream(prevState => ({
        ...prevState,
        streamStatus: 'ended'
      }));
    }
  }, [delayTime]);
  const handleRefreshStreamData = (e) =>{
    setRefreshStreamData(e);
    console.log(e);
    
  }

  
  useEffect(() => {
    if (refreshStreamData === true) {
      console.log('Стрим завершен, запрашиваеm новые данные');
      initializeStream(); 
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
            <VimeoPlayer startStream={startStream}  delayTime={delayTime} refreshStreamData={refreshStreamData}/>
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
            <Chat streamEndSeconds={startStream.streamEndSeconds} isAdmin={isAdmin} userName={userName} setMessagesCount={setCounter} setStreamEnded={handleRefreshStreamData}/>
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
