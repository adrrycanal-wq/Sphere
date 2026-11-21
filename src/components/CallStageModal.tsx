import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  PhoneIncoming,
  PhoneOff,
  Sparkles,
  Users,
  Video,
  X,
} from 'lucide-react';
import { MessageThread, UserProfile } from '../types/social';
import { UserAvatar } from './Media';

export type VideoFilterId =
  | 'none'
  | 'cyber_neon'
  | 'sunset_glow'
  | 'vintage_film'
  | 'studio_noir'
  | 'vaporwave'
  | 'pixel_retro'
  | 'mirage_mirror';

export type VideoOverlayId =
  | 'none'
  | 'sparkles'
  | 'cool_frame'
  | 'hype_fire'
  | 'labo_fiesta'
  | 'live_badge';

export interface ActiveCallSession {
  threadId: string;
  mode: 'video' | 'screen';
  incomingFromUserId?: string;
  remoteOffer?: RTCSessionDescriptionInit;
}

interface FilterOption {
  id: VideoFilterId;
  label: string;
  css: string;
  swatch: string;
}

const VIDEO_FILTERS: FilterOption[] = [
  { id: 'none', label: 'Original', css: 'none', swatch: 'bg-slate-600' },
  { id: 'cyber_neon', label: 'Cyber Neon', css: 'contrast(1.22) saturate(1.55) hue-rotate(15deg)', swatch: 'bg-gradient-to-tr from-[#4F46E5] to-[#06B6D4]' },
  { id: 'sunset_glow', label: 'Sunset Glow', css: 'sepia(0.28) saturate(1.6) brightness(1.06)', swatch: 'bg-gradient-to-tr from-amber-500 to-rose-500' },
  { id: 'vintage_film', label: 'Vintage 90s', css: 'sepia(0.55) contrast(1.08) brightness(0.95)', swatch: 'bg-gradient-to-tr from-amber-800 to-yellow-600' },
  { id: 'studio_noir', label: 'Studio Noir', css: 'grayscale(1) contrast(1.35) brightness(1.04)', swatch: 'bg-gradient-to-tr from-zinc-900 to-zinc-400' },
  { id: 'vaporwave', label: 'Vaporwave', css: 'hue-rotate(270deg) saturate(1.75) contrast(1.15)', swatch: 'bg-gradient-to-tr from-fuchsia-600 to-cyan-400' },
  { id: 'pixel_retro', label: 'Pixel 8-Bit', css: 'contrast(1.15) saturate(1.3)', swatch: 'bg-gradient-to-tr from-emerald-500 to-indigo-600' },
  { id: 'mirage_mirror', label: 'Mirror FX', css: 'saturate(1.25) contrast(1.1)', swatch: 'bg-gradient-to-tr from-sky-500 to-purple-600' },
];

const OVERLAY_OPTIONS: Array<{ id: VideoOverlayId; label: string }> = [
  { id: 'none', label: 'No Effect' },
  { id: 'sparkles', label: '✨ Sparkle Halo' },
  { id: 'cool_frame', label: '🕶️ Neon HUD' },
  { id: 'hype_fire', label: '🔥 Fire Frame' },
  { id: 'labo_fiesta', label: '🌴 Labo Vibes' },
  { id: 'live_badge', label: '📡 Live Card' },
];

interface CallStageModalProps {
  session: ActiveCallSession | null;
  thread: MessageThread | null;
  currentUser: UserProfile;
  users: UserProfile[];
  wsRef: React.RefObject<WebSocket | null>;
  onSendSnapshotToChat?: (threadId: string, dataUrl: string) => Promise<void>;
  onEndCall: () => void;
}

export const CallStageModal: React.FC<CallStageModalProps> = ({
  session,
  thread,
  currentUser,
  users,
  wsRef,
  onSendSnapshotToChat,
  onEndCall,
}) => {
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<VideoFilterId>('cyber_neon');
  const [activeOverlay, setActiveOverlay] = useState<VideoOverlayId>('none');
  const [callStatus, setCallStatus] = useState('Initializing media...');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [snapshotToast, setSnapshotToast] = useState<string | null>(null);

  const rawVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const camStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const rafRef = useRef<number | null>(null);

  const filterRef = useRef<VideoFilterId>(activeFilter);
  const overlayRef = useRef<VideoOverlayId>(activeOverlay);
  const camOffRef = useRef<boolean>(camOff);

  useEffect(() => {
    filterRef.current = activeFilter;
  }, [activeFilter]);

  useEffect(() => {
    overlayRef.current = activeOverlay;
  }, [activeOverlay]);

  useEffect(() => {
    camOffRef.current = camOff;
  }, [camOff]);

  const sendSignal = (type: string, extra: Record<string, unknown> = {}) => {
    if (!session || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type,
        threadId: session.threadId,
        fromUserId: currentUser.id,
        ...extra,
      })
    );
  };

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const cleanup = () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      processedStreamRef.current?.getTracks().forEach((t) => t.stop());
      camStreamRef.current = null;
      screenStreamRef.current = null;
      processedStreamRef.current = null;
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      setIsScreenSharing(false);
      setHasRemoteVideo(false);
    };

    const drawLoop = () => {
      const canvas = canvasRef.current;
      const sourceVideo = rawVideoRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.save();
      ctx.clearRect(0, 0, w, h);

      if (camOffRef.current || !sourceVideo || sourceVideo.readyState < 2) {
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#0F172A');
        grad.addColorStop(1, '#312E81');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 26px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${currentUser.name}`, w / 2, h / 2 - 8);
        ctx.fillStyle = '#22D3EE';
        ctx.font = '14px ui-monospace, monospace';
        ctx.fillText(camOffRef.current ? 'CAMERA PAUSED' : 'CONNECTING FEED...', w / 2, h / 2 + 22);
      } else {
        const currentFilter = filterRef.current;
        const filterSpec = VIDEO_FILTERS.find((f) => f.id === currentFilter);
        ctx.filter = filterSpec?.css || 'none';

        if (currentFilter === 'pixel_retro') {
          ctx.imageSmoothingEnabled = false;
          const pw = 64;
          const ph = 48;
          ctx.drawImage(sourceVideo, 0, 0, pw, ph);
          ctx.drawImage(canvas, 0, 0, pw, ph, 0, 0, w, h);
          ctx.imageSmoothingEnabled = true;
        } else if (currentFilter === 'mirage_mirror') {
          ctx.drawImage(sourceVideo, 0, 0, w / 2, h, 0, 0, w / 2, h);
          ctx.save();
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(sourceVideo, 0, 0, w / 2, h, 0, 0, w / 2, h);
          ctx.restore();
        } else {
          ctx.drawImage(sourceVideo, 0, 0, w, h);
        }
        ctx.filter = 'none';

        if (currentFilter === 'cyber_neon') {
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.75)';
          ctx.lineWidth = 4;
          ctx.strokeRect(10, 10, w - 20, h - 20);
        } else if (currentFilter === 'vintage_film') {
          ctx.fillStyle = 'rgba(0,0,0,0.65)';
          ctx.fillRect(0, 0, w, 24);
          ctx.fillRect(0, h - 24, w, 24);
        } else if (currentFilter === 'vaporwave') {
          ctx.fillStyle = 'rgba(236, 72, 153, 0.14)';
          ctx.fillRect(0, 0, w, h);
        }
      }

      // Live Canvas Overlays
      const overlay = overlayRef.current;
      const tick = Date.now() / 400;
      if (overlay === 'sparkles') {
        ctx.font = '26px serif';
        for (let i = 0; i < 6; i += 1) {
          const x = 55 + i * 105;
          const y = 44 + Math.sin(tick + i) * 10;
          ctx.fillText('✨', x, y);
        }
      } else if (overlay === 'cool_frame') {
        ctx.strokeStyle = '#06B6D4';
        ctx.lineWidth = 3;
        ctx.strokeRect(18, 18, w - 36, h - 36);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
        ctx.fillRect(28, h - 56, 220, 28);
        ctx.fillStyle = '#A5F3FC';
        ctx.font = 'bold 12px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`SPHERE CAM · ${currentUser.handle}`, 38, h - 38);
      } else if (overlay === 'hype_fire') {
        ctx.strokeStyle = '#F97316';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        ctx.font = '28px serif';
        ctx.fillText('🔥', 20, 42);
        ctx.fillText('🔥', w - 50, 42);
      } else if (overlay === 'labo_fiesta') {
        ctx.fillStyle = 'rgba(79, 70, 229, 0.85)';
        ctx.fillRect(20, h - 54, 245, 32);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('🌴 Labo · Sphere. Live Call', 32, h - 33);
      } else if (overlay === 'live_badge') {
        ctx.fillStyle = '#E11D48';
        ctx.fillRect(20, 20, 74, 26);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('● LIVE', 57, 37);
      }

      ctx.restore();
      rafRef.current = window.requestAnimationFrame(drawLoop);
    };

    const startSession = async () => {
      setMediaError(null);
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        pcRef.current = pc;

        pc.onicecandidate = (ev) => {
          if (ev.candidate) {
            sendSignal('call:ice', { candidate: ev.candidate });
          }
        };

        pc.ontrack = (ev) => {
          const [remoteStream] = ev.streams;
          if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            setHasRemoteVideo(true);
            setCallStatus('Connected live');
          }
        };

        // Start camera or immediate screen share
        if (session.mode === 'screen') {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          if (cancelled) {
            displayStream.getTracks().forEach((t) => t.stop());
            return;
          }
          screenStreamRef.current = displayStream;
          setIsScreenSharing(true);
          if (rawVideoRef.current) {
            rawVideoRef.current.srcObject = displayStream;
            await rawVideoRef.current.play().catch(() => {});
          }
          displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
            setIsScreenSharing(false);
          });
          setCallStatus('Screen Sharing Active');
        } else {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } },
            audio: true,
          });
          if (cancelled) {
            camStream.getTracks().forEach((t) => t.stop());
            return;
          }
          camStreamRef.current = camStream;
          if (rawVideoRef.current) {
            rawVideoRef.current.srcObject = camStream;
            await rawVideoRef.current.play().catch(() => {});
          }
          setCallStatus(
            session.incomingFromUserId ? 'Call connected' : 'Live Video Preview · Ringing thread...'
          );
        }

        // Start canvas filter pipeline & bind processed track to RTCPeerConnection
        rafRef.current = window.requestAnimationFrame(drawLoop);
        const canvas = canvasRef.current;
        if (canvas && typeof canvas.captureStream === 'function') {
          const outStream = canvas.captureStream(24);
          processedStreamRef.current = outStream;
          const videoTrack = outStream.getVideoTracks()[0];
          if (videoTrack) {
            pc.addTrack(videoTrack, outStream);
          }
          if (previewVideoRef.current) {
            previewVideoRef.current.srcObject = outStream;
            await previewVideoRef.current.play().catch(() => {});
          }
        }
        const activeAudio =
          camStreamRef.current?.getAudioTracks()[0] ||
          screenStreamRef.current?.getAudioTracks()[0];
        if (activeAudio && processedStreamRef.current) {
          pc.addTrack(activeAudio, processedStreamRef.current);
        }

        // WebRTC SDP signaling
        if (session.remoteOffer) {
          await pc.setRemoteDescription(new RTCSessionDescription(session.remoteOffer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal('call:answer', { answer });
        } else {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal('call:invite', {
            mode: session.mode,
            offer,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to start camera or screen capture.';
        setMediaError(
          msg.includes('Permission') || msg.includes('NotAllowed')
            ? 'Camera/Microphone or Screen Share permission was denied by browser.'
            : msg
        );
        setCallStatus('Media unavailable');
      }
    };

    const handleWsMessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg.payload?.threadId !== session.threadId) return;
        const pc = pcRef.current;
        if (msg.type === 'call:answer' && msg.payload.answer && pc) {
          void pc.setRemoteDescription(new RTCSessionDescription(msg.payload.answer));
          setCallStatus('Connected live');
        } else if (msg.type === 'call:ice' && msg.payload.candidate && pc) {
          void pc.addIceCandidate(new RTCIceCandidate(msg.payload.candidate)).catch(() => {});
        } else if (msg.type === 'call:end' || msg.type === 'call:decline') {
          setCallStatus('Peer ended the call');
        }
      } catch {
        // ignore
      }
    };

    const ws = wsRef.current;
    ws?.addEventListener('message', handleWsMessage);
    void startSession();

    return () => {
      cancelled = true;
      ws?.removeEventListener('message', handleWsMessage);
      cleanup();
    };
  }, [session?.threadId, session?.mode]);

  if (!session || !thread) return null;

  const others = thread.participantIds
    .filter((id) => id !== currentUser.id)
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is UserProfile => Boolean(u));
  const title = thread.title || others.map((u) => u.name).join(', ') || 'Sphere Call';

  const toggleMic = () => {
    const next = !micMuted;
    setMicMuted(next);
    camStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
  };

  const toggleCam = () => {
    const next = !camOff;
    setCamOff(next);
    camStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);
      if (camStreamRef.current && rawVideoRef.current) {
        rawVideoRef.current.srcObject = camStreamRef.current;
        await rawVideoRef.current.play().catch(() => {});
        setCallStatus('Returned to Camera + Filters');
      } else {
        try {
          const cam = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          camStreamRef.current = cam;
          if (rawVideoRef.current) {
            rawVideoRef.current.srcObject = cam;
            await rawVideoRef.current.play().catch(() => {});
          }
          setCallStatus('Switched to Camera + Filters');
        } catch {
          setCamOff(true);
        }
      }
      return;
    }

    setMediaError(null);
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = display;
      setIsScreenSharing(true);
      setCamOff(false);
      if (rawVideoRef.current) {
        rawVideoRef.current.srcObject = display;
        await rawVideoRef.current.play().catch(() => {});
      }
      setCallStatus('Screen Sharing Live');
      display.getVideoTracks()[0]?.addEventListener('ended', () => {
        setIsScreenSharing(false);
        if (camStreamRef.current && rawVideoRef.current) {
          rawVideoRef.current.srcObject = camStreamRef.current;
          void rawVideoRef.current.play().catch(() => {});
        }
      });
    } catch (err) {
      setMediaError(
        err instanceof Error ? err.message : 'Screen sharing canceled or blocked by browser.'
      );
    }
  };

  const captureFilteredSnapshot = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    if (onSendSnapshotToChat) {
      await onSendSnapshotToChat(session.threadId, dataUrl);
      setSnapshotToast('Filtered snapshot sent to chat!');
      window.setTimeout(() => setSnapshotToast(null), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white">
        {/* Top Bar */}
        <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {thread.isGroup ? (
              <div
                className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center shrink-0"
                style={{ backgroundColor: thread.avatar ? undefined : thread.avatarColor || '#4F46E5' }}
              >
                {thread.avatar ? (
                  <img src={thread.avatar} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-4 h-4 text-white" />
                )}
              </div>
            ) : (
              <UserAvatar user={others[0]} size="sm" />
            )}
            <div className="min-w-0">
              <div className="font-display text-sm font-bold truncate">{title}</div>
              <div className="text-[11px] text-[#22D3EE] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{callStatus}</span>
                {isScreenSharing && (
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                    SCREEN SHARE
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sendSignal('call:end');
              onEndCall();
            }}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {mediaError && (
          <div className="px-4 py-2 bg-red-500/20 border-b border-red-500/40 text-xs text-red-200">
            {mediaError}
          </div>
        )}
        {snapshotToast && (
          <div className="px-4 py-2 bg-emerald-500/20 border-b border-emerald-500/40 text-xs text-emerald-200">
            {snapshotToast}
          </div>
        )}

        {/* Video Stage */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[280px] overflow-hidden">
          <video ref={rawVideoRef} muted playsInline className="hidden" />
          <canvas ref={canvasRef} width={640} height={480} className="hidden" />

          {hasRemoteVideo ? (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full max-h-[460px] object-contain"
              />
              <video
                ref={previewVideoRef}
                muted
                autoPlay
                playsInline
                className="absolute bottom-3 right-3 w-40 h-28 rounded-xl border-2 border-[#06B6D4] object-cover shadow-xl bg-slate-900"
              />
            </>
          ) : (
            <video
              ref={previewVideoRef}
              muted
              autoPlay
              playsInline
              className="w-full h-full max-h-[460px] object-contain"
            />
          )}
        </div>

        {/* Cool Video Filters & AR Overlays Strip */}
        <div className="px-4 py-2.5 bg-slate-950/90 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[11px] font-bold text-[#A5F3FC] inline-flex items-center gap-1 shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </span>
            {VIDEO_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer border ${
                  activeFilter === f.id
                    ? 'bg-[#4F46E5] border-[#22D3EE] text-white'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${f.swatch}`} />
                <span>{f.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-bold text-slate-400 shrink-0">AR Effects:</span>
            {OVERLAY_OPTIONS.map((ov) => (
              <button
                key={ov.id}
                type="button"
                onClick={() => setActiveOverlay(ov.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer border ${
                  activeOverlay === ov.id
                    ? 'bg-[#06B6D4] border-[#06B6D4] text-slate-950'
                    : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                {ov.label}
              </button>
            ))}
          </div>
        </div>

        {/* Call Controls */}
        <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={toggleMic}
            className={`px-3.5 py-2 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              micMuted ? 'bg-rose-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
          >
            {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{micMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button
            type="button"
            onClick={toggleCam}
            className={`px-3.5 py-2 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              camOff ? 'bg-rose-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
          >
            {camOff ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            <span>{camOff ? 'Cam On' : 'Cam Off'}</span>
          </button>

          <button
            type="button"
            onClick={() => void toggleScreenShare()}
            className={`px-3.5 py-2 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              isScreenSharing
                ? 'bg-[#06B6D4] text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
          >
            {isScreenSharing ? <MonitorOff className="w-4 h-4" /> : <MonitorUp className="w-4 h-4" />}
            <span>{isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}</span>
          </button>

          {onSendSnapshotToChat && (
            <button
              type="button"
              onClick={() => void captureFilteredSnapshot()}
              className="px-3.5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Video className="w-4 h-4" />
              <span>Snap Filter to Chat</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              sendSignal('call:end');
              onEndCall();
            }}
            className="px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End Call</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface IncomingCallToastProps {
  callerName: string;
  mode: 'video' | 'screen';
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallToast: React.FC<IncomingCallToastProps> = ({
  callerName,
  mode,
  onAccept,
  onDecline,
}) => (
  <div className="fixed top-16 right-4 z-50 w-80 bg-slate-900 border border-[#06B6D4] text-white rounded-2xl shadow-2xl p-4 space-y-3">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-[#06B6D4] text-slate-950 flex items-center justify-center animate-bounce shrink-0">
        {mode === 'screen' ? <MonitorUp className="w-5 h-5" /> : <PhoneIncoming className="w-5 h-5" />}
      </div>
      <div>
        <div className="text-xs font-bold text-[#A5F3FC]">
          Incoming {mode === 'screen' ? 'Screen Share' : 'Video Call'}
        </div>
        <div className="text-sm font-bold">{callerName}</div>
      </div>
    </div>
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onDecline}
        className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold cursor-pointer"
      >
        Decline
      </button>
      <button
        type="button"
        onClick={onAccept}
        className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer"
      >
        Join Live
      </button>
    </div>
  </div>
);
