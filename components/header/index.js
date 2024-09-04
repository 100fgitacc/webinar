
import { useRouter } from 'next/navigation';
import styles from './index.module.css';
import Image from 'next/image';
import Link from 'next/link';
const Header = ({ isAdmin,userOnline }) => {
  const router = useRouter();

  const handleLogout = async (event) => {
    event.preventDefault(); // Предотвратить стандартное действие

    try {
      // Отправка запроса на сервер для удаления куки
      await fetch('/api/user_logout', {
        method: 'POST',
      });
      window.location.reload();
    } catch (error) {
      console.error('Ошибка при выходе:', error);
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles['members-count']}>
        <Image className={styles.icon} src='/assets/img/fluent_person-20-filled.png' alt='icon' width={17} height={17} />
        <p>Участники</p>
        <div className={styles.count}>
          <p>{userOnline || 0}</p>
          <p>/</p>
          <p>300</p>
        </div>
      </div>
      <Image className={styles.logo} src='/assets/img/logo.png' alt='logo' width={57} height={17}/>
     
        <nav>
          <ul className={styles.nav}>
          
              {/* <li>
                <Link href='/config'>
                  <Image className={styles.icon} src='/assets/img/config.png' alt='icon' width={17} height={17}/>
                    Настройки
                  </Link>
              </li>  */}
             {isAdmin && (
            <li>
              <a href="#" onClick={handleLogout} className={styles.logoutButton}>
                <Image className={styles.icon} src='/assets/img/exit.png' alt='icon' width={17} height={17}/>
                Выход
              </a>
            </li>
           )}
          </ul>
        </nav>
     
    </header>
  );
};

export default Header;
