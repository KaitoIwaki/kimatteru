import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { Guard, watchErrors } from './guard.jsx';
import './styles.css';

// 描画中のエラーで真っ白にならないように、アプリ全体を Guard で包む（guard.jsx）
watchErrors();
// iPhone の WebView では、どこかで touchstart を聞いていないと :active（押しているあいだの見た目）が効かない
document.addEventListener('touchstart', () => {}, { passive: true });
ReactDOM.createRoot(document.getElementById('root')).render(<Guard><App /></Guard>);
