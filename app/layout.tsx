export const metadata = {
  title: "GoalSet",
  description: "Goal tracking app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "#080c14",
          minHeight: "100dvh",
        }}
      >
        {children}
      </body>
    </html>
  );
}