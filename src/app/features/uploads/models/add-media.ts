import { MediaKind } from '@features/movies/models/media-kind';

/** Fases visibles del proceso Add Media (espejo de AddMediaPhase del BFF). */
export type AddMediaPhase =
    | 'STARTING'
    | 'PREPARING'
    | 'WAITING_FOR_UPLOAD'
    | 'VERIFYING_UPLOAD'
    | 'FINALIZING'
    | 'READY'
    | 'FAILED'
    | 'CANCELLING'
    | 'CANCELLED';

/** Resultado de búsqueda de candidatos (GET /web/add-media/candidates). */
export interface MovieCandidate {
    providerId: number;
    title: string;
    year: number | null;
    posterPath: string | null;
    releaseDate: string;
    overview: string;
}

/** Detalle del candidato elegido (GET /web/add-media/candidates/{providerId}). */
export interface MovieCandidatePreview {
    providerId: number;
    title: string;
    originalTitle: string;
    year: number | null;
    genres: string[];
    duration: string;
    director: string;
    cast: string[];
    overview: string;
    posterPath: string | null;
    releaseDate: string;
    country: string;
    language: string;
}

/** Draft que el front ya resolvió desde el preview (CreateMovieRequest del BFF). */
export interface MovieDraft {
    title: string;
    originalTitle?: string;
    year?: number | null;
    genres?: string[];
    popularity?: number | null;
    duration?: string;
    director?: string;
    cast?: string[];
    overview?: string;
    poster_path?: string | null;
    release_date?: string;
    country?: string;
    language?: string;
    awards?: string[];
    kind?: MediaKind;
}

/** Visibilidad inicial del contenido (la política final la valida Movies). */
export type InitialVisibility = 'PRIVATE' | 'PUBLIC' | 'SHARED';

export interface InitialAccess {
    visibility: InitialVisibility;
    sharedWith?: string[];
}

export interface StartAddMediaCommand {
    file: {
        filename: string;
        sizeBytes: number;
        mimeType: string;
    };
    movie: {
        providerId: number | null;
        draft: MovieDraft;
    };
    access?: InitialAccess;
    idempotencyKey: string;
}

export interface UploadInstructions {
    url: string;
    method: 'PUT' | 'POST';
    storageKey: string;
    expectedSizeBytes: number;
    expectedMimeType: string;
}

/** Identidad local del archivo que el usuario debe volver a seleccionar. */
export interface UploadFileFingerprint {
    filename: string;
    size: number;
    mimeType: string;
    lastModified: number;
    addMediaId: string;
}

/** Vista del proceso de alta (AddMediaResponse del BFF). */
export interface AddMediaProcess {
    addMediaId: string;
    phase: AddMediaPhase;
    movieId: number | null;
    uploadId: string | null;
    upload: UploadInstructions | null;
    failureCode: string | null;
}
