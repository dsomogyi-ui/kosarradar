import "./globals.css";
export const metadata = { title:"KosárRadar", description:"Bevásárlólista és ár-összehasonlítás" };
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="hu"><body>{children}</body></html>;
}
