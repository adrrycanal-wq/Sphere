import React, { createContext, useCallback, useContext, useState } from 'react';

export interface UniversalImageGalleryItem {
  src: string;
  alt?: string;
  title?: string;
  subtitle?: string;
  photoId?: string;
}

export interface UniversalImageTarget {
  src: string;
  alt?: string;
  title?: string;
  subtitle?: string;
  photoId?: string;
  authorName?: string;
  authorAvatar?: string;
  description?: string;
  badge?: string;
  actionLabel?: string;
  onAction?: () => void;
  gallery?: UniversalImageGalleryItem[];
}

interface ImageViewerContextValue {
  activeMedia: UniversalImageTarget | null;
  openImage: (target: UniversalImageTarget) => void;
  closeImage: () => void;
}

const ImageViewerContext = createContext<ImageViewerContextValue>({
  activeMedia: null,
  openImage: () => {},
  closeImage: () => {},
});

export const ImageViewerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeMedia, setActiveMedia] = useState<UniversalImageTarget | null>(null);

  const openImage = useCallback((target: UniversalImageTarget) => {
    if (!target.src) return;
    setActiveMedia(target);
  }, []);

  const closeImage = useCallback(() => {
    setActiveMedia(null);
  }, []);

  return (
    <ImageViewerContext.Provider value={{ activeMedia, openImage, closeImage }}>
      {children}
    </ImageViewerContext.Provider>
  );
};

export function useImageViewer(): ImageViewerContextValue {
  return useContext(ImageViewerContext);
}
