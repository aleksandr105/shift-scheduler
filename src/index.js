import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Ant Design DatePicker in v5/v6 uses dayjs internally; to localize month/day names
// we must load the dayjs locale data and set the global locale deterministically.
import dayjs from 'dayjs';
import 'dayjs/locale/pl';

dayjs.locale('pl');

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
