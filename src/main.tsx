import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ImageViewerProvider} from './components/ImageViewerContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ImageViewerProvider>
    <App />
  </ImageViewerProvider>
);
