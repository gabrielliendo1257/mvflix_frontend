import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { VideoPlayer } from '@features/player/components/video-player/video-player';
import { WatchStore } from './watch-store';

@Component({
    selector: 'app-watch-page',
    imports: [VideoPlayer, RouterLink],
    providers: [WatchStore],
    templateUrl: './watch-page.html',
    styleUrl: './watch-page.css',
})
export class WatchPage implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly store = inject(WatchStore);

    // Estado de la reproducción; vive en el store de la navegación actual.
    readonly videoSrc = this.store.videoSrc;
    readonly poster = this.store.poster;
    readonly title = this.store.title;
    readonly year = this.store.year;
    readonly overview = this.store.overview;
    readonly loading = this.store.loading;
    readonly error = this.store.error;
    readonly resumeSeconds = this.store.resumeSeconds;
    readonly watchStore = this.store;

    ngOnInit(): void {
        this.route.paramMap.subscribe(() => {
            const id = Number(this.route.snapshot.paramMap.get('id'));
            if (Number.isNaN(id)) {
                this.router.navigate(['/movies']);
                return;
            }
            this.store.load(id);
        });
    }

    goBack(): void {
        this.router.navigate(['/movies']);
    }
}
