import React, { useState, useEffect, useRef } from 'react';
import styles from './index.module.css';
import Cookies from 'js-cookie';
import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import UserLogin from '/components/login_popup';
import { decodeJwt } from 'jose';
import 'animate.css';
const MySwal = withReactContent(Swal)

const Chat = ({ isAdmin, setClientsCount, userName, setMessagesCount, streamEndSeconds}) => {
 
  const [currentName, setCurrentName] = useState('');
  const [comment, setComment] = useState('');
  const [visibleMessages, setVisibleMessages] = useState([]);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    const eventSource = new EventSource('/api/messages');
  
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.messageId !== undefined && data.pinned !== undefined) {
          // Если пришло обновление статуса pinned
          setVisibleMessages((prevMessages) =>
            prevMessages.map((msg) =>
              msg.id === data.messageId ? { ...msg, pinned: data.pinned } : msg
            )
          );
        } else if (data.messages && data.messages.length > 0) {
          // Если пришли новые сообщения
          setVisibleMessages((prevMessages) => [
            ...prevMessages,
            ...data.messages
          ]);
          setClientsCount(data.clientsCount);
        }
      } catch (error) {
        console.error('Ошибка при обработке сообщений SSE:', error);
      }
    };
  
    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (!isUserScrolling) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [visibleMessages, isUserScrolling]);

  const handleCommentChange = (e) => {
    setComment(e.target.value);
  };

  const handleMessageSend = async () => {
    if (comment.trim() === '') return;

    const tempMessage = {
      id: Date.now(),
      sender: !isAdmin ? userName || currentName : 'Модератор',
      text: comment.replace(/\n/g, '\\n'),
      sending_time: new Date().toISOString(),
      pinned: false
    };

    setComment('');

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newMessages: [tempMessage] })
      });

      if (response.ok) {
        const serverResponse = await response.json();
        // console.log('Ответ сервера с сообщением:', serverResponse);
      } else {
        console.error('Ошибка при отправке сообщения');
      }
    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error);
     
    }
  };

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      setIsUserScrolling(scrollTop + clientHeight < scrollHeight - 50);
    }
  };

  const handlePinMessage = async (message) => {
    const updatedMessages = visibleMessages.map((msg) =>
      msg.id === message.id ? { ...msg, pinned: true } : msg
    );
    setVisibleMessages(updatedMessages);
  
    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinnedMessageId: message.id,  pinned: true }),
      });
    } catch (error) {
      console.error('Ошибка при закреплении сообщения:', error);
    }
  };
  
  const handleUnpinMessage = async (message) => {
    const updatedMessages = visibleMessages.map((msg) =>
      msg.id === message.id ? { ...msg, pinned: false } : msg
    );
    setVisibleMessages(updatedMessages);
  
    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinnedMessageId: message.id, pinned: false }),
      });
    } catch (error) {
      console.error('Ошибка при откреплении сообщения:', error);
    }
  };
  
  useEffect(() => {
    setMessagesCount((prevCount) => {
      if (prevCount !== visibleMessages.length) {
        return visibleMessages.length;
      }
      return prevCount;
    });
    
  }, [visibleMessages]);


  const [chatState, setChatState] = useState(false);
  const handeChatUnblock = (e) => {
    setChatState(e);
  }

  const popupShow = () => {
    MySwal.fire({
      html: <UserLogin streamEndSeconds={streamEndSeconds} unblockedChat={handeChatUnblock}/>, 
      showCloseButton: true, 
      showConfirmButton: false, 
      customClass: {
        popup: 'my-swal-popup',
      },
      showClass: {
        popup: `
          animate__animated
          animate__fadeInUp
          animate__faster
        `
      },
      hideClass: {
        popup: `
          animate__animated
          animate__fadeOutDown
          animate__faster
        `
      },
      padding: '0px', 
    }).then((result) => {
      if (result.isConfirmed) {
        console.log('Пользователь подтвердил действие');
      }
    });
  
  }
  useEffect(() => {
    const token = Cookies.get('authToken');
    if (token) {
    const decodedToken = decodeJwt(token);
    setCurrentName(decodedToken.name);
    }
    if (chatState || token) {
      setChatState(true);
    }
  }, [chatState]);
 
  
  return (
    <div className={styles['chat-wrapper']}>
      <div className={styles['chat-inner']} ref={chatContainerRef} onScroll={handleScroll}  style={{ overflowY: 'auto', height: '100%' }}>
        {visibleMessages.length > 0 ? (
          visibleMessages.map((mess) => (
            <div
              className={`${styles.message} ${mess.pinned ? styles['pinned-message'] : ''}`}
              key={mess.id}
            >
              <div className={styles['message-data']}>
                <p className={styles['sender-name']}>{mess.sender}</p>
                <p className={styles['sending-time']}> {new Date(mess.sending_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <div className={styles['pinned-controls']}>
                {isAdmin && (
                  !mess.pinned ? (
                    <button className={styles['pin-btn']} onClick={() => handlePinMessage(mess)}>
                     
                    </button>
                  ) : (
                    <button className={styles['unpin-btn']} onClick={() => handleUnpinMessage(mess)}>
                  
                    </button>
                  )
                )}
                <p className={styles['message-text']}>
                  {mess.text.replace(/\\n/g, '\n').split('\n').map((line, index) => (
                    <React.Fragment key={index}>
                      {line}
                      <br />
                    </React.Fragment>
                  ))}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p>Нет сообщений</p>
        )}
        <div ref={chatEndRef} />
      </div>
      
        <form>
          <div className={styles['form-input']}>
            <textarea 
              className={styles.textarea} 
              placeholder='Ваш комментарий' 
              value={comment} 
              onChange={handleCommentChange}
              disabled={!chatState}
            ></textarea>
          </div>
          <button disabled={!chatState} type='button' className={styles.btn} onClick={handleMessageSend}>
            Отправить
          </button>
        </form>
        {!chatState && (<a className={styles['chat-login-btn']} onClick={()=>popupShow()}>Авторизуйтесь что бы оставлять комментарии</a>
        )}
       
    </div>
  );
};

export default Chat;
