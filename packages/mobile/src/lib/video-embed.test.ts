import { describe, it, expect } from 'vitest';
import { toEmbedUrl } from './video-embed';

describe('toEmbedUrl', () => {
  it('transforms a canonical watch URL to a nocookie embed with player params', () => {
    expect(toEmbedUrl('https://www.youtube.com/watch?v=abc123')).toBe(
      'https://www.youtube-nocookie.com/embed/abc123?autoplay=1&rel=0&modestbranding=1',
    );
  });

  it('transforms a youtu.be short URL', () => {
    expect(toEmbedUrl('https://youtu.be/abc123')).toBe(
      'https://www.youtube-nocookie.com/embed/abc123?autoplay=1&rel=0&modestbranding=1',
    );
  });

  it('keeps extra watch params intact (first & promoted to ?)', () => {
    expect(toEmbedUrl('https://www.youtube.com/watch?v=abc123&t=30s')).toBe(
      'https://www.youtube-nocookie.com/embed/abc123?t=30s&autoplay=1&rel=0&modestbranding=1',
    );
  });

  it('appends params to a non-YouTube URL without mangling it', () => {
    expect(toEmbedUrl('https://videos.example.com/training.mp4')).toBe(
      'https://videos.example.com/training.mp4?autoplay=1&rel=0&modestbranding=1',
    );
  });

  it('uses & when the URL already has a query string', () => {
    expect(toEmbedUrl('https://videos.example.com/watch?id=9')).toBe(
      'https://videos.example.com/watch?id=9&autoplay=1&rel=0&modestbranding=1',
    );
  });
});
