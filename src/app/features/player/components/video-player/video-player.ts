import {
    AfterViewInit,
    Component,
    ElementRef,
    HostListener,
    inject,
    input,
    OnDestroy,
    signal,
    viewChild,
    output,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { PlaybackLifecycleSnapshot } from '@features/player/models/playback';

interface MenuState {
    kind: 'quality' | 'speed' | 'subtitles' | 'audio';
}

@Component({
    selector: 'app-video-player',
    imports: [],
    templateUrl: './video-player.html',
    styleUrl: './video-player.css',
})
export class VideoPlayer implements AfterViewInit, OnDestroy {
    readonly src = input<string>('');
    readonly poster = input<string>('');
    /** Posición de reanudación en segundos (resume del BFF). */
    readonly startTime = input(0);
    readonly snapshot = output<PlaybackLifecycleSnapshot>();

    /** Error de decodificación/formato/red del propio <video>. */
    readonly mediaError = signal<string | null>(null);

    readonly videoEl = viewChild<ElementRef<HTMLVideoElement>>('video');
    readonly rootEl = viewChild<ElementRef<HTMLDivElement>>('root');

    private readonly document = inject(DOCUMENT);

    readonly isPlaying = signal(false);
    readonly isMuted = signal(false);
    readonly volume = signal(1);
    readonly currentTime = signal(0);
    readonly duration = signal(0);
    readonly buffered = signal(0);
    readonly playbackRate = signal(1);
    readonly quality = signal('Auto');
    readonly subtitles = signal('Off');
    readonly audioTrack = signal('Default');
    readonly isFullscreen = signal(false);
    readonly isBuffering = signal(false);
    readonly controlsVisible = signal(true);
    readonly hoverTime = signal<number | null>(null);
    readonly hoverPercent = signal(0);
    readonly openMenu = signal<MenuState | null>(null);

    readonly qualityOptions = ['Auto', '1080p', '720p', '480p', '360p'];
    readonly speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];
    readonly subtitleOptions = ['Off', 'English', 'Español', 'Português'];
    readonly audioOptions = ['Default', 'English', 'Español'];

    private hideTimer: ReturnType<typeof setTimeout> | null = null;
    private isScrubbing = false;

    readonly playedPercent = signal(0);
    readonly bufferedPercent = signal(0);

    readonly pipSupported = this.document.pictureInPictureEnabled;

    ngAfterViewInit(): void {
        const video = this.videoEl()?.nativeElement;
        if (!video) return;

        video.addEventListener('timeupdate', this.onTimeUpdate);
        video.addEventListener('loadedmetadata', this.onLoadedMetadata);
        video.addEventListener('progress', this.onProgress);
        video.addEventListener('volumechange', this.onVolumeChange);
        video.addEventListener('play', this.onPlayEvent);
        video.addEventListener('pause', this.onPauseEvent);
        video.addEventListener('ended', this.onEndedEvent);
        video.addEventListener('waiting', this.onWaiting);
        video.addEventListener('playing', this.onPlayingEvent);
        video.addEventListener('seeking', this.onSeeking);
        video.addEventListener('seeked', this.onSeeked);
        video.addEventListener('error', this.onErrorEvent);

        this.document.addEventListener('fullscreenchange', this.onFullscreenChange);
    }

    ngOnDestroy(): void {
        const video = this.videoEl()?.nativeElement;
        if (video) {
            video.removeEventListener('timeupdate', this.onTimeUpdate);
            video.removeEventListener('loadedmetadata', this.onLoadedMetadata);
            video.removeEventListener('progress', this.onProgress);
            video.removeEventListener('volumechange', this.onVolumeChange);
            video.removeEventListener('play', this.onPlayEvent);
            video.removeEventListener('pause', this.onPauseEvent);
            video.removeEventListener('ended', this.onEndedEvent);
            video.removeEventListener('waiting', this.onWaiting);
            video.removeEventListener('playing', this.onPlayingEvent);
            video.removeEventListener('seeking', this.onSeeking);
            video.removeEventListener('seeked', this.onSeeked);
            video.removeEventListener('error', this.onErrorEvent);
        }

        this.document.removeEventListener('fullscreenchange', this.onFullscreenChange);
        if (this.hideTimer) clearTimeout(this.hideTimer);
    }

    // ─── Video events ───

    private readonly onTimeUpdate = (): void => {
        const video = this.videoEl()?.nativeElement;
        if (!video) return;

        this.currentTime.set(video.currentTime);
        this.playedPercent.set(video.duration ? (video.currentTime / video.duration) * 100 : 0);
        this.emitSnapshot(video, false);
    };

    private readonly onLoadedMetadata = (): void => {
        const video = this.videoEl()?.nativeElement;
        if (!video) return;

        this.duration.set(video.duration || 0);

        // Resume: solo si el usuario aún no interactuó con la línea de tiempo.
        const startAt = this.startTime();
        if (startAt > 0 && startAt < video.duration && !this.isScrubbing) {
            video.currentTime = startAt;
        }
    };

    private readonly onProgress = (): void => {
        const video = this.videoEl()?.nativeElement;
        if (!video || !video.duration || !video.buffered.length) return;

        const end = video.buffered.end(video.buffered.length - 1);
        this.buffered.set(end);
        this.bufferedPercent.set((end / video.duration) * 100);
    };

    private readonly onVolumeChange = (): void => {
        const video = this.videoEl()?.nativeElement;
        if (!video) return;

        this.volume.set(video.volume);
        this.isMuted.set(video.muted || video.volume === 0);
    };

    private readonly onPlayEvent = (): void => {
        this.isPlaying.set(true);
        this.showControls();
    };

    private readonly onPauseEvent = (): void => {
        const video = this.videoEl()?.nativeElement;
        this.isPlaying.set(false);
        this.showControls();
        if (video) this.emitSnapshot(video, false);
    };

    private readonly onEndedEvent = (): void => {
        const video = this.videoEl()?.nativeElement;
        if (video) this.emitSnapshot(video, true);
    };

    private emitSnapshot(video: HTMLVideoElement, completed: boolean): void {
        this.snapshot.emit({
            positionSeconds: video.currentTime,
            durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
            completed,
        });
    }

    private readonly onWaiting = (): void => {
        this.isBuffering.set(true);
    };

    private readonly onPlayingEvent = (): void => {
        this.isBuffering.set(false);
        this.mediaError.set(null);
    };

    private readonly onSeeking = (): void => {
        this.isBuffering.set(true);
    };

    private readonly onSeeked = (): void => {
        this.isBuffering.set(false);
    };

    private readonly onErrorEvent = (): void => {
        const video = this.videoEl()?.nativeElement;
        const mediaError = video?.error;

        if (mediaError) {
            console.error(
                `Error de video (code ${mediaError.code}): ${mediaError.message}`,
                { src: video?.currentSrc || video?.src },
            );
        }

        this.isBuffering.set(false);
        this.isPlaying.set(false);
    };

    private readonly onFullscreenChange = (): void => {
        this.isFullscreen.set(this.document.fullscreenElement !== null);
    };

    // ─── Controls ───

    onVideoClick(): void {
        this.togglePlay();
    }

    togglePlay(): void {
        const video = this.videoEl()?.nativeElement;
        if (!video) return;

        // No intentar reproducir sin una fuente válida asignada/cargada.
        const hasSource = Boolean(this.src()) && video.networkState !== HTMLMediaElement.NETWORK_EMPTY;
        if (!hasSource) {
            console.warn('togglePlay ignorado: no hay una fuente de video disponible.');
            return;
        }

        if (video.paused) {
            video.play().catch((error: unknown) => {
                // Captura p.ej. NotSupportedError / AbortError para que no quede como
                // "Uncaught (in promise)" y el estado de la UI sea consistente.
                console.error('No se pudo iniciar la reproducción:', error);
                this.isPlaying.set(false);
                this.isBuffering.set(false);
            });
        } else {
            video.pause();
        }
    }

    seekRelative(seconds: number): void {
        const video = this.videoEl()?.nativeElement;
        if (!video) return;

        video.currentTime = Math.min(Math.max(video.currentTime + seconds, 0), video.duration || 0);
    }

    toggleMute(): void {
        const video = this.videoEl()?.nativeElement;
        if (!video) return;

        video.muted = !video.muted;
    }

    onVolumeInput(event: Event): void {
        const video = this.videoEl()?.nativeElement;
        if (!video) return;

        const value = Number((event.target as HTMLInputElement).value);
        video.volume = value;
        video.muted = value === 0;
    }

    onRateChange(rate: number): void {
        const video = this.videoEl()?.nativeElement;
        if (!video) return;

        video.playbackRate = rate;
        this.playbackRate.set(rate);
        this.openMenu.set(null);
    }

    onQualityChange(quality: string): void {
        this.quality.set(quality);
        this.openMenu.set(null);
    }

    onSubtitlesChange(lang: string): void {
        this.subtitles.set(lang);
        this.openMenu.set(null);
    }

    onAudioChange(track: string): void {
        this.audioTrack.set(track);
        this.openMenu.set(null);
    }

    toggleFullscreen(): void {
        const root = this.rootEl()?.nativeElement;
        if (!root) return;

        if (this.document.fullscreenElement) {
            void this.document.exitFullscreen();
        } else {
            void root.requestFullscreen();
        }
    }

    async togglePip(): Promise<void> {
        const video = this.videoEl()?.nativeElement;
        if (!video) return;

        try {
            if (this.document.pictureInPictureElement) {
                await this.document.exitPictureInPicture();
            } else {
                await video.requestPictureInPicture();
            }
        } catch {
            // PiP puede fallar por política del navegador; no rompe la reproducción.
        }
    }

    toggleMenu(kind: MenuState['kind']): void {
        this.openMenu.set(this.openMenu()?.kind === kind ? null : { kind });
        this.showControls();
    }

    closeMenu(): void {
        this.openMenu.set(null);
    }

    onRootClick(event: MouseEvent): void {
        event.stopPropagation();
    }

    // ─── Timeline ───

    onTimelineDown(event: PointerEvent): void {
        this.isScrubbing = true;
        (event.target as HTMLElement).setPointerCapture(event.pointerId);
        this.updateScrub(event);
        this.showControls();
    }

    onTimelineMove(event: PointerEvent): void {
        const video = this.videoEl()?.nativeElement;
        if (!video) return;

        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const percent = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);

        this.hoverPercent.set(percent * 100);
        this.hoverTime.set(percent * (video.duration || 0));

        if (this.isScrubbing) {
            this.updateScrub(event);
        }
    }

    onTimelineUp(event: PointerEvent): void {
        if (!this.isScrubbing) return;

        this.isScrubbing = false;
        this.updateScrub(event);

        const video = this.videoEl()?.nativeElement;
        if (!video) return;

        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const percent = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);

        video.currentTime = percent * (video.duration || 0);
        this.showControls();
    }

    onTimelineLeave(): void {
        if (!this.isScrubbing) {
            this.hoverTime.set(null);
        }
    }

    private updateScrub(event: PointerEvent): void {
        const video = this.videoEl()?.nativeElement;
        if (!video) return;

        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const percent = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);

        this.playedPercent.set(percent * 100);
        this.currentTime.set(percent * (video.duration || 0));
    }

    // ─── Auto-hide ───

    onMouseMove(): void {
        this.showControls();
    }

    private showControls(): void {
        this.controlsVisible.set(true);

        if (this.hideTimer) clearTimeout(this.hideTimer);
        if (this.hideTimer) this.hideTimer = null;

        this.hideTimer = setTimeout(() => {
            if (this.isPlaying() && !this.isScrubbing && !this.openMenu()) {
                this.controlsVisible.set(false);
            }
        }, 2500);
    }

    // ─── Keyboard ───

    @HostListener('document:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent): void {
        const video = this.videoEl()?.nativeElement;
        if (!video) return;

        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        switch (event.key.toLowerCase()) {
            case ' ':
                event.preventDefault();
                this.togglePlay();
                break;
            case 'arrowright':
                event.preventDefault();
                this.seekRelative(10);
                break;
            case 'arrowleft':
                event.preventDefault();
                this.seekRelative(-10);
                break;
            case 'm':
                this.toggleMute();
                break;
            case 'f':
                this.toggleFullscreen();
                break;
        }

        if (event.key === 'Escape' && this.openMenu()) {
            this.openMenu.set(null);
        }

        this.showControls();
    }

    // ─── Formatting ───

    formatTime(seconds: number): string {
        if (!Number.isFinite(seconds) || seconds < 0) return '0:00';

        const total = Math.floor(seconds);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const secs = total % 60;

        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }

        return `${minutes}:${String(secs).padStart(2, '0')}`;
    }
}

/** MEDIA_ERR_* del estándar HTML → mensaje accionable. */
function describeMediaError(code: number | undefined): string {
    switch (code) {
        case 1:
            return 'Reproducción interrumpida.';
        case 2:
            return 'Se perdió la conexión mientras se cargaba el video.';
        case 3:
            return 'El video está dañado o su códec no es compatible.';
        case 4:
            return 'Este formato no se puede reproducir en el navegador (p. ej. MKV). Usa MP4/H.264 o WebM.';
        default:
            return 'No se pudo reproducir el video.';
    }
}
