import './globals.css';

export const metadata = {
  title: 'Do it! — a to-do list that means business',
  description: 'Write it down, check it off, get it done.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="theme-light">{children}</body>
    </html>
  );
}
