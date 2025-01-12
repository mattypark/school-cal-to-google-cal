'use client'
import { useState } from 'react';

export default function AddEventsButton() {
  const [url, setUrl] = useState('');

  const handleAddEvents = async () => {
    const response = await fetch('/api/events/addEvents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();
    if (response.ok) {
      alert(data.message);
    } else {
      alert(data.error);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter calendar URL"
      />
      <button onClick={handleAddEvents}>Add to Calendar</button>
    </div>
  );
} 