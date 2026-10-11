import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PlayState, Role } from '../types/index';
import { AlertCircle, Lock, Play, Volume2, VolumeX } from 'lucide-react';

interface YouTubePlayerProps {
  videoId: string | null;
  playState: PlayState;
  currentTime: number;
  lastUpdated?: number;
  userRole: Role;
  onPlay: (time: number) => void;
  onPause: (time: number) => void;
  onSeek: (time: number) => void;
  onHeartbeat?: (time: number, isPlaying: boolean) => void;
  getServerTime?: () => number;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  playState,
  currentTime,
  lastUpdated = Date.now(),
  userRole,
  onPlay,
  onPause,
  onSeek,
  onHeartbeat,
  getServerTime,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const instanceIdRef = useRef<string>(`yt-player-${Math.random().toString(36).substring(2, 9)}`);

  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Local audio state for viewer volume/mute control
  const [volume, setVolume] = useState<number>(100);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  /**
   * TIME-WINDOW ECHO-LOOP PREVENTION:
   * Suppresses player events that are triggered by remote programmatic actions
   * (seekTo, playVideo, pauseVideo). Automatically expires after duration.
   */
  const programmaticLockUntilRef = useRef<number>(0);
  const setProgrammaticLock = useCallback((durationMs = 800) => {
    programmaticLockUntilRef.current = Date.now() + durationMs;
  }, []);

  // Store user role in ref to avoid stale closures inside YT event listeners
  const userRoleRef = useRef<Role>(userRole);
  userRoleRef.current = userRole;

  // Track latest props in ref so onReady always applies the freshest state
  const latestStateRef = useRef({ videoId, playState, currentTime, lastUpdated });
  latestStateRef.current = { videoId, playState, currentTime, lastUpdated };

  /**
   * Calculates live computed video time taking into account network latency & elapsed time
   */
  const getComputedTargetTime = useCallback(() => {
    if (playState === 'playing' && lastUpdated) {
      const nowServer = getServerTime ? getServerTime() : Date.now();
      const elapsed = Math.max(0, (nowServer - lastUpdated) / 1000);
      return currentTime + elapsed;
    }
    return currentTime;
  }, [currentTime, playState, lastUpdated, getServerTime]);

  /**
   * Initialize YouTube IFrame Player instance ONCE.
   * Does NOT recreate player when videoId changes; loadVideoById handles video changes.
   */
  const isHostOrMod = userRole === 'HOST' || userRole === 'MODERATOR';

  useEffect(() => {
    let isSubscribed = true;
    let checkInterval: any = null;

    const initPlayer = () => {
      if (!isSubscribed || playerRef.current || !containerRef.current) return;

      try {
        let targetElement = document.getElementById(instanceIdRef.current);
        if (!targetElement) {
          targetElement = document.createElement('div');
          targetElement.id = instanceIdRef.current;
          targetElement.style.width = '100%';
          targetElement.style.height = '100%';
          containerRef.current.appendChild(targetElement);
        }

        const currentHostOrMod = userRoleRef.current === 'HOST' || userRoleRef.current === 'MODERATOR';
        const initialVideo = latestStateRef.current.videoId || 'dQw4w9WgXcQ';

        console.log(`[SYNC] Creating YouTube Player instance (controls=${currentHostOrMod ? 1 : 0}, videoId=${initialVideo})`);

        playerRef.current = new window.YT.Player(instanceIdRef.current, {
          height: '100%',
          width: '100%',
          videoId: initialVideo,
          playerVars: {
            autoplay: 0,
            controls: currentHostOrMod ? 1 : 0,
            disablekb: currentHostOrMod ? 0 : 1,
            modestbranding: 1,
            rel: 0,
            fs: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              if (!isSubscribed) return;
              console.log('[SYNC] YouTube Player onReady fired!');
              setIsPlayerReady(true);
              setIsLoading(false);
              setPlayerError(null);

              try {
                if (typeof event.target.getVolume === 'function') {
                  const initialVol = event.target.getVolume();
                  if (typeof initialVol === 'number') setVolume(initialVol);
                }
                if (typeof event.target.isMuted === 'function') {
                  setIsMuted(event.target.isMuted());
                }
              } catch (e) {
                // ignore
              }

              // Apply latest queued state for joiners
              const state = latestStateRef.current;
              if (state.videoId && state.videoId !== initialVideo) {
                event.target.loadVideoById(state.videoId);
              }

              let targetTime = state.currentTime;
              if (state.playState === 'playing' && state.lastUpdated) {
                const nowServer = getServerTime ? getServerTime() : Date.now();
                const elapsed = Math.max(0, (nowServer - state.lastUpdated) / 1000);
                targetTime += elapsed;
              }

              console.log(`[SYNC] Initializing player onReady: targetTime=${targetTime.toFixed(2)}s, state=${state.playState}`);
              setProgrammaticLock(1000);

              if (targetTime > 0) {
                event.target.seekTo(targetTime, true);
              }

              if (state.playState === 'playing') {
                event.target.playVideo();
                // Check if autoplay was blocked after 1 second
                setTimeout(() => {
                  if (!isSubscribed) return;
                  try {
                    const ytState = event.target.getPlayerState ? event.target.getPlayerState() : -1;
                    if (ytState !== window.YT.PlayerState.PLAYING && ytState !== window.YT.PlayerState.BUFFERING) {
                      console.warn('[SYNC] Autoplay blocked by browser policy on initial ready -> muting to start synchronized playback');
                      event.target.mute();
                      setIsMuted(true);
                      setAutoplayBlocked(true);
                      event.target.playVideo();
                    }
                  } catch (e) {}
                }, 1000);
              } else {
                event.target.pauseVideo();
              }
            },
            onStateChange: (event: any) => {
              if (!isSubscribed) return;
              const playerState = event.data;
              const currentYTTime = event.target.getCurrentTime ? (event.target.getCurrentTime() || 0) : 0;
              const currentRole = userRoleRef.current;

              console.log(`[SYNC] onStateChange: state=${playerState}, time=${currentYTTime.toFixed(2)}, role=${currentRole}`);

              if (playerState === window.YT.PlayerState.PLAYING) {
                setAutoplayBlocked(false);
              }

              // Filter out transient buffering/cued states
              if (
                playerState !== window.YT.PlayerState.PLAYING &&
                playerState !== window.YT.PlayerState.PAUSED &&
                playerState !== window.YT.PlayerState.ENDED
              ) {
                return;
              }

              // Suppress if inside programmatic lock window (echo-guard)
              const now = Date.now();
              if (now < programmaticLockUntilRef.current) {
                console.log(`[SYNC] Echo guard suppressed event (lock active for ${programmaticLockUntilRef.current - now}ms)`);
                return;
              }

              // Host / Moderator native user actions inside iframe
              if (currentRole === 'HOST' || currentRole === 'MODERATOR') {
                if (playerState === window.YT.PlayerState.PLAYING) {
                  console.log(`[SYNC] Host native PLAY detected at ${currentYTTime.toFixed(2)}s -> calling onPlay`);
                  onPlay(currentYTTime);
                } else if (playerState === window.YT.PlayerState.PAUSED) {
                  console.log(`[SYNC] Host native PAUSE detected at ${currentYTTime.toFixed(2)}s -> calling onPause`);
                  onPause(currentYTTime);
                }
              }
            },
            onError: (event: any) => {
              if (!isSubscribed) return;
              setIsLoading(false);
              setIsPlayerReady(true);
              const errorCode = event.data;
              let msg = 'Unable to load YouTube video.';
              if (errorCode === 2) msg = 'Invalid YouTube Video ID or URL parameters.';
              else if (errorCode === 5) msg = 'HTML5 YouTube player error. Please try again.';
              else if (errorCode === 100) msg = 'YouTube video not found or marked private.';
              else if (errorCode === 101 || errorCode === 150) msg = 'Owner does not allow embedded playback on external sites.';
              setPlayerError(msg);
            },
          },
        });
      } catch (err) {
        console.error('[YouTube Player Init Error]', err);
        setIsLoading(false);
        setPlayerError('Failed to initialize YouTube IFrame Player.');
      }
    };

    // Load YouTube IFrame API script if not present
    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const existingCb = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (existingCb) existingCb();
        initPlayer();
      };

      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }

      checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkInterval);
          initPlayer();
        }
      }, 100);
    }

    // Safety timeout to dismiss loading spinner if onReady is delayed
    const loadingTimeout = setTimeout(() => {
      if (isSubscribed && isLoading) setIsLoading(false);
    }, 4000);

    return () => {
      isSubscribed = false;
      if (checkInterval) clearInterval(checkInterval);
      clearTimeout(loadingTimeout);
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
    };
  }, [isHostOrMod]);

  /**
   * Handle Video ID changes seamlessly via loadVideoById
   */
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || !videoId) return;
    const player = playerRef.current;

    try {
      const currentLoadedId = player.getVideoData ? player.getVideoData().video_id : null;
      if (currentLoadedId !== videoId) {
        console.log(`[SYNC] Video changed from ${currentLoadedId} to ${videoId}`);
        setPlayerError(null);
        setProgrammaticLock(1000);
        const target = getComputedTargetTime();
        if (typeof player.loadVideoById === 'function') {
          player.loadVideoById(videoId, target);
          if (playState === 'paused') {
            player.pauseVideo();
          }
        }
      }
    } catch (err) {
      console.error('[SYNC] Error switching video ID:', err);
    }
  }, [videoId, isPlayerReady, playState, getComputedTargetTime, setProgrammaticLock]);

  /**
   * Synchronize Play / Pause / Seek state from Server Broadcasts
   */
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;
    const player = playerRef.current;

    try {
      const targetTime = getComputedTargetTime();
      const playerCurrentTime = typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0;
      const timeDrift = Math.abs(playerCurrentTime - targetTime);

      // Seek to target time if drift exceeds 1.5s
      if (timeDrift > 1.5 && typeof player.seekTo === 'function') {
        console.log(`[SYNC] Programmatic seekTo(${targetTime.toFixed(2)}) [drift=${timeDrift.toFixed(2)}s]`);
        setProgrammaticLock(800);
        player.seekTo(targetTime, true);
      }

      // Synchronize Playback State
      if (playState === 'playing') {
        const playerState = typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1;
        if (playerState !== window.YT.PlayerState.PLAYING && playerState !== window.YT.PlayerState.BUFFERING) {
          console.log(`[SYNC] Programmatic playVideo() [currentYTState=${playerState}]`);
          setProgrammaticLock(800);
          player.playVideo();

          // Autoplay fallback: if player doesn't start playing within 1s, mute & retry
          setTimeout(() => {
            if (!playerRef.current) return;
            try {
              const currentState = playerRef.current.getPlayerState ? playerRef.current.getPlayerState() : -1;
              if (currentState !== window.YT.PlayerState.PLAYING && currentState !== window.YT.PlayerState.BUFFERING) {
                console.warn('[SYNC] Browser blocked unmuted autoplay -> muting player to ensure sync');
                playerRef.current.mute();
                setIsMuted(true);
                setAutoplayBlocked(true);
                playerRef.current.playVideo();
              }
            } catch (e) {}
          }, 1000);
        }
      } else if (playState === 'paused') {
        const playerState = typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1;
        if (playerState !== window.YT.PlayerState.PAUSED && typeof player.pauseVideo === 'function') {
          console.log(`[SYNC] Programmatic pauseVideo() [currentYTState=${playerState}]`);
          setProgrammaticLock(800);
          player.pauseVideo();
        }
      }
    } catch (err) {
      console.error('[SYNC] Error synchronizing playback:', err);
    }
  }, [playState, currentTime, lastUpdated, isPlayerReady, getComputedTargetTime, setProgrammaticLock]);

  /**
   * Host / Moderator Native Scrubber Seek Polling
   */
  const expectedTimeRef = useRef<number>(0);
  const lastTickTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || !isHostOrMod) return;

    expectedTimeRef.current = playerRef.current.getCurrentTime ? (playerRef.current.getCurrentTime() || 0) : 0;
    lastTickTimeRef.current = Date.now();

    const seekPollInterval = setInterval(() => {
      try {
        if (!playerRef.current || typeof playerRef.current.getCurrentTime !== 'function') return;
        const actualTime = playerRef.current.getCurrentTime() || 0;
        const now = Date.now();
        const deltaSeconds = (now - lastTickTimeRef.current) / 1000;
        lastTickTimeRef.current = now;

        const ytState = typeof playerRef.current.getPlayerState === 'function' ? playerRef.current.getPlayerState() : -1;
        if (ytState === window.YT?.PlayerState?.PLAYING) {
          expectedTimeRef.current += deltaSeconds;
        }

        const jump = Math.abs(actualTime - expectedTimeRef.current);
        if (jump > 1.5) {
          if (now < programmaticLockUntilRef.current) {
            expectedTimeRef.current = actualTime;
            return;
          }

          console.log(`[SYNC] Host native scrubber seek detected: jump to ${actualTime.toFixed(2)}s (diff=${jump.toFixed(2)}s)`);
          expectedTimeRef.current = actualTime;
          onSeek(actualTime);
        } else {
          expectedTimeRef.current = actualTime;
        }
      } catch (e) {}
    }, 500);

    return () => clearInterval(seekPollInterval);
  }, [isPlayerReady, isHostOrMod, onSeek]);

  /**
   * Host 5-second Heartbeat
   */
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || !onHeartbeat || !isHostOrMod) return;

    const heartbeatInterval = setInterval(() => {
      try {
        if (!playerRef.current || typeof playerRef.current.getCurrentTime !== 'function') return;
        const cur = playerRef.current.getCurrentTime() || 0;
        const ytState = typeof playerRef.current.getPlayerState === 'function' ? playerRef.current.getPlayerState() : -1;
        const isPlaying = ytState === window.YT?.PlayerState?.PLAYING;
        onHeartbeat(cur, isPlaying);
      } catch (e) {}
    }, 5000);

    return () => clearInterval(heartbeatInterval);
  }, [isPlayerReady, isHostOrMod, onHeartbeat]);

  /**
   * Viewer Periodic Drift Correction (~3s)
   */
  const lastDriftSeekRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || isHostOrMod) return;

    const driftInterval = setInterval(() => {
      try {
        if (!playerRef.current || typeof playerRef.current.getCurrentTime !== 'function') return;
        const ytState = typeof playerRef.current.getPlayerState === 'function' ? playerRef.current.getPlayerState() : -1;
        if (ytState === window.YT?.PlayerState?.BUFFERING) return;

        const actualTime = playerRef.current.getCurrentTime() || 0;
        const targetTime = getComputedTargetTime();
        const drift = Math.abs(actualTime - targetTime);

        if (drift > 1.5) {
          const now = Date.now();
          if (now - lastDriftSeekRef.current > 2500) {
            lastDriftSeekRef.current = now;
            setProgrammaticLock(800);
            console.log(`[SYNC] Viewer periodic drift correction: seeking to ${targetTime.toFixed(2)}s (drift=${drift.toFixed(2)}s)`);
            playerRef.current.seekTo(targetTime, true);
          }
        }
      } catch (e) {}
    }, 3000);

    return () => clearInterval(driftInterval);
  }, [isPlayerReady, isHostOrMod, getComputedTargetTime, setProgrammaticLock]);

  /**
   * Tab Visibility Re-sync: catch up immediately when returning to tab
   */
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;

    const handleVisibilityChange = () => {
      if (document.hidden) return;
      try {
        console.log('[SYNC] Tab became visible -> evaluating sync');
        const target = getComputedTargetTime();
        const actual = playerRef.current.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
        const drift = Math.abs(actual - target);

        if (drift > 1.5 && typeof playerRef.current.seekTo === 'function') {
          setProgrammaticLock(800);
          playerRef.current.seekTo(target, true);
        }

        if (playState === 'playing') {
          const ytState = playerRef.current.getPlayerState ? playerRef.current.getPlayerState() : -1;
          if (ytState !== window.YT?.PlayerState?.PLAYING && typeof playerRef.current.playVideo === 'function') {
            setProgrammaticLock(800);
            playerRef.current.playVideo();
          }
        }
      } catch (e) {}
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPlayerReady, getComputedTargetTime, playState, setProgrammaticLock]);

  const handleManualUnmute = () => {
    setAutoplayBlocked(false);
    if (!playerRef.current) return;
    try {
      playerRef.current.unMute();
      setIsMuted(false);
      if (volume === 0) {
        playerRef.current.setVolume(100);
        setVolume(100);
      }
      if (playState === 'playing') {
        playerRef.current.playVideo();
      }
    } catch (e) {
      console.warn('Failed to unmute:', e);
    }
  };

  const handleToggleMute = () => {
    if (!playerRef.current) return;
    try {
      if (isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
        setAutoplayBlocked(false);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    } catch (e) {
      console.warn('Failed to toggle mute:', e);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseInt(e.target.value, 10);
    setVolume(newVol);
    if (!playerRef.current) return;
    try {
      if (newVol === 0) {
        playerRef.current.mute();
        setIsMuted(true);
      } else {
        if (isMuted) {
          playerRef.current.unMute();
          setIsMuted(false);
          setAutoplayBlocked(false);
        }
        playerRef.current.setVolume(newVol);
      }
    } catch (e) {
      console.warn('Failed to set volume:', e);
    }
  };

  if (!videoId) {
    return (
      <div className="youtube-player-card">
        <div className="youtube-aspect-ratio empty-video-placeholder">
          <div className="player-loading-overlay">
            <Play style={{ width: 44, height: 44, opacity: 0.5, marginBottom: '0.75rem' }} />
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 600 }}>No Video Selected</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', textAlign: 'center', maxWidth: '360px' }}>
              {isHostOrMod
                ? 'Paste a YouTube URL below to start the watch party for everyone.'
                : 'Waiting for Host or Moderator to select a video...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="youtube-player-card">
      <div className="youtube-aspect-ratio" ref={containerRef}>
        {/* Transparent Click-Blocking Overlay for Viewers (PARTICIPANT role) */}
        {!isHostOrMod && (
          <div
            className="viewer-iframe-overlay"
            title={autoplayBlocked ? 'Click to enable audio' : 'Playback controls are restricted to Host & Moderators.'}
            onClick={autoplayBlocked ? handleManualUnmute : undefined}
          />
        )}

        {isLoading && (
          <div className="player-loading-overlay">
            <div className="loading-spinner" />
            <p>Connecting YouTube IFrame API...</p>
          </div>
        )}

        {playerError && (
          <div className="player-error-overlay">
            <AlertCircle className="error-icon" />
            <p>{playerError}</p>
          </div>
        )}

        {autoplayBlocked && !playerError && (
          <div className="player-error-overlay autoplay-blocked">
            <p>Autoplay audio was restricted by your browser. Video is synced and playing!</p>
            <button
              onClick={handleManualUnmute}
              className="submit-action-btn"
              style={{ width: 'auto', padding: '0.6rem 1.25rem' }}
            >
              <Volume2 style={{ width: 16, height: 16, marginRight: 6 }} />
              Click to Unmute Audio
            </button>
          </div>
        )}
      </div>

      {/* Small local volume/mute bar for regular viewers */}
      {!isHostOrMod && (
        <div className="viewer-local-audio-bar">
          <div className="viewer-audio-info">
            <Lock className="banner-icon" />
            <span>Playback synchronized with Host &amp; Mods</span>
          </div>

          <div className="viewer-volume-controls">
            <button
              type="button"
              onClick={handleToggleMute}
              className="viewer-mute-btn"
              title={isMuted ? 'Unmute local player' : 'Mute local player'}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="volume-icon" />
              ) : (
                <Volume2 className="volume-icon" />
              )}
            </button>

            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="viewer-volume-slider"
              title={`Local Volume: ${isMuted ? 'Muted' : `${volume}%`}`}
              aria-label="Local Volume"
            />

            <span className="viewer-volume-label">
              {isMuted ? 'Muted' : `${volume}%`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
