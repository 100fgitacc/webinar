import './fonts.css';
import './globals.css'; 

export const metadata = {
  title: 'Webinar',
  description: 'Description of my app',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}