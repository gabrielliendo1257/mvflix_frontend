import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '@core/config/api-base-url';
import {
    PlaybackMediaInfo,
    PlaybackProgressRequest,
    PlaybackProgressResponse,
    PlaybackSession,
    PlaybackSource,
    PlaybackStrategy,
} from '@features/player/models/playback';

/** Cuerpo tal como lo serializa el BFF (StartPlaybackResponse). */
interface StartPlaybackWire {
    sessionId: string;
    media: { id: number; title: string; posterPath: string | null; duration: string | null };
    playback: { strategy: string; url: string; mimeType: string | null; expiresAt: string | null };
    resume: { positionSeconds: number } | null;
}

interface PlaybackProgressResponseWire {
    sequence: number;
    positionSeconds: number | null;
    status: string;
}

/**
 * Experiencia de reproducción: el front dice "reproduce esta media" y recibe
 * la sesión lista para el player. No conoce bucket, objectKey ni biblioteca.
 */
@Injectable({ providedIn: 'root' })
export class PlaybackApi {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = inject(API_BASE_URL);

    start(mediaId: number): Observable<PlaybackSession> {
        return this.http
            .post<StartPlaybackWire>(`${this.baseUrl}/web/playback/${mediaId}/session`, null)
            .pipe(map((wire) => toSession(wire, this.baseUrl)));
    }

    recordProgress(
        sessionId: string,
        progress: PlaybackProgressRequest,
    ): Observable<PlaybackProgressResponse> {
        return this.http
            .post<PlaybackProgressResponseWire>(
                `${this.baseUrl}/web/playback/sessions/${sessionId}/progress`,
                progress,
            )
            .pipe(map((wire) => ({
                sequence: wire.sequence,
                positionSeconds: wire.positionSeconds,
                status: wire.status,
            })));
    }
}

function toSession(wire: StartPlaybackWire, bffBaseUrl: string): PlaybackSession {
    return {
        sessionId: wire.sessionId,
        media: {
            id: wire.media.id,
            title: wire.media.title,
            posterPath: wire.media.posterPath,
            duration: wire.media.duration,
        },
        source: toSource(wire.playback, bffBaseUrl),
        resumeSeconds: wire.resume?.positionSeconds ?? null,
    };
}

function toSource(
    playback: StartPlaybackWire['playback'],
    bffBaseUrl: string,
): PlaybackSource {
    // LOCAL llega como ruta relativa del BFF (capability en query param);
    // MANAGED ya es URL absoluta presigned hacia el object store.
    const url = playback.url.startsWith('http') ? playback.url : bffBaseUrl + playback.url;

    return {
        strategy: playback.strategy as PlaybackStrategy,
        url,
        mimeType: playback.mimeType,
        expiresAt: playback.expiresAt ? new Date(playback.expiresAt) : null,
    };
}
