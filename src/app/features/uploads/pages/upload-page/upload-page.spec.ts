import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MediaDraft } from '@features/movies/models/media-draft';
import { UploadFacade } from '@features/uploads/services/upload-facade';
import { UploadPage } from './upload-page';

describe('UploadPage', () => {
  let component: UploadPage;
  let fixture: ComponentFixture<UploadPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadPage],
      providers: [provideHttpClient()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(UploadPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('rechaza una película sin candidato TMDB desde la UI', () => {
    const facade = (component as unknown as { uploadFacade: UploadFacade }).uploadFacade;
    const toast = (component as unknown as { toast: { warning: (message: string) => void } }).toast;
    spyOn(facade, 'startUpload');
    const warning = spyOn(toast, 'warning');
    component.file.set(new File(['movie'], 'movie.mp4', { type: 'video/mp4' }));

    component.onSubmit({ kind: 'MOVIE', metadata: metadata('Movie') });

    expect(facade.startUpload).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalled();
  });

  it('permite un vídeo sin candidato y lo inicia como VIDEO', () => {
    const facade = (component as unknown as { uploadFacade: UploadFacade }).uploadFacade;
    const startUpload = spyOn(facade, 'startUpload').and.returnValue('upload-1');
    const file = new File(['video'], 'recording.mp4', { type: 'video/mp4' });
    component.file.set(file);

    component.onSubmit({ kind: 'VIDEO', metadata: metadata('Recording') });

    expect(startUpload).toHaveBeenCalledWith(file, jasmine.objectContaining({ title: 'Recording' }), 'VIDEO', { visibility: 'PRIVATE' }, null);
  });
});

function metadata(title: string): MediaDraft {
  return {
    title, originalTitle: '', year: null, genres: [], popularity: 5,
    duration: '', director: '', cast: [], overview: '', poster_path: null,
    release_date: '', country: '', language: '', awards: [],
  };
}
