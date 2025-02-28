'use client';

import React, { useEffect, useState } from 'react';
import {
  Channel,
  ChannelHeader,
  ChannelList,
  MessageInput,
  MessageList,
  Thread,
  Window
} from 'stream-chat-react';

interface ChatInterfaceProps {
  activeChannelId?: string;
}

export const ChatInterface = ({ activeChannelId }: ChatInterfaceProps) => {
  const [filters, setFilters] = useState({
    type: 'messaging',
    members: { $in: [undefined] }
  });

  // Update filters when the user changes
  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem('user-info') || '{}');
    const userId = userInfo.id;
    
    if (userId) {
      setFilters({
        type: 'messaging',
        members: { $in: [userId] }
      });
    }
  }, []);

  return (
    <div className="flex h-[calc(100vh-12rem)] overflow-hidden rounded-lg border shadow">
      <div className="flex h-full w-full">
        <div className="w-64 border-r dark:border-gray-800">
          <ChannelList 
            filters={filters} 
            sort={{ last_message_at: -1 }}
            options={{ state: true, presence: true, limit: 10 }}
          />
        </div>
        <div className="flex-1">
          <Channel>
            <Window>
              <ChannelHeader />
              <MessageList />
              <MessageInput focus />
            </Window>
            <Thread />
          </Channel>
        </div>
      </div>
    </div>
  );
};