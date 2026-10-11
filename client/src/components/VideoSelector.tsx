import React, { useState } from 'react';
import { Role } from '../types/index';
import { extractYouTubeVideoId } from '../utils/youtube';
import { Video, ArrowRight, AlertCircle } from 'lucide-react';

interface VideoSelectorProps {
  currentVideoId: string | null;
  userRole: Role;
  onChangeVideo: (videoId: string) => void;
}

export const VideoSelector: React.FC<VideoSelectorProps> = ({
  currentVideoId,
  userRole,
  onChangeVideo,
}) => {
  const isAuthorized = userRole === 'HOST' || userRole === 'MODERATOR';
  const [inputUrl, setInputUrl] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorized) return;

    const extractedId = extractYouTubeVideoId(inputUrl);
    if (!extractedId) {
      setErrorMsg('Invalid YouTube URL or Video ID. Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      return;
    }

    setErrorMsg(null);
    onChangeVideo(extractedId);
    setInputUrl('');
  };

  return (
    <div className="video-selector-card">
      <div className="card-header">
        <div className="card-title">
          <Video className="card-icon" />
          <h3>{currentVideoId ? 'Change Video' : 'Select Video'}</h3>
        </div>
        <span className="current-video-chip">Current ID: {currentVideoId || 'None'}</span>
      </div>

      <form onSubmit={handleSubmit} className="video-input-form">
        <div className="input-group">
          <input
            type="text"
            placeholder={
              isAuthorized
                ? 'Paste YouTube URL or Video ID (e.g. https://www.youtube.com/watch?v=...)'
                : 'Only Host or Moderators can change video'
            }
            value={inputUrl}
            onChange={(e) => {
              setInputUrl(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            disabled={!isAuthorized}
            className="video-url-input"
          />
          <button
            type="submit"
            disabled={!isAuthorized || !inputUrl.trim()}
            className="submit-video-btn"
          >
            <span>Change Video</span>
            <ArrowRight className="btn-icon" />
          </button>
        </div>
        {errorMsg && (
          <div className="input-error-msg">
            <AlertCircle className="error-icon" />
            <span>{errorMsg}</span>
          </div>
        )}
      </form>
    </div>
  );
};
