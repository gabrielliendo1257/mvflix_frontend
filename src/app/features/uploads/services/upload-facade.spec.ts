import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AddMediaApi } from '@features/uploads/data-access/add-media-api';
import { UploadTask } from '@features/uploads/models/upload-task';
import { MovieMetadata } from '@features/movies/models/movie-metadata';
import { UploadSessionPersistence } from './upload-session-persistence';
import { UploadFacade } from './upload-facade';

describe('UploadFacade', () => {
  let service: UploadFacade;
  let addMediaApi: jasmine.SpyObj<AddMediaApi>;

  beforeEach(() => {
    addMediaApi = jasmine.createSpyObj<AddMediaApi>('AddMediaApi', [
      'status', 'start', 'uploadToStorage', 'complete',
    ]);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: AddMediaApi, useValue: addMediaApi },
        { provide: UploadSessionPersistence, useValue: {
          loadPending: () => null,
          clearPending: () => undefined,
          savePending: () => undefined,
        } },
      ],
    });
    service = TestBed.inject(UploadFacade);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('valida el fingerprint y consulta el proceso fresco sin iniciar otro alta', () => {
    const task: UploadTask = {
      uploadId: 'idem-1',
      addMediaId: 'add-1',
      movieId: 10,
      providerId: 3,
      file: null,
      fileName: 'movie.mp4',
      fileFingerprint: {
        filename: 'movie.mp4',
        size: 3,
        mimeType: 'video/mp4',
        lastModified: 123,
        addMediaId: 'add-1',
      },
      progress: 0,
      state: 'waiting_for_file',
      metadata: {} as UploadTask['metadata'],
      kind: 'MOVIE',
    };
    service.tasks.set([task]);
    addMediaApi.status.and.returnValue(of({
      addMediaId: 'add-1', phase: 'READY', movieId: 10, uploadId: null, upload: null, failureCode: null,
    }));

    service.reselectFile('idem-1', new File(['abc'], 'movie.mp4', { type: 'video/mp4', lastModified: 123 }));

    expect(addMediaApi.status).toHaveBeenCalledWith('add-1');
    expect(service.taskById('idem-1')?.state).toBe('completed');
  });

  it('no continúa si el archivo no coincide con el fingerprint', () => {
    const task = {
      uploadId: 'idem-2', addMediaId: 'add-2', movieId: null, providerId: null, file: null, fileName: 'movie.mp4',
      fileFingerprint: { filename: 'movie.mp4', size: 3, mimeType: 'video/mp4', lastModified: 123, addMediaId: 'add-2' },
      progress: 0, state: 'waiting_for_file' as const, metadata: {} as UploadTask['metadata'], kind: 'MOVIE' as const,
    } satisfies UploadTask;
    service.tasks.set([task]);

    service.reselectFile('idem-2', new File(['different'], 'movie.mp4', { type: 'video/mp4', lastModified: 123 }));

    expect(addMediaApi.status).not.toHaveBeenCalled();
    expect(service.taskById('idem-2')?.state).toBe('waiting_for_file');
    expect(service.taskById('idem-2')?.error).toContain('archivo original');
  });

  it('pasa el File en memoria directamente a uploadToStorage', async () => {
    const file = new File(['x'], 'large-video.mkv', { type: 'video/x-matroska', lastModified: 456 });
    Object.defineProperty(file, 'size', { value: 3 * 1024 * 1024 * 1024 });
    const instructions = {
      url: 'https://minio.test/upload', method: 'PUT' as const, storageKey: 'key',
      expectedSizeBytes: file.size, expectedMimeType: file.type,
    };
    addMediaApi.start.and.returnValue(of({
      addMediaId: 'add-3', phase: 'WAITING_FOR_UPLOAD', movieId: null, uploadId: 'up-3',
      upload: instructions, failureCode: null,
    }));
    addMediaApi.uploadToStorage.and.returnValue(of(new HttpResponse({ body: null })));
    addMediaApi.complete.and.returnValue(of({
      addMediaId: 'add-3', phase: 'READY', movieId: 3, uploadId: 'up-3', upload: null, failureCode: null,
    }));

    service.startUpload(file, { title: 'Large' } as MovieMetadata, 'MOVIE', undefined, 3);
    await Promise.resolve();

    expect(addMediaApi.uploadToStorage).toHaveBeenCalledWith(file, instructions);
  });

  it('clasifica la interrupción del transporte sin registrar la firma del URL', async () => {
    const file = new File(['abc'], 'movie.mp4', { type: 'video/mp4', lastModified: 456 });
    const instructions = {
      url: 'https://minio.test/upload?X-Amz-Signature=secret', method: 'PUT' as const,
      storageKey: 'key', expectedSizeBytes: file.size, expectedMimeType: file.type,
    };
    addMediaApi.start.and.returnValue(of({
      addMediaId: 'add-5', phase: 'WAITING_FOR_UPLOAD', movieId: null, uploadId: 'up-5',
      upload: instructions, failureCode: null,
    }));
    addMediaApi.uploadToStorage.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') })),
    );

    const uploadId = service.startUpload(file, { title: 'Movie' } as MovieMetadata, 'MOVIE', undefined, 5);
    await Promise.resolve();

    const task = service.taskById(uploadId);
    expect(task?.failureCode).toBe('UPLOAD_CONNECTION_INTERRUPTED');
    expect(task?.error).toContain('La conexión del upload se interrumpió');
    expect(task?.diagnostics?.uploadHost).toBe('minio.test');
    expect(task?.diagnostics?.uploadHost).not.toContain('X-Amz-Signature');
  });

  it('envía providerId null para un vídeo genérico', () => {
    addMediaApi.start.and.returnValue(of({
      addMediaId: 'add-video', phase: 'READY', movieId: 7, uploadId: null, upload: null, failureCode: null,
    }));

    service.startUpload(new File(['video'], 'recording.mp4', { type: 'video/mp4' }),
      { title: 'Recording' } as MovieMetadata, 'VIDEO');

    expect(addMediaApi.start).toHaveBeenCalledWith(jasmine.objectContaining({
      movie: jasmine.objectContaining({ providerId: null, draft: jasmine.objectContaining({ kind: 'VIDEO' }) }),
    }));
  });
});
