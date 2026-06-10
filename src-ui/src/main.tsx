import React from 'react'
import ReactDOM from 'react-dom/client'
import { HeroUIProvider } from '@heroui/react'
import App from './App'
import './index.css'

if (localStorage.getItem('theme') !== 'light') {
  document.documentElement.classList.add('dark')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HeroUIProvider>
      <main className="text-foreground bg-background min-h-screen">
        <App />
      </main>
    </HeroUIProvider>
  </React.StrictMode>,
)
