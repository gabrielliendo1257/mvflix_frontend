import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/config/api-base-url';
import {
    MediaAccessUpdate,
    MediaDetail,
    MediaMetadataUpdate,
    MediaProviderLink,
} from '@features/media/models/media-detail';

/** Cliente de la experiencia Media Detail; todas las respuestas mutables son el detalle refrescado. */
@Injectable({ providedIn: 'root' })
export class MediaApi {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = inject(API_BASE_URL) + '/web/media';

    detail(mediaId: number): Observable<MediaDetail> {
        return this.http.get<MediaDetail>(`${this.baseUrl}/${mediaId}`);
    }

    updateMetadata(mediaId: number, patch: MediaMetadataUpdate): Observable<MediaDetail> {
        return this.http.put<MediaDetail>(`${this.baseUrl}/${mediaId}/metadata`, patch);
    }

    updateAccess(mediaId: number, access: MediaAccessUpdate): Observable<MediaDetail> {
        return this.http.put<MediaDetail>(`${this.baseUrl}/${mediaId}/access`, access);
    }

    linkProvider(mediaId: number, provider: MediaProviderLink): Observable<MediaDetail> {
        return this.http.post<MediaDetail>(`${this.baseUrl}/${mediaId}/provider`, provider);
    }

    unlinkProvider(mediaId: number): Observable<MediaDetail> {
        return this.http.delete<MediaDetail>(`${this.baseUrl}/${mediaId}/provider`);
    }

    deleteMedia(mediaId: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${mediaId}`);
    }
}
