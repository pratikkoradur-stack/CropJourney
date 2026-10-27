import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/oswald'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './styles/global.css'
import './styles/screens.css'
import './styles/charts.css'
import './styles/welcome.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
