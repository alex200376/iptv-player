import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'
import './i18n'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18n'
import ErrorBoundary from './components/ErrorBoundary'

window.electronAPI.getSettings().then((settings) => {
  if (settings.language) {
    i18n.changeLanguage(settings.language)
  }
  document.documentElement.lang = settings.language || 'zh-CN'
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandledRejection]', event.reason)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
