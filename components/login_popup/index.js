import React, { useState } from 'react';
import axios from 'axios';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import styles from './page.module.css'; 
import Swal from 'sweetalert2';

const UserLogin = ({ streamEndSeconds, unblockedChat }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const phoneDigits = phone.replace(/\D/g, ''); 
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      setError('Пожалуйста, введите корректный номер телефона');
      return;
    }
    setIsLoading(true);
    try {
      const response = await axios.post('/api/user_login', {
        name,
        phone, 
        streamEndSeconds,
        password: null,
        is_admin: 0,
      });
      if (response.status === 200) {
        setSuccess('Авторизация успешна');
        Swal.close(); 
        unblockedChat(true);
      }
    } catch (err) {
      setError('Ошибка авторизации');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit}>
      <p className={styles['popup-title']}>Для защиты от SPAM-комментариев заполните простую форму ниже</p>
        <label htmlFor="name">Имя:</label>
        <input
          type="text"
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isLoading}
        />
        <label htmlFor="phone">Телефон:</label>
        <PhoneInput
          country={'ua'}
          value={phone}
          onChange={phone => setPhone(phone)}
          inputClass={styles.phoneInput}
          buttonClass={styles.phoneButton}
          dropdownClass={styles.phoneDropdown}
          required
          disabled={isLoading}
        />
        
        {isLoading ? (
          <p>Авторизация...</p>
        ) : (
          <button type="submit" className={styles.submitButton}>Включить комментарии</button>
        )}

        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}
      </form>
    </div>
  );
};

export default UserLogin;
