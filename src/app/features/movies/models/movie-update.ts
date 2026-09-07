import { MediaKind } from '@features/movies/models/media-kind';

/**
 * Edición manual de metadata de una película (merge). Los campos `null`/`undefined`
 * conservan el valor actual en el backend; las listas vacías limpian el valor.
 * Con {@code kind = VIDEO} el backend descarta la metadata de película en la misma
 * llamada (solo persiste lo que se manda).
 */
export interface MovieUpdateRequest {
    title?: string;
    originalTitle?: string;
    year?: number | null;
    genres?: string[];
    duration?: string;
    director?: string;
    cast?: string[];
    overview?: string;
    poster_path?: string | null;
    release_date?: string;
    country?: string;
    language?: string;
    awards?: string[];
    popularity?: number | null;
    kind?: MediaKind;
}
