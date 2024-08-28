'use client';

import { useState } from 'react';
import axios from 'axios';
import styles from './index.module.css'; 

const AdminLogin = () => {
  const [username, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const response = await axios.post('/api/admin_login', {
        username,
        password,
        is_admin: 1,
      });
      
      if (response.status === 200) {
        setSuccess('Успешно вошли на вебинар.');
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Ошибка при отправке данных:', err);
      setError('Не удалось войти на вебинар.');
    }
  };

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label htmlFor="username">Логин:</label>
        <input
          type="text"
          id="username"
          name="username"
          value={username}
          onChange={(e) => setUserName(e.target.value)}
          required
          className={styles.input}
        />
        <label htmlFor="password">Пароль:</label>
        <input
          type="password"
          id="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={styles.input}
        />
        <button type="submit" className={styles.button}>Войти</button>

        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}
      </form>
    </div>
  );
}

export default AdminLogin;
