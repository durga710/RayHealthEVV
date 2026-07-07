/**
 * YouTube URL → privacy-enhanced embed URL for the course player's inline
 * WebView. Same transform as the web player (CourseDetailPage.tsx), plus
 * handling for URLs that already carry query params.
 */

const EMBED_PARAMS = 'autoplay=1&rel=0&modestbranding=1';

export function toEmbedUrl(videoUrl: string): string {
  let embed = videoUrl
    .replace('https://www.youtube.com/watch?v=', 'https://www.youtube-nocookie.com/embed/')
    .replace('https://youtu.be/', 'https://www.youtube-nocookie.com/embed/');
  // A watch URL with extra params (e.g. ...watch?v=ID&t=30s) leaves '&t=30s'
  // glued to the id after the replace; promote the first '&' back to '?'.
  if (!embed.includes('?') && embed.includes('&')) {
    embed = embed.replace('&', '?');
  }
  return `${embed}${embed.includes('?') ? '&' : '?'}${EMBED_PARAMS}`;
}
