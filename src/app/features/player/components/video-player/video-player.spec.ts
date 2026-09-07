import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoPlayer } from './video-player';

describe('VideoPlayer', () => {
    let fixture: ComponentFixture<VideoPlayer>;
    let player: VideoPlayer;
    let snapshots: unknown[];

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [VideoPlayer] }).compileComponents();
        fixture = TestBed.createComponent(VideoPlayer);
        player = fixture.componentInstance;
        snapshots = [];
        player.snapshot.subscribe((snapshot) => snapshots.push(snapshot));
        fixture.detectChanges();
    });

    it('emite posición y duración en timeupdate', () => {
        const video = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
        Object.defineProperty(video, 'currentTime', { value: 12, configurable: true });
        Object.defineProperty(video, 'duration', { value: 120, configurable: true });

        video.dispatchEvent(new Event('timeupdate'));

        expect(snapshots).toEqual([{ positionSeconds: 12, durationSeconds: 120, completed: false }]);
    });

    it('emite completed true cuando termina y un snapshot al pausar', () => {
        const video = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
        Object.defineProperty(video, 'currentTime', { value: 120, configurable: true });
        Object.defineProperty(video, 'duration', { value: 120, configurable: true });

        video.dispatchEvent(new Event('pause'));
        video.dispatchEvent(new Event('ended'));

        expect(snapshots).toEqual([
            { positionSeconds: 120, durationSeconds: 120, completed: false },
            { positionSeconds: 120, durationSeconds: 120, completed: true },
        ]);
    });

    it('expone un error visible cuando falla la reproducción', () => {
        const video = fixture.nativeElement.querySelector('video') as HTMLVideoElement;
        Object.defineProperty(video, 'error', {
            configurable: true,
            value: { code: 3, message: 'Decode error' },
        });

        video.dispatchEvent(new Event('error'));
        fixture.detectChanges();

        expect(player.mediaError()).toBe('No se pudo reproducir el vídeo.');
        expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
            .toContain('No se pudo reproducir el vídeo.');
    });
});
