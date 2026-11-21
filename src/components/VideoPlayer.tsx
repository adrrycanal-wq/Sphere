import React from 'react';
import { Film, Play } from 'lucide-react';
import { PostVideo } from '../types/social';

export const VideoPlayer: React.FC<{ video: PostVideo }> = ({ video }) => {
  const isLoop = video.format === 'short';

  return (
    <div
      className={`rounded-xl overflow-hidden border border-[var(--sp-border)] bg-slate-950 ${
        isLoop ? 'max-w-[340px] mx-auto' : 'w-full'
      }`}
    >
      <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-200">
        <div className="flex items-center gap-1.5 min-w-0">
          <Film className="w-3.5 h-3.5 text-[#22D3EE] shrink-0" aria-hidden="true" />
          <span className="font-semibold truncate">
            {video.title || (isLoop ? 'Sphere Loop' : 'Sphere Video')}
          </span>
        </div>
        <span className="text-[11px] font-mono-code text-[#A5F3FC] shrink-0 whitespace-nowrap">
          {isLoop ? 'Loop · 9:16 (Max 3m)' : 'Video · 16:9'}
          {video.durationLabel ? ` · ${video.durationLabel}` : ''}
        </span>
      </div>

      {video.src ? (
        <video
          src={video.src}
          poster={video.poster}
          controls
          playsInline
          className={`w-full bg-black ${isLoop ? 'aspect-[9/16] max-h-[480px]' : 'aspect-video'}`}
        />
      ) : (
        <div
          className={`flex flex-col items-center justify-center text-slate-300 p-6 ${
            isLoop ? 'aspect-[9/16] max-h-[380px]' : 'aspect-video'
          }`}
        >
          <Play className="w-10 h-10 mb-2 text-[#06B6D4]" />
          <span className="text-xs font-medium">Video preview ready</span>
        </div>
      )}
    </div>
  );
};
