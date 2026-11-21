import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppWindow,
  BadgeCheck,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Lock,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  RotateCw,
  Send,
  Share2,
  ShieldCheck,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  DiscoveryCategory,
  NavRoute,
  PageItem,
  PhotoItem,
  PrivacyLevel,
  ReactionType,
  SocialPost,
  SphereIdVerificationRequest,
  UserProfile,
} from '../types/social';
import {
  apiCommentPhoto,
  apiReactPhoto,
  apiReviewSphereId,
  apiSharePost,
  apiSubmitSphereId,
  apiUpdatePhoto,
  apiUpdateUser,
} from '../utils/api';
import { DISCOVERY_CATEGORIES, hashFileMetadata } from '../utils/discovery';
import { UniversalImageTarget } from './ImageViewerContext';
import { ImageWithFallback, UserAvatar } from './Media';
import { ReactionControls } from './ReactionControls';
import { TranslateControl } from './TranslateControl';

// =========================================================================
// FACEBOOK-STYLE PHOTO THEATER & FLOATING POP-OUT WINDOW MODAL
// =========================================================================
interface PhotoLightboxModalProps {
  photo: PhotoItem | null;
  photos?: PhotoItem[];
  customMedia?: UniversalImageTarget | null;
  currentUser: UserProfile | null;
  users: UserProfile[];
  pages: PageItem[];
  onSelectPhoto?: (photoId: string) => void;
  onSelectCustomMedia?: (media: UniversalImageTarget) => void;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onNavigate: (route: NavRoute) => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  photo,
  photos = [],
  customMedia = null,
  currentUser,
  users,
  pages,
  onSelectPhoto,
  onSelectCustomMedia,
  onClose,
  onRefresh,
  onNavigate,
}) => {
  const [commentText, setCommentText] = useState('');
  const [busy, setBusy] = useState(false);

  // Interactive Viewer Controls
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draggingCanvas, setDraggingCanvas] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // Window Modes: 'theater' (full-screen Facebook layout) | 'popout' (movable floating window)
  const [windowMode, setWindowMode] = useState<'theater' | 'popout'>('theater');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [popPos, setPopPos] = useState({ x: 0, y: 0 });
  const popDragRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const isOpen = Boolean(photo || customMedia);
  const activeKey = photo ? photo.id : customMedia?.src || '';

  // Reset zoom/pan/rotation whenever switching images
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, [activeKey]);

  // Reset window mode when closed
  useEffect(() => {
    if (!isOpen) {
      setWindowMode('theater');
      setSidebarOpen(true);
      setPopPos({ x: 0, y: 0 });
    }
  }, [isOpen]);

  // Gallery navigation calculation (supports both PhotoItem[] and customMedia.gallery)
  const galleryNav = useMemo(() => {
    if (photo && photos.length > 1) {
      const sameOwner = photos.filter((p) => p.ownerId === photo.ownerId);
      const list = sameOwner.length > 1 ? sameOwner : photos;
      const idx = list.findIndex((p) => p.id === photo.id);
      if (idx >= 0) {
        return {
          total: list.length,
          index: idx,
          hasPrev: true,
          hasNext: true,
          items: list.map((p) => ({
            key: p.id,
            src: p.src,
            label: p.caption,
            isActive: p.id === photo.id,
            select: () => onSelectPhoto?.(p.id),
          })),
          goPrev: () => {
            const nextIdx = (idx - 1 + list.length) % list.length;
            onSelectPhoto?.(list[nextIdx].id);
          },
          goNext: () => {
            const nextIdx = (idx + 1) % list.length;
            onSelectPhoto?.(list[nextIdx].id);
          },
        };
      }
    }
    if (!photo && customMedia?.gallery && customMedia.gallery.length > 1) {
      const list = customMedia.gallery;
      const idx = Math.max(
        0,
        list.findIndex((item) => item.src === customMedia.src)
      );
      return {
        total: list.length,
        index: idx,
        hasPrev: true,
        hasNext: true,
        items: list.map((item, i) => ({
          key: `${item.src}-${i}`,
          src: item.src,
          label: item.title || item.alt || `Photo ${i + 1}`,
          isActive: i === idx,
          select: () => {
            if (item.photoId && onSelectPhoto) {
              onSelectPhoto(item.photoId);
            } else if (onSelectCustomMedia) {
              onSelectCustomMedia({
                ...customMedia,
                src: item.src,
                alt: item.alt || item.title,
                title: item.title || item.alt || customMedia.title,
                subtitle: item.subtitle || customMedia.subtitle,
              });
            }
          },
        })),
        goPrev: () => {
          const prev = list[(idx - 1 + list.length) % list.length];
          if (prev.photoId && onSelectPhoto) {
            onSelectPhoto(prev.photoId);
          } else if (onSelectCustomMedia) {
            onSelectCustomMedia({
              ...customMedia,
              src: prev.src,
              alt: prev.alt || prev.title,
              title: prev.title || prev.alt || customMedia.title,
              subtitle: prev.subtitle || customMedia.subtitle,
            });
          }
        },
        goNext: () => {
          const next = list[(idx + 1) % list.length];
          if (next.photoId && onSelectPhoto) {
            onSelectPhoto(next.photoId);
          } else if (onSelectCustomMedia) {
            onSelectCustomMedia({
              ...customMedia,
              src: next.src,
              alt: next.alt || next.title,
              title: next.title || next.alt || customMedia.title,
              subtitle: next.subtitle || customMedia.subtitle,
            });
          }
        },
      };
    }
    return null;
  }, [photo, photos, customMedia, onSelectPhoto, onSelectCustomMedia]);

  // Keyboard shortcuts (Escape, Left/Right, +/-, 0 fit)
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        if (e.key === 'Escape') onClose();
        return;
      }
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && galleryNav) {
        e.preventDefault();
        galleryNav.goPrev();
      } else if (e.key === 'ArrowRight' && galleryNav) {
        e.preventDefault();
        galleryNav.goNext();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))));
      } else if (e.key === '-') {
        e.preventDefault();
        setZoom((z) => Math.max(0.35, Number((z - 0.25).toFixed(2))));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, galleryNav, onClose]);

  if (!isOpen) return null;

  const displaySrc = photo ? photo.src : customMedia?.src || '';
  const displayAlt = photo
    ? photo.caption
    : customMedia?.title || customMedia?.alt || 'Sphere Photo';
  const zoomPct = Math.round(zoom * 100);

  const clampZoom = (next: number) => Math.min(4, Math.max(0.35, Number(next.toFixed(2))));
  const handleZoomOut = () => {
    setZoom((z) => {
      const next = clampZoom(z - 0.25);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };
  const handleZoomIn = () => {
    setZoom((z) => clampZoom(z + 0.25));
  };
  const handleQuickZoomToggle = () => {
    if (zoom > 1.05) {
      setZoom(0.65); // Zoom Out overview!
      setPan({ x: 0, y: 0 });
    } else if (zoom < 0.95) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      setZoom(1.75);
    }
  };

  const toggleNativeFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else if (typeof el.requestFullscreen === 'function') {
      void el.requestFullscreen().catch(() => {});
    }
  };

  // Attribution / Details Data
  const owner = photo ? users.find((u) => u.id === photo.ownerId) : undefined;
  const postedPage =
    photo && photo.pageId ? pages.find((pg) => pg.id === photo.pageId) : undefined;
  const showAsPage = Boolean(photo?.postAsPage && postedPage);
  const isOwner = Boolean(photo && currentUser && photo.ownerId === currentUser.id);
  const hideCounts = Boolean(currentUser?.popularitySettings?.hidePublicLikeCounts);

  const handleReact = async (type: ReactionType) => {
    if (!photo || !currentUser) return;
    await apiReactPhoto(photo.id, currentUser.id, type);
    await onRefresh();
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo || !currentUser || !commentText.trim() || busy) return;
    setBusy(true);
    try {
      await apiCommentPhoto(photo.id, currentUser.id, commentText.trim());
      setCommentText('');
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const isPopout = windowMode === 'popout';

  return (
    <div
      className={
        isPopout
          ? 'fixed inset-0 z-[80] pointer-events-none flex items-center justify-center p-4'
          : 'fixed inset-0 z-[80] bg-[#05070B]/95 backdrop-blur-sm flex items-center justify-center'
      }
      onClick={isPopout ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal={!isPopout}
        aria-label={displayAlt}
        onClick={(e) => e.stopPropagation()}
        style={
          isPopout
            ? { transform: `translate3d(${popPos.x}px, ${popPos.y}px, 0)` }
            : undefined
        }
        className={
          isPopout
            ? 'pointer-events-auto w-[min(94vw,860px)] h-[min(86vh,620px)] bg-[var(--sp-surface)] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col'
            : 'w-full h-full bg-[#05070B] overflow-hidden flex flex-col lg:flex-row'
        }
      >
        {/* Pop-out Draggable Window Titlebar */}
        {isPopout && (
          <div
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).closest('button')) return;
              popDragRef.current = {
                x: e.clientX,
                y: e.clientY,
                startX: popPos.x,
                startY: popPos.y,
              };
              const onMove = (ev: MouseEvent) => {
                if (!popDragRef.current) return;
                setPopPos({
                  x: popDragRef.current.startX + (ev.clientX - popDragRef.current.x),
                  y: popDragRef.current.startY + (ev.clientY - popDragRef.current.y),
                });
              };
              const onUp = () => {
                popDragRef.current = null;
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
            className="h-10 px-3 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between gap-2 cursor-move select-none shrink-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AppWindow className="w-4 h-4 text-[#06B6D4] shrink-0" />
              <span className="text-xs font-bold truncate">{displayAlt}</span>
              <span className="text-[10px] font-mono-code text-slate-400 shrink-0">
                {zoomPct}%
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setWindowMode('theater')}
                title="Expand to Facebook Theater Screen"
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Theater Screen</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Close Window"
                className="p-1.5 rounded-md hover:bg-rose-600/80 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Main Viewer Body */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* LEFT / MAIN IMAGE STAGE (Dark Cinema Canvas) */}
          <div
            ref={stageRef}
            onWheel={(e) => {
              e.preventDefault();
              const delta = e.deltaY < 0 ? 0.15 : -0.15;
              setZoom((z) => {
                const next = clampZoom(z + delta);
                if (next <= 1) setPan({ x: 0, y: 0 });
                return next;
              });
            }}
            className={`relative flex-1 bg-[#05070B] flex items-center justify-center overflow-hidden select-none min-h-[280px] ${
              zoom > 1 ? (draggingCanvas ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
            }`}
          >
            {/* Top-Left Close + Brand Pill (in Theater Mode) */}
            {!isPopout && (
              <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close photo window"
                  className="w-9 h-9 rounded-full bg-slate-900/85 hover:bg-slate-800 border border-white/15 text-white flex items-center justify-center shadow-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-white/10 text-white text-xs font-semibold backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-[#06B6D4]" />
                  <span className="max-w-[200px] truncate">{displayAlt}</span>
                  {galleryNav && (
                    <span className="text-[11px] font-mono-code text-slate-400">
                      {galleryNav.index + 1}/{galleryNav.total}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Top-Right Interactive Toolbar: Zoom Out, Fit/Zoom%, Zoom In, Rotate, Pop-Out, Expand, Download */}
            <div className="absolute top-3 right-3 z-20 flex flex-wrap items-center gap-1 px-2 py-1 rounded-full bg-slate-900/85 border border-white/15 text-white shadow-xl backdrop-blur-md">
              <button
                type="button"
                onClick={handleZoomOut}
                title="Zoom Out (-)"
                aria-label="Zoom out"
                className="p-1.5 rounded-full hover:bg-white/15 cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleQuickZoomToggle}
                title="Click to cycle Zoom Out (65%) / Fit (100%) / Zoom (175%)"
                className="px-2 py-0.5 rounded-full hover:bg-white/15 text-[11px] font-mono-code font-bold tabular-nums cursor-pointer"
              >
                {zoomPct}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom In (+)"
                aria-label="Zoom in"
                className="p-1.5 rounded-full hover:bg-white/15 cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <span className="w-px h-4 bg-white/15 mx-0.5" />

              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                title="Rotate 90°"
                aria-label="Rotate 90 degrees"
                className="p-1.5 rounded-full hover:bg-white/15 cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setWindowMode((m) => (m === 'theater' ? 'popout' : 'theater'))}
                title={isPopout ? 'Switch to Full Theater Screen' : 'Pop Out into Floating Window'}
                aria-label="Toggle Pop-Out Window"
                className={`p-1.5 rounded-full hover:bg-white/15 cursor-pointer ${
                  isPopout ? 'text-[#22D3EE]' : ''
                }`}
              >
                <AppWindow className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={toggleNativeFullscreen}
                title="Fullscreen Canvas"
                aria-label="Toggle native fullscreen"
                className="hidden sm:inline-flex p-1.5 rounded-full hover:bg-white/15 cursor-pointer"
              >
                {sidebarOpen ? (
                  <Maximize2 className="w-4 h-4" />
                ) : (
                  <Minimize2 className="w-4 h-4" />
                )}
              </button>

              {!isPopout && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen((s) => !s)}
                  title={sidebarOpen ? 'Expand Image Full Width' : 'Show Photo Details'}
                  aria-label="Toggle details sidebar"
                  className="p-1.5 rounded-full hover:bg-white/15 cursor-pointer"
                >
                  {sidebarOpen ? (
                    <PanelRightClose className="w-4 h-4" />
                  ) : (
                    <PanelRightOpen className="w-4 h-4" />
                  )}
                </button>
              )}

              <a
                href={displaySrc}
                download={displayAlt.replace(/[^a-z0-9-_]+/gi, '_')}
                onClick={(e) => e.stopPropagation()}
                title="Download Image"
                aria-label="Download image"
                className="p-1.5 rounded-full hover:bg-white/15 cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>

            {/* Prev / Next Facebook Gallery Arrows */}
            {galleryNav && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    galleryNav.goPrev();
                  }}
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-white/15 text-white flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-105"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    galleryNav.goNext();
                  }}
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-white/15 text-white flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-105"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Main Media Viewport */}
            <div
              onMouseDown={(e) => {
                if (zoom <= 1) return;
                setDraggingCanvas(true);
                dragStartRef.current = {
                  x: e.clientX,
                  y: e.clientY,
                  panX: pan.x,
                  panY: pan.y,
                };
                const onMove = (ev: MouseEvent) => {
                  if (!dragStartRef.current) return;
                  setPan({
                    x: dragStartRef.current.panX + (ev.clientX - dragStartRef.current.x),
                    y: dragStartRef.current.panY + (ev.clientY - dragStartRef.current.y),
                  });
                };
                const onUp = () => {
                  setDraggingCanvas(false);
                  dragStartRef.current = null;
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
              onDoubleClick={() => {
                if (zoom > 1.2) {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                } else {
                  setZoom(2);
                }
              }}
              className="w-full h-full flex items-center justify-center p-4 sm:p-10 overflow-hidden"
            >
              {photo?.mediaType === 'video' ? (
                <video src={photo.src} controls className="max-w-full max-h-full rounded-lg" />
              ) : (
                <div
                  style={{
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) rotate(${rotation}deg)`,
                  }}
                  className="transition-transform duration-150 ease-out flex items-center justify-center max-w-full max-h-full"
                >
                  <ImageWithFallback
                    src={displaySrc}
                    alt={displayAlt}
                    disableLightbox
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl pointer-events-none"
                  />
                </div>
              )}
            </div>

            {/* Bottom Filmstrip Gallery Selector */}
            {galleryNav && galleryNav.items.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 max-w-[92%] px-2.5 py-1.5 rounded-xl bg-slate-900/85 border border-white/10 backdrop-blur-md flex items-center gap-1.5 overflow-x-auto">
                {galleryNav.items.slice(0, 14).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.select}
                    title={item.label}
                    className={`w-10 h-10 rounded-lg overflow-hidden shrink-0 border-2 cursor-pointer transition-all ${
                      item.isActive
                        ? 'border-[#06B6D4] scale-105'
                        : 'border-transparent opacity-65 hover:opacity-100'
                    }`}
                  >
                    <ImageWithFallback
                      src={item.src}
                      alt={item.label}
                      disableLightbox
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT DETAILS & SOCIAL SIDEBAR (Facebook-style side drawer) */}
          {sidebarOpen && !isPopout && (
            <div className="w-full lg:w-[370px] xl:w-[400px] shrink-0 bg-[var(--sp-surface)] border-t lg:border-t-0 lg:border-l border-[var(--sp-border)] flex flex-col max-h-[44vh] lg:max-h-full">
              {photo ? (
                <>
                  {/* Publisher Header */}
                  <div className="p-4 border-b border-[var(--sp-border-subtle)] flex items-center justify-between gap-2">
                    {showAsPage && postedPage ? (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigate({ page: 'discover', tab: 'pages', pageId: postedPage.id });
                        }}
                        className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer hover:opacity-85"
                      >
                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-[var(--sp-border)] shrink-0">
                          <ImageWithFallback
                            src={postedPage.avatar || postedPage.coverImage}
                            alt={postedPage.name}
                            disableLightbox
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[var(--sp-ink)] flex items-center gap-1 truncate">
                            <span className="truncate">{postedPage.name}</span>
                            {postedPage.verified && (
                              <BadgeCheck className="w-4 h-4 text-[var(--sp-primary-text)] shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--sp-muted)] truncate">
                            {postedPage.category} · {photo.createdAt}
                          </div>
                        </div>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (owner) {
                            onClose();
                            onNavigate({ page: 'profile', userId: owner.id, tab: 'timeline' });
                          }
                        }}
                        className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer hover:opacity-85"
                      >
                        <UserAvatar user={owner} size="md" />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[var(--sp-ink)] truncate">
                            {owner?.name || 'Sphere Member'}
                          </div>
                          <div className="text-[11px] text-[var(--sp-muted)] truncate">
                            {photo.location} · {photo.createdAt}
                          </div>
                        </div>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onClose}
                      className="hidden lg:inline-flex p-1.5 rounded-lg hover:bg-[var(--sp-surface-alt)] text-[var(--sp-muted)] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm text-[var(--sp-ink)] leading-relaxed">{photo.caption}</p>
                      {currentUser && (
                        <TranslateControl
                          text={photo.caption}
                          preferredLanguage={currentUser.preferredLanguage || 'English'}
                          autoTranslate={currentUser.autoTranslate}
                        />
                      )}
                      <div className="text-[11px] text-[var(--sp-muted)] flex items-center gap-2">
                        <span>Frame: {photo.album}</span>
                        <span>·</span>
                        <span>Audience: {(photo.privacy || 'public').replace(/_/g, ' ')}</span>
                      </div>

                      {isOwner && currentUser && (
                        <div className="pt-1 flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-[var(--sp-muted)]" />
                          <select
                            value={photo.privacy || 'public'}
                            onChange={async (e) => {
                              await apiUpdatePhoto(photo.id, currentUser.id, {
                                privacy: e.target.value as PrivacyLevel,
                              });
                              await onRefresh();
                            }}
                            className="px-2 py-1 text-xs rounded-md bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                          >
                            <option value="public">Everyone</option>
                            <option value="friends_of_friends">Friends of Friends</option>
                            <option value="friends_only">Friends Only</option>
                            <option value="only_me">Only Me</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {currentUser && (
                      <div className="pt-2 border-t border-[var(--sp-border-subtle)]">
                        <ReactionControls
                          currentUserId={currentUser.id}
                          reactions={photo.reactions}
                          tracker={photo.reactionTracker}
                          fallbackLikes={photo.likes}
                          hideCounts={hideCounts}
                          onReact={handleReact}
                        />
                      </div>
                    )}

                    <div className="pt-2 border-t border-[var(--sp-border-subtle)] space-y-2.5">
                      <div className="text-xs font-bold text-[var(--sp-ink)]">
                        Comments ({photo.comments.length})
                      </div>
                      {photo.comments.map((c) => {
                        const author = users.find((u) => u.id === c.authorId);
                        return (
                          <div key={c.id} className="flex items-start gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                if (author) {
                                  onClose();
                                  onNavigate({ page: 'profile', userId: author.id, tab: 'timeline' });
                                }
                              }}
                              className="cursor-pointer shrink-0"
                            >
                              <UserAvatar user={author} size="xs" />
                            </button>
                            <div className="flex-1 bg-[var(--sp-surface-alt)] rounded-xl px-3 py-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (author) {
                                    onClose();
                                    onNavigate({ page: 'profile', userId: author.id, tab: 'timeline' });
                                  }
                                }}
                                className="font-bold text-[var(--sp-ink)] hover:underline cursor-pointer text-left"
                              >
                                {author?.name}
                              </button>
                              <p className="text-[var(--sp-ink-2)] mt-0.5">{c.text}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {currentUser && (
                    <form
                      onSubmit={handleComment}
                      className="p-3 border-t border-[var(--sp-border)] flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Write a comment..."
                        className="flex-1 px-3 py-1.5 text-xs rounded-full bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                      />
                      <button
                        type="submit"
                        disabled={busy || !commentText.trim()}
                        className="p-2 rounded-full bg-[var(--sp-primary)] text-white cursor-pointer disabled:opacity-40"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )}
                </>
              ) : (
                /* Generic / Standalone Image Details Sidebar (Chat Images, Covers, Avatars, Marketplace, Pages, Drives) */
                <>
                  <div className="p-4 border-b border-[var(--sp-border-subtle)] flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono-code font-bold text-[var(--sp-accent-text)] uppercase">
                        {customMedia?.badge || 'Sphere Image Window'}
                      </div>
                      <h3 className="font-display text-sm font-extrabold text-[var(--sp-ink)] truncate">
                        {displayAlt}
                      </h3>
                      {customMedia?.subtitle && (
                        <div className="text-[11px] text-[var(--sp-muted)] truncate">
                          {customMedia.subtitle}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="hidden lg:inline-flex p-1.5 rounded-lg hover:bg-[var(--sp-surface-alt)] text-[var(--sp-muted)] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {customMedia?.description && (
                      <p className="text-xs text-[var(--sp-ink-2)] leading-relaxed whitespace-pre-line">
                        {customMedia.description}
                      </p>
                    )}

                    <div className="p-3 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] space-y-2 text-xs">
                      <div className="font-bold text-[var(--sp-ink)]">Viewer Controls</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={handleZoomOut}
                          className="px-2.5 py-1.5 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border)] hover:border-[var(--sp-primary)] flex items-center justify-center gap-1 font-semibold cursor-pointer"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                          <span>Zoom Out</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleZoomIn}
                          className="px-2.5 py-1.5 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border)] hover:border-[var(--sp-primary)] flex items-center justify-center gap-1 font-semibold cursor-pointer"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                          <span>Zoom In</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setZoom(1);
                            setRotation(0);
                            setPan({ x: 0, y: 0 });
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border)] hover:border-[var(--sp-primary)] flex items-center justify-center gap-1 font-semibold cursor-pointer"
                        >
                          <Minimize2 className="w-3.5 h-3.5" />
                          <span>Reset 100%</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWindowMode('popout')}
                          className="px-2.5 py-1.5 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border)] hover:border-[var(--sp-primary)] flex items-center justify-center gap-1 font-semibold cursor-pointer"
                        >
                          <AppWindow className="w-3.5 h-3.5" />
                          <span>Pop-Out</span>
                        </button>
                      </div>
                    </div>

                    {customMedia?.actionLabel && customMedia.onAction && (
                      <button
                        type="button"
                        onClick={() => {
                          const cb = customMedia.onAction;
                          onClose();
                          cb?.();
                        }}
                        className="w-full py-2.5 rounded-xl bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-bold cursor-pointer"
                      >
                        {customMedia.actionLabel}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// SHARE POST MODAL (WITH 4-OPTION AUDIENCE GRID + MESSENGER SEND)
// =========================================================================
interface SharePostModalProps {
  post: SocialPost | null;
  currentUser: UserProfile;
  users: UserProfile[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onSendInMessenger: (targetUserId: string, post: SocialPost) => void;
}

export const SharePostModal: React.FC<SharePostModalProps> = ({
  post,
  currentUser,
  users,
  onClose,
  onRefresh,
  onSendInMessenger,
}) => {
  const [commentary, setCommentary] = useState('');
  const [privacy, setPrivacy] = useState<PrivacyLevel>('public');
  const [busy, setBusy] = useState(false);

  if (!post) return null;

  const friends = users.filter((u) => u.id !== currentUser.id && u.friendship === 'friends');

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiSharePost({
        postId: post.id,
        authorId: currentUser.id,
        commentary,
        privacy,
      });
      setCommentary('');
      await onRefresh();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 bg-[var(--sp-primary)] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-[#A5F3FC]" />
            <h2 className="font-display text-base font-bold">Share Post to Your Sphere.</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/15 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleShare} className="p-5 space-y-4">
          <textarea
            rows={2}
            value={commentary}
            onChange={(e) => setCommentary(e.target.value)}
            placeholder="Add your note before sharing..."
            className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
          />

          <div>
            <div className="text-xs font-bold text-[var(--sp-ink)] mb-1.5">
              Choose who can see this shared post
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'public', label: 'Everyone' },
                  { id: 'friends_of_friends', label: 'Friends of Friends' },
                  { id: 'friends_only', label: 'Friends Only' },
                  { id: 'only_me', label: 'Only Me' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPrivacy(opt.id)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border cursor-pointer ${
                    privacy === opt.id
                      ? 'bg-[var(--sp-primary)] text-white border-[var(--sp-primary)]'
                      : 'bg-[var(--sp-surface-alt)] border-[var(--sp-border)] text-[var(--sp-ink)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 text-xs font-bold cursor-pointer"
          >
            {busy ? 'Sharing...' : 'Share to Pulse'}
          </button>

          {friends.length > 0 && (
            <div className="pt-3 border-t border-[var(--sp-border-subtle)] space-y-2">
              <div className="text-xs font-bold text-[var(--sp-muted)]">
                Or send directly in Floating Messenger
              </div>
              <div className="flex flex-wrap gap-1.5">
                {friends.slice(0, 5).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      onSendInMessenger(f.id, post);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] hover:border-[var(--sp-primary)] text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserAvatar user={f} size="xs" />
                    <span>{f.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// EDIT PROFILE, SIGNALS & NO POPULARITY PRESSURE MODAL
// =========================================================================
interface EditProfileModalProps {
  open: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  open,
  currentUser,
  onClose,
  onRefresh,
}) => {
  const [status, setStatus] = useState(currentUser.status);
  const [location, setLocation] = useState(currentUser.location);
  const [bio, setBio] = useState(currentUser.bio);
  const [quote, setQuote] = useState(currentUser.quote);
  const [interests, setInterests] = useState(currentUser.interests.join(', '));
  const [hobbies, setHobbies] = useState((currentUser.hobbies || []).join(', '));
  const [skills, setSkills] = useState((currentUser.skills || []).join(', '));
  const [goals, setGoals] = useState((currentUser.goals || []).join(', '));
  const [categories, setCategories] = useState<DiscoveryCategory[]>(currentUser.categories || []);
  const [preferredLanguage, setPreferredLanguage] = useState(
    currentUser.preferredLanguage || 'English'
  );
  const [autoTranslate, setAutoTranslate] = useState(Boolean(currentUser.autoTranslate));
  const [hideLikes, setHideLikes] = useState(
    Boolean(currentUser.popularitySettings?.hidePublicLikeCounts)
  );
  const [hideFollowers, setHideFollowers] = useState(
    Boolean(currentUser.popularitySettings?.hideFollowerCounts)
  );
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const toggleCategory = (cat: DiscoveryCategory) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiUpdateUser(currentUser.id, {
        status,
        location,
        bio,
        quote,
        interests: interests.split(',').map((s) => s.trim()).filter(Boolean),
        hobbies: hobbies.split(',').map((s) => s.trim()).filter(Boolean),
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        goals: goals.split(',').map((s) => s.trim()).filter(Boolean),
        categories,
        preferredLanguage,
        autoTranslate,
        popularitySettings: {
          hidePublicLikeCounts: hideLikes,
          hideFollowerCounts: hideFollowers,
          disableProfileEngagementStats: hideFollowers,
        },
      });
      await onRefresh();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90vh] flex flex-col bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 bg-[var(--sp-primary)] text-white flex items-center justify-between shrink-0">
          <h2 className="font-display text-lg font-bold">Edit Profile, Signals &amp; Preferences</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/15 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-[var(--sp-ink-2)] mb-1">Status Line</label>
            <input
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[var(--sp-ink-2)] mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[var(--sp-ink-2)] mb-1">
                Preferred Translation Language
              </label>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              >
                <option>English</option>
                <option>Tagalog</option>
                <option>Japanese</option>
                <option>Spanish</option>
                <option>Korean</option>
                <option>German</option>
                <option>French</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[var(--sp-ink-2)] mb-1">Bio</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[var(--sp-ink-2)] mb-1">Motto / Quote</label>
            <input
              type="text"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[var(--sp-ink-2)] mb-1">Interests</label>
              <input
                type="text"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[var(--sp-ink-2)] mb-1">Hobbies</label>
              <input
                type="text"
                value={hobbies}
                onChange={(e) => setHobbies(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[var(--sp-ink-2)] mb-1">Skills</label>
              <input
                type="text"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[var(--sp-ink-2)] mb-1">Goals</label>
              <input
                type="text"
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
            </div>
          </div>

          <div>
            <div className="font-semibold text-[var(--sp-ink-2)] mb-1.5">Global Circle Categories</div>
            <div className="flex flex-wrap gap-1.5">
              {DISCOVERY_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                    categories.includes(cat)
                      ? 'bg-[var(--sp-primary)] text-white'
                      : 'bg-[var(--sp-surface-alt)] text-[var(--sp-ink-2)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] space-y-2">
            <div className="font-bold text-[var(--sp-ink)]">Translation &amp; No Popularity Pressure</div>
            <label className="flex items-center justify-between cursor-pointer">
              <span>Auto-translate foreign-language posts and messages</span>
              <input
                type="checkbox"
                checked={autoTranslate}
                onChange={(e) => setAutoTranslate(e.target.checked)}
                className="accent-[#4F46E5]"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span>Hide reaction counts on posts</span>
              <input
                type="checkbox"
                checked={hideLikes}
                onChange={(e) => setHideLikes(e.target.checked)}
                className="accent-[#4F46E5]"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span>Hide connection / follower counts</span>
              <input
                type="checkbox"
                checked={hideFollowers}
                onChange={(e) => setHideFollowers(e.target.checked)}
                className="accent-[#4F46E5]"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[var(--sp-border)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#06B6D4] text-slate-950 font-bold cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// SPHERE ID VERIFICATION MODAL (WITH GOV-REGISTERED ORG REQUIREMENT)
// =========================================================================
interface SphereIdModalProps {
  open: boolean;
  currentUser: UserProfile;
  requests: SphereIdVerificationRequest[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export const SphereIdModal: React.FC<SphereIdModalProps> = ({
  open,
  currentUser,
  requests,
  onClose,
  onRefresh,
}) => {
  const [category, setCategory] = useState<'verified_individual' | 'verified_organization'>(
    'verified_organization'
  );
  const [entityName, setEntityName] = useState(currentUser.name);
  const [country, setCountry] = useState(currentUser.country || 'Philippines');
  const [publicLink, setPublicLink] = useState('');
  const [govAgency, setGovAgency] = useState('');
  const [govRegNumber, setGovRegNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [docSummary, setDocSummary] = useState<SphereIdVerificationRequest['documentSummary'] | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const isAdmin = currentUser.role === 'admin';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sha256Short = await hashFileMetadata(file);
    setDocSummary({
      fileName: file.name,
      fileType: file.type || 'application/pdf',
      fileSizeBytes: file.size,
      sha256Short,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!docSummary) {
      setError('Please select a supporting government ID or registration document to hash locally.');
      return;
    }
    setSubmitting(true);
    try {
      await apiSubmitSphereId({
        applicantUserId: currentUser.id,
        category,
        entityName,
        country,
        publicLink,
        govAgency: category === 'verified_organization' ? govAgency : undefined,
        govRegNumber: category === 'verified_organization' ? govRegNumber : undefined,
        notes,
        documentSummary: docSummary,
      });
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[var(--sp-surface)] border border-[var(--sp-border)] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 bg-[var(--sp-primary)] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#A5F3FC]" />
            <h2 className="font-display text-lg font-bold">Sphere ID Verification Center</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/15 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCategory('verified_individual')}
                className={`p-3 rounded-xl border text-left cursor-pointer ${
                  category === 'verified_individual'
                    ? 'bg-[var(--sp-primary-soft)] border-[var(--sp-primary)]'
                    : 'bg-[var(--sp-surface-alt)] border-[var(--sp-border)]'
                }`}
              >
                <div className="font-bold text-[var(--sp-ink)] flex items-center gap-1.5">
                  <BadgeCheck className="w-4 h-4 text-[var(--sp-primary-text)]" />
                  <span>Verified Individual</span>
                </div>
                <div className="text-[11px] text-[var(--sp-muted)] mt-0.5">
                  Personal creator or resident verification
                </div>
              </button>
              <button
                type="button"
                onClick={() => setCategory('verified_organization')}
                className={`p-3 rounded-xl border text-left cursor-pointer ${
                  category === 'verified_organization'
                    ? 'bg-[var(--sp-accent-soft)] border-[#06B6D4]'
                    : 'bg-[var(--sp-surface-alt)] border-[var(--sp-border)]'
                }`}
              >
                <div className="font-bold text-[var(--sp-ink)] flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[var(--sp-accent-text)]" />
                  <span>Verified Gov Organization</span>
                </div>
                <div className="text-[11px] text-[var(--sp-muted)] mt-0.5">
                  Required to host transparent Aid Drives
                </div>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                placeholder="Legal full name or organization name"
                className="px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
              <input
                type="text"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Country"
                className="px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
              />
            </div>

            {category === 'verified_organization' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={govAgency}
                  onChange={(e) => setGovAgency(e.target.value)}
                  placeholder="Government Agency (e.g. DSWD / SEC / DILG)"
                  className="px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
                <input
                  type="text"
                  required
                  value={govRegNumber}
                  onChange={(e) => setGovRegNumber(e.target.value)}
                  placeholder="Gov Registration Number"
                  className="px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
                />
              </div>
            )}

            <input
              type="url"
              value={publicLink}
              onChange={(e) => setPublicLink(e.target.value)}
              placeholder="Official website or registry link"
              className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes for reviewer..."
              className="w-full px-3 py-2 rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />

            <label className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[var(--sp-surface-alt)] border border-dashed border-[var(--sp-border)] cursor-pointer">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--sp-primary-text)]" />
                <span>
                  {docSummary
                    ? `${docSummary.fileName} (SHA-256: ${docSummary.sha256Short})`
                    : 'Attach supporting document (hashed locally in browser)'}
                </span>
              </div>
              <input type="file" onChange={handleFileChange} className="hidden" />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-[var(--sp-primary)] text-white font-bold cursor-pointer"
            >
              {submitting ? 'Submitting...' : 'Submit Sphere ID Application'}
            </button>
          </form>

          {/* Review Queue */}
          <div className="pt-4 border-t border-[var(--sp-border-subtle)] space-y-2">
            <div className="font-bold text-[var(--sp-ink)]">
              Verification Applications ({requests.length})
            </div>
            {requests.map((r) => (
              <div
                key={r.id}
                className="p-3 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="font-bold text-[var(--sp-ink)]">
                    {r.entityName} ({r.category.replace('_', ' ')})
                  </div>
                  <div className="text-[11px] text-[var(--sp-muted)]">
                    {r.govAgency ? `${r.govAgency} · ${r.govRegNumber} · ` : ''}
                    SHA: {r.documentSummary.sha256Short} · Status: <strong>{r.status}</strong>
                  </div>
                </div>
                {isAdmin && r.status === 'pending' && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        await apiReviewSphereId(r.id, currentUser.id, 'approved', 'Verified.');
                        await onRefresh();
                      }}
                      className="px-2.5 py-1 rounded-md bg-emerald-600 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3" /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiReviewSphereId(r.id, currentUser.id, 'rejected', 'Incomplete documentation.');
                        await onRefresh();
                      }}
                      className="px-2.5 py-1 rounded-md bg-red-600 text-white font-semibold cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
