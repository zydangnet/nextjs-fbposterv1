// components/Counter.js

import React, { useState } from 'react'; // Dùng useState bình thường

const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <div className="flex items-center space-x-4">
      <p>Count: {count}</p>
      <button
        onClick={() => setCount(prev => prev + 1)}
        className="px-4 py-2 rounded-md font-medium text-white bg-green-500 hover:bg-green-600"
      >
        Tăng
      </button>
      <button
        onClick={() => setCount(prev => prev - 1)}
        className="px-4 py-2 rounded-md font-medium text-white bg-red-500 hover:bg-red-600"
      >
        Giảm
      </button>
    </div>
  );
};

export default Counter;