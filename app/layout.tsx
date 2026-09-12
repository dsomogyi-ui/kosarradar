import { AccountProvider } from '../components/account-provider';
import "./globals.css";
export const metadata={title:"KosárRadar – Hol éri meg vásárolni?",description:"Bevásárlólista és üzletenkénti kosár-összehasonlítás a GVH Árfigyelő árai alapján.",icons:{icon:"/icon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="hu"><body><AccountProvider>{children}</AccountProvider></body></html>}
