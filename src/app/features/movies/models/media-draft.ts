import { MovieMetadata } from './movie-metadata';

/** Metadata editable de una media; no representa un proveedor externo. */
export type MediaDraft = Omit<MovieMetadata, 'id'>;
