import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types/index';
import { MessageSquare, Send } from 'lucide-react';

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
}

export const Chat: React.FC<ChatProps> = ({ messages, onSendMessage }) => {
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
  };

  return (
    <div className="chat-panel-card">
      <div className="card-header">
        <div className="card-title">
          <MessageSquare className="card-icon" />
          <h3>Party Chat</h3>
        </div>
      </div>

      <div className="chat-messages-container">
        {messages.length === 0 ? (
          <div className="empty-chat">No messages yet. Say hello to the room!</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="chat-message-item">
              <div className="chat-msg-header">
                <span className="chat-sender">{m.sender}</span>
                <span className="chat-time">{m.timestamp}</span>
              </div>
              <p className="chat-text">{m.message}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          placeholder="Send a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="chat-input"
        />
        <button type="submit" disabled={!text.trim()} className="chat-send-btn">
          <Send className="btn-icon" />
        </button>
      </form>
    </div>
  );
};
