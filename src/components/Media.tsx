import React, { useEffect, useId, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { UserProfile } from '../types/social';
import { useImageViewer } from './ImageViewerContext';

export type SphereLogoTone = 'brand' | 'white' | 'dark' | 'cyan' | 'current';

interface SphereLogoProps {
  size?: number;
  tone?: SphereLogoTone;
  className?: string;
}

/**
 * Sphere. Brand Mark from /assets/aistudio/sphere_logo_1d6bdb54.svg
 * Dynamically adapts color based on surface context or explicit `tone`.
 */
export const SphereLogo: React.FC<SphereLogoProps> = ({
  size = 32,
  tone = 'brand',
  className = '',
}) => {
  const gradId = useId().replace(/:/g, '');
  const fill =
    tone === 'white'
      ? '#FFFFFF'
      : tone === 'dark'
        ? '#0F172A'
        : tone === 'cyan'
          ? '#06B6D4'
          : tone === 'current'
            ? 'currentColor'
            : `url(#${gradId})`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="112 320 202 202"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {tone === 'brand' && (
        <defs>
          <linearGradient id={gradId} x1="112" y1="320" x2="314" y2="522" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="55%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
      )}
      <path
        fill={fill}
        d="M307.32,423.63c-0.03,2.64-0.17,5.26-0.41,7.84c-0.01,0.04-0.01,0.07-0.01,0.11c-4.56,47.54-44.62,84.72-93.35,84.72c-1.42,0-2.82-0.03-4.22-0.09c-13.8-0.61-14.53-20.61-0.81-22.26c10.61-1.28,19.08-4.61,22.62-11.27c0.52-0.98,3.51-6.56,1.23-10.79c-7.78-14.45-61.48,15.72-95.93-8.95c-0.11-0.08-0.23-0.17-0.36-0.26c-7.82-5.7-13.18-14.22-14.87-23.75c-0.94-5.33-1.43-10.81-1.43-16.4c0-51.79,41.98-93.78,93.78-93.78c0.27,0,0.53,0,0.8,0c14.04,0.12,14.97,20.71,1.01,22.28c-10.89,1.22-19.62,4.55-23.22,11.35c-0.52,0.98-3.51,6.56-1.23,10.79c7.78,14.45,61.48-15.72,95.94,8.95c2.41,1.72,8.95,6.75,13.88,15.42C305.51,405.96,307.28,414.97,307.32,423.63z"
      />
    </svg>
  );
};

export const ImageWithFallback: React.FC<{
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  disableLightbox?: boolean;
  lightboxTitle?: string;
  lightboxSubtitle?: string;
  lightboxDescription?: string;
  onClick?: React.MouseEventHandler<HTMLImageElement>;
}> = ({
  src,
  alt,
  className = '',
  fallbackLabel,
  disableLightbox = false,
  lightboxTitle,
  lightboxSubtitle,
  lightboxDescription,
  onClick,
}) => {
  const [failed, setFailed] = useState(false);
  const { openImage } = useImageViewer();

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[var(--sp-surface-alt)] text-[var(--sp-muted)] border border-[var(--sp-border-subtle)] p-4 text-center ${className}`}
      >
        <ImageOff className="w-6 h-6 mb-1.5 opacity-60" aria-hidden="true" />
        <span className="text-xs font-medium">{fallbackLabel || alt || 'Image preview'}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      onClick={(e) => {
        if (onClick) {
          onClick(e);
          return;
        }
        if (disableLightbox) return;
        const insideInteractiveParent = Boolean(e.currentTarget.closest('button, a'));
        if (!insideInteractiveParent) {
          e.stopPropagation();
          openImage({
            src,
            alt,
            title: lightboxTitle || alt || 'Sphere Photo',
            subtitle: lightboxSubtitle,
            description: lightboxDescription,
          });
        }
      }}
      className={`${className}${!disableLightbox ? ' cursor-zoom-in' : ''}`}
    />
  );
};

interface UserAvatarProps {
  user?: Pick<UserProfile, 'id' | 'name' | 'avatar' | 'avatarColor'>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  rounded?: 'full' | 'lg';
  isOnline?: boolean;
  className?: string;
}

const SIZE_MAP: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-28 h-28 text-2xl',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = 'md',
  rounded = 'full',
  isOnline = false,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [user?.avatar]);

  const name = user?.name || 'Sphere Member';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const radiusClass = rounded === 'full' ? 'rounded-full' : 'rounded-xl';
  const sizeClass = SIZE_MAP[size];

  return (
    <span className={`relative inline-flex shrink-0 ${sizeClass} ${className}`}>
      {user?.avatar && !imgError ? (
        <img
          src={user.avatar}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className={`w-full h-full object-cover ${radiusClass} border border-[var(--sp-border)]`}
        />
      ) : (
        <span
          style={{ backgroundColor: user?.avatarColor || '#4F46E5' }}
          className={`w-full h-full ${radiusClass} flex items-center justify-center font-display font-bold text-white select-none`}
        >
          {initials || 'S'}
        </span>
      )}
      {isOnline && (
        <span
          title="Online now"
          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#16A34A] ring-2 ring-[var(--sp-surface)]"
        />
      )}
    </span>
  );
};
