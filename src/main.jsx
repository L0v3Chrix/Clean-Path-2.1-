import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import ApplicationErrorBoundary from '@/components/ApplicationErrorBoundary.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <ApplicationErrorBoundary>
    <App />
  </ApplicationErrorBoundary>
)
