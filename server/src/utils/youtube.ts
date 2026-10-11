/**
 * Parses a YouTube URL or Video ID string and returns a valid 11-character YouTube video ID.
 * Supports:
 * - Standard: https://www.youtube.com/watch?v=dQw4w9WgXcQ
 * - Shortened: https://youtu.be/dQw4w9WgXcQ
 * - Embed: https://www.youtube.com/embed/dQw4w9WgXcQ
 * - Shorts: https://www.youtube.com/shorts/dQw4w9WgXcQ
 * - Mobile: https://m.youtube.com/watch?v=dQw4w9WgXcQ
 * - Raw 11-character ID: dQw4w9WgXcQ
 * Returns null if input is invalid.
 */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // If input is already an 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Regex matching various YouTube URL patterns
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^https?:\/\/(?:www\.|m\.|music\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /^https?:\/\/youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /^https?:\/\/(?:www\.|m\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /^https?:\/\/(?:www\.|m\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1] && match[1].length === 11) {
      return match[1];
    }
  }

  return null;
}
