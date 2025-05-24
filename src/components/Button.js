// components/Button.js

import React from 'react'; // Vẫn cần import React nếu bạn dùng JSX

const Button = ({ children, onClick, className }) => {
  return (
    <button
      onClick={onClick} // Bạn có thể thêm event handler trực tiếp ở đây
      className={`px-4 py-2 rounded-md font-medium text-white bg-blue-500 hover:bg-blue-600 ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;