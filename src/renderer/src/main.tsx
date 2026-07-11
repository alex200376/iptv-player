import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'
import './i18n'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18n'

window.electronAPI.getSettings().then((settings) => {
  if (settings.language) {
    i18n.changeLanguage(settings.language)
  }
  document.documentElement.lang = settings.language || 'zh-CN'
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </React.StrictMode>,
)
