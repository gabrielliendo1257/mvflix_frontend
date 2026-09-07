/** Estrategia de entrega; hoy DIRECT (Range sobre URL auto-autenticada). */
export type PlaybackStrategy = 'DIRECT';

/** Datos mínimos de la media para pintar el player. */
export interface PlaybackMediaInfo {
    readonly id: number;
    readonly title: string;
    readonly posterPath: string | null;
    readonly duration: string | null;
}

/** Acceso directo al contenido: presigned (MANAGED) o proxy del BFF (LOCAL). */
export interface PlaybackSource {
    readonly strategy: PlaybackStrategy;
    readonly url: string;
    readonly mimeType: string | null;
    /** Caducidad de la URL/capability; el front puede renovar la sesión al expirar. */
    readonly expiresAt: Date | null;
}

/** Respuesta de "quiero reproducir este contenido ahora". */
export interface PlaybackSession {
    readonly sessionId: string;
    readonly media: PlaybackMediaInfo;
    readonly source: PlaybackSource;
    /** Posición de reanudación en segundos; null hasta que exista watch history. */
    readonly resumeSeconds: number | null;
}

/** Progreso que el player reporta de forma ordenada dentro de una sesión. */
export interface PlaybackProgressRequest {
    readonly sequence: number;
    readonly positionSeconds: number;
    readonly durationSeconds: number | null;
    readonly completed: boolean;
}

/** Resultado aceptado por Playback para el último progreso recibido. */
export interface PlaybackProgressResponse {
    readonly sequence: number;
    readonly positionSeconds: number | null;
    readonly status: string;
}

/** Snapshot técnico emitido por el player; no contiene sesión ni transporte. */
export interface PlaybackLifecycleSnapshot {
    readonly positionSeconds: number;
    readonly durationSeconds: number | null;
    readonly completed: boolean;
}
