import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Image as ImageIcon,
  RotateCw,
  SunMedium,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react';
import { PhotoItem, UserProfile } from '../types/social';
import { apiUploadFile } from '../utils/api';

interface PhotoManagerModalProps {
  open: boolean;
  mode: 'avatar' | 'cover';
  currentUser: UserProfile;
  existingPhotos: PhotoItem[];
  onClose: () => void;
  onSavePhotoUrl: (url: string | undefined) => Promise<void>;
}

export const PhotoManagerModal: React.FC<PhotoManagerModalProps> = ({
  open,
  mode,
  currentUser,
  existingPhotos,
  onClose,
  onSavePhotoUrl,
}) => {
  const isAvatar = mode === 'avatar';
  const currentUrl = isAvatar ? currentUser.avatar : currentUser.coverImage;
  const userImageLibrary = existingPhotos.filter(
    (p) => (p.mediaType || 'image') === 'image' && (p.ownerId === currentUser.id || p.privacy === 'public')
  );

  const [sourceUrl, setSourceUrl] = useState<string>(currentUrl || '');
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (open) {
      setSourceUrl(currentUrl || '');
      setZoom(1);
      setRotation(0);
      setBrightness(100);
      setContrast(100);
      setOffsetX(0);
      setOffsetY(0);
      setConfirmDelete(false);
      setError(null);
    }
  }, [open, currentUrl, mode]);

  useEffect(() => {
    if (!open || !sourceUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      drawPreview();
    };
    img.onerror = () => {
      imgRef.current = null;
    };
    img.src = sourceUrl;
  }, [open, sourceUrl]);

  const drawPreview = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.translate(w / 2 + offsetX, h / 2 + offsetY);
    ctx.rotate((rotation * Math.PI) / 180);

    const baseScale = Math.max(w / img.width, h / img.height) * zoom;
    const drawW = img.width * baseScale;
    const drawH = img.height * baseScale;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  };

  useEffect(() => {
    drawPreview();
  }, [zoom, rotation, brightness, contrast, offsetX, offsetY, sourceUrl]);

  if (!open) return null;

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please select a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be 10 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSourceUrl(String(reader.result || ''));
      setZoom(1);
      setRotation(0);
      setOffsetX(0);
      setOffsetY(0);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceUrl) return;
    setSaving(true);
    setError(null);
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const uploaded = await apiUploadFile({
        fileName: `${mode}-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        dataBase64: dataUrl,
      });
      await onSavePhotoUrl(uploaded.url);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save photo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCurrent = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSavePhotoUrl('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove photo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
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
            <Camera className="w-5 h-5 text-[#A5F3FC]" />
            <h2 className="font-display text-lg font-bold">
              {isAvatar ? 'Manage MyIcon (Profile Photo)' : 'Manage Cover Photo'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/15 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Upload / Library / Delete Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="px-3.5 py-2 rounded-lg bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload New Photo</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFilePick}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => setShowLibrary((v) => !v)}
              className="px-3.5 py-2 rounded-lg bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] text-xs font-semibold text-[var(--sp-ink)] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5 text-[var(--sp-accent-text)]" />
              <span>Choose from Existing Images</span>
            </button>

            {currentUrl && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="ml-auto px-3 py-2 rounded-lg border border-red-500/40 text-red-600 dark:text-red-400 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-red-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Current</span>
              </button>
            )}
          </div>

          {confirmDelete && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-medium text-red-700 dark:text-red-300">
                Remove your current {isAvatar ? 'MyIcon' : 'cover photo'} across Sphere.?
              </span>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--sp-border)] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleDeleteCurrent}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          )}

          {showLibrary && (
            <div className="p-3 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] space-y-2">
              <div className="text-xs font-semibold text-[var(--sp-ink)]">
                Select an existing uploaded Image
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto">
                {userImageLibrary.map((ph) => (
                  <button
                    key={ph.id}
                    type="button"
                    onClick={() => {
                      setSourceUrl(ph.src);
                      setShowLibrary(false);
                      setZoom(1);
                      setRotation(0);
                      setOffsetX(0);
                      setOffsetY(0);
                    }}
                    className="aspect-square rounded-lg overflow-hidden border border-[var(--sp-border)] hover:border-[var(--sp-primary)] cursor-pointer"
                  >
                    <img src={ph.src} alt={ph.caption} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Interactive Canvas Preview */}
          <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)]">
            {sourceUrl ? (
              <>
                <div className="text-[11px] text-[var(--sp-muted)]">
                  Drag image to reposition · Use controls below to zoom, rotate, and adjust lighting
                </div>
                <canvas
                  ref={canvasRef}
                  width={isAvatar ? 360 : 640}
                  height={isAvatar ? 360 : 240}
                  onMouseDown={(e) => {
                    setDragging(true);
                    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
                  }}
                  onMouseMove={(e) => {
                    if (!dragging || !dragStart) return;
                    setOffsetX(e.clientX - dragStart.x);
                    setOffsetY(e.clientY - dragStart.y);
                  }}
                  onMouseUp={() => setDragging(false)}
                  onMouseLeave={() => setDragging(false)}
                  className={`max-w-full border-2 border-[var(--sp-primary)] cursor-grab active:cursor-grabbing ${
                    isAvatar ? 'w-60 h-60 rounded-full' : 'w-full rounded-xl'
                  }`}
                />

                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                  <label className="space-y-1">
                    <span className="flex items-center justify-between text-[var(--sp-ink-2)]">
                      <span className="inline-flex items-center gap-1">
                        <ZoomIn className="w-3.5 h-3.5" /> Zoom
                      </span>
                      <span className="font-mono-code">{zoom.toFixed(2)}x</span>
                    </span>
                    <input
                      type="range"
                      min={0.6}
                      max={2.6}
                      step={0.05}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full accent-[#4F46E5]"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="flex items-center justify-between text-[var(--sp-ink-2)]">
                      <span className="inline-flex items-center gap-1">
                        <SunMedium className="w-3.5 h-3.5" /> Brightness
                      </span>
                      <span className="font-mono-code">{brightness}%</span>
                    </span>
                    <input
                      type="range"
                      min={60}
                      max={150}
                      step={2}
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="w-full accent-[#4F46E5]"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="flex items-center justify-between text-[var(--sp-ink-2)]">
                      <span>Contrast</span>
                      <span className="font-mono-code">{contrast}%</span>
                    </span>
                    <input
                      type="range"
                      min={60}
                      max={150}
                      step={2}
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full accent-[#4F46E5]"
                    />
                  </label>

                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                      className="flex-1 py-2 px-3 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border)] text-xs font-semibold text-[var(--sp-ink)] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Rotate 90°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setZoom(1);
                        setRotation(0);
                        setBrightness(100);
                        setContrast(100);
                        setOffsetX(0);
                        setOffsetY(0);
                      }}
                      className="py-2 px-3 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border)] text-xs font-semibold text-[var(--sp-muted)] cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-10 text-center text-xs text-[var(--sp-muted)]">
                Upload a photo or select one from your existing Images to preview and crop.
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3.5 bg-[var(--sp-surface-alt)] border-t border-[var(--sp-border)] flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[var(--sp-border)] text-xs font-semibold text-[var(--sp-ink)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!sourceUrl || saving}
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : `Save ${isAvatar ? 'MyIcon' : 'Cover Photo'}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
