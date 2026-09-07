import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MoviesApi } from '@features/movies/data-access/movies-api';
import { PlaybackApi } from '@features/player/data-access/playback-api';
import { WebMovie } from '@features/movies/models/web-movie';
import { PlaybackLifecycleSnapshot } from '@features/player/models/playback';
import { EMPTY, Subject, catchError, concatMap } from 'rxjs';

const PROGRESS_INTERVAL_MS = 10_000;

interface ProgressEvent {
    sessionId: string;
    sequence: number;
    snapshot: PlaybackLifecycleSnapshot;
}

/**
 * Estado de la experiencia de reproducción para una navegación.
 * Se provee por página: cada visita tiene su propia instancia.
 */
@Injectable()
export class WatchStore {
    private readonly moviesApi = inject(MoviesApi);
    private readonly playbackApi = inject(PlaybackApi);

    readonly movie = signal<WebMovie | null>(null);
    readonly videoSrc = signal('');
    readonly poster = signal('');
    readonly title = signal('');
    readonly year = signal('');
    readonly overview = signal('');
    /** Posición de reanudación (segundos) reportada por la sesión. */
    readonly resumeSeconds = signal<number | null>(null);
    readonly sessionId = signal<string | null>(null);
    readonly loading = signal(true);
    /** Mensaje legible cuando la sesión no pudo componerse. */
    readonly error = signal<string | null>(null);

    private readonly progressEvents = new Subject<ProgressEvent>();
    private nextSequence = 1;
    private lastProgressAt = 0;
    private latestSnapshot: PlaybackLifecycleSnapshot | null = null;
    private lastEnqueuedSnapshot: PlaybackLifecycleSnapshot | null = null;

    constructor() {
        const destroyRef = inject(DestroyRef);
        this.progressEvents
            .pipe(
                concatMap(({ sessionId, sequence, snapshot }) =>
                    this.playbackApi.recordProgress(sessionId, {
                        sequence,
                        positionSeconds: Math.max(0, Math.round(snapshot.positionSeconds)),
                        durationSeconds: snapshot.durationSeconds == null
                            ? null
                            : Math.max(0, Math.round(snapshot.durationSeconds)),
                        completed: snapshot.completed,
                    }).pipe(
                        // Watch history is best effort; never interrupt playback.
                        catchError(() => EMPTY),
                    ),
                ),
            )
            .subscribe();
        destroyRef.onDestroy(() => this.progressEvents.complete());
    }

    load(id: number): void {
        this.reset();
        this.loading.set(true);

        this.moviesApi.findById(id).subscribe({
            next: (movie) => {
                this.movie.set(movie);
                this.title.set(movie.title);
                this.year.set(movie.release_date?.slice(0, 4) ?? '');
                this.overview.set(movie.overview ?? '');
                const posterUrl = this.resolvePosterUrl(movie.poster_path);
                if (posterUrl) {
                    this.poster.set(posterUrl);
                }
            },
            error: (error: unknown) => {
                this.loading.set(false);
                this.error.set(toMessage(error));
            },
        });

        this.playbackApi.start(id).subscribe({
            next: (session) => {
                this.videoSrc.set(session.source.url);
                if (!this.poster()) this.poster.set(resolvePath(session.media.posterPath));
                if (!this.title()) this.title.set(session.media.title);
                this.resumeSeconds.set(session.resumeSeconds);
                this.sessionId.set(session.sessionId);
                this.nextSequence = 1;
                this.lastProgressAt = 0;
                this.loading.set(false);
            },
            error: (error: unknown) => {
                this.loading.set(false);
                this.error.set(toMessage(error));
            },
        });
    }

    onSnapshot(snapshot: PlaybackLifecycleSnapshot): void {
        this.latestSnapshot = snapshot;
        this.enqueueIfDue(snapshot);
    }

    onPaused(): void {
        if (this.latestSnapshot && this.latestSnapshot !== this.lastEnqueuedSnapshot) {
            this.enqueue(this.latestSnapshot);
        }
    }

    private enqueueIfDue(snapshot: PlaybackLifecycleSnapshot): void {
        const sessionId = this.sessionId();
        if (!sessionId) return;

        const now = Date.now();
        const forced = snapshot.completed || !this.lastProgressAt;
        if (!forced && now - this.lastProgressAt < PROGRESS_INTERVAL_MS) return;

        this.enqueue(snapshot);
    }

    private enqueue(snapshot: PlaybackLifecycleSnapshot): void {
        const sessionId = this.sessionId();
        if (!sessionId) return;
        this.lastProgressAt = Date.now();
        this.lastEnqueuedSnapshot = snapshot;
        this.progressEvents.next({ sessionId, sequence: this.nextSequence++, snapshot });
    }

    private reset(): void {
        this.movie.set(null);
        this.videoSrc.set('');
        this.poster.set('');
        this.title.set('');
        this.year.set('');
        this.overview.set('');
        this.resumeSeconds.set(null);
        this.sessionId.set(null);
        this.error.set(null);
        this.nextSequence = 1;
        this.lastProgressAt = 0;
        this.latestSnapshot = null;
        this.lastEnqueuedSnapshot = null;
    }

    private resolvePosterUrl(posterPath: string | null | undefined): string | null {
        if (!posterPath) return null;
        return posterPath.startsWith('http') ? posterPath : `https://image.tmdb.org/t/p/w500${posterPath}`;
    }
}

function resolvePath(path: string | null): string {
    return path ?? '';
}

/** Mapea los códigos estables de la experiencia playback a mensajes de UI. */
function toMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
        const body = error.error as { code?: string; message?: string } | null;
        if (body?.message) return body.message;

        switch (body?.code ?? byStatus(error.status)) {
            case 'MEDIA_NOT_FOUND':
                return 'Esta media no existe o no está disponible.';
            case 'PLAYBACK_FORBIDDEN':
                return 'No tienes acceso a esta película.';
            case 'MEDIA_NOT_READY':
                return 'La película todavía no está lista para reproducirse.';
            case 'NO_PLAYABLE_ASSET':
                return 'Todavía no hay contenido subido para esta película.';
            case 'SOURCE_UNAVAILABLE':
                return 'El contenido no está disponible en este momento. Intenta de nuevo.';
            default:
                return error.status === 0
                    ? 'Sin conexión con el servidor.'
                    : `Error ${error.status} al iniciar la reproducción.`;
        }
    }
    return error instanceof Error ? error.message : 'No se pudo iniciar la reproducción.';
}

function byStatus(status: number): string | undefined {
    if (status === 404) return 'MEDIA_NOT_FOUND';
    if (status === 403) return 'PLAYBACK_FORBIDDEN';
    if (status === 409) return 'MEDIA_NOT_READY';
    if (status === 503) return 'SOURCE_UNAVAILABLE';
    return undefined;
}
