import React from 'react';
import { s } from './style';

// 日本語は語の途中でも改行されてしまう。意味のかたまりごとに
// inline-block で包んで、変なところで折れないようにする。
export function Jp({ parts, style }) {
  return (
    <span style={s(style)}>
      {parts.map((t, i) => (
        <span key={i} style={s('display:inline-block')}>{t}</span>
      ))}
    </span>
  );
}
