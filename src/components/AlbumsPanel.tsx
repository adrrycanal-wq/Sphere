import React, { useState } from 'react';
import {
  Edit3,
  Film,
  FolderPlus,
  Image as ImageIcon,
  Lock,
  MoveRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { AlbumItem, PhotoItem, PrivacyLevel, UserProfile } from '../types/social';
import {
  apiCreateAlbum,
  apiDeleteAlbum,
  apiDeletePhoto,
  apiUpdateAlbum,
  apiUpdatePhoto,
  apiUploadFile,
  apiUploadPhotosToAlbum,
} from '../utils/api';
import { ImageWithFallback } from './Media';

interface AlbumsPanelProps {
  ownerId: string;
  currentUser: UserProfile;
  albums: AlbumItem[];
  photos: PhotoItem[];
  onRefresh: () => Promise<void>;
  onOpenPhoto: (photoId: string) => void;
}

export const AlbumsPanel: React.FC<AlbumsPanelProps> = ({
  ownerId,
  currentUser,
  albums,
  photos,
  onRefresh,
  onOpenPhoto,
}) => {
  const isOwner = ownerId === currentUser.id;
  const ownerAlbums = albums.filter((a) => a.ownerId === ownerId);
  const ownerPhotos = photos.filter((p) => p.ownerId === ownerId);

  const [selectedAlbumId, setSelectedAlbumId] = useState<string | 'all'>('all');
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<AlbumItem | null>(null);
  const [albumName, setAlbumName] = useState('');
  const [albumDesc, setAlbumDesc] = useState('');
  const [albumPrivacy, setAlbumPrivacy] = useState<'public' | 'friends_only' | 'only_me'>('public');

  const [showUpload, setShowUpload] = useState(false);
  const [uploadAlbumId, setUploadAlbumId] = useState<string>('');
  const [uploadPrivacy, setUploadPrivacy] = useState<PrivacyLevel>('public');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingPhoto, setEditingPhoto] = useState<PhotoItem | null>(null);
  const [editPhotoCaption, setEditPhotoCaption] = useState('');
  const [editPhotoAlbumId, setEditPhotoAlbumId] = useState('');
  const [editPhotoPrivacy, setEditPhotoPrivacy] = useState<PrivacyLevel>('public');

  const displayedPhotos =
    selectedAlbumId === 'all'
      ? ownerPhotos
      : ownerPhotos.filter((p) => p.albumId === selectedAlbumId);

  const handleSaveAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingAlbum) {
        await apiUpdateAlbum(editingAlbum.id, currentUser.id, {
          name: albumName,
          description: albumDesc,
          privacy: albumPrivacy,
        });
      } else {
        await apiCreateAlbum({
          ownerId: currentUser.id,
          name: albumName,
          description: albumDesc,
          privacy: albumPrivacy,
        });
      }
      setShowCreateAlbum(false);
      setEditingAlbum(null);
      setAlbumName('');
      setAlbumDesc('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save Frame.');
    }
  };

  const handleDeleteAlbum = async (album: AlbumItem, deleteMedia: boolean) => {
    try {
      await apiDeleteAlbum(album.id, currentUser.id, deleteMedia);
      if (selectedAlbumId === album.id) setSelectedAlbumId('all');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete Frame.');
    }
  };

  const handleMultiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadBusy(true);
    setError(null);
    try {
      const items: {
        src: string;
        caption: string;
        mediaType: 'image' | 'video';
        videoFormat?: 'short' | 'long';
      }[] = [];

      for (const file of files) {
        const dataBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Read error'));
          reader.readAsDataURL(file);
        });
        const uploaded = await apiUploadFile({
          fileName: file.name,
          mimeType: file.type,
          dataBase64,
        });
        const isVideo = file.type.startsWith('video/');
        items.push({
          src: uploaded.url,
          caption: uploadCaption.trim() || file.name.replace(/\.[^.]+$/, ''),
          mediaType: isVideo ? 'video' : 'image',
          videoFormat: isVideo ? 'long' : undefined,
        });
      }

      await apiUploadPhotosToAlbum({
        ownerId: currentUser.id,
        albumId: uploadAlbumId || undefined,
        privacy: uploadPrivacy,
        location: currentUser.location,
        items,
      });
      setShowUpload(false);
      setUploadCaption('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadBusy(false);
      e.target.value = '';
    }
  };

  const handleSavePhotoEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPhoto) return;
    try {
      await apiUpdatePhoto(editingPhoto.id, currentUser.id, {
        caption: editPhotoCaption,
        albumId: editPhotoAlbumId,
        privacy: editPhotoPrivacy,
      });
      setEditingPhoto(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update media.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold text-[var(--sp-ink)]">
            Images &amp; Frames (Albums)
          </h2>
          <p className="text-xs text-[var(--sp-muted)]">
            Organize photos and videos into privacy-locked Frames without breaking feed posts.
          </p>
        </div>

        {isOwner && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingAlbum(null);
                setAlbumName('');
                setAlbumDesc('');
                setAlbumPrivacy('public');
                setShowCreateAlbum((v) => !v);
              }}
              className="px-3.5 py-2 rounded-lg bg-[var(--sp-surface)] border border-[var(--sp-border)] hover:border-[var(--sp-primary)] text-xs font-semibold text-[var(--sp-ink)] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5 text-[var(--sp-primary-text)]" />
              <span>New Frame (Album)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadAlbumId(selectedAlbumId !== 'all' ? selectedAlbumId : ownerAlbums[0]?.id || '');
                setShowUpload((v) => !v);
              }}
              className="px-3.5 py-2 rounded-lg bg-[var(--sp-primary)] hover:bg-[var(--sp-primary-hover)] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload Images / Videos</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Create / Edit Album Form */}
      {showCreateAlbum && isOwner && (
        <form
          onSubmit={handleSaveAlbum}
          className="p-4 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] space-y-3"
        >
          <div className="text-xs font-bold text-[var(--sp-ink)]">
            {editingAlbum ? `Edit Frame: ${editingAlbum.name}` : 'Create New Frame (Album)'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={albumName}
              onChange={(e) => setAlbumName(e.target.value)}
              placeholder="Frame name (e.g. Busig-On 2026)"
              className="px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />
            <select
              value={albumPrivacy}
              onChange={(e) =>
                setAlbumPrivacy(e.target.value as 'public' | 'friends_only' | 'only_me')
              }
              className="px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            >
              <option value="public">Public</option>
              <option value="friends_only">Friends Only</option>
              <option value="only_me">Only Me (Private)</option>
            </select>
          </div>
          <input
            type="text"
            value={albumDesc}
            onChange={(e) => setAlbumDesc(e.target.value)}
            placeholder="Short description..."
            className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCreateAlbum(false);
                setEditingAlbum(null);
              }}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--sp-border)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#06B6D4] text-slate-950 cursor-pointer"
            >
              Save Frame
            </button>
          </div>
        </form>
      )}

      {/* Multi-upload Form */}
      {showUpload && isOwner && (
        <div className="p-4 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-border)] space-y-3">
          <div className="text-xs font-bold text-[var(--sp-ink)]">
            Upload Multiple Images or Videos into a Frame
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={uploadAlbumId}
              onChange={(e) => setUploadAlbumId(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            >
              <option value="">Unfiled Images</option>
              {ownerAlbums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select
              value={uploadPrivacy}
              onChange={(e) => setUploadPrivacy(e.target.value as PrivacyLevel)}
              className="px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            >
              <option value="public">Everyone (Public)</option>
              <option value="friends_of_friends">Friends of Friends</option>
              <option value="friends_only">Friends Only</option>
              <option value="only_me">Only Me</option>
            </select>
            <input
              type="text"
              value={uploadCaption}
              onChange={(e) => setUploadCaption(e.target.value)}
              placeholder="Optional caption for batch..."
              className="px-3 py-2 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />
          </div>
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--sp-primary)] text-white text-xs font-semibold cursor-pointer">
            <ImageIcon className="w-4 h-4" />
            <span>{uploadBusy ? 'Uploading files...' : 'Select Photos / Videos'}</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              onChange={handleMultiFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Frames Folder Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setSelectedAlbumId('all')}
          className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
            selectedAlbumId === 'all'
              ? 'bg-[var(--sp-primary-soft)] border-[var(--sp-primary)]'
              : 'bg-[var(--sp-surface)] border-[var(--sp-border)] hover:border-[var(--sp-primary)]'
          }`}
        >
          <div className="text-xs font-bold text-[var(--sp-ink)]">All Images &amp; Videos</div>
          <div className="text-[11px] text-[var(--sp-muted)] mt-0.5 tabular-nums">
            {ownerPhotos.length} items total
          </div>
        </button>

        {ownerAlbums.map((alb) => {
          const count = ownerPhotos.filter((p) => p.albumId === alb.id).length;
          return (
            <div
              key={alb.id}
              onClick={() => setSelectedAlbumId(alb.id)}
              className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-center gap-3 ${
                selectedAlbumId === alb.id
                  ? 'bg-[var(--sp-primary-soft)] border-[var(--sp-primary)]'
                  : 'bg-[var(--sp-surface)] border-[var(--sp-border)] hover:border-[var(--sp-primary)]'
              }`}
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-[var(--sp-surface-alt)]">
                <ImageWithFallback
                  src={alb.coverSrc}
                  alt={alb.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[var(--sp-ink)] truncate">{alb.name}</div>
                <div className="text-[11px] text-[var(--sp-muted)] flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>{alb.privacy.replace('_', ' ')}</span>
                  <span>·</span>
                  <span className="tabular-nums">{count}</span>
                </div>
              </div>
              {isOwner && (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    title="Edit Frame"
                    onClick={() => {
                      setEditingAlbum(alb);
                      setAlbumName(alb.name);
                      setAlbumDesc(alb.description);
                      setAlbumPrivacy(alb.privacy);
                      setShowCreateAlbum(true);
                    }}
                    className="p-1.5 rounded hover:bg-[var(--sp-surface-alt)] text-[var(--sp-muted)] cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Delete Frame (keep images)"
                    onClick={() => void handleDeleteAlbum(alb, false)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Individual Photo Modal Inline */}
      {editingPhoto && isOwner && (
        <form
          onSubmit={handleSavePhotoEdit}
          className="p-4 rounded-xl bg-[var(--sp-surface-alt)] border border-[var(--sp-primary)] space-y-3"
        >
          <div className="text-xs font-bold text-[var(--sp-ink)]">Edit Media Item &amp; Move Frame</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              type="text"
              value={editPhotoCaption}
              onChange={(e) => setEditPhotoCaption(e.target.value)}
              placeholder="Caption"
              className="px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            />
            <select
              value={editPhotoAlbumId}
              onChange={(e) => setEditPhotoAlbumId(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            >
              <option value="">Unfiled Images</option>
              {ownerAlbums.map((a) => (
                <option key={a.id} value={a.id}>
                  Move to: {a.name}
                </option>
              ))}
            </select>
            <select
              value={editPhotoPrivacy}
              onChange={(e) => setEditPhotoPrivacy(e.target.value as PrivacyLevel)}
              className="px-3 py-1.5 text-xs rounded-lg bg-[var(--sp-input-bg)] border border-[var(--sp-input-border)] text-[var(--sp-ink)]"
            >
              <option value="public">Everyone</option>
              <option value="friends_of_friends">Friends of Friends</option>
              <option value="friends_only">Friends Only</option>
              <option value="only_me">Only Me</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingPhoto(null)}
              className="px-3 py-1 text-xs rounded-lg border border-[var(--sp-border)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-[var(--sp-primary)] text-white cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      )}

      {/* Media Grid */}
      {displayedPhotos.length === 0 ? (
        <div className="p-8 rounded-xl border border-dashed border-[var(--sp-border)] text-center text-xs text-[var(--sp-muted)]">
          No media items in this Frame yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {displayedPhotos.map((ph) => (
            <div
              key={ph.id}
              className="group relative rounded-xl overflow-hidden border border-[var(--sp-border)] bg-[var(--sp-surface)]"
            >
              <button
                type="button"
                onClick={() => onOpenPhoto(ph.id)}
                className="block w-full aspect-square overflow-hidden cursor-pointer"
              >
                {ph.mediaType === 'video' ? (
                  <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-white p-3">
                    <Film className="w-7 h-7 text-[#22D3EE] mb-1" />
                    <span className="text-[11px] truncate max-w-full">{ph.caption}</span>
                  </div>
                ) : (
                  <ImageWithFallback
                    src={ph.src}
                    alt={ph.caption}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                )}
              </button>
              <div className="p-2 flex items-center justify-between gap-1 text-[11px]">
                <span className="truncate text-[var(--sp-ink-2)]">{ph.caption}</span>
                {isOwner && (
                  <div className="flex items-center gap-1 shrink-0">
                    {selectedAlbumId !== 'all' && ph.mediaType !== 'video' && (
                      <button
                        type="button"
                        title="Set as Frame cover"
                        onClick={async () => {
                          await apiUpdateAlbum(selectedAlbumId, currentUser.id, {
                            coverPhotoId: ph.id,
                            coverSrc: ph.src,
                          });
                          await onRefresh();
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--sp-surface-alt)] hover:text-[var(--sp-primary-text)] cursor-pointer"
                      >
                        Cover
                      </button>
                    )}
                    <button
                      type="button"
                      title="Edit or move to another Frame"
                      onClick={() => {
                        setEditingPhoto(ph);
                        setEditPhotoCaption(ph.caption);
                        setEditPhotoAlbumId(ph.albumId || '');
                        setEditPhotoPrivacy(ph.privacy || 'public');
                      }}
                      className="p-1 text-[var(--sp-muted)] hover:text-[var(--sp-primary-text)] cursor-pointer"
                    >
                      <MoveRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Delete item"
                      onClick={async () => {
                        await apiDeletePhoto(ph.id, currentUser.id);
                        await onRefresh();
                      }}
                      className="p-1 text-[var(--sp-muted)] hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
